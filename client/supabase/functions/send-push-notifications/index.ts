import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  messageId: string;
}

interface ServiceAccount {
  private_key: string;
  client_email: string;
  project_id: string;
}

interface FcmToken {
  token: string;
}

// Generate OAuth2 access token from service account
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const { private_key: privateKey, client_email: clientEmail } = serviceAccount;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(privateKey.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    },
    key
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data: { access_token: string } = await response.json();
  return data.access_token;
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
        fcm_tokens!inner (
          token
        )
      `
      )
      .eq("message_id", messageId)
      .eq("status", "pending");

    if (recipientsError) throw recipientsError;

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    let accessToken: string | null = null;
    let projectId: string | null = null;

    if (serviceAccountJson) {
      try {
        const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
        projectId = serviceAccount.project_id;
        accessToken = await getAccessToken(serviceAccount);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unknown error parsing service account";
        console.error(
          "Failed to parse service account or get access token:",
          msg
        );
      }
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients || []) {
      const channels = Array.isArray(recipient.channels_attempted)
        ? recipient.channels_attempted
        : [];

      if (!channels.includes("push")) continue;

      const tokens: FcmToken[] = recipient.fcm_tokens;

      if (!tokens || tokens.length === 0) {
        console.log("Skipping recipient - no FCM tokens:", recipient.user_id);
        continue;
      }

      for (const tokenRecord of tokens) {
        try {
          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "push",
            status: "pending",
          });

          if (!accessToken || !projectId) {
            console.log("Dev mode - Push to", recipient.user_id, ":", {
              title: message.title,
              body: message.body,
            });
            sentCount++;

            await supabase.from("delivery_logs").insert({
              message_id: messageId,
              recipient_id: recipient.id,
              channel: "push",
              status: "delivered",
            });

            await supabase
              .from("message_recipients")
              .update({ status: "delivered" })
              .eq("id", recipient.id);

            break;
          }

          const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
          const response = await fetch(fcmUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: tokenRecord.token,
                notification: {
                  title: message.title,
                  body: message.body,
                },
                data: {
                  messageId: message.id,
                  link: message.link || "",
                },
                webpush: {
                  notification: {
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                  },
                },
              },
            }),
          });

          if (response.ok) {
            const result: { name?: string } = await response.json();
            sentCount++;

            await supabase.from("delivery_logs").insert({
              message_id: messageId,
              recipient_id: recipient.id,
              channel: "push",
              status: "delivered",
              provider_message_id: result.name || "fcm-success",
            });

            await supabase
              .from("message_recipients")
              .update({ status: "delivered" })
              .eq("id", recipient.id);

            console.log("Push sent to:", recipient.user_id);
            break;
          } else {
            const errorData = await response.json();
            console.error("FCM V1 error:", errorData);

            const errorCode =
              errorData.error?.details?.[0]?.errorCode ||
              errorData.error?.status;
            if (
              errorCode === "UNREGISTERED" ||
              errorCode === "INVALID_ARGUMENT"
            ) {
              console.log("Invalid token, removing:", tokenRecord.token);
              await supabase
                .from("fcm_tokens")
                .delete()
                .eq("token", tokenRecord.token);
            }
          }
        } catch (fcmError: unknown) {
          const msg =
            fcmError instanceof Error ? fcmError.message : "Unknown FCM error";
          console.error("FCM send error:", msg);
          failedCount++;

          await supabase.from("delivery_logs").insert({
            message_id: messageId,
            recipient_id: recipient.id,
            channel: "push",
            status: "failed",
            error_message: msg,
          });
        }
      }
    }

    console.log(
      `Push notification delivery complete: ${sentCount} sent, ${failedCount} failed`
    );

    return new Response(
      JSON.stringify({
        message: "Push notification delivery processed",
        sent: sentCount,
        failed: failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
