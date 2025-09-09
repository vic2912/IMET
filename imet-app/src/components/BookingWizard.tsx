// src/components/BookingWizard.tsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select,
  Box, TextField, MenuItem, InputAdornment, IconButton,
  Stack, Typography, Stepper, Step, StepLabel, useMediaQuery, Fade, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import type { PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { useTheme } from '@mui/material/styles';
import { isBefore, isSameDay } from 'date-fns';

import { useAuth } from '../hooks/useAuth';
import { useFamily } from '../hooks/useFamily';
import { useBookings } from '../hooks/useBookings';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { hasOverlappingBooking } from '../utils/bookingUtils';
import { isAdult } from '../utils/ageUtils';
import type {
  PersonDetails,
  ExtendedCreateBookingDataForServer,
  ArrivalTime,
  DepartureTime,
  PersonDetailsForServer
} from '../types/booking';
import { format, parse } from 'date-fns';
import type { User } from '../types/family';
import { useSnackbar } from 'notistack';
import { supabase } from '../services/supabase';

interface BookingWizardProps {
  open: boolean;
  onClose: () => void;
}

const TAG = '[BookingWizard]';

const timeOptions: ArrivalTime[] = ['morning', 'afternoon', 'evening'];
const timeLabels = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir' };
const steps = ['Informations générales', 'Participants'];
const GENERIC_ADULT_ID = 'adulte_generique';
const GENERIC_CHILD_ID = 'enfant_generique';

// --- Utils date de naissance (robustes pour tri uniquement) ---
const parseBirthSafe = (d?: string): Date | null => {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const dt = new Date(d);
    return isNaN(+dt) ? null : dt;
  }
  try {
    const dt = parse(d, 'dd/MM/yyyy', new Date());
    return isNaN(+dt) ? null : dt;
  } catch {
    return null;
  }
};

// Tri du plus âgé (date + ancienne) au plus jeune
const byBirthDateAsc = (a?: string, b?: string) => {
  const da = parseBirthSafe(a);
  const db = parseBirthSafe(b);
  if (!da && !db) return 0;
  if (!da) return 1; // inconnus en dernier
  if (!db) return -1;
  return da.getTime() - db.getTime();
};



// --- Lecture stricte depuis les relations présentes dans 'me' ---
const getSpouseIdStrict = (me?: User) => {
  console.group('[BookingWizard] getSpouseIdStrict()');
  if (!me) {
    console.warn('⚠️ Aucun utilisateur fourni');
    console.groupEnd();
    return undefined;
  }
  console.log('👤 user.id:', me.id, 'user.full_name:', me.full_name);
  console.log('📎 family_relations:', me.family_relations);
  console.log('📎 related_to:', me.related_to);

  const relFromMe = (me.family_relations ?? []).find(r => r.relationship_type === 'spouse');
  const relToMe   = (me.related_to ?? []).find(r => r.relationship_type === 'spouse');

  console.log('🔍 relFromMe:', relFromMe);
  console.log('🔍 relToMe:', relToMe);

  const rel = relFromMe || relToMe;
  if (!rel) {
    console.warn('⚠️ Aucun lien "spouse" dans l’objet user');
    console.groupEnd();
    return undefined;
  }
  const spouseId = rel.user_id === me.id ? rel.related_user_id : rel.user_id;
  console.log('✅ spouseId (strict):', spouseId);
  console.groupEnd();
  return spouseId;
};

// --- Résolution “smart” (priorité override → relations → profil fetché) ---
const getSpouseIdSmart = (
  me?: User,
  opts?: { overrideId?: string | null; spouseProfile?: User | null }
) => {
  // 1) Override issu d’un fetch direct des relations (quand user n’est pas hydraté)
  if (opts?.overrideId) return opts.overrideId;
  // 2) Relations déjà présentes dans 'me'
  const strict = getSpouseIdStrict(me);
  if (strict) return strict;
  // 3) Si on a déjà fetché le profil conjoint (sans relations), on peut retourner son id
  if (opts?.spouseProfile?.id) return opts.spouseProfile.id;
  return undefined;
};

// IMPORTANT : “mineur connu” = une date est présente ET isAdult(date) === false.
const isMinorKnown = (birth?: string) => !!birth && !isAdult(birth);

// --- Utils numériques ---
const clamp = (n: number, min: number, max?: number) =>
  max === undefined ? Math.max(min, n) : Math.max(min, Math.min(max, n));

const parseDigits = (s: string) => {
  const only = (s ?? '').replace(/\D+/g, '');
  return only === '' ? 0 : parseInt(only, 10);
};

