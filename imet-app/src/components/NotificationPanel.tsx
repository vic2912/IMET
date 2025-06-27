// src/components/NotificationPanel.tsx

import React, { useState } from 'react';
import {
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Chip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Cancel,
  Euro,
  CalendarToday,
  Settings,
  MarkEmailRead,
  Delete,
  Refresh
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification, NotificationType } from '../types/notification';

interface NotificationPanelProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (notificationId: string) => void;
  onLoadMore: () => void;
  onSettingsClick: () => void;
  hasMore?: boolean;
}

// Icônes par type de notification
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'booking_created_for_you':
    case 'booking_confirmed':
    case 'booking_reminder':
      return <CalendarToday color="primary" />;
    case 'booking_cancelled':
      return <Cancel color="error" />;
    case 'booking_payment_due':
    case 'expense_approved':
    case 'expense_rejected':
      return <Euro color="primary" />;
    case 'admin_promotion':
    case 'admin_demotion':
      return <Settings color="secondary" />;
    default:
      return <NotificationsIcon />;
  }
};

// Couleur de la puce par priorité
const getPriorityColor = (priority: number): 'default' | 'info' | 'warning' | 'error' => {
  if (priority >= 4) return 'error';
  if (priority === 3) return 'warning';
  if (priority === 2) return 'info';
  return 'default';
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  anchorEl,
  open,
  onClose,
  notifications,
  loading,
  error,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onLoadMore,
  onSettingsClick,
  hasMore = false
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    setDeletingId(notificationId);
    await onDelete(notificationId);
    setDeletingId(null);
  };

  const handleMarkAsRead = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      onMarkAsRead(notificationId);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: { width: 400, maxHeight: 600 }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          Notifications
          {unreadCount > 0 && (
            <Chip 
              label={unreadCount} 
              size="small" 
              color="primary" 
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        <Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<MarkEmailRead />}
              onClick={onMarkAllAsRead}
              sx={{ mr: 1 }}
            >
              Tout marquer comme lu
            </Button>
          )}
          <IconButton size="small" onClick={onSettingsClick}>
            <Settings />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Contenu */}
      <Box sx={{ maxHeight: 450, overflow: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {loading && notifications.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              Aucune notification
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => handleDelete(e, notification.id)}
                    disabled={deletingId === notification.id}
                  >
                    {deletingId === notification.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Delete />
                    )}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleMarkAsRead(notification.id, notification.is_read)}
                  sx={{
                    bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: notification.is_read ? 'normal' : 'bold',
                            flex: 1
                          }}
                        >
                          {notification.title}
                        </Typography>
                        {!notification.is_read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'primary.main'
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{ display: 'block', mb: 0.5 }}
                        >
                          {notification.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: fr
                            })}
                          </Typography>
                          {notification.priority >= 3 && (
                            <Chip
                              label="Important"
                              size="small"
                              color={getPriorityColor(notification.priority)}
                              sx={{ height: 16 }}
                            />
                          )}
                        </Box>
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {/* Bouton Charger plus */}
        {hasMore && !loading && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={onLoadMore}
              startIcon={<Refresh />}
              disabled={loading}
            >
              Charger plus
            </Button>
          </Box>
        )}
      </Box>
    </Popover>
  );
};