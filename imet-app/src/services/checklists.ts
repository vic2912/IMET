// src/services/checklists.ts

import { supabase } from './supabase';
import type { BookingChecklistItem, BookingChecklistProgress, ChecklistStatus } from '../types/checkLists';

export async function ensureChecklistProjection(bookingId: string): Promise<void> {
  // Appelle la RPC si elle existe
  const { error } = await (supabase as any).rpc('ensure_checklist_projection', { p_booking_id: bookingId });
  if (error) {
    console.warn('ensure_checklist_projection RPC missing, continuing without it.', error.message);
  }
}

export async function listBookingChecklistItems(bookingId: string): Promise<BookingChecklistItem[]> {
  const { data, error } = await (supabase as any)
    .from('booking_checklist_items')
    .select('*')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as unknown as BookingChecklistItem[]) ?? [];
}

export async function getChecklistProgress(bookingId: string): Promise<BookingChecklistProgress | null> {
  const { data, error } = await (supabase as any)
    .from('booking_checklist_progress')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as unknown as BookingChecklistProgress) ?? null;
}

export async function updateChecklistStatus(itemId: string, status: ChecklistStatus): Promise<void> {
  const { error } = await (supabase as any)
    .from('booking_checklist_items')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
}

export async function updateChecklistNotes(itemId: string, notes: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('booking_checklist_items')
    .update({ notes })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
}

// upload photo dans le bucket "checklists"
export async function uploadChecklistPhoto(itemId: string, file: File): Promise<string> {
  const path = `${itemId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabase.storage.from('checklists').upload(path, file);
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage.from('checklists').getPublicUrl(path);
  const publicUrl = pub?.publicUrl ?? '';

  const { error: updErr } = await (supabase as any)
    .from('booking_checklist_items')
    .update({ photo_url: publicUrl })
    .eq('id', itemId);

  if (updErr) throw new Error(updErr.message);
  return publicUrl;
}
