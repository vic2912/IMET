// src/components/FamilyRelationsDialog.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List,
  ListItem, ListItemText, ListItemSecondaryAction, IconButton, TextField,
  FormControl, InputLabel, Select, MenuItem, Box, Typography, Divider,
  CircularProgress, Alert, Autocomplete, FormControlLabel, Checkbox,
  Chip } from '@mui/material';

import { Delete, PersonAdd, FamilyRestroom, ChildCare, Elderly
} from '@mui/icons-material';

import type { User, Guest, FamilyRelation, RelationshipType, CreateFamilyRelationData } from '../types/family';
import { useUsers } from '../hooks/useUsers';
import { userService } from '../services/userService';

interface FamilyRelationsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const relationshipLabels: Record<RelationshipType, { label: string; icon: React.ReactNode }> = {
  parent: { label: 'Parent de', icon: <FamilyRestroom /> },
  child: { label: 'Enfant de', icon: <ChildCare /> },
  spouse: { label: 'Conjoint(e) de', icon: <FamilyRestroom /> },
  sibling: { label: 'Frère/Sœur de', icon: <FamilyRestroom /> },
  grandparent: { label: 'Grand-parent de', icon: <Elderly /> },
  grandchild: { label: 'Petit-enfant de', icon: <ChildCare /> }
};

//type LinkablePerson = User & { is_guest?: boolean };
type LinkablePerson = (User | (Guest & {
  email: string;
  is_guest: true;
  is_active: false;
  updated_at: string;
}));

export const FamilyRelationsDialog: React.FC<FamilyRelationsDialogProps> = ({
  open,
  onClose,
  userId,
  userName
}) => {
  console.log('[FamilyRelationsDialog] rendu');
  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  //const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<LinkablePerson[]>([]);
  //const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<LinkablePerson | null>(null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('child');
  const [isGuardian, setIsGuardian] = useState(true);

  const {
    getUserFamilyRelations,
    addFamilyRelation,
    removeFamilyRelation,
    searchUsers
  } = useUsers(userId);

  const loadRelations = useCallback(async () => {
    setLoading(true);
    const data = await getUserFamilyRelations(userId);
    setRelations(data);
    setLoading(false);
  }, [getUserFamilyRelations, userId]);

  useEffect(() => {
    if (open) {
      loadRelations();
    }
  }, [open, loadRelations]);

const handleSearch = async (query: string) => {
  if (query.length >= 2) {
    const results = await searchUsers(query);
    const existingIds = relations.map(r => r.related_user_id);

    const { data: guests } = await userService.getGuests();

    const guestResults: LinkablePerson[] = (guests ?? [])
      .filter(g => g.full_name.toLowerCase().includes(query.toLowerCase()))
      .map(g => ({
        ...g,
        email: '',               // champ requis par User
        is_guest: true,          // pour l'affichage
        is_active: false,        // pour compatibilité
        updated_at: g.created_at || '' // champ requis
      }));


    const merged = [...results, ...guestResults].filter(
      u => u.id !== userId && !existingIds.includes(u.id)
    );

    setSearchResults(merged);
  } else {
    setSearchResults([]);
  }
};


  const handleAddRelation = async () => {
    if (!selectedUser) return;

    const data: CreateFamilyRelationData = {
      user_id: userId,
      related_user_id: selectedUser.id,
      relationship_type: relationshipType,
      is_guardian: isGuardian
    };

    await addFamilyRelation(data);
    await loadRelations();
    setAddMode(false);
    setSelectedUser(null);
    setRelationshipType('child');
    setIsGuardian(true);
  };

  const handleRemoveRelation = async (relationId: string) => {
    await removeFamilyRelation(relationId);
    await loadRelations();
  };

  useEffect(() => {
    setIsGuardian(['parent', 'guardian', 'grandparent'].includes(relationshipType));
  }, [relationshipType]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FamilyRestroom />
          Relations familiales de {userName}
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {relations.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Relations actuelles
                </Typography>
                <List>
                  {relations.map((relation) => (
                    <ListItem key={relation.id}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {relationshipLabels[relation.relationship_type].icon}
                            <span>{relation.related_user?.full_name}</span>
                            {relation.is_guardian && (
                              <Chip label="Peut réserver" size="small" color="primary" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={relationshipLabels[relation.relationship_type].label}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => handleRemoveRelation(relation.id)}>
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {addMode ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Ajouter une relation
                </Typography>

                <Autocomplete
                  options={searchResults}
                  //getOptionLabel={(option) => `${option.full_name} (${option.email})`}
                  getOptionLabel={(option) =>
                    'is_guest' in option
                      ? `${option.full_name} (Invité)`
                      : `${option.full_name} (${option.email})`
                  }
                  value={selectedUser}
                  onChange={(_, value) => setSelectedUser(value)}
                  onInputChange={(_, value) => handleSearch(value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Rechercher une personne" fullWidth margin="normal" />
                  )}
                />

                <FormControl fullWidth margin="normal">
                  <InputLabel>Type de relation</InputLabel>
                  <Select
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                    label="Type de relation"
                  >
                    {Object.entries(relationshipLabels).map(([type, { label }]) => (
                      <MenuItem key={type} value={type}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={<Checkbox checked={isGuardian} onChange={(e) => setIsGuardian(e.target.checked)} />}
                  label="Peut créer des réservations pour cette personne"
                  sx={{ mt: 1 }}
                />

                <Alert severity="info" sx={{ mt: 2 }}>
                  {isGuardian
                    ? `${userName} pourra créer des réservations au nom de cette personne.`
                    : `${userName} ne pourra pas créer de réservations pour cette personne.`}
                </Alert>

                <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button onClick={() => setAddMode(false)}>Annuler</Button>
                  <Button variant="contained" onClick={handleAddRelation} disabled={!selectedUser}>
                    Ajouter
                  </Button>
                </Box>
              </Box>
            ) : (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={() => setAddMode(true)}
              >
                Ajouter une relation familiale
              </Button>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};
