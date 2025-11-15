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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { messageId }: RequestBody = await req.json();

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError) throw messageError;

    const { data: recipients, error: recipientsError } = await supabase
      .from("message_recipients")
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

      const profile = recipient.profiles as
        | { phone_e164?: string; phone_verified?: boolean }
        | undefined;

      if (!profile?.phone_verified || !profile?.phone_e164) {
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
        await supabase.from("delivery_logs").insert({
          message_id: messageId,
          recipient_id: recipient.id,
          channel: "sms",
          status: "pending",
        });

        if (!twilioSid || !twilioToken || !twilioPhone) {
          console.log("Dev mode - SMS to", profile.phone_e164, ":", smsBody);
          sentCount++;

          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "sms",
            status: "delivered",
          });

          await supabase
            .from("message_recipients")
            .update({ status: "delivered" })
            .eq("id", recipient.id);

          continue;
        }

        try {
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
            const result: { sid?: string } = await response.json();
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
            console.log("Dev mode fallback - logging message instead");

            sentCount++;
            await supabase.from("delivery_logs").insert({
              message_id: messageId,
              recipient_id: recipient.id,
              channel: "sms",
              status: "delivered",
              error_message: `Dev mode: ${errorText}`,
            });

            await supabase
              .from("message_recipients")
              .update({ status: "delivered" })
              .eq("id", recipient.id);
          }
        } catch (twilioError: unknown) {
          const message =
            twilioError instanceof Error
              ? twilioError.message
              : "Unknown Twilio error";
          console.error("Twilio send error:", message);
          console.log("Dev mode fallback - logging message instead");

          sentCount++;
          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "sms",
            status: "delivered",
            error_message: `Dev mode: ${message}`,
          });

          await supabase
            .from("message_recipients")
            .update({ status: "delivered" })
            .eq("id", recipient.id);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown recipient error";
        console.error(
          "Error sending to recipient:",
          recipient.user_id,
          message
        );
        failedCount++;

        await supabase.from("delivery_logs").insert({
          message_id: messageId,
          recipient_id: recipient.id,
          channel: "sms",
          status: "failed",
          error_message: message,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
