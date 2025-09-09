// src/components/FamilyTree.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Card, CardContent, Avatar, Typography, Chip, Tooltip } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

import { parseISO, isValid, format, differenceInYears, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { FamilyRelation, RelationshipType, User } from '../types/family';
import { userService } from '../services/userService';

type Props = {
  rootId: string;
  rootName?: string | null;
};

const SMALL_CHIP_SX = {
  height: 22,
  '& .MuiChip-label': { fontSize: 11, px: 0.75, lineHeight: 1.1 },
};

// Inversion pour affichage "depuis moi"
const FOR_ME: Record<RelationshipType, RelationshipType> = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  spouse: 'spouse',
  sibling: 'sibling',
};
const REL_LABEL: Record<RelationshipType, string> = {
  spouse: 'Conjoint·e',
  child: 'Enfant',
  parent: 'Parent',
  sibling: 'Frère/Sœur',
  grandparent: 'Grand-parent',
  grandchild: 'Petit-enfant',
};

function normalizeName(name?: string | null) {
  return (name || '').trim() || 'Sans nom';
}
function firstLetter(name?: string | null) {
  const n = normalizeName(name);
  return n.charAt(0).toUpperCase();
}
function ageFromBirthDate(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const d = parseISO(dateISO);
  if (!isValid(d)) return null;
  return differenceInYears(new Date(), d);
}
function birthdayChip(dateISO?: string | null): { label: string } | null {
  if (!dateISO) return null;
  const d = parseISO(dateISO);
  if (!isValid(d)) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (isSameDay(thisYear, now)) return { label: '🎂 Aujourd’hui' };
  return { label: ` ${format(d, 'd MMM', { locale: fr })}` };
}

