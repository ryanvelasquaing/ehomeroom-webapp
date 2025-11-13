export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Updated Database type with actual tables
export type Database = {
  graphql_public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          phone_e164: string | null;
          phone_verified: boolean;
          role: "admin" | "teacher" | "parent";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          phone_e164?: string | null;
          phone_verified?: boolean;
          role: "admin" | "teacher" | "parent";
        };
        Update: Partial<{
          email: string;
          phone_e164: string | null;
          phone_verified: boolean;
          role: "admin" | "teacher" | "parent";
        }>;
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          title: string;
          body: string;
          link: string | null;
          audience_type: "all" | "role" | "class" | "individual";
          audience_filter: Json | null;
          channels: string[];
          scheduled_at: string | null;
          recurrence: Json | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          title: string;
          body: string;
          link?: string | null;
          audience_type: "all" | "role" | "class" | "individual";
          audience_filter?: Json | null;
          channels: string[];
          scheduled_at?: string | null;
          recurrence?: Json | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: Partial<{
          title: string;
          body: string;
          link: string | null;
          audience_type: "all" | "role" | "class" | "individual";
          audience_filter: Json | null;
          channels: string[];
          scheduled_at: string | null;
          recurrence: Json | null;
          sent_at: string | null;
        }>;
      };
      message_recipients: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          channels_attempted: string[];
          status: "pending" | "delivered" | "failed";
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          channels_attempted?: string[];
          status?: "pending" | "delivered" | "failed";
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          channels_attempted: string[];
          status: "pending" | "delivered" | "failed";
          read_at: string | null;
        }>;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export const Constants = {
  graphql_public: { Enums: {} },
  public: { Enums: {} },
} as const;
