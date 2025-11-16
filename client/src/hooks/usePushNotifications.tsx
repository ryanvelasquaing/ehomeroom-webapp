import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { requestFCMToken, initializeFirebase } from "@/lib/firebase";

export const usePushNotifications = (userId: string | undefined) => {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if browser supports notifications
    setIsSupported("Notification" in window && "serviceWorker" in navigator);

    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Initialize Firebase
    initializeFirebase();
  }, []);

  const requestPermission = async () => {
    if (!isSupported || !userId) return;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === "granted") {
        // Send Firebase config to service worker
        const firebaseConfigStr = import.meta.env.VITE_FIREBASE_CONFIG;
        if (firebaseConfigStr && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );
          await navigator.serviceWorker.ready;

          registration.active?.postMessage({
            type: "FIREBASE_CONFIG",
            config: firebaseConfigStr,
          });
        }

        // Get FCM token
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        const token = await requestFCMToken(vapidKey);

        if (!token) {
          throw new Error("Failed to get FCM token");
        }

        // Check if token already exists
        const { data: existingToken } = await supabase
          .from("fcm_tokens")
          .select("id")
          .eq("user_id", userId)
          .eq("token", token)
          .single();

        if (!existingToken) {
          await supabase.from("fcm_tokens").insert({
            user_id: userId,
            token,
          });
        }

        toast({
          title: "Notifications enabled",
          description: "You will now receive push notifications",
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Error",
        description: "Failed to enable notifications",
        variant: "destructive",
      });
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
  };
};
