import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import { Lock, User as UserIcon, Eye, EyeOff, AlertCircle, HelpCircle, CheckCircle2, MessageSquare, ExternalLink, X } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotAdminUrl, setForgotAdminUrl] = useState<string | null>(null);
  const [forgotAdminUrl2, setForgotAdminUrl2] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(username, password);
      login(res.access_token, res.user);
      navigate('/');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setIsForgotSubmitting(true);

    try {
      const res = await api.forgotPassword({
        username: forgotUsername.trim(),
        contact_phone: forgotPhone.trim() || undefined,
      });
      setForgotSuccess(res.message);
      setForgotAdminUrl(res.admin_whatsapp_url || null);
      setForgotAdminUrl2(res.admin_whatsapp_url_2 || null);
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to submit password reset request. Verify your username.');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      {/* Studio Background with subtle dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-50"
        style={{ backgroundImage: `url('/studio_bg.jpg')` }}
      />
      <div className="absolute inset-0 bg-slate-950/75" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md z-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block w-20 h-20 rounded-full overflow-hidden mb-4 shadow-xl shadow-black/50">
              <img src="/logo.png" alt="DC Studios Logo" className="w-full h-full object-cover rounded-full" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              DC Studios
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Studio Reservation Portal
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              VIT Vellore • PRP201 & PRP202
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or team_head (e.g. mirage_head)"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#356AE6] focus:ring-1 focus:ring-[#356AE6] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#356AE6] focus:ring-1 focus:ring-[#356AE6] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotUsername(username);
                  setForgotError(null);
                  setForgotSuccess(null);
                  setIsForgotModalOpen(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
              >
                Forgot Password? Contact Admin
              </button>
            </div>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">
              Access is restricted to authorized VIT Dance Club members.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                Contact Admin for Password Reset
              </div>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your username below. Submitting will immediately trigger an in-app and device alert to the Administrator to reset your credentials.
            </p>

            {forgotError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 space-y-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="font-bold text-sm">Request Sent to Administrator!</p>
                  <p className="text-slate-300">{forgotSuccess}</p>
                </div>

                <div className="space-y-2">
                  {forgotAdminUrl && (
                    <a
                      href={forgotAdminUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Send WhatsApp Message to Admin {forgotAdminUrl2 ? '(Primary)' : ''}
                    </a>
                  )}
                  {forgotAdminUrl2 && (
                    <a
                      href={forgotAdminUrl2}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Send WhatsApp Message to Admin (Secondary)
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Username
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="e.g. mirage_head"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your WhatsApp Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#356AE6] hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isForgotSubmitting ? 'Notifying Admin...' : 'Notify Admin'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
