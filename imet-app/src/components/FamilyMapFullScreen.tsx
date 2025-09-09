// src/components/FamilyMapFullScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, Box, Stack, Card, CardContent, Avatar, Typography, Chip, Tooltip, Fab, useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';

import { userService } from '../services/userService';
import type { FamilyRelation, User } from '../types/family';
import { parseISO, isValid, differenceInYears, isSameDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ================= Dimensions & espacements (théoriques) =================
const CARD_W = 240;
const CARD_H = 96;
const COUPLE_GAP = 16;
const SIBLING_GAP = 32;
const BLOCK_GAP = 40;
const ROW_H = 180;
const MARGIN = 48;

// 🔎 Limites pan/zoom + inertie
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const ZOOM_STEP = 1.15;
const OUTER_PADDING = 64; // tolérance quand on “tire” la scène

// ================= Utils UI =================
const SMALL_CHIP_SX = {
  height: 22,
  '& .MuiChip-label': { fontSize: 11, px: 0.75, lineHeight: 1.1 },
};

function normalizeName(name?: string | null) {
  return (name || '').trim() || 'Sans nom';
}
function firstLetter(name?: string | null) {
  const n = normalizeName(name);
  return n.charAt(0).toUpperCase();
}
function ageFromBirthDate(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const d = parseISO(dateISO);
  if (!isValid(d)) return null;
  return differenceInYears(new Date(), d);
}
function birthdayLabel(dateISO?: string | null): string | null {
  if (!dateISO) return null;
  const d = parseISO(dateISO);
  if (!isValid(d)) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (isSameDay(thisYear, now)) return '🎂 Aujourd’hui';
  return `${format(d, 'd MMM', { locale: fr })}`;
}

// ================= Carte personne =================
const PersonCard: React.FC<{ u: Pick<User, 'id'|'full_name'|'birth_date'|'allergies'> }> = ({ u }) => {
  const age = ageFromBirthDate(u.birth_date);
  const bday = birthdayLabel(u.birth_date);
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, pointerEvents: 'auto', width: CARD_W }}>
      <CardContent sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: 1.25 }}>
        <Avatar sx={{ width: 40, height: 40 }}>{firstLetter(u.full_name)}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            noWrap
            title={normalizeName(u.full_name)}
            sx={{ fontWeight: 700, lineHeight: 1.15 }}
          >
            {normalizeName(u.full_name)}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            {bday && <Chip size="small" icon={<CakeOutlinedIcon sx={{ fontSize: 24 }} />} label={bday} sx={{ ...SMALL_CHIP_SX, '& .MuiChip-label': { fontSize: 20 } }} />}
            {age != null && age <= 30 && <Chip size="small" label={`${age} ans`} sx={SMALL_CHIP_SX} />}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

// ================= Modèle "Cellule" (personne ou couple) =================
type ID = string;
type CellKind = 'single' | 'couple';

type Cell = {
  id: ID;
  kind: CellKind;
  members: ID[];
  parentId?: ID | null;
  childIds: ID[];
  PRV: number;
  PRH: number;
  TC: number;
  PH: number;
  PV: number;
  PNMin: number;
  PNMax: number;
};

// ================= Props =================
type Props = { open: boolean; rootId: string; onClose: () => void };

