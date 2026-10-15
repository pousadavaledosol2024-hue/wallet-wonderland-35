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
      availability_blocks: {
        Row: {
          check_in: string
          check_out: string
          id: string
          reservation_id: string
          room_id: string
        }
        Insert: {
          check_in: string
          check_out: string
          id?: string
          reservation_id: string
          room_id: string
        }
        Update: {
          check_in?: string
          check_out?: string
          id?: string
          reservation_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string
          description: string | null
          id: string
          movement_type: string
          order_id: string | null
          payment_method: string | null
          user_id: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          created_at?: string
          description?: string | null
          id?: string
          movement_type: string
          order_id?: string | null
          payment_method?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string
          description?: string | null
          id?: string
          movement_type?: string
          order_id?: string | null
          payment_method?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          created_at: string
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          min_stock: number
          name: string
          stock_quantity: number
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          stock_quantity?: number
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          stock_quantity?: number
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total: number | null
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total?: number | null
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number | null
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cash_register_id: string | null
          closed_at: string | null
          created_at: string
          customer_name: string | null
          discount: number
          id: string
          number: number
          opened_at: string
          payment_method: string | null
          reservation_id: string | null
          status: string
          subtotal: number
          table_label: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_register_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          discount?: number
          id?: string
          number?: number
          opened_at?: string
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          subtotal?: number
          table_label?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_register_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          discount?: number
          id?: string
          number?: number
          opened_at?: string
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          subtotal?: number
          table_label?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          name: string
          on_menu: boolean
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          on_menu?: boolean
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          on_menu?: boolean
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          guest_document: string | null
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          guests_count: number
          id: string
          notes: string | null
          paid_amount: number
          room_id: string
          source: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          guest_document?: string | null
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          room_id: string
          source?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          guest_document?: string | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          guests_count?: number
          id?: string
          notes?: string | null
          paid_amount?: number
          room_id?: string
          source?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          daily_rate: number
          id: string
          name: string
          notes: string | null
          room_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          daily_rate?: number
          id?: string
          name: string
          notes?: string | null
          room_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          daily_rate?: number
          id?: string
          name?: string
          notes?: string | null
          room_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          movement_type: string
          order_id: string | null
          quantity: number
          reason: string | null
          unit_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          movement_type: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          unit_cost?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          movement_type?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          unit_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          business_unit: string
          cash_register_id: string | null
          category: string
          created_at: string
          description: string
          due_date: string
          id: string
          order_id: string | null
          payment_method: string | null
          reservation_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          business_unit?: string
          cash_register_id?: string | null
          category: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          order_id?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          business_unit?: string
          cash_register_id?: string | null
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          order_id?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cash_register_summary: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          entradas: number | null
          id: string | null
          opened_at: string | null
          opening_amount: number | null
          saidas: number | null
          saldo_esperado: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      low_stock_alerts: {
        Row: {
          id: string | null
          min_stock: number | null
          name: string | null
          shortage: number | null
          stock_quantity: number | null
          unit: string | null
          user_id: string | null
        }
        Insert: {
          id?: string | null
          min_stock?: number | null
          name?: string | null
          shortage?: never
          stock_quantity?: number | null
          unit?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string | null
          min_stock?: number | null
          name?: string | null
          shortage?: never
          stock_quantity?: number | null
          unit?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monthly_cash_flow: {
        Row: {
          a_pagar: number | null
          a_receber: number | null
          business_unit: string | null
          despesas: number | null
          mes: string | null
          receitas: number | null
          saldo: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
