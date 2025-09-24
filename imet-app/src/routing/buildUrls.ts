// src/routing/buildUrls.ts
export type ChecklistMoment = 'arrival' | 'departure';

export function buildChecklistUrl(moment: ChecklistMoment): string {
  // URL relative (fonctionne en Codespaces et Prod)
  return `/care/checklists?moment=${encodeURIComponent(moment)}`;
}