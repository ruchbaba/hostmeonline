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
      accounts: {
        Row: {
          created_at: string
          email: string
          extra_pages_purchased: number
          gift_claimed: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          extra_pages_purchased?: number
          gift_claimed?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          extra_pages_purchased?: number
          gift_claimed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          active: boolean
          cpm_price: number
          created_at: string
          host_id: string
          id: string
          inapp_impressions: number
          kind: string
          owner_id: string | null
          remaining_impressions: number
          shared_impressions: number
          total_impressions: number
        }
        Insert: {
          active?: boolean
          cpm_price?: number
          created_at?: string
          host_id: string
          id?: string
          inapp_impressions?: number
          kind: string
          owner_id?: string | null
          remaining_impressions?: number
          shared_impressions?: number
          total_impressions?: number
        }
        Update: {
          active?: boolean
          cpm_price?: number
          created_at?: string
          host_id?: string
          id?: string
          inapp_impressions?: number
          kind?: string
          owner_id?: string | null
          remaining_impressions?: number
          shared_impressions?: number
          total_impressions?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          body: string
          created_at: string
          host_id: string
          id: string
          image_url: string | null
          link: string | null
          page_key: string
        }
        Insert: {
          body: string
          created_at?: string
          host_id: string
          id?: string
          image_url?: string | null
          link?: string | null
          page_key: string
        }
        Update: {
          body?: string
          created_at?: string
          host_id?: string
          id?: string
          image_url?: string | null
          link?: string | null
          page_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_page_key_fkey"
            columns: ["page_key"]
            isOneToOne: false
            referencedRelation: "static_pages"
            referencedColumns: ["key"]
          },
        ]
      }
      email_outbox: {
        Row: {
          created_at: string
          html: string
          id: string
          kind: string
          payload: Json
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          created_at?: string
          html: string
          id?: string
          kind: string
          payload?: Json
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          created_at?: string
          html?: string
          id?: string
          kind?: string
          payload?: Json
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      guest_messengers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string
          entries: number
          guest_id: string
          host_id: string
          slot1_count: number
        }
        Insert: {
          created_at?: string
          entries?: number
          guest_id: string
          host_id: string
          slot1_count?: number
        }
        Update: {
          created_at?: string
          entries?: number
          guest_id?: string
          host_id?: string
          slot1_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      host_balances: {
        Row: {
          balance_usd: number
          host_id: string
        }
        Insert: {
          balance_usd?: number
          host_id: string
        }
        Update: {
          balance_usd?: number
          host_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_balances_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      hosts: {
        Row: {
          auto_spy_guests: boolean
          created_at: string
          destination_url: string | null
          entries: number
          extra_slots: number
          id: string
          image_url: string
          is_extra: boolean
          is_home: boolean
          name: string
          owner_id: string | null
          rent_enabled: boolean
          slug: string
          sparkles: number
          spies_count: number
          stars: number
          tags: string[]
          updated_at: string
          views: number
        }
        Insert: {
          auto_spy_guests?: boolean
          created_at?: string
          destination_url?: string | null
          entries?: number
          extra_slots?: number
          id?: string
          image_url?: string
          is_extra?: boolean
          is_home?: boolean
          name: string
          owner_id?: string | null
          rent_enabled?: boolean
          slug: string
          sparkles?: number
          spies_count?: number
          stars?: number
          tags?: string[]
          updated_at?: string
          views?: number
        }
        Update: {
          auto_spy_guests?: boolean
          created_at?: string
          destination_url?: string | null
          entries?: number
          extra_slots?: number
          id?: string
          image_url?: string
          is_extra?: boolean
          is_home?: boolean
          name?: string
          owner_id?: string | null
          rent_enabled?: boolean
          slug?: string
          sparkles?: number
          spies_count?: number
          stars?: number
          tags?: string[]
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          from_host: string
          id: string
          to_host: string
        }
        Insert: {
          created_at?: string
          from_host: string
          id?: string
          to_host: string
        }
        Update: {
          created_at?: string
          from_host?: string
          id?: string
          to_host?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_from_host_fkey"
            columns: ["from_host"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_to_host_fkey"
            columns: ["to_host"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          from_host_id: string | null
          from_messenger_id: string | null
          id: string
          read_at: string | null
          to_host_id: string | null
          to_messenger_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          from_host_id?: string | null
          from_messenger_id?: string | null
          id?: string
          read_at?: string | null
          to_host_id?: string | null
          to_messenger_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          from_host_id?: string | null
          from_messenger_id?: string | null
          id?: string
          read_at?: string | null
          to_host_id?: string | null
          to_messenger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_from_host_id_fkey"
            columns: ["from_host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_messenger_id_fkey"
            columns: ["from_messenger_id"]
            isOneToOne: false
            referencedRelation: "guest_messengers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_host_id_fkey"
            columns: ["to_host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_messenger_id_fkey"
            columns: ["to_messenger_id"]
            isOneToOne: false
            referencedRelation: "guest_messengers"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount_usd: number
          breakdown: Json
          created_at: string
          decided_at: string | null
          id: string
          paypal_email: string
          status: string
          user_id: string
          visitor_count: number
        }
        Insert: {
          amount_usd: number
          breakdown?: Json
          created_at?: string
          decided_at?: string | null
          id?: string
          paypal_email: string
          status?: string
          user_id: string
          visitor_count?: number
        }
        Update: {
          amount_usd?: number
          breakdown?: Json
          created_at?: string
          decided_at?: string | null
          id?: string
          paypal_email?: string
          status?: string
          user_id?: string
          visitor_count?: number
        }
        Relationships: []
      }
      pending_signups: {
        Row: {
          created_at: string
          destination_url: string | null
          email: string
          image_url: string
          name: string
        }
        Insert: {
          created_at?: string
          destination_url?: string | null
          email: string
          image_url: string
          name: string
        }
        Update: {
          created_at?: string
          destination_url?: string | null
          email?: string
          image_url?: string
          name?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          body: string
          created_at: string
          host_id: string
        }
        Insert: {
          body: string
          created_at?: string
          host_id: string
        }
        Update: {
          body?: string
          created_at?: string
          host_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_usd: number
          created_at: string
          host_id: string | null
          id: string
          kind: string
          mode: string
          status: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          host_id?: string | null
          id?: string
          kind: string
          mode?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          host_id?: string | null
          id?: string
          kind?: string
          mode?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      spies: {
        Row: {
          created_at: string
          email: string
          host_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          host_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          host_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spies_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      static_pages: {
        Row: {
          active: boolean
          banner1_link: string
          banner1_url: string
          banner2_link: string
          banner2_url: string
          body: string
          host_id: string | null
          key: string
          slug: string
          sort: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          banner1_link?: string
          banner1_url?: string
          banner2_link?: string
          banner2_url?: string
          body?: string
          host_id?: string | null
          key: string
          slug: string
          sort?: number
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          banner1_link?: string
          banner1_url?: string
          banner2_link?: string
          banner2_url?: string
          body?: string
          host_id?: string | null
          key?: string
          slug?: string
          sort?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "static_pages_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkouts: {
        Row: {
          amount_usd: number
          created_at: string
          fulfilled_at: string | null
          host_id: string | null
          kind: string
          mode: string
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          fulfilled_at?: string | null
          host_id?: string | null
          kind: string
          mode?: string
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          fulfilled_at?: string | null
          host_id?: string | null
          kind?: string
          mode?: string
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      track_events: {
        Row: {
          created_at: string
          extra: string
          hour_bucket: string
          id: number
          ip: string | null
          kind: string
          session_key: string
          target: string
        }
        Insert: {
          created_at?: string
          extra?: string
          hour_bucket: string
          id?: number
          ip?: string | null
          kind: string
          session_key: string
          target: string
        }
        Update: {
          created_at?: string
          extra?: string
          hour_bucket?: string
          id?: number
          ip?: string | null
          kind?: string
          session_key?: string
          target?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_id: string }; Returns: string }
      admin_stats: { Args: never; Returns: Json }
      buy_extra_page: { Args: never; Returns: string }
      buy_extra_slot: { Args: { p_host: string }; Returns: string }
      buy_impressions: {
        Args: { p_host: string; p_kind: string }
        Returns: string
      }
      claim_gift: { Args: { p_host: string }; Returns: string }
      claim_signup: { Args: never; Returns: string }
      create_host: {
        Args: { p_destination: string; p_image_url: string; p_name: string }
        Returns: string
      }
      decide_payout: {
        Args: { p_action: string; p_id: string }
        Returns: string
      }
      decline_invite: { Args: { p_id: string }; Returns: string }
      delete_host: { Args: { p_host: string }; Returns: string }
      discover_hosts: {
        Args: {
          p_limit: number
          p_min_entries: number
          p_min_stars: number
          p_min_views: number
          p_offset: number
          p_seed: string
        }
        Returns: {
          auto_spy_guests: boolean
          created_at: string
          destination_url: string | null
          entries: number
          extra_slots: number
          id: string
          image_url: string
          is_extra: boolean
          is_home: boolean
          name: string
          owner_id: string | null
          rent_enabled: boolean
          slug: string
          sparkles: number
          spies_count: number
          stars: number
          tags: string[]
          updated_at: string
          views: number
        }[]
        SetofOptions: {
          from: "*"
          to: "hosts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      email_status: { Args: { p_email: string }; Returns: string }
      ensure_host_page: { Args: { p_host: string }; Returns: string }
      esc_html: { Args: { p: string }; Returns: string }
      fulfill_checkout: {
        Args: { p_mode: string; p_session: string }
        Returns: string
      }
      get_global_stats: { Args: never; Returns: Json }
      gift_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      host_guests: {
        Args: { p_host: string }
        Returns: {
          entries: number
          id: string
          image_url: string
          name: string
          slot1_count: number
          slug: string
          tags: string[]
          views: number
        }[]
      }
      host_invitations: {
        Args: { p_host: string }
        Returns: {
          direction: string
          id: string
          image_url: string
          name: string
          other_id: string
          slug: string
          views: number
        }[]
      }
      host_slot_stats: { Args: { p_host: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      make_slug: { Args: { p_name: string }; Returns: string }
      normalize_tags: { Args: { p_tags: string[] }; Returns: string[] }
      owns_host: { Args: { _host: string }; Returns: boolean }
      page_quota: { Args: never; Returns: Json }
      pick_sponsors: {
        Args: {
          p_exclude: string[]
          p_kind: string
          p_limit: number
          p_tags: string[]
        }
        Returns: {
          campaign_id: string
          host_id: string
          image_url: string
          name: string
          slug: string
          tags: string[]
          views: number
        }[]
      }
      record_purchase: {
        Args: { p_amount: number; p_host: string; p_kind: string }
        Returns: undefined
      }
      relation_status: {
        Args: { p_from: string; p_to: string }
        Returns: string
      }
      remove_guest: {
        Args: { p_guest: string; p_host: string }
        Returns: string
      }
      request_ip: { Args: never; Returns: string }
      request_payout: { Args: { p_email: string }; Returns: string }
      search_hosts: {
        Args: {
          p_limit: number
          p_min_entries: number
          p_min_stars: number
          p_min_views: number
          p_offset: number
          p_q: string
          p_terms: string[]
        }
        Returns: {
          auto_spy_guests: boolean
          created_at: string
          destination_url: string | null
          entries: number
          extra_slots: number
          id: string
          image_url: string
          is_extra: boolean
          is_home: boolean
          name: string
          owner_id: string | null
          rent_enabled: boolean
          slug: string
          sparkles: number
          spies_count: number
          stars: number
          tags: string[]
          updated_at: string
          views: number
        }[]
        SetofOptions: {
          from: "*"
          to: "hosts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_invite: { Args: { p_from: string; p_to: string }; Returns: string }
      send_message: {
        Args: {
          p_body: string
          p_from: string
          p_to_host: string
          p_to_messenger: string
        }
        Returns: string
      }
      send_message_anon: {
        Args: { p_body: string; p_email: string; p_to_host: string }
        Returns: string
      }
      spy_on: { Args: { p_email: string; p_host: string }; Returns: string }
      start_signup: {
        Args: {
          p_destination: string
          p_email: string
          p_image_url: string
          p_name: string
        }
        Returns: string
      }
      stop_spy: { Args: { p_email: string; p_host: string }; Returns: string }
      tag_suggestions: {
        Args: { p_prefix: string }
        Returns: {
          n: number
          tag: string
        }[]
      }
      track_impression: {
        Args: {
          p_campaign: string
          p_context: string
          p_host: string
          p_session: string
        }
        Returns: undefined
      }
      track_once: {
        Args: {
          p_extra: string
          p_ip: string
          p_kind: string
          p_session: string
          p_target: string
        }
        Returns: boolean
      }
      track_shared_impression: {
        Args: { p_host: string; p_session: string }
        Returns: undefined
      }
      track_view: {
        Args: {
          p_host: string
          p_ref?: string
          p_session: string
          p_src?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
