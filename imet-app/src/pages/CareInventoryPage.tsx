// src/pages/CareInventoryPage.tsx
import React from 'react';
import {
  Box, Container, Stack, Typography, Card, CardHeader, CardContent,
  TextField, ToggleButtonGroup, ToggleButton,
  Button, LinearProgress, Alert, Dialog, DialogTitle, DialogContent, Paper
} from '@mui/material';
import { Inventory2 } from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../services/supabase';

type Level = 0 | 1 | 2; // 0 = Épuisé, 1 = Disponible, 2 = Surstocké

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
  // champ optionnel si présent en BDD (voir DDL)
  global_note?: string | null;
}

function fmt(dtIso: string) {
  try {
    return format(new Date(dtIso), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return dtIso;
  }
}

export default function CareInventoryPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [products, setProducts] = React.useState<Product[]>([]);
  const [values, setValues] = React.useState<Record<string, Level>>({});
  const [globalNote, setGlobalNote] = React.useState<string>('');

  const [lastSnapshot, setLastSnapshot] = React.useState<SnapshotRow | null>(null);
  const [lastUserName, setLastUserName] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [thanksOpen, setThanksOpen] = React.useState(false);

  // charge produits actifs + dernier snapshot et pré-remplit
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) Produits actifs (tri par sort_order puis nom)
      const { data: prod, error: e1 } = await supabase
        .from('inventory_products')
        .select('id,name,unit,is_active,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (e1) throw e1;
      const prods = (prod ?? []) as Product[];
      console.table(prods);

      // 2) Dernier snapshot global
      const { data: snap, error: e2 } = await supabase
        .from('inventory_snapshots')
        .select('id,user_id,saved_at,items,global_note')
        .order('saved_at', { ascending: false })
        .limit(1)
        .maybeSingle<SnapshotRow>();
      if (e2) throw e2;

      // 3) Hydrate UI levels depuis dernier snapshot (fallback: 1 = Disponible) + note globale
      const presetLevels: Record<string, Level> = {};
      if (snap?.items?.length) {
        for (const it of snap.items) {
          presetLevels[it.product_id] =
            (it.level === 0 || it.level === 1 || it.level === 2) ? it.level : 1;
        }
      }

      setProducts(prods);
      setValues(() => {
        const next: Record<string, Level> = {};
        for (const p of prods) next[p.id] = presetLevels[p.id] ?? 1;
        return next;
      });
      setGlobalNote(snap?.global_note ?? '');
      setLastSnapshot(snap ?? null);

      // 4) Récupère le nom du dernier auteur (si table profiles)
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
      setError(e?.message || 'Erreur de chargement.');
      setProducts([]);
      setValues({});
      setGlobalNote('');
      setLastSnapshot(null);
      setLastUserName(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // premier chargement
    loadData();
  }, [loadData]);

  const setLevel = (productId: string, lvl: Level) => {
    setValues(v => ({ ...v, [productId]: lvl }));
  };

  async function save() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      const payloadItems: SnapshotItem[] = products.map(p => ({
        product_id: p.id,
        level: (values[p.id] ?? 1) as Level,
      }));

      // On tente d’insérer global_note si la colonne existe ; sinon fallback sans.
      const basePayload = {
        user_id: userId,
        saved_at: new Date().toISOString(),
        items: payloadItems,
        global_note: globalNote?.trim() || null,
      };

      let { error: errTry } = await supabase
        .from('inventory_snapshots')
        .insert(basePayload as any);

      if (errTry) {
        // Fallback si la colonne global_note n’existe pas encore
        const { error: errFallback } = await supabase
          .from('inventory_snapshots')
          .insert({
            user_id: basePayload.user_id,
            saved_at: basePayload.saved_at,
            items: basePayload.items,
          } as any);
        if (errFallback) throw errFallback;
      }

      // Affiche l'écran de remerciement 1 seconde, puis rafraîchit les données
      setThanksOpen(true);
      setTimeout(() => {
        setThanksOpen(false);
        loadData();
      }, 1000);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  const titleRight =
    lastSnapshot
      ? `Dernier inventaire : ${lastUserName ?? 'Inconnu'} — ${fmt(lastSnapshot.saved_at)}`
      : 'Aucun inventaire enregistré';

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      {/* En-tête compact, pensé mobile */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Inventory2 />
          <Typography variant="h5">Inventaire</Typography>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {titleRight}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardHeader
        />
        {loading ? <LinearProgress /> : null}
        <CardContent>
          {/* Liste “mobile-first” : cartes empilées, larges zones tactiles */}
          <Stack spacing={1.5}>
            {products.map((p) => {
              const lvl = (values[p.id] ?? 1) as Level;
              return (
<Paper
  key={p.id}
  variant="outlined"
  sx={{ p: 1.5, borderRadius: 2 }}
>
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
          // wrap on mobile, ellipsis on >= sm
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
      onChange={(_, v) => v !== null && setLevel(p.id, v as Level)}
      size="small"
      sx={{
        alignSelf: { xs: 'stretch', sm: 'center' },
        // a little breathing room on tiny screens
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

          {/* Note globale (message pour l’équipe) */}
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Message (optionnel)"
              placeholder="Ex: Racheter du vinaigre blanc / Attention : bouteille entamée…"
              value={globalNote}
              onChange={(e) => setGlobalNote(e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Box>

          {/* Bouton Sauvegarder */}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" onClick={save} disabled={saving || loading} size="large">
              {saving ? 'Enregistrement…' : 'Sauvegarder'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Écran de remerciement plein écran (éphémère ~1s) */}
      <Dialog open={thanksOpen} onClose={() => setThanksOpen(false)} fullScreen>
        <DialogTitle />
        <DialogContent
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '50vh',
            p: 3,
          }}
        >
          <Box>
            <Typography variant="h2" gutterBottom>Merci beaucoup ✨</Typography>
            <Typography variant="h6" color="text.secondary">
              Votre inventaire a été enregistré.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
