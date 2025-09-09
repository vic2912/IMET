// src/pages/maison/HousePageLayout.tsx
import React from 'react';
import { Box, Container, Stack, Typography, Divider, Link as MLink } from '@mui/material';
import { Link } from 'react-router-dom';

type Props = {
  /** Titre de la page (affiché en haut) */
  title: string;
  /** Image bandeau optionnelle (affichée sous le titre) */
  coverSrc?: string;
  /** Contenu de la page (sections, images, etc.) */
  children: React.ReactNode;
  /** Lien “retour” (par défaut /maison si tu fais un index, sinon /dashboard) */
  backTo?: string;
  /** Sous-titre/description courte optionnelle sous le titre */
  subtitle?: React.ReactNode;
};

export default function HousePageLayout({
  title,
  coverSrc,
  children,
  backTo = '/maison',
  subtitle,
}: Props) {
  return (
    <Box sx={{ py: 3 }}>
      <Container maxWidth="md">
        <Stack spacing={2}>
          {/* En-tête */}

          {subtitle && (
            <Typography color="text.secondary">{subtitle}</Typography>
          )}


          <Divider />

          {/* Zone de contenu “prose-like” */}
          <Box
            sx={{
              '& h2': { fontSize: 22, fontWeight: 700, mt: 2 },
              '& h3': { fontSize: 18, fontWeight: 700, mt: 2 },
              '& p': { lineHeight: 1.7, mt: 1 },
              '& ul, & ol': { pl: 3, mt: 1, lineHeight: 1.7 },
              '& li + li': { mt: 0.5 },
              '& a': { color: 'primary.main' },
              '& code': {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                bgcolor: 'action.hover',
                px: 0.5,
                borderRadius: 0.5,
                fontSize: '0.95em',
              },
              '& pre': {
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'action.hover',
                overflow: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              },
              '& img': { width: '100%', height: 'auto', display: 'block', borderRadius: 1.5 },
              '& figure': { m: 0, mt: 1.5, textAlign: 'center' },
              '& figcaption': { fontSize: 12, color: 'text.secondary', mt: 0.5 },
              '& hr': { my: 2, border: 0, height: 1, bgcolor: 'divider' },
              // petits encadrés
              '& .callout': {
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
                p: 2,
                borderRadius: 1,
                mt: 2,
              },
            }}
          >
            {children}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
