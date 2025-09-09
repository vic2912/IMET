// src/types/checklists.ts
export type ChecklistType = 'checkin' | 'checkout' | 'both';
export type Season = 'all' | 'winter' | 'spring' | 'summer' | 'autumn';
export type ChecklistStatus = 'pending' | 'done' | 'na';

export interface ChecklistTemplate {
  id: string;
  name: string;
  type: ChecklistType;
  season: Season;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  label: string;
  required: boolean;
  sort_order: number;
  meta: Record<string, unknown>;
}

export interface BookingChecklistItem {
  id: string;
  booking_id: string;
  template_id: string;
  template_item_id: string;
  status: ChecklistStatus;
  notes: string | null;
  photo_url: string | null;
  completed_by: string | null;
  completed_at: string | null;
  snapshot_label: string;
  snapshot_type: ChecklistType;
  snapshot_season: Season;
  snapshot_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BookingChecklistProgress {
  booking_id: string;
  total_items: number;
  done_items: number;
  pending_items: number;
  na_items: number;
  all_mandatory_done: boolean;
}

export type CheckMoment = 'arrival' | 'departure';

export interface Condiment {
  id: string;
  name: string;
  unit: string;            // "g","ml","unit"
  perishable: boolean;
  min_threshold: string;   // numeric en string
  active: boolean;
  sort_order: number;
  meta: Record<string, unknown>;
}

export interface BookingCondimentCheck {
  id: string;
  booking_id: string;
  condiment_id: string;
  moment: CheckMoment;           // arrival|departure
  is_present: boolean | null;
  measured_quantity: string | null;
  missing_flag: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
