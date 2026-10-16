import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Home,
  Users,
  ShieldAlert,
  LogOut,
  Sparkles,
  Music
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

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

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-3">
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

      {/* Mobile Bottom Navigation Bar (as seen in reference design) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#14213D] border-t border-slate-800 shadow-2xl px-3 py-2">
        <div className="flex items-center justify-around">
          <Link
            to="/"
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
              isActive('/') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">Home</span>
          </Link>

          <Link
            to="/calendar"
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
              isActive('/calendar') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1">Schedule</span>
          </Link>

          {(user.role === 'TEAM_HEAD' || user.role === 'BOARD_MEMBER') && (
            <Link
              to="/my-team"
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                isActive('/my-team') ? 'text-[#356AE6] font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] mt-1">{user.role === 'TEAM_HEAD' ? 'Team' : 'Managed'}</span>
            </Link>
          )}

          {user.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                isActive('/admin') ? 'text-amber-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[10px] mt-1">Admin</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};
