import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getMessaging,
  Messaging,
  getToken,
  onMessage,
  MessagePayload,
} from "firebase/messaging";

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export const initializeFirebase = (): {
  app: FirebaseApp | null;
  messaging: Messaging | null;
} => {
  if (firebaseApp) return { app: firebaseApp, messaging };

  try {
    const firebaseConfigStr = import.meta.env.VITE_FIREBASE_CONFIG;
    if (!firebaseConfigStr) {
      console.warn("Firebase config not found");
      return { app: null, messaging: null };
    }

    const firebaseConfig = JSON.parse(firebaseConfigStr);
    firebaseApp = initializeApp(firebaseConfig);

    if ("serviceWorker" in navigator) {
      messaging = getMessaging(firebaseApp);
    }

    return { app: firebaseApp, messaging };
  } catch (error: unknown) {
    console.error("Failed to initialize Firebase:", error);
    return { app: null, messaging: null };
  }
};

export const requestFCMToken = async (
  vapidKey?: string
): Promise<string | null> => {
  try {
    const { messaging: msg } = initializeFirebase();
    if (!msg) {
      console.warn("Firebase messaging not initialized");
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(msg, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: registration,
    });

    return token;
  } catch (error: unknown) {
    console.error("Failed to get FCM token:", error);
    return null;
  }
};

export const onMessageListener = (): Promise<MessagePayload> => {
  const { messaging: msg } = initializeFirebase();
  if (!msg) return Promise.reject(new Error("Messaging not initialized"));

  return new Promise((resolve) => {
    onMessage(msg, (payload) => {
      resolve(payload);
    });
  });
};
