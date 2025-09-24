import React, { useState } from 'react';
import {
  Dialog, AppBar, Toolbar, IconButton, Typography, Box, Button, Divider,
  List, ListItem, ListItemButton, ListItemText, ListItemIcon, CircularProgress,
  Alert, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Settings, Delete, Refresh, Notifications as NotificationsIcon, Cancel, Euro, CalendarToday, MarkEmailRead } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification, NotificationType } from '../types/notification';
import { useNavigate } from 'react-router-dom';
import { buildChecklistUrl } from '../routing/buildUrls';

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  onSettingsClick: () => void;
  hasMore?: boolean;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'payment_reminder':
    case 'booking_payment_due':
    case 'expense_approved':
    case 'expense_rejected':
      return <Euro color="primary" />;
    case 'booking_created_for_you':
    case 'booking_confirmed':
    case 'booking_reminder':
      return <CalendarToday color="primary" />;
    case 'booking_cancelled':
      return <Cancel color="error" />;
    default:
      return <NotificationsIcon />;
  }
};
const getPriorityColor = (p: number): 'default'|'info'|'warning'|'error' =>
  p >= 4 ? 'error' : p === 3 ? 'warning' : p === 2 ? 'info' : 'default';

export const NotificationPanelMobile: React.FC<Props> = ({
  open, onClose, notifications, loading, error,
  onMarkAsRead, onMarkAllAsRead, onDelete, onLoadMore, onSettingsClick, hasMore = false
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  function resolveActionUrl(n: Notification): string | null {
    const direct = n?.data?.action_url;
    if (typeof direct === 'string' && direct.length > 0) return direct;
    const action = n?.data?.action;
    const moment = n?.data?.moment;
    if (action === 'open_checklist' && (moment === 'arrival' || moment === 'departure')) {
      return buildChecklistUrl(moment);
    }
    if (n.type === 'arrival_checklist')   return buildChecklistUrl('arrival');
    if (n.type === 'departure_checklist') return buildChecklistUrl('departure');
    return null;
  }
  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }
  function handleItemClick(n: Notification) {
    if (!n.is_read) onMarkAsRead(n.id);
    const url = resolveActionUrl(n);
    if (!url) return;
    onClose();
    if (/^https?:\/\//i.test(url)) window.location.assign(url);
    else navigate(url);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar position="relative" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} aria-label="fermer">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </Typography>
          {unreadCount > 0 && (
            <Button color="inherit" startIcon={<MarkEmailRead />} onClick={onMarkAllAsRead}>
              Tout lire
            </Button>
          )}
          <IconButton onClick={onSettingsClick}>
            <Settings />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

        {loading && notifications.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">Aucune notification</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((n) => (
              <ListItem
                key={n.id}
                disablePadding
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={(e) => handleDelete(e, n.id)} disabled={deletingId === n.id}>
                    {deletingId === n.id ? <CircularProgress size={20} /> : <Delete />}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleItemClick(n)}
                  sx={{
                    bgcolor: n.is_read ? 'transparent' : 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <ListItemIcon>{getNotificationIcon(n.type)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: n.is_read ? 'normal' : 'bold', flex: 1 }}>
                          {n.title}
                        </Typography>
                        {!n.is_read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary" sx={{ display: 'block', mb: 0.5 }}>
                          {n.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                          </Typography>
                          {n.priority >= 3 && (
                            <Chip label="Important" size="small" color={getPriorityColor(n.priority)} sx={{ height: 16 }} />
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

        {hasMore && !loading && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Button onClick={onLoadMore} startIcon={<Refresh />} disabled={loading}>Charger plus</Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};
