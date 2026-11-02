import { rest } from "@/lib/supabaseClient";

export interface PhotoSettings {
  price: number;
  aiPrice: number;
  aiBulkPrice: number;
  aiBulkMin: number;
  enabled: boolean;
}

export interface PhotoOrderRow {
  id: string;
  reference: string;
  email: string | null;
  quantity: number;
  ai_quantity: number;
  downloads_used: number;
  ai_used: number;
  amount: number;
  status: "pending" | "paid" | "failed";
  is_free: boolean;
  created_at: string;
  paid_at: string | null;
}

/** Super Admin: prices and sales of the paid photo editor (see STEP-C_paid_photo_editor.sql). */
export const PhotoSalesService = {
  getSettings(): Promise<PhotoSettings> {
    return rest.rpc<PhotoSettings>("get_photo_settings", {});
  },
  async setSettings(s: PhotoSettings): Promise<void> {
    await rest.rpc<void>("set_photo_settings", {
      p_price: s.price,
      p_ai_price: s.aiPrice,
      p_ai_bulk_price: s.aiBulkPrice,
      p_ai_bulk_min: s.aiBulkMin,
      p_enabled: s.enabled,
    });
  },
  listOrders(limit = 200): Promise<PhotoOrderRow[]> {
    return rest.rpc<PhotoOrderRow[]>("list_photo_orders", { p_limit: limit });
  },
};
