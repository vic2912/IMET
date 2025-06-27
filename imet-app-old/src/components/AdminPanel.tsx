// src/components/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Stack,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Settings,
  People,
  Euro,
  AdminPanelSettings,
  Person,
  Save,
  Refresh,
  Delete,
  Warning,
  PersonAdd
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdmin } from '../hooks/useAdmin';
import { User, UpdatePricingData } from '../types/admin';
import { CreateUserDialog } from './CreateUsersDialog';

interface AdminPanelProps {
  currentUserId: string;
  onShowNotification: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserId, onShowNotification }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [pricingForm, setPricingForm] = useState<UpdatePricingData>({});
  const [openCreateUser, setOpenCreateUser] = useState(false);

  const {
    users,
    pricingSettings,
    stats,
    loading,
    error,
    loadUsers,
    loadPricingSettings,
    loadStats,
    toggleUserAdmin,
    deleteUser,
    updatePricing,
    createUser
  } = useAdmin();

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (pricingSettings) {
      setPricingForm({
        night_price: pricingSettings.night_price,
        day_price: pricingSettings.day_price,
        max_capacity: pricingSettings.max_capacity,
        currency: pricingSettings.currency
      });
    }
  }, [pricingSettings]);

  useEffect(() => {
    if (error) {
      onShowNotification(error, 'error');
    }
  }, [error, onShowNotification]);

  const loadAllData = async () => {
    await Promise.all([
      loadUsers(),
      loadPricingSettings(),
      loadStats()
    ]);
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUserId && currentStatus) {
      onShowNotification('Vous ne pouvez pas vous retirer les droits administrateur', 'warning');
      return;
    }
    const result = await toggleUserAdmin(userId, !currentStatus);
    if (result.success) {
      onShowNotification(`Utilisateur ${!currentStatus ? 'promu administrateur' : 'rétrogradé en utilisateur'}`, 'success');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUserId) {
      onShowNotification('Vous ne pouvez pas supprimer votre propre compte', 'warning');
      return;
    }
    const result = await deleteUser(userToDelete.id);
    if (result.success) {
      onShowNotification('Utilisateur supprimé avec succès', 'success');
    }
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleSavePricing = async () => {
    if (!pricingForm.night_price || !pricingForm.day_price || !pricingForm.max_capacity) {
      onShowNotification('Veuillez remplir tous les champs', 'warning');
      return;
    }
    if (pricingForm.night_price <= 0 || pricingForm.day_price <= 0 || pricingForm.max_capacity <= 0) {
      onShowNotification('Les valeurs doivent être positives', 'warning');
      return;
    }
    const result = await updatePricing(pricingForm);
    if (result.success) {
      onShowNotification('Tarifs mis à jour avec succès', 'success');
    }
  };

  const renderPricingTab = () => (
    <Stack spacing={3}>
      <Typography variant="h6" display="flex" alignItems="center">
        <Euro sx={{ mr: 1 }} /> Gestion des tarifs
      </Typography>
      <Alert severity="info">Définissez les tarifs pour les nuitées et les journées...</Alert>
      <Card>
        <CardContent>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)' }} gap={3} mb={3}>
            <TextField label="Tarif nuit" type="number" value={pricingForm.night_price || ''} onChange={(e) => setPricingForm({ ...pricingForm, night_price: parseFloat(e.target.value) || 0 })} fullWidth />
            <TextField label="Tarif jour" type="number" value={pricingForm.day_price || ''} onChange={(e) => setPricingForm({ ...pricingForm, day_price: parseFloat(e.target.value) || 0 })} fullWidth />
            <TextField label="Capacité max" type="number" value={pricingForm.max_capacity || ''} onChange={(e) => setPricingForm({ ...pricingForm, max_capacity: parseInt(e.target.value) || 0 })} fullWidth />
            <TextField label="Devise" value={pricingForm.currency || 'EUR'} disabled fullWidth />
          </Box>
          <Button variant="contained" startIcon={<Save />} onClick={handleSavePricing} disabled={loading}>Sauvegarder les tarifs</Button>
        </CardContent>
      </Card>
    </Stack>
  );

  const renderStatsTab = () => (
    <Stack spacing={3}>
      <Typography variant="h6" display="flex" alignItems="center">
        <Settings sx={{ mr: 1 }} /> Statistiques globales
      </Typography>
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={3}>
        <Card><CardContent><Typography>Utilisateurs</Typography><Typography variant="h4">{stats.totalUsers}</Typography></CardContent></Card>
        <Card><CardContent><Typography>Admins</Typography><Typography variant="h4">{stats.totalAdmins}</Typography></CardContent></Card>
        <Card><CardContent><Typography>Réservations</Typography><Typography variant="h4">{stats.totalBookings}</Typography></CardContent></Card>
        <Card><CardContent><Typography>Revenus</Typography><Typography variant="h4" color="primary">{stats.totalRevenue} €</Typography></CardContent></Card>
      </Box>
    </Stack>
  );

  if (loading && !users.length && !pricingSettings) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px"><Stack alignItems="center" spacing={2}><CircularProgress /><Typography>Chargement de l'administration...</Typography></Stack></Box>;
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Administration</Typography>

      <Paper>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label="Utilisateurs" />
          <Tab label="Tarifs" />
          <Tab label="Statistiques" />
        </Tabs>
        <Box p={3}>
          {currentTab === 0 && (
            <>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6"><People sx={{ mr: 1 }} /> Utilisateurs</Typography>
                <Box>
                  <Button startIcon={<PersonAdd />} onClick={() => setOpenCreateUser(true)} sx={{ mr: 1 }}>
                    Créer un utilisateur
                  </Button>
                  <Button startIcon={<Refresh />} onClick={loadUsers} disabled={loading}>Actualiser</Button>
                </Box>
              </Box>
              <Alert severity="info">Vous pouvez promouvoir...</Alert>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead><TableRow><TableCell>Nom</TableCell><TableCell>Email</TableCell><TableCell>Statut</TableCell><TableCell>Inscription</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell><Box display="flex" alignItems="center">{user.is_admin ? <AdminPanelSettings color="primary" sx={{ mr: 1 }} /> : <Person sx={{ mr: 1 }} />} {user.full_name}</Box></TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><Chip label={user.is_admin ? 'Admin' : 'Utilisateur'} color={user.is_admin ? 'primary' : 'default'} /></TableCell>
                        <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                        <TableCell><Stack direction="row" spacing={1}>
                          <FormControlLabel control={<Switch checked={user.is_admin} onChange={() => handleToggleAdmin(user.id, user.is_admin)} />} label="Admin" />
                          <IconButton color="error" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}><Delete /></IconButton>
                        </Stack></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {currentTab === 1 && renderPricingTab()}
          {currentTab === 2 && renderStatsTab()}
        </Box>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle><Warning color="error" sx={{ mr: 1 }} /> Confirmer suppression</DialogTitle>
        <DialogContent><Typography>Supprimer {userToDelete?.full_name} ?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button color="error" startIcon={<Delete />} onClick={handleDeleteUser}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      <CreateUserDialog
        open={openCreateUser}
        onClose={() => setOpenCreateUser(false)}
        onSubmit={async (data) => {
          const result = await createUser(data);
          if (result.success) {
            onShowNotification('Utilisateur créé', 'success');
            loadUsers();
            return true;
          } else {
            onShowNotification('Erreur : ' + result.error, 'error');
            return false;
          }
        }}
      />
    </Box>
  );
};
