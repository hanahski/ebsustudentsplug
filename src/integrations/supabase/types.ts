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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_ai_state: {
        Row: {
          k: string
          updated_at: string
          v: Json
        }
        Insert: {
          k: string
          updated_at?: string
          v?: Json
        }
        Update: {
          k?: string
          updated_at?: string
          v?: Json
        }
        Relationships: []
      }
      banner_slides: {
        Row: {
          accent: string | null
          created_at: string
          cta_label: string | null
          expire_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          layout: string
          link_url: string | null
          publish_at: string | null
          sort_order: number
          subtitle: string | null
          title: string
          variant: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          cta_label?: string | null
          expire_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          link_url?: string | null
          publish_at?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          variant?: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          cta_label?: string | null
          expire_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          link_url?: string | null
          publish_at?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          variant?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          content: string
          cover_url: string | null
          created_at: string
          excerpt: string
          id: string
          published: boolean
          published_at: string
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          content: string
          cover_url?: string | null
          created_at?: string
          excerpt: string
          id?: string
          published?: boolean
          published_at?: string
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          grants_role: Database["public"]["Enums"]["app_role"] | null
          id: string
          is_active: boolean
          max_uses: number | null
          reward_credits: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          grants_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_credits?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          grants_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_credits?: number
          used_count?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          faculty_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          faculty_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          faculty_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      ebsu_news_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
          url: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          url: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          url?: string
          weight?: number
        }
        Relationships: []
      }
      faculties: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      library_courses: {
        Row: {
          author: string | null
          can_embed: boolean
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          download_url: string | null
          external_id: string | null
          id: string
          is_course: boolean
          level: string | null
          read_url: string
          source: string | null
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          can_embed?: boolean
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_id?: string | null
          id?: string
          is_course?: boolean
          level?: string | null
          read_url?: string
          source?: string | null
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          can_embed?: boolean
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_id?: string | null
          id?: string
          is_course?: boolean
          level?: string | null
          read_url?: string
          source?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tool_overrides: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          paths: Json
          rapidapi_host: string | null
          rapidapi_key: string | null
          tool_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          paths?: Json
          rapidapi_host?: string | null
          rapidapi_key?: string | null
          tool_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          paths?: Json
          rapidapi_host?: string | null
          rapidapi_key?: string | null
          tool_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_prices: {
        Row: {
          cost: number
          created_at: string
          id: string
          label: string | null
          tool_key: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          label?: string | null
          tool_key: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          label?: string | null
          tool_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_dm_group_member: {
        Args: { _member_id: string; _thread_id: string }
        Returns: undefined
      }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_delete_comment: {
        Args: { _comment_id: string }
        Returns: undefined
      }
      admin_delete_listing: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      admin_delete_post: { Args: { _post_id: string }; Returns: undefined }
      admin_grant_credits: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_set_badge: {
        Args: { _badge: string; _user_id: string; _value: boolean }
        Returns: undefined
      }
      admin_set_rank: {
        Args: { _step: number; _tier: string; _user_id: string }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: { _status: string; _user_id: string }
        Returns: undefined
      }
      claim_ad_reward: { Args: { _amount: number }; Returns: Json }
      claim_seed_admin_role: { Args: never; Returns: boolean }
      create_dm_group: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
      }
      redeem_coupon: { Args: { _code: string }; Returns: Json }
      redeem_referral: { Args: { _code: string }; Returns: undefined }
      remove_dm_group_member: {
        Args: { _member_id: string; _thread_id: string }
        Returns: undefined
      }
      rename_dm_group: {
        Args: { _name: string; _thread_id: string }
        Returns: undefined
      }
      spend_credits: {
        Args: { _amount: number; _reason: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      news_category: "ebsu" | "other"
      news_status: "draft" | "published"
      profile_status: "active" | "blocked" | "deactivated"
      rank_tier: "newbie" | "normal" | "active" | "legend" | "pro" | "sure_plug"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "moderator", "user"],
      news_category: ["ebsu", "other"],
      news_status: ["draft", "published"],
      profile_status: ["active", "blocked", "deactivated"],
      rank_tier: ["newbie", "normal", "active", "legend", "pro", "sure_plug"],
    },
  },
} as const
