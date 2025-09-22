// src/components/FamilyRelationsDialog.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, List,
  ListItem, ListItemText, ListItemButton, IconButton, TextField,
  FormControl, InputLabel, Select, MenuItem, Box, Typography, Divider,
  CircularProgress, Alert, Autocomplete, Chip
} from '@mui/material';

import { Delete, PersonAdd, FamilyRestroom, ChildCare, Elderly } from '@mui/icons-material';

import type {
  User, FamilyRelation, RelationshipType, CreateFamilyRelationData
} from '../types/family';
import { useUsers } from '../hooks/useUsers';
import { userService } from '../services/userService';

interface FamilyRelationsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  /** Pré-remplissage éventuel (après “Créer un invité”) */
  initialAddMode?: boolean;
  preset?: { id: string; full_name: string; is_guest?: boolean } | null;
  presetRelationshipType?: RelationshipType;
}

const relationshipLabels: Record<RelationshipType, { label: string; icon: React.ReactNode }> = {
  parent: { label: 'Parent de', icon: <FamilyRestroom /> },
  child: { label: 'Enfant de', icon: <ChildCare /> },
  spouse: { label: 'Conjoint(e) de', icon: <FamilyRestroom /> },
  sibling: { label: 'Frère/Sœur de', icon: <FamilyRestroom /> },
  grandparent: { label: 'Grand-parent de', icon: <Elderly /> },
  grandchild: { label: 'Petit-enfant de', icon: <ChildCare /> }
};

/** Représentation unifiée : ici on ne liste que des profils (users) */
type LinkablePerson = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  source: 'user';
};

/* -------------------------- Helpers -------------------------- */

// Unifie le résultat : accepte User[] ou { data?: User[] }
const unwrapUsersResult = (res: unknown): User[] => {
  if (Array.isArray(res)) return res as User[];
  if (res && typeof res === 'object' && Array.isArray((res as any).data)) {
    return (res as any).data as User[];
  }
  return [];
};

const norm = (s?: string | null) => (s || '').trim();

/* ----------------------- Composant principal ----------------------- */

