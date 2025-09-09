// src/pages/CareChecklistsPage.tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Container, Stack, Typography, Card, CardHeader, CardContent,
  List, ListItem, Checkbox, ListItemText, LinearProgress, Alert,
  Paper, ToggleButtonGroup, ToggleButton, TextField, Button,
  Dialog, DialogTitle, DialogContent
} from '@mui/material';
import { Inventory2 } from '@mui/icons-material';
import { supabase } from '../services/supabase';

// ----- Types -----
type Moment = 'arrival' | 'departure';
type Season = 'winter' | 'summer';
type Level = 0 | 1 | 2; // 0=Épuisé, 1=Disponible, 2=Surstocké

type SectionKey =
  | 'checkin_winter'
  | 'checkin_summer'
  | 'checkout_winter'
  | 'checkout_summer';

const SECTION_LABEL: Record<SectionKey, string> = {
  checkin_winter: 'Check-in (hiver)',
  checkin_summer: 'Check-in (été)',
  checkout_winter: 'Check-out (hiver)',
  checkout_summer: 'Check-out (été)',
};

interface ActionRow {
  id: string;
  label: string;
  sections: SectionKey[];
  comment: string | null;
  is_active: boolean | null;
}

interface UiActionItem {
  id: string;
  label: string;
  comment: string | null;
  done: boolean;
}

interface Product {
  id: string;
  name: string;
  unit: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

interface SnapshotItem {
  product_id: string;
  level: Level;
}

interface SnapshotRow {
  id: string;
  user_id: string | null;
  saved_at: string;
  items: SnapshotItem[];
  global_note?: string | null;
}

// ----- Helpers -----
function normalizeMomentParam(q: string | null): Moment {
  if (!q) return 'arrival';
  const v = q.toLowerCase();
  if (v === 'arrival' || v === 'checkin') return 'arrival';
  if (v === 'departure' || v === 'checkout' || v === 'depart') return 'departure';
  return 'arrival';
}

// Hiver = 1 nov → 15 mars (inclus)
function detectSeason(now = new Date()): Season {
  const m = now.getMonth() + 1; // 1..12
  const d = now.getDate();
  const isWinter = m === 11 || m === 12 || m === 1 || m === 2 || (m === 3 && d <= 15);
  return isWinter ? 'winter' : 'summer';
}

function sectionKeyFor(moment: Moment, season: Season): SectionKey {
  if (moment === 'arrival' && season === 'winter') return 'checkin_winter';
  if (moment === 'arrival' && season === 'summer') return 'checkin_summer';
  if (moment === 'departure' && season === 'winter') return 'checkout_winter';
  return 'checkout_summer';
}

export default function CareChecklistsPage() {
  const [sp] = useSearchParams();

  // moment via URL (boutons du dashboard), saison auto
  const moment = normalizeMomentParam(sp.get('moment'));
  const season = detectSeason();
  const sectionKey = sectionKeyFor(moment, season);

  // ---------- Checklist (partie haute) ----------
  const [ckLoading, setCkLoading] = React.useState(true);
  const [ckError, setCkError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<UiActionItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCkLoading(true);
      setCkError(null);
      try {
        const { data, error } = await supabase
          .from('checklist_actions')
          .select('id,label,sections,comment,is_active')
          .eq('is_active', true)
          .order('label', { ascending: true });
        if (error) throw error;

        const rows = (data ?? []) as ActionRow[];
        const filtered = rows.filter(r => (r.sections || []).includes(sectionKey));
        const mapped: UiActionItem[] = filtered.map((r) => ({
          id: r.id,
          label: r.label,
          comment: r.comment ?? null,
          done: false,
        }));

        if (!cancelled) setItems(mapped);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setCkError(e?.message || 'Erreur de chargement.');
          setItems([]);
        }
      } finally {
        if (!cancelled) setCkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sectionKey]);

  const ckPercent =
    items.length > 0
      ? Math.round((items.filter(i => i.done).length / items.length) * 100)
      : 0;

