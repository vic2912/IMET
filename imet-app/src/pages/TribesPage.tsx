// src/pages/TribesPage.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  Alert,
  Toolbar,
} from '@mui/material';

import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';

import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';

import { FamilyRelationsDialog } from '../components/FamilyRelationsDialog';
import { CreateGuestDialog } from '../components/CreateGuestDialog';
import { FamilyTree } from '../components/FamilyTree';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { FamilyMapFullScreen } from '../components/FamilyMapFullScreen';

const TribesPage: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [openMap, setOpenMap] = useState(false);
  const [openRelDialog, setOpenRelDialog] = useState(false);
  const [openGuestDialog, setOpenGuestDialog] = useState(false);
  const [relationPreset, setRelationPreset] = useState<{
    id: string;
    full_name: string;
    is_guest?: boolean;
  } | null>(null);

  useEffect(() => {
    // debug léger
    // eslint-disable-next-line no-console
    //console.groupCollapsed('👪 [MaTribu] mount');
    // eslint-disable-next-line no-console
    //console.log('auth user:', user?.id, user?.full_name);
    // eslint-disable-next-line no-console
    //console.groupEnd();
  }, [user]);

  if (loading) return null;

  if (!isAuthenticated || !user) {
    return (
      <Box p={2}>
        <Alert severity="warning">Veuillez vous connecter.</Alert>
      </Box>
    );
  }

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Toolbar />
      </Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <FamilyRestroomIcon />
          <Typography variant="h5" fontWeight={700}>
            Ma Tribu
          </Typography>
        </Stack>
        <Box flex={1} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Arbre généalogique">
            <IconButton onClick={() => setOpenMap(true)}>
              <ZoomOutMapIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Ajouter une relation">
            <IconButton
              onClick={() => {
                setRelationPreset(null);
                setOpenRelDialog(true);
              }}
            >
              <LinkOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Créer un invité">
            <IconButton onClick={() => setOpenGuestDialog(true)}>
              <PersonAddAlt1OutlinedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1, display: 'block' }}
      >
        Astuce : cliquez pour naviguer dans l’arbre.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* Arbre généalogique (3 générations) */}
      <FamilyTree rootId={user.id} rootName={user.full_name} />

      <FamilyMapFullScreen
        open={openMap}
        rootId={user.id}
        onClose={() => setOpenMap(false)}
      />

      {/* Dialog: Créer un invité */}
      <CreateGuestDialog
        open={openGuestDialog}
        onClose={() => setOpenGuestDialog(false)}
        onSubmit={async (data) => {
          if (!user) return false;
          try {
            const res = await userService.createGuestProfile(data);
            if (res.error || !res.data) return false;

            // Fermer le modal et ouvrir "Ajouter une relation" pré-rempli
            setOpenGuestDialog(false);
            setRelationPreset({
              id: res.data.id,
              full_name: res.data.full_name,
              is_guest: true,
            });
            setOpenRelDialog(true);
            return true;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            return false;
          }
        }}
      />

      {/* Dialog: Ajouter une relation */}
      <FamilyRelationsDialog
        open={openRelDialog}
        onClose={() => {
          setOpenRelDialog(false);
          setRelationPreset(null); // reset preset
        }}
        userId={user.id}
        userName={user.full_name || 'Moi'}
        initialAddMode={!!relationPreset}
        preset={relationPreset}
        presetRelationshipType="child" // défaut utile; modifiable dans le dialogue
      />
    </Box>
    
  );
  
};

export default TribesPage;
