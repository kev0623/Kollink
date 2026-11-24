
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_kind": string,"collaboration_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["collab_status"] | null,"id": number,"note": string | null,"to_status": Database["public"]['Enums']["collab_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_kind": string,"collaboration_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["collab_status"] | null,"id"?: never,"note"?: string | null,"to_status"?: Database["public"]['Enums']["collab_status"] | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_kind"?: string,"collaboration_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["collab_status"] | null,"id"?: never,"note"?: string | null,"to_status"?: Database["public"]['Enums']["collab_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_collaboration_id_fkey"
      columns: ["collaboration_id"]
isOneToOne: false
      referencedRelation: "collaborations"
      referencedColumns: ["id"]
    }
                  ]
                },"brand_profiles": {
                  Row: {
                    "brand_name": string,"created_at": string,"industry": string | null,"logo_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_name": string,"created_at"?: string,"industry"?: string | null,"logo_path"?: string | null,"user_id": string
                  }
                  Update: {
                    "brand_name"?: string,"created_at"?: string,"industry"?: string | null,"logo_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brief_applications": {
                  Row: {
                    "brief_id": string,"created_at": string,"creator_id": string,"id": string,"message": string | null,"proposed_price_twd": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_id": string,"created_at"?: string,"creator_id": string,"id"?: string,"message"?: string | null,"proposed_price_twd"?: number | null,"status"?: string
                  }
                  Update: {
                    "brief_id"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"message"?: string | null,"proposed_price_twd"?: number | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brief_applications_brief_id_fkey"
      columns: ["brief_id"]
isOneToOne: false
      referencedRelation: "briefs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brief_applications_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"briefs": {
                  Row: {
                    "brand_id": string,"budget_max_twd": number | null,"budget_min_twd": number | null,"categories": (string)[],"collab_types": (string)[],"cover_url": string | null,"created_at": string,"deadline": string,"description": string,"id": string,"includes_product": boolean,"min_followers": number,"region": string | null,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"budget_max_twd"?: number | null,"budget_min_twd"?: number | null,"categories"?: (string)[],"collab_types"?: (string)[],"cover_url"?: string | null,"created_at"?: string,"deadline": string,"description": string,"id"?: string,"includes_product"?: boolean,"min_followers"?: number,"region"?: string | null,"status"?: string,"title": string
                  }
                  Update: {
                    "brand_id"?: string,"budget_max_twd"?: number | null,"budget_min_twd"?: number | null,"categories"?: (string)[],"collab_types"?: (string)[],"cover_url"?: string | null,"created_at"?: string,"deadline"?: string,"description"?: string,"id"?: string,"includes_product"?: boolean,"min_followers"?: number,"region"?: string | null,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "briefs_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brand_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"collaborations": {
                  Row: {
                    "amount_twd": number,"brand_id": string,"brief_id": string | null,"conversation_id": string,"created_at": string,"creator_id": string,"deliverables": string,"id": string,"published_url": string | null,"review_due_at": string | null,"status": Database["public"]['Enums']["collab_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_twd": number,"brand_id": string,"brief_id"?: string | null,"conversation_id": string,"created_at"?: string,"creator_id": string,"deliverables": string,"id"?: string,"published_url"?: string | null,"review_due_at"?: string | null,"status"?: Database["public"]['Enums']["collab_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_twd"?: number,"brand_id"?: string,"brief_id"?: string | null,"conversation_id"?: string,"created_at"?: string,"creator_id"?: string,"deliverables"?: string,"id"?: string,"published_url"?: string | null,"review_due_at"?: string | null,"status"?: Database["public"]['Enums']["collab_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaborations_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brand_profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "collaborations_brief_id_fkey"
      columns: ["brief_id"]
isOneToOne: false
      referencedRelation: "briefs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborations_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "brand_id": string,"created_at": string,"creator_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"creator_id": string,"id"?: string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brand_profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "conversations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"creator_favorites": {
                  Row: {
                    "brand_id": string,"created_at": string,"creator_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"creator_id": string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"creator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_favorites_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brand_profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "creator_favorites_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"creator_portfolio_items": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"image_path": string,"link_url": string | null,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"image_path": string,"link_url"?: string | null,"position": number
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"image_path"?: string,"link_url"?: string | null,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_portfolio_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"creator_profiles": {
                  Row: {
                    "audience_age": string | null,"avatar_path": string | null,"bio": string | null,"categories": (string)[],"collab_types": (string)[],"created_at": string,"engagement_rate": number | null,"follower_count": number,"handle": string,"handle_locked_at": string | null,"ig_username": string,"region": string | null,"status": string,"style_tags": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_age"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle": string,"handle_locked_at"?: string | null,"ig_username": string,"region"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id": string
                  }
                  Update: {
                    "audience_age"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle"?: string,"handle_locked_at"?: string | null,"ig_username"?: string,"region"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_rates": {
                  Row: {
                    "collab_type": string,"creator_id": string,"id": string,"price_twd": number
                  }
                  ComputedFields: never
                  Insert: {
                    "collab_type": string,"creator_id": string,"id"?: string,"price_twd": number
                  }
                  Update: {
                    "collab_type"?: string,"creator_id"?: string,"id"?: string,"price_twd"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_rates_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"creator_verifications": {
                  Row: {
                    "code": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_verifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "creator_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"flagged_contact": boolean,"id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"flagged_contact"?: boolean,"id"?: string,"sender_id"?: string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"flagged_contact"?: boolean,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_twd": number,"collaboration_id": string,"created_at": string,"id": string,"merchant_trade_no": string,"paid_at": string | null,"provider": string,"provider_trade_no": string | null,"raw_notify": Json | null,"refund_required": boolean,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_twd": number,"collaboration_id": string,"created_at"?: string,"id"?: string,"merchant_trade_no": string,"paid_at"?: string | null,"provider": string,"provider_trade_no"?: string | null,"raw_notify"?: Json | null,"refund_required"?: boolean,"status"?: string
                  }
                  Update: {
                    "amount_twd"?: number,"collaboration_id"?: string,"created_at"?: string,"id"?: string,"merchant_trade_no"?: string,"paid_at"?: string | null,"provider"?: string,"provider_trade_no"?: string | null,"raw_notify"?: Json | null,"refund_required"?: boolean,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_collaboration_id_fkey"
      columns: ["collaboration_id"]
isOneToOne: false
      referencedRelation: "collaborations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "check_categories":
{ Args: { "p": (string)[] }; Returns: (string)[]
                           },
"check_instagram_url":
{ Args: { "p": string }; Returns: string
                           },
"check_logo_path":
{ Args: { "p_path": string,"p_uid": string }; Returns: string
                           },
"check_media_path":
{ Args: { "p_field": string,"p_kind": string,"p_path": string,"p_uid": string }; Returns: string
                           },
"check_text_list":
{ Args: { "p": (string)[],"p_field": string,"p_max_count": number,"p_max_len": number }; Returns: (string)[]
                           },
"clean_text":
{ Args: { "p": string }; Returns: string
                           },
"create_brand_account":
{ Args: { "p_brand_name": string,"p_industry": string,"p_logo_path"?: string }; Returns: undefined
                           },
"create_creator_account":
{ Args: { "p_categories": (string)[],"p_display_name": string,"p_follower_count": number,"p_handle": string,"p_ig_username": string,"p_region": string }; Returns: string
                           },
"gen_verification_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_public_creator":
{ Args: { "p_handle": string }; Returns: {
              "audience_age": string,"avatar_path": string,"bio": string,"categories": (string)[],"collab_types": (string)[],"display_name": string,"engagement_rate": number,"follower_count": number,"handle": string,"is_self": boolean,"region": string,"status": string,"style_tags": (string)[],"user_id": string
            }[]
                           },
"has_bidi":
{ Args: { "p": string }; Returns: boolean
                           },
"hook_reject_password":
{ Args: { "event": Json }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"popular_style_tags":
{ Args: Record<PropertyKey, never>; Returns: {
              "tag": string,"uses": number
            }[]
                           },
"record_payment_success":
{ Args: { "p_amount_twd": number,"p_merchant_trade_no": string,"p_provider_trade_no": string,"p_raw": Json }; Returns: string
                           },
"search_creators":
{ Args: { "p_categories"?: (string)[],"p_collab_types"?: (string)[],"p_engagement_min"?: number,"p_favorites_only"?: boolean,"p_follower_max"?: number,"p_follower_min"?: number,"p_keyword"?: string,"p_limit"?: number,"p_offset"?: number,"p_price_max"?: number,"p_price_min"?: number,"p_regions"?: (string)[],"p_sort"?: string,"p_style_tags"?: (string)[] }; Returns: {
              "avatar_path": string,"categories": (string)[],"collab_types": (string)[],"created_at": string,"display_name": string,"engagement_rate": number,"follower_count": number,"handle": string,"is_favorite": boolean,"min_price": number,"portfolio_paths": (string)[],"post_price": number,"region": string,"style_tags": (string)[],"total_count": number,"user_id": string
            }[]
                           },
"set_creator_portfolio":
{ Args: { "p_items": Json }; Returns: undefined
                           },
"set_creator_rates":
{ Args: { "p_rates": Json }; Returns: undefined
                           },
"transition_collaboration":
{ Args: { "p_action": string,"p_collab_id": string,"p_note"?: string,"p_published_url"?: string }; Returns: Database["public"]['Enums']["collab_status"]
                           },
"update_brand_account":
{ Args: { "p_brand_name": string,"p_industry": string,"p_logo_path": string }; Returns: undefined
                           },
"update_creator_account":
{ Args: { "p_categories": (string)[],"p_display_name": string,"p_follower_count": number,"p_handle": string,"p_ig_username": string,"p_region": string }; Returns: string
                           },
"update_creator_public_profile":
{ Args: { "p_audience_age": string,"p_avatar_path": string,"p_bio": string,"p_collab_types": (string)[],"p_engagement_rate": number,"p_style_tags": (string)[] }; Returns: undefined
                           }
          }
          Enums: {
            "collab_status": "invited"|"awaiting_payment"|"awaiting_submission"|"in_review"|"awaiting_publish"|"awaiting_payout"|"completed"|"declined"|"cancelled","user_role": "brand"|"creator"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "collab_status": ["invited", "awaiting_payment", "awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout", "completed", "declined", "cancelled"],"user_role": ["brand", "creator"]
          }
        }
} as const
