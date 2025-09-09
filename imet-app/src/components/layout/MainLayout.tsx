import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  AppBar, Toolbar, Typography, Paper, Box, Button, IconButton, Drawer,
  List, ListItemButton, ListItemIcon, ListItemText, useMediaQuery,
  Collapse, Divider, Menu, MenuItem, useTheme
} from '@mui/material';
import {
  Home, CalendarToday, Settings, Logout, Menu as MenuIcon
} from '@mui/icons-material';
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import { Cottage, Inventory2, FactCheck, Article, ExpandLess, ExpandMore } from '@mui/icons-material';

import { NotificationBadge } from '../NotificationBadge';
import type { User } from '../../types/family';
import { useAuth } from '../../hooks/useAuth';
import { UserDetailsDialog } from '../UserDetailsDialog';
import { userService } from '../../services/userService';
import { NotificationSettingsDialog } from '../NotificationSettingsDialog';
import { NOTICES } from '../../pages/notices/autoNotices';

interface MainLayoutProps {
  user: User;
  onLogoutSuccess: (message: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogoutSuccess }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [openMaison, setOpenMaison] = useState(true);

  const currentPath = location.pathname;
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // ✨ Hauteurs figées
  const TOOLBAR_H = isMobile ? 56 : 64;
  const NAV_H = isMobile ? 0 : 48;      // barre nav desktop

  const handleLogout = async () => {
    const result = await signOut();
    if (result.success) onLogoutSuccess('Déconnexion réussie');
  };

  const go = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const navItems = [
    { label: 'Tableau de bord', path: '/dashboard', icon: <Home /> },
    { label: 'Calendrier', path: '/bookings', icon: <CalendarToday /> },
    { label: 'Mes séjours', path: '/bookings/all', icon: <CalendarToday /> },
    { label: 'Ma Tribu', path: '/tribu', icon: <FamilyRestroomOutlinedIcon /> },
    ...(user.is_admin ? [{ label: 'Administration', path: '/admin', icon: <Settings /> }] : []),
  ];

  const [maisonAnchor, setMaisonAnchor] = useState<null | HTMLElement>(null);
  const maisonOpen = Boolean(maisonAnchor);
  const maisonActive =
    currentPath.startsWith('/maison') ||
    currentPath === '/care/Inventory' ||
    currentPath === '/care/checklists';

  React.useEffect(() => { setOpenMaison(maisonActive); }, [maisonActive]);

  const renderNavButtons = () => {
    const tribuIndex = navItems.findIndex(i => i.path === '/tribu');
    const beforeTribu = tribuIndex === -1 ? navItems : navItems.slice(0, tribuIndex);
    const afterTribu  = tribuIndex === -1 ? []       : navItems.slice(tribuIndex);

    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 1, overflowX: 'auto', whiteSpace: 'nowrap',
        '&::-webkit-scrollbar': { display: 'none' }, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {beforeTribu.map(item => (
          <Button key={item.path} variant={currentPath === item.path ? 'contained' : 'text'}
                  startIcon={item.icon} onClick={() => navigate(item.path)} sx={{ flexShrink: 0 }}>
            {item.label}
          </Button>
        ))}

        <Button variant={maisonActive ? 'contained' : 'text'} startIcon={<Cottage />}
                onClick={(e) => setMaisonAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
          La maison
        </Button>

        {afterTribu.map(item => (
          <Button key={item.path} variant={currentPath === item.path ? 'contained' : 'text'}
                  startIcon={item.icon} onClick={() => navigate(item.path)} sx={{ flexShrink: 0 }}>
            {item.label}
          </Button>
        ))}
      </Box>
    );
  };

