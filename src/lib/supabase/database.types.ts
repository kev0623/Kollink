
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
                    "brand_name": string,"created_at": string,"industry": string | null,"logo_url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_name": string,"created_at"?: string,"industry"?: string | null,"logo_url"?: string | null,"user_id": string
                  }
                  Update: {
                    "brand_name"?: string,"created_at"?: string,"industry"?: string | null,"logo_url"?: string | null,"user_id"?: string
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
                },"creator_profiles": {
                  Row: {
                    "bio": string | null,"categories": (string)[],"collab_types": (string)[],"created_at": string,"engagement_rate": number | null,"follower_count": number,"handle": string,"ig_username": string,"region": string | null,"status": string,"style_tags": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle": string,"ig_username": string,"region"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id": string
                  }
                  Update: {
                    "bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle"?: string,"ig_username"?: string,"region"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id"?: string
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
            "clean_text":
{ Args: { "p": string }; Returns: string
                           },
"create_brand_account":
{ Args: { "p_brand_name": string,"p_industry": string,"p_logo_url"?: string }; Returns: undefined
                           },
"create_creator_account":
{ Args: { "p_categories": (string)[],"p_display_name": string,"p_follower_count": number,"p_handle": string,"p_ig_username": string,"p_region": string }; Returns: string
                           },
"gen_verification_code":
{ Args: Record<PropertyKey, never>; Returns: string
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
"record_payment_success":
{ Args: { "p_amount_twd": number,"p_merchant_trade_no": string,"p_provider_trade_no": string,"p_raw": Json }; Returns: string
                           },
"transition_collaboration":
{ Args: { "p_action": string,"p_collab_id": string,"p_note"?: string,"p_published_url"?: string }; Returns: Database["public"]['Enums']["collab_status"]
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
