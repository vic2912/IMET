// src/types/expense.ts

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  receipt_url?: string;
  expense_date: string;
  status: ExpenseStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  // Relations
  profiles?: {
    full_name: string;
  };
  approved_by_profile?: {
    full_name: string;
  };
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export type ExpenseCategory = 
  | 'Entretien' 
  | 'Réparations' 
  | 'Courses' 
  | 'Piscine' 
  | 'Jardin' 
  | 'Électricité' 
  | 'Eau' 
  | 'Chauffage'
  | 'Internet'
  | 'Assurance'
  | 'Taxes'
  | 'Autre';

export interface CreateExpenseData {
  amount: number;
  category: ExpenseCategory;
  description: string;
  expense_date: string;
  receipt_url?: string;
}

export interface UpdateExpenseData {
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  expense_date?: string;
  status?: ExpenseStatus;
  receipt_url?: string;
}

export interface ExpenseFormData {
  amount: string;
  category: ExpenseCategory | '';
  description: string;
  expense_date: Date;
  receipt_file?: File;
}

export interface ExpenseStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmount: number;
  totalApproved: number;
  totalPending: number;
  byCategory: Record<ExpenseCategory, number>;
}