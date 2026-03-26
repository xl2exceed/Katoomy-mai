// file: lib/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_user_id: string
          slug: string
          name: string
          app_name: string
          logo_url: string | null
          primary_color: string
          welcome_message: string | null
          push_sender_name: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          slug: string
          name: string
          app_name: string
          logo_url?: string | null
          primary_color?: string
          welcome_message?: string | null
          push_sender_name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          slug?: string
          name?: string
          app_name?: string
          logo_url?: string | null
          primary_color?: string
          welcome_message?: string | null
          push_sender_name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          business_id: string
          name: string
          price_cents: number
          duration_minutes: number
          active: boolean
          created_at: string
          updated_at: string
        }
      }
      bookings: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          service_id: string
          start_ts: string
          end_ts: string
          status: string
          total_price_cents: number
          deposit_required: boolean
          deposit_amount_cents: number | null
          created_at: string
          updated_at: string
        }
      }
      customers: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          phone: string
          email: string | null
          full_name: string | null
          created_at: string
          updated_at: string
        }
      }
    }
  }
}