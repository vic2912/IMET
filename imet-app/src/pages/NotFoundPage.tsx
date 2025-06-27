import React from 'react';
import {
  Box,
  Typography,
} from '@mui/material';

export const NotFoundPage: React.FC = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
    <Typography variant="h4" color="textSecondary">
      Page non trouvée (404)
    </Typography>
  </Box>
);