export const FamilyRelationsDialog: React.FC<FamilyRelationsDialogProps> = ({
  open,
  onClose,
  userId,
  userName,
  initialAddMode,
  preset,
  presetRelationshipType
}) => {
  // log mount/unmount (pour éviter le spam par re-render)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[FamilyRelationsDialog] mount');
    return () => {
      // eslint-disable-next-line no-console
      console.log('[FamilyRelationsDialog] unmount');
    };
  }, []);

  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const [loading, setLoading] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LinkablePerson | null>(null);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('child');

  // Liste “à afficher” sous l’auto-complète (et options de l’auto-complète)
  const [initialOptions, setInitialOptions] = useState<LinkablePerson[]>([]);
  const [listToShow, setListToShow] = useState<LinkablePerson[]>([]);
  const [searching, setSearching] = useState(false);

  const appliedPresetIdRef = useRef<string | null>(null);

  const { getUserFamilyRelations, addFamilyRelation, removeFamilyRelation, searchUsers } = useUsers(userId);

  // ✅ fige la fonction instable dans un ref (évite les boucles)
  const getUserFamilyRelationsRef = useRef(getUserFamilyRelations);
  useEffect(() => {
    getUserFamilyRelationsRef.current = getUserFamilyRelations;
  }, [getUserFamilyRelations]);

  /** 1) Charger les relations quand le dialog s'ouvre */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getUserFamilyRelationsRef.current(userId);
      if (!cancelled) setRelations(data);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  /** 2) Charger la liste initiale (UNIQUEMENT PROFILES) */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const usersRes = await userService.getUsers(); // actifs par défaut
        const users = usersRes.data ?? [];

        const options: LinkablePerson[] = users
          .filter(u => u.id !== userId)
          .map(u => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email ?? null,
            phone: u.phone ?? null,
            birth_date: u.birth_date ?? null,
            source: 'user' as const
          }))
          .sort((a, b) => norm(a.full_name).localeCompare(norm(b.full_name), 'fr', { sensitivity: 'base' }));

        if (!cancelled) {
          setInitialOptions(options);
          setListToShow(options);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[FamilyRelationsDialog] initial list load error:', e);
        if (!cancelled) {
          setInitialOptions([]);
          setListToShow([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  /** 3) Pré-remplissage (après “Créer un invité”) */
  useEffect(() => {
    if (!open) return;

    if (initialAddMode && !addMode) {
      setAddMode(true);
    }

    if (preset && preset.id !== appliedPresetIdRef.current) {
      setAddMode(true);
      const pre: LinkablePerson = {
        id: preset.id,
        full_name: preset.full_name,
        email: null,
        phone: null,
        birth_date: null,
        source: 'user' as const // dans ce composant, on ne manipule que des profils côté liste
      };
      if (!preset.is_guest) {
        // On ne pré-sélectionne QUE les profils (users), pas les invités
        setSelectedUser(pre);
      } else {
        setSelectedUser(null); // on laisse l’utilisateur choisir un profil “profiles”
      }

      // L’insérer en tête si absent (seulement si c'est un profil)
      if (!preset.is_guest) {
        setInitialOptions(prev => (prev.some(o => o.id === pre.id) ? prev : [pre, ...prev]));
        setListToShow(prev => (prev.some(o => o.id === pre.id) ? prev : [pre, ...prev]));
      }

      if (presetRelationshipType) {
        setRelationshipType(presetRelationshipType);
      }
      appliedPresetIdRef.current = preset.id;
    }
  }, [open, preset, presetRelationshipType, initialAddMode, addMode]);

  /** 4) Reset au close */
  useEffect(() => {
    if (open) return;
    setAddMode(false);
    setSelectedUser(null);
    setRelationshipType('child');
    appliedPresetIdRef.current = null;
    setSearching(false);
    setListToShow([]);
    setInitialOptions([]);
  }, [open]);

  /** Recherche : si <2 lettres → liste initiale, sinon : recherche UNIQUEMENT dans profiles */
  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setListToShow(initialOptions);
      return;
    }
    setSearching(true);
    try {
      // hook (ou fallback service)
      let resUsers: unknown;
      try {
        resUsers = await searchUsers(query);
      } catch {
        const r = await userService.searchUsers(query);
        resUsers = (r as any) ?? [];
      }
      const users: User[] = unwrapUsersResult(resUsers);

      const results: LinkablePerson[] = users
        .filter(u => u.id !== userId)
        .map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email ?? null,
          phone: u.phone ?? null,
          birth_date: u.birth_date ?? null,
          source: 'user' as const
        }))
        .sort((a, b) => norm(a.full_name).localeCompare(norm(b.full_name), 'fr', { sensitivity: 'base' }));

      setListToShow(results);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[FamilyRelationsDialog] search error:', e);
      setListToShow([]);
    } finally {
      setSearching(false);
    }
  };

  /** Ajout : is_guardian déterminé automatiquement (parent/enfant = true) */
  const handleAddRelation = async () => {
    if (!selectedUser) return;
    const isGuardian = relationshipType === 'parent' || relationshipType === 'child';
    const data: CreateFamilyRelationData = {
      user_id: userId,
      related_user_id: selectedUser.id,
      relationship_type: relationshipType,
      is_guardian: isGuardian
    };

    await addFamilyRelation(data);

    const refreshed = await getUserFamilyRelationsRef.current(userId);
    setRelations(refreshed);

    setAddMode(false);
    setSelectedUser(null);
    setRelationshipType('child');
    appliedPresetIdRef.current = null;
  };

  const handleRemoveRelation = async (relationId: string) => {
    await removeFamilyRelation(relationId);
    const refreshed = await getUserFamilyRelationsRef.current(userId);
    setRelations(refreshed);
  };

  // Aligné sur le backend: guardian uniquement pour parent/enfant
  const guardianPreview = relationshipType === 'parent' || relationshipType === 'child';

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
                    <ListItem
                      key={relation.id}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleRemoveRelation(relation.id)}>
                          <Delete />
                        </IconButton>
                      }
                    >
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

                {/* Autocomplete (affiche les mêmes options que la liste) */}
                <Autocomplete
                  options={listToShow}
                  filterOptions={(x) => x}                // pas de re-filtrage client
                  loading={searching}
                  loadingText="Recherche…"
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  getOptionLabel={(option) => norm(option.full_name)} // ❌ pas de “(Invité)”
                  value={selectedUser}
                  onChange={(_, value) => setSelectedUser(value)}
                  onInputChange={(_, value, reason) => {
                    if (reason === 'input') handleSearch(value);
                  }}
                  openOnFocus
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Rechercher une personne"
                      fullWidth
                      margin="normal"
                      placeholder="Nom (taper ≥ 2 lettres pour filtrer)"
                    />
                  )}
                />

                {/* Liste parallèle (toujours visible), même source que l’auto-complète */}
                <Box sx={{ maxHeight: 260, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <List dense disablePadding>
                    {listToShow.map(p => (
                      <ListItem key={p.id} disablePadding>
                        <ListItemButton
                          selected={selectedUser?.id === p.id}
                          onClick={() => setSelectedUser(p)}
                        >
                          <ListItemText
                            primary={norm(p.full_name)}
                            secondary={norm(p.email || '')}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {listToShow.length === 0 && (
                      <ListItem>
                        <ListItemText primary="Aucun résultat" />
                      </ListItem>
                    )}
                  </List>
                </Box>

                <FormControl fullWidth margin="normal">
                  <InputLabel>Type de relation</InputLabel>
                  <Select
                    value={relationshipType}
                    label="Type de relation"
                    onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                  >
                    {Object.entries(relationshipLabels).map(([type, { label }]) => (
                      <MenuItem key={type} value={type}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Alert severity="info" sx={{ mt: 2 }}>
                  {guardianPreview
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
