import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useNotification } from './hooks/useNotification';
import { Snackbar, Alert } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { SnackbarProvider } from 'notistack';

// Pages
import { AuthPage } from './pages/AuthPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DashboardPage } from './pages/DashboardPage';
import { BookingsPage } from './pages/BookingsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import AdminFamilyRelationsPage from './pages/AdminFamilyRelationsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
// import { AdminEventsPage } from './pages/AdminEventsPage';

// Layout
import { MainLayout } from './components/layout/MainLayout';

const App: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const { notification, hideNotification, showSuccess, showError } = useNotification();
  const queryClient = new QueryClient();

  if (loading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
        <SnackbarProvider maxSnack={3} autoHideDuration={4000}> {/* Fournisseur Snackbar corrigé ici */}
          <Router>
            <Routes>
              {!isAuthenticated ? (
                <Route path="/*" element={<AuthPage />} />
              ) : (
                <Route element={<MainLayout user={user!} onLogoutSuccess={showSuccess} />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/bookings" element={<BookingsPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />

                  {/* Routes admin */}
                  {user?.is_admin && (
                    <>
                      <Route path="/admin" element={<AdminPanelPage user={user} onShowNotification={(message, severity) => {
                        if (severity === 'success') showSuccess(message);
                        else showError(message);
                      }} />} />
                      <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
                      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                      {/* <Route path="/admin/evenements" element={<AdminEventsPage />} /> */}
                      <Route path="/admin/familles" element={<AdminFamilyRelationsPage />} />
                    </>
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
          </Router>
        </SnackbarProvider>
      </LocalizationProvider>
    
  </QueryClientProvider>);
};

export default App;
