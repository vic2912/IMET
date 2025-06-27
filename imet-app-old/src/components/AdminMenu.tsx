// src/components/AdminMenu.tsx

import React from 'react';
import {
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton
} from '@mui/material';
import { Home, People, Event, FamilyRestroom } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export const AdminMenu: React.FC = () => {
  const navigate = useNavigate();

  return (
    <List>

      <ListItemButton onClick={() => navigate('/admin/utilisateurs')}>
        <ListItemIcon><People /></ListItemIcon>
        <ListItemText primary="Utilisateurs" />
      </ListItemButton>

      <ListItemButton onClick={() => navigate('/admin/evenements')}>
        <ListItemIcon><Event /></ListItemIcon>
        <ListItemText primary="Événements" />
      </ListItemButton>
    </List>
  );
};