  const toggle = (id: string) => {
    setItems((arr) => arr.map(it => it.id === id ? { ...it, done: !it.done } : it));
  };

  // ---------- Inventaire (bas de page, seulement en check-out) ----------
  const showInventory = moment === 'departure';

  const [invLoading, setInvLoading] = React.useState(true);
  const [invError, setInvError] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [levels, setLevels] = React.useState<Record<string, Level>>({});
  const [globalNote, setGlobalNote] = React.useState<string>('');
  const [lastSnapshot, setLastSnapshot] = React.useState<SnapshotRow | null>(null);
  const [lastUserName, setLastUserName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [thanksOpen, setThanksOpen] = React.useState(false);

  const loadInventory = React.useCallback(async () => {
    setInvLoading(true);
    setInvError(null);
    try {
      // 1) Produits actifs
      const { data: prod, error: e1 } = await supabase
        .from('inventory_products')
        .select('id,name,unit,is_active,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (e1) throw e1;
      const prods = (prod ?? []) as Product[];

      // 2) Dernier snapshot
      const { data: snap, error: e2 } = await supabase
        .from('inventory_snapshots')
        .select('id,user_id,saved_at,items,global_note')
        .order('saved_at', { ascending: false })
        .limit(1)
        .maybeSingle<SnapshotRow>();
      if (e2) throw e2;

      // 3) Pré-remplissage
      const preset: Record<string, Level> = {};
      if (snap?.items?.length) {
        for (const it of snap.items) {
          if (it.level === 0 || it.level === 1 || it.level === 2) {
            preset[it.product_id] = it.level;
          }
        }
      }

      setProducts(prods);
      setLevels(() => {
        const next: Record<string, Level> = {};
        for (const p of prods) next[p.id] = preset[p.id] ?? 1;
        return next;
      });
      setGlobalNote(snap?.global_note ?? '');
      setLastSnapshot(snap ?? null);

      if (snap?.user_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', snap.user_id)
          .maybeSingle();
        setLastUserName((prof as any)?.full_name ?? null);
      } else {
        setLastUserName(null);
      }
    } catch (e: any) {
      console.error(e);
      setInvError(e?.message || 'Erreur de chargement de l’inventaire.');
      setProducts([]);
      setLevels({});
      setGlobalNote('');
      setLastSnapshot(null);
      setLastUserName(null);
    } finally {
      setInvLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (showInventory) loadInventory();
  }, [showInventory, loadInventory]);

  const setLevel = (productId: string, lvl: Level) => {
    setLevels(v => ({ ...v, [productId]: lvl }));
  };

  async function saveInventory() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const items: SnapshotItem[] = products.map(p => ({
        product_id: p.id,
        level: (levels[p.id] ?? 1) as Level,
      }));

      const payload = {
        user_id: userId,
        saved_at: new Date().toISOString(),
        items,
        global_note: globalNote?.trim() || null,
      };

      // insert (avec fallback si global_note absent en BDD)
      let { error: errTry } = await supabase.from('inventory_snapshots').insert(payload as any);
      if (errTry) {
        const { error: errFallback } = await supabase
          .from('inventory_snapshots')
          .insert({ user_id: payload.user_id, saved_at: payload.saved_at, items: payload.items } as any);
        if (errFallback) throw errFallback;
      }

      // Merci éphémère (1s) + reload inventaire
      setThanksOpen(true);
      setTimeout(() => {
        setThanksOpen(false);
        loadInventory();
      }, 1000);
    } catch (e: any) {
      console.error(e);
      setInvError(e?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

const invHeaderRight =
  lastSnapshot
    ? `Dernier inventaire : ${lastUserName ?? 'Inconnu'} — ${fmtDateOnly(lastSnapshot.saved_at)}`
    : 'Aucun inventaire enregistré';

  function fmtDateOnly(dtIso: string) {
    try {
      return new Date(dtIso).toLocaleDateString();
    } catch {
      return dtIso;
    }
  }
  // ---------- Render ----------

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      {/* En-tête compact, pensé mobile */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {SECTION_LABEL[sectionKey]}
      </Typography>

      {ckError && <Alert severity="error" sx={{ mb: 2 }}>{ckError}</Alert>}

      {/* Bloc checklist */}
      <Card>
        <CardHeader
          subheader={
            items.length > 0 ? `Progression: ${items.filter(i => i.done).length}/${items.length} (${ckPercent}%)` : undefined
          }
        />
        {ckLoading ? <LinearProgress /> : (ckPercent > 0 ? <LinearProgress variant="determinate" value={ckPercent} /> : null)}
        <CardContent>
          {ckLoading ? (
            <Typography color="text.secondary">Chargement…</Typography>
          ) : items.length === 0 ? (
            <Typography color="text.secondary">
              Aucune action pour <b>{SECTION_LABEL[sectionKey]}</b>. Ajoutez des actions dans <code>Admin &gt; Checklists</code>.
            </Typography>
          ) : (
            <List disablePadding>
              {items.map((it) => (
                <ListItem
                  key={it.id}
                  disableGutters
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1.5,
                    borderBottom: '1px solid #eee',
                    py: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <Checkbox checked={it.done} onChange={() => toggle(it.id)} />
                    <ListItemText
                      primary={<span>{it.label}</span>}
                      secondary={it.comment ? <span style={{ color: 'var(--mui-palette-text-secondary)' }}>{it.comment}</span> : undefined}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Bloc inventaire (uniquement en check-out) */}
      {showInventory && (
        <>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 3, mb: 1 }}>
            <Inventory2 />
            <Typography variant="h5">Inventaire</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {invHeaderRight}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            💡 Pensez à mettre à jour l’inventaire.
          </Typography>
          {invError && <Alert severity="error" sx={{ mb: 2 }}>{invError}</Alert>}

          <Card>
            <CardHeader />
            {invLoading ? <LinearProgress /> : null}
            <CardContent>
              <Stack spacing={1.5}>
                {products.map((p) => {
                  const lvl = (levels[p.id] ?? 1) as Level;
                  return (
                    <Paper key={p.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                        gap={1}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 700,
                              lineHeight: 1.2,
                              // wrap sur mobile, ellipsis à partir de sm
                              whiteSpace: { xs: 'normal', sm: 'nowrap' },
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={p.name || '(Sans nom)'}
                            color="text.primary"
                          >
                            {p.name || '(Sans nom)'}
                          </Typography>
                        </Box>

                        <ToggleButtonGroup
                          color="primary"
                          exclusive
                          value={lvl}
                          onChange={(_, v) => (v !== null) && setLevel(p.id, v as Level)}
                          size="small"
                          sx={{
                            alignSelf: { xs: 'stretch', sm: 'center' },
                            '& .MuiToggleButton-root': { flex: { xs: 1, sm: '0 0 auto' } },
                          }}
                        >
                          <ToggleButton value={0}>Épuisé</ToggleButton>
                          <ToggleButton value={1}>Disponible</ToggleButton>
                          <ToggleButton value={2}>Surstocké</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Message (optionnel)"
                  placeholder="Ex: Racheter exceptionnellement XYZ / Info pour l’équipe…"
                  value={globalNote}
                  onChange={(e) => setGlobalNote(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Box>

              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button variant="contained" size="large" onClick={saveInventory} disabled={saving || invLoading}>
                  {saving ? 'Enregistrement…' : 'Sauvegarder l’inventaire'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Merci beaucoup (éphémère ~1s) */}
          <Dialog open={thanksOpen} onClose={() => setThanksOpen(false)} fullScreen>
            <DialogTitle />
            <DialogContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '20vh', p: 3 }}>
              <Box>
                <Typography variant="h2" gutterBottom>Merci beaucoup ✨</Typography>
                <Typography variant="h6" color="text.secondary">Votre inventaire a été enregistré.</Typography>
              </Box>
            </DialogContent>
          </Dialog>
        </>
      )}
    </Container>
  );
}
