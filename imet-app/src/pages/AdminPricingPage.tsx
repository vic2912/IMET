// pages/AdminPricingPage.tsx

import React, { useEffect, useState } from "react";
import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button } from "@mui/material";
import pricingService, { type PricingSetting } from "../services/pricingService";

const personTypes: { value: string; label: string }[] = [
  { value: "adulte_famille", label: "Adulte - Famille" },
  { value: "etudiant_famille", label: "Étudiant - Famille" },
  { value: "enfant_famille", label: "Enfant - Famille" },
  { value: "adulte_amis", label: "Adulte - Amis" },
  { value: "etudiant_amis", label: "Étudiant - Amis" },
  { value: "enfant_amis", label: "Enfant - Amis" },
  { value: "invite_exceptionnel", label: "Invités exceptionnels" }
];

const AdminPricingPage: React.FC = () => {
  const [pricing, setPricing] = useState<PricingSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pricingService.getAllPricing().then((data: PricingSetting[]) => {
      setPricing(data);
      setLoading(false);
    });
  }, []);

  const handleChange = (index: number, field: keyof PricingSetting, value: any) => {
    const updated = [...pricing];
    updated[index] = { ...updated[index], [field]: value };
    setPricing(updated);
  };

  const handleSave = async (index: number) => {
    try {
      await pricingService.savePricing(pricing[index]);
      alert("Tarif sauvegardé avec succès !");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="p-6">
      <Typography variant="h4" gutterBottom>Gestion des tarifs</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type de personne</TableCell>
              <TableCell>Prix jour (€)</TableCell>
              <TableCell>Prix nuit (€)</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricing.map((p, index) => (
              <TableRow key={p.id}>
                <TableCell>{personTypes.find(pt => pt.value === p.person_type)?.label}</TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={p.day_price}
                    onChange={(e) => handleChange(index, "day_price", parseFloat(e.target.value))}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={p.night_price}
                    onChange={(e) => handleChange(index, "night_price", parseFloat(e.target.value))}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button variant="contained" onClick={() => handleSave(index)}>
                    Sauvegarder
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default AdminPricingPage;
