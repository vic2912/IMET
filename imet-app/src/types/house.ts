export type HouseImage = { path: string; text?: string | null };

export type HousePage = {
  id: string;
  slug: string;
  title: string;
  short_description?: string | null;
  category?: string | null;
  content_md: string;
  cover_image_path?: string | null;
  gallery: HouseImage[];
  is_published: boolean;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
};
