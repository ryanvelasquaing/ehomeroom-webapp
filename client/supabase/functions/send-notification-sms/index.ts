import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  messageId: string;
}

interface RecipientProfile {
  phone_verified?: boolean;
  phone_e164?: string;
}

interface Recipient {
  id: string;
  user_id: string;
  channels_attempted?: string[];
  profiles?: RecipientProfile;
}

interface Message {
  id: string;
  title: string;
  body: string;
  link?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Unauthorized");

    const { messageId }: RequestBody = await req.json();

    // Get message details
    const { data: message, error: messageError } = await supabase
      .from<Message>("messages")
      .select("*")
      .eq("id", messageId)
      .single();
    if (messageError || !message) throw messageError;

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from<Recipient>("message_recipients")
      .select(
        `
        id,
        user_id,
        channels_attempted,
        profiles!message_recipients_user_id_fkey (
          phone_e164,
          phone_verified
        )
      `
      )
      .eq("message_id", messageId)
      .eq("status", "pending");
    if (recipientsError) throw recipientsError;

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients || []) {
      const channels = Array.isArray(recipient.channels_attempted)
        ? recipient.channels_attempted
        : [];

      if (!channels.includes("sms")) continue;

      const profile: RecipientProfile = recipient.profiles ?? {};

      if (!profile.phone_verified || !profile.phone_e164) {
        console.log(
          "Skipping recipient - no verified phone:",
          recipient.user_id
        );
        continue;
      }

      const smsBody = `${message.title}\n\n${message.body}${
        message.link ? `\n\n${message.link}` : ""
      }`;

      try {
        // Log attempt
        await supabase.from("delivery_logs").insert({
          message_id: messageId,
          recipient_id: recipient.id,
          channel: "sms",
          status: "pending",
        });

        // Send SMS
        if (!twilioSid || !twilioToken || !twilioPhone) {
          console.log("SMS mock:", smsBody, "to", profile.phone_e164);
          sentCount++;

          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "sms",
            status: "delivered",
          });

          continue;
        }

        const auth = btoa(`${twilioSid}:${twilioToken}`);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

        const formData = new URLSearchParams();
        formData.append("To", profile.phone_e164);
        formData.append("From", twilioPhone);
        formData.append("Body", smsBody);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (response.ok) {
          const result = await response.json();
          sentCount++;

          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "sms",
            status: "delivered",
            provider_message_id: result.sid,
          });

          await supabase
            .from("message_recipients")
            .update({ status: "delivered" })
            .eq("id", recipient.id);

          console.log("SMS sent to:", profile.phone_e164);
        } else {
          const errorText = await response.text();
          console.error("Twilio error:", errorText);
          failedCount++;

          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "sms",
            status: "failed",
            error_message: errorText,
          });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "Error sending to recipient:",
          recipient.user_id,
          errorMessage
        );
        failedCount++;

        await supabase.from("delivery_logs").insert({
          message_id: messageId,
          recipient_id: recipient.id,
          channel: "sms",
          status: "failed",
          error_message: errorMessage,
        });
      }
    }

    console.log(
      `SMS delivery complete: ${sentCount} sent, ${failedCount} failed`
    );

    return new Response(
      JSON.stringify({
        message: "SMS delivery processed",
        sent: sentCount,
        failed: failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
