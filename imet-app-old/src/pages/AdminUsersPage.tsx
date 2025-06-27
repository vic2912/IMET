// src/pages/AdminUsersPage.tsx

import React, { useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, FormControlLabel, Switch
} from '@mui/material';
import { Person, PersonAdd, AdminPanelSettings, Delete } from '@mui/icons-material';
import { useUsers } from '../hooks/useUsers';
import { CreateUserDialog } from '../components/CreateUsersDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { User } from '../types/family';
import { UserDetailsDialog } from '../components/UserDetailsDialog';
import { userService } from '../services/userService';
import { useSnackbar } from 'notistack';

export const AdminUsersPage: React.FC = () => {
  const { users, loading, createUser, refreshUsers } = useUsers();
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleCreateUser = async (data: any) => {
    const user = await createUser(data);
    return !!user;
  };

  const handleSaveUser = async (updatedUser: Partial<User>) => {
    if (!updatedUser.id) return;
    const result = await userService.updateUser(updatedUser.id, updatedUser);
    if (!result.error) {
      enqueueSnackbar('Utilisateur mis à jour', { variant: 'success' });
      refreshUsers();
    } else {
      enqueueSnackbar('Erreur lors de la mise à jour', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Gestion des utilisateurs</Typography>
        <Box>
          <Button startIcon={<PersonAdd />} onClick={() => setOpenCreateUser(true)} sx={{ mr: 2 }}>
            Créer un utilisateur
          </Button>
          <Button onClick={refreshUsers}>Actualiser</Button>
        </Box>
      </Box>

      {loading ? (
        <Stack alignItems="center"><CircularProgress /></Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Inscription</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
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
                    <Chip
                      label={user.is_admin ? 'Admin' : 'Utilisateur'}
                      color={user.is_admin ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <IconButton color="error" onClick={(e) => {
                      e.stopPropagation();
                      setUserToDelete(user.id);
                    }}>
                      <Delete />
                    </IconButton>
                  </TableCell>
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
    </Box>
  );
};
