// src/hooks/useNotification.ts

import { useState, useCallback } from 'react';
import type { NotificationSeverity } from '../types/notification';

// Interface locale pour les notifications UI (différente des notifications système)
interface UINotification {
  open: boolean;
  message: string;
  severity: NotificationSeverity;
  autoHideDuration?: number;
}

export const useNotification = () => {
  const [notification, setNotification] = useState<UINotification>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Utiliser useCallback pour éviter les re-créations de fonction
  const showNotification = useCallback((
    message: string, 
    severity: NotificationSeverity = 'success',
    autoHideDuration?: number
  ) => {
    setNotification({
      open: true,
      message,
      severity,
      autoHideDuration
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({
      ...prev,
      open: false
    }));
  }, []);

  // Méthodes de raccourci pour différents types de notifications
  const showSuccess = useCallback((message: string, autoHideDuration?: number) => {
    showNotification(message, 'success', autoHideDuration);
  }, [showNotification]);

  const showError = useCallback((message: string, autoHideDuration?: number) => {
    showNotification(message, 'error', autoHideDuration);
  }, [showNotification]);

  const showWarning = useCallback((message: string, autoHideDuration?: number) => {
    showNotification(message, 'warning', autoHideDuration);
  }, [showNotification]);

  const showInfo = useCallback((message: string, autoHideDuration?: number) => {
    showNotification(message, 'info', autoHideDuration);
  }, [showNotification]);

  return {
    notification,
    showNotification,
    hideNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};