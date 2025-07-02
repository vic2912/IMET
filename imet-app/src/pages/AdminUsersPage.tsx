// src/pages/AdminUsersPage.tsx

import React, { useState } from 'react';
import { useNavigate } from "react-router-dom"; 
import {
  Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography
} from '@mui/material';
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Gestion des utilisateurs</Typography>
        <Box>
        <Button startIcon={<PersonAdd />} onClick={() => navigate('/admin/create-user')} sx={{ mr: 2 }}>
          Créer un utilisateur
        </Button>
        <Button
          startIcon={<Person />}
          onClick={() => setOpenCreateGuest(true)}
          sx={{ mr: 2 }}
          >
            Ajouter un contact sans compte
        </Button>
          <Button onClick={() => refetch()}>Actualiser</Button>
        </Box>
      </Box>

      {isLoading ? (
        <Stack alignItems="center"><CircularProgress /></Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table>
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
              {users?.map((user) => (

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
                  <TableCell>
                    {user.is_active ? (user.is_admin ? "Administrateur" : "Utilisateur") : "Inactif"}
                  </TableCell>
                  <TableCell>{getStatut(user)}</TableCell>
                  <TableCell>{user.allergies || "Aucune"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
