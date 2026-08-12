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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          description: string
          id: string
          priority_filer: string | null
          recommended_action: string | null
          severity: string
          symbol: string
          triggered_at: string
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          description: string
          id?: string
          priority_filer?: string | null
          recommended_action?: string | null
          severity?: string
          symbol: string
          triggered_at?: string
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          description?: string
          id?: string
          priority_filer?: string | null
          recommended_action?: string | null
          severity?: string
          symbol?: string
          triggered_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          id: string
          job_name: string
          notes: string | null
          ok: boolean
          ran_at: string
          rows: number | null
        }
        Insert: {
          id?: string
          job_name: string
          notes?: string | null
          ok: boolean
          ran_at?: string
          rows?: number | null
        }
        Update: {
          id?: string
          job_name?: string
          notes?: string | null
          ok?: boolean
          ran_at?: string
          rows?: number | null
        }
        Relationships: []
      }
      earnings_calendar: {
        Row: {
          hour: string | null
          next_earnings_date: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          hour?: string | null
          next_earnings_date?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          hour?: string | null
          next_earnings_date?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      insider_activity: {
        Row: {
          accession_number: string
          created_at: string
          filer_name: string
          filer_title: string | null
          filing_date: string
          filing_url: string
          form_type: string
          id: string
          price_per_share: number | null
          shares: number | null
          shares_owned_after: number | null
          ticker: string
          total_value: number | null
          transaction_code: string | null
          transaction_date: string | null
        }
        Insert: {
          accession_number: string
          created_at?: string
          filer_name: string
          filer_title?: string | null
          filing_date: string
          filing_url: string
          form_type: string
          id: string
          price_per_share?: number | null
          shares?: number | null
          shares_owned_after?: number | null
          ticker: string
          total_value?: number | null
          transaction_code?: string | null
          transaction_date?: string | null
        }
        Update: {
          accession_number?: string
          created_at?: string
          filer_name?: string
          filer_title?: string | null
          filing_date?: string
          filing_url?: string
          form_type?: string
          id?: string
          price_per_share?: number | null
          shares?: number | null
          shares_owned_after?: number | null
          ticker?: string
          total_value?: number | null
          transaction_code?: string | null
          transaction_date?: string | null
        }
        Relationships: []
      }
      option_iv_history: {
        Row: {
          id: number
          iv: number
          recorded_at: string
          ticker: string
        }
        Insert: {
          id?: never
          iv: number
          recorded_at?: string
          ticker: string
        }
        Update: {
          id?: never
          iv?: number
          recorded_at?: string
          ticker?: string
        }
        Relationships: []
      }
      option_tracked_picks: {
        Row: {
          entry_price: number
          id: string
          notes: string | null
          picked_at: string
          portfolio_name: string | null
          quantity: number
          row: Json
        }
        Insert: {
          entry_price: number
          id: string
          notes?: string | null
          picked_at?: string
          portfolio_name?: string | null
          quantity?: number
          row: Json
        }
        Update: {
          entry_price?: number
          id?: string
          notes?: string | null
          picked_at?: string
          portfolio_name?: string | null
          quantity?: number
          row?: Json
        }
        Relationships: []
      }
      options_scan_cache: {
        Row: {
          id: boolean
          payload: Json
          scanned_at: string
        }
        Insert: {
          id?: boolean
          payload: Json
          scanned_at?: string
        }
        Update: {
          id?: boolean
          payload?: Json
          scanned_at?: string
        }
        Relationships: []
      }
      portfolio: {
        Row: {
          bought_at: string
          buy_price: number
          id: string
          notes: string | null
          portfolio_color: string | null
          portfolio_name: string
          portfolio_type: string
          quantity: number
          symbol: string
          user_id: string
        }
        Insert: {
          bought_at?: string
          buy_price: number
          id?: string
          notes?: string | null
          portfolio_color?: string | null
          portfolio_name?: string
          portfolio_type?: string
          quantity?: number
          symbol: string
          user_id: string
        }
        Update: {
          bought_at?: string
          buy_price?: number
          id?: string
          notes?: string | null
          portfolio_color?: string | null
          portfolio_name?: string
          portfolio_type?: string
          quantity?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          captured_at: string
          id: string
          pnl_pct: number
          portfolio_name: string
          portfolio_type: string
          total_invested: number
          total_value: number
          user_id: string
        }
        Insert: {
          captured_at?: string
          id?: string
          pnl_pct: number
          portfolio_name: string
          portfolio_type: string
          total_invested: number
          total_value: number
          user_id: string
        }
        Update: {
          captured_at?: string
          id?: string
          pnl_pct?: number
          portfolio_name?: string
          portfolio_type?: string
          total_invested?: number
          total_value?: number
          user_id?: string
        }
        Relationships: []
      }
      signal_log: {
        Row: {
          confidence: string
          cp: string | null
          entry_price: number
          fired_at: string
          id: string
          kind: string
          score: number
          stop_price: number
          target_price: number
          ticker: string
        }
        Insert: {
          confidence?: string
          cp?: string | null
          entry_price: number
          fired_at?: string
          id?: string
          kind: string
          score?: number
          stop_price: number
          target_price: number
          ticker: string
        }
        Update: {
          confidence?: string
          cp?: string | null
          entry_price?: number
          fired_at?: string
          id?: string
          kind?: string
          score?: number
          stop_price?: number
          target_price?: number
          ticker?: string
        }
        Relationships: []
      }
      signal_outcomes: {
        Row: {
          closed_at: string | null
          id: string
          signal_id: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          id?: string
          signal_id: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          id?: string
          signal_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_outcomes_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signal_log"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_cache: {
        Row: {
          bollinger_pct_b: number | null
          category: string
          change: number
          change_percent: number
          ema9: number
          entry: number
          exit_price: number
          fetched_at: string
          hold_duration: string | null
          macd: number
          name: string
          pattern: string | null
          pattern_confidence: number | null
          prev_close: number
          price: number
          rsi: number
          signal: string
          sma20: number
          symbol: string
          volume: number
        }
        Insert: {
          bollinger_pct_b?: number | null
          category?: string
          change?: number
          change_percent?: number
          ema9?: number
          entry?: number
          exit_price?: number
          fetched_at?: string
          hold_duration?: string | null
          macd?: number
          name: string
          pattern?: string | null
          pattern_confidence?: number | null
          prev_close?: number
          price: number
          rsi?: number
          signal?: string
          sma20?: number
          symbol: string
          volume?: number
        }
        Update: {
          bollinger_pct_b?: number | null
          category?: string
          change?: number
          change_percent?: number
          ema9?: number
          entry?: number
          exit_price?: number
          fetched_at?: string
          hold_duration?: string | null
          macd?: number
          name?: string
          pattern?: string | null
          pattern_confidence?: number | null
          prev_close?: number
          price?: number
          rsi?: number
          signal?: string
          sma20?: number
          symbol?: string
          volume?: number
        }
        Relationships: []
      }
      stock_fundamentals: {
        Row: {
          analyst_buy_pct: number | null
          avg_eps_surprise_pct: number | null
          balance_sheet_score: number
          current_ratio: number | null
          debt_to_equity: number | null
          dividend_yield: number | null
          eps_growth_yoy: number | null
          eps_surprise_history: Json | null
          growth_score: number
          market_cap: number | null
          name: string
          net_margin: number | null
          payout_ratio: number | null
          pb_ratio: number | null
          pe_ratio: number | null
          price: number
          ps_ratio: number | null
          revenue_growth_yoy: number | null
          sector: string | null
          symbol: string
          updated_at: string
          week52_high: number | null
          week52_low: number | null
        }
        Insert: {
          analyst_buy_pct?: number | null
          avg_eps_surprise_pct?: number | null
          balance_sheet_score: number
          current_ratio?: number | null
          debt_to_equity?: number | null
          dividend_yield?: number | null
          eps_growth_yoy?: number | null
          eps_surprise_history?: Json | null
          growth_score: number
          market_cap?: number | null
          name: string
          net_margin?: number | null
          payout_ratio?: number | null
          pb_ratio?: number | null
          pe_ratio?: number | null
          price: number
          ps_ratio?: number | null
          revenue_growth_yoy?: number | null
          sector?: string | null
          symbol: string
          updated_at?: string
          week52_high?: number | null
          week52_low?: number | null
        }
        Update: {
          analyst_buy_pct?: number | null
          avg_eps_surprise_pct?: number | null
          balance_sheet_score?: number
          current_ratio?: number | null
          debt_to_equity?: number | null
          dividend_yield?: number | null
          eps_growth_yoy?: number | null
          eps_surprise_history?: Json | null
          growth_score?: number
          market_cap?: number | null
          name?: string
          net_margin?: number | null
          payout_ratio?: number | null
          pb_ratio?: number | null
          pe_ratio?: number | null
          price?: number
          ps_ratio?: number | null
          revenue_growth_yoy?: number | null
          sector?: string | null
          symbol?: string
          updated_at?: string
          week52_high?: number | null
          week52_low?: number | null
        }
        Relationships: []
      }
      stock_price_history: {
        Row: {
          id: number
          price: number
          recorded_at: string
          symbol: string
        }
        Insert: {
          id?: never
          price: number
          recorded_at?: string
          symbol: string
        }
        Update: {
          id?: never
          price?: number
          recorded_at?: string
          symbol?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      wsb_mentions: {
        Row: {
          mention_count: number
          name: string
          sample_titles: Json | null
          scanned_at: string
          ticker: string
        }
        Insert: {
          mention_count?: number
          name: string
          sample_titles?: Json | null
          scanned_at?: string
          ticker: string
        }
        Update: {
          mention_count?: number
          name?: string
          sample_titles?: Json | null
          scanned_at?: string
          ticker?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