// Jour custom pour surligner la date d'arrivée dans le calendrier "Départ"
const StartAnchorDay: React.FC<
  PickersDayProps & { anchor?: Date | null }
> = ({ day, selected, sx, anchor, ...other }) => {
  const isAnchor = !!anchor && isSameDay(day, anchor);
  return (
    <PickersDay
      {...other}
      day={day}
      selected={selected}
      sx={{
        ...(sx as any),
        ...(isAnchor && !selected
          ? {
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              '&:hover, &:focus': { bgcolor: 'primary.main' },
              borderRadius: '50%',
              fontWeight: 600,
            }
          : {}),
      }}
    />
  );
};

/**
 * Input numérique sans clavier : boutons +/- (grand sur mobile), gestion des flèches ↑/↓,
 * et normalisation d'affichage (pas de 01).
*/
const NumberStepper: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  fullWidth?: boolean;
  isMobile?: boolean;
  step?: number;      // défaut 1
  bigStep?: number;   // défaut 5 (Shift ou PageUp/PageDown)
}> = ({
  label, value, min = 0, max, onChange, fullWidth, isMobile,
  step = 1, bigStep = 5
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const holdRef = React.useRef<{ timer?: any; startedAt?: number; delta?: number; }>({});

  const apply = (delta: number) => onChange(clamp((value ?? 0) + delta, min, max));

  const startHold = (delta: number) => {
    // Incrément immédiat
    apply(delta);
    holdRef.current.startedAt = Date.now();
    holdRef.current.delta = delta;
    // Répétition avec accélération
    holdRef.current.timer = setTimeout(function tick() {
      const elapsed = Date.now() - (holdRef.current.startedAt || 0);
      const d = elapsed > 1000 ? Math.sign(delta) * bigStep : delta;
      apply(d);
      holdRef.current.timer = setTimeout(
        tick,
        Math.max(60, 140 - Math.min(elapsed / 10, 80))
      );
    }, 400);
  };

  const stopHold = () => {
    if (holdRef.current.timer) clearTimeout(holdRef.current.timer);
    holdRef.current.timer = undefined;
    holdRef.current.startedAt = undefined;
    holdRef.current.delta = undefined;
  };

  return (
    <TextField
      label={label}
      fullWidth={!!fullWidth}
      type="text"
      value={Number.isFinite(value) ? String(value) : '0'}
      inputRef={inputRef}
      // pavé numérique sur mobile, et on filtre les non-chiffres côté onChange
      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
      onFocus={(e) => {
        // Sélectionne tout au focus → taper "25" remplace instantanément "1"
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => {
        const n = clamp(parseDigits(e.target.value), min, max);
        onChange(n);
      }}
      onKeyDown={(e) => {
        // Empêche e,+,-,.,, etc.
        if (['e', 'E', '+', '-', '.', ','].includes(e.key)) { e.preventDefault(); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); apply(e.shiftKey ? bigStep : step); }
        if (e.key === 'ArrowDown') { e.preventDefault(); apply(e.shiftKey ? -bigStep : -step); }
        if (e.key === 'PageUp')    { e.preventDefault(); apply(bigStep); }
        if (e.key === 'PageDown')  { e.preventDefault(); apply(-bigStep); }
        if (e.key === 'Home' && min !== undefined) { e.preventDefault(); onChange(min); }
        if (e.key === 'End'  && max !== undefined) { e.preventDefault(); onChange(max); }
      }}
      onWheel={(e) => (e.target as HTMLElement).blur()} // évite incrément au scroll
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                aria-label={`diminuer ${label}`}
                size={isMobile ? 'medium' : 'small'}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); startHold(-step); }}
                onPointerUp={(e) => { e.preventDefault(); stopHold(); }}
                onPointerLeave={(e) => { e.preventDefault(); stopHold(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} // neutralise le click de suivi
                tabIndex={-1}
              >
                <RemoveIcon />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={`augmenter ${label}`}
                size={isMobile ? 'medium' : 'small'}
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); startHold(step); }}
                onPointerUp={(e) => { e.preventDefault(); stopHold(); }}
                onPointerLeave={(e) => { e.preventDefault(); stopHold(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                tabIndex={-1}
              >
                <AddIcon />
              </IconButton>
            </InputAdornment>
          ),
          readOnly: false,
        },
      }}
    />
  );
};

