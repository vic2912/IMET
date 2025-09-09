// src/pages/AdminChecklistsPage.tsx
import React from 'react';
import {
  Box, Container, Stack, Typography, Card, CardHeader, CardContent, Divider,
  Button, IconButton, TextField, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Alert,
  TableContainer, Paper
} from '@mui/material';
import { Add, Edit, Delete, Save, Close } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase } from '../services/supabase';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

type SectionKey = 'checkin_winter' | 'checkin_summer' | 'checkout_winter' | 'checkout_summer';

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
  created_at?: string | null;
  updated_at?: string | null;
}

type EditorMode = 'create' | 'edit';

export default function AdminChecklistsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = React.useState<ActionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<EditorMode>('create');
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Omit<ActionRow, 'id'>>({
    label: '',
    sections: [],
    comment: '',
    is_active: true,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('checklist_actions')
        .select('id,label,sections,comment,is_active,created_at,updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as ActionRow[]);
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
    setDraft({ label: '', sections: [], comment: '', is_active: true });
    setEditorOpen(true);
  }

  function openEdit(row: ActionRow) {
    setEditorMode('edit');
    setEditingId(row.id);
    setDraft({
      label: row.label,
      sections: (row.sections || []) as SectionKey[],
      comment: row.comment ?? '',
      is_active: !!row.is_active,
    });
    setEditorOpen(true);
  }

  async function saveDraft() {
    if (!draft.label.trim()) {
      enqueueSnackbar('Le libellé est requis.', { variant: 'warning' });
      return;
    }
    if (!draft.sections || draft.sections.length === 0) {
      enqueueSnackbar('Sélectionnez au moins une section.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: draft.label.trim(),
        sections: draft.sections,
        comment: draft.comment?.trim() || null,
        is_active: !!draft.is_active,
      };

      if (editorMode === 'create') {
        const { error } = await supabase.from('checklist_actions').insert(payload);
        if (error) throw error;
        enqueueSnackbar('Action créée.', { variant: 'success' });
      } else {
        const { error } = await supabase.from('checklist_actions').update(payload).eq('id', editingId as string);
        if (error) throw error;
        enqueueSnackbar('Action mise à jour.', { variant: 'success' });
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

  async function deleteRow(row: ActionRow) {
    if (!confirm(`Supprimer l’action "${row.label}" ?`)) return;
    try {
      const { error } = await supabase.from('checklist_actions').delete().eq('id', row.id);
      if (error) throw error;
      enqueueSnackbar('Action supprimée.', { variant: 'success' });
      await load();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Erreur lors de la suppression.', { variant: 'error' });
    }
  }

  async function toggleActive(row: ActionRow) {
    try {
      const { error } = await supabase
        .from('checklist_actions')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
    if (error) throw error;
      await load();
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Erreur de mise à jour.', { variant: 'error' });
    }
  }

  function toggleSection(k: SectionKey) {
    setDraft(d => {
      const set = new Set(d.sections);
      if (set.has(k)) set.delete(k); else set.add(k);
      return { ...d, sections: Array.from(set) as SectionKey[] };
    });
  }

  /* ----------------- Rendu mobile en cartes (lisible sur téléphone) ----------------- */
  const MobileCards: React.FC = () => (
    <Stack spacing={1.25}>
      {rows.map((r) => (
        <Card key={r.id} variant="outlined">
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                {r.label}
              </Typography>
              <FormControlLabel
                sx={{ m: 0 }}
                control={<Switch checked={!!r.is_active} onChange={() => toggleActive(r)} />}
                label={r.is_active ? 'Actif' : 'Inactif'}
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 86, pt: '2px' }}>
                Sections
              </Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {(r.sections || []).map((s) => (
                  <Chip key={s} size="small" label={SECTION_LABEL[s]} />
                ))}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 86, pt: '2px' }}>
                Commentaire
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {r.comment || '—'}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button size="small" startIcon={<Edit />} onClick={() => openEdit(r)}>
                Éditer
              </Button>
              <Button size="small" color="error" startIcon={<Delete />} onClick={() => deleteRow(r)}>
                Supprimer
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {!loading && rows.length === 0 && (
        <Typography color="text.secondary">Aucune action. Cliquez sur “Nouvelle action”.</Typography>
      )}
    </Stack>
  );

  /* ------------------------- Rendu desktop (table inchangée) ------------------------ */
  const DesktopTable: React.FC = () => (
    <Card>
      <CardHeader
        title="Liste des actions"
        subheader={loading ? 'Chargement…' : `${rows.length} action(s)`}
      />
      <Divider />
      <CardContent>
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>Sections</TableCell>
                <TableCell>Commentaire</TableCell>
                <TableCell align="right">Actif</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ width: 280 }}>
                    <Typography fontWeight={600}>{r.label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {(r.sections || []).map((s) => (
                        <Chip key={s} size="small" label={SECTION_LABEL[s]} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {r.comment || '—'}
                  </TableCell>
                  <TableCell align="right">
                    <FormControlLabel
                      control={<Switch checked={!!r.is_active} onChange={() => toggleActive(r)} />}
                      label={r.is_active ? 'Actif' : 'Inactif'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title="Éditer">
                        <IconButton onClick={() => openEdit(r)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton color="error" onClick={() => deleteRow(r)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">
                      Aucune action. Cliquez sur “Nouvelle action”.
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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5">Admin — Actions de check-in / check-out</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={openCreate} fullWidth={isMobile}>
          Nouvelle action
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Responsive: cartes en mobile, table en desktop */}
      {isMobile ? <MobileCards /> : <DesktopTable />}

      {/* Éditeur (create/edit) */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editorMode === 'create' ? 'Nouvelle action' : 'Modifier l’action'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Libellé de l’action"
              placeholder='Ex: Allumer l’eau'
              value={draft.label}
              onChange={(e) => setDraft(d => ({ ...d, label: e.target.value }))}
              fullWidth
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Sections</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                {(Object.keys(SECTION_LABEL) as SectionKey[]).map((k) => {
                  const selected = draft.sections.includes(k);
                  return (
                    <Chip
                      key={k}
                      label={SECTION_LABEL[k]}
                      variant={selected ? 'filled' : 'outlined'}
                      color={selected ? 'primary' : 'default'}
                      onClick={() => toggleSection(k)}
                      sx={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Stack>
            </Box>

            <TextField
              label="Commentaire"
              placeholder="Ex: L’eau s’allume à côté de la bombonne rouge"
              value={draft.comment ?? ''}
              onChange={(e) => setDraft(d => ({ ...d, comment: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={!!draft.is_active}
                  onChange={(e) => setDraft(d => ({ ...d, is_active: e.target.checked }))}
                />
              }
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
