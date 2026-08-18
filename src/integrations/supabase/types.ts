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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          description: string | null
          id: number
          is_active: boolean
          is_control_account: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_side"]
          parent_account_id: number | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          is_active?: boolean
          is_control_account?: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_side"]
          parent_account_id?: number | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          is_active?: boolean
          is_control_account?: boolean
          name?: string
          normal_balance?: Database["public"]["Enums"]["normal_side"]
          parent_account_id?: number | null
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in_method: Database["public"]["Enums"]["checkin_method"] | null
          check_in_time: string | null
          id: number
          meeting_id: number
          member_id: number
          notes: string | null
          recorded_by: number | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          check_in_method?: Database["public"]["Enums"]["checkin_method"] | null
          check_in_time?: string | null
          id?: number
          meeting_id: number
          member_id: number
          notes?: string | null
          recorded_by?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          check_in_method?: Database["public"]["Enums"]["checkin_method"] | null
          check_in_time?: string | null
          id?: number
          meeting_id?: number
          member_id?: number
          notes?: string | null
          recorded_by?: number | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          account_id: number
          amount: number
          bill_id: number
          description: string
          id: number
        }
        Insert: {
          account_id: number
          amount: number
          bill_id: number
          description: string
          id?: number
        }
        Update: {
          account_id?: number
          amount?: number
          bill_id?: number
          description?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string
          bill_no: string
          due_date: string
          fiscal_year_id: number
          id: number
          journal_entry_id: number | null
          memo: string | null
          status: Database["public"]["Enums"]["bill_status"]
          vendor_id: number | null
        }
        Insert: {
          bill_date?: string
          bill_no: string
          due_date: string
          fiscal_year_id: number
          id?: number
          journal_entry_id?: number | null
          memo?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          vendor_id?: number | null
        }
        Update: {
          bill_date?: string
          bill_no?: string
          due_date?: string
          fiscal_year_id?: number
          id?: number
          journal_entry_id?: number | null
          memo?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      board_positions: {
        Row: {
          bio: string | null
          fiscal_year_id: number
          id: number
          member_id: number
          sort_order: number
          title: string
        }
        Insert: {
          bio?: string | null
          fiscal_year_id: number
          id?: number
          member_id: number
          sort_order?: number
          title: string
        }
        Update: {
          bio?: string | null
          fiscal_year_id?: number
          id?: number
          member_id?: number
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_positions_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "board_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          email: string
          id: number
          is_read: boolean
          message: string
          name: string
          phone: string | null
          subject: string | null
          submitted_at: string
        }
        Insert: {
          email: string
          id?: number
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
          subject?: string | null
          submitted_at?: string
        }
        Update: {
          email?: string
          id?: number
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
          submitted_at?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body_html: string
          created_at: string
          created_by: number | null
          id: number
          recipient_type: Database["public"]["Enums"]["email_recipient_type"]
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          created_by?: number | null
          id?: number
          recipient_type: Database["public"]["Enums"]["email_recipient_type"]
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          created_by?: number | null
          id?: number
          recipient_type?: Database["public"]["Enums"]["email_recipient_type"]
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      email_logs: {
        Row: {
          campaign_id: number
          clicked_at: string | null
          created_at: string
          error_message: string | null
          id: number
          member_id: number | null
          opened_at: string | null
          recipient_email: string
          recipient_type: Database["public"]["Enums"]["email_recipient_type"]
          sent_at: string | null
          status: string
          visitor_id: number | null
        }
        Insert: {
          campaign_id: number
          clicked_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          member_id?: number | null
          opened_at?: string | null
          recipient_email: string
          recipient_type: Database["public"]["Enums"]["email_recipient_type"]
          sent_at?: string | null
          status?: string
          visitor_id?: number | null
        }
        Update: {
          campaign_id?: number
          clicked_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          member_id?: number | null
          opened_at?: string | null
          recipient_email?: string
          recipient_type?: Database["public"]["Enums"]["email_recipient_type"]
          sent_at?: string | null
          status?: string
          visitor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "email_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "email_logs_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          end_date: string
          id: number
          is_closed: boolean
          name: string
          start_date: string
        }
        Insert: {
          end_date: string
          id?: number
          is_closed?: boolean
          name: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: number
          is_closed?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      funds: {
        Row: {
          code: string
          id: number
          name: string
        }
        Insert: {
          code: string
          id?: number
          name: string
        }
        Update: {
          code?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      gallery_albums: {
        Row: {
          cover_image_url: string | null
          event_date: string | null
          id: number
          published: boolean
          title: string
        }
        Insert: {
          cover_image_url?: string | null
          event_date?: string | null
          id?: number
          published?: boolean
          title: string
        }
        Update: {
          cover_image_url?: string | null
          event_date?: string | null
          id?: number
          published?: boolean
          title?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          album_id: number
          caption: string | null
          id: number
          image_url: string
        }
        Insert: {
          album_id: number
          caption?: string | null
          id?: number
          image_url: string
        }
        Update: {
          album_id?: number
          caption?: string | null
          id?: number
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: number
          amount: number | null
          description: string
          id: number
          invoice_id: number
          quantity: number
          unit_price: number
        }
        Insert: {
          account_id: number
          amount?: number | null
          description: string
          id?: number
          invoice_id: number
          quantity?: number
          unit_price: number
        }
        Update: {
          account_id?: number
          amount?: number | null
          description?: string
          id?: number
          invoice_id?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string
          fiscal_year_id: number
          id: number
          invoice_date: string
          invoice_no: string
          journal_entry_id: number | null
          member_id: number
          memo: string | null
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          created_at?: string
          due_date: string
          fiscal_year_id: number
          id?: number
          invoice_date?: string
          invoice_no: string
          journal_entry_id?: number | null
          member_id: number
          memo?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          created_at?: string
          due_date?: string
          fiscal_year_id?: number
          id?: number
          invoice_date?: string
          invoice_no?: string
          journal_entry_id?: number | null
          member_id?: number
          memo?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: number | null
          entry_date: string
          entry_no: string
          fiscal_year_id: number
          fund_id: number
          id: number
          is_posted: boolean
          memo: string | null
          posted_at: string | null
          source_id: number | null
          source_type: Database["public"]["Enums"]["je_source"]
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          entry_date?: string
          entry_no: string
          fiscal_year_id: number
          fund_id: number
          id?: number
          is_posted?: boolean
          memo?: string | null
          posted_at?: string | null
          source_id?: number | null
          source_type?: Database["public"]["Enums"]["je_source"]
        }
        Update: {
          created_at?: string
          created_by?: number | null
          entry_date?: string
          entry_no?: string
          fiscal_year_id?: number
          fund_id?: number
          id?: number
          is_posted?: boolean
          memo?: string | null
          posted_at?: string | null
          source_id?: number | null
          source_type?: Database["public"]["Enums"]["je_source"]
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journal_entries_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: number
          credit: number
          debit: number
          description: string | null
          id: number
          journal_entry_id: number
          line_no: number
          member_id: number | null
        }
        Insert: {
          account_id: number
          credit?: number
          debit?: number
          description?: string | null
          id?: number
          journal_entry_id: number
          line_no: number
          member_id?: number | null
        }
        Update: {
          account_id?: number
          credit?: number
          debit?: number
          description?: string | null
          id?: number
          journal_entry_id?: number
          line_no?: number
          member_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "journal_lines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string | null
          id: number
          member_id: number
          reason: string
          requested_at: string
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string | null
          id?: number
          member_id: number
          reason: string
          requested_at?: string
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string | null
          id?: number
          member_id?: number
          reason?: string
          requested_at?: string
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "leave_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      meetings: {
        Row: {
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          created_at: string
          description: string | null
          end_time: string | null
          id: number
          is_closed: boolean
          is_mandatory: boolean
          is_public: boolean
          meeting_date: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          start_time: string
          title: string
          venue: string | null
        }
        Insert: {
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: number
          is_closed?: boolean
          is_mandatory?: boolean
          is_public?: boolean
          meeting_date: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_time: string
          title: string
          venue?: string | null
        }
        Update: {
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: number
          is_closed?: boolean
          is_mandatory?: boolean
          is_public?: boolean
          meeting_date?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_time?: string
          title?: string
          venue?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          classification: string | null
          created_at: string
          email: string
          first_name: string
          id: number
          joined_date: string
          last_name: string
          phone: string
          photo_url: string | null
          qr_issued_at: string
          qr_token: string
          ri_number: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          classification?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: number
          joined_date?: string
          last_name: string
          phone: string
          photo_url?: string | null
          qr_issued_at?: string
          qr_token?: string
          ri_number: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          classification?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: number
          joined_date?: string
          last_name?: string
          phone?: string
          photo_url?: string | null
          qr_issued_at?: string
          qr_token?: string
          ri_number?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          author_member_id: number | null
          body: string
          cover_image_url: string | null
          excerpt: string | null
          id: number
          published: boolean
          published_at: string | null
          slug: string
          title: string
        }
        Insert: {
          author_member_id?: number | null
          body: string
          cover_image_url?: string | null
          excerpt?: string | null
          id?: number
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
        }
        Update: {
          author_member_id?: number | null
          body?: string
          cover_image_url?: string | null
          excerpt?: string | null
          id?: number
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "news_articles_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_applied: number
          id: number
          invoice_id: number
          payment_id: number
        }
        Insert: {
          amount_applied: number
          id?: number
          invoice_id: number
          payment_id: number
        }
        Update: {
          amount_applied?: number
          id?: number
          invoice_id?: number
          payment_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deposit_account_id: number
          id: number
          journal_entry_id: number | null
          member_id: number | null
          method: Database["public"]["Enums"]["payment_method"]
          payer_name: string | null
          payment_date: string
          payment_no: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          deposit_account_id: number
          id?: number
          journal_entry_id?: number | null
          member_id?: number | null
          method: Database["public"]["Enums"]["payment_method"]
          payer_name?: string | null
          payment_date?: string
          payment_no: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          deposit_account_id?: number
          id?: number
          journal_entry_id?: number | null
          member_id?: number | null
          method?: Database["public"]["Enums"]["payment_method"]
          payer_name?: string | null
          payment_date?: string
          payment_no?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_deposit_account_id_fkey"
            columns: ["deposit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      profile_edit_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: number
          member_id: number
          requested_at: string
          requested_changes: Json
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: number
          member_id: number
          requested_at?: string
          requested_changes: Json
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: number
          member_id?: number
          requested_at?: string
          requested_changes?: Json
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_edit_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_edit_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "profile_edit_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_balances"
            referencedColumns: ["member_id"]
          },
        ]
      }
      project_photos: {
        Row: {
          caption: string | null
          id: number
          image_url: string
          project_id: number
          sort_order: number
        }
        Insert: {
          caption?: string | null
          id?: number
          image_url: string
          project_id: number
          sort_order?: number
        }
        Update: {
          caption?: string | null
          id?: number
          image_url?: string
          project_id?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area_of_focus: string
          budget_amount: number | null
          cover_image_url: string | null
          created_at: string
          end_date: string | null
          fund_id: number | null
          id: number
          published: boolean
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          story: string | null
          summary: string | null
          title: string
        }
        Insert: {
          area_of_focus: string
          budget_amount?: number | null
          cover_image_url?: string | null
          created_at?: string
          end_date?: string | null
          fund_id?: number | null
          id?: number
          published?: boolean
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          story?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          area_of_focus?: string
          budget_amount?: number | null
          cover_image_url?: string | null
          created_at?: string
          end_date?: string | null
          fund_id?: number | null
          id?: number
          published?: boolean
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          story?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      role_decisions: {
        Row: {
          action: Database["public"]["Enums"]["role_audit_action"]
          actor_email: string | null
          actor_user_id: string | null
          decided_at: string
          id: number
          role: Database["public"]["Enums"]["app_role"]
          subject_email: string | null
          subject_user_id: string
          user_role_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["role_audit_action"]
          actor_email?: string | null
          actor_user_id?: string | null
          decided_at?: string
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          subject_email?: string | null
          subject_user_id: string
          user_role_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["role_audit_action"]
          actor_email?: string | null
          actor_user_id?: string | null
          decided_at?: string
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          subject_email?: string | null
          subject_user_id?: string
          user_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_decisions_user_role_id_fkey"
            columns: ["user_role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          requested_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_at?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          requested_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["role_status"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          email: string | null
          id: number
          name: string
          phone: string | null
        }
        Insert: {
          email?: string | null
          id?: number
          name: string
          phone?: string | null
        }
        Update: {
          email?: string | null
          id?: number
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      visitors: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: number
          interest: Database["public"]["Enums"]["visitor_interest"]
          last_name: string
          meeting_id: number | null
          notes: string | null
          organization: string | null
          phone: string | null
          updated_at: string
          visited_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: number
          interest?: Database["public"]["Enums"]["visitor_interest"]
          last_name: string
          meeting_id?: number | null
          notes?: string | null
          organization?: string | null
          phone?: string | null
          updated_at?: string
          visited_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: number
          interest?: Database["public"]["Enums"]["visitor_interest"]
          last_name?: string
          meeting_id?: number | null
          notes?: string | null
          organization?: string | null
          phone?: string | null
          updated_at?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitors_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_attendance_summary: {
        Row: {
          attendance_pct: number | null
          meetings_attended: number | null
          meetings_required: number | null
          member_id: number | null
          member_name: string | null
        }
        Relationships: []
      }
      v_member_balances: {
        Row: {
          balance_due: number | null
          member_id: number | null
          member_name: string | null
          ri_number: string | null
        }
        Relationships: []
      }
      v_public_board: {
        Row: {
          bio: string | null
          first_name: string | null
          fiscal_year: string | null
          id: number | null
          last_name: string | null
          photo_url: string | null
          sort_order: number | null
          title: string | null
        }
        Relationships: []
      }
      v_role_audit: {
        Row: {
          action: Database["public"]["Enums"]["role_audit_action"] | null
          actor_email: string | null
          actor_user_id: string | null
          decided_at: string | null
          id: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          subject_email: string | null
          subject_user_id: string | null
        }
        Insert: {
          action?: Database["public"]["Enums"]["role_audit_action"] | null
          actor_email?: string | null
          actor_user_id?: string | null
          decided_at?: string | null
          id?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subject_email?: string | null
          subject_user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["role_audit_action"] | null
          actor_email?: string | null
          actor_user_id?: string | null
          decided_at?: string | null
          id?: number | null
          role?: Database["public"]["Enums"]["app_role"] | null
          subject_email?: string | null
          subject_user_id?: string | null
        }
        Relationships: []
      }
      v_trial_balance: {
        Row: {
          balance: number | null
          code: string | null
          name: string | null
          total_credit: number | null
          total_debit: number | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_decide_leave_request: {
        Args: { _approve: boolean; _note: string; _request_id: number }
        Returns: undefined
      }
      fn_decide_profile_edit_request: {
        Args: { _approve: boolean; _note: string; _request_id: number }
        Returns: undefined
      }
      fn_reissue_qr_token: { Args: { _member_id: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_editor: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_secretary: { Args: { _user_id: string }; Returns: boolean }
      is_admin_secretary_or_editor: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_officer: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role: "admin" | "treasurer" | "secretary" | "editor" | "member"
      attendance_status: "present" | "late" | "absent" | "excused"
      bill_status: "draft" | "received" | "partially_paid" | "paid" | "void"
      checkin_method: "qr_scan" | "manual"
      email_recipient_type: "member" | "visitor" | "list"
      email_status: "draft" | "scheduled" | "sent" | "failed"
      invoice_status: "draft" | "issued" | "partially_paid" | "paid" | "void"
      je_source:
        | "manual"
        | "invoice"
        | "payment"
        | "bill"
        | "payroll"
        | "adjustment"
        | "opening_balance"
      meeting_type: "weekly" | "board" | "event" | "project" | "fellowship"
      member_status:
        | "active"
        | "leave_of_absence"
        | "honorary"
        | "alumni"
        | "terminated"
      normal_side: "debit" | "credit"
      payment_method: "cash" | "mpesa" | "bank_transfer" | "cheque" | "card"
      project_status: "planned" | "ongoing" | "completed"
      request_status: "pending" | "approved" | "denied"
      role_audit_action: "requested" | "approved" | "revoked"
      role_status: "pending" | "approved" | "revoked"
      visitor_interest:
        | "general"
        | "membership"
        | "projects"
        | "events"
        | "other"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: ["admin", "treasurer", "secretary", "editor", "member"],
      attendance_status: ["present", "late", "absent", "excused"],
      bill_status: ["draft", "received", "partially_paid", "paid", "void"],
      checkin_method: ["qr_scan", "manual"],
      email_recipient_type: ["member", "visitor", "list"],
      email_status: ["draft", "scheduled", "sent", "failed"],
      invoice_status: ["draft", "issued", "partially_paid", "paid", "void"],
      je_source: [
        "manual",
        "invoice",
        "payment",
        "bill",
        "payroll",
        "adjustment",
        "opening_balance",
      ],
      meeting_type: ["weekly", "board", "event", "project", "fellowship"],
      member_status: [
        "active",
        "leave_of_absence",
        "honorary",
        "alumni",
        "terminated",
      ],
      normal_side: ["debit", "credit"],
      payment_method: ["cash", "mpesa", "bank_transfer", "cheque", "card"],
      project_status: ["planned", "ongoing", "completed"],
      request_status: ["pending", "approved", "denied"],
      role_audit_action: ["requested", "approved", "revoked"],
      role_status: ["pending", "approved", "revoked"],
      visitor_interest: [
        "general",
        "membership",
        "projects",
        "events",
        "other",
      ],
    },
  },
} as const
