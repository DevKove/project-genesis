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
      account_access_requests: {
        Row: {
          email: string
          full_name: string | null
          id: string
          requested_association_id: string | null
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          email: string
          full_name?: string | null
          id?: string
          requested_association_id?: string | null
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          full_name?: string | null
          id?: string
          requested_association_id?: string | null
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_access_requests_requested_association_id_fkey"
            columns: ["requested_association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          association_id: string
          body: string
          created_at: string
          created_by: string
          id: string
          pinned: boolean
          title: string
        }
        Insert: {
          association_id: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          pinned?: boolean
          title: string
        }
        Update: {
          association_id?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          pinned?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_join_requests: {
        Row: {
          association_id: string
          association_name: string
          email: string
          full_name: string | null
          id: string
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          association_id: string
          association_name: string
          email: string
          full_name?: string | null
          id?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          association_id?: string
          association_name?: string
          email?: string
          full_name?: string | null
          id?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_join_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_members: {
        Row: {
          association_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["assoc_role"]
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["assoc_role"]
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["assoc_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      associations: {
        Row: {
          address: string | null
          association_code: string
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          status: string
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          association_code: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          association_code?: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          association_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          association_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
          user_id?: string | null
        }
        Update: {
          action?: string
          association_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          association_id: string
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          file_path: string
          id: string
          mime_type: string
          size_bytes: number
          title: string
          updated_at: string
          uploaded_by: string
          visibility: string
        }
        Insert: {
          association_id: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_path: string
          id?: string
          mime_type: string
          size_bytes: number
          title: string
          updated_at?: string
          uploaded_by: string
          visibility?: string
        }
        Update: {
          association_id?: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_path?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          title?: string
          updated_at?: string
          uploaded_by?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to: string | null
          association_id: string
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          priority: string
          resolution_notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          association_id: string
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          association_id?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          association_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["assoc_role"]
          status: string
          token: string
        }
        Insert: {
          association_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["assoc_role"]
          status?: string
          token?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["assoc_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          approval_requested_at: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          approval_requested_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          approval_requested_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          association_id: string
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          identity_document_mime_type: string | null
          identity_document_name: string | null
          identity_document_path: string | null
          identity_document_size_bytes: number | null
          is_active: boolean
          lgpd_consent: boolean
          notes: string | null
          phone: string | null
          relation: Database["public"]["Enums"]["resident_relation"]
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          association_id: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          identity_document_mime_type?: string | null
          identity_document_name?: string | null
          identity_document_path?: string | null
          identity_document_size_bytes?: number | null
          is_active?: boolean
          lgpd_consent?: boolean
          notes?: string | null
          phone?: string | null
          relation?: Database["public"]["Enums"]["resident_relation"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          association_id?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          identity_document_mime_type?: string | null
          identity_document_name?: string | null
          identity_document_path?: string | null
          identity_document_size_bytes?: number | null
          is_active?: boolean
          lgpd_consent?: boolean
          notes?: string | null
          phone?: string | null
          relation?: Database["public"]["Enums"]["resident_relation"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_association_unit_fk"
            columns: ["association_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["association_id", "id"]
          },
        ]
      }
      service_requests: {
        Row: {
          association_id: string
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          priority: string
          resolution_notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          association_id: string
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          association_id: string
          block: string | null
          created_at: string
          id: string
          identifier: string
          notes: string | null
          number: string | null
          status: string
          street: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          association_id: string
          block?: string | null
          created_at?: string
          id?: string
          identifier: string
          notes?: string | null
          number?: string | null
          status?: string
          street?: string | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          block?: string | null
          created_at?: string
          id?: string
          identifier?: string
          notes?: string | null
          number?: string | null
          status?: string
          street?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          association_id: string | null
          created_at: string
          id: string
          message: string
          notification_type: string
          read_at: string | null
          recipient_id: string
          request_id: string | null
          title: string
        }
        Insert: {
          association_id?: string | null
          created_at?: string
          id?: string
          message: string
          notification_type: string
          read_at?: string | null
          recipient_id: string
          request_id?: string | null
          title: string
        }
        Update: {
          association_id?: string | null
          created_at?: string
          id?: string
          message?: string
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "association_join_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          association_id: string
          contact_name: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          identity_document_mime_type: string | null
          identity_document_name: string | null
          identity_document_path: string | null
          identity_document_size_bytes: number | null
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          service_category: string
          updated_at: string
        }
        Insert: {
          association_id: string
          contact_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          identity_document_mime_type?: string | null
          identity_document_name?: string | null
          identity_document_path?: string | null
          identity_document_size_bytes?: number | null
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          service_category?: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          identity_document_mime_type?: string | null
          identity_document_name?: string | null
          identity_document_path?: string | null
          identity_document_size_bytes?: number | null
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          service_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      association_member_directory: {
        Row: {
          association_id: string | null
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          association_id?: string | null
          full_name?: never
          user_id?: string | null
        }
        Update: {
          association_id?: string | null
          full_name?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "association_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      admin_list_user_profiles: {
        Args: never
        Returns: {
          account_status: string
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          memberships: Json
          phone: string
          platform_role: string
          user_id: string
        }[]
      }
      admin_update_association_member_role: {
        Args: { _association_id: string; _new_role: string; _user_id: string }
        Returns: undefined
      }
      create_association: {
        Args: { _city?: string; _cnpj?: string; _name: string; _state?: string }
        Returns: string
      }
      list_pending_account_access: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          requested_association_id: string
          requested_at: string
          status: string
          user_id: string
        }[]
      }
      lookup_association_by_code: {
        Args: { _code: string }
        Returns: {
          city: string
          id: string
          name: string
          state: string
        }[]
      }
      request_association_membership: {
        Args: { _association_id: string }
        Returns: string
      }
      review_account_access: {
        Args: {
          _association_id?: string
          _association_role?: Database["public"]["Enums"]["assoc_role"]
          _decision: string
          _note?: string
          _user_id: string
        }
        Returns: undefined
      }
      review_association_join_request: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "platform_admin" | "platform_staff"
      assoc_role:
        | "admin"
        | "presidente"
        | "tesoureiro"
        | "secretario"
        | "conselheiro"
        | "funcionario"
        | "morador"
      resident_relation:
        | "proprietario"
        | "inquilino"
        | "dependente"
        | "ocupante"
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
      app_role: ["platform_admin", "platform_staff"],
      assoc_role: [
        "admin",
        "presidente",
        "tesoureiro",
        "secretario",
        "conselheiro",
        "funcionario",
        "morador",
      ],
      resident_relation: [
        "proprietario",
        "inquilino",
        "dependente",
        "ocupante",
      ],
    },
  },
} as const
