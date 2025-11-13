import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type Profile = {
  id: string;
  email: string;
  phone_e164: string | null;
  phone_verified: boolean;
  role: "admin" | "teacher" | "parent";
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  title: string;
  body: string;
  link: string | null;
  audience_type: "all" | "role" | "class" | "individual";
  audience_filter: Record<string, string | number | boolean> | null;
  channels: string[];
  scheduled_at: string | null;
  recurrence: {
    frequency: "daily" | "weekly" | "monthly";
    interval?: number;
  } | null;
  created_at: string;
  sent_at: string | null;
};

export type MessageRecipient = {
  id: string;
  message_id: string;
  user_id: string;
  channels_attempted: string[];
  status: "pending" | "delivered" | "failed";
  read_at: string | null;
  created_at: string;
  updated_at: string;
};
