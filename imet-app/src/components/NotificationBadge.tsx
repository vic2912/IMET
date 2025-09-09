// src/components/NotificationBadge.tsx
import React, { useState } from 'react';
import { IconButton, Badge } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { NotificationPanel } from './NotificationPanel';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationBadgeProps {
  userId: string;
  onOpenSettings?: () => void; // <<— AJOUT
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ userId, onOpenSettings }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore
  } = useNotifications(userId);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSettingsClick = () => {
    handleClose();
    onOpenSettings?.();              // <<— OUVERTURE DE LA MODALE
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label={`${unreadCount} notifications non lues`}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <NotificationPanel
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        notifications={notifications}
        loading={loading}
        error={error}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onLoadMore={loadMore}
        onSettingsClick={handleSettingsClick}   // <<— utilise la prop
        hasMore={notifications.length % 20 === 0 && notifications.length > 0}
      />
    </>
  );
};
