// src/pages/notices/autoNotices.ts
import type { FC, ElementType } from 'react';
import type { NoticeMeta } from './defineNotice';

function fileToTitle(file: string) {
  // ex: './LeComposte.tsx' -> 'Le compost'
  const base = file.split('/').pop()!.replace(/\.tsx$/, '');
  const spaced = base.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
function fileToSlug(file: string) {
  const base = file.split('/').pop()!.replace(/\.tsx$/, '');
  return base.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
}

type NoticeEntry = {
  path: string;
  title: string;
  order: number;
  Icon?: ElementType;
  Component: FC;
  hidden?: boolean;
};

const modules = import.meta.glob('./*.tsx', { eager: true }) as Record<string, any>;

export const NOTICES: NoticeEntry[] = Object.entries(modules)
  .map(([file, mod]) => {
    const meta: NoticeMeta = (mod.notice ?? {}) as NoticeMeta;
    const Component = (mod.default ?? (() => null)) as FC;
    const title = meta.title ?? fileToTitle(file);
    const path = meta.path ?? `/maison/${fileToSlug(file)}`;
    const order = meta.order ?? 100;
    const Icon = meta.icon;
    const hidden = !!meta.hidden;
    return { path, title, order, Icon, Component, hidden };
  })
  .sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title, 'fr'));
