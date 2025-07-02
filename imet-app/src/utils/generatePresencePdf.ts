// utils/generatePresencePdf.ts

import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyPresence } from '../types/booking';

const MEAL_LABELS = {
  morning: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  nuit: 'Nuit'
};

export function generatePresencePdf(
  presenceMap: Record<string, DailyPresence>,
  fromDate: string,
  toDate: string
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  let y = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Récapitulatif des présences', 15, y);
  y += 10;

  const days = Object.values(presenceMap)
    .filter(p => p.date >= fromDate && p.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  days.forEach((day) => {
    const date = format(parseISO(day.date), "EEEE d MMMM yyyy", { locale: fr });

    const lines: string[] = [];
    lines.push(`📅 ${date}`);

    let dayHeight = 12;

    (['morning', 'lunch', 'dinner', 'nuit'] as const).forEach((slot) => {
      const people = day[slot];
      if (!people.length) return;

      const adults = people.filter(p => p.person_type?.startsWith('adulte')).length;
      const children = people.filter(p => p.person_type?.startsWith('enfant')).length;
      const names = people.map(p => p.name).join(', ');

      const line = `${MEAL_LABELS[slot]} — ${adults} adultes / ${children} enfants : ${names}`;
      const wrapped = doc.splitTextToSize(line, 250);

      lines.push(...wrapped);
      dayHeight += wrapped.length * 6 + 2;
    });

    dayHeight += 4;
    if (y + dayHeight > 190) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setDrawColor(180);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 260, 10, 'F');
    doc.text(date, 20, y + 7);
    y += 14;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    lines.slice(1).forEach((line: string) => {
      doc.text(line, 20, y);
      y += 6;
    });

    y += 4;
  }); // <- fin du forEach proprement fermée ici

  doc.save(`recap_presence_${fromDate}_to_${toDate}.pdf`);
}
