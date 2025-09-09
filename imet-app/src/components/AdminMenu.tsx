import React from 'react';
import {
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';
import {
  Home,
  People,
  FamilyRestroom,
  MonetizationOn,
  FactCheck,
  Inventory2,
  ExitToApp,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

type Props = {
  onNavigate?: () => void; // appelé pour fermer le drawer en mobile
};

export const AdminMenu: React.FC<Props> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (to: string) => {
    navigate(to);
    onNavigate?.(); // ferme le Drawer si mobile
  };

  return (
    <List sx={{ width: '100%', py: 0 }}>
      <ListItemButton selected={pathname === '/admin'} onClick={() => go('/admin')}>
        <ListItemIcon><Home /></ListItemIcon>
        <ListItemText primary="Dashboard" />
      </ListItemButton>

      <Divider sx={{ my: 1 }} />

      <ListItemButton selected={pathname.startsWith('/admin/utilisateurs')} onClick={() => go('/admin/utilisateurs')}>
        <ListItemIcon><People /></ListItemIcon>
        <ListItemText primary="Utilisateurs" />
      </ListItemButton>

      <ListItemButton selected={pathname.startsWith('/admin/bookings')} onClick={() => go('/admin/bookings')}>
        <ListItemIcon><FamilyRestroom /></ListItemIcon>
        <ListItemText primary="Tous les séjours" />
      </ListItemButton>

      {/* 
      <ListItemButton selected={pathname.startsWith('/admin/familles')} onClick={() => go('/admin/familles')}>
        <ListItemIcon><FamilyRestroom /></ListItemIcon>
        <ListItemText primary="Familles" />
      </ListItemButton>
      */}

      <ListItemButton selected={pathname.startsWith('/admin/tarifs')} onClick={() => go('/admin/tarifs')}>
        <ListItemIcon><MonetizationOn /></ListItemIcon>
        <ListItemText primary="Tarifs" />
      </ListItemButton>

      <Divider sx={{ my: 1 }} />

      <ListItemButton selected={pathname.startsWith('/admin/checklists')} onClick={() => go('/admin/checklists')}>
        <ListItemIcon><FactCheck /></ListItemIcon>
        <ListItemText primary="Checklists" />
      </ListItemButton>

      <ListItemButton selected={pathname.startsWith('/admin/inventory')} onClick={() => go('/admin/inventory')}>
        <ListItemIcon><Inventory2 /></ListItemIcon>
        <ListItemText primary="Inventaire" />
      </ListItemButton>

      <Divider sx={{ my: 1 }} />
      <ListItemButton onClick={() => navigate('/dashboard')}>
        <ListItemIcon><ExitToApp color="error" /></ListItemIcon>
        <ListItemText primary="Quitter l'administration" />
      </ListItemButton>

    </List>
  );
};

export default AdminMenu;