export const BookingWizard: React.FC<BookingWizardProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { closeFamily } = useFamily(user?.id || '');
  const [step, setStep] = useState(0);
  const { enqueueSnackbar } = useSnackbar();
  const { data: bookings = [] } = useBookings(user?.id);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<ArrivalTime>('morning');
  const [endTime, setEndTime] = useState<DepartureTime>('afternoon');
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [personDetails, setPersonDetails] = useState<PersonDetails[]>([]);
  const [hasGeneratedParticipants, setHasGeneratedParticipants] = useState(false);
  
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<ExtendedCreateBookingDataForServer | null>(null);
  const createBooking = useCreateBooking();
  const openEndPickerSoon = () => setTimeout(() => setActivePicker('end'), 0);

  // Conjoint: si 'user' n’est pas hydraté avec relations, on fait un petit fetch ciblé
  const [spouseIdOverride, setSpouseIdOverride] = useState<string | null>(null);
  const [spouseProfile, setSpouseProfile] = useState<User | null>(null);

  /*
  // Log de rendu
  console.groupCollapsed('[BookingWizard] render');
  console.log('user.id:', user?.id, 'rels:', {
    mine: user?.family_relations?.length ?? 0,
    toMe: user?.related_to?.length ?? 0
  });
  console.log('closeFamily.len:', closeFamily?.length ?? 0, closeFamily?.map(u => ({ id: u.id, name: u.full_name, bd: u.birth_date })));
  console.groupEnd();
*/
  // ---------------- Helpers readiness & upgrade ----------------

  const isDataReadyForPrefill = (u?: User, closeFamilyArr?: User[]) => {
    if (!u) return false;
    const relCount = (u.family_relations?.length ?? 0) + (u.related_to?.length ?? 0);
    return relCount > 0 || Array.isArray(closeFamilyArr);
  };

  // ---- Fetch de secours des relations pour trouver 'spouse' si absentes sur user
  useEffect(() => {
    if (!open || !user?.id) return;
    const alreadyHydrated =
      (user.family_relations && user.family_relations.length > 0) ||
      (user.related_to && user.related_to.length > 0);

    if (alreadyHydrated) {
      // si user finit par être hydraté, on invalide un éventuel override périmé
      if (spouseIdOverride) setSpouseIdOverride(null);
      return;
    }

    let cancelled = false;
    (async () => {
      console.time(`${TAG} ⏱ fetch spouse relation (fallback)`);
      const { data, error } = await supabase
        .from('family_relations')
        .select('id,user_id,related_user_id,relationship_type')
        .or(`user_id.eq.${user.id},related_user_id.eq.${user.id}`);
      if (cancelled) return;

      if (error) {
        console.warn(`${TAG} relations fallback error:`, error);
        console.timeEnd(`${TAG} ⏱ fetch spouse relation (fallback)`);
        return;
      }

      const relFromMe = (data ?? []).find(r => r.relationship_type === 'spouse' && r.user_id === user.id);
      const relToMe   = (data ?? []).find(r => r.relationship_type === 'spouse' && r.related_user_id === user.id);
      const rel = relFromMe || relToMe;

      if (rel) {
        const id = rel.user_id === user.id ? rel.related_user_id : rel.user_id;
        setSpouseIdOverride(prev => (prev === id ? prev : id));
        console.log(`${TAG} spouseIdOverride set:`, id);
      } else {
        console.log(`${TAG} no spouse found in fallback relations`);
      }
      console.timeEnd(`${TAG} ⏱ fetch spouse relation (fallback)`);
    })();

    return () => { cancelled = true; };
  }, [open, user?.id, user?.family_relations, user?.related_to, spouseIdOverride]);

  // ---- Si on connaît spouseId (strict/override), fetch profil s’il n’est pas dans closeFamily
  useEffect(() => {
    if (!open || step !== 1 || !user) return;

    const spouseId = getSpouseIdSmart(user, { overrideId: spouseIdOverride, spouseProfile });
    if (!spouseId) {
      if (spouseProfile) setSpouseProfile(null);
      return;
    }
    const alreadyInFamily = closeFamily.some(p => p.id === spouseId);
    if (alreadyInFamily) {
      if (spouseProfile?.id === spouseId) setSpouseProfile(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', spouseId)
          .single();

        if (cancelled) return;
        if (error) {
          console.warn('[BookingWizard] fetch spouse error:', error.message);
          return;
        }
        if (data) {
          setSpouseProfile(data as unknown as User);
          console.debug('[BookingWizard] spouseProfile fetched:', {
            id: data.id, name: data.full_name, bd: data.birth_date
          });
        }
      } catch (e: any) {
        if (!cancelled) console.warn('[BookingWizard] fetch spouse exception:', e?.message);
      }
    })();

    return () => { cancelled = true; };
  }, [open, step, user, closeFamily, spouseIdOverride, spouseProfile?.id]);

  const upgradeGenericsIfPossible = (
    current: PersonDetails[],
    adultsCount: number,
    startDate: Date | null,
    endDate: Date | null,
    startTime: ArrivalTime,
    endTime: DepartureTime,
    me: User,
    family: User[],
  ): PersonDetails[] => {
    const familyPlus = spouseProfile && !family.some(p => p.id === spouseProfile.id)
      ? [...family, spouseProfile]
      : family;

    const spouseId = getSpouseIdSmart(me, { overrideId: spouseIdOverride, spouseProfile });
    const spouse = spouseId ? familyPlus.find(f => f.id === spouseId) : undefined;

    const myChildIds = getMyChildIds(me);
    const childrenSorted = familyPlus
      .filter(f => myChildIds.has(f.id) && isMinorKnown(f.birth_date))
      .sort((a, b) => byBirthDateAsc(a.birth_date, b.birth_date));

    const fromUser = (u: User, fallbackName: string, isChild: boolean): PersonDetails => ({
      id: u.id,
      name: u.full_name || fallbackName,
      arrivalDate: startDate,
      arrivalTime: startTime,
      departureDate: endDate,
      departureTime: endTime,
      person_type: isChild
        ? 'enfant_famille'
        : (u.is_student ? 'etudiant_famille' : 'adulte_famille'),
      allergies: u.allergies
    });

    const next = [...current];

    // Upgrade conjoint sur adulte #2 si générique
    if (adultsCount >= 2 && spouse) {
      const i = 1;
      const isGenericAdult2 = next[i] && (!next[i].id || next[i].name === 'Adulte');
      if (isGenericAdult2) {
        next[i] = fromUser(spouse, 'Adulte', false);
      }
    }

    // Upgrade enfants génériques dans l'ordre
    const childSlots = Math.max(0, next.length - adultsCount);
    for (let c = 0; c < childSlots; c++) {
      const idx = adultsCount + c;
      const isGenericChild = next[idx] && (!next[idx].id || next[idx].name === 'Enfant');
      if (isGenericChild && childrenSorted[c]) {
        next[idx] = fromUser(childrenSorted[c], 'Enfant', true);
      }
    }
    return next;
  };

  // ---------------- Génération participants ----------------

  const getMyChildIds = (me?: User) => {
    const ids = new Set<string>();
    if (!me) return ids;
    for (const r of me.family_relations ?? []) {
      if (r.relationship_type === 'child') ids.add(r.related_user_id);
    }
    for (const r of me.related_to ?? []) {
      if (r.relationship_type === 'parent') ids.add(r.user_id);
    }
    return ids;
  };

  const generateParticipants = () => {
    console.debug(`${TAG} generateParticipants()`);
    if (!user) return;
    const participants: PersonDetails[] = [];

    const spouseId = getSpouseIdSmart(user, { overrideId: spouseIdOverride, spouseProfile });
    console.debug(`${TAG} spouseId (smart):`, spouseId);

    const spouseInFamily = spouseId ? closeFamily.find(f => f.id === spouseId) : undefined;
    const spouse = spouseInFamily || (spouseProfile?.id === spouseId ? spouseProfile : undefined);

    const myChildIds = getMyChildIds(user);
    console.debug(`${TAG} myChildIds:`, Array.from(myChildIds));

    // Enfants candidats
    let childrenCandidates = closeFamily.filter(f => myChildIds.has(f.id) && !!f.birth_date && !isAdult(f.birth_date));
    if (childrenCandidates.length === 0) {
      childrenCandidates = closeFamily.filter(f => !!f.birth_date && !isAdult(f.birth_date));
      console.warn('[BookingWizard] Fallback enfants par âge (relations vides / non concordantes)');
    }
    const childrenSorted = childrenCandidates.sort((a, b) => byBirthDateAsc(a.birth_date, b.birth_date));

    const fromUser = (u: User, fallbackName: string, isChild: boolean): PersonDetails => ({
      id: u.id,
      name: u.full_name || fallbackName,
      arrivalDate: startDate,
      arrivalTime: startTime,
      departureDate: endDate,
      departureTime: endTime,
      person_type: isChild
        ? 'enfant_famille'
        : (u.is_student ? 'etudiant_famille' : 'adulte_famille'),
      allergies: u.allergies
    });

    const generic = (label: 'Adulte' | 'Enfant', type: string): PersonDetails => ({
      name: label,
      arrivalDate: startDate,
      arrivalTime: startTime,
      departureDate: endDate,
      departureTime: endTime,
      person_type: type
    });

    // 1) Utilisateur (Adulte 1)
    if (adults >= 1) {
      participants.push(fromUser(user, 'Adulte', false));
    }
    // 2) Conjoint (Adulte 2)
    if (adults >= 2) {
      if (spouse) {
        participants.push(fromUser(spouse, 'Adulte', false));
      } else {
        participants.push(generic('Adulte', 'adulte_amis'));
      }
    }
    // 3) Adultes restants (> 2)
    for (let i = 2; i < adults; i++) {
      participants.push(generic('Adulte', 'adulte_amis'));
    }
    // 4) Enfants (mineurs connus d'abord)
    const childCount = Math.max(0, children);
    for (let i = 0; i < childCount; i++) {
      const c = childrenSorted[i];
      if (c) {
        participants.push(fromUser(c, 'Enfant', true));
      } else {
        participants.push(generic('Enfant', 'enfant_amis'));
      }
    }

    setPersonDetails(participants);
    setHasGeneratedParticipants(true);
  };

  // ---------------- Options Sélecteurs ----------------

  const getAdultOptions = () => {
    const base: { id: string; name: string; is_student: boolean; birth_date?: string }[] = [
      { id: user!.id, name: user!.full_name, is_student: !!user!.is_student, birth_date: user!.birth_date },
    ];

    const others = closeFamily
      .filter(f => isAdult(f.birth_date) || !f.birth_date)
      .map(f => ({ id: f.id, name: f.full_name, is_student: !!f.is_student, birth_date: f.birth_date }));

    // conjoint “fetché” si pas dans closeFamily
    const spouseId = getSpouseIdSmart(user!, { overrideId: spouseIdOverride, spouseProfile });
    const addSpouse =
      spouseProfile &&
      spouseProfile.id === spouseId &&
      !others.some(o => o.id === spouseProfile.id) &&
      spouseProfile.id !== user!.id &&
      (isAdult(spouseProfile.birth_date) || !spouseProfile.birth_date);

    const spouseOpt = addSpouse
      ? [{ id: spouseProfile.id, name: spouseProfile.full_name, is_student: !!spouseProfile.is_student, birth_date: spouseProfile.birth_date }]
      : [];

    const map = new Map<string, { id: string; name: string; is_student: boolean; birth_date?: string }>();
    [...base, ...others, ...spouseOpt].forEach(o => map.set(o.id, o));

    return [
      ...Array.from(map.values()),
      { id: GENERIC_ADULT_ID, name: 'Adulte', is_student: false, birth_date: undefined }
    ];
  };

  const getChildOptions = () => {
    const myChildIds = getMyChildIds(user!);

    const byRelation = closeFamily.filter(f => myChildIds.has(f.id));
    const byAgeFallback = closeFamily.filter(f => !!f.birth_date && !isAdult(f.birth_date));
    const source = byRelation.length > 0 ? byRelation : byAgeFallback;

    console.debug('[BookingWizard] getChildOptions source =', byRelation.length > 0 ? 'relations' : 'ageFallback', {
      myChildIds: Array.from(myChildIds),
      byRelation: byRelation.map(x => ({ id: x.id, name: x.full_name })),
      byAgeFallback: byAgeFallback.map(x => ({ id: x.id, name: x.full_name, bd: x.birth_date })),
    });

    const sorted = source.sort((a, b) => byBirthDateAsc(a.birth_date, b.birth_date));

    return [
      ...sorted.map(f => ({
        id: f.id,
        name: f.full_name,
        is_student: !!f.is_student,
        birth_date: f.birth_date
      })),
      { id: GENERIC_CHILD_ID, name: 'Enfant', is_student: false, birth_date: undefined }
    ];
  };

  // ---------------- Effets ----------------

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep(0);
      setStartDate(null);
      setEndDate(null);
      setStartTime('morning');
      setEndTime('afternoon');
      setAdults(1);
      setChildren(0);
      setPersonDetails([]);
      setHasGeneratedParticipants(false);
      setActivePicker(null);
    }
  }, [open]);

  // Pré-remplissage + upgrade doux une fois les données prêtes
  useEffect(() => {
    if (!open || step !== 1) return;
    if (!user) return;

    const ready = isDataReadyForPrefill(user, closeFamily);
    if (!ready) return;

    // 1) Première génération si vide
    if (!hasGeneratedParticipants && personDetails.length === 0) {
      generateParticipants();
      console.log(`${TAG} -> generateParticipants() triggered (first fill)`);
      return;
    }

    // 2) Upgrade des génériques quand famille/relations arrivent (sans écraser les choix spécifiques)
    if (personDetails.length > 0) {
      const upgraded = upgradeGenericsIfPossible(
        personDetails,
        adults,
        startDate,
        endDate,
        startTime,
        endTime,
        user,
        closeFamily
      );
      const changed = JSON.stringify(upgraded) !== JSON.stringify(personDetails);
      if (changed) setPersonDetails(upgraded);
    }
  }, [
    open, step,
    user?.id, user?.family_relations, user?.related_to,
    closeFamily,
    adults, children,
    startDate, endDate, startTime, endTime,
    hasGeneratedParticipants, personDetails
  ]);

  // ---------------- Soumission ----------------

  /**
   * Assure que personDetails contient d'abord {adults} adultes, puis {children} enfants.
   * On préserve au maximum les entrées existantes (dans l'ordre), et on complète/retire au besoin.
   */
  const resizeParticipantsToCounts = (nextAdults: number, nextChildren: number) => {
    if (step !== 1) return; // On n'ajuste que quand on est sur l'étape Participants

    const current = [...personDetails];
    const keepAdults = current.slice(0, adults);
    const keepChildren = current.slice(adults, adults + children);

    // Normalise les types sur les slots conservés
    const normAdult = (p: PersonDetails): PersonDetails => ({
      ...p,
      name: p.name || 'Adulte',
      person_type: p.person_type?.startsWith('adulte') || p.person_type === 'etudiant_famille'
        ? p.person_type
        : 'adulte_amis'
    });
    const normChild = (p: PersonDetails): PersonDetails => ({
      ...p,
      name: p.name || 'Enfant',
      person_type: p.person_type?.startsWith('enfant')
        ? p.person_type
        : 'enfant_amis'
    });

    const adultsKept = keepAdults.slice(0, Math.min(keepAdults.length, nextAdults)).map(normAdult);
    const childrenKept = keepChildren.slice(0, Math.min(keepChildren.length, nextChildren)).map(normChild);

    const makeGenericAdult = (): PersonDetails => ({
      name: 'Adulte',
      arrivalDate: startDate,
      arrivalTime: startTime,
      departureDate: endDate,
      departureTime: endTime,
      person_type: 'adulte_amis'
    });
    const makeGenericChild = (): PersonDetails => ({
      name: 'Enfant',
      arrivalDate: startDate,
      arrivalTime: startTime,
      departureDate: endDate,
      departureTime: endTime,
      person_type: 'enfant_amis'
    });

    const adultsToAdd = Math.max(0, nextAdults - adultsKept.length);
    const childrenToAdd = Math.max(0, nextChildren - childrenKept.length);

    const nextList: PersonDetails[] = [
      ...adultsKept,
      ...Array.from({ length: adultsToAdd }, makeGenericAdult),
      ...childrenKept,
      ...Array.from({ length: childrenToAdd }, makeGenericChild),
    ];

    setPersonDetails(nextList);
    setHasGeneratedParticipants(true);
  };


  const handleSubmit = () => {
    if (!startDate || !endDate || !user?.id) return;

    for (const person of personDetails) {
      if (!person.arrivalDate || !person.departureDate) {
        alert(`Le participant ${person.name} n'a pas de dates complètes.`);
        return;
      }
      if (isBefore(person.departureDate, person.arrivalDate)) {
        alert(`Le départ ne peut pas être avant l'arrivée pour ${person.name}.`);
        return;
      }
    }

    const sanitizedPersonDetails: PersonDetailsForServer[] = personDetails.map(person => ({
      ...person,
      arrivalDate: person.arrivalDate ? format(person.arrivalDate, 'yyyy-MM-dd') : null,
      departureDate: person.departureDate ? format(person.departureDate, 'yyyy-MM-dd') : null
    }));

    const booking: ExtendedCreateBookingDataForServer = {
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      arrival_time: startTime,
      departure_time: endTime,
      adults,
      children,
      booking_for_self: true,
      persons_details: sanitizedPersonDetails,
      status: 'pending'
    };

    if (hasOverlappingBooking(startDate, endDate, user.id, bookings)) {
      const bookingToConfirm: ExtendedCreateBookingDataForServer = { ...booking };
      setPendingBooking(bookingToConfirm);
      setShowConflictDialog(true);
      return;
    }

    createBooking.mutate({ userId: user.id, data: booking }, {
      onSuccess: () => {
        enqueueSnackbar('Séjour créé', { variant: 'success' });
        onClose();
      }
    });
  };

  // ---------------- Rendu ----------------

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Créer un séjour</DialogTitle>
        <DialogContent>
          <Stepper activeStep={step} sx={{ my: 2 }}>
            {steps.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Fade in={step === 0} timeout={500} unmountOnExit>
            <Box>
              <Stack spacing={2}>

              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                {/* Date d'arrivée */}
                <DatePicker
                  label="Date d'arrivée"
                  format="dd/MM/yyyy"
                  value={startDate}
                  open={activePicker === 'start'}
                  onOpen={() => setActivePicker('start')}
                  onClose={() => {
                    // Attendre la fermeture complète avant d’ouvrir le suivant
                    if (activePicker === 'start' && startDate && !endDate) {
                      openEndPickerSoon();
                    } else {
                      setActivePicker(null);
                    }
                  }}
                  onAccept={(finalDate) => {
                    setStartDate(finalDate);
                    // Si le départ actuel est avant la nouvelle arrivée, on le réinitialise
                    if (finalDate && endDate && endDate < finalDate) setEndDate(null);
                    // Ouvre "Départ" à la prochaine tick pour éviter la course avec la fermeture
                    openEndPickerSoon();
                  }}
                  onChange={(newDate) => {
                    setStartDate(newDate);
                    // Si on efface l'arrivée, on efface aussi le départ
                    if (!newDate) setEndDate(null);
                  }}
  
                  reduceAnimations
                  closeOnSelect
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      inputProps: { readOnly: true },
                      onClick: () => setActivePicker('start'),
                    },
                    actionBar: { actions: ['cancel', 'accept'] },
                  }}
                />

                {/* Date de départ */}
                <DatePicker
                  label="Date de départ"
                  format="dd/MM/yyyy"
                  value={endDate}
                  open={activePicker === 'end'}
                  // (4) Clic direct sur "départ" -> si pas d'arrivée, on ouvre d'abord l'arrivée
                  onOpen={() => setActivePicker(startDate ? 'end' : 'start')}
                  onClose={() => {
                    setActivePicker(null);
                  }}
                  onChange={(newDate) => {
                    setEndDate(newDate);
                  }}
                  onAccept={(finalDate) => {
                    setEndDate(finalDate);
                    setActivePicker(null); // (3) fermeture automatique après sélection
                  }}
                  referenceDate={startDate ?? undefined}
                  minDate={startDate ?? undefined}
                  // (2) Surligner la date d'arrivée en bleu dans le calendrier de départ
                  slots={{ day: StartAnchorDay }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      inputProps: { readOnly: true },
                      onClick: () => setActivePicker(startDate ? 'end' : 'start'),
                    },
                    actionBar: { actions: ['cancel', 'accept'] },
                  }}
                  reduceAnimations
                  closeOnSelect
                />
              </Stack>


                <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                  <NumberStepper
                    label="Adultes"
                    value={adults}
                    min={1}
                    onChange={(v) => {
                      const next = Math.max(1, v);
                      setAdults(next);
                      resizeParticipantsToCounts(next, children);
                    }}
                    fullWidth
                    isMobile={isMobile}
                  />
                  <NumberStepper
                    label="Enfants"
                    value={children}
                    min={0}
                    onChange={(v) => {
                      const next = Math.max(0, v);
                      setChildren(next);
                      resizeParticipantsToCounts(adults, next);
                    }}
                    fullWidth
                    isMobile={isMobile}
                  />
                </Stack>

                <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                  <TextField
                    select
                    label="Heure d'arrivée"
                    fullWidth
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value as ArrivalTime)}
                  >
                    {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                  </TextField>

                  <TextField
                    select
                    label="Heure de départ"
                    fullWidth
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value as DepartureTime)}
                  >
                    {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                  </TextField>
                </Stack>
              </Stack>
            </Box>
          </Fade>

          <Fade in={step === 1} timeout={500} unmountOnExit>
            <Box>
              <Typography variant="h6" gutterBottom>Participants</Typography>
              <Stack spacing={2}>
                {personDetails.map((p, index) => {
                  const stableKey = p.id ? `pid-${p.id}` : `${index < adults ? 'adult' : 'child'}-${index}`;

                  // Détermine dynamiquement les options selon la ligne
                  const isAdultRow = p.person_type?.startsWith('adulte') || p.person_type === 'etudiant_famille';
                  const options = isAdultRow ? getAdultOptions() : getChildOptions();

                  const valueId =
                    p.id // on privilégie toujours l'id courant s'il existe
                      ?? (isAdultRow ? GENERIC_ADULT_ID : GENERIC_CHILD_ID);

                  if (!options.some(o => o.id === valueId) && p.id) {
                    console.warn(`${TAG} Select fallback (options not ready yet)`, {
                      row: index + 1,
                      role: isAdultRow ? 'adult' : 'child',
                      currentId: p.id,
                      currentName: p.name,
                      options: options.map(o => o.id),
                    });
                  }

                  const isAdultType = isAdultRow;

                  return (
                    <Box key={stableKey} sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <Typography variant="subtitle1">Participant {index + 1}</Typography>
                        <Chip label={isAdultType ? 'Adulte' : 'Enfant'} color={isAdultType ? 'primary' : 'success'} size="small" />
                      </Stack>

                      <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                        <Select
                          fullWidth
                          value={valueId}
                          onChange={(e) => {
                            const updated = [...personDetails];
                            const selectedId = e.target.value as string;

                            const chosen = options.find(o => o.id === selectedId);

                            if (!chosen || selectedId === (isAdultRow ? GENERIC_ADULT_ID : GENERIC_CHILD_ID)) {
                              delete updated[index].id;
                              updated[index].name = isAdultRow ? 'Adulte' : 'Enfant';
                              updated[index].person_type = isAdultRow ? 'adulte_amis' : 'enfant_amis';
                            } else {
                              updated[index].id = chosen.id;
                              updated[index].name = chosen.name;

                              if (isAdultRow) {
                                const matchingAdult = [user!, ...closeFamily].find(f => f.id === chosen.id);
                                updated[index].person_type = matchingAdult
                                  ? (matchingAdult.is_student ? 'etudiant_famille' : 'adulte_famille')
                                  : 'adulte_amis';
                              } else {
                                const matchingChild = closeFamily.find(f => f.id === chosen.id && !isAdult(f.birth_date));
                                updated[index].person_type = matchingChild ? 'enfant_famille' : 'enfant_amis';
                              }
                            }
                            setPersonDetails(updated);
                          }}
                        >
                          {/* Si la valeur courante n'est pas dans les options, on l’injecte en discret pour que le Select puisse l’afficher */}
                          {!options.some(o => o.id === valueId) && p.id && (
                            <MenuItem value={p.id} sx={{ display: 'none' }}>
                              {p.name || 'Chargement...'}
                            </MenuItem>
                          )}

                          {options.map(option => (
                            <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
                          ))}
                        </Select>

                        <DatePicker
                          format="dd/MM/yyyy"
                          value={p.arrivalDate}
                          onChange={(newDate) => {
                            const updated = [...personDetails];
                            updated[index].arrivalDate = newDate ?? null;
                            setPersonDetails(updated);
                          }}
                          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                        />

                        <TextField
                          select
                          label="Heure arrivée"
                          fullWidth
                          value={p.arrivalTime}
                          onChange={(e) => {
                            const updated = [...personDetails];
                            updated[index].arrivalTime = e.target.value as ArrivalTime;
                            setPersonDetails(updated);
                          }}
                          size="small"
                        >
                          {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                        </TextField>

                        <DatePicker
                          format="dd/MM/yyyy"
                          value={p.departureDate}
                          onChange={(newDate) => {
                            const updated = [...personDetails];
                            updated[index].departureDate = newDate ?? null;
                            setPersonDetails(updated);
                          }}
                          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                        />

                        <TextField
                          select
                          label="Heure départ"
                          fullWidth
                          value={p.departureTime}
                          onChange={(e) => {
                            const updated = [...personDetails];
                            updated[index].departureTime = e.target.value as DepartureTime;
                            setPersonDetails(updated);
                          }}
                          size="small"
                        >
                          {timeOptions.map(t => <MenuItem key={t} value={t}>{timeLabels[t]}</MenuItem>)}
                        </TextField>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Fade>
        </DialogContent>
        <DialogActions>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Retour</Button>}
          {step < steps.length - 1 && (
            <Button disabled={!startDate || !endDate} onClick={() => setStep(step + 1)}>Suivant</Button>
          )}
          {step === steps.length - 1 && (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={createBooking.isPending}
            >
              Valider
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showConflictDialog} onClose={() => setShowConflictDialog(false)}>
        <DialogTitle>Conflit possible de dates</DialogTitle>
        <DialogContent>
          <Typography>
            Il semble qu'une autre réservation existe pour cette période. Voulez-vous vraiment continuer ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowConflictDialog(false);
            setPendingBooking(null);
          }}>Non</Button>
          <Button variant="contained" color="primary" onClick={() => {
            if (pendingBooking) {
              createBooking.mutate({ userId: user!.id, data: pendingBooking }, {
                onSuccess: () => {
                  enqueueSnackbar('Séjour créé', { variant: 'success' });
                  onClose();
                }
              });
            }
            setShowConflictDialog(false);
            setPendingBooking(null);
          }}>
            Oui
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
