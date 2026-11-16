export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          bank_name: string
          email_auto_respond: boolean
          id: number
          secure_channel_text: string
          social_auto_reply: boolean
          updated_at: string
          voice_recording_enabled: boolean
        }
        Insert: {
          bank_name?: string
          email_auto_respond?: boolean
          id?: number
          secure_channel_text?: string
          social_auto_reply?: boolean
          updated_at?: string
          voice_recording_enabled?: boolean
        }
        Update: {
          bank_name?: string
          email_auto_respond?: boolean
          id?: number
          secure_channel_text?: string
          social_auto_reply?: boolean
          updated_at?: string
          voice_recording_enabled?: boolean
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string
          application_id: string
          created_at: string
          customer_id: string
          holder_name: string
          id: string
          opening_deposit: number
          product: string
          status: string
        }
        Insert: {
          account_number: string
          application_id: string
          created_at?: string
          customer_id: string
          holder_name: string
          id?: string
          opening_deposit?: number
          product: string
          status?: string
        }
        Update: {
          account_number?: string
          application_id?: string
          created_at?: string
          customer_id?: string
          holder_name?: string
          id?: string
          opening_deposit?: number
          product?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bank_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_application_access: {
        Row: {
          application_id: string
          attempts: number
          code_hash: string
          email_sent: boolean
          expires_at: string
          token_hash: string
        }
        Insert: {
          application_id: string
          attempts?: number
          code_hash: string
          email_sent?: boolean
          expires_at: string
          token_hash: string
        }
        Update: {
          application_id?: string
          attempts?: number
          code_hash?: string
          email_sent?: boolean
          expires_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_application_access_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "bank_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_applications: {
        Row: {
          channel: string
          created_at: string
          details: Json
          documents: Json
          email: string
          email_verified_at: string | null
          full_name: string
          id: string
          identity_status: string
          is_fictional: boolean
          phone: string
          reference: string
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          details?: Json
          documents?: Json
          email: string
          email_verified_at?: string | null
          full_name: string
          id?: string
          identity_status?: string
          is_fictional?: boolean
          phone: string
          reference?: string
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          details?: Json
          documents?: Json
          email?: string
          email_verified_at?: string | null
          full_name?: string
          id?: string
          identity_status?: string
          is_fictional?: boolean
          phone?: string
          reference?: string
          status?: string
        }
        Relationships: []
      }
      customer_device_access: {
        Row: {
          customer_id: string
          expires_at: string
          token_hash: string
        }
        Insert: {
          customer_id: string
          expires_at: string
          token_hash: string
        }
        Update: {
          customer_id?: string
          expires_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_device_access_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_balance: number | null
          account_number: string | null
          created_at: string
          demo_verification_code: string
          email: string
          full_name: string
          id: string
          loan_status: string
          next_repayment_date: string | null
          phone_number: string | null
          repayment_amount: number | null
        }
        Insert: {
          account_balance?: number | null
          account_number?: string | null
          created_at?: string
          demo_verification_code: string
          email: string
          full_name: string
          id?: string
          loan_status?: string
          next_repayment_date?: string | null
          phone_number?: string | null
          repayment_amount?: number | null
        }
        Update: {
          account_balance?: number | null
          account_number?: string | null
          created_at?: string
          demo_verification_code?: string
          email?: string
          full_name?: string
          id?: string
          loan_status?: string
          next_repayment_date?: string | null
          phone_number?: string | null
          repayment_amount?: number | null
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body: string
          case_reference: string
          created_at: string
          delivery_note: string | null
          draft_response: string | null
          escalation_id: string | null
          final_response: string | null
          gmail_message_id: string | null
          id: string
          intent: string | null
          knowledge_id: string | null
          sender: string
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          case_reference: string
          created_at?: string
          delivery_note?: string | null
          draft_response?: string | null
          escalation_id?: string | null
          final_response?: string | null
          gmail_message_id?: string | null
          id?: string
          intent?: string | null
          knowledge_id?: string | null
          sender: string
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          case_reference?: string
          created_at?: string
          delivery_note?: string | null
          draft_response?: string | null
          escalation_id?: string | null
          final_response?: string | null
          gmail_message_id?: string | null
          id?: string
          intent?: string | null
          knowledge_id?: string | null
          sender?: string
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "escalations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_notes: {
        Row: {
          author_email: string | null
          author_id: string
          created_at: string
          escalation_id: string
          id: string
          note: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string
          created_at?: string
          escalation_id: string
          id?: string
          note: string
        }
        Update: {
          author_email?: string | null
          author_id?: string
          created_at?: string
          escalation_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_notes_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "escalations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          assigned_to: string | null
          case_reference: string | null
          channel: string
          conversation_summary: string | null
          created_at: string
          customer_email: string | null
          description: string
          id: string
          issue_category: string
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_reference?: string | null
          channel: string
          conversation_summary?: string | null
          created_at?: string
          customer_email?: string | null
          description: string
          id?: string
          issue_category: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_reference?: string | null
          channel?: string
          conversation_summary?: string | null
          created_at?: string
          customer_email?: string | null
          description?: string
          id?: string
          issue_category?: string
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      interaction_logs: {
        Row: {
          case_reference: string
          channel: string
          created_at: string
          created_by: string | null
          customer_email: string | null
          direction: string
          id: string
          interaction_summary: string
          result: string
          timestamp: string
        }
        Insert: {
          case_reference: string
          channel: string
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          direction: string
          id?: string
          interaction_summary: string
          result: string
          timestamp?: string
        }
        Update: {
          case_reference?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          direction?: string
          id?: string
          interaction_summary?: string
          result?: string
          timestamp?: string
        }
        Relationships: []
      }
      knowledge: {
        Row: {
          approved_answer: string
          category: string
          created_at: string
          id: string
          keywords: string[]
          topic: string
          updated_at: string
        }
        Insert: {
          approved_answer: string
          category?: string
          created_at?: string
          id?: string
          keywords?: string[]
          topic: string
          updated_at?: string
        }
        Update: {
          approved_answer?: string
          category?: string
          created_at?: string
          id?: string
          keywords?: string[]
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_voice_access: {
        Row: {
          expires_at: string
          session_id: string
          token_hash: string
        }
        Insert: {
          expires_at: string
          session_id: string
          token_hash: string
        }
        Update: {
          expires_at?: string
          session_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_voice_access_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_messages: {
        Row: {
          action: string | null
          author_handle: string
          body: string
          case_reference: string
          created_at: string
          delivery_note: string | null
          escalation_id: string | null
          id: string
          intent: string | null
          message_type: string
          platform: string
          response: string | null
          status: string
        }
        Insert: {
          action?: string | null
          author_handle: string
          body: string
          case_reference: string
          created_at?: string
          delivery_note?: string | null
          escalation_id?: string | null
          id?: string
          intent?: string | null
          message_type: string
          platform: string
          response?: string | null
          status?: string
        }
        Update: {
          action?: string | null
          author_handle?: string
          body?: string
          case_reference?: string
          created_at?: string
          delivery_note?: string | null
          escalation_id?: string | null
          id?: string
          intent?: string | null
          message_type?: string
          platform?: string
          response?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_messages_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "escalations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_sessions: {
        Row: {
          case_reference: string
          created_at: string
          id: string
          offer_shown: boolean
          pending_action: string | null
          recognized_customer_id: string | null
          resolution_state: string
          status: string
          transcript: Json
          updated_at: string
          verification_attempts: number
          verified_customer_email: string | null
        }
        Insert: {
          case_reference: string
          created_at?: string
          id?: string
          offer_shown?: boolean
          pending_action?: string | null
          recognized_customer_id?: string | null
          resolution_state?: string
          status?: string
          transcript?: Json
          updated_at?: string
          verification_attempts?: number
          verified_customer_email?: string | null
        }
        Update: {
          case_reference?: string
          created_at?: string
          id?: string
          offer_shown?: boolean
          pending_action?: string | null
          recognized_customer_id?: string | null
          resolution_state?: string
          status?: string
          transcript?: Json
          updated_at?: string
          verification_attempts?: number
          verified_customer_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_recognized_customer_id_fkey"
            columns: ["recognized_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_training_questions: {
        Row: {
          approved_answer: string
          category: string
          id: string
          intent: string
          keywords: string[]
          language: string
          question: string
          sort_order: number
          source_answer: string
          topic: string
        }
        Insert: {
          approved_answer: string
          category?: string
          id?: string
          intent: string
          keywords?: string[]
          language: string
          question: string
          sort_order?: number
          source_answer: string
          topic: string
        }
        Update: {
          approved_answer?: string
          category?: string
          id?: string
          intent?: string
          keywords?: string[]
          language?: string
          question?: string
          sort_order?: number
          source_answer?: string
          topic?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string
          case_reference: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          intent: string | null
          language: string | null
          phone: string
          reply_to: string | null
          source: string
          status: string
          status_at: string | null
          wa_message_id: string | null
        }
        Insert: {
          body: string
          case_reference?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          intent?: string | null
          language?: string | null
          phone: string
          reply_to?: string | null
          source?: string
          status?: string
          status_at?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          case_reference?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          intent?: string | null
          language?: string | null
          phone?: string
          reply_to?: string | null
          source?: string
          status?: string
          status_at?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          delivery_id: string
          event: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          attempts?: number
          delivery_id: string
          event: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          attempts?: number
          delivery_id?: string
          event?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_test_application: {
        Args: { p_code_hash: string; p_hash: string; p_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      resolve_voice_conversation: {
        Args: { p_end: boolean; p_escalate: boolean; p_session: string }
        Returns: Json
      }
      verify_voice_customer: {
        Args: { p_code: string; p_identity: string; p_session: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "agent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent"],
    },
  },
} as const
