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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          shop_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          shop_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          shop_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      backups: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          shop_id: string | null
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          shop_id?: string | null
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          shop_id?: string | null
          size_bytes?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string
          id: string
          phone: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name: string
          id?: string
          phone: string
          shop_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          id?: string
          phone?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          resolved: boolean
          shop_id: string | null
          source: string
          stack: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          shop_id?: string | null
          source: string
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          shop_id?: string | null
          source?: string
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expense_date: string
          id: string
          note: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date?: string
          id?: string
          note?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date?: string
          id?: string
          note?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          amount: number
          due_date: string | null
          id: string
          installment_plan_id: string | null
          paid_date: string | null
          shop_id: string
          status: Database["public"]["Enums"]["installment_status"]
        }
        Insert: {
          amount: number
          due_date?: string | null
          id?: string
          installment_plan_id?: string | null
          paid_date?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Update: {
          amount?: number
          due_date?: string | null
          id?: string
          installment_plan_id?: string | null
          paid_date?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          balance: number | null
          created_at: string
          id: string
          paid_amount: number
          sale_id: string | null
          shop_id: string
          total_amount: number
        }
        Insert: {
          balance?: number | null
          created_at?: string
          id?: string
          paid_amount?: number
          sale_id?: string | null
          shop_id: string
          total_amount: number
        }
        Update: {
          balance?: number | null
          created_at?: string
          id?: string
          paid_amount?: number
          sale_id?: string | null
          shop_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: string | null
          buy_price: number
          condition: Database["public"]["Enums"]["item_condition"] | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          imei: string | null
          item_type: Database["public"]["Enums"]["item_type"]
          low_stock_threshold: number
          model: string | null
          name: string | null
          quantity: number
          sell_price: number
          shop_id: string
        }
        Insert: {
          brand?: string | null
          buy_price?: number
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          imei?: string | null
          item_type?: Database["public"]["Enums"]["item_type"]
          low_stock_threshold?: number
          model?: string | null
          name?: string | null
          quantity?: number
          sell_price?: number
          shop_id: string
        }
        Update: {
          brand?: string | null
          buy_price?: number
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          imei?: string | null
          item_type?: Database["public"]["Enums"]["item_type"]
          low_stock_threshold?: number
          model?: string | null
          name?: string | null
          quantity?: number
          sell_price?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      repairs: {
        Row: {
          completed_date: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          device_description: string
          id: string
          issue_description: string | null
          received_date: string
          repair_cost: number
          shop_id: string
          status: Database["public"]["Enums"]["repair_status"]
        }
        Insert: {
          completed_date?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_description: string
          id?: string
          issue_description?: string | null
          received_date?: string
          repair_cost?: number
          shop_id: string
          status?: Database["public"]["Enums"]["repair_status"]
        }
        Update: {
          completed_date?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_description?: string
          id?: string
          issue_description?: string | null
          received_date?: string
          repair_cost?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["repair_status"]
        }
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          buy_price_snapshot: number
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          discount: number
          id: string
          inventory_item_id: string | null
          payment_type: Database["public"]["Enums"]["sale_payment_type"]
          profit: number | null
          quantity: number
          sale_date: string
          sell_price: number
          shop_id: string
          sold_by: string | null
        }
        Insert: {
          buy_price_snapshot?: number
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number
          id?: string
          inventory_item_id?: string | null
          payment_type?: Database["public"]["Enums"]["sale_payment_type"]
          profit?: number | null
          quantity?: number
          sale_date?: string
          sell_price: number
          shop_id: string
          sold_by?: string | null
        }
        Update: {
          buy_price_snapshot?: number
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount?: number
          id?: string
          inventory_item_id?: string | null
          payment_type?: Database["public"]["Enums"]["sale_payment_type"]
          profit?: number | null
          quantity?: number
          sale_date?: string
          sell_price?: number
          shop_id?: string
          sold_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          end_date: string
          id: string
          period_months: number
          sale_id: string | null
          shop_id: string
          start_date: string
          status: Database["public"]["Enums"]["warranty_status"]
        }
        Insert: {
          end_date: string
          id?: string
          period_months?: number
          sale_id?: string | null
          shop_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["warranty_status"]
        }
        Update: {
          end_date?: string
          id?: string
          period_months?: number
          sale_id?: string | null
          shop_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["warranty_status"]
        }
        Relationships: [
          {
            foreignKeyName: "warranties_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          claim_date: string
          id: string
          issue_description: string | null
          resolution: string | null
          shop_id: string
          warranty_id: string | null
        }
        Insert: {
          claim_date?: string
          id?: string
          issue_description?: string | null
          resolution?: string | null
          shop_id: string
          warranty_id?: string | null
        }
        Update: {
          claim_date?: string
          id?: string
          issue_description?: string | null
          resolution?: string | null
          shop_id?: string
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_shop_id: { Args: { _uid?: string }; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _uid?: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid?: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "shop_admin"
        | "cashier"
        | "salesperson"
        | "technician"
      expense_category: "rent" | "electricity" | "salaries" | "other"
      installment_status: "pending" | "paid" | "overdue"
      item_condition: "new" | "used"
      item_type: "phone" | "accessory"
      repair_status: "received" | "in_progress" | "completed"
      sale_payment_type: "cash" | "installment"
      warranty_status: "active" | "expired" | "claimed"
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
      app_role: [
        "super_admin",
        "shop_admin",
        "cashier",
        "salesperson",
        "technician",
      ],
      expense_category: ["rent", "electricity", "salaries", "other"],
      installment_status: ["pending", "paid", "overdue"],
      item_condition: ["new", "used"],
      item_type: ["phone", "accessory"],
      repair_status: ["received", "in_progress", "completed"],
      sale_payment_type: ["cash", "installment"],
      warranty_status: ["active", "expired", "claimed"],
    },
  },
} as const
