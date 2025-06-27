// src/pages/AdminDashboardPage.tsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AdminDashboardPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tableau de bord admin
      </Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography>Bienvenue sur l’interface d’administration.</Typography>
        <Typography>
          Sélectionnez un onglet dans le menu pour gérer les utilisateurs, relations familiales ou événements.
        </Typography>
      </Paper>
    </Box>
  );
};

export default AdminDashboardPage;
