// src/components/AdminMenu.tsx

import React from 'react';
import {
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton
} from '@mui/material';
import { Home, People, Event, FamilyRestroom, MonetizationOn } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export const AdminMenu: React.FC = () => {
  const navigate = useNavigate();

  return (
    <List>

      <ListItemButton onClick={() => navigate('/admin/utilisateurs')}>
        <ListItemIcon><People /></ListItemIcon>
        <ListItemText primary="Utilisateurs" />
      </ListItemButton>

      <ListItemButton onClick={() => navigate('/admin/bookings')}>
        <ListItemIcon><FamilyRestroom /></ListItemIcon>
        <ListItemText primary="Tous les séjours" />
      </ListItemButton>


      <ListItemButton onClick={() => navigate('/admin/evenements')}>
        <ListItemIcon><Event /></ListItemIcon>
        <ListItemText primary="Événements" />
      </ListItemButton>

      <ListItemButton onClick={() => navigate('/admin/tarifs')}>
        <ListItemIcon><MonetizationOn /></ListItemIcon>
        <ListItemText primary="Tarifs" />
      </ListItemButton>
    </List>
  );
};