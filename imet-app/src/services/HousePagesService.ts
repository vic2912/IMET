import { supabase } from './supabase';
import type { HousePage, HouseImage } from '../types/house';

const BUCKET = 'house-pages';

export function publicUrl(path?: string | null) {
  if (!path) return undefined;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listPublished(params?: { category?: string | null }) {
  let q = supabase.from('house_pages').select('*').eq('is_published', true).order('title', { ascending: true });
  if (params?.category) q = q.eq('category', params.category);
  const { data, error } = await q;
  if (error) throw error;
  return data as HousePage[];
}

export async function getBySlug(slug: string) {
  const { data, error } = await supabase.from('house_pages').select('*').eq('slug', slug).single();
  if (error) throw error;
  return data as HousePage;
}

/* ===== Admin ===== */
export async function adminListAll() {
  const { data, error } = await supabase.from('house_pages').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data as HousePage[];
}

export async function adminCreate(input: Partial<HousePage>) {
  const { data, error } = await supabase.from('house_pages').insert(input).select().single();
  if (error) throw error;
  return data as HousePage;
}

export async function adminUpdate(id: string, patch: Partial<HousePage>) {
  const { data, error } = await supabase.from('house_pages').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as HousePage;
}

export async function adminDelete(id: string) {
  const { error } = await supabase.from('house_pages').delete().eq('id', id);
  if (error) throw error;
}

/* ===== Upload ===== */
function extFromMime(m: string) {
  if (m === 'image/webp') return 'webp';
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  return 'jpg';
}

export async function uploadCover(pageId: string, file: File) {
  const ext = extFromMime(file.type);
  const path = `${pageId}/cover_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function uploadGalleryImage(pageId: string, file: File) {
  const ext = extFromMime(file.type);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${pageId}/gallery/${Date.now()}_${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function saveGallery(id: string, gallery: HouseImage[]) {
  return adminUpdate(id, { gallery });
}
