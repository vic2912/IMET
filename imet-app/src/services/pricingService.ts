// services/pricingService.ts
import { supabase } from "./supabase";

export interface PricingSetting {
  id: string;
  person_type: string;
  night_price: number;
  day_price: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

const TABLE_NAME = "pricing_settings";

const getAllPricing = async (): Promise<PricingSetting[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("person_type");

  if (error) throw error;
  return data as PricingSetting[];
};

const savePricing = async (pricing: PricingSetting) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      person_type: pricing.person_type,
      night_price: pricing.night_price,
      day_price: pricing.day_price,
      currency: pricing.currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pricing.id);

  if (error) throw error;
  return data;
};

const pricingService = {
  getAllPricing,
  savePricing,
};

export default pricingService;
