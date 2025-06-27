import React from 'react';
import { Box } from '@mui/material';
import { AdminPanel } from '../components/AdminPanel';
import { AdminMenu } from '../components/AdminMenu';
import type { User } from '../types/auth';

export interface AdminPanelPageProps {
  user: User;
  onShowNotification: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({ user, onShowNotification }) => {
  return (
    <Box display="flex">
      <AdminMenu />
      {/* Autres contenus à droite */}
    </Box>
  );
};
