// src/layout/familyLayout.ts
export type ID = string;

export type Person = {
  id: ID;
  full_name: string | null;
};

export type Relation = {
  user_id: ID;
  related_user_id: ID;
  relationship_type: 'parent' | 'child' | 'spouse';
};

export const CARD_W = 240;
export const CARD_H = 96;
export const COUPLE_GAP = 16;
export const SIBLING_GAP = 32;
export const BLOCK_GAP = 40;
export const ROW_H = 180;
export const MARGIN = 48;

export type CellKind = 'single' | 'couple';

export interface Cell {
  id: ID;                // 'person:<id>' ou 'couple:<a>-<b>'
  kind: CellKind;
  members: ID[];         // [a] ou [a,b]
  parentId?: ID | null;  // parent cell id
  childIds: ID[];        // ids de cellules enfants (cell ids)

  // Mesures & positions
  PRV: number;           // génération
  PRH: number;           // rang dans la génération
  TC: number;            // taille (CARD_W ou 2*CARD_W + COUPLE_GAP)
  PH: number;            // ancre horizontale (centre)
  PV: number;            // top vertical
  PNMin: number;         // borne gauche absolue du sous-arbre
  PNMax: number;         // borne droite absolue du sous-arbre
}

type BuildInput = {
  activeUserId: ID;
  peopleById: Map<ID, Person>;
  relations: Relation[]; // parent/child/spouse
};

export function buildCells({ activeUserId, peopleById, relations }: BuildInput) {
  const normalizeName = (s?: string | null) => (s ?? '').trim().toLowerCase();

  // 1) parent choisi: enfant -> 1 parent (garde-fou)
  const chosenParentOfChild = new Map<ID, ID>();
  const parentToChildren = new Map<ID, Set<ID>>();
  function addChild(p: ID, c: ID) {
    if (!chosenParentOfChild.has(c)) {
      chosenParentOfChild.set(c, p);
      if (!parentToChildren.has(p)) parentToChildren.set(p, new Set());
      parentToChildren.get(p)!.add(c);
    }
  }
  for (const r of relations) {
    if (r.relationship_type === 'parent') addChild(r.user_id, r.related_user_id);
    if (r.relationship_type === 'child') addChild(r.related_user_id, r.user_id);
  }

  // 2) couples: au plus 1 conjoint par personne (ordre alpha pour stabilité)
  const spouseCandidates = new Map<ID, ID[]>();
  for (const r of relations) {
    if (r.relationship_type !== 'spouse') continue;
    if (!spouseCandidates.has(r.user_id)) spouseCandidates.set(r.user_id, []);
    spouseCandidates.get(r.user_id)!.push(r.related_user_id);
    if (!spouseCandidates.has(r.related_user_id)) spouseCandidates.set(r.related_user_id, []);
    spouseCandidates.get(r.related_user_id)!.push(r.user_id);
  }
  const spouseOf = new Map<ID, ID>();
  spouseCandidates.forEach((arr, pid) => {
    arr.sort((a, b) => normalizeName(peopleById.get(a)?.full_name).localeCompare(normalizeName(peopleById.get(b)?.full_name), 'fr'));
    spouseOf.set(pid, arr[0]);
  });

  // 3) créer cellules "couple" et "single"
  const cellIdOfPerson = new Map<ID, ID>(); // person -> cell id
  const cells = new Map<ID, Cell>();
  const makeCoupleId = (a: ID, b: ID) => `couple:${a < b ? `${a}-${b}` : `${b}-${a}`}`;
  const madeCouple = new Set<ID>();

  // couples
  peopleById.forEach((_, pid) => {
    const s = spouseOf.get(pid);
    if (!s) return;
    const cid = makeCoupleId(pid, s);
    if (madeCouple.has(cid)) {
      cellIdOfPerson.set(pid, cid);
      return;
    }
    madeCouple.add(cid);
    cellIdOfPerson.set(pid, cid);
    cellIdOfPerson.set(s, cid);
    cells.set(cid, {
      id: cid, kind: 'couple', members: [pid < s ? pid : s, pid < s ? s : pid],
      parentId: null, childIds: [], PRV: 0, PRH: 0, TC: 2 * CARD_W + COUPLE_GAP,
      PH: 0, PV: 0, PNMin: 0, PNMax: 0
    });
  });

  // célibataires restants
  peopleById.forEach((_, pid) => {
    if (cellIdOfPerson.has(pid)) return;
    const cid = `person:${pid}`;
    cellIdOfPerson.set(pid, cid);
    cells.set(cid, {
      id: cid, kind: 'single', members: [pid],
      parentId: null, childIds: [], PRV: 0, PRH: 0, TC: CARD_W,
      PH: 0, PV: 0, PNMin: 0, PNMax: 0
    });
  });

  // 4) parentage cellule->cellule
  // parent cell = cellule du parent choisi (couple si parent dans un couple)
  // enfant cell = cellule contenant l'enfant (couple ou single)
  chosenParentOfChild.forEach((parentPersonId, childPersonId) => {
    const parentCellId = cellIdOfPerson.get(parentPersonId)!;
    const childCellId = cellIdOfPerson.get(childPersonId)!;
    if (!cells.has(parentCellId) || !cells.has(childCellId)) return;
    const parentCell = cells.get(parentCellId)!;
    if (!parentCell.childIds.includes(childCellId)) parentCell.childIds.push(childCellId);
    // parentId de l'enfant si pas encore renseigné
    const childCell = cells.get(childCellId)!;
    if (childCell.parentId == null) childCell.parentId = parentCellId;
  });

  // 5) trouver ancêtre(s) (cellules sans parentId)
  const roots = Array.from(cells.values()).filter(c => !c.parentId);

  // 6) PRV/PRH par DFS (ordre alpha sur le nom affiché)
  const nameOfCell = (c: Cell) => {
    const n = peopleById.get(c.members[0])?.full_name ?? '';
    return n.toLowerCase();
  };
  const childrenOf = (c: Cell) => c.childIds.map(id => cells.get(id)!).sort((a,b) => nameOfCell(a).localeCompare(nameOfCell(b), 'fr'));

  const counterByPRV = new Map<number, number>();
  function visitPR(root: Cell, prv: number) {
    const count = counterByPRV.get(prv) ?? 0;
    root.PRV = prv;
    root.PRH = count;
    counterByPRV.set(prv, count + 1);
    for (const ch of childrenOf(root)) visitPR(ch, prv + 1);
  }
  roots.sort((a,b) => nameOfCell(a).localeCompare(nameOfCell(b), 'fr')).forEach(r => visitPR(r, 0));

  return { cells, roots };
}

