export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          phone: string | null;
          role: string;
          admin_type: string | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          phone?: string | null;
          role: string;
          admin_type?: string | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          role?: string;
          admin_type?: string | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      super_admin_profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          admin_type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          admin_type?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          admin_type?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      buildings: {
        Row: {
          id: string;
          name: string;
          address: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      building_admins: {
        Row: {
          id: string;
          building_id: string;
          admin_profile_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          admin_profile_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          admin_profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'building_admins_admin_profile_id_fkey';
            columns: ['admin_profile_id'];
            isOneToOne: false;
            referencedRelation: 'admin_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'building_admins_building_id_fkey';
            columns: ['building_id'];
            isOneToOne: false;
            referencedRelation: 'buildings';
            referencedColumns: ['id'];
          },
        ];
      };
      apartments: {
        Row: {
          id: string;
          building_id: string;
          number: string;
          floor: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          number: string;
          floor?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          number?: string;
          floor?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'apartments_building_id_fkey';
            columns: ['building_id'];
            isOneToOne: false;
            referencedRelation: 'buildings';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          cpf: string | null;
          work_schedule: string | null;
          address: string | null;
          birth_date: string | null;
          building_id: string | null;
          role: string | null;
          user_type: string | null;
          relation: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          registration_token: string | null;
          token_expires_at: string | null;
          profile_complete: boolean | null;
          temporary_password_used: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          cpf?: string | null;
          work_schedule?: string | null;
          address?: string | null;
          birth_date?: string | null;
          building_id?: string | null;
          role?: string | null;
          user_type?: string | null;
          relation?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          registration_token?: string | null;
          token_expires_at?: string | null;
          profile_complete?: boolean | null;
          temporary_password_used?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
          cpf?: string | null;
          work_schedule?: string | null;
          address?: string | null;
          birth_date?: string | null;
          building_id?: string | null;
          role?: string | null;
          user_type?: string | null;
          relation?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          registration_token?: string | null;
          token_expires_at?: string | null;
          profile_complete?: boolean | null;
          temporary_password_used?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_building_id_fkey';
            columns: ['building_id'];
            isOneToOne: false;
            referencedRelation: 'buildings';
            referencedColumns: ['id'];
          },
        ];
      };
      visitors: {
        Row: {
          id: string;
          name: string;
          document: string | null;
          phone: string | null;
          photo_url: string | null;
          apartment_id: string | null;
          visitor_type: 'comum' | 'frequente' | null;
          status: 'negado' | 'aprovado' | 'pendente' | null;
          is_active: boolean | null;
          visit_type: 'pontual' | 'frequente' | null;
          visit_date: string | null;
          visit_start_time: string | null;
          visit_end_time: string | null;
          allowed_days: string[] | null;
          max_simultaneous_visits: number | null;
          is_recurring: boolean | null;
          registration_token: string | null;
          token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          document?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          apartment_id?: string | null;
          visitor_type?: 'comum' | 'frequente' | null;
          status?: 'negado' | 'aprovado' | 'pendente' | null;
          is_active?: boolean | null;
          visit_type?: 'pontual' | 'frequente' | null;
          visit_date?: string | null;
          visit_start_time?: string | null;
          visit_end_time?: string | null;
          allowed_days?: string[] | null;
          max_simultaneous_visits?: number | null;
          is_recurring?: boolean | null;
          registration_token?: string | null;
          token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          document?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          apartment_id?: string | null;
          visitor_type?: 'comum' | 'frequente' | null;
          status?: 'negado' | 'aprovado' | 'pendente' | null;
          is_active?: boolean | null;
          visit_type?: 'pontual' | 'frequente' | null;
          visit_date?: string | null;
          visit_start_time?: string | null;
          visit_end_time?: string | null;
          allowed_days?: string[] | null;
          max_simultaneous_visits?: number | null;
          is_recurring?: boolean | null;
          registration_token?: string | null;
          token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registration_tokens: {
        Row: {
          id: string;
          token: string;
          token_type: 'user_registration' | 'visitor_registration' | 'visit_approval';
          entity_id: string;
          entity_type: 'profile' | 'visitor' | 'visit';
          expires_at: string;
          used_at: string | null;
          is_used: boolean;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          token_type: 'user_registration' | 'visitor_registration' | 'visit_approval';
          entity_id: string;
          entity_type: 'profile' | 'visitor' | 'visit';
          expires_at: string;
          used_at?: string | null;
          is_used?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          token_type?: 'user_registration' | 'visitor_registration' | 'visit_approval';
          entity_id?: string;
          entity_type?: 'profile' | 'visitor' | 'visit';
          expires_at?: string;
          used_at?: string | null;
          is_used?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      visitor_logs: {
        Row: {
          id: string;
          visitor_id: string;
          apartment_id: string;
          building_id: string;
          log_time: string;
          tipo_log: 'IN' | 'OUT';
          visit_session_id: string;
          purpose?: string | null;
          authorized_by?: string | null;
          status?: string | null;
          vehicle_info?: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visitor_id: string;
          apartment_id: string;
          building_id: string;
          log_time?: string;
          tipo_log: 'IN' | 'OUT';
          visit_session_id: string;
          purpose?: string | null;
          authorized_by?: string | null;
          status?: string | null;
          vehicle_info?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visitor_id?: string;
          apartment_id?: string;
          building_id?: string;
          log_time?: string;
          tipo_log?: 'IN' | 'OUT';
          visit_session_id?: string;
          purpose?: string | null;
          authorized_by?: string | null;
          status?: string | null;
          vehicle_info?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visitor_logs_apartment_id_fkey';
            columns: ['apartment_id'];
            isOneToOne: false;
            referencedRelation: 'apartments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visitor_logs_visitor_id_fkey';
            columns: ['visitor_id'];
            isOneToOne: false;
            referencedRelation: 'visitors';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicles: {
        Row: {
          id: string;
          license_plate: string;
          model: string | null;
          color: string | null;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          license_plate: string;
          model?: string | null;
          color?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          license_plate?: string;
          model?: string | null;
          color?: string | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      deliveries: {
        Row: {
          id: string;
          apartment_id: string;
          recipient_name: string;
          delivery_company: string | null;
          tracking_number: string | null;
          status: string;
          received_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          apartment_id: string;
          recipient_name: string;
          delivery_company?: string | null;
          tracking_number?: string | null;
          status: string;
          received_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          apartment_id?: string;
          recipient_name?: string;
          delivery_company?: string | null;
          tracking_number?: string | null;
          status?: string;
          received_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'deliveries_apartment_id_fkey';
            columns: ['apartment_id'];
            isOneToOne: false;
            referencedRelation: 'apartments';
            referencedColumns: ['id'];
          },
        ];
      };
      communications: {
        Row: {
          building_id: string;
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          priority: string | null;
          title: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          building_id: string;
          content: string;
          created_at?: string;
          created_by: string;
          id?: string;
          priority?: string | null;
          title: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          building_id?: string;
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          priority?: string | null;
          title?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'communications_building_id_fkey';
            columns: ['building_id'];
            isOneToOne: false;
            referencedRelation: 'buildings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'communications_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'admin_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      temporary_passwords: {
        Row: {
          id: string;
          profile_id: string;
          password_hash: string;
          plain_password: string;
          used: boolean | null;
          created_at: string | null;
          used_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          password_hash: string;
          plain_password: string;
          used?: boolean | null;
          created_at?: string | null;
          used_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          password_hash?: string;
          plain_password?: string;
          used?: boolean | null;
          created_at?: string | null;
          used_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'temporary_passwords_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      apartment_residents: {
        Row: {
          id: string;
          apartment_id: string;
          profile_id: string;
          relationship: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          apartment_id: string;
          profile_id: string;
          relationship: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          apartment_id?: string;
          profile_id?: string;
          relationship?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'apartment_residents_apartment_id_fkey';
            columns: ['apartment_id'];
            isOneToOne: false;
            referencedRelation: 'apartments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'apartment_residents_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<
  PublicTableNameOrOptions extends keyof Database['public']['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Row: infer R;
      }
    ? R
    : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database['public']['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
    ? I
    : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database['public']['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
    ? U
    : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof Database['public']['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
    ? Database['public']['Enums'][PublicEnumNameOrOptions]
    : never;