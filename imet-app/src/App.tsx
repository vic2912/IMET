// src/App.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Snackbar, Alert } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { SnackbarProvider } from 'notistack';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useNotification } from './hooks/useNotification';

// Pages
import { AuthPage } from './pages/AuthPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DashboardPage } from './pages/DashboardPage';
import { BookingsPage } from './pages/BookingsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import AdminPanelPage from './pages/AdminPanelPage';
import AdminFamilyRelationsPage from './pages/AdminFamilyRelationsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TribesPage from './pages/TribesPage';
import CareChecklistsPage from './pages/CareCheckListsPage';
import CareInventoryPage from './pages/CareInventoryPage';
import { NOTICES } from './pages/notices/autoNotices';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminPricingPage from './pages/AdminPricingPage';
import { AllBookingsPage } from './pages/AllBookingsPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { CreateUserPage } from './pages/CreateUserPage';
import AdminChecklistsPage from './pages/AdminCheckListsPage';
import AdminInventoryProductsPage from './pages/AdminInventoryProductsPage';

// Layout
import { MainLayout } from './components/layout/MainLayout';

// Provider Auth (contexte global)
import { AuthProvider } from './contexts/AuthContext';

/** 🔒 Singleton QueryClient (NE PAS créer dans le composant) */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** 🧪 Accès console pour debug: window.qc.getQueriesData({queryKey:['bookings']}) */
if (typeof window !== 'undefined') {
  (window as any).qc = queryClient;
}

/** Séparation des routes pour pouvoir appeler useAuth sous le Provider */
const AppRoutes: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const { notification, hideNotification, showSuccess } = useNotification();

  if (loading) return null;

  return (
    <>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {!isAuthenticated ? (
          <>
            <Route path="/*" element={<AuthPage />} />
          </>
        ) : (
          <Route element={<MainLayout user={user! as any} onLogoutSuccess={showSuccess} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/bookings/all" element={<AllBookingsPage />} />
            <Route path="/tribu" element={<TribesPage />} />
            <Route path="/care/checklists" element={<CareChecklistsPage />} />
            <Route path="/care/Inventory" element={<CareInventoryPage />} />
            {NOTICES.map((n) => (
              <Route key={n.path} path={n.path} element={<n.Component />} />
            ))}

            {/* Routes admin */}
            {user?.is_admin && (
              <Route path="/admin" element={<AdminPanelPage />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="utilisateurs" element={<AdminUsersPage />} />
                <Route path="create-user" element={<CreateUserPage />} />
                <Route path="bookings" element={<AdminBookingsPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                {/* <Route path="evenements" element={<AdminEventsPage />} /> */}
                <Route path="familles" element={<AdminFamilyRelationsPage />} />
                <Route path="tarifs" element={<AdminPricingPage />} />
                <Route path="checklists" element={<AdminChecklistsPage />} />
                <Route path="inventory" element={<AdminInventoryProductsPage />} />
              </Route>
            )}

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}
      </Routes>

      <Snackbar open={notification.open} autoHideDuration={6000} onClose={hideNotification}>
        <Alert severity={notification.severity} onClose={hideNotification}>
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
        <SnackbarProvider maxSnack={3} autoHideDuration={4000}>
          <AuthProvider>
            <Router>
              <AppRoutes />
            </Router>
          </AuthProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

export default App;