export function layoutCells(cells: Map<ID, Cell>, roots: Cell[]) {
  // retourne le width d’un sous-arbre et renseigne PNMin/PNMax/PH/PV (relatifs), puis on translatera
  function placeSubtree(c: Cell): number {
    const children = c.childIds.map(id => cells.get(id)!);
    // Feuille
    if (children.length === 0) {
      c.PNMin = 0;
      c.PNMax = c.TC;
      c.PH = c.TC / 2;
      return c.TC;
    }
    // Placer les enfants de gauche à droite
    let cursor = 0;
    let first = true;
    for (const ch of children) {
      const w = placeSubtree(ch);          // width du sous-arbre enfant (et remplit PNMin/PNMax/PH)
      if (!first) cursor += SIBLING_GAP;
      ch.PNMin += cursor;                  // translation à PNMin = cursor
      ch.PNMax += cursor;
      ch.PH    += cursor;
      cursor = ch.PNMax;                   // avance au bord droit du dernier enfant
      first = false;
    }
    const childrenMin = children[0].PNMin;        // 0
    const childrenMax = children[children.length - 1].PNMax; // somme + gaps
    const center = (childrenMin + childrenMax) / 2;

    // positionner le parent au-dessus du centre enfants
    const leftParent = center - c.TC / 2;
    const rightParent = center + c.TC / 2;

    c.PNMin = Math.min(childrenMin, leftParent);
    c.PNMax = Math.max(childrenMax, rightParent);
    c.PH = center;

    return c.PNMax - c.PNMin;
  }

  // placer chaque racine et translater pour marge gauche
  for (const r of roots) {
    const width = placeSubtree(r);
    const delta = MARGIN - r.PNMin;
    // translation absolue de tout le sous-arbre
    function shift(c: Cell, dx: number) {
      c.PNMin += dx; c.PNMax += dx; c.PH += dx;
      c.PV = MARGIN + c.PRV * ROW_H;
      c.childIds.forEach(id => shift(cells.get(id)!, dx));
    }
    shift(r, delta);
  }

  return cells;
}
