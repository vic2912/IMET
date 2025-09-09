import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  Box,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
import { AdminMenu } from '../components/AdminMenu';

const DRAWER_WIDTH = 260;

const AdminPanelPage: React.FC = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton edge="start" onClick={handleOpen} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap>
            Espace Admin
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Drawer (responsive) */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {/* Mobile: temporary */}
        {!isDesktop && (
          <Drawer
            variant="temporary"
            open={open}
            onClose={handleClose}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: DRAWER_WIDTH } }}
          >
            <Box sx={{ mt: '64px' /* hauteur AppBar */ }}>
              <AdminMenu onNavigate={handleClose} />
            </Box>
          </Drawer>
        )}

        {/* Desktop: permanent */}
        {isDesktop && (
          <Drawer
            variant="permanent"
            open
            PaperProps={{ sx: { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
          >
            <Toolbar />
            <AdminMenu />
          </Drawer>
        )}
      </Box>

      {/* Contenu */}
     <Box
        component="main"
        // NB: on laisse le scroll aux pages internes (overflow ici sur hidden)
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          p: { xs: 2, md: 3 },
          overflow: 'hidden',
          // ces 2 variables sont lues par les pages (dont AdminDashboardPage)
          '--admin-rail-offset': { md: `${DRAWER_WIDTH}px` },
          '--imet-header-offset': { xs: '56px', md: '64px' }, // hauteur Toolbar MUI
          bgcolor: 'background.default',
        }}
      >
        {/* espace sous AppBar */}
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminPanelPage;