  const renderMaisonMenu = () => (
    <Menu
      anchorEl={maisonAnchor}
      open={maisonOpen}
      onClose={() => setMaisonAnchor(null)}
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      PaperProps={{ sx: { maxHeight: '70vh' } }}
    >
      <MenuItem selected={currentPath === '/care/Inventory'}
                onClick={() => { navigate('/care/Inventory'); setMaisonAnchor(null); }}>
        <ListItemIcon><Inventory2 fontSize="small" /></ListItemIcon>
        <ListItemText>Inventaire</ListItemText>
      </MenuItem>

      <MenuItem selected={currentPath === '/care/checklists'}
                onClick={() => { navigate('/care/checklists'); setMaisonAnchor(null); }}>
        <ListItemIcon><FactCheck fontSize="small" /></ListItemIcon>
        <ListItemText>Checks-Lists</ListItemText>
      </MenuItem>

      <Divider />

      {NOTICES.filter(n => !n.hidden).map(n => (
        <MenuItem key={n.path} selected={currentPath === n.path}
                  onClick={() => { navigate(n.path); setMaisonAnchor(null); }}>
          <ListItemIcon>{n.Icon ? <n.Icon fontSize="small" /> : <Article fontSize="small" />}</ListItemIcon>
          <ListItemText>{n.title}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );

  const renderDrawerMenu = () => {
    const tribuIndex = navItems.findIndex(i => i.path === '/tribu');
    const beforeTribu = tribuIndex === -1 ? navItems : navItems.slice(0, tribuIndex);
    const afterTribu  = tribuIndex === -1 ? []       : navItems.slice(tribuIndex);

    return (
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
              PaperProps={{ sx: { width: 280, maxWidth: '100vw', pb: 'env(safe-area-inset-bottom)' } }}>
        <Box role="presentation">
          <Box sx={{ p: 2, pt: `calc(8px + env(safe-area-inset-top))` }}>
            <Typography variant="h6" sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => { setProfileOpen(true); setDrawerOpen(false); }}>
              {user.full_name}
            </Typography>
          </Box>

          <List sx={{ '& .MuiListItemButton-root': { minHeight: 48 } }}>
            {beforeTribu.map(item => (
              <ListItemButton key={item.path} selected={currentPath === item.path} onClick={() => go(item.path)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}

            <ListItemButton onClick={() => setOpenMaison(o => !o)}>
              <ListItemIcon><Cottage /></ListItemIcon>
              <ListItemText primary="La maison" />
              {openMaison ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>

            <Collapse in={openMaison} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                <ListItemButton sx={{ pl: 4 }} selected={currentPath === '/care/Inventory'} onClick={() => go('/care/Inventory')}>
                  <ListItemIcon><Inventory2 /></ListItemIcon>
                  <ListItemText primary="Inventaire" />
                </ListItemButton>
                <ListItemButton sx={{ pl: 4 }} selected={currentPath === '/care/checklists'} onClick={() => go('/care/checklists')}>
                  <ListItemIcon><FactCheck /></ListItemIcon>
                  <ListItemText primary="Checks-Lists" />
                </ListItemButton>

                {NOTICES.filter(n => !n.hidden).map(n => (
                  <ListItemButton key={n.path} sx={{ pl: 4 }} selected={currentPath === n.path} onClick={() => go(n.path)}>
                    <ListItemIcon>{n.Icon ? <n.Icon /> : <Article />}</ListItemIcon>
                    <ListItemText primary={n.title} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>

            {afterTribu.map(item => (
              <ListItemButton key={item.path} selected={currentPath === item.path} onClick={() => go(item.path)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}

            <Divider sx={{ my: 1 }} />

            <ListItemButton onClick={handleLogout}>
              <ListItemIcon><Logout /></ListItemIcon>
              <ListItemText primary="Déconnexion" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    );
  };

  return (
    <Box sx={{ maxWidth: '100vw', overflowX: 'hidden', bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* 1) MENU fixé */}
      <AppBar position="fixed" elevation={0} sx={{ top: 0, pt: 'env(safe-area-inset-top)', zIndex: (t) => t.zIndex.appBar }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {isMobile && (
            <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu">
              <MenuIcon />
            </IconButton>
          )}
          <Home sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            IMet - Gestion Maison Familiale
          </Typography>

          {!isMobile && (
            <>
              <Typography variant="body2" sx={{ mr: 2, cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => setProfileOpen(true)}>
                {user.full_name}
              </Typography>
              <NotificationBadge userId={user.id} onOpenSettings={() => setNotifSettingsOpen(true)} />
              <Button color="inherit" startIcon={<Logout />} onClick={handleLogout}>Déconnexion</Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* 2) NAV desktop fixée sous le menu */}
      {!isMobile && (
        <Paper elevation={1}
               sx={{
                 position: 'fixed',
                 top: TOOLBAR_H,
                 left: 0,
                 right: 0,
                 height: NAV_H,
                 display: 'flex',
                 alignItems: 'center',
                 zIndex: (t) => t.zIndex.appBar - 1,
               }}>
          {renderNavButtons()}
          {renderMaisonMenu()}
        </Paper>
      )}

      {/* 3) Contenu : on pousse assez bas pour libérer menu + nav + bandeau */}
      <Box
        sx={{
          // Push uniquement sous le header (AppBar + nav desktop si présente),
          // la valeur vient de --imet-header-offset mesurée plus haut.
          pt: 'calc(var(--imet-header-offset, 48px) + 1px)',
          px: { xs: 2, sm: 3 },
          pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 3 },
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}
      >
        <Outlet />
      </Box>


      <UserDetailsDialog
        open={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onSave={async (updatedUser) => {
          const { error } = await userService.updateUser(user.id, updatedUser);
          if (error) enqueueSnackbar(`Erreur : ${error}`, { variant: 'error' });
          else enqueueSnackbar('Profil mis à jour', { variant: 'success' });
          setProfileOpen(false);
        }}
      />

      {isMobile && renderDrawerMenu()}

      <NotificationSettingsDialog open={notifSettingsOpen} userId={user.id} onClose={() => setNotifSettingsOpen(false)} />
    </Box>
  );
};
