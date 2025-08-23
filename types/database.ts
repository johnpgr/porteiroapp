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
          name: string;
          email: string;
          phone: string | null;
          user_type: string | null;
          building_id: string | null;
          cpf: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          phone?: string | null;
          user_type?: string | null;
          building_id?: string | null;
          cpf?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          user_type?: string | null;
          building_id?: string | null;
          cpf?: string | null;
          photo_url?: string | null;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          document?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          document?: string | null;
          phone?: string | null;
          photo_url?: string | null;
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
