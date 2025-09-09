// src/pages/notices/Dechets.tsx
import React from 'react';
import { defineNotice } from './defineNotice';
import { Recycling, ArrowUpward } from '@mui/icons-material';
import HousePageLayout from '../HousePageLayout';
import { Box, Button, Stack, Typography, Fab } from '@mui/material';

export const notice = defineNotice({
  title: 'Les déchets',
  path: '/maison/dechets',
  order: 30,
  icon: Recycling,
});

export default function Dechets() {
  const sections = [
    { id: 'collectes',   label: 'Collectes' },
    { id: 'tri',         label: 'Tri sélectif' },
    { id: 'brulage',     label: 'Brûlage interdit' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <HousePageLayout
      title="Les déchets"
      coverSrc="/maison/dechets/cover-dechets.webp"
      backTo="/dashboard"
    >
      {/* Mini-nav collante */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 1,
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {sections.map(s => (
            <Button key={s.id} size="small" variant="outlined" onClick={() => scrollTo(s.id)}>
              {s.label}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* ========== Collectes ========== */}
      <Box id="collectes" sx={{ scrollMarginTop: 80 }}>
        <h2>Collectes à Poigny-la-Forêt</h2>
        <ul>
          <li><strong>Ordures ménagères</strong> : <em>tous les mercredis</em>.</li>
          <li><strong>Emballages & papier</strong> : <em>un vendredi sur deux</em>.</li>
          <li><strong>Verre</strong> : <em>un lundi toutes les six semaines environ</em>.</li>
        </ul>

        <div className="callout">
          Présentez les bacs la veille au soir. 
        </div>

        {/* Calendrier (mets l’image dans public/maison/collecte-2025.png) */}
        <Box sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden', maxWidth: 980, mx: 'auto' }}>
          <img
            src="/maison/collecte-2025.png"
            alt="Calendrier des collectes 2025 — SICTOM région de Rambouillet"
            loading="lazy"
          />
        </Box>
      </Box>

      {/* ========== Tri sélectif ========== */}
      <Box id="tri" sx={{ scrollMarginTop: 80 }}>
        <h2>Le tri sélectif : que deviennent les matières ?</h2>
        <ul>
          <li>
            <strong>Verre</strong> → transformé en <em>calcin</em> puis réintroduit avec les matières premières
            (sable, carbonate de soude…) pour fabriquer du nouveau verre.
          </li>
          <li>
            <strong>Emballages</strong> (plastique, métal, cartonnettes) → tri par matière, mise en balles,
            puis revente à des usines selon la demande.
          </li>
          <li>
            <strong>Papier & carton</strong> → triés, mis en balles, et transformés en pâte à papier.
          </li>
        </ul>
      </Box>

      {/* ========== Brûlage interdit ========== */}
      <Box id="brulage" sx={{ scrollMarginTop: 80 }}>
        <h2>Brûlage des déchets verts : <span style={{ color: '#c62828' }}>formellement interdit</span></h2>
        <p>
          Pour préserver la qualité de l’air, la <em>loi anti-gaspillage pour une économie circulaire</em> du 10 février 2020
          interdit le brûlage à l’air libre des déchets végétaux ainsi que l’usage d’incinérateurs de jardin
          (<code>article L541-21-1 du code de l’environnement</code>).
        </p>
        <div className="callout">
          <strong>Sanction</strong> : amende pouvant aller jusqu’à <strong>450&nbsp;€</strong>.
        </div>
      </Box>

      {/* Bouton remonter en haut */}
      <Fab
        size="small"
        color="default"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 10 }}
        aria-label="Remonter"
      >
        <ArrowUpward />
      </Fab>
    </HousePageLayout>
  );
}
