// src/hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '../types/notification';
import type { NotificationPreferences, NotificationType } from '../types/notification';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notificationService } from '../services/notificationService';

export const useNotifications = (userId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  const ITEMS_PER_PAGE = 20;

  const loadNotifications = useCallback(async (reset = false) => {
    if (!userId || loading) return;

    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 1 : page;
      const { data, error } = await notificationService.getByUserId(userId, {
        limit: ITEMS_PER_PAGE * currentPage
      });

      if (error) {
        setError(error);
        return;
      }

      if (data) {
        setNotifications(data);
        setHasMore(data.length === ITEMS_PER_PAGE * currentPage);
        if (reset) setPage(1);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await notificationService.getUnreadCount(userId);
    if (!error && data !== undefined) {
      setUnreadCount(data);
    }
  }, [userId]);

  const loadPreferences = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await notificationService.getPreferences(userId);
    if (!error && data) {
      setPreferences(data);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadNotifications(true);
    loadUnreadCount();
    loadPreferences();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = notificationService.subscribeToNotifications(userId, (notification) => {
      setNotifications(prev => [notification, ...prev]);

      if (!notification.is_read) {
        setUnreadCount(prev => prev + 1);
      }

      showNotification(notification);
    });

    setSubscription(channel);

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await notificationService.markAsRead(notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    const { error } = await notificationService.markAllAsRead(userId);

    if (!error) {
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    const { error } = await notificationService.delete(notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));

      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  }, [notifications]);

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!userId) return;

    const { data, error } = await notificationService.updatePreferences(userId, newPreferences);

    if (!error && data) {
      setPreferences(data);
    }
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setPage(prev => prev + 1);
    await loadNotifications();
  }, [hasMore, loading, loadNotifications]);

  const refresh = useCallback(async () => {
    await loadNotifications(true);
    await loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const createNotification = useCallback(async (
    targetUserId: string,
    type: NotificationType,
    variables?: Record<string, any>
  ) => {
    const { error } = await notificationService.createFromTemplate(
      targetUserId,
      type,
      variables
    );

    if (error) {
      setError(error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    preferences,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    loadMore,
    refresh,
    createNotification
  };
};

const showNotification = (notification: Notification) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/icon-192x192.png',
      tag: notification.id,
      data: notification.data
    });
  }
};
