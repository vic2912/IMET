import React, { useState } from 'react';
import { Badge, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPanel } from '../components/NotificationPanel';
import { NotificationPanelMobile } from '../components/NotificationPanelMobile';
import type { Notification } from '../types/notification';
import { useTheme } from '@mui/material/styles';

interface Props {
  userId: string;
  onOpenSettings?: () => void;
}

export const NotificationsBell: React.FC<Props> = ({ userId, onOpenSettings }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [openMobile, setOpenMobile] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(userId);

  const open = Boolean(anchorEl);

  const openPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobile) setOpenMobile(true);
    else setAnchorEl(e.currentTarget);
  };
  const closeAll = () => {
    setAnchorEl(null);
    setOpenMobile(false);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={openPanel} aria-label="notifications">
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Desktop */}
      {!isMobile && (
        <NotificationPanel
          anchorEl={anchorEl}
          open={open}
          onClose={closeAll}
          notifications={notifications as Notification[]}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onSettingsClick={() => { closeAll(); onOpenSettings?.(); }}
        />
      )}

      {/* Mobile */}
      {isMobile && (
        <NotificationPanelMobile
          open={openMobile}
          onClose={closeAll}
          notifications={notifications as Notification[]}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onSettingsClick={() => { closeAll(); onOpenSettings?.(); }}
        />
      )}
    </>
  );
};
