// src/pages/AdminUsersPage.tsx
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom"; 
import {
  Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Divider, IconButton, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Person, PersonAdd, AdminPanelSettings, Delete } from '@mui/icons-material';
import { CreateUserDialog } from '../components/CreateUsersDialog';
import type { User, Guest } from '../types/family';
import { UserDetailsDialog } from '../components/UserDetailsDialog';
import { useSnackbar } from 'notistack';
import { userService } from '../services/userService';
import { useUserList } from '../hooks/useUserList';
import { CreateGuestDialog } from '../components/CreateGuestDialog';

export const AdminUsersPage: React.FC = () => {
  const { data: users, isLoading, refetch } = useUserList();
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [openCreateGuest, setOpenCreateGuest] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // ≤ sm

  const handleCreateUser = async (data: any) => {
    const user = await userService.createUser(data);
    if (user.error) {
      enqueueSnackbar('Erreur lors de la création', { variant: 'error' });
      return false;
    }
    enqueueSnackbar('Utilisateur créé avec succès', { variant: 'success' });
    refetch();
    return true;
  };

  const handleCreateGuest = async (data: Omit<Guest, 'id' | 'created_at'>) => {
    const result = await userService.createGuestProfile(data);
    if (result.error) {
      enqueueSnackbar('Erreur lors de la création du participant', { variant: 'error' });
      return false;
    }
    enqueueSnackbar('Participant invité créé avec succès', { variant: 'success' });
    refetch();
    return true;
  };

  const handleSaveUser = async (updatedUser: Partial<User>) => {
    if (!updatedUser.id) return;
    const result = await userService.updateUser(updatedUser.id, updatedUser);
    if (!result.error) {
      enqueueSnackbar('Utilisateur mis à jour', { variant: 'success' });
      refetch();
    } else {
      enqueueSnackbar('Erreur lors de la mise à jour', { variant: 'error' });
    }
  };

  const getStatut = (user: User) => {
    if (user.birth_date) {
      const age = (new Date().getFullYear()) - (new Date(user.birth_date).getFullYear());
      if (age < 18) return "Enfant";
    }
    return user.is_student ? "Étudiant" : "Adulte";
  };

  /* ---------- Composant carte mobile (mêmes informations que la table) ---------- */
  const MobileUserCard: React.FC<{ user: User }> = ({ user }) => {
    const roleLabel = user.is_active ? (user.is_admin ? "Administrateur" : "Utilisateur") : "Inactif";
    return (
      <Paper
        variant="outlined"
        sx={{ p: 1.5, cursor: 'pointer' }}
        onClick={() => setSelectedUser(user)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {user.is_admin ? <AdminPanelSettings color="primary" /> : <Person />}
          <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }} noWrap title={user.full_name}>
            {user.full_name}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1 }} />

        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 84 }}>
              Email
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {user.email}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 84 }}>
              Profil
            </Typography>
            <Typography variant="body2">{roleLabel}</Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 84 }}>
              Statut
            </Typography>
            <Typography variant="body2">{getStatut(user)}</Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 84 }}>
              Allergies
            </Typography>
            <Typography variant="body2">{user.allergies || "Aucune"}</Typography>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Box>
      {/* Header + actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        mb={3}
      >
        <Typography variant="h5">Gestion des utilisateurs</Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Button
            startIcon={<PersonAdd />}
            onClick={() => navigate('/admin/create-user')}
            sx={{ mr: { sm: 1, xs: 0 } }}
            fullWidth={isMobile}
          >
            Créer un utilisateur
          </Button>

          <Button
            startIcon={<Person />}
            onClick={() => setOpenCreateGuest(true)}
            sx={{ mr: { sm: 1, xs: 0 } }}
            fullWidth={isMobile}
          >
            Ajouter un contact sans compte
          </Button>

          <Button onClick={() => refetch()} fullWidth={isMobile}>
            Actualiser
          </Button>
        </Stack>
      </Stack>

      {/* Contenu */}
      {isLoading ? (
        <Stack alignItems="center"><CircularProgress /></Stack>
      ) : (
        <>
          {/* Desktop / tablette large : table inchangée */}
          {!isMobile && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Profil</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Allergies</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users?.map((user) => {
                    const roleLabel = user.is_active ? (user.is_admin ? "Administrateur" : "Utilisateur") : "Inactif";
                    return (
                      <TableRow
                        key={user.id}
                        hover
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedUser(user)}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {user.is_admin ? <AdminPanelSettings color="primary" /> : <Person />}
                            {user.full_name}
                          </Stack>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{roleLabel}</TableCell>
                        <TableCell>{getStatut(user)}</TableCell>
                        <TableCell>{user.allergies || "Aucune"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Mobile : cartes listant les mêmes infos */}
          {isMobile && (
            <Stack spacing={1.25}>
              {users?.map((u) => (
                <MobileUserCard key={u.id} user={u} />
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Dialogues */}
      <CreateUserDialog
        open={openCreateUser}
        onClose={() => setOpenCreateUser(false)}
        onSubmit={handleCreateUser}
      />

      <Dialog open={!!userToDelete} onClose={() => setUserToDelete(null)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>Voulez-vous vraiment supprimer cet utilisateur ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserToDelete(null)}>Annuler</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => setUserToDelete(null)}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <UserDetailsDialog
        open={!!selectedUser}
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSave={handleSaveUser}
      />

      <CreateGuestDialog
        open={openCreateGuest}
        onClose={() => setOpenCreateGuest(false)}
        onSubmit={handleCreateGuest}
      />
    </Box>
  );
};
