import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useExpenses } from '../hooks/useExpenses';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import type { ExpenseFormData, CreateExpenseData } from '../types/expense';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const { expenses, createExpense, stats } = useExpenses();
  //const { showSuccess, showError } = useNotifications();

  const [openExpenseDialog, setOpenExpenseDialog] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    amount: '',
    category: '',
    description: '',
    expense_date: new Date()
  });

  const handleCreateExpense = async () => {
    if (!user || !expenseForm.amount || !expenseForm.description.trim()) {
      showError('Veuillez remplir tous les champs');
      return;
    }

    if (!expenseForm.category) {
      showError('Veuillez sélectionner une catégorie');
      return;
    }

    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      showError('Le montant doit être un nombre positif');
      return;
    }

    const expenseData: CreateExpenseData = {
      amount: amount,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      expense_date: format(expenseForm.expense_date, 'yyyy-MM-dd')
    };

    const result = await createExpense(user.id, expenseData);

    if (result.success) {
      showSuccess('Dépense ajoutée avec succès !');
      setOpenExpenseDialog(false);
      setExpenseForm({
        amount: '',
        category: '',
        description: '',
        expense_date: new Date()
      });
    } else {
      showError(result.error || 'Erreur lors de l\'ajout de la dépense');
    }
  };

  return (
    <Stack spacing={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Dépenses</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenExpenseDialog(true)}>
          Ajouter une dépense
        </Button>
      </Box>

      <Card>
        <CardContent>
          <List>
            {expenses && expenses.length > 0 ? (
              expenses.map((expense) => (
                <ListItem key={expense.id} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">{expense.description}</Typography>
                        <Chip
                          label={
                            expense.status === 'approved' ? 'Approuvée' :
                            expense.status === 'pending' ? 'En attente' : 'Rejetée'
                          }
                          color={
                            expense.status === 'approved' ? 'success' :
                            expense.status === 'pending' ? 'warning' : 'error'
                          }
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          💰 {expense.amount}€ - {expense.category}
                        </Typography>
                        <Typography variant="body2">
                          📅 {format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: fr })}
                        </Typography>
                        <Typography variant="body2">
                          👤 {expense.profiles?.full_name || 'Utilisateur'}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="Aucune dépense" />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>

      <Dialog open={openExpenseDialog} onClose={() => setOpenExpenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle dépense</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField
                label="Montant (€)"
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
              <FormControl fullWidth>
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  <MenuItem value="Entretien">Entretien</MenuItem>
                  <MenuItem value="Réparations">Réparations</MenuItem>
                  <MenuItem value="Courses">Courses</MenuItem>
                  <MenuItem value="Piscine">Piscine</MenuItem>
                  <MenuItem value="Jardin">Jardin</MenuItem>
                  <MenuItem value="Électricité">Électricité</MenuItem>
                  <MenuItem value="Eau">Eau</MenuItem>
                  <MenuItem value="Chauffage">Chauffage</MenuItem>
                  <MenuItem value="Internet">Internet</MenuItem>
                  <MenuItem value="Assurance">Assurance</MenuItem>
                  <MenuItem value="Taxes">Taxes</MenuItem>
                  <MenuItem value="Autre">Autre</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
              <DatePicker
                label="Date de la dépense"
                value={expenseForm.expense_date}
                onChange={(date) => setExpenseForm({ ...expenseForm, expense_date: date || new Date() })}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExpenseDialog(false)}>Annuler</Button>
          <Button
            onClick={handleCreateExpense}
            variant="contained"
            disabled={!expenseForm.amount || !expenseForm.category || !expenseForm.description.trim()}
          >
            Ajouter la dépense
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
