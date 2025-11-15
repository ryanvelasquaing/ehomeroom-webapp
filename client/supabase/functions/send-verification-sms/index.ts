import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  phoneNumber: string;
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
    if (!authHeader) throw new Error("No authorization header");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Unauthorized");

    const { phoneNumber }: RequestBody = await req.json();

    // Generate 6-digit code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store in user metadata temporarily
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        verification_code: verificationCode,
        verification_expires: expiresAt,
        verification_phone: phoneNumber,
      },
    });

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Dev mode if Twilio not configured
    if (!twilioSid || !twilioToken || !twilioPhone) {
      console.log(
        "Dev mode: Verification code",
        verificationCode,
        "for",
        phoneNumber
      );
      return new Response(
        JSON.stringify({
          message: "Dev mode: Check console for code",
          code: verificationCode,
          devMode: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    try {
      const auth = btoa(`${twilioSid}:${twilioToken}`);
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

      const formData = new URLSearchParams();
      formData.append("To", phoneNumber);
      formData.append("From", twilioPhone);
      formData.append("Body", `Your verification code is: ${verificationCode}`);

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twilio error:", errorText);
        return new Response(
          JSON.stringify({
            message: "Dev mode: Twilio not configured properly",
            code: verificationCode,
            devMode: true,
            twilioError: errorText,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      console.log("Verification SMS sent to:", phoneNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown SMS error";
      console.error("SMS send error:", message);
      return new Response(
        JSON.stringify({
          message: "Dev mode: Error sending SMS",
          code: verificationCode,
          devMode: true,
          errorMessage: message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(JSON.stringify({ message: "Verification code sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
