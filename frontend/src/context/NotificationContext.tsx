import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { BookingApproval, Booking } from '../types';
import { Bell, CheckCircle2, XCircle, CalendarPlus, ExternalLink, X, Volume2, ShieldAlert } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface AppNotification {
  id: string;
  type: 'REQUEST_SUBMITTED' | 'BOOKING_APPROVED' | 'BOOKING_REJECTED' | 'SESSION_BOOKED' | 'TEST';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationContextType {
  permission: NotificationPermission;
  notificationsEnabled: boolean;
  requestPermission: () => Promise<boolean>;
  playNotificationSound: () => void;
  testNotification: () => void;
  activeToast: AppNotification | null;
  dismissToast: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API notification chime generator (two-tone pleasant chime)
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Note 1: 523.25 Hz (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: 783.99 Hz (G5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dc_studio_notifications');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Track known requests and bookings to detect diffs
  const initialSyncRef = useRef<boolean>(false);
  const knownApprovalStatusesRef = useRef<Map<number, string>>(new Map());
  const knownBookingIdsRef = useRef<Set<number>>(new Set());
  const toastTimeoutRef = useRef<any>(null);

  // Save notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dc_studio_notifications', JSON.stringify(notifications.slice(0, 30)));
    } catch (e) {
      // ignore
    }
  }, [notifications]);

  // Request browser notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Native browser notifications are not supported on this browser.');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        playNotificationChime();
        dispatchAppNotification({
          type: 'TEST',
          title: 'Device Notifications Activated',
          message: 'Real-time alerts enabled for your device. You will receive notifications for studio bookings and approvals.',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to request notification permission', e);
      return false;
    }
  };

  const dispatchAppNotification = (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Play chime sound
    playNotificationChime();

    // Vibrate device on mobile if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 75, 150]);
      } catch (e) {
        // ignore
      }
    }

    // Trigger native browser notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const native = new Notification(newNotif.title, {
          body: newNotif.message,
          icon: '/logo.png',
          tag: `dc-studio-${newNotif.type}`,
        });
        native.onclick = () => {
          window.focus();
          if (newNotif.actionUrl) {
            window.location.href = newNotif.actionUrl;
          }
        };
      } catch (e) {
        // Notification could not be constructed
      }
    }

    // Display in-app floating toast banner
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(newNotif);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 8000);

    // Append to notification list
    setNotifications((prev) => [newNotif, ...prev.slice(0, 29)]);
  };

  const testNotification = () => {
    dispatchAppNotification({
      type: 'TEST',
      title: 'DC Studios Device Notification Test',
      message: 'Sound, vibration, and banner alerts are functioning properly on this device.',
      actionUrl: '/',
      actionLabel: 'Open Dashboard',
    });
  };

  const dismissToast = () => {
    setActiveToast(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Reset tracking state on user change
  useEffect(() => {
    initialSyncRef.current = false;
    knownApprovalStatusesRef.current.clear();
    knownBookingIdsRef.current.clear();
  }, [user?.id, user?.role]);

  // Real-Time Poller
  useEffect(() => {
    if (!user) return;

    const pollUpdates = async () => {
      try {
        // -------------------------------------------------------------------
        // 1. ADMIN USER: Monitor for new booking requests and direct bookings
        // -------------------------------------------------------------------
        if (user.role === 'ADMIN') {
          const [approvals, bookings] = await Promise.all([
            api.getAllApprovalRequests().catch(() => []),
            api.getBookings().catch(() => []),
          ]);

          // Initial cold sync on first run
          if (!initialSyncRef.current) {
            approvals.forEach((a) => {
              knownApprovalStatusesRef.current.set(a.id, a.approval_status);
            });
            bookings.forEach((b) => {
              knownBookingIdsRef.current.add(b.id);
            });
            initialSyncRef.current = true;
            return;
          }

          // Check for new booking requests submitted
          for (const req of approvals) {
            const previousStatus = knownApprovalStatusesRef.current.get(req.id);
            if (!previousStatus && req.approval_status === 'PENDING') {
              // Brand new booking request arrived!
              knownApprovalStatusesRef.current.set(req.id, req.approval_status);
              const startStr = format(parseISO(req.start_at), 'dd MMM, hh:mm a');
              dispatchAppNotification({
                type: 'REQUEST_SUBMITTED',
                title: 'New Studio Booking Request',
                message: `@${req.requester_username || 'Team Head'} requested ${req.room_name || 'Dance Studio'} for ${req.team_name || 'Team'} on ${startStr}.`,
                actionUrl: '/admin',
                actionLabel: 'Review Request',
              });
            } else if (previousStatus !== req.approval_status) {
              knownApprovalStatusesRef.current.set(req.id, req.approval_status);
            }
          }

          // Check for newly confirmed studio bookings
          for (const b of bookings) {
            if (!knownBookingIdsRef.current.has(b.id) && b.status === 'CONFIRMED') {
              knownBookingIdsRef.current.add(b.id);
              const teamName = b.team?.name || `Team #${b.team_id}`;
              const roomName = b.room?.name || `Room #${b.room_id}`;
              const dateStr = format(parseISO(b.start_at), 'dd MMM, hh:mm a');
              dispatchAppNotification({
                type: 'SESSION_BOOKED',
                title: 'New Studio Session Booked',
                message: `${teamName} has booked ${roomName} for ${dateStr}.`,
                actionUrl: '/calendar',
                actionLabel: 'View Schedule',
              });
            }
          }
        }

        // -------------------------------------------------------------------
        // 2. TEAM HEAD USER: Monitor if their request was APPROVED or REJECTED
        // -------------------------------------------------------------------
        if (user.role === 'TEAM_HEAD') {
          const myRequests = await api.getMyApprovalRequests().catch(() => []);

          // Initial cold sync on first run
          if (!initialSyncRef.current) {
            myRequests.forEach((req) => {
              knownApprovalStatusesRef.current.set(req.id, req.approval_status);
            });
            initialSyncRef.current = true;
            return;
          }

          for (const req of myRequests) {
            const previousStatus = knownApprovalStatusesRef.current.get(req.id);

            // Transition: PENDING -> APPROVED
            if (previousStatus === 'PENDING' && req.approval_status === 'APPROVED') {
              knownApprovalStatusesRef.current.set(req.id, 'APPROVED');
              const startStr = format(parseISO(req.start_at), 'dd MMM yyyy, hh:mm a');
              const confPassUrl = req.whatsapp_confirmation_url || req.confirmation_whatsapp_url;
              dispatchAppNotification({
                type: 'BOOKING_APPROVED',
                title: 'Studio Booking Approved!',
                message: `Your booking request (#${req.id}) for ${req.team_name || 'your team'} in ${req.room_name || 'the studio'} on ${startStr} has been APPROVED by the administrator.`,
                actionUrl: confPassUrl || '/my-team',
                actionLabel: confPassUrl ? 'View WhatsApp Pass' : 'View My Team Bookings',
              });
            }
            // Transition: PENDING -> REJECTED
            else if (previousStatus === 'PENDING' && req.approval_status === 'REJECTED') {
              knownApprovalStatusesRef.current.set(req.id, 'REJECTED');
              const reason = req.rejection_reason ? `Reason: ${req.rejection_reason}` : 'No reason specified.';
              dispatchAppNotification({
                type: 'BOOKING_REJECTED',
                title: 'Studio Booking Request Rejected',
                message: `Your booking request (#${req.id}) for ${req.room_name || 'the studio'} was rejected. ${reason}`,
                actionUrl: '/book-request',
                actionLabel: 'Choose Another Slot',
              });
            } else if (!previousStatus) {
              knownApprovalStatusesRef.current.set(req.id, req.approval_status);
            }
          }
        }
      } catch (err) {
        // Silent poll error handling
      }
    };

    // Poll every 3.5 seconds for instant real-time response
    const interval = setInterval(pollUpdates, 3500);
    pollUpdates(); // immediate initial sync

    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        permission,
        notificationsEnabled: permission === 'granted',
        requestPermission,
        playNotificationSound: playNotificationChime,
        testNotification,
        activeToast,
        dismissToast,
        notifications,
        unreadCount,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}

      {/* In-App Floating Toast Notification Banner */}
      {activeToast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-in pointer-events-auto">
          <div
            className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
              activeToast.type === 'BOOKING_APPROVED'
                ? 'bg-emerald-950/95 text-white border-emerald-500/40'
                : activeToast.type === 'BOOKING_REJECTED'
                ? 'bg-rose-950/95 text-white border-rose-500/40'
                : activeToast.type === 'REQUEST_SUBMITTED'
                ? 'bg-blue-950/95 text-white border-blue-500/40'
                : 'bg-slate-900/95 text-white border-slate-700/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  activeToast.type === 'BOOKING_APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : activeToast.type === 'BOOKING_REJECTED'
                    ? 'bg-rose-500/20 text-rose-400'
                    : activeToast.type === 'REQUEST_SUBMITTED'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                {activeToast.type === 'BOOKING_APPROVED' && <CheckCircle2 className="w-5 h-5" />}
                {activeToast.type === 'BOOKING_REJECTED' && <XCircle className="w-5 h-5" />}
                {activeToast.type === 'REQUEST_SUBMITTED' && <CalendarPlus className="w-5 h-5" />}
                {(activeToast.type === 'SESSION_BOOKED' || activeToast.type === 'TEST') && (
                  <Bell className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold tracking-tight truncate">
                    {activeToast.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                </div>
                <p className="text-xs text-slate-200 mt-1 leading-snug line-clamp-2">
                  {activeToast.message}
                </p>

                {activeToast.actionUrl && (
                  <a
                    href={activeToast.actionUrl}
                    target={activeToast.actionUrl.startsWith('http') ? '_blank' : '_self'}
                    rel="noreferrer"
                    onClick={() => dismissToast()}
                    className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-3 h-3 text-blue-600" />
                    {activeToast.actionLabel || 'View Details'}
                  </a>
                )}
              </div>

              <button
                onClick={dismissToast}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useDeviceNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useDeviceNotifications must be used within a NotificationProvider');
  }
  return context;
};
