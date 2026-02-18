import { supabase } from "@/integrations/supabase/client";
export { supabase };

export type Report = {
  id: string;
  created_at: string;
  reg_number: string;
  masked_reg: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  media_url: string | null;
  is_public: boolean;
  approved: boolean;
  device_metadata: Record<string, unknown> | null;
};

export function maskRegNumber(reg: string): string {
  if (reg.length <= 4) return reg;
  const start = reg.slice(0, 2);
  const end = reg.slice(-2);
  return `${start}***${end}`;
}
