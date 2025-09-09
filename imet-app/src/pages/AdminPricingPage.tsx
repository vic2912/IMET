// pages/AdminPricingPage.tsx
import React, { useEffect, useState } from "react";
import {
  Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, Button, Box, Stack, CircularProgress, InputAdornment
} from "@mui/material";
import pricingService, { type PricingSetting } from "../services/pricingService";

const personTypes: { value: string; label: string }[] = [
  { value: "adulte_famille", label: "Adulte - Famille" },
  { value: "etudiant_famille", label: "Étudiant - Famille" },
  { value: "enfant_famille", label: "Enfant - Famille" },
  { value: "adulte_amis", label: "Adulte - Amis" },
  { value: "enfant_amis", label: "Enfant - Amis" },
  // supprimés: etudiant_amis, invite_exceptionnel
];

const AdminPricingPage: React.FC = () => {
  const [pricing, setPricing] = useState<PricingSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await pricingService.getAllPricing();
        setPricing(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // conversion sûre: string -> number|null et evite NaN
  const handlePriceChange = (
    index: number,
    field: keyof Pick<PricingSetting, "day_price" | "night_price">,
    raw: string
  ) => {
    const updated = [...pricing];
    const v = raw === "" ? null : Number(raw);
    (updated[index] as any)[field] = Number.isFinite(v as number) ? (v as number) : null;
    setPricing(updated);
  };

  const handleSave = async (index: number) => {
    setSavingIndex(index);
    try {
      await pricingService.savePricing(pricing[index]);
      alert("Tarif sauvegardé avec succès !");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSavingIndex(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom>Gestion des tarifs</Typography>

      <TableContainer
        component={Paper}
        sx={{
          width: "100%",
          overflowX: "auto",              // scroll horizontal en mobile
        }}
      >
        <Table size="small" sx={{ minWidth: 600 }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: "sticky", left: 0, zIndex: 2,
                  backgroundColor: "background.paper",
                  minWidth: 160, maxWidth: 220, pr: 2
                }}
              >
                Type de personne
              </TableCell>
              <TableCell sx={{ minWidth: 140, width: 160 }}>Prix jour (€)</TableCell>
              <TableCell sx={{ minWidth: 140, width: 160 }}>Prix nuit (€)</TableCell>
              <TableCell sx={{ minWidth: 120, width: 140 }}>Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {pricing.map((p, index) => {
              const label =
                personTypes.find(pt => pt.value === p.person_type)?.label ?? p.person_type;

              return (
                <TableRow key={p.id} hover>
                  {/* Colonne 1 — sticky + réduite */}
                  <TableCell
                    sx={{
                      position: "sticky", left: 0, zIndex: 1,
                      backgroundColor: "background.paper",
                      minWidth: 160, maxWidth: 220, pr: 2,
                      whiteSpace: "normal", lineHeight: 1.2
                    }}
                  >
                    {label}
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={p.day_price ?? ""}
                      onChange={(e) => handlePriceChange(index, "day_price", e.target.value)}
                      inputProps={{ step: "0.5", min: "0", inputMode: "decimal" }}
                      sx={{ width: 120 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">€</InputAdornment>,
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={p.night_price ?? ""}
                      onChange={(e) => handlePriceChange(index, "night_price", e.target.value)}
                      inputProps={{ step: "0.5", min: "0", inputMode: "decimal" }}
                      sx={{ width: 120 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">€</InputAdornment>,
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleSave(index)}
                        disabled={savingIndex === index}
                      >
                        {savingIndex === index ? "…" : "Sauvegarder"}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminPricingPage;
