import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  code: string;
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

    const { code }: RequestBody = await req.json();

    // Get stored verification data from user metadata
    const storedCode = user.user_metadata?.verification_code;
    const expiresAt = user.user_metadata?.verification_expires;
    const phoneNumber = user.user_metadata?.verification_phone;

    if (!storedCode || !expiresAt) {
      throw new Error("No verification code found. Please request a new code.");
    }

    // Check if code expired
    if (new Date(expiresAt) < new Date()) {
      throw new Error("Verification code expired. Please request a new code.");
    }

    // Check if code matches
    if (code !== storedCode) {
      throw new Error("Invalid verification code");
    }

    // Update profile to mark phone as verified
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        phone_verified: true,
        phone_e164: phoneNumber,
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Clear verification data from metadata
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        verification_code: null,
        verification_expires: null,
        verification_phone: null,
      },
    });

    console.log("Phone verified for user:", user.id);

    return new Response(
      JSON.stringify({ message: "Phone verified successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occured";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-type": "application/json" },
      status: 400,
    });
  }
});
