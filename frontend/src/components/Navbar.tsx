import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDeviceNotifications } from '../context/NotificationContext';
import {
  Calendar,
  Home,
  Users,
  ShieldAlert,
  LogOut,
  CalendarPlus,
  Bell,
  BellRing,
  Volume2,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const {
    permission,
    notificationsEnabled,
    requestPermission,
    testNotification,
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,
  } = useDeviceNotifications();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Top Header (Desktop & Mobile) */}
      <header className="sticky top-0 z-40 bg-[#14213D] text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0 border border-slate-700/80 bg-slate-900 flex items-center justify-center">
              <img src="/logo.png" alt="DC Studios Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white leading-none">DC Studios</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 sm:px-2.5 py-1 rounded-full border border-blue-400/30 leading-none inline-flex items-center">
                Booking Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') ? 'bg-[#356AE6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>

            <Link
              to="/calendar"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/calendar') ? 'bg-[#356AE6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Master Schedule
            </Link>

            {/* Book Request — visible to all logged in users */}
            <Link
              to="/book-request"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/book-request') ? 'bg-[#356AE6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CalendarPlus className="w-4 h-4" />
              Book Studio
            </Link>

            {(user.role === 'TEAM_HEAD' || user.role === 'BOARD_MEMBER') && (
              <Link
                to="/my-team"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/my-team') ? 'bg-[#356AE6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                {user.role === 'TEAM_HEAD' ? 'My Team' : 'Managed Teams'}
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/admin') ? 'bg-[#356AE6] text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-300" />
                Admin Console
              </Link>
            )}
          </nav>

          {/* User Profile Pill, Notification Bell & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-Time Device Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  if (!isNotifOpen && unreadCount > 0) {
                    markAllAsRead();
                  }
                }}
                title={notificationsEnabled ? "Device Notifications Active" : "Enable Device Notifications"}
                className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                  notificationsEnabled
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 ring-1 ring-amber-400/30'
                }`}
              >
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5" />
                ) : (
                  <BellRing className="w-5 h-5 text-amber-300 animate-pulse" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center animate-bounce shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {!notificationsEnabled && unreadCount === 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-ping"></span>
                )}
              </button>

              {/* Notification Popover Drawer */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-800 p-4 space-y-3 z-50 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#356AE6]" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Device Notifications
                      </h4>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Device Notification Status Card */}
                  <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                    notificationsEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${notificationsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                        {notificationsEnabled ? 'Device Alerts: ACTIVE' : 'Device Alerts: Inactive'}
                      </span>
                      {notificationsEnabled ? (
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Active</span>
                      ) : (
                        <button
                          onClick={requestPermission}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition-colors shadow-sm cursor-pointer"
                        >
                          Enable Alerts
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {user.role === 'ADMIN'
                        ? 'Alert chime, phone vibration, and floating banner whenever a session is booked or requested.'
                        : 'Alert chime, phone vibration, and floating banner whenever your session is approved or rejected.'}
                    </p>

                    <div className="pt-1 flex items-center justify-between border-t border-slate-200/50">
                      <button
                        onClick={testNotification}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#356AE6] hover:underline cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Test Chime & Alert
                      </button>
                    </div>
                  </div>

                  {/* Recent Notifications Feed */}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No recent notifications.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1 transition-colors ${
                            n.type === 'BOOKING_APPROVED'
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : n.type === 'BOOKING_REJECTED'
                              ? 'bg-rose-50/70 border-rose-200'
                              : n.type === 'REQUEST_SUBMITTED'
                              ? 'bg-blue-50/70 border-blue-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1 truncate">
                              {n.type === 'BOOKING_APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                              {n.type === 'BOOKING_REJECTED' && <XCircle className="w-3 h-3 text-rose-600 shrink-0" />}
                              {n.title}
                            </span>
                            <span className="text-[9px] text-slate-400 shrink-0 ml-1">
                              {format(parseISO(n.timestamp), 'hh:mm a')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {n.message}
                          </p>
                          {n.actionUrl && (
                            <a
                              href={n.actionUrl}
                              target={n.actionUrl.startsWith('http') ? '_blank' : '_self'}
                              rel="noreferrer"
                              onClick={() => setIsNotifOpen(false)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline pt-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> {n.actionLabel || 'View'}
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-white flex items-center gap-1.5 justify-end">
                <span>{user.username}</span>
                {user.team && (
                  <span className="text-xs text-blue-300 bg-blue-950/70 border border-blue-800/60 px-1.5 py-0.5 rounded">
                    {user.team.name}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {user.role === 'ADMIN' && 'Club Administrator'}
                {user.role === 'BOARD_MEMBER' && 'Board Member'}
                {user.role === 'TEAM_HEAD' && 'Team Head'}
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#14213D] border-t border-slate-800 shadow-2xl px-1 py-2">
        <div className="flex items-center justify-around">
          <Link
            to="/"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
              isActive('/') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] mt-1">Home</span>
          </Link>

          <Link
            to="/calendar"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
              isActive('/calendar') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] mt-1">Schedule</span>
          </Link>

          <Link
            to="/book-request"
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
              isActive('/book-request') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarPlus className="w-5 h-5" />
            <span className="text-[9px] mt-1">Book</span>
          </Link>

          {(user.role === 'TEAM_HEAD' || user.role === 'BOARD_MEMBER') && (
            <Link
              to="/my-team"
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                isActive('/my-team') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[9px] mt-1">{user.role === 'TEAM_HEAD' ? 'Team' : 'Managed'}</span>
            </Link>
          )}

          {user.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                isActive('/admin') ? 'text-amber-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[9px] mt-1">Admin</span>
            </Link>
          )}
        </div>
      </div>

      {/* Bottom spacer for mobile nav */}
      <div className="md:hidden h-16" />
    </>
  );
};