// ================= Composant principal =================
export const FamilyMapFullScreen: React.FC<Props> = ({ open, rootId, onClose }) => {
  // ----- Pan/Zoom -----
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 🔎 Panning states
  const isPanning = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const lastMoveAt = useRef(0);
  const velocity = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  // 🔎 Pinch-to-zoom states (multi-touch via Pointer Events)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; center: { x: number; y: number }; scale: number } | null>(null);

  // 🔎 Double-tap zoom
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  // 🔎 UI adaptative
  const isSmall = useMediaQuery('(max-width:600px)');

  // ----- Données -----
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<Map<ID, User>>(new Map());
  const [rels, setRels] = useState<FamilyRelation[]>([]);

  // ----- Chargement du graphe -----
  const loadGraph = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const personCache = new Map<string, User>();
      const allRels: FamilyRelation[] = [];
      const seen = new Set<string>();
      const queue = [rootId];

      async function getPerson(id: string) {
        if (personCache.has(id)) return personCache.get(id)!;
        const { data } = await userService.getUserById(id);
        if (data) personCache.set(id, data);
        return data!;
      }
      async function getRels(id: string) {
        const { data } = await userService.getUserFamilyRelations(id);
        return (data ?? []).filter(r => r.user_id === id);
      }

      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        await getPerson(id);
        const rs = await getRels(id);
        allRels.push(...rs);
        for (const r of rs) {
          if (r.relationship_type === 'parent' || r.relationship_type === 'child' || r.relationship_type === 'spouse') {
            await getPerson(r.related_user_id);
            queue.push(r.related_user_id);
          }
        }
      }

      const uniq = Array.from(
        new Map(allRels.map(r => [`${r.user_id}:${r.related_user_id}:${r.relationship_type}`, r])).values()
      );
      setPeople(personCache);
      setRels(uniq);
    } finally {
      setLoading(false);
    }
  }, [open, rootId]);

  useEffect(() => { if (open) loadGraph(); }, [open, loadGraph]);

  // ================== Construction de l’arbre (inchangé) ==================
  const { cells, roots } = useMemo(() => {
    const peopleById = new Map<ID, { id: ID; full_name: string | null }>();
    people.forEach((u) => peopleById.set(u.id, { id: u.id, full_name: u.full_name }));

    const normalizeKey = (s?: string | null) => (s ?? '').trim().toLowerCase();

    const chosenParentOfChild = new Map<ID, ID>();
    const parentToChildren = new Map<ID, Set<ID>>();
    const addChild = (p: ID, c: ID) => {
      if (!chosenParentOfChild.has(c)) {
        chosenParentOfChild.set(c, p);
        if (!parentToChildren.has(p)) parentToChildren.set(p, new Set());
        parentToChildren.get(p)!.add(c);
      }
    };
    for (const r of rels) {
      if (r.relationship_type === 'parent') addChild(r.user_id, r.related_user_id);
      if (r.relationship_type === 'child')  addChild(r.related_user_id, r.user_id);
    }

    const spouseCandidates = new Map<ID, ID[]>();
    for (const r of rels) {
      if (r.relationship_type !== 'spouse') continue;
      if (!spouseCandidates.has(r.user_id)) spouseCandidates.set(r.user_id, []);
      spouseCandidates.get(r.user_id)!.push(r.related_user_id);
      if (!spouseCandidates.has(r.related_user_id)) spouseCandidates.set(r.related_user_id, []);
      spouseCandidates.get(r.related_user_id)!.push(r.user_id);
    }
    const spouseOf = new Map<ID, ID>();
    spouseCandidates.forEach((arr, pid) => {
      arr.sort((a, b) =>
        normalizeKey(peopleById.get(a)?.full_name).localeCompare(
          normalizeKey(peopleById.get(b)?.full_name), 'fr'
        )
      );
      spouseOf.set(pid, arr[0]);
    });

    const cellIdOfPerson = new Map<ID, ID>();
    const cells = new Map<ID, Cell>();
    const makeCoupleId = (a: ID, b: ID) => `couple:${a < b ? `${a}-${b}` : `${b}-${a}`}`;
    const madeCouple = new Set<ID>();

    peopleById.forEach((_, pid) => {
      const s = spouseOf.get(pid);
      if (!s) return;
      const cid = makeCoupleId(pid, s);
      if (madeCouple.has(cid)) { cellIdOfPerson.set(pid, cid); return; }
      madeCouple.add(cid);
      const a = pid < s ? pid : s;
      const b = pid < s ? s : pid;
      cellIdOfPerson.set(a, cid); cellIdOfPerson.set(b, cid);
      cells.set(cid, {
        id: cid, kind: 'couple', members: [a, b],
        parentId: null, childIds: [],
        PRV: 0, PRH: 0, TC: 2*CARD_W + COUPLE_GAP,
        PH: 0, PV: 0, PNMin: 0, PNMax: 0
      });
    });

    peopleById.forEach((_, pid) => {
      if (cellIdOfPerson.has(pid)) return;
      const cid = `person:${pid}`;
      cellIdOfPerson.set(pid, cid);
      cells.set(cid, {
        id: cid, kind: 'single', members: [pid],
        parentId: null, childIds: [],
        PRV: 0, PRH: 0, TC: CARD_W,
        PH: 0, PV: 0, PNMin: 0, PNMax: 0
      });
    });

    chosenParentOfChild.forEach((pPerson, cPerson) => {
      const pCellId = cellIdOfPerson.get(pPerson)!;
      const cCellId = cellIdOfPerson.get(cPerson)!;
      if (!cells.has(pCellId) || !cells.has(cCellId)) return;
      const parentCell = cells.get(pCellId)!;
      if (!parentCell.childIds.includes(cCellId)) parentCell.childIds.push(cCellId);
      const childCell = cells.get(cCellId)!;
      if (childCell.parentId == null) childCell.parentId = pCellId;
    });

    const childrenByParent = new Map<ID, string[]>();
    parentToChildren.forEach((set, p) => childrenByParent.set(p, Array.from(set)));
    cells.forEach(cell => {
      if (cell.kind !== 'couple') return;
      const [a, b] = cell.members;
      const kids = Array.from(new Set([...(childrenByParent.get(a) ?? []), ...(childrenByParent.get(b) ?? [])]));
      cell.childIds = kids.map(k => cellIdOfPerson.get(k)!).filter(Boolean);
      cell.childIds.forEach(cid => {
        const ch = cells.get(cid)!;
        if (ch.parentId == null) ch.parentId = cell.id;
      });
    });

    let roots = Array.from(cells.values()).filter(c => !c.parentId);

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
  }, [people, rels]);

  // ================== Layout bottom-up (inchangé) ==================
  const placedCells = useMemo(() => {
    const cellsCopy = new Map(cells);
    const nameOfCell = (c: Cell) => {
      const u = people.get(c.members[0]);
      return (u?.full_name ?? '').toLowerCase();
    };
    const childrenOf = (c: Cell) => c.childIds.map(id => cellsCopy.get(id)!).sort((a,b) => nameOfCell(a).localeCompare(nameOfCell(b), 'fr'));

    function placeSubtree(c: Cell): number {
      const children = childrenOf(c);
      if (children.length === 0) {
        c.PNMin = 0;
        c.PNMax = c.TC;
        c.PH = c.TC / 2;
        return c.TC;
      }
      let cursor = 0;
      let first = true;
      for (const ch of children) {
        const w = placeSubtree(ch);
        if (!first) cursor += SIBLING_GAP;
        ch.PNMin += cursor;
        ch.PNMax += cursor;
        ch.PH    += cursor;
        cursor = ch.PNMax;
        first = false;
      }
      const childrenMin = children[0].PNMin;
      const childrenMax = children[children.length - 1].PNMax;
      const center = (childrenMin + childrenMax) / 2;

      const leftParent = center - c.TC / 2;
      const rightParent = center + c.TC / 2;
      c.PNMin = Math.min(childrenMin, leftParent);
      c.PNMax = Math.max(childrenMax, rightParent);
      c.PH = center;
      return c.PNMax - c.PNMin;
    }

    function shift(c: Cell, dx: number) {
      c.PNMin += dx; c.PNMax += dx; c.PH += dx;
      c.childIds.forEach(id => shift(cellsCopy.get(id)!, dx));
    }

    function clampChildrenLeftToParentAndRecenter(cell: Cell) {
      if (!cell.childIds.length) return;
      const children = childrenOf(cell);

      let leftBound = cell.PNMin;
      for (const ch of children) {
        if (ch.PNMin < leftBound) {
          const dx = leftBound - ch.PNMin;
          shift(ch, dx);
        }
        leftBound = ch.PNMax + SIBLING_GAP;
      }

      const childrenMin = children[0].PNMin;
      const childrenMax = children[children.length - 1].PNMax;
      const center = (childrenMin + childrenMax) / 2;

      cell.PH = center;
      const leftParent = center - cell.TC / 2;
      const rightParent = center + cell.TC / 2;
      cell.PNMin = Math.min(childrenMin, leftParent);
      cell.PNMax = Math.max(childrenMax, rightParent);

      for (const ch of children) clampChildrenLeftToParentAndRecenter(ch);
    }

    let currentX = MARGIN;
    const rootsSorted = [...roots].sort((a,b) => {
      const an = people.get(a.members[0])?.full_name ?? '';
      const bn = people.get(b.members[0])?.full_name ?? '';
      return an.localeCompare(bn, 'fr');
    });

    for (const r of rootsSorted) {
      placeSubtree(r);
      const delta = currentX - r.PNMin;
      shift(r, delta);
      clampChildrenLeftToParentAndRecenter(r);
      currentX = r.PNMax + BLOCK_GAP * 3;
    }

    function setPV(c: Cell) {
      c.PV = MARGIN + c.PRV * ROW_H;
      c.childIds.forEach(id => setPV(cellsCopy.get(id)!));
    }
    for (const r of rootsSorted) setPV(r);

    return cellsCopy;
  }, [cells, roots, people]);

  const allCells = useMemo(() => Array.from(placedCells.values()), [placedCells]);

  // Dimensions scène
  const { sceneW, sceneH } = useMemo(() => {
    if (allCells.length === 0) return { sceneW: 1000, sceneH: 800 };
    const maxRight = Math.max(...allCells.map(c => c.PNMax));
    const maxGen = Math.max(...allCells.map(c => c.PRV));
    const w = maxRight + MARGIN;
    const h = MARGIN + (maxGen + 1) * ROW_H + MARGIN;
    return { sceneW: w, sceneH: h };
  }, [allCells]);

  // ===== Helpers pan/zoom (mobile & desktop) =====
  const clampOffset = useCallback((next: {x:number;y:number}, s: number) => {
    const el = viewportRef.current;
    if (!el) return next;
    const vw = el.clientWidth, vh = el.clientHeight;
    const contentW = sceneW * s;
    const contentH = sceneH * s;

    // bornes pour que la scène reste accessible
    const minX = Math.min(OUTER_PADDING, vw - contentW - OUTER_PADDING);
    const maxX = Math.max(vw - contentW + OUTER_PADDING, OUTER_PADDING);
    const minY = Math.min(OUTER_PADDING, vh - contentH - OUTER_PADDING);
    const maxY = Math.max(vh - contentH + OUTER_PADDING, OUTER_PADDING);

    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
    };
  }, [sceneW, sceneH]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const el = viewportRef.current;
    if (!el) return;

    // point dans le viewport -> point scène (avant zoom)
    const rect = el.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    setScale(prevScale => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale * factor));

      // 🔎 garder le point (vx,vy) fixe à l’écran => ajuster offset
      setOffset(prev => {
        const sx = (vx - prev.x) / prevScale;
        const sy = (vy - prev.y) / prevScale;
        const nx = vx - sx * newScale;
        const ny = vy - sy * newScale;
        return clampOffset({ x: nx, y: ny }, newScale);
      });

      return newScale;
    });
  }, [clampOffset]);

  // Recentrage auto après calcul du layout
  const fitToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth, vh = el.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    const sx = vw / (sceneW || 1);
    const sy = vh / (sceneH || 1);
    const s = Math.min(sx, sy) * 0.95;
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    setScale(clamped);
    const next = {
      x: (vw - (sceneW * clamped)) / 2,
      y: (vh - (sceneH * clamped)) / 2,
    };
    setOffset(clampOffset(next, clamped));
  }, [sceneW, sceneH, clampOffset]);

  useEffect(() => { if (!open || loading) return; fitToViewport(); }, [open, loading, sceneW, sceneH, fitToViewport]);

  // 🔎 S’adapter aux rotations / redimensionnements
  useEffect(() => {
    if (!open) return;
    const ro = new ResizeObserver(() => fitToViewport());
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [open, fitToViewport]);

  // ===== Handlers pointeurs (pan / pinch / wheel / double-tap) =====
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1/ZOOM_STEP;
    zoomAt(e.clientX, e.clientY, factor);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Double-tap (uniquement si un seul doigt)
    if (activePointers.current.size === 1) {
      const now = Date.now();
      if (lastTap.current && now - lastTap.current.time < 280) {
        zoomAt(e.clientX, e.clientY, ZOOM_STEP * ZOOM_STEP);
        lastTap.current = null;
      } else {
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }

    if (activePointers.current.size === 1) {
      isPanning.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      lastMoveAt.current = performance.now();
      velocity.current = { x: 0, y: 0 };
    } else if (activePointers.current.size === 2) {
      // Pinch start
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchStart.current = { dist, center, scale };
      isPanning.current = false; // on laisse le pinch gérer
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchStart.current) {
      // Pinch-to-zoom
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / (pinchStart.current.dist || 1);
      const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.current.scale * factor));

      // mettre à jour offset pour garder le centre de pinch en place
      const { center } = pinchStart.current;
      setScale(prev => {
        const newScale = targetScale;
        setOffset(prevOffset => {
          const sx = (center.x - prevOffset.x) / prev;
          const sy = (center.y - prevOffset.y) / prev;
          const nx = center.x - sx * newScale;
          const ny = center.y - sy * newScale;
          return clampOffset({ x: nx, y: ny }, newScale);
        });
        return newScale;
      });
      return;
    }

    if (isPanning.current && activePointers.current.size === 1) {
      const now = performance.now();
      const dt = Math.max(16, now - lastMoveAt.current);
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      lastMoveAt.current = now;

      setOffset(prev => clampOffset({ x: prev.x + dx, y: prev.y + dy }, scale));
      // petite inertie
      velocity.current = { x: dx / dt, y: dy / dt };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) pinchStart.current = null;

    if (activePointers.current.size === 0) {
      // lancer la “fling” si un peu de vitesse
      isPanning.current = false;
      const startVel = { x: velocity.current.x, y: velocity.current.y };
      const hasVel = Math.hypot(startVel.x, startVel.y) > 0.02; // seuil
      if (hasVel) {
        const decay = 0.92;
        const step = () => {
          velocity.current.x *= decay;
          velocity.current.y *= decay;
          setOffset(prev => clampOffset({
            x: prev.x + velocity.current.x * 16, // approx 60fps
            y: prev.y + velocity.current.y * 16,
          }, scale));
          if (Math.hypot(velocity.current.x, velocity.current.y) > 0.01) {
            rafId.current = requestAnimationFrame(step);
          } else if (rafId.current) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
          }
        };
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(step);
      }
    }
  };

  useEffect(() => () => { if (rafId.current) cancelAnimationFrame(rafId.current); }, []);

  // ================== Rendu ==================
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: 'background.default' } }}
    >
      {/* Actions (grossis sur mobile) */}
      <Box
        sx={{
          position: 'fixed',
          zIndex: 4,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          ...(isSmall
            ? { bottom: 12, left: '50%', transform: 'translateX(-50%)' }
            : { top: 8, right: 8 })
        }}
      >
        <Tooltip title="Recentrer">
          <Fab size={isSmall ? 'medium' : 'small'} onClick={fitToViewport}><CenterFocusStrongIcon /></Fab>
        </Tooltip>
        <Tooltip title="Zoom +">
          <Fab size={isSmall ? 'medium' : 'small'} onClick={() => zoomAt(window.innerWidth/2, window.innerHeight/2, ZOOM_STEP)}><AddIcon /></Fab>
        </Tooltip>
        <Tooltip title="Zoom -">
          <Fab size={isSmall ? 'medium' : 'small'} onClick={() => zoomAt(window.innerWidth/2, window.innerHeight/2, 1/ZOOM_STEP)}><RemoveIcon /></Fab>
        </Tooltip>
        <Tooltip title="Fermer">
          <Fab color="default" size={isSmall ? 'medium' : 'small'} onClick={onClose}><CloseIcon /></Fab>
        </Tooltip>
      </Box>

      {/* Zone pan/zoom */}
      <Box
        ref={viewportRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // 🔎 Clé pour gestures mobiles fluides : touchAction none + overscroll contain
        sx={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          cursor: activePointers.current.size === 1 && isPanning.current ? 'grabbing' : 'grab',
          bgcolor: 'background.default',
          touchAction: 'none',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'auto',
        }}
      >
        {/* Scène */}
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: sceneW,
            height: sceneH,
            pointerEvents: 'none',
            willChange: 'transform', // 🔎 perf
          }}
        >
          {/* === Lignes/SVG (dessous) === */}
          <svg width={sceneW} height={sceneH} style={{ position: 'absolute', left: 0, top: 0 }}>
            {allCells.filter(c => c.kind === 'couple').map(c => (
              <text
                key={`heart-${c.id}`}
                x={c.PH}
                y={c.PV + CARD_H / 2 + 5}
                textAnchor="middle"
                fontSize={16}
                opacity={0.9}
              >❤</text>
            ))}

            {allCells.filter(c => c.childIds.length > 0).map(c => {
              const parentX = c.PH;
              const parentBottomY = c.PV + CARD_H;
              const childTopY = c.PV + ROW_H;
              const busY = (parentBottomY + childTopY) / 2;

              const children = c.childIds
                .map(id => placedCells.get(id)!)
                .sort((a,b) => a.PH - b.PH);

              const centers = children.map(ch => ch.PH);
              const minX = centers.length ? Math.min(...centers) : parentX;
              const maxX = centers.length ? Math.max(...centers) : parentX;

              return (
                <g key={`edges-${c.id}`} stroke="#B0BEC5" strokeWidth={2} fill="none">
                  <line x1={parentX} y1={parentBottomY} x2={parentX} y2={busY} />
                  {children.length > 0 && <line x1={minX} y1={busY} x2={maxX} y2={busY} />}
                  {children.map(ch => (
                    <line key={`down-${c.id}-${ch.id}`} x1={ch.PH} y1={busY} x2={ch.PH} y2={ch.PV} />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* Cartes (au-dessus) */}
          {allCells.map(cell => {
            const y = cell.PV;
            const isCouple = cell.kind === 'couple';
            const leftA = isCouple ? (cell.PH - (2*CARD_W + COUPLE_GAP)/2) : (cell.PH - CARD_W/2);
            const leftB = isCouple ? (leftA + CARD_W + COUPLE_GAP) : 0;

            const members = cell.members;
            const aUser = people.get(members[0]);
            const bUser = isCouple ? people.get(members[1]) : undefined;

            return (
              <React.Fragment key={cell.id}>
                {aUser && (
                  <Box sx={{ position: 'absolute', left: leftA, top: y, width: CARD_W }}>
                    <PersonCard u={{
                      id: aUser.id, full_name: aUser.full_name,
                      birth_date: aUser.birth_date ?? undefined, allergies: aUser.allergies ?? ''
                    }} />
                  </Box>
                )}
                {isCouple && bUser && (
                  <Box sx={{ position: 'absolute', left: leftB, top: y, width: CARD_W }}>
                    <PersonCard u={{
                      id: bUser.id, full_name: bUser.full_name,
                      birth_date: bUser.birth_date ?? undefined, allergies: bUser.allergies ?? ''
                    }} />
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
    </Dialog>
  );
};

export default FamilyMapFullScreen;
