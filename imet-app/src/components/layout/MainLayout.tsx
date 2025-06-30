import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { AppBar, Toolbar, Typography, Paper, Box, Button, IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, useMediaQuery } from '@mui/material';
import { Home, CalendarToday, Euro, Settings, Logout, Menu as MenuIcon } from '@mui/icons-material';
import { NotificationBadge } from '../NotificationBadge';
import type { User } from '../../types/family';
import { useAuth } from '../../hooks/useAuth';
import { UserDetailsDialog } from '../UserDetailsDialog';
import { userService } from '../../services/userService';

interface MainLayoutProps {
  user: User;
  onLogoutSuccess: (message: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogoutSuccess }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:600px)');
  
  const currentPath = location.pathname;
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const handleLogout = async () => {
    const result = await signOut();
    if (result.success) {
      onLogoutSuccess('Déconnexion réussie');
    }
  };

  const navItems = [
    { label: 'Tableau de bord', path: '/dashboard', icon: <Home /> },
    { label: 'Calendrier', path: '/bookings', icon: <CalendarToday /> },
    { label: 'Dépenses', path: '/expenses', icon: <Euro /> },
    { label: 'Mes séjours', path: '/bookings/all', icon: <CalendarToday /> },
    ...(user.is_admin ? [{ label: 'Administration', path: '/admin', icon: <Settings /> }] : [])
  ];

  const renderNavButtons = () => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {navItems.map(item => (
        <Button
          key={item.path}
          variant={currentPath === item.path ? 'contained' : 'text'}
          startIcon={item.icon}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  );

  const renderDrawerMenu = () => (
    <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
      <Box sx={{ width: 250 }} role="presentation" onClick={() => setDrawerOpen(false)}>
        <List>
          {navItems.map(item => (
            <ListItemButton key={item.path} onClick={() => navigate(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon><Logout /></ListItemIcon>
            <ListItemText primary="Déconnexion" />
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  );

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Home sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            IMet - Gestion Maison Familiale
          </Typography>
          {!isMobile && (
            <>
              <Typography
                variant="body2"
                sx={{ mr: 2, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setProfileOpen(true)}
              >
                {user.full_name}
              </Typography>
              <NotificationBadge userId={user.id} />
              <Button color="inherit" startIcon={<Logout />} onClick={handleLogout}>
                Déconnexion
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      {!isMobile && (
        <Paper elevation={1}>
          <Box sx={{ p: 1 }}>{renderNavButtons()}</Box>
        </Paper>
      )}

      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>

      <UserDetailsDialog
        open={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onSave={async (updatedUser) => {
          const { error } = await userService.updateUser(user.id, updatedUser);
          if (error) {
            enqueueSnackbar(`Erreur : ${error}`, { variant: 'error' });
          } else {
            enqueueSnackbar('Profil mis à jour', { variant: 'success' });
          }
          setProfileOpen(false);
        }}
      />

      {isMobile && renderDrawerMenu()}
    </Box>
  );
};
