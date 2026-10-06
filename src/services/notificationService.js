/**
 * Notification Center and Browser Notification Service
 */

class NotificationService {
  constructor() {
    this.permission = 'default';
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
    this.listeners = new Set();
    this.notifications = [];
  }

  async requestPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        this.permission = perm;
        return perm === 'granted';
      } catch (e) {
        console.warn('Notification permission error:', e);
        return false;
      }
    }
    return false;
  }

  /**
   * Triggers an in-app notification and an optional system browser notification
   */
  notify({ id, title, body, icon = '/favicon.svg', type = 'info', action = null, data = {} }) {
    const item = {
      id: id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      body,
      icon,
      type,
      action,
      data,
      timestamp: Date.now(),
      read: false,
    };

    this.notifications.unshift(item);
    if (this.notifications.length > 50) {
      this.notifications.pop();
    }
    this.broadcast();

    // Trigger browser notification if allowed and tab is hidden
    if (typeof window !== 'undefined' && 'Notification' in window && this.permission === 'granted' && document.hidden) {
      try {
        const sysNotif = new Notification(title, {
          body,
          icon,
          badge: '/favicon.svg',
          tag: item.id,
        });
        sysNotif.onclick = () => {
          window.focus();
          if (action) action();
        };
      } catch (_) {}
    }

    return item;
  }

  markAllAsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.broadcast();
  }

  clearAll() {
    this.notifications = [];
    this.broadcast();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => this.listeners.delete(listener);
  }

  broadcast() {
    this.listeners.forEach((l) => l([...this.notifications]));
  }
}

export const notificationService = new NotificationService();