// Carte ultra-compacte
const PersonCard: React.FC<{
  person: Pick<User, 'id' | 'full_name' | 'email' | 'phone' | 'birth_date' | 'allergies'>;
  roleForMe?: RelationshipType; // parent/enfant/conjoint...
  onSelect?: (id: string, name: string) => void;
}> = ({ person, roleForMe, onSelect }) => {
  const age = ageFromBirthDate(person.birth_date);
  const bday = birthdayChip(person.birth_date);

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 2, cursor: onSelect ? 'pointer' : 'default' }}
      onClick={() => onSelect?.(person.id, normalizeName(person.full_name))}
    >
      <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.25 }}>
        <Avatar sx={{ width: 44, height: 44 }}>{firstLetter(person.full_name)}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={normalizeName(person.full_name)} sx={{ fontWeight: 600 }}>
            {normalizeName(person.full_name)}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            {roleForMe && <Chip size="small" label={REL_LABEL[roleForMe]} sx={SMALL_CHIP_SX} />}
            {bday && (
              <Chip size="small" icon={<CakeOutlinedIcon sx={{ fontSize: 16 }} />} label={bday.label} sx={SMALL_CHIP_SX} />
            )}
            {age != null && age <= 30 && <Chip size="small" label={`${age} ans`} sx={SMALL_CHIP_SX} />}
            {person.phone && (
              <Chip size="small" icon={<LocalPhoneOutlinedIcon sx={{ fontSize: 16 }} />} label={person.phone} sx={SMALL_CHIP_SX} />
            )}
            {person.email && (
              <Chip size="small" icon={<EmailOutlinedIcon sx={{ fontSize: 16 }} />} label={person.email} sx={SMALL_CHIP_SX} />
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export const FamilyTree: React.FC<Props> = ({ rootId, rootName }) => {
  const [currentRoot, setCurrentRoot] = useState<{ id: string; name: string }>(() => ({
    id: rootId,
    name: normalizeName(rootName) || 'Moi',
  }));
  const [relations, setRelations] = useState<FamilyRelation[] | null>(null);
  const [rootProfile, setRootProfile] = useState<User | null>(null);

  // recharge le profil complet à chaque changement de racine
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await userService.getUserById(currentRoot.id);
        if (!cancelled) setRootProfile(data ?? null);
      } catch {
        if (!cancelled) setRootProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentRoot.id]);

  // petites dérivées d'affichage pour la racine
  const rootAge = useMemo(() => ageFromBirthDate(rootProfile?.birth_date ?? null), [rootProfile?.birth_date]);
  const rootBday = useMemo(() => birthdayChip(rootProfile?.birth_date ?? null), [rootProfile?.birth_date]);

  const load = useCallback(async (id: string) => {
    const { data, error } = await userService.getUserFamilyRelations(id);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[FamilyTree] relations error:', error);
      setRelations([]);
      return;
    }
    // ne garder que les relations dont la source est la racine
    const mine = (data ?? []).filter((r) => r.user_id === id);
    // dédoublonnage défensif
    const uniq = Array.from(new Map(mine.map((r) => [`${r.related_user_id}:${r.relationship_type}`, r])).values());
    setRelations(uniq);
  }, []);

  useEffect(() => {
    load(currentRoot.id);
  }, [currentRoot.id, load]);

  // Découpage 3 générations
  const { spouse, parents, children } = useMemo(() => {
    const s: FamilyRelation[] = [];
    const p: FamilyRelation[] = [];
    const c: FamilyRelation[] = [];
    (relations ?? []).forEach((r) => {
      switch (r.relationship_type as RelationshipType) {
        case 'spouse':
          s.push(r);
          break;
        case 'child':
          p.push(r);
          break; // "je suis enfant de X" => X est mon parent (affichage inversé)
        case 'parent':
          c.push(r);
          break; // "je suis parent de Y" => Y est mon enfant
        default:
          break;
      }
    });
    return { spouse: s, parents: p, children: c };
  }, [relations]);

  // Person helper (depuis r.related_user)
  const asPerson = (r: FamilyRelation): User =>
    ({
      id: r.related_user!.id,
      full_name: r.related_user!.full_name,
      email: r.related_user!.email,
      phone: r.related_user!.phone,
      birth_date: (r as any).related_user?.birth_date ?? null,
      allergies: (r as any).related_user?.allergies ?? '',
    } as unknown as User);

  const onSelect = (id: string, name: string) => setCurrentRoot({ id, name });

  return (
    <Box>
      {/* LIGNE TOP — Parents (génération -1) */}
      {parents.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center' }}>
            Parents
          </Typography>

          <Box sx={{ position: 'relative', pb: 3 }}>
            {/* Cartes parents + petits traits verticaux vers la barre */}
            <Stack direction="row" spacing={2} justifyContent="center" useFlexGap flexWrap="wrap">
              {parents.map((r) => (
                <Box
                  key={r.id}
                  sx={{
                    position: 'relative',
                    width: { xs: '100%', sm: 280, md: 300 },
                    pb: 2, // réserve sous la carte pour le trait vertical
                  }}
                >
                  <PersonCard person={asPerson(r)} roleForMe={FOR_ME[r.relationship_type]} onSelect={onSelect} />
                  {/* fourche: trait vertical vers la barre */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bottom: 0,
                      width: 2,
                      height: 16,
                      bgcolor: 'divider',
                    }}
                  />
                </Box>
              ))}
            </Stack>

            {/* barre horizontale sous toutes les cartes parents */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 2,
                bgcolor: 'divider',
              }}
            />
            {/* trait central descendant vers le noyau */}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: -16,
                width: 2,
                height: 16,
                bgcolor: 'divider',
              }}
            />
          </Box>
        </Box>
      )}

      {/* LIGNE MILIEU — Noyau (Moi + conjoint·e avec cœur) */}
      <Box sx={{ mb: 3 }}>
        {/* rangée centrale : root + cœur + conjoint */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          {/* Root (centre) */}
          <Box sx={{ width: { xs: 200, sm: 260, md: 280 } }}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.25 }}>
                <Avatar sx={{ width: 44, height: 44 }}>
                  {firstLetter(rootProfile?.full_name || currentRoot.name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    title={normalizeName(rootProfile?.full_name || currentRoot.name)}
                    sx={{ fontWeight: 700 }}
                  >
                    {normalizeName(rootProfile?.full_name || currentRoot.name)}
                  </Typography>

                  {/* Ligne de chips sous le nom */}
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                    {/* Badge Moi uniquement si on est sur la racine initiale */}
                    {currentRoot.id === rootId && <Chip size="small" label="Moi" sx={SMALL_CHIP_SX} />}

                    {/* Anniv. */}
                    {rootBday && (
                      <Chip
                        size="small"
                        icon={<CakeOutlinedIcon sx={{ fontSize: 16 }} />}
                        label={rootBday.label}
                        sx={SMALL_CHIP_SX}
                      />
                    )}

                    {/* Âge (<= 30 ans) */}
                    {rootAge != null && rootAge <= 30 && (
                      <Chip size="small" label={`${rootAge} ans`} sx={SMALL_CHIP_SX} />
                    )}

                    {/* Téléphone */}
                    {!!rootProfile?.phone && (
                      <Chip
                        size="small"
                        icon={<LocalPhoneOutlinedIcon sx={{ fontSize: 16 }} />}
                        label={rootProfile.phone}
                        sx={SMALL_CHIP_SX}
                      />
                    )}

                    {/* Email */}
                    {!!rootProfile?.email && (
                      <Chip
                        size="small"
                        icon={<EmailOutlinedIcon sx={{ fontSize: 16 }} />}
                        label={rootProfile.email}
                        sx={SMALL_CHIP_SX}
                      />
                    )}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Cœur mariage */}
          {spouse.length > 0 && (
            <Tooltip title="Union">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FavoriteIcon fontSize="small" />
              </Box>
            </Tooltip>
          )}

          {/* Conjoint (1er si plusieurs) */}
          {spouse.length > 0 && (
            <Box sx={{ width: { xs: 200, sm: 260, md: 280 } }}>
              <PersonCard person={asPerson(spouse[0])} roleForMe="spouse" onSelect={onSelect} />
            </Box>
          )}
        </Box>

        {/* Connecteur vertical vers la barre des enfants */}
        {children.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Box sx={{ width: 2, height: 18, bgcolor: 'divider' }} />
          </Box>
        )}

        {/* LIGNE ENFANTS — barre horizontale + fourches */}
        {children.length > 0 && (
          <Box sx={{ position: 'relative', pt: 2 }}>
            {/* barre horizontale au-dessus des cartes enfants */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                bgcolor: 'divider',
              }}
            />
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" justifyContent="center">
              {children.map((r) => {
                const child = asPerson(r);
                return (
                  <Box
                    key={r.id}
                    sx={{
                      position: 'relative',
                      width: { xs: 160, sm: 200, md: 220 },
                      mt: 2, // petit écart sous la barre
                    }}
                  >
                    {/* trait vertical depuis la barre vers chaque enfant */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 2,
                        height: 16,
                        bgcolor: 'divider',
                      }}
                    />
                    <PersonCard person={child} roleForMe="child" onSelect={onSelect} />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
};
