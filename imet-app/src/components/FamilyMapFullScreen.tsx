import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, Box, Stack, Card, CardContent, Avatar, Typography, Chip, Tooltip, Fab, useMediaQuery, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';

import { parseISO, isValid, differenceInYears, isSameDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

// 👉 client Supabase (lecture directe des tables)
import { supabase } from '../services/supabase';

// ================= Dimensions & espacements (affichage) =================
const CARD_W = 240;
const CARD_H = 96;
const COUPLE_GAP = 16;
const ROW_H = 180;

// 🔎 Limites pan/zoom + inertie
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const ZOOM_STEP = 1.15;
const OUTER_PADDING = 64;

// ================= Types DB =================
type PositionRow = {
  person_id: string;
  full_name: string | null;
  birth_date: string | null;
  allergies: string | null;
  cell_id: string;
  cell_kind: 'single' | 'couple';
  order_in_cell: number;    // 0 = gauche, 1 = droite (si couple)
  card_x: number;           // top-left
  card_y: number;           // top-left
  cell_ph: number;          // centre horizontal de la cellule
  cell_pv: number;          // top de la cellule
  tc: number;
  prv: number;
  prh: number;
  updated_at: string;
};

type EdgeRow = {
  parent_cell_id: string;
  child_cell_id: string;
  bus_y: number;
};

// ================= Types “cells” reconstruits en mémoire =================
type ID = string;
type CellKind = 'single' | 'couple';

type Cell = {
  id: ID;
  kind: CellKind;
  members: ID[];           // 1 (single) ou 2 (couple)
  PH: number;              // centre horizontal
  PV: number;              // top (vertical)
  TC: number;              // largeur du bloc (CARD_W ou 2*CARD_W+COUPLE_GAP)
};

type PersonLite = {
  id: string;
  full_name: string | null;
  birth_date?: string | null;
  allergies?: string | null;
};

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
const PersonCard: React.FC<{ u: PersonLite }> = React.memo(({ u }) => {
  const age = ageFromBirthDate(u.birth_date ?? undefined);
  const bday = birthdayLabel(u.birth_date ?? undefined);
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
}, (prev, next) =>
  prev.u.id === next.u.id &&
  prev.u.full_name === next.u.full_name &&
  prev.u.birth_date === next.u.birth_date &&
  prev.u.allergies === next.u.allergies
);

// ================= Props =================
type Props = { open: boolean; rootId: string; onClose: () => void };

// ================= Composant principal =================
export const FamilyMapFullScreen: React.FC<Props> = ({ open, onClose }) => {
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

  // 🔎 Pinch-to-zoom states
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; center: { x: number; y: number }; scale: number } | null>(null);

  // 🔎 Double-tap zoom
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  // 🔎 UI adaptative
  const isSmall = useMediaQuery('(max-width:600px)');

  // ----- Données -----
  const [loading, setLoading] = useState(false);
  const [sceneW, setSceneW] = useState<number>(1000);
  const [sceneH, setSceneH] = useState<number>(800);

  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);

  // Reconstruire les cellules & personnes
  const { cells, peopleMap } = useMemo(() => {
    // group by cell_id
    const byCell = new Map<string, PositionRow[]>();
    positions.forEach(r => {
      if (!byCell.has(r.cell_id)) byCell.set(r.cell_id, []);
      byCell.get(r.cell_id)!.push(r);
    });

    const cellsArr: Cell[] = [];
    const people = new Map<string, PersonLite>();

    byCell.forEach((rows, cellId) => {
      rows.sort((a,b) => a.order_in_cell - b.order_in_cell);
      const kind = rows[0]?.cell_kind ?? 'single';
      const PH = rows[0]?.cell_ph ?? 0;
      const PV = rows[0]?.cell_pv ?? 0;
      const TC = kind === 'couple' ? (2*CARD_W + COUPLE_GAP) : CARD_W;
      const members = rows.map(r => r.person_id);
      cellsArr.push({ id: cellId, kind, members, PH, PV, TC });

      // people snapshots
      rows.forEach(r => {
        people.set(r.person_id, {
          id: r.person_id,
          full_name: r.full_name,
          birth_date: r.birth_date,
          allergies: r.allergies ?? undefined,
        });
      });
    });

    // tri stable (comme layout original)
    cellsArr.sort((a,b) => (a.PV - b.PV) || (a.PH - b.PH));

    return { cells: cellsArr, peopleMap: people };
  }, [positions]);

  // ----- Chargement (DB direct) -----
  const loadGraph = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [{ data: metaRow, error: mErr }, { data: posRows, error: pErr }, { data: edgeRows, error: eErr }] = await Promise.all([
        supabase.from('family_graph_meta').select('scene_w, scene_h').eq('id', 'global').maybeSingle(),
        supabase.from('family_graph_positions').select('*'),
        supabase.from('family_graph_edges').select('*'),
      ]);

      if (mErr) throw new Error(`meta: ${mErr.message}`);
      if (pErr) throw new Error(`positions: ${pErr.message}`);
      if (eErr) throw new Error(`edges: ${eErr.message}`);

      if (metaRow?.scene_w && metaRow?.scene_h) {
        setSceneW(metaRow.scene_w);
        setSceneH(metaRow.scene_h);
      }
      setPositions(posRows ?? []);
      setEdges(edgeRows ?? []);
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => { if (open) loadGraph(); }, [open, loadGraph]);

  // ===== Helpers pan/zoom (mobile & desktop) =====
  const clampOffset = useCallback((next: {x:number;y:number}, s: number) => {
    const el = viewportRef.current;
    if (!el) return next;
    const vw = el.clientWidth, vh = el.clientHeight;
    const contentW = sceneW * s;
    const contentH = sceneH * s;

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

    const rect = el.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    setScale(prevScale => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale * factor));
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

  // Recentrage auto après chargement
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
    const next = { x: (vw - (sceneW * clamped)) / 2, y: (vh - (sceneH * clamped)) / 2 };
    setOffset(clampOffset(next, clamped));
  }, [sceneW, sceneH, clampOffset]);

  useEffect(() => { if (!open || loading) return; fitToViewport(); }, [open, loading, sceneW, sceneH, fitToViewport]);

  useEffect(() => {
    if (!open) return;
    const ro = new ResizeObserver(() => fitToViewport());
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [open, fitToViewport]);

  // ===== Handlers pointeurs =====
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1/ZOOM_STEP;
    zoomAt(e.clientX, e.clientY, factor);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Double-tap
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
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchStart.current = { dist, center, scale };
      isPanning.current = false;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const factor = dist / (pinchStart.current.dist || 1);
      const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStart.current.scale * factor));
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
      velocity.current = { x: dx / dt, y: dy / dt };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) pinchStart.current = null;

    if (activePointers.current.size === 0) {
      isPanning.current = false;
      const startVel = { x: velocity.current.x, y: velocity.current.y };
      const hasVel = Math.hypot(startVel.x, startVel.y) > 0.02;
      if (hasVel) {
        const decay = 0.92;
        const step = () => {
          velocity.current.x *= decay;
          velocity.current.y *= decay;
          setOffset(prev => clampOffset({ x: prev.x + velocity.current.x * 16, y: prev.y + velocity.current.y * 16 }, scale));
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

  // ===== Culling : fenêtre visible en coords scène =====
  const visibleRect = useMemo(() => {
    const el = viewportRef.current;
    if (!el) return { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
    const vw = el.clientWidth, vh = el.clientHeight;
    const invS = 1 / scale;
    const minX = (-offset.x) * invS;
    const minY = (-offset.y) * invS;
    const maxX = minX + vw * invS;
    const maxY = minY + vh * invS;
    return { minX, minY, maxX, maxY };
  }, [offset, scale]);

  const HPAD = 60, VPAD = 80;

  // === Fabriquer la liste des "cellules" visibles à partir de positions ===
  const visibleCells = useMemo(() => {
    const result: Cell[] = [];
    for (const c of cells) {
      const isCouple = c.kind === 'couple';
      const left = isCouple ? (c.PH - (2*CARD_W + COUPLE_GAP)/2) : (c.PH - CARD_W/2);
      const width = isCouple ? (2*CARD_W + COUPLE_GAP) : CARD_W;
      const right = left + width;
      const top = c.PV;
      const bottom = top + CARD_H;
      const visible = !(
        right < visibleRect.minX - HPAD ||
        left  > visibleRect.maxX + HPAD ||
        bottom < visibleRect.minY - VPAD ||
        top    > visibleRect.maxY + VPAD
      );
      if (visible) result.push(c);
    }
    return result;
  }, [cells, visibleRect]);

  // === Groupes d'arêtes visibles (on regroupe par parent_cell_id) ===
  const edgeGroups = useMemo(() => {
    // regrouper enfants par parent
    const byParent = new Map<string, { busY: number; children: string[] }>();
    for (const e of edges) {
      if (!byParent.has(e.parent_cell_id)) byParent.set(e.parent_cell_id, { busY: e.bus_y, children: [] });
      byParent.get(e.parent_cell_id)!.children.push(e.child_cell_id);
    }

    // map cell_id -> {PH, PV}
    const cellLookup = new Map<string, Cell>();
    cells.forEach(c => cellLookup.set(c.id, c));

    const groups: {
      key: string;
      parent: Cell;
      children: Cell[];
      bbox: { minX: number; maxX: number; minY: number; maxY: number; };
      busY: number;
    }[] = [];

    byParent.forEach((val, parentId) => {
      const parent = cellLookup.get(parentId);
      if (!parent) return;
      const children = val.children.map(id => cellLookup.get(id)!).filter(Boolean);
      if (!children.length) return;

      const parentX = parent.PH;
      const parentBottomY = parent.PV + CARD_H;
      const childTopY = parent.PV + ROW_H;
      const busY = val.busY ?? (parentBottomY + childTopY) / 2;

      const centers = children.map(ch => ch.PH);
      const minX = Math.min(parentX, ...centers);
      const maxX = Math.max(parentX, ...centers);
      const minY = Math.min(parent.PV, ...children.map(ch => ch.PV));
      const maxY = Math.max(parentBottomY, childTopY, ...children.map(ch => ch.PV + CARD_H));

      const bbox = { minX, maxX, minY, maxY: Math.max(maxY, busY) };
      const visible =
        !(bbox.maxX < visibleRect.minX - HPAD ||
          bbox.minX > visibleRect.maxX + HPAD ||
          bbox.maxY < visibleRect.minY - VPAD ||
          bbox.minY > visibleRect.maxY + VPAD);

      if (visible) {
        groups.push({ key: `edges-${parent.id}`, parent, children, bbox, busY });
      }
    });

    return groups;
  }, [edges, cells, visibleRect]);

  // ================== Rendu ==================
  return (
    <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: 'background.default' } }}>
      {/* Actions */}
      <Box
        sx={{
          position: 'fixed', zIndex: 4, display: 'flex', gap: 1, alignItems: 'center',
          ...(isSmall ? { bottom: 12, left: '50%', transform: 'translateX(-50%)' } : { top: 8, right: 8 })
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
        sx={{
          position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden',
          cursor: activePointers.current.size === 1 && isPanning.current ? 'grabbing' : 'grab',
          bgcolor: 'background.default', touchAction: 'none', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'auto',
        }}
      >
        {/* Loading */}
        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <CircularProgress />
          </Stack>
        )}

        {/* Scène */}
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: sceneW,
            height: sceneH,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        >
          <svg width={sceneW} height={sceneH} style={{ position: 'absolute', left: 0, top: 0 }}>
            {/* Petits coeurs pour les couples */}
            {visibleCells.filter(c => c.kind === 'couple').map(c => (
              <text
                key={`heart-${c.id}`}
                x={c.PH}
                y={c.PV + CARD_H / 2 + 5}
                textAnchor="middle"
                fontSize={16}
                opacity={0.9}
              >❤</text>
            ))}

            {/* Arêtes parents → enfants, groupées par parent */}
            {edgeGroups.map(g => {
              const c = g.parent;
              const parentX = c.PH;
              const parentBottomY = c.PV + CARD_H;

              const children = g.children.slice().sort((a,b) => a.PH - b.PH);
              const centers = children.map(ch => ch.PH);
              const minX = centers.length ? Math.min(...centers) : parentX;
              const maxX = centers.length ? Math.max(...centers) : parentX;

              return (
                <g key={g.key} stroke="#B0BEC5" strokeWidth={2} fill="none">
                  <line x1={parentX} y1={parentBottomY} x2={parentX} y2={g.busY} />
                  {children.length > 0 && <line x1={minX} y1={g.busY} x2={maxX} y2={g.busY} />}
                  {children.map(ch => (
                    <line key={`down-${c.id}-${ch.id}`} x1={ch.PH} y1={g.busY} x2={ch.PH} y2={ch.PV} />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* Cartes */}
          {visibleCells.map(cell => {
            const y = cell.PV;
            const isCouple = cell.kind === 'couple';
            const leftA = isCouple ? (cell.PH - (2*CARD_W + COUPLE_GAP)/2) : (cell.PH - CARD_W/2);
            const leftB = isCouple ? (leftA + CARD_W + COUPLE_GAP) : 0;

            const members = cell.members;
            const aUser = peopleMap.get(members[0]);
            const bUser = isCouple ? peopleMap.get(members[1]) : undefined;

            return (
              <React.Fragment key={cell.id}>
                {aUser && (
                  <Box sx={{ position: 'absolute', left: leftA, top: y, width: CARD_W }}>
                    <PersonCard u={{ id: aUser.id, full_name: aUser.full_name, birth_date: aUser.birth_date ?? undefined, allergies: aUser.allergies ?? '' }} />
                  </Box>
                )}
                {isCouple && bUser && (
                  <Box sx={{ position: 'absolute', left: leftB, top: y, width: CARD_W }}>
                    <PersonCard u={{ id: bUser.id, full_name: bUser.full_name, birth_date: bUser.birth_date ?? undefined, allergies: bUser.allergies ?? '' }} />
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
