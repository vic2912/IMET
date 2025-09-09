// src/pages/notices/defineNotice.ts
import type { ElementType } from 'react';

export type NoticeMeta = {
  /** Titre affiché dans le menu */
  title?: string;
  /** Chemin de la route. Si absent, on dérive du nom de fichier : /maison/<slug> */
  path?: string;
  /** Ordre d’affichage (petit en premier). Par défaut 100. */
  order?: number;
  /** Icône MUI optionnelle à afficher dans le menu */
  icon?: ElementType;
  /** Masquer du menu si true (toujours routable) */
  hidden?: boolean;
};

export function defineNotice(meta: NoticeMeta) {
  return meta;
}
