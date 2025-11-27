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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          address: string | null
          admin_type: string | null
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          push_token: string | null
          role: string | null
          updated_at: string
          user_id: string | null
          voip_push_token: string | null
        }
        Insert: {
          address?: string | null
          admin_type?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          push_token?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
          voip_push_token?: string | null
        }
        Update: {
          address?: string | null
          admin_type?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          push_token?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
          voip_push_token?: string | null
        }
        Relationships: []
      }
      apartment_residents: {
        Row: {
          apartment_id: string
          created_at: string
          id: string
          is_active: boolean | null
          is_owner: boolean | null
          is_primary: boolean
          profile_id: string
          relationship: string | null
        }
        Insert: {
          apartment_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_owner?: boolean | null
          is_primary?: boolean
          profile_id: string
          relationship?: string | null
        }
        Update: {
          apartment_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_owner?: boolean | null
          is_primary?: boolean
          profile_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartment_residents_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_residents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          building_id: string
          created_at: string
          floor: number | null
          id: string
          number: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          floor?: number | null
          id?: string
          number: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          floor?: number | null
          id?: string
          number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }

      building_admins: {
        Row: {
          admin_profile_id: string
          building_id: string
          created_at: string
          id: string
        }
        Insert: {
          admin_profile_id: string
          building_id: string
          created_at?: string
          id?: string
        }
        Update: {
          admin_profile_id?: string
          building_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_admins_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_admins_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          participant_id: string
          participant_type: string
          status: string | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_id: string
          participant_type: string
          status?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_id?: string
          participant_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "intercom_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          building_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          notification_sent_at: string | null
          notification_status: string | null
          priority: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          building_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          notification_sent_at?: string | null
          notification_status?: string | null
          priority?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          building_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          notification_sent_at?: string | null
          notification_status?: string | null
          priority?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          apartment_id: string
          building_id: string
          created_at: string
          delivery_code: string | null
          delivery_company: string | null
          delivery_date: string
          description: string | null
          entregue: boolean | null
          id: string
          is_active: boolean | null
          notes: string | null
          notification_status: string | null
          photo_url: string | null
          received_at: string | null
          received_by: string | null
          recipient_name: string
          sender_company: string | null
          status: string | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          apartment_id: string
          building_id: string
          created_at?: string
          delivery_code?: string | null
          delivery_company?: string | null
          delivery_date?: string
          description?: string | null
          entregue?: boolean | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notification_status?: string | null
          photo_url?: string | null
          received_at?: string | null
          received_by?: string | null
          recipient_name: string
          sender_company?: string | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          apartment_id?: string
          building_id?: string
          created_at?: string
          delivery_code?: string | null
          delivery_company?: string | null
          delivery_date?: string
          description?: string | null
          entregue?: boolean | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notification_status?: string | null
          photo_url?: string | null
          received_at?: string | null
          received_by?: string | null
          recipient_name?: string
          sender_company?: string | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      doorkeeper_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          apartment_id: string
          building_id: string
          created_at: string | null
          entry_type: string | null
          expires_at: string | null
          guest_name: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          new_status: string
          notification_type: string
          old_status: string | null
          priority: string | null
          title: string
          visitor_log_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          apartment_id: string
          building_id: string
          created_at?: string | null
          entry_type?: string | null
          expires_at?: string | null
          guest_name?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          new_status: string
          notification_type: string
          old_status?: string | null
          priority?: string | null
          title: string
          visitor_log_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          apartment_id?: string
          building_id?: string
          created_at?: string | null
          entry_type?: string | null
          expires_at?: string | null
          guest_name?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          new_status?: string
          notification_type?: string
          old_status?: string | null
          priority?: string | null
          title?: string
          visitor_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doorkeeper_notifications_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doorkeeper_notifications_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doorkeeper_notifications_visitor_log_id_fkey"
            columns: ["visitor_log_id"]
            isOneToOne: false
            referencedRelation: "visitor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      intercom_calls: {
        Row: {
          answered_at: string | null
          apartment_id: string
          created_at: string | null
          initiator_id: string
          initiator_type: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string | null
          status: string | null
          channel_name: string | null
        }
        Insert: {
          answered_at?: string | null
          apartment_id: string
          created_at?: string | null
          initiator_id: string
          initiator_type: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          channel_name?: string | null
        }
        Update: {
          answered_at?: string | null
          apartment_id?: string
          created_at?: string | null
          initiator_id?: string
          initiator_type?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          channel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intercom_calls_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercom_calls_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lembrete_historico: {
        Row: {
          acao: string
          data_acao: string | null
          id: string
          lembrete_id: string | null
          observacoes: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          data_acao?: string | null
          id?: string
          lembrete_id?: string | null
          observacoes?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          data_acao?: string | null
          id?: string
          lembrete_id?: string | null
          observacoes?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lembrete_historico_lembrete_id_fkey"
            columns: ["lembrete_id"]
            isOneToOne: false
            referencedRelation: "lembretes"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes: {
        Row: {
          antecedencia_alerta: number | null
          building_admin_id: string | null
          categoria: string
          created_at: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          prioridade: string | null
          sindico_id: string
          status: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          antecedencia_alerta?: number | null
          building_admin_id?: string | null
          categoria: string
          created_at?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          prioridade?: string | null
          sindico_id: string
          status?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          antecedencia_alerta?: number | null
          building_admin_id?: string | null
          categoria?: string
          created_at?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          prioridade?: string | null
          sindico_id?: string
          status?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lembretes_building_admin"
            columns: ["building_admin_id"]
            isOneToOne: false
            referencedRelation: "building_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_audit_log: {
        Row: {
          action_type: string | null
          affected_count: number | null
          apartment_id: string | null
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          delivery_destination: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          response_type: string | null
          user_id: string | null
          visitor_log_id: string | null
        }
        Insert: {
          action_type?: string | null
          affected_count?: number | null
          apartment_id?: string | null
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          delivery_destination?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          response_type?: string | null
          user_id?: string | null
          visitor_log_id?: string | null
        }
        Update: {
          action_type?: string | null
          affected_count?: number | null
          apartment_id?: string | null
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          delivery_destination?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          response_type?: string | null
          user_id?: string | null
          visitor_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_log_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_audit_log_visitor_log_id_fkey"
            columns: ["visitor_log_id"]
            isOneToOne: false
            referencedRelation: "visitor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_status: {
        Row: {
          building_id: string
          confirmation_status: string | null
          confirmed_at: string | null
          content_id: string
          created_at: string | null
          delivered_at: string | null
          delivery_attempts: number | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          notification_id: string
          notification_type: string
          push_status: string | null
          read_at: string | null
          read_status: string | null
          user_id: string
          whatsapp_status: string | null
        }
        Insert: {
          building_id: string
          confirmation_status?: string | null
          confirmed_at?: string | null
          content_id: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id: string
          notification_type: string
          push_status?: string | null
          read_at?: string | null
          read_status?: string | null
          user_id: string
          whatsapp_status?: string | null
        }
        Update: {
          building_id?: string
          confirmation_status?: string | null
          confirmed_at?: string | null
          content_id?: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id?: string
          notification_type?: string
          push_status?: string | null
          read_at?: string | null
          read_status?: string | null
          user_id?: string
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_notification_building"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          attempted_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          notification_id: string
          platform: string
          response_data: Json | null
          status: string
          token_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          platform: string
          response_data?: Json | null
          status: string
          token_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          platform?: string
          response_data?: Json | null
          status?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "user_notification_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_read_status: {
        Row: {
          created_at: string | null
          id: string
          notification_id: string
          notification_type: string | null
          read_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_id: string
          notification_type?: string | null
          read_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_id?: string
          notification_type?: string | null
          read_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          expires_at: string | null
          id: string
          priority: string | null
          recipient_id: string
          sent_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          priority?: string | null
          recipient_id: string
          sent_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          priority?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string | null
          id: string
          option_text: string
          order_index: number
          poll_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_text: string
          order_index?: number
          poll_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          option_text?: string
          order_index?: number
          poll_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls_with_vote_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          apartment_id: string | null
          created_at: string | null
          id: string
          option_id: string | null
          poll_id: string | null
          poll_option_id: string | null
          user_id: string | null
        }
        Insert: {
          apartment_id?: string | null
          created_at?: string | null
          id?: string
          option_id?: string | null
          poll_id?: string | null
          poll_option_id?: string | null
          user_id?: string | null
        }
        Update: {
          apartment_id?: string | null
          created_at?: string | null
          id?: string
          option_id?: string | null
          poll_id?: string | null
          poll_option_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options_with_vote_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls_with_vote_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_option_id_fkey"
            columns: ["poll_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_option_id_fkey"
            columns: ["poll_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options_with_vote_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          building_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          notification_confirmed_at: string | null
          notification_confirmed_by: string | null
          notification_read_at: string | null
          notification_sent_at: string | null
          notification_status: string | null
          question: string
          title: string
          updated_at: string | null
        }
        Insert: {
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_confirmed_at?: string | null
          notification_confirmed_by?: string | null
          notification_read_at?: string | null
          notification_sent_at?: string | null
          notification_status?: string | null
          question: string
          title: string
          updated_at?: string | null
        }
        Update: {
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_confirmed_at?: string | null
          notification_confirmed_by?: string | null
          notification_read_at?: string | null
          notification_sent_at?: string | null
          notification_status?: string | null
          question?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      porteiro_shifts: {
        Row: {
          building_id: string
          created_at: string | null
          id: string
          notes: string | null
          porteiro_id: string
          shift_end: string | null
          shift_start: string
          status: string
          updated_at: string | null
        }
        Insert: {
          building_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          porteiro_id: string
          shift_end?: string | null
          shift_start?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          building_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          porteiro_id?: string
          shift_end?: string | null
          shift_start?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "porteiro_shifts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "porteiro_shifts_porteiro_id_fkey"
            columns: ["porteiro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_verifications: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          profile_id: string
          status: string
          verification_date: string | null
          verification_type: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          status?: string
          verification_date?: string | null
          verification_type: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          status?: string
          verification_date?: string | null
          verification_type?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_verifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          building_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_login_completed: boolean | null
          full_name: string | null
          id: string
          is_available: boolean | null
          is_online: boolean | null
          last_seen: string | null
          notification_enabled: boolean | null
          phone: string | null
          photo_verification_status: string | null
          profile_complete: boolean | null
          profile_completion_date: string | null
          push_token: string | null
          registration_token: string | null
          relation: string | null
          role: string | null
          temporary_password_used: boolean | null
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
          user_type: string | null
          voip_push_token: string | null
          work_schedule: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          building_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_login_completed?: boolean | null
          full_name?: string | null
          id?: string
          is_available?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          notification_enabled?: boolean | null
          phone?: string | null
          photo_verification_status?: string | null
          profile_complete?: boolean | null
          profile_completion_date?: string | null
          push_token?: string | null
          registration_token?: string | null
          relation?: string | null
          role?: string | null
          temporary_password_used?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
          user_type?: string | null
          voip_push_token?: string | null
          work_schedule?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          building_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_login_completed?: boolean | null
          full_name?: string | null
          id?: string
          is_available?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          notification_enabled?: boolean | null
          phone?: string | null
          photo_verification_status?: string | null
          profile_complete?: boolean | null
          profile_completion_date?: string | null
          push_token?: string | null
          registration_token?: string | null
          relation?: string | null
          role?: string | null
          temporary_password_used?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
          user_type?: string | null
          voip_push_token?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_tokens: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          id: string
          is_used: boolean
          metadata: Json | null
          token: string
          token_type: string
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          id?: string
          is_used?: boolean
          metadata?: Json | null
          token: string
          token_type: string
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          metadata?: Json | null
          token?: string
          token_type?: string
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      super_admin_profiles: {
        Row: {
          admin_type: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_type?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_type?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      temporary_passwords: {
        Row: {
          created_at: string | null
          expires_at: string | null
          hashed_password: string | null
          id: string
          password_hash: string
          phone_number: string | null
          plain_password: string
          profile_id: string | null
          status: string | null
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          hashed_password?: string | null
          id?: string
          password_hash: string
          phone_number?: string | null
          plain_password: string
          profile_id?: string | null
          status?: string | null
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          hashed_password?: string | null
          id?: string
          password_hash?: string
          phone_number?: string | null
          plain_password?: string
          profile_id?: string | null
          status?: string | null
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temporary_passwords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          apartment_id: string | null
          auto_approve_deliveries: boolean | null
          auto_approve_known_visitors: boolean | null
          auto_approve_resident_vehicles: boolean | null
          created_at: string | null
          delivery_notifications_enabled: boolean | null
          id: string
          max_notifications_per_hour: number | null
          notification_timeout_minutes: number | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sound_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          vehicle_notifications_enabled: boolean | null
          vibration_enabled: boolean | null
          visitor_notifications_enabled: boolean | null
        }
        Insert: {
          apartment_id?: string | null
          auto_approve_deliveries?: boolean | null
          auto_approve_known_visitors?: boolean | null
          auto_approve_resident_vehicles?: boolean | null
          created_at?: string | null
          delivery_notifications_enabled?: boolean | null
          id?: string
          max_notifications_per_hour?: number | null
          notification_timeout_minutes?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_notifications_enabled?: boolean | null
          vibration_enabled?: boolean | null
          visitor_notifications_enabled?: boolean | null
        }
        Update: {
          apartment_id?: string | null
          auto_approve_deliveries?: boolean | null
          auto_approve_known_visitors?: boolean | null
          auto_approve_resident_vehicles?: boolean | null
          created_at?: string | null
          delivery_notifications_enabled?: boolean | null
          id?: string
          max_notifications_per_hour?: number | null
          notification_timeout_minutes?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_notifications_enabled?: boolean | null
          vibration_enabled?: boolean | null
          visitor_notifications_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          device_type: string
          id: string
          is_active: boolean | null
          last_updated: string | null
          notification_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          device_type: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          notification_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          notification_token?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          apartment_id: string | null
          brand: string | null
          color: string | null
          created_at: string
          id: string
          license_plate: string
          model: string | null
          ownership_type: string
          type: string | null
          updated_at: string
        }
        Insert: {
          apartment_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          license_plate: string
          model?: string | null
          ownership_type?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          apartment_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          license_plate?: string
          model?: string | null
          ownership_type?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_authorization_tokens: {
        Row: {
          apartment_number: string
          building: string
          created_at: string | null
          expires_at: string
          id: string
          resident_name: string
          resident_phone: string
          updated_at: string | null
          used: boolean | null
          visitor_log_id: string | null
          visitor_name: string
        }
        Insert: {
          apartment_number: string
          building: string
          created_at?: string | null
          expires_at: string
          id?: string
          resident_name: string
          resident_phone: string
          updated_at?: string | null
          used?: boolean | null
          visitor_log_id?: string | null
          visitor_name: string
        }
        Update: {
          apartment_number?: string
          building?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          resident_name?: string
          resident_phone?: string
          updated_at?: string | null
          used?: boolean | null
          visitor_log_id?: string | null
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_authorization_tokens_visitor_log_id_fkey"
            columns: ["visitor_log_id"]
            isOneToOne: false
            referencedRelation: "visitor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_logs: {
        Row: {
          apartment_id: string
          authorized_by: string | null
          auto_approved: boolean | null
          building_id: string
          created_at: string
          delivery_description: string | null
          delivery_destination: string | null
          delivery_id: string | null
          delivery_sender: string | null
          delivery_tracking_code: string | null
          emergency_override: boolean | null
          entry_type: string | null
          expires_at: string | null
          guest_name: string | null
          id: string
          license_plate: string | null
          log_time: string
          notification_preferences: Json | null
          notification_sent_at: string | null
          notification_status: string | null
          photo_url: string | null
          purpose: string | null
          rejection_reason: string | null
          requires_notification: boolean | null
          requires_resident_approval: boolean | null
          resident_response_at: string | null
          resident_response_by: string | null
          tipo_log: string
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_id: string | null
          vehicle_info: Json | null
          vehicle_model: string | null
          visit_session_id: string | null
          visitor_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          apartment_id: string
          authorized_by?: string | null
          auto_approved?: boolean | null
          building_id: string
          created_at?: string
          delivery_description?: string | null
          delivery_destination?: string | null
          delivery_id?: string | null
          delivery_sender?: string | null
          delivery_tracking_code?: string | null
          emergency_override?: boolean | null
          entry_type?: string | null
          expires_at?: string | null
          guest_name?: string | null
          id?: string
          license_plate?: string | null
          log_time?: string
          notification_preferences?: Json | null
          notification_sent_at?: string | null
          notification_status?: string | null
          photo_url?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requires_notification?: boolean | null
          requires_resident_approval?: boolean | null
          resident_response_at?: string | null
          resident_response_by?: string | null
          tipo_log: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_id?: string | null
          vehicle_info?: Json | null
          vehicle_model?: string | null
          visit_session_id?: string | null
          visitor_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          apartment_id?: string
          authorized_by?: string | null
          auto_approved?: boolean | null
          building_id?: string
          created_at?: string
          delivery_description?: string | null
          delivery_destination?: string | null
          delivery_id?: string | null
          delivery_sender?: string | null
          delivery_tracking_code?: string | null
          emergency_override?: boolean | null
          entry_type?: string | null
          expires_at?: string | null
          guest_name?: string | null
          id?: string
          license_plate?: string | null
          log_time?: string
          notification_preferences?: Json | null
          notification_sent_at?: string | null
          notification_status?: string | null
          photo_url?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requires_notification?: boolean | null
          requires_resident_approval?: boolean | null
          resident_response_at?: string | null
          resident_response_by?: string | null
          tipo_log?: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_id?: string | null
          vehicle_info?: Json | null
          vehicle_model?: string | null
          visit_session_id?: string | null
          visitor_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_logs_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_new_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_new_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_new_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          access_type: string
          allowed_days: string[] | null
          apartment_id: string | null
          created_at: string
          document: string | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          max_simultaneous_visits: number | null
          name: string
          phone: string | null
          photo_url: string | null
          registration_token: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string
          visit_date: string | null
          visit_end_time: string | null
          visit_start_time: string | null
          visit_type: Database["public"]["Enums"]["visit_type_enum"] | null
          visitor_type: string | null
        }
        Insert: {
          access_type?: string
          allowed_days?: string[] | null
          apartment_id?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          max_simultaneous_visits?: number | null
          name: string
          phone?: string | null
          photo_url?: string | null
          registration_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          visit_date?: string | null
          visit_end_time?: string | null
          visit_start_time?: string | null
          visit_type?: Database["public"]["Enums"]["visit_type_enum"] | null
          visitor_type?: string | null
        }
        Update: {
          access_type?: string
          allowed_days?: string[] | null
          apartment_id?: string | null
          created_at?: string
          document?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          max_simultaneous_visits?: number | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          registration_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          visit_date?: string | null
          visit_end_time?: string | null
          visit_start_time?: string | null
          visit_type?: Database["public"]["Enums"]["visit_type_enum"] | null
          visitor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          id: string
          user_id: string
          device_token: string
          platform: 'ios' | 'android'
          token_type: 'voip' | 'standard'
          environment: 'sandbox' | 'production'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_token: string
          platform: 'ios' | 'android'
          token_type: 'voip' | 'standard'
          environment?: 'sandbox' | 'production'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_token?: string
          platform?: 'ios' | 'android'
          token_type?: 'voip' | 'standard'
          environment?: 'sandbox' | 'production'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      poll_options_with_vote_counts: {
        Row: {
          created_at: string | null
          id: string | null
          option_text: string | null
          order_index: number | null
          poll_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls_with_vote_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      polls_with_vote_counts: {
        Row: {
          building_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          question: string | null
          title: string | null
          total_votes: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_close_old_shifts: { Args: never; Returns: number }
      check_visit_availability: {
        Args: {
          p_apartment_id: string
          p_end_time?: string
          p_start_time?: string
          p_visit_date?: string
          p_visit_day?: string
        }
        Returns: boolean
      }
      cleanup_expired_notifications: { Args: never; Returns: undefined }
      cleanup_expired_tokens: { Args: never; Returns: number }
      cleanup_expired_visitor_tokens: { Args: never; Returns: undefined }
      create_communication: {
        Args: {
          p_building_id: string
          p_content: string
          p_created_by: string
          p_priority: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      create_resident_with_temp_password: {
        Args: {
          p_apartment_id: string
          p_full_name: string
          p_password_hash: string
          p_phone: string
          p_temp_password: string
        }
        Returns: Json
      }
      expire_old_notifications: { Args: never; Returns: number }
      generate_random_password: { Args: never; Returns: string }
      get_active_porteiro: { Args: { building_uuid: string }; Returns: string }
      register_device_token: {
        Args: {
          p_device_token: string
          p_platform: string
          p_token_type: string
          p_environment?: string
        }
        Returns: string
      }
      get_apartment_residents: {
        Args: { apartment_number: string; building_id: string }
        Returns: {
          apartment_id: string
          apt_number: string
          building_name: string
          device_tokens: Json
          email: string
          full_name: string
          is_available: boolean
          is_online: boolean
          is_owner: boolean
          is_primary: boolean
          last_seen: string
          phone: string
          profile_id: string
          relationship: string
          user_type: string
        }[]
      }
      get_notification_delivery_stats: {
        Args: {
          p_building_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          confirmation_rate: number
          delivery_rate: number
          notification_type: string
          read_rate: number
          total_confirmed: number
          total_delivered: number
          total_read: number
          total_sent: number
        }[]
      }
      get_notification_stats:
        | {
            Args: { building_id_param: string; date_from?: string }
            Returns: {
              approved_count: number
              avg_response_time: unknown
              entry_type: string
              expired_count: number
              rejected_count: number
              total_notifications: number
            }[]
          }
        | {
            Args: { p_building_id: string; p_days_back?: number }
            Returns: {
              confirmation_rate: number
              confirmed_count: number
              delivered_count: number
              delivery_rate: number
              failed_count: number
              read_count: number
              read_rate: number
              sent_count: number
              table_name: string
              total_count: number
            }[]
          }
      get_pending_notifications_with_status: {
        Args: { building_id_param: string }
        Returns: {
          apartment_number: string
          created_at: string
          delivery_sender: string
          entry_type: string
          guest_name: string
          last_updated: string
          notification_status: string
          purpose: string
          resident_name: string
          visitor_log_id: string
        }[]
      }
      get_unread_notifications_count: {
        Args: { p_notification_ids: string[] }
        Returns: number
      }
      get_user_building_ids: { Args: { user_id: string }; Returns: string[] }
      get_user_notification_preferences: {
        Args: { apartment_id_param: string; user_id_param: string }
        Returns: {
          apartment_id: string | null
          auto_approve_deliveries: boolean | null
          auto_approve_known_visitors: boolean | null
          auto_approve_resident_vehicles: boolean | null
          created_at: string | null
          delivery_notifications_enabled: boolean | null
          id: string
          max_notifications_per_hour: number | null
          notification_timeout_minutes: number | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sound_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          vehicle_notifications_enabled: boolean | null
          vibration_enabled: boolean | null
          visitor_notifications_enabled: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "user_notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      handle_notification_response: {
        Args: {
          p_delivery_destination?: string
          p_log_id: string
          p_rejection_reason?: string
          p_response: string
        }
        Returns: boolean
      }
      increment_delivery_attempts: {
        Args: { notification_id: string }
        Returns: number
      }
      is_admin_user:
        | { Args: { user_uuid: string }; Returns: boolean }
        | { Args: never; Returns: boolean }
      is_building_admin: {
        Args: { building_id: string; user_id: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_admin_or_porteiro: { Args: never; Returns: boolean }
      is_current_user_porteiro: { Args: never; Returns: boolean }
      is_super_admin: { Args: { user_id: string }; Returns: boolean }
      is_visitante_valid: { Args: { visitante_id: string }; Returns: boolean }
      mark_all_notifications_as_read: {
        Args: { p_notification_ids: string[]; p_notification_type?: string }
        Returns: number
      }
      mark_notification_as_read: {
        Args: { p_notification_id: string; p_notification_type?: string }
        Returns: string
      }
      registrar_acesso_visitante: {
        Args: {
          p_liberado_por?: string
          p_observacoes?: string
          p_tipo_liberacao: string
          p_visitante_id: string
        }
        Returns: string
      }
      test_get_apartment_residents: { Args: never; Returns: string }
      update_notification_status: {
        Args: {
          p_record_id: string
          p_status: string
          p_table_name: string
          p_user_id?: string
        }
        Returns: boolean
      }
      validate_shift_overlap: {
        Args: {
          building_uuid: string
          porteiro_uuid: string
          start_time?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      visit_type_enum: "pontual" | "frequente" | "prestador_servico"
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
      visit_type_enum: ["pontual", "frequente", "prestador_servico"],
    },
  },
} as const
