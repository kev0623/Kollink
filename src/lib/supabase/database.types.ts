
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
                    "action": string,"actor_id": string | null,"actor_kind": string,"collaboration_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["collab_status"] | null,"id": number,"note": string | null,"subject_id": string | null,"to_status": Database["public"]['Enums']["collab_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_kind": string,"collaboration_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["collab_status"] | null,"id"?: never,"note"?: string | null,"subject_id"?: string | null,"to_status"?: Database["public"]['Enums']["collab_status"] | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_kind"?: string,"collaboration_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["collab_status"] | null,"id"?: never,"note"?: string | null,"subject_id"?: string | null,"to_status"?: Database["public"]['Enums']["collab_status"] | null
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
                    "brand_id": string,"budget_max_twd": number | null,"budget_min_twd": number | null,"categories": (string)[],"collab_types": (string)[],"cover_path": string | null,"created_at": string,"deadline": string | null,"description": string | null,"id": string,"includes_product": boolean,"min_followers": number,"published_at": string | null,"region": string | null,"status": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"budget_max_twd"?: number | null,"budget_min_twd"?: number | null,"categories"?: (string)[],"collab_types"?: (string)[],"cover_path"?: string | null,"created_at"?: string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"includes_product"?: boolean,"min_followers"?: number,"published_at"?: string | null,"region"?: string | null,"status"?: string,"title"?: string | null
                  }
                  Update: {
                    "brand_id"?: string,"budget_max_twd"?: number | null,"budget_min_twd"?: number | null,"categories"?: (string)[],"collab_types"?: (string)[],"cover_path"?: string | null,"created_at"?: string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"includes_product"?: boolean,"min_followers"?: number,"published_at"?: string | null,"region"?: string | null,"status"?: string,"title"?: string | null
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
                },"collaboration_payouts": {
                  Row: {
                    "account_last4": string,"account_name": string,"actor_kind": string,"amount_twd": number,"bank_code": string,"branch_code": string | null,"collaboration_id": string,"created_at": string,"paid_out_by": string | null,"transfer_note": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_last4": string,"account_name": string,"actor_kind": string,"amount_twd": number,"bank_code": string,"branch_code"?: string | null,"collaboration_id": string,"created_at"?: string,"paid_out_by"?: string | null,"transfer_note": string
                  }
                  Update: {
                    "account_last4"?: string,"account_name"?: string,"actor_kind"?: string,"amount_twd"?: number,"bank_code"?: string,"branch_code"?: string | null,"collaboration_id"?: string,"created_at"?: string,"paid_out_by"?: string | null,"transfer_note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaboration_payouts_collaboration_id_fkey"
      columns: ["collaboration_id"]
isOneToOne: true
      referencedRelation: "collaborations"
      referencedColumns: ["id"]
    }
                  ]
                },"collaboration_submissions": {
                  Row: {
                    "collaboration_id": string,"created_at": string,"file_paths": (string)[],"id": string,"links": (string)[],"note": string | null,"round": number
                  }
                  ComputedFields: never
                  Insert: {
                    "collaboration_id": string,"created_at"?: string,"file_paths"?: (string)[],"id"?: string,"links"?: (string)[],"note"?: string | null,"round": number
                  }
                  Update: {
                    "collaboration_id"?: string,"created_at"?: string,"file_paths"?: (string)[],"id"?: string,"links"?: (string)[],"note"?: string | null,"round"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaboration_submissions_collaboration_id_fkey"
      columns: ["collaboration_id"]
isOneToOne: false
      referencedRelation: "collaborations"
      referencedColumns: ["id"]
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
                },"conversation_reads": {
                  Row: {
                    "conversation_id": string,"last_read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"last_read_at": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"last_read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_reads_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
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
                },"creator_payout_accounts": {
                  Row: {
                    "account_last4": string | null,"account_name": string,"account_number": string,"bank_code": string,"branch_code": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_last4"?: never,"account_name": string,"account_number": string,"bank_code": string,"branch_code"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_last4"?: never,"account_name"?: string,"account_number"?: string,"bank_code"?: string,"branch_code"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_payout_accounts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
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
                    "audience_age": string | null,"avatar_path": string | null,"bio": string | null,"categories": (string)[],"collab_types": (string)[],"created_at": string,"engagement_rate": number | null,"follower_count": number,"handle": string,"handle_locked_at": string | null,"ig_username": string,"region": string | null,"review_note": string | null,"status": string,"style_tags": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_age"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle": string,"handle_locked_at"?: string | null,"ig_username": string,"region"?: string | null,"review_note"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id": string
                  }
                  Update: {
                    "audience_age"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"categories"?: (string)[],"collab_types"?: (string)[],"created_at"?: string,"engagement_rate"?: number | null,"follower_count"?: number,"handle"?: string,"handle_locked_at"?: string | null,"ig_username"?: string,"region"?: string | null,"review_note"?: string | null,"status"?: string,"style_tags"?: (string)[],"user_id"?: string
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
                },"message_reviews": {
                  Row: {
                    "message_id": string,"reviewed_at": string,"reviewed_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "message_id": string,"reviewed_at"?: string,"reviewed_by"?: string | null
                  }
                  Update: {
                    "message_id"?: string,"reviewed_at"?: string,"reviewed_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reviews_message_id_fkey"
      columns: ["message_id"]
isOneToOne: true
      referencedRelation: "messages"
      referencedColumns: ["id"]
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
                },"payment_anomalies": {
                  Row: {
                    "collaboration_id": string | null,"created_at": string,"expected_amount_twd": number | null,"id": number,"kind": string,"merchant_trade_no": string,"payment_id": string | null,"provider_trade_no": string,"raw": NonNullable<Json>,"received_amount_twd": number | null,"resolved_at": string | null,"resolved_note": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collaboration_id"?: string | null,"created_at"?: string,"expected_amount_twd"?: number | null,"id"?: never,"kind": string,"merchant_trade_no": string,"payment_id"?: string | null,"provider_trade_no"?: string,"raw"?: NonNullable<Json>,"received_amount_twd"?: number | null,"resolved_at"?: string | null,"resolved_note"?: string | null,"source": string
                  }
                  Update: {
                    "collaboration_id"?: string | null,"created_at"?: string,"expected_amount_twd"?: number | null,"id"?: never,"kind"?: string,"merchant_trade_no"?: string,"payment_id"?: string | null,"provider_trade_no"?: string,"raw"?: NonNullable<Json>,"received_amount_twd"?: number | null,"resolved_at"?: string | null,"resolved_note"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_anomalies_collaboration_id_fkey"
      columns: ["collaboration_id"]
isOneToOne: false
      referencedRelation: "collaborations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_anomalies_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "admin_note": string | null,"amount_twd": number,"atm_bank_code": string | null,"atm_expire_date": string | null,"atm_v_account": string | null,"collaboration_id": string,"created_at": string,"created_by": string | null,"id": string,"merchant_trade_no": string,"paid_at": string | null,"payment_info_at": string | null,"payment_method": string | null,"provider": string,"provider_env": string | null,"provider_trade_no": string | null,"raw_notify": Json | null,"refund_note": string | null,"refund_required": boolean,"refunded_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"amount_twd": number,"atm_bank_code"?: string | null,"atm_expire_date"?: string | null,"atm_v_account"?: string | null,"collaboration_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"merchant_trade_no": string,"paid_at"?: string | null,"payment_info_at"?: string | null,"payment_method"?: string | null,"provider": string,"provider_env"?: string | null,"provider_trade_no"?: string | null,"raw_notify"?: Json | null,"refund_note"?: string | null,"refund_required"?: boolean,"refunded_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "admin_note"?: string | null,"amount_twd"?: number,"atm_bank_code"?: string | null,"atm_expire_date"?: string | null,"atm_v_account"?: string | null,"collaboration_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"merchant_trade_no"?: string,"paid_at"?: string | null,"payment_info_at"?: string | null,"payment_method"?: string | null,"provider"?: string,"provider_env"?: string | null,"provider_trade_no"?: string | null,"raw_notify"?: Json | null,"refund_note"?: string | null,"refund_required"?: boolean,"refunded_at"?: string | null,"status"?: string
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
            "accept_application_with_collab":
{ Args: { "p_amount_twd": number,"p_application_id": string,"p_deliverables": string }; Returns: string
                           },
"admin_actor":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"admin_cancel_collaboration":
{ Args: { "p_collab_id": string,"p_reason": string }; Returns: number
                           },
"admin_clean_note":
{ Args: { "p": string,"p_field": string }; Returns: string
                           },
"admin_get_payout_account":
{ Args: { "p_collab_id": string }; Returns: {
              "account_name": string,"account_number": string,"bank_code": string,"branch_code": string,"updated_at": string
            }[]
                           },
"admin_list_collaborations":
{ Args: { "p_limit": number,"p_offset": number,"p_query": string,"p_status": string }; Returns: {
              "amount_twd": number,"brand_name": string,"created_at": string,"creator_handle": string,"creator_name": string,"id": string,"paid": boolean,"refund_pending": boolean,"status": string,"test_paid": boolean,"title": string,"total_count": number,"updated_at": string
            }[]
                           },
"admin_list_creators":
{ Args: { "p_limit": number,"p_offset": number,"p_query": string,"p_status": string }; Returns: {
              "categories": (string)[],"created_at": string,"display_name": string,"follower_count": number,"handle": string,"ig_username": string,"region": string,"review_note": string,"status": string,"total_count": number,"user_id": string,"verification_code": string
            }[]
                           },
"admin_list_flagged_messages":
{ Args: { "p_limit": number,"p_offset": number,"p_view": string }; Returns: {
              "body": string,"brand_id": string,"brand_name": string,"conversation_id": string,"created_at": string,"creator_handle": string,"creator_id": string,"creator_name": string,"id": string,"reviewed_at": string,"sender_side": string,"total_count": number
            }[]
                           },
"admin_list_payments":
{ Args: { "p_collab_id"?: string,"p_limit": number,"p_offset": number,"p_view": string }; Returns: {
              "admin_note": string,"amount_twd": number,"brand_name": string,"collab_status": string,"collab_title": string,"collaboration_id": string,"created_at": string,"creator_handle": string,"id": string,"merchant_trade_no": string,"paid_at": string,"payment_method": string,"provider_env": string,"provider_trade_no": string,"refund_note": string,"refund_required": boolean,"refunded_at": string,"status": string,"total_count": number
            }[]
                           },
"admin_list_payouts":
{ Args: { "p_limit": number,"p_offset": number }; Returns: {
              "account_last4": string,"account_updated_at": string,"amount_twd": number,"bank_code": string,"brand_name": string,"creator_handle": string,"creator_id": string,"creator_name": string,"id": string,"refund_pending": boolean,"test_paid": boolean,"title": string,"total_count": number,"updated_at": string
            }[]
                           },
"admin_lock_collab":
{ Args: { "p_actor": string,"p_collab_id": string }; Returns: {
              "amount_twd": number,
"brand_id": string,
"brief_id": string | null,
"conversation_id": string,
"created_at": string,
"creator_id": string,
"deliverables": string,
"id": string,
"published_url": string | null,
"review_due_at": string | null,
"status": Database["public"]['Enums']["collab_status"],
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "collaborations"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_mark_payout":
{ Args: { "p_collab_id": string,"p_expected_last4": string,"p_note": string }; Returns: undefined
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "awaiting_payment": number,"awaiting_payout": number,"open_anomalies": number,"open_flagged_messages": number,"pending_creators": number,"refund_required": number
            }[]
                           },
"admin_record_lost_payment":
{ Args: { "p_amount_twd": number,"p_env": string,"p_merchant_trade_no": string,"p_note": string,"p_provider_trade_no": string }; Returns: string
                           },
"admin_record_offline_payment":
{ Args: { "p_collab_id": string,"p_note": string }; Returns: string
                           },
"apply_to_brief":
{ Args: { "p_brief_id": string,"p_message"?: string,"p_proposed_price"?: number }; Returns: string
                           },
"auto_approve_due":
{ Args: Record<PropertyKey, never>; Returns: {
              "approved": number,"failed": (string)[]
            }[]
                           },
"brief_application_counts":
{ Args: { "p_ids": (string)[] }; Returns: {
              "applicant_count": number,"brief_id": string,"pending_count": number
            }[]
                           },
"can_delete_deliverable":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_read_deliverable":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_upload_deliverable":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_view_brief":
{ Args: { "p_brand_id": string,"p_deadline": string,"p_id": string,"p_status": string }; Returns: boolean
                           },
"check_categories":
{ Args: { "p": (string)[] }; Returns: (string)[]
                           },
"check_collab_offer":
{ Args: { "p_amount_twd": number,"p_deliverables": string,"p_title": string }; Returns: {
              "deliverables": string,"title": string
            }[]
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
"close_brief":
{ Args: { "p_id": string }; Returns: undefined
                           },
"collab_turn":
{ Args: { "p_status": Database["public"]['Enums']["collab_status"] }; Returns: string
                           },
"create_brand_account":
{ Args: { "p_brand_name": string,"p_industry": string,"p_logo_path"?: string }; Returns: undefined
                           },
"create_creator_account":
{ Args: { "p_categories": (string)[],"p_display_name": string,"p_follower_count": number,"p_handle": string,"p_ig_username": string,"p_region": string }; Returns: string
                           },
"create_payment_order":
{ Args: { "p_collab_id": string,"p_method": string }; Returns: {
              "amount_twd": number,"created_at": string,"merchant_trade_no": string
            }[]
                           },
"decide_application":
{ Args: { "p_accept": boolean,"p_id": string }; Returns: undefined
                           },
"delete_brief":
{ Args: { "p_id": string }; Returns: string
                           },
"deliverable_path_ok":
{ Args: { "p_collab_id": string,"p_creator_id": string,"p_name": string }; Returns: boolean
                           },
"ensure_conversation":
{ Args: { "p_brand_id": string,"p_creator_id": string }; Returns: string
                           },
"gen_verification_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_collaboration":
{ Args: { "p_id": string }; Returns: {
              "amount_twd": number,"brand_id": string,"brand_logo_path": string,"brand_name": string,"brief_id": string,"brief_title": string,"conversation_id": string,"created_at": string,"creator_avatar_path": string,"creator_handle": string,"creator_id": string,"creator_name": string,"deliverables": string,"id": string,"my_side": string,"published_url": string,"review_due_at": string,"status": string,"title": string,"updated_at": string
            }[]
                           },
"get_conversation":
{ Args: { "p_id": string }; Returns: {
              "brand_id": string,"brand_logo_path": string,"brand_name": string,"closed": boolean,"creator_avatar_path": string,"creator_handle": string,"creator_id": string,"creator_name": string,"id": string,"my_side": string
            }[]
                           },
"get_opportunity":
{ Args: { "p_id": string }; Returns: {
              "applicant_count": number,"brand_id": string,"brand_logo_path": string,"brand_name": string,"budget_max_twd": number,"budget_min_twd": number,"categories": (string)[],"category_ok": boolean,"collab_ok": boolean,"collab_types": (string)[],"cover_path": string,"deadline": string,"description": string,"followers_ok": boolean,"id": string,"includes_product": boolean,"is_match": boolean,"min_followers": number,"my_application_id": string,"my_message": string,"my_proposed_price_twd": number,"my_status": string,"region": string,"region_ok": boolean,"status": string,"title": string
            }[]
                           },
"get_public_creator":
{ Args: { "p_handle": string }; Returns: {
              "audience_age": string,"avatar_path": string,"bio": string,"categories": (string)[],"collab_types": (string)[],"display_name": string,"engagement_rate": number,"follower_count": number,"handle": string,"is_self": boolean,"region": string,"status": string,"style_tags": (string)[],"user_id": string
            }[]
                           },
"has_bidi":
{ Args: { "p": string }; Returns: boolean
                           },
"has_contact_info":
{ Args: { "p": string }; Returns: boolean
                           },
"hook_reject_password":
{ Args: { "event": Json }; Returns: Json
                           },
"invite_creator":
{ Args: { "p_amount_twd": number,"p_creator_id": string,"p_deliverables": string,"p_title": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"list_brief_applicants":
{ Args: { "p_brief_id": string }; Returns: {
              "avatar_path": string,"collaboration_id": string,"created_at": string,"creator_id": string,"display_name": string,"engagement_rate": number,"follower_count": number,"handle": string,"id": string,"message": string,"proposed_price_twd": number,"region": string,"status": string
            }[]
                           },
"list_collaboration_events":
{ Args: { "p_id": string }; Returns: {
              "action": string,"actor_kind": string,"actor_name": string,"created_at": string,"from_status": string,"id": number,"note": string,"to_status": string
            }[]
                           },
"list_messages":
{ Args: { "p_before_at"?: string,"p_before_id"?: string,"p_conversation_id": string,"p_limit"?: number }; Returns: {
              "body": string,"created_at": string,"flagged_contact": boolean,"id": string,"sender_id": string
            }[]
                           },
"list_my_collaborations":
{ Args: { "p_tab"?: string }; Returns: {
              "amount_twd": number,"brief_id": string,"counterpart_handle": string,"counterpart_image_path": string,"counterpart_name": string,"id": string,"my_side": string,"my_turn": boolean,"status": string,"title": string,"updated_at": string
            }[]
                           },
"list_my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "closed": boolean,"counterpart_handle": string,"counterpart_image_path": string,"counterpart_name": string,"id": string,"last_at": string,"last_body": string,"last_sender_is_me": boolean,"my_side": string,"unread_count": number
            }[]
                           },
"list_opportunities":
{ Args: { "p_category"?: string,"p_filter"?: string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "applicant_count": number,"brand_id": string,"brand_logo_path": string,"brand_name": string,"budget_max_twd": number,"budget_min_twd": number,"categories": (string)[],"category_ok": boolean,"collab_ok": boolean,"collab_types": (string)[],"cover_path": string,"deadline": string,"followers_ok": boolean,"has_applied": boolean,"id": string,"includes_product": boolean,"is_match": boolean,"min_followers": number,"my_status": string,"region": string,"region_ok": boolean,"title": string,"total_count": number
            }[]
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_message_reviewed":
{ Args: { "p_message_id": string }; Returns: boolean
                           },
"match_brief":
{ Args: { "p_brief": Omit<Database["public"]['Tables']["briefs"]['Row'], Database["public"]['Tables']["briefs"]['ComputedFields']>,"p_creator": Omit<Database["public"]['Tables']["creator_profiles"]['Row'], Database["public"]['Tables']["creator_profiles"]['ComputedFields']> }; Returns: Database["public"]['CompositeTypes']["brief_match"]
                          SetofOptions: {
        from: "*"
        to: "brief_match"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"payment_raw_whitelist":
{ Args: { "p": Json }; Returns: Json
                           },
"popular_style_tags":
{ Args: Record<PropertyKey, never>; Returns: {
              "tag": string,"uses": number
            }[]
                           },
"record_payment_anomaly":
{ Args: { "p_collab_id": string,"p_expected": number,"p_kind": string,"p_merchant_trade_no": string,"p_payment_id": string,"p_provider_trade_no": string,"p_raw": Json,"p_received": number,"p_source": string }; Returns: undefined
                           },
"record_payment_info":
{ Args: { "p_amount_twd": number,"p_bank_code": string,"p_expire_date": string,"p_merchant_trade_no": string,"p_provider_trade_no": string,"p_raw": Json,"p_v_account": string }; Returns: string
                           },
"record_payment_success":
{ Args: { "p_amount_twd": number,"p_env"?: string,"p_merchant_trade_no": string,"p_provider_trade_no": string,"p_raw": Json }; Returns: string
                           },
"request_creator_review":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"resolve_payment_anomaly":
{ Args: { "p_id": number,"p_note": string }; Returns: undefined
                           },
"resolve_payment_refund":
{ Args: { "p_note": string,"p_payment_id": string }; Returns: undefined
                           },
"save_brief":
{ Args: { "p_budget_max_twd"?: number,"p_budget_min_twd"?: number,"p_categories"?: (string)[],"p_collab_types"?: (string)[],"p_cover_path"?: string,"p_deadline"?: string,"p_description"?: string,"p_id"?: string,"p_includes_product"?: boolean,"p_min_followers"?: number,"p_publish"?: boolean,"p_region"?: string,"p_title"?: string }; Returns: string
                           },
"search_creators":
{ Args: { "p_categories"?: (string)[],"p_collab_types"?: (string)[],"p_engagement_min"?: number,"p_favorites_only"?: boolean,"p_follower_max"?: number,"p_follower_min"?: number,"p_keyword"?: string,"p_limit"?: number,"p_offset"?: number,"p_price_max"?: number,"p_price_min"?: number,"p_regions"?: (string)[],"p_sort"?: string,"p_style_tags"?: (string)[] }; Returns: {
              "avatar_path": string,"categories": (string)[],"collab_types": (string)[],"created_at": string,"display_name": string,"engagement_rate": number,"follower_count": number,"handle": string,"is_favorite": boolean,"min_price": number,"portfolio_paths": (string)[],"post_price": number,"region": string,"style_tags": (string)[],"total_count": number,"user_id": string
            }[]
                           },
"send_message":
{ Args: { "p_body": string,"p_conversation_id": string }; Returns: {
              "body": string,"conversation_id": string,"created_at": string,"flagged_contact": boolean,"id": string,"sender_id": string
            }[]
                           },
"set_creator_portfolio":
{ Args: { "p_items": Json }; Returns: undefined
                           },
"set_creator_rates":
{ Args: { "p_rates": Json }; Returns: undefined
                           },
"set_creator_status":
{ Args: { "p_action": string,"p_reason"?: string,"p_user_id": string }; Returns: string
                           },
"set_my_payout_account":
{ Args: { "p_account_name": string,"p_account_number": string,"p_bank_code": string,"p_branch_code": string }; Returns: undefined
                           },
"start_conversation":
{ Args: { "p_creator_id": string }; Returns: string
                           },
"submit_deliverables":
{ Args: { "p_collab_id": string,"p_file_paths"?: (string)[],"p_links"?: (string)[],"p_note"?: string }; Returns: number
                           },
"text_items_within":
{ Args: { "p": (string)[],"p_max_len": number }; Returns: boolean
                           },
"today_tw":
{ Args: { "p_now"?: string }; Returns: string
                           },
"transition_collaboration":
{ Args: { "p_action": string,"p_collab_id": string,"p_note"?: string,"p_published_url"?: string }; Returns: Database["public"]['Enums']["collab_status"]
                           },
"unread_conversation_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"update_brand_account":
{ Args: { "p_brand_name": string,"p_industry": string,"p_logo_path": string }; Returns: undefined
                           },
"update_creator_account":
{ Args: { "p_categories": (string)[],"p_display_name": string,"p_follower_count": number,"p_handle": string,"p_ig_username": string,"p_region": string }; Returns: string
                           },
"update_creator_public_profile":
{ Args: { "p_audience_age": string,"p_avatar_path": string,"p_bio": string,"p_collab_types": (string)[],"p_engagement_rate": number,"p_style_tags": (string)[] }; Returns: undefined
                           },
"withdraw_application":
{ Args: { "p_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "collab_status": "invited"|"awaiting_payment"|"awaiting_submission"|"in_review"|"awaiting_publish"|"awaiting_payout"|"completed"|"declined"|"cancelled","user_role": "brand"|"creator"
          }
          CompositeTypes: {
            "brief_match": {
                        "followers_ok": boolean | null,"region_ok": boolean | null,"category_ok": boolean | null,"collab_ok": boolean | null
                      }
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
