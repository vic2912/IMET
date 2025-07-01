import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Switch, FormControlLabel, Box, Stack,
  Typography, MenuItem, Select, InputLabel, FormControl,
  IconButton, Autocomplete
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { User, RelationshipType, FamilyRelation } from '../types/family';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';

const relationshipLabels: Record<RelationshipType, [string, string]> = {
  parent: ['Parent de', 'Enfant de'],
  child: ['Enfant de', 'Parent de'],
  spouse: ['Conjoint(e) de', 'Conjoint(e) de'],
  sibling: ['Frère/Sœur de', 'Frère/Sœur de'],
  grandparent: ['Grand-parent de', 'Petit-enfant de'],
  grandchild: ['Petit-enfant de', 'Grand-parent de']
};

interface UserDetailsDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (updatedUser: Partial<User>) => void;
}

export const UserDetailsDialog: React.FC<UserDetailsDialogProps> = ({ open, user, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [newRelationUser, setNewRelationUser] = useState<User | null>(null);
  const [newRelationType, setNewRelationType] = useState<RelationshipType>('child');
  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const loadRelations = async () => {
    if (!user) return;
    const { data } = await userService.getUserFamilyRelations(user.id);
    if (data) setRelations(data);
  };

  useEffect(() => {
    if (user) {
      setFormData({ ...user });
      loadRelations(); 
      loadAllUsers();
    }
  }, [user]);

  const loadAllUsers = async () => {
    const result = await userService.getUsers();
    const list = result.data || [];
    setAllUsers(list.filter(u => u.id !== user?.id));
  };

  const handleChange = (field: keyof User, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  const handleAddRelation = async () => {
    if (!newRelationUser || !user) return;
    const res = await userService.addFamilyRelation({
      user_id: user.id,
      related_user_id: newRelationUser.id,
      relationship_type: newRelationType
    });
    if (res.error) {
      enqueueSnackbar(res.error, { variant: 'warning' });
      return;
    }
    await loadRelations();
    setNewRelationUser(null);
    setNewRelationType('child');
  };

  const handleDeleteRelation = async (relationId: string) => {
    await userService.removeFamilyRelation(relationId);
    await loadRelations();
  };

  const getRelationLabel = (type: RelationshipType, isSource: boolean): string => {
    return relationshipLabels[type][isSource ? 0 : 1];
  };

  const { user: currentUser } = useAuth();

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Modifier l'utilisateur</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Nom complet"
            fullWidth
            value={formData.full_name || ''}
            onChange={(e) => handleChange('full_name', e.target.value)}
          />
          <TextField
            label="Email"
            fullWidth
            type="email"
            value={formData.email || ''}
            disabled
            helperText="L'email ne peut pas être modifié."
          />

          <TextField
            label="Téléphone"
            fullWidth
            value={formData.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
          <TextField
            label="Allergies (séparées par virgule)"
            fullWidth
            value={formData.allergies || ''}
            onChange={(e) => handleChange('allergies', e.target.value)}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date de naissance"
              value={formData.birth_date ? new Date(formData.birth_date) : null}
              onChange={(date) => handleChange('birth_date', date?.toISOString())}
            />
          </LocalizationProvider>

            {currentUser && currentUser.is_admin && (
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active ?? true}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                    />
                  }
                  label="Compte actif"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_admin ?? false}
                      onChange={(e) => handleChange('is_admin', e.target.checked)}
                    />
                  }
                  label="Administrateur"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_student ?? false}
                      onChange={(e) => handleChange('is_student', e.target.checked)}
                    />
                  }
                  label="Étudiant"
                />
              </Stack>
            )}

        </Stack>

        <Box mt={4}>
          <Typography variant="subtitle1">Relations familiales</Typography>
          {relations.map((r) => (
            <Box key={r.id} sx={{ border: '1px solid #ddd', borderRadius: 2, padding: 2, marginTop: 1, backgroundColor: '#fafafa' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography fontWeight="bold">
                  {getRelationLabel(r.relationship_type, r.user_id === user.id)} {r.related_user?.full_name}
                </Typography>
                <IconButton onClick={() => handleDeleteRelation(r.id)}><Delete /></IconButton>
              </Box>
            </Box>
          ))}

          <Box mt={2} display="flex" gap={2} alignItems="center">
            <Autocomplete
              sx={{ flex: 2 }}
              options={allUsers}
              getOptionLabel={(option) => option.full_name}
              value={newRelationUser}
              onChange={(_, value) => setNewRelationUser(value)}
              renderInput={(params) => <TextField {...params} label="Personne à lier" />}
            />
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>Relation</InputLabel>
              <Select
                value={newRelationType}
                label="Relation"
                onChange={(e) => setNewRelationType(e.target.value as RelationshipType)}
              >
                {Object.entries(relationshipLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label[0]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleAddRelation} disabled={!newRelationUser}>
              Joindre
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained">Sauvegarder</Button>
      </DialogActions>
    </Dialog>
  );
};
