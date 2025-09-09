// src/pages/AdminInventoryProductsPage.tsx
import React from 'react';
import {
  Container, Stack, Typography, Card, CardHeader, CardContent, Divider,
  Button, IconButton, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Chip, Alert, TableContainer, Paper
} from '@mui/material';
import { Add, Edit, Delete, Save, Close, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase } from '../services/supabase';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface InventoryProduct {
  id: string;
  name: string;
  unit: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

type EditorMode = 'create' | 'edit';

export default function AdminInventoryProductsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = React.useState<InventoryProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<EditorMode>('create');
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Omit<InventoryProduct, 'id'>>({
    name: '',
    unit: '',
    is_active: true,
    sort_order: 0,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('inventory_products')
        .select('id,name,unit,is_active,sort_order,created_at,updated_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as InventoryProduct[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erreur lors du chargement.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditorMode('create');
    setEditingId(null);
    setDraft({ name: '', unit: '', is_active: true, sort_order: rows.length });
    setEditorOpen(true);
  }

  function openEdit(row: InventoryProduct) {
    setEditorMode('edit');
    setEditingId(row.id);
    setDraft({
      name: row.name,
      unit: row.unit ?? '',
      is_active: !!row.is_active,
      sort_order: row.sort_order ?? 0,
    });
    setEditorOpen(true);
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      enqueueSnackbar('Le nom du produit est requis.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        unit: draft.unit?.trim() || null,
        is_active: !!draft.is_active,
        sort_order: Number.isFinite(draft.sort_order as number) ? Number(draft.sort_order) : 0,
      };

      if (editorMode === 'create') {
        const { error } = await supabase.from('inventory_products').insert(payload);
        if (error) throw error;
        enqueueSnackbar('Produit créé.', { variant: 'success' });
      } else {
        const { error } = await supabase.from('inventory_products').update(payload).eq('id', editingId as string);
        if (error) throw error;
        enqueueSnackbar('Produit mis à jour.', { variant: 'success' });
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Erreur de sauvegarde.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: InventoryProduct) {
    if (!confirm(`Supprimer le produit "${row.name}" ?`)) return;
    try {
      const { error } = await supabase.from('inventory_products').delete().eq('id', row.id);
      if (error) throw error;
      enqueueSnackbar('Produit supprimé.', { variant: 'success' });
      await load();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Erreur lors de la suppression.', { variant: 'error' });
    }
  }

  async function toggleActive(row: InventoryProduct) {
    try {
      const { error } = await supabase
        .from('inventory_products')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Erreur de mise à jour.', { variant: 'error' });
    }
  }

  async function move(row: InventoryProduct, dir: -1 | 1) {
    // réordonner localement puis persister les deux lignes échangées
    const idx = rows.findIndex(r => r.id === row.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= rows.length) return;

    const a = rows[idx];
    const b = rows[j];
    const newA = { ...a, sort_order: (b.sort_order ?? j) };
    const newB = { ...b, sort_order: (a.sort_order ?? idx) };

    setRows(prev => {
      const copy = [...prev];
      [copy[idx], copy[j]] = [newB, newA];
      return copy;
    });

    // persistance minimale (2 updates)
    await supabase.from('inventory_products').update({ sort_order: newA.sort_order }).eq('id', newA.id);
    await supabase.from('inventory_products').update({ sort_order: newB.sort_order }).eq('id', newB.id);
  }

  /* ----------------- Rendu mobile en cartes (avec flèches d'ordre) ----------------- */
  const MobileCards: React.FC = () => (
    <Stack spacing={1.25}>
      {rows.map((r, idx) => (
        <Card key={r.id} variant="outlined">
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap title={r.name}>
                  {r.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Unité : {r.unit || '—'}
                </Typography>
              </Stack>

              {/* Ordre + flèches */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton size="small" onClick={() => move(r, -1)} disabled={idx === 0}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => move(r, +1)} disabled={idx === rows.length - 1}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
                <Chip size="small" label={(r.sort_order ?? idx) + 1} />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <FormControlLabel
                sx={{ m: 0 }}
                control={<Switch checked={!!r.is_active} onChange={() => toggleActive(r)} />}
                label={r.is_active ? 'Actif' : 'Inactif'}
              />

              <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                <Button size="small" startIcon={<Edit />} onClick={() => openEdit(r)}>
                  Éditer
                </Button>
                <Button size="small" color="error" startIcon={<Delete />} onClick={() => deleteRow(r)}>
                  Supprimer
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {!loading && rows.length === 0 && (
        <Typography color="text.secondary">Aucun produit. Cliquez sur “Nouveau produit”.</Typography>
      )}
    </Stack>
  );

  /* --------------------------- Rendu desktop en table --------------------------- */
  const DesktopTable: React.FC = () => (
    <Card>
      <CardHeader
        title="Liste des produits"
        subheader={loading ? 'Chargement…' : `${rows.length} produit(s)`}
      />
      <Divider />
      <CardContent>
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 120 }}>Ordre</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Unité</TableCell>
                <TableCell align="center">Actif</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <IconButton size="small" onClick={() => move(r, -1)} disabled={idx === 0}>
                        <ArrowUpward fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => move(r, +1)} disabled={idx === rows.length - 1}>
                        <ArrowDownward fontSize="small" />
                      </IconButton>
                      <Chip size="small" label={(r.sort_order ?? idx) + 1} />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{r.name}</Typography>
                  </TableCell>
                  <TableCell>{r.unit || '—'}</TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={<Switch checked={!!r.is_active} onChange={() => toggleActive(r)} />}
                      label={r.is_active ? 'Actif' : 'Inactif'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title="Éditer">
                        <IconButton onClick={() => openEdit(r)}><Edit /></IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton color="error" onClick={() => deleteRow(r)}><Delete /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">
                      Aucun produit. Cliquez sur “Nouveau produit”.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Admin — Produits d’inventaire</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={openCreate} fullWidth={isMobile}>
          Nouveau produit
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Responsive: cartes en mobile, table en desktop */}
      {isMobile ? <MobileCards /> : <DesktopTable />}

      {/* Dialog éditeur */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editorMode === 'create' ? 'Nouveau produit' : 'Modifier le produit'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom du produit"
              placeholder="Ex: Huile, Sel, Papier toilette"
              value={draft.name}
              onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Unité (ex: bouteille, g, ml, rouleau)"
              value={draft.unit ?? ''}
              onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Ordre d’affichage"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={draft.sort_order ?? 0}
              onChange={(e) => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))}
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={!!draft.is_active} onChange={(e) => setDraft(d => ({ ...d, is_active: e.target.checked }))} />}
              label={draft.is_active ? 'Actif' : 'Inactif'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<Close />} onClick={() => setEditorOpen(false)}>Annuler</Button>
          <Button startIcon={<Save />} variant="contained" disabled={saving} onClick={saveDraft}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
