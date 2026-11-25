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
      account_strikes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          reason: string
          strike_level: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reason: string
          strike_level?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          strike_level?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_studio_history: {
        Row: {
          created_at: string
          id: string
          mode: string
          prompt: string
          result_preview: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          prompt: string
          result_preview?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          prompt?: string
          result_preview?: string | null
          user_id?: string
        }
        Relationships: []
      }
      arena_match_results: {
        Row: {
          created_at: string
          evidence_path: string
          id: string
          match_id: string
          notes: string
          reviewed_at: string | null
          reviewed_by: string | null
          score_a: number
          score_b: number
          status: string
          submitted_by: string
        }
        Insert: {
          created_at?: string
          evidence_path: string
          id?: string
          match_id: string
          notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_a: number
          score_b: number
          status?: string
          submitted_by: string
        }
        Update: {
          created_at?: string
          evidence_path?: string
          id?: string
          match_id?: string
          notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_a?: number
          score_b?: number
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_pubg_round_scores: {
        Row: {
          eliminations: number
          entry_id: string
          id: string
          match_id: string
          placement: number
          points: number
          recorded_by: string
          updated_at: string
        }
        Insert: {
          eliminations: number
          entry_id: string
          id?: string
          match_id: string
          placement: number
          points: number
          recorded_by: string
          updated_at?: string
        }
        Update: {
          eliminations?: number
          entry_id?: string
          id?: string
          match_id?: string
          placement?: number
          points?: number
          recorded_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_pubg_round_scores_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_pubg_round_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournament_entries: {
        Row: {
          created_at: string
          display_name: string
          id: string
          player_id: string | null
          seed: number | null
          status: string
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          player_id?: string | null
          seed?: number | null
          status?: string
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          player_id?: string | null
          seed?: number | null
          status?: string
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_tournament_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "arena_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournament_matches: {
        Row: {
          created_at: string
          entry_a_id: string | null
          entry_b_id: string | null
          id: string
          match_number: number
          next_match_id: string | null
          next_slot: string | null
          round_number: number
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          status: string
          tournament_id: string
          winner_entry_id: string | null
        }
        Insert: {
          created_at?: string
          entry_a_id?: string | null
          entry_b_id?: string | null
          id?: string
          match_number: number
          next_match_id?: string | null
          next_slot?: string | null
          round_number: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          tournament_id: string
          winner_entry_id?: string | null
        }
        Update: {
          created_at?: string
          entry_a_id?: string | null
          entry_b_id?: string | null
          id?: string
          match_number?: number
          next_match_id?: string | null
          next_slot?: string | null
          round_number?: number
          scheduled_at?: string | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          tournament_id?: string
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_tournament_matches_entry_a_id_fkey"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_matches_entry_b_id_fkey"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "arena_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_matches_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournament_standings: {
        Row: {
          draws: number
          eliminations: number
          entry_id: string
          id: string
          losses: number
          placement_points: number
          played: number
          points: number
          tournament_id: string
          updated_at: string
          wins: number
        }
        Insert: {
          draws?: number
          eliminations?: number
          entry_id: string
          id?: string
          losses?: number
          placement_points?: number
          played?: number
          points?: number
          tournament_id: string
          updated_at?: string
          wins?: number
        }
        Update: {
          draws?: number
          eliminations?: number
          entry_id?: string
          id?: string
          losses?: number
          placement_points?: number
          played?: number
          points?: number
          tournament_id?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "arena_tournament_standings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_tournament_standings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "arena_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournament_team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "arena_tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournament_teams: {
        Row: {
          captain_id: string
          created_at: string
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "arena_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_tournaments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          champion_entry_id: string | null
          created_at: string
          created_by: string
          description: string
          entry_mode: string
          format_key: string
          game_key: string
          id: string
          max_entries: number
          platform_key: string
          registration_closes_at: string | null
          rules: string
          starts_at: string | null
          status: string
          team_size: number
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          champion_entry_id?: string | null
          created_at?: string
          created_by: string
          description?: string
          entry_mode?: string
          format_key: string
          game_key: string
          id?: string
          max_entries?: number
          platform_key?: string
          registration_closes_at?: string | null
          rules?: string
          starts_at?: string | null
          status?: string
          team_size?: number
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          champion_entry_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          entry_mode?: string
          format_key?: string
          game_key?: string
          id?: string
          max_entries?: number
          platform_key?: string
          registration_closes_at?: string | null
          rules?: string
          starts_at?: string | null
          status?: string
          team_size?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_campaigns: {
        Row: {
          budget_per_creator: number
          business_id: string | null
          campaign_title: string
          created_at: string | null
          description: string
          id: string
          status: string | null
          total_slots: number
        }
        Insert: {
          budget_per_creator: number
          business_id?: string | null
          campaign_title: string
          created_at?: string | null
          description: string
          id?: string
          status?: string | null
          total_slots: number
        }
        Update: {
          budget_per_creator?: number
          business_id?: string | null
          campaign_title?: string
          created_at?: string | null
          description?: string
          id?: string
          status?: string | null
          total_slots?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverables: {
        Row: {
          agreed_amount: number
          campaign_id: string | null
          created_at: string | null
          creator_id: string | null
          creator_payout: number
          id: string
          nexora_escrow_fee: number
          post_id: string | null
          submission_status: string | null
        }
        Insert: {
          agreed_amount: number
          campaign_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          creator_payout: number
          id?: string
          nexora_escrow_fee: number
          post_id?: string | null
          submission_status?: string | null
        }
        Update: {
          agreed_amount?: number
          campaign_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          creator_payout?: number
          id?: string
          nexora_escrow_fee?: number
          post_id?: string | null
          submission_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliverables_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          business_id: string
          buyer_id: string
          customer_tag: string
          id: string
          last_message: string | null
          last_message_at: string
        }
        Insert: {
          business_id: string
          buyer_id: string
          customer_tag?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
        }
        Update: {
          business_id?: string
          buyer_id?: string
          customer_tag?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_messages: {
        Row: {
          attachment_mime_type: string | null
          attachment_name: string | null
          attachment_size_bytes: number | null
          body: string
          client_request_id: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          expires_at: string | null
          group_id: string
          id: string
          location_accuracy_m: number | null
          location_captured_at: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_session_id: string | null
          media_path: string | null
          media_type: string | null
          reply_to_message_id: string | null
          sender_id: string
          shared_content_id: string | null
          shared_content_source: string | null
          shared_content_type: string | null
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_size_bytes?: number | null
          body?: string
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_session_id?: string | null
          media_path?: string | null
          media_type?: string | null
          reply_to_message_id?: string | null
          sender_id: string
          shared_content_id?: string | null
          shared_content_source?: string | null
          shared_content_type?: string | null
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_size_bytes?: number | null
          body?: string
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_session_id?: string | null
          media_path?: string | null
          media_type?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
          shared_content_id?: string | null
          shared_content_source?: string | null
          shared_content_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_messages_location_session_id_fkey"
            columns: ["location_session_id"]
            isOneToOne: false
            referencedRelation: "chat_location_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_location_shares: {
        Row: {
          accuracy_m: number | null
          chat_kind: string
          expires_at: string
          group_id: string | null
          id: string
          last_updated_at: string
          latitude: number
          longitude: number
          recipient_id: string | null
          sender_id: string
          started_at: string
          stopped_at: string | null
        }
        Insert: {
          accuracy_m?: number | null
          chat_kind: string
          expires_at: string
          group_id?: string | null
          id?: string
          last_updated_at?: string
          latitude: number
          longitude: number
          recipient_id?: string | null
          sender_id: string
          started_at?: string
          stopped_at?: string | null
        }
        Update: {
          accuracy_m?: number | null
          chat_kind?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          last_updated_at?: string
          latitude?: number
          longitude?: number
          recipient_id?: string | null
          sender_id?: string
          started_at?: string
          stopped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_location_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_settings: {
        Row: {
          chat_key: string | null
          chat_kind: string
          created_at: string
          group_id: string | null
          id: string
          retention_seconds: number
          updated_at: string
          updated_by: string
          user_a_id: string | null
          user_b_id: string | null
        }
        Insert: {
          chat_key?: string | null
          chat_kind: string
          created_at?: string
          group_id?: string | null
          id?: string
          retention_seconds?: number
          updated_at?: string
          updated_by: string
          user_a_id?: string | null
          user_b_id?: string | null
        }
        Update: {
          chat_key?: string | null
          chat_kind?: string
          created_at?: string
          group_id?: string | null
          id?: string
          retention_seconds?: number
          updated_at?: string
          updated_by?: string
          user_a_id?: string | null
          user_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          media_url: string | null
          message_text: string | null
          order_id: string | null
          payment_request_amount: number | null
          payment_request_currency: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_text?: string | null
          order_id?: string | null
          payment_request_amount?: number | null
          payment_request_currency?: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_text?: string | null
          order_id?: string | null
          payment_request_amount?: number | null
          payment_request_currency?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_channel_reads: {
        Row: {
          club_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_channel_reads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_dues: {
        Row: {
          amount_kes: number
          club_id: string
          created_at: string
          id: string
          payer_id: string
          paystack_reference: string
          status: string
        }
        Insert: {
          amount_kes: number
          club_id: string
          created_at?: string
          id?: string
          payer_id: string
          paystack_reference: string
          status?: string
        }
        Update: {
          amount_kes?: number
          club_id?: string
          created_at?: string
          id?: string
          payer_id?: string
          paystack_reference?: string
          status?: string
        }
        Relationships: []
      }
      club_events: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          event_date: string
          event_time: string
          id: string
          kind: string
          notes: string
          title: string
          venue: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          event_date: string
          event_time: string
          id?: string
          kind: string
          notes?: string
          title: string
          venue: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          event_date?: string
          event_time?: string
          id?: string
          kind?: string
          notes?: string
          title?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: string
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_membership_activity: {
        Row: {
          actor_user_id: string | null
          club_id: string
          created_at: string
          details: Json
          event_type: string
          id: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          club_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          club_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_membership_activity_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          appointed_by: string | null
          club_id: string
          created_at: string
          id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          appointed_by?: string | null
          club_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          appointed_by?: string | null
          club_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_messages: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          is_announcement: boolean
          pinned_at: string | null
          sender_id: string
          sender_name: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          id?: string
          is_announcement?: boolean
          pinned_at?: string | null
          sender_id: string
          sender_name: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          is_announcement?: boolean
          pinned_at?: string | null
          sender_id?: string
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          blurb: string
          city: string
          created_at: string
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          name: string
          owner_user_id: string
          updated_at: string
          venue: string
          visibility: string
        }
        Insert: {
          blurb?: string
          city: string
          created_at?: string
          id: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_user_id: string
          updated_at?: string
          venue: string
          visibility?: string
        }
        Update: {
          blurb?: string
          city?: string
          created_at?: string
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_user_id?: string
          updated_at?: string
          venue?: string
          visibility?: string
        }
        Relationships: []
      }
      creator_drafts: {
        Row: {
          audience: string
          caption: string
          content_type: string
          created_at: string
          filter: string
          format: string
          id: string
          media_paths: string[]
          media_type: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string
          caption?: string
          content_type?: string
          created_at?: string
          filter?: string
          format?: string
          id?: string
          media_paths?: string[]
          media_type?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          caption?: string
          content_type?: string
          created_at?: string
          filter?: string
          format?: string
          id?: string
          media_paths?: string[]
          media_type?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_earnings_ledger: {
        Row: {
          created_at: string
          creator_amount_kes: number
          creator_id: string
          gross_amount_kes: number
          id: string
          payment_id: string
          platform_fee_kes: number
        }
        Insert: {
          created_at?: string
          creator_amount_kes: number
          creator_id: string
          gross_amount_kes: number
          id?: string
          payment_id: string
          platform_fee_kes?: number
        }
        Update: {
          created_at?: string
          creator_amount_kes?: number
          creator_id?: string
          gross_amount_kes?: number
          id?: string
          payment_id?: string
          platform_fee_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_ledger_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "creator_monetization_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_monetization_applications: {
        Row: {
          age_confirmed_18_plus: boolean
          age_confirmed_at: string | null
          age_confirmed_by: string | null
          created_at: string
          creator_id: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          age_confirmed_18_plus?: boolean
          age_confirmed_at?: string | null
          age_confirmed_by?: string | null
          created_at?: string
          creator_id: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          age_confirmed_18_plus?: boolean
          age_confirmed_at?: string | null
          age_confirmed_by?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_monetization_applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_monetization_payments: {
        Row: {
          amount_kes: number
          amount_usd: number | null
          completed_at: string | null
          created_at: string
          creator_id: string
          exchange_rate: number | null
          fx_source: string | null
          fx_timestamp: string | null
          gateway_reference: string | null
          id: string
          payment_type: string
          status: string
          subscriber_id: string
          tier_name: string | null
          transaction_reference: string
        }
        Insert: {
          amount_kes: number
          amount_usd?: number | null
          completed_at?: string | null
          created_at?: string
          creator_id: string
          exchange_rate?: number | null
          fx_source?: string | null
          fx_timestamp?: string | null
          gateway_reference?: string | null
          id?: string
          payment_type: string
          status?: string
          subscriber_id: string
          tier_name?: string | null
          transaction_reference: string
        }
        Update: {
          amount_kes?: number
          amount_usd?: number | null
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          exchange_rate?: number | null
          fx_source?: string | null
          fx_timestamp?: string | null
          gateway_reference?: string | null
          id?: string
          payment_type?: string
          status?: string
          subscriber_id?: string
          tier_name?: string | null
          transaction_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_monetization_payments_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_monetization_payments_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_monetization_platform_config: {
        Row: {
          id: boolean
          platform_fee_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          platform_fee_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          platform_fee_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      creator_monetization_settings: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          is_enabled: boolean
          monthly_price_usd: number
          tier_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          is_enabled?: boolean
          monthly_price_usd: number
          tier_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          is_enabled?: boolean
          monthly_price_usd?: number
          tier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_monetization_settings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_destination_reviews: {
        Row: {
          created_at: string
          creator_id: string
          decision: string
          destination_id: string
          id: string
          ownership_confirmed: boolean
          review_note: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          decision: string
          destination_id: string
          id?: string
          ownership_confirmed?: boolean
          review_note: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          decision?: string
          destination_id?: string
          id?: string
          ownership_confirmed?: boolean
          review_note?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_destination_reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payout_destination_reviews_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "creator_payout_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_destinations: {
        Row: {
          created_at: string
          creator_id: string
          destination_last4: string
          encrypted_account: string
          encryption_key_version: string
          id: string
          is_default: boolean
          is_verified: boolean
          number_confirmed_at: string | null
          provider: string
          provider_validation_checked_at: string | null
          provider_validation_error_code: string | null
          provider_validation_status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          destination_last4: string
          encrypted_account: string
          encryption_key_version: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          number_confirmed_at?: string | null
          provider: string
          provider_validation_checked_at?: string | null
          provider_validation_error_code?: string | null
          provider_validation_status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          destination_last4?: string
          encrypted_account?: string
          encryption_key_version?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          number_confirmed_at?: string | null
          provider?: string
          provider_validation_checked_at?: string | null
          provider_validation_error_code?: string | null
          provider_validation_status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_destinations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          payout_id: string
          provider_conversation_id: string | null
          provider_originator_conversation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payout_id: string
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payout_id?: string
          provider_conversation_id?: string | null
          provider_originator_conversation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_jobs_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: true
            referencedRelation: "creator_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_provider_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          payout_id: string | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string
          received_at: string
          result_code: string | null
          result_description: string | null
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json
          payout_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          result_code?: string | null
          result_description?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          payout_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          result_code?: string | null
          result_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_provider_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "creator_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          creator_id: string
          currency: string
          destination_last4: string | null
          fee: number
          id: string
          payout_channel: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          destination_last4?: string | null
          fee?: number
          id?: string
          payout_channel: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          destination_last4?: string | null
          fee?: number
          id?: string
          payout_channel?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          currency: string
          current_period_end: string | null
          gateway_subscription_id: string | null
          id: string
          last_payment_id: string | null
          monthly_amount: number
          status: string
          subscriber_id: string
          tier_name: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          currency?: string
          current_period_end?: string | null
          gateway_subscription_id?: string | null
          id?: string
          last_payment_id?: string | null
          monthly_amount: number
          status?: string
          subscriber_id: string
          tier_name: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          currency?: string
          current_period_end?: string | null
          gateway_subscription_id?: string | null
          id?: string
          last_payment_id?: string | null
          monthly_amount?: number
          status?: string
          subscriber_id?: string
          tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_subscriptions_last_payment_id_fkey"
            columns: ["last_payment_id"]
            isOneToOne: false
            referencedRelation: "creator_monetization_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_verifications: {
        Row: {
          id: string
          id_number: string
          id_type: string
          reviewed_at: string | null
          submitted_at: string | null
          user_id: string | null
          verification_status: string | null
        }
        Insert: {
          id?: string
          id_number: string
          id_type: string
          reviewed_at?: string | null
          submitted_at?: string | null
          user_id?: string | null
          verification_status?: string | null
        }
        Update: {
          id?: string
          id_number?: string
          id_type?: string
          reviewed_at?: string | null
          submitted_at?: string | null
          user_id?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_wallets: {
        Row: {
          available_balance: number
          creator_id: string
          currency: string
          id: string
          pending_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          creator_id: string
          currency?: string
          id?: string
          pending_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          creator_id?: string
          currency?: string
          id?: string
          pending_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_wallets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_mime_type: string | null
          attachment_name: string | null
          attachment_size_bytes: number | null
          body: string
          client_request_id: string | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          location_accuracy_m: number | null
          location_captured_at: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_session_id: string | null
          media_path: string | null
          media_type: string | null
          recipient_id: string
          reply_to_message_id: string | null
          seen_at: string | null
          sender_id: string
          shared_content_id: string | null
          shared_content_source: string | null
          shared_content_type: string | null
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_size_bytes?: number | null
          body: string
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_session_id?: string | null
          media_path?: string | null
          media_type?: string | null
          recipient_id: string
          reply_to_message_id?: string | null
          seen_at?: string | null
          sender_id: string
          shared_content_id?: string | null
          shared_content_source?: string | null
          shared_content_type?: string | null
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_size_bytes?: number | null
          body?: string
          client_request_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_session_id?: string | null
          media_path?: string | null
          media_type?: string | null
          recipient_id?: string
          reply_to_message_id?: string | null
          seen_at?: string | null
          sender_id?: string
          shared_content_id?: string | null
          shared_content_source?: string | null
          shared_content_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_location_session_id_fkey"
            columns: ["location_session_id"]
            isOneToOne: false
            referencedRelation: "chat_location_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_completion_history: {
        Row: {
          completed_at: string
          course_id: string | null
          course_title: string
          id: string
          item_title: string
          item_type: string
          lesson_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id?: string | null
          course_title: string
          id?: string
          item_title: string
          item_type: string
          lesson_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string | null
          course_title?: string
          id?: string
          item_title?: string
          item_type?: string
          lesson_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_completion_history_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_completion_history_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "edu_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_course_certificates: {
        Row: {
          course_id: string
          course_title: string
          created_at: string
          id: string
          instructor_name: string
          issued_at: string
          learner_name: string
          student_id: string
          verification_code: string
        }
        Insert: {
          course_id: string
          course_title: string
          created_at?: string
          id?: string
          instructor_name: string
          issued_at?: string
          learner_name: string
          student_id: string
          verification_code: string
        }
        Update: {
          course_id?: string
          course_title?: string
          created_at?: string
          id?: string
          instructor_name?: string
          issued_at?: string
          learner_name?: string
          student_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_course_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_course_rating_summaries: {
        Row: {
          average_rating: number
          course_id: string
          rating_count: number
          updated_at: string
        }
        Insert: {
          average_rating: number
          course_id: string
          rating_count: number
          updated_at?: string
        }
        Update: {
          average_rating?: number
          course_id?: string
          rating_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_course_rating_summaries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_course_ratings: {
        Row: {
          course_id: string
          created_at: string
          id: string
          rating: number
          student_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          rating: number
          student_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_course_ratings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_courses: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          instructor_id: string
          is_published: boolean
          last_published_at: string | null
          level: string
          price_kes: number
          price_usd: number
          publication_status: string
          published_at: string | null
          skill_tags: string[]
          slug: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          instructor_id: string
          is_published?: boolean
          last_published_at?: string | null
          level?: string
          price_kes?: number
          price_usd?: number
          publication_status?: string
          published_at?: string | null
          skill_tags?: string[]
          slug: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          instructor_id?: string
          is_published?: boolean
          last_published_at?: string | null
          level?: string
          price_kes?: number
          price_usd?: number
          publication_status?: string
          published_at?: string | null
          skill_tags?: string[]
          slug?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      edu_enrollments: {
        Row: {
          amount_paid: number
          completed_at: string | null
          course_id: string
          currency: string
          enrolled_at: string
          id: string
          payment_provider: string | null
          payment_reference: string | null
          status: string
          student_id: string
        }
        Insert: {
          amount_paid?: number
          completed_at?: string | null
          course_id: string
          currency?: string
          enrolled_at?: string
          id?: string
          payment_provider?: string | null
          payment_reference?: string | null
          status?: string
          student_id: string
        }
        Update: {
          amount_paid?: number
          completed_at?: string | null
          course_id?: string
          currency?: string
          enrolled_at?: string
          id?: string
          payment_provider?: string | null
          payment_reference?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_learning_hidden_items: {
        Row: {
          course_id: string | null
          hidden_at: string
          id: string
          item_type: string
          lesson_id: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          hidden_at?: string
          id?: string
          item_type: string
          lesson_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          hidden_at?: string
          id?: string
          item_type?: string
          lesson_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_learning_hidden_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_learning_hidden_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "edu_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_learning_notes: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_learning_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_learning_notes_lesson_course_fkey"
            columns: ["lesson_id", "course_id"]
            isOneToOne: false
            referencedRelation: "edu_lessons"
            referencedColumns: ["id", "course_id"]
          },
        ]
      }
      edu_lesson_progress: {
        Row: {
          completed: boolean
          id: string
          last_position_seconds: number
          lesson_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          id?: string
          last_position_seconds?: number
          lesson_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          id?: string
          last_position_seconds?: number
          lesson_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "edu_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_lessons: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration_seconds: number
          id: string
          is_preview: boolean
          last_published_at: string | null
          lesson_order: number
          publication_status: string
          published_at: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          is_preview?: boolean
          last_published_at?: string | null
          lesson_order: number
          publication_status?: string
          published_at?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          is_preview?: boolean
          last_published_at?: string | null
          lesson_order?: number
          publication_status?: string
          published_at?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_resource_previews: {
        Row: {
          access_tier: string
          course_id: string
          file_size_bytes: number
          file_type: string
          id: string
          resource_name: string
        }
        Insert: {
          access_tier: string
          course_id: string
          file_size_bytes: number
          file_type: string
          id: string
          resource_name: string
        }
        Update: {
          access_tier?: string
          course_id?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          resource_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_resource_previews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_resource_previews_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "edu_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_resources: {
        Row: {
          access_tier: string
          course_id: string
          created_at: string
          display_order: number
          file_size_bytes: number
          file_type: string
          id: string
          last_published_at: string | null
          publication_status: string
          published_at: string | null
          r2_object_key: string
          resource_name: string
        }
        Insert: {
          access_tier?: string
          course_id: string
          created_at?: string
          display_order?: number
          file_size_bytes?: number
          file_type?: string
          id?: string
          last_published_at?: string | null
          publication_status?: string
          published_at?: string | null
          r2_object_key: string
          resource_name: string
        }
        Update: {
          access_tier?: string
          course_id?: string
          created_at?: string
          display_order?: number
          file_size_bytes?: number
          file_type?: string
          id?: string
          last_published_at?: string | null
          publication_status?: string
          published_at?: string | null
          r2_object_key?: string
          resource_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_saved_items: {
        Row: {
          course_id: string | null
          educator_id: string | null
          id: string
          item_type: string
          lesson_id: string | null
          resource_id: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          educator_id?: string | null
          id?: string
          item_type: string
          lesson_id?: string | null
          resource_id?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          educator_id?: string | null
          id?: string
          item_type?: string
          lesson_id?: string | null
          resource_id?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_saved_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_saved_items_educator_id_fkey"
            columns: ["educator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_saved_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "edu_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_saved_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "edu_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          event_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          created_at: string
          creator_id: string
          creator_net_amount: number
          creator_tier: string
          entry_type: string
          gateway_fee: number
          gross_amount: number
          id: string
          metadata: Json
          payment_channel: string
          platform_take_fee: number
          sender_id: string | null
          status: string
          transaction_reference: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          creator_net_amount: number
          creator_tier?: string
          entry_type?: string
          gateway_fee: number
          gross_amount: number
          id?: string
          metadata?: Json
          payment_channel: string
          platform_take_fee: number
          sender_id?: string | null
          status?: string
          transaction_reference: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          creator_net_amount?: number
          creator_tier?: string
          entry_type?: string
          gateway_fee?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          payment_channel?: string
          platform_take_fee?: number
          sender_id?: string | null
          status?: string
          transaction_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          target_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      football_announcements: {
        Row: {
          created_at: string
          headline: string
          id: string
          is_published: boolean
          provider: string
          provider_id: string
          published_at: string
          source_name: string
          source_url: string
          summary: string
        }
        Insert: {
          created_at?: string
          headline: string
          id?: string
          is_published?: boolean
          provider: string
          provider_id: string
          published_at: string
          source_name: string
          source_url: string
          summary?: string
        }
        Update: {
          created_at?: string
          headline?: string
          id?: string
          is_published?: boolean
          provider?: string
          provider_id?: string
          published_at?: string
          source_name?: string
          source_url?: string
          summary?: string
        }
        Relationships: []
      }
      football_club_match_posts: {
        Row: {
          club_id: string
          id: string
          posted_at: string
          provider: string
          provider_id: string
          score_signature: string
        }
        Insert: {
          club_id: string
          id?: string
          posted_at?: string
          provider: string
          provider_id: string
          score_signature: string
        }
        Update: {
          club_id?: string
          id?: string
          posted_at?: string
          provider?: string
          provider_id?: string
          score_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "football_club_match_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      football_club_team_sync: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          provider: string
          team_name: string
          team_provider_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          provider: string
          team_name: string
          team_provider_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          provider?: string
          team_name?: string
          team_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "football_club_team_sync_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      football_favorite_teams: {
        Row: {
          created_at: string
          id: string
          provider: string
          team_name: string
          team_provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          team_name: string
          team_provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          team_name?: string
          team_provider_id?: string
          user_id?: string
        }
        Relationships: []
      }
      football_highlights: {
        Row: {
          competition_code: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_published: boolean
          match_label: string
          provider: string
          provider_id: string
          published_at: string
          score_label: string | null
          source_name: string
          thumbnail_url: string | null
          video_url: string
        }
        Insert: {
          competition_code?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          match_label: string
          provider: string
          provider_id: string
          published_at: string
          score_label?: string | null
          source_name: string
          thumbnail_url?: string | null
          video_url: string
        }
        Update: {
          competition_code?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          match_label?: string
          provider?: string
          provider_id?: string
          published_at?: string
          score_label?: string | null
          source_name?: string
          thumbnail_url?: string | null
          video_url?: string
        }
        Relationships: []
      }
      football_matches: {
        Row: {
          away_score: number | null
          away_team: string
          away_team_provider_id: string | null
          competition_code: string
          competition_name: string
          created_at: string
          elapsed_minute: number | null
          home_score: number | null
          home_team: string
          home_team_provider_id: string | null
          id: string
          is_published: boolean
          kickoff_at: string
          provider: string
          provider_id: string
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          away_team_provider_id?: string | null
          competition_code: string
          competition_name: string
          created_at?: string
          elapsed_minute?: number | null
          home_score?: number | null
          home_team: string
          home_team_provider_id?: string | null
          id?: string
          is_published?: boolean
          kickoff_at: string
          provider: string
          provider_id: string
          source_url?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          away_team_provider_id?: string | null
          competition_code?: string
          competition_name?: string
          created_at?: string
          elapsed_minute?: number | null
          home_score?: number | null
          home_team?: string
          home_team_provider_id?: string | null
          id?: string
          is_published?: boolean
          kickoff_at?: string
          provider?: string
          provider_id?: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      football_standings: {
        Row: {
          competition_code: string
          competition_name: string
          created_at: string
          current_matchday: number | null
          drawn: number
          goal_difference: number
          goals_against: number
          goals_for: number
          group_name: string
          id: string
          lost: number
          played_games: number
          points: number
          position: number
          provider: string
          season_end: string | null
          season_id: string
          season_start: string | null
          standing_type: string
          team_crest_url: string | null
          team_name: string
          team_provider_id: string
          team_short_name: string | null
          updated_at: string
          won: number
        }
        Insert: {
          competition_code: string
          competition_name: string
          created_at?: string
          current_matchday?: number | null
          drawn?: number
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          group_name?: string
          id?: string
          lost?: number
          played_games?: number
          points?: number
          position: number
          provider: string
          season_end?: string | null
          season_id: string
          season_start?: string | null
          standing_type?: string
          team_crest_url?: string | null
          team_name: string
          team_provider_id: string
          team_short_name?: string | null
          updated_at?: string
          won?: number
        }
        Update: {
          competition_code?: string
          competition_name?: string
          created_at?: string
          current_matchday?: number | null
          drawn?: number
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          group_name?: string
          id?: string
          lost?: number
          played_games?: number
          points?: number
          position?: number
          provider?: string
          season_end?: string | null
          season_id?: string
          season_start?: string | null
          standing_type?: string
          team_crest_url?: string | null
          team_name?: string
          team_provider_id?: string
          team_short_name?: string | null
          updated_at?: string
          won?: number
        }
        Relationships: []
      }
      football_sync_state: {
        Row: {
          key: string
          last_synced_at: string
        }
        Insert: {
          key: string
          last_synced_at: string
        }
        Update: {
          key?: string
          last_synced_at?: string
        }
        Relationships: []
      }
      global_financial_ledger: {
        Row: {
          base_amount: number
          base_currency: string
          created_at: string
          exchange_rate: number
          gateway_fee: number
          id: string
          payment_gateway: string
          platform_fee: number
          recipient_id: string | null
          sender_id: string | null
          settled_amount: number
          settled_currency: string
          status: string
          transaction_reference: string
        }
        Insert: {
          base_amount: number
          base_currency: string
          created_at?: string
          exchange_rate?: number
          gateway_fee?: number
          id?: string
          payment_gateway: string
          platform_fee?: number
          recipient_id?: string | null
          sender_id?: string | null
          settled_amount: number
          settled_currency: string
          status?: string
          transaction_reference: string
        }
        Update: {
          base_amount?: number
          base_currency?: string
          created_at?: string
          exchange_rate?: number
          gateway_fee?: number
          id?: string
          payment_gateway?: string
          platform_fee?: number
          recipient_id?: string | null
          sender_id?: string | null
          settled_amount?: number
          settled_currency?: string
          status?: string
          transaction_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_financial_ledger_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_financial_ledger_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          back_path: string | null
          category: string
          created_at: string
          document_type: string
          front_path: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          back_path?: string | null
          category: string
          created_at?: string
          document_type: string
          front_path: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          back_path?: string | null
          category?: string
          created_at?: string
          document_type?: string
          front_path?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_location_access: {
        Row: {
          decided_at: string | null
          host_user_id: string
          id: string
          requested_at: string
          session_id: string
          status: string
          viewer_user_id: string
        }
        Insert: {
          decided_at?: string | null
          host_user_id: string
          id?: string
          requested_at?: string
          session_id: string
          status?: string
          viewer_user_id: string
        }
        Update: {
          decided_at?: string | null
          host_user_id?: string
          id?: string
          requested_at?: string
          session_id?: string
          status?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_location_access_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_locations: {
        Row: {
          accuracy: number | null
          host_user_id: string
          latitude: number
          longitude: number
          session_id: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          host_user_id: string
          latitude: number
          longitude: number
          session_id: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          host_user_id?: string
          latitude?: number
          longitude?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_session_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          host_user_id: string
          id: string
          last_seen_at: string
          peer_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          host_user_id: string
          id?: string
          last_seen_at?: string
          peer_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          host_user_id?: string
          id?: string
          last_seen_at?: string
          peer_id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          creator_id: string | null
          ended_at: string | null
          id: string
          peak_viewers: number | null
          started_at: string | null
          status: string | null
          stream_key: string
          stream_title: string
          total_gifts_earned: number | null
        }
        Insert: {
          creator_id?: string | null
          ended_at?: string | null
          id?: string
          peak_viewers?: number | null
          started_at?: string | null
          status?: string | null
          stream_key: string
          stream_title: string
          total_gifts_earned?: number | null
        }
        Update: {
          creator_id?: string | null
          ended_at?: string | null
          id?: string
          peak_viewers?: number | null
          started_at?: string | null
          status?: string | null
          stream_key?: string
          stream_title?: string
          total_gifts_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          media_type: string
          metadata: Json
          owner_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type: string
          metadata?: Json
          owner_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type?: string
          metadata?: Json
          owner_id?: string
          storage_path?: string
        }
        Relationships: []
      }
      merchant_accounts: {
        Row: {
          bank_account_number: string | null
          bank_code: string | null
          business_id: string
          business_name: string
          created_at: string
          id: string
          is_verified: boolean
          mpesa_paybill_till: string | null
          paystack_subaccount_code: string | null
          platform_fee_percentage: number
        }
        Insert: {
          bank_account_number?: string | null
          bank_code?: string | null
          business_id: string
          business_name: string
          created_at?: string
          id?: string
          is_verified?: boolean
          mpesa_paybill_till?: string | null
          paystack_subaccount_code?: string | null
          platform_fee_percentage?: number
        }
        Update: {
          bank_account_number?: string | null
          bank_code?: string | null
          business_id?: string
          business_name?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          mpesa_paybill_till?: string | null
          paystack_subaccount_code?: string | null
          platform_fee_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_quick_replies: {
        Row: {
          business_id: string
          created_at: string
          id: string
          reply_template: string
          shortcut_title: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          reply_template: string
          shortcut_title: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          reply_template?: string
          shortcut_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_quick_replies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          body: string
          conversation_key: string
          created_at: string
          id: string
          metadata: Json
          sender_id: string
        }
        Insert: {
          body: string
          conversation_key: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_id: string
        }
        Update: {
          body?: string
          conversation_key?: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_id?: string
        }
        Relationships: []
      }
      moderation_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string
          note: string | null
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id: string
          note?: string | null
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string
          note?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_audit_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          post_id: string | null
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind: string
          post_id?: string | null
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          post_id?: string | null
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_entries: {
        Row: {
          bio: string | null
          display_name: string | null
          handle: string | null
          id: string
          interests: string[]
          reputation_score: number
          sharing_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          interests?: string[]
          reputation_score?: number
          sharing_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          interests?: string[]
          reputation_score?: number
          sharing_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_provider_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          provider_reference: string | null
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          provider_reference?: string | null
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          provider_reference?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          creator_id: string
          currency: string
          gateway_reference: string | null
          id: string
          metadata: Json
          payment_channel: string
          sender_id: string
          status: string
          transaction_reference: string
          transaction_type: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          gateway_reference?: string | null
          id?: string
          metadata?: Json
          payment_channel: string
          sender_id: string
          status?: string
          transaction_reference: string
          transaction_type: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          gateway_reference?: string | null
          id?: string
          metadata?: Json
          payment_channel?: string
          sender_id?: string
          status?: string
          transaction_reference?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paywall_unlocks: {
        Row: {
          amount: number
          buyer_id: string
          content_id: string
          created_at: string
          creator_id: string
          currency: string
          id: string
          payment_transaction_id: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          content_id: string
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          payment_transaction_id?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          content_id?: string
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          payment_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paywall_unlocks_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paywall_unlocks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paywall_unlocks_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name?: string
        }
        Relationships: []
      }
      platform_admin_audit_logs: {
        Row: {
          action: string
          actor_id: string
          category: string
          created_at: string
          id: string
          metadata: Json
          request_id: string | null
          summary: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          category: string
          created_at?: string
          id?: string
          metadata?: Json
          request_id?: string | null
          summary: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json
          request_id?: string | null
          summary?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_settings_history: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_value: Json
          old_value: Json | null
          outcome: string
          reason: string
          setting_key: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_value: Json
          old_value?: Json | null
          outcome?: string
          reason: string
          setting_key: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          outcome?: string
          reason?: string
          setting_key?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_interactions: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          post_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: string
          post_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_interactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audience: string
          author_id: string
          caption: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          tags: string[]
        }
        Insert: {
          audience?: string
          author_id: string
          caption: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          tags?: string[]
        }
        Update: {
          audience?: string
          author_id?: string
          caption?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          tags?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          bio_links: Json
          created_at: string
          discoverable: boolean
          display_name: string | null
          education_skills: string[]
          handle: string | null
          id: string
          interests: string[]
          invite_code: string | null
          private_profile: boolean
          profile_category: string | null
          settings: Json
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          bio_links?: Json
          created_at?: string
          discoverable?: boolean
          display_name?: string | null
          education_skills?: string[]
          handle?: string | null
          id: string
          interests?: string[]
          invite_code?: string | null
          private_profile?: boolean
          profile_category?: string | null
          settings?: Json
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          bio_links?: Json
          created_at?: string
          discoverable?: boolean
          display_name?: string | null
          education_skills?: string[]
          handle?: string | null
          id?: string
          interests?: string[]
          invite_code?: string | null
          private_profile?: boolean
          profile_category?: string | null
          settings?: Json
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          endpoint: string
          subscription: Json
          updated_at: string
        }
        Insert: {
          endpoint: string
          subscription: Json
          updated_at?: string
        }
        Update: {
          endpoint?: string
          subscription?: Json
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          moderator_note: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_note?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          moderator_note?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      store_orders: {
        Row: {
          business_id: string
          buyer_id: string | null
          created_at: string
          fulfillment_status: string
          gateway_reference: string | null
          id: string
          merchant_earnings: number
          nexora_commission: number
          order_reference: string
          payment_status: string
          receipt_sent_at: string | null
          total_amount: number
        }
        Insert: {
          business_id: string
          buyer_id?: string | null
          created_at?: string
          fulfillment_status?: string
          gateway_reference?: string | null
          id?: string
          merchant_earnings?: number
          nexora_commission?: number
          order_reference: string
          payment_status?: string
          receipt_sent_at?: string | null
          total_amount: number
        }
        Update: {
          business_id?: string
          buyer_id?: string | null
          created_at?: string
          fulfillment_status?: string
          gateway_reference?: string | null
          id?: string
          merchant_earnings?: number
          nexora_commission?: number
          order_reference?: string
          payment_status?: string
          receipt_sent_at?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          payment_status: string
          paystack_reference: string
          tier: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency: string
          id?: string
          payment_status?: string
          paystack_reference: string
          tier: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          payment_status?: string
          paystack_reference?: string
          tier?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string
          current_period_start: string
          last_payment_reference: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end: string
          current_period_start?: string
          last_payment_reference: string
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string
          current_period_start?: string
          last_payment_reference?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_admin_id?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          description: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_admin_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string | null
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_post_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_comments: {
        Row: {
          created_at: string
          id: string
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_completions: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_completions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_not_interested: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_not_interested_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_reposts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_post_views: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          playback_id: string
          post_id: string
          viewed_on: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          playback_id?: string
          post_id: string
          viewed_on?: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          playback_id?: string
          post_id?: string
          viewed_on?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_media_posts: {
        Row: {
          aspect_ratio: string | null
          audience: string
          caption: string | null
          collab_partner_id: string | null
          comment_count: number | null
          completion_count: number
          content_type: string
          created_at: string | null
          dominant_color: string | null
          duration_seconds: number | null
          focal_x: number
          focal_y: number
          framing_aspect_ratio: string
          id: string
          like_count: number | null
          media_storage_key: string | null
          media_storage_provider: string
          media_type: string | null
          media_url: string | null
          original_author_id: string | null
          pillar: Database["public"]["Enums"]["content_pillar"]
          repost_count: number
          share_count: number | null
          tags: string[]
          thumbnail_storage_key: string | null
          thumbnail_storage_provider: string
          thumbnail_url: string | null
          user_id: string | null
          view_count: number | null
          zoom: number
        }
        Insert: {
          aspect_ratio?: string | null
          audience?: string
          caption?: string | null
          collab_partner_id?: string | null
          comment_count?: number | null
          completion_count?: number
          content_type?: string
          created_at?: string | null
          dominant_color?: string | null
          duration_seconds?: number | null
          focal_x?: number
          focal_y?: number
          framing_aspect_ratio?: string
          id?: string
          like_count?: number | null
          media_storage_key?: string | null
          media_storage_provider?: string
          media_type?: string | null
          media_url?: string | null
          original_author_id?: string | null
          pillar: Database["public"]["Enums"]["content_pillar"]
          repost_count?: number
          share_count?: number | null
          tags?: string[]
          thumbnail_storage_key?: string | null
          thumbnail_storage_provider?: string
          thumbnail_url?: string | null
          user_id?: string | null
          view_count?: number | null
          zoom?: number
        }
        Update: {
          aspect_ratio?: string | null
          audience?: string
          caption?: string | null
          collab_partner_id?: string | null
          comment_count?: number | null
          completion_count?: number
          content_type?: string
          created_at?: string | null
          dominant_color?: string | null
          duration_seconds?: number | null
          focal_x?: number
          focal_y?: number
          framing_aspect_ratio?: string
          id?: string
          like_count?: number | null
          media_storage_key?: string | null
          media_storage_provider?: string
          media_type?: string | null
          media_url?: string | null
          original_author_id?: string | null
          pillar?: Database["public"]["Enums"]["content_pillar"]
          repost_count?: number
          share_count?: number | null
          tags?: string[]
          thumbnail_storage_key?: string | null
          thumbnail_storage_provider?: string
          thumbnail_url?: string | null
          user_id?: string | null
          view_count?: number | null
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_media_posts_collab_partner_id_fkey"
            columns: ["collab_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_posts_original_author_id_fkey"
            columns: ["original_author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pillar_affinity: {
        Row: {
          pillar: Database["public"]["Enums"]["content_pillar"]
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          pillar: Database["public"]["Enums"]["content_pillar"]
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          pillar?: Database["public"]["Enums"]["content_pillar"]
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen: string
          show_last_seen: boolean
          show_online: boolean
          user_id: string
        }
        Insert: {
          last_seen?: string
          show_last_seen?: boolean
          show_online?: boolean
          user_id: string
        }
        Update: {
          last_seen?: string
          show_last_seen?: boolean
          show_online?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_saved_items: {
        Row: {
          id: string
          post_id: string | null
          saved_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          post_id?: string | null
          saved_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          post_id?: string | null
          saved_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_media_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          available_balance: number
          currency: string
          id: string
          nex_points: number
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          currency?: string
          id?: string
          nex_points?: number
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          currency?: string
          id?: string
          nex_points?: number
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_checkins: {
        Row: {
          checked_in_at: string
          id: string
          source: string
          user_id: string
          venue: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          source?: string
          user_id: string
          venue: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          source?: string
          user_id?: string
          venue?: string
        }
        Relationships: []
      }
      wallet_txns: {
        Row: {
          amount: number
          created_at: string
          currency: string
          gateway_reference: string | null
          id: string
          kind: string
          label: string
          note: string | null
          payment_channel: string
          status: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          gateway_reference?: string | null
          id?: string
          kind: string
          label: string
          note?: string | null
          payment_channel?: string
          status?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          gateway_reference?: string | null
          id?: string
          kind?: string
          label?: string
          note?: string | null
          payment_channel?: string
          status?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_txns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_club_invitation: { Args: { p_token: string }; Returns: string }
      add_user_media_post_comment: {
        Args: { comment_text: string; target_post_id: string }
        Returns: string
      }
      admin_get_support_ticket_messages: {
        Args: { p_ticket_id: string }
        Returns: Json
      }
      admin_get_support_tickets: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_get_wallet_finance: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_list_creator_monetization_applications: {
        Args: { p_admin_user_id: string }
        Returns: {
          age_confirmed_18_plus: boolean
          application_id: string
          application_status: string
          avatar_url: string
          creator_id: string
          display_name: string
          handle: string
          kyc_document_type: string
          kyc_status: string
          review_note: string
          submitted_at: string
        }[]
      }
      admin_list_platform_users: {
        Args: {
          p_admin_user_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          email: string
          handle: string
          id: string
          is_suspended: boolean
          profile_category: string
          suspension_reason: string
        }[]
      }
      admin_record_manual_creator_payout: {
        Args: {
          p_admin_note: string
          p_admin_user_id: string
          p_decision: string
          p_payment_reference: string
          p_payout_id: string
        }
        Returns: Json
      }
      admin_remove_reported_content: {
        Args: { p_moderator_id: string; p_note?: string; p_report_id: string }
        Returns: Json
      }
      admin_reply_support_ticket: {
        Args: { p_message: string; p_ticket_id: string }
        Returns: string
      }
      admin_review_creator_monetization_application: {
        Args: {
          p_admin_user_id: string
          p_age_confirmed_18_plus?: boolean
          p_application_id: string
          p_decision: string
          p_review_note: string
        }
        Returns: Json
      }
      admin_review_creator_payout_destination: {
        Args: {
          p_admin_user_id: string
          p_decision: string
          p_destination_id: string
          p_ownership_confirmed?: boolean
          p_review_note: string
        }
        Returns: Json
      }
      admin_set_platform_user_suspension: {
        Args: {
          p_admin_user_id: string
          p_reason?: string
          p_suspended: boolean
          p_user_id: string
        }
        Returns: boolean
      }
      admin_update_platform_setting: {
        Args: {
          p_actor_id: string
          p_new_value: Json
          p_reason: string
          p_setting_key: string
        }
        Returns: Json
      }
      admin_update_support_ticket: {
        Args: { p_priority: string; p_status: string; p_ticket_id: string }
        Returns: boolean
      }
      approve_follow_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      arena_approve_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      arena_create_team: {
        Args: {
          p_member_ids: string[]
          p_name: string
          p_tournament_id: string
        }
        Returns: string
      }
      arena_create_tournament: {
        Args: {
          p_description?: string
          p_format_key: string
          p_game_key: string
          p_max_entries: number
          p_platform_key: string
          p_registration_closes_at?: string
          p_rules?: string
          p_starts_at?: string
          p_team_size: number
          p_title: string
        }
        Returns: string
      }
      arena_generate_bracket: {
        Args: { p_tournament_id: string }
        Returns: number
      }
      arena_register_solo: {
        Args: { p_display_name: string; p_tournament_id: string }
        Returns: string
      }
      arena_review_match_result: {
        Args: { p_decision: string; p_result_id: string }
        Returns: undefined
      }
      arena_submit_match_result: {
        Args: {
          p_evidence_path: string
          p_match_id: string
          p_notes?: string
          p_score_a: number
          p_score_b: number
        }
        Returns: string
      }
      arena_update_pubg_points: {
        Args: {
          p_eliminations: number
          p_entry_id: string
          p_match_id: string
          p_placement: number
        }
        Returns: undefined
      }
      bump_nexora_pillar_affinity: {
        Args: { p_delta: number; p_post_id: string }
        Returns: undefined
      }
      can_view_user_media_post: {
        Args: { target_post_id: string }
        Returns: boolean
      }
      cancel_creator_payout_request: {
        Args: { p_payout_id: string }
        Returns: Json
      }
      create_club: {
        Args: {
          p_blurb: string
          p_city: string
          p_kind: string
          p_name: string
          p_venue: string
          p_visibility: string
        }
        Returns: string
      }
      create_club_invitation: { Args: { p_club_id: string }; Returns: string }
      decline_follow_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      delete_academy_course: {
        Args: { p_confirmation_title: string; p_course_id: string }
        Returns: number
      }
      delete_direct_message: { Args: { p_message_id: string }; Returns: string }
      delete_group_message: { Args: { p_message_id: string }; Returns: string }
      edit_direct_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: string
      }
      edit_group_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: string
      }
      enroll_in_free_edu_course: {
        Args: { p_course_id: string }
        Returns: string
      }
      get_academy_community_feed: {
        Args: { p_limit?: number }
        Returns: {
          caption: string
          content_type: string
          created_at: string
          creator_avatar_url: string
          creator_handle: string
          creator_id: string
          creator_name: string
          id: string
          like_count: number
          media_storage_key: string
          media_storage_provider: string
          media_type: string
          media_url: string
          repost_count: number
          save_count: number
          share_count: number
          thumbnail_storage_key: string
          thumbnail_storage_provider: string
          thumbnail_url: string
          total_engagement: number
          view_count: number
        }[]
      }
      get_academy_educator: {
        Args: { p_educator_id: string }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          display_name: string
          education_skills: string[]
          handle: string
          id: string
          profile_category: string
        }[]
      }
      get_academy_educator_stats: {
        Args: { p_educator_id: string }
        Returns: {
          total_courses: number
          total_lessons: number
          total_students: number
        }[]
      }
      get_academy_public_resource_metadata: {
        Args: { p_educator_id?: string; p_resource_ids?: string[] }
        Returns: {
          access_tier: string
          course_id: string
          file_type: string
          id: string
          resource_name: string
        }[]
      }
      get_balanced_nexora_feed: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          aspect_ratio: string
          audience: string
          caption: string
          comment_count: number
          content_type: string
          created_at: string
          dominant_color: string
          duration_seconds: number
          feed_score: number
          focal_x: number
          focal_y: number
          framing_aspect_ratio: string
          id: string
          like_count: number
          media_storage_key: string
          media_storage_provider: string
          media_type: string
          media_url: string
          pillar: Database["public"]["Enums"]["content_pillar"]
          repost_count: number
          share_count: number
          tags: string[]
          thumbnail_storage_key: string
          thumbnail_storage_provider: string
          thumbnail_url: string
          user_id: string
          view_count: number
          zoom: number
        }[]
      }
      get_chat_disappearing_setting: {
        Args: { p_chat_id: string; p_chat_kind: string }
        Returns: {
          retention_seconds: number
          updated_at: string
        }[]
      }
      get_chat_location_share: {
        Args: { p_session_id: string }
        Returns: {
          accuracy_m: number
          expires_at: string
          id: string
          last_updated_at: string
          latitude: number
          longitude: number
          sender_id: string
          started_at: string
          status: string
          stopped_at: string
        }[]
      }
      get_chat_presence_status: {
        Args: { p_user_id: string }
        Returns: {
          last_seen: string
          show_last_seen: boolean
          show_online: boolean
        }[]
      }
      get_chat_recipient_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
        }[]
      }
      get_club_directory: {
        Args: never
        Returns: {
          active_member_count: number
          blurb: string
          city: string
          id: string
          kind: string
          latitude: number
          longitude: number
          my_role: string
          my_status: string
          name: string
          venue: string
          visibility: string
        }[]
      }
      get_club_unread_counts: {
        Args: never
        Returns: {
          club_id: string
          unread_count: number
        }[]
      }
      get_discoverable_profiles: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          account_type: string
          avatar_url: string
          display_name: string
          handle: string
          id: string
          private_profile: boolean
        }[]
      }
      get_group_message_sender_profile: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
        }[]
      }
      get_my_follow_requests: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          handle: string
          id: string
          requester_id: string
        }[]
      }
      get_my_liked_user_media_posts: { Args: never; Returns: string[] }
      get_my_reposted_user_media_posts: { Args: never; Returns: string[] }
      get_post_author_profiles: {
        Args: { target_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          id: string
        }[]
      }
      get_public_comment_profiles: {
        Args: { target_user_ids: string[] }
        Returns: {
          display_name: string
          handle: string
          id: string
        }[]
      }
      get_public_platform_settings: { Args: never; Returns: Json }
      get_public_profile: {
        Args: { p_handle: string }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          bio_links: Json
          display_name: string
          handle: string
          id: string
          private_profile: boolean
          profile_category: string
          settings: Json
        }[]
      }
      get_public_profile_by_id: {
        Args: { p_user_id: string }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          bio_links: Json
          display_name: string
          handle: string
          id: string
          private_profile: boolean
          profile_category: string
          settings: Json
        }[]
      }
      get_public_profiles: {
        Args: { profile_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          id: string
        }[]
      }
      increment_post_views: {
        Args: { target_post_id: string }
        Returns: number
      }
      increment_user_media_post_shares: {
        Args: { target_post_id: string }
        Returns: number
      }
      infer_nexora_content_pillar: {
        Args: { p_caption: string; p_content_type: string; p_tags: string[] }
        Returns: Database["public"]["Enums"]["content_pillar"]
      }
      is_active_creator_subscriber: {
        Args: { p_creator_id: string }
        Returns: boolean
      }
      is_arena_content_sync_authorized: {
        Args: { candidate: string }
        Returns: boolean
      }
      is_my_account_suspended: { Args: never; Returns: boolean }
      is_platform_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_platform_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      issue_edu_course_certificate: {
        Args: { p_course_id: string }
        Returns: {
          course_id: string
          course_title: string
          created_at: string
          id: string
          instructor_name: string
          issued_at: string
          learner_name: string
          student_id: string
          verification_code: string
        }[]
        SetofOptions: {
          from: "*"
          to: "edu_course_certificates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      like_user_media_post: {
        Args: { target_post_id: string }
        Returns: number
      }
      mark_club_channel_read: {
        Args: { p_club_id: string }
        Returns: undefined
      }
      mark_nexora_not_interested: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      my_is_platform_admin: { Args: never; Returns: boolean }
      process_creator_monetization_payment: {
        Args: {
          p_gateway_reference: string
          p_transaction_reference: string
          p_verified_amount_kes: number
        }
        Returns: Json
      }
      process_subscription_payment: {
        Args: {
          p_amount_kobo: number
          p_reference: string
          p_tier: string
          p_user_id: string
        }
        Returns: Json
      }
      recommended_posts: {
        Args: { result_limit?: number; viewer: string }
        Returns: {
          post_id: string
          score: number
        }[]
      }
      record_nexora_post_completion: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      repost_user_media_post: {
        Args: { target_post_id: string }
        Returns: number
      }
      request_creator_payout: {
        Args: {
          p_amount: number
          p_destination_id: string
          p_request_key: string
        }
        Returns: Json
      }
      request_or_follow_profile: {
        Args: { p_target_id: string }
        Returns: string
      }
      search_academy_educators: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_skill?: string
        }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          display_name: string
          education_skills: string[]
          handle: string
          id: string
          profile_category: string
        }[]
      }
      search_directory: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          id: string
        }[]
      }
      set_chat_disappearing_setting: {
        Args: {
          p_chat_id: string
          p_chat_kind: string
          p_retention_seconds: number
        }
        Returns: number
      }
      set_club_message_pin: {
        Args: { p_message_id: string; p_pinned: boolean }
        Returns: undefined
      }
      share_football_match_update: {
        Args: {
          p_club_id: string
          p_message: string
          p_provider: string
          p_provider_id: string
          p_score_signature: string
          p_sender_id: string
          p_team_provider_id: string
        }
        Returns: boolean
      }
      start_chat_location_share: {
        Args: {
          p_accuracy_m?: number
          p_chat_kind: string
          p_duration_minutes: number
          p_group_id: string
          p_latitude: number
          p_longitude: number
          p_recipient_id: string
        }
        Returns: string
      }
      stop_chat_location_share: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      unlike_user_media_post: {
        Args: { target_post_id: string }
        Returns: number
      }
      unrepost_user_media_post: {
        Args: { target_post_id: string }
        Returns: number
      }
      update_chat_location_share: {
        Args: {
          p_accuracy_m?: number
          p_latitude: number
          p_longitude: number
          p_session_id: string
        }
        Returns: string
      }
      verify_edu_course_certificate: {
        Args: { p_verification_code: string }
        Returns: {
          course_title: string
          instructor_name: string
          is_valid: boolean
          issued_at: string
          learner_name: string
          verification_code: string
        }[]
      }
      verify_sportscore_sync_secret: {
        Args: { p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      content_pillar: "comedy" | "education" | "football" | "gaming" | "hustle"
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
      content_pillar: ["comedy", "education", "football", "gaming", "hustle"],
    },
  },
} as const
