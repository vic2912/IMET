// src/components/CalendarLegend.tsx

import React from 'react';
import { Stack, Chip, Typography } from '@mui/material';
import type { SxProps } from '@mui/material';

export const CalendarLegend: React.FC<{ sx?: SxProps }> = ({ sx }) => {
  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label="Présence" sx={{ bgcolor: '#c8e6c9' }} />
        <Typography variant="caption" color="text.secondary">Au moins une présence</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label="Sur-occupé" sx={{ bgcolor: '#ffcdd2' }} />
        <Typography variant="caption" color="text.secondary">{'> 13 personnes'}</Typography>
      </Stack>
    </Stack>
  );
};
