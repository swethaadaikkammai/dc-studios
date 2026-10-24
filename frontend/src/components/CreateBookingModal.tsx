import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Team, Room, AvailabilityResponse, AvailabilitySlot } from '../types';
import { StudioPassCard } from './StudioPassCard';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Layers,
  MessageSquare,
  Download,
  Key
} from 'lucide-react';
import { format, addDays, parseISO, isAfter } from 'date-fns';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
  initialRoomId?: number;
  initialDate?: string;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onBookingCreated,
  initialRoomId,
  initialDate,
}) => {
  const { user, hasPermissionToBookTeam } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>(initialRoomId || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [durationIntervals, setDurationIntervals] = useState<number>(1); // 1 = 30m, 2 = 60m, 3 = 90m, 4 = 120m, ..., up to 240m
  const [purpose, setPurpose] = useState<string>('');
  const [isLoadingAvailability, setIsLoadingAvailability] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdBooking, setCreatedBooking] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [keysSecured, setKeysSecured] = useState<boolean>(false);

  // Load teams and rooms on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [teamsData, roomsData] = await Promise.all([
          api.getTeams(),
          api.getRooms(),
        ]);

        // Filter teams based on board permissions
        if (user?.role === 'BOARD_MEMBER') {
          const permittedTeams = teamsData.filter((t) => hasPermissionToBookTeam(t.id));
          setTeams(permittedTeams);
          if (permittedTeams.length > 0 && selectedTeamId === '') {
            setSelectedTeamId(permittedTeams[0].id);
          }
        } else {
          setTeams(teamsData);
          if (teamsData.length > 0 && selectedTeamId === '') {
            setSelectedTeamId(teamsData[0].id);
          }
        }

        setRooms(roomsData);
        if (roomsData.length > 0 && selectedRoomId === '') {
          setSelectedRoomId(roomsData[0].id);
        }
      } catch (e) {
        console.error('Failed to load initial teams/rooms', e);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen, user]);

  // Fetch availability when Room or Date changes
  const fetchAvailability = async () => {
    if (!selectedRoomId || !selectedDate) return;
    setIsLoadingAvailability(true);
    setConflictMsg(null);
    try {
      const res = await api.getAvailability(Number(selectedRoomId), selectedDate);
      setAvailability(res);
      setSelectedSlotIndex(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch studio availability.');
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedRoomId && selectedDate) {
      fetchAvailability();
    }
  }, [isOpen, selectedRoomId, selectedDate]);

  if (!isOpen) return null;

  // Bookable dates calculation: strictly next 72 hours (Today, Tomorrow, +2 days, +3 days)
  const today = new Date();
  const bookableDates = [0, 1, 2, 3].map((offset) => {
    const d = addDays(today, offset);
    return {
      dateStr: format(d, 'yyyy-MM-dd'),
      label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : format(d, 'EEE, dd MMM'),
    };
  });

  const handleSlotSelect = (index: number) => {
    setSelectedSlotIndex(index);
    setDurationIntervals(1);
    setConflictMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setConflictMsg(null);

    if (!selectedTeamId || !selectedRoomId || selectedSlotIndex === null || !availability) {
      setErrorMsg('Please select team, room, date, and time slot.');
      return;
    }

    const isAdmin = user?.role === 'ADMIN';
    const canUseAdminOverride = isAdmin && keysSecured;

    const startSlot = availability.slots[selectedSlotIndex];
    const isStartSlotOk = startSlot && (startSlot.is_available || (canUseAdminOverride && startSlot.can_admin_override));
    if (!startSlot || !isStartSlotOk) {
      setErrorMsg('Selected starting slot is not available.');
      return;
    }

    // Calculate end time based on selected duration intervals
    const endSlotIndex = selectedSlotIndex + durationIntervals - 1;
    if (endSlotIndex >= availability.slots.length) {
      setErrorMsg('Requested booking duration extends past studio operating hours.');
      return;
    }

    // Check if intermediate slots are available
    for (let i = selectedSlotIndex; i <= endSlotIndex; i++) {
      const slot = availability.slots[i];
      const slotOk = slot.is_available || (canUseAdminOverride && slot.can_admin_override);
      if (!slotOk) {
        setErrorMsg(`Slot ${slot.start_time} - ${slot.end_time} is not available.`);
        return;
      }
    }

    const start_at = startSlot.start_at;
    const end_at = availability.slots[endSlotIndex].end_at;

    // Check weekend 24h advance requirement (bypassed if Admin has keys secured)
    if (!canUseAdminOverride) {
      const slotDate = new Date(start_at);
      const dayOfWeek = slotDate.getDay(); // 0 is Sunday, 6 is Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const hoursUntilSlot = (slotDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilSlot < 24) {
          setErrorMsg('Weekend reservations (Saturday & Sunday) must be made at least 1 day (24 hours) prior to the requested time slot.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const newBooking = await api.createBooking({
        team_id: Number(selectedTeamId),
        room_id: Number(selectedRoomId),
        start_at,
        end_at,
        purpose: purpose.trim() || undefined,
        keys_secured: canUseAdminOverride ? true : undefined,
      });

      setCreatedBooking(newBooking);
      onBookingCreated();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictMsg(err.message || 'Slot conflict! Another booking was just placed for this slot.');
        // Refresh availability immediately
        fetchAvailability();
      } else {
        setErrorMsg(err.message || 'Failed to create booking.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdBooking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
        <StudioPassCard
          booking={createdBooking}
          onClose={() => {
            setCreatedBooking(null);
            onClose();
          }}
          isNewBooking={true}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-auto max-h-[92vh] flex flex-col">
        {/* Header - Sticky */}
        <div className="bg-[#14213D] text-white p-4 sm:p-5 relative shrink-0 overflow-hidden">
          {/* Studio Opaque Background with Preserved Color Gradient */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <img
              src="/studio_bg.jpg"
              alt="DC Studios Dance Rehearsal Space"
              className="w-full h-full object-cover object-center scale-105 opacity-25 mix-blend-luminosity filter contrast-125 brightness-95"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#14213D] via-[#1E293B]/85 to-[#356AE6]/75 mix-blend-multiply"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#14213D]/90 via-transparent to-[#356AE6]/50"></div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/10"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative z-10 flex items-center gap-3 mb-2 pr-12">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/25 shrink-0 shadow-md">
              <img src="/logo.png" alt="DC Studios Logo" className="w-full h-full object-cover" />
            </div>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 text-blue-200 text-xs font-semibold uppercase tracking-wider border border-white/20">
              Studio Reservation
            </div>
          </div>
          <h3 className="relative z-10 text-xl font-bold tracking-tight text-white pr-12">Book DC Studios</h3>
          <p className="relative z-10 text-xs text-slate-300 mt-0.5 pr-12">
            Bookings are strictly governed by the rolling 72-hour window and FCFS engine.
          </p>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* 72-Hour Warning & Weekend Notice Alert */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs text-blue-950">
            <Hourglass className="w-4 h-4 text-[#356AE6] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                <span className="font-bold">Rolling 72-Hour Window:</span> Only slots within the next 72 hours from authoritative server time are bookable.
              </div>
              <div>
                <span className="font-bold text-blue-950">Weekend Advance Booking Rule:</span> Saturday and Sunday slots must be reserved at least 1 day (24 hours) prior to the requested time slot.
              </div>
            </div>
          </div>

          {/* Admin Override: Keys Secured for Weekend */}
          {user?.role === 'ADMIN' && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    Keys Secured for Weekend
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                      Admin Rule Override
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Studio keys are verified secured. Enables same-day and short-notice weekend booking.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={keysSecured}
                  onChange={(e) => setKeysSecured(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          )}

          {conflictMsg && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Reservation Conflict: </span>
                {conflictMsg} Availability has been refreshed.
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Dance Team Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Dance Team
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
            >
              <option value="" disabled>Select Team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {user?.role === 'BOARD_MEMBER' && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                Showing teams where you hold approved booking delegation.
              </span>
            )}
          </div>

          {/* 2. Room Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Studio Room
            </label>
            <div className="grid grid-cols-2 gap-3">
              {rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all text-left flex flex-col gap-1 ${
                    selectedRoomId === room.id
                      ? 'bg-[#356AE6] text-white border-[#356AE6] shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-80">Dance Studio</span>
                  <span className="text-sm">{room.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Date Selection (Rolling 72h Window Chips) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Booking Date (Next 72 Hours)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bookableDates.map((item) => (
                <button
                  type="button"
                  key={item.dateStr}
                  onClick={() => setSelectedDate(item.dateStr)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                    selectedDate === item.dateStr
                      ? 'bg-[#14213D] text-white border-[#14213D] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>{item.label}</div>
                  <div className="text-[10px] text-slate-400 opacity-90">{item.dateStr}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Slot Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Available Time Slots (30-min intervals)
              </label>
              {isLoadingAvailability && (
                <span className="text-[11px] text-blue-600 animate-pulse font-medium">Checking live status...</span>
              )}
            </div>

            {availability && (
              <div className="max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availability.slots.map((slot, idx) => {
                  const isSelected = selectedSlotIndex === idx;
                  const isAdmin = user?.role === 'ADMIN';
                  const isOverridden = !slot.is_available && isAdmin && keysSecured && Boolean(slot.can_admin_override);
                  const isClickable = slot.is_available || isOverridden;

                  return (
                    <button
                      type="button"
                      key={slot.start_time}
                      disabled={!isClickable}
                      onClick={() => handleSlotSelect(idx)}
                      title={!isClickable ? slot.reason : isOverridden ? 'Keys secured: Admin override active' : undefined}
                      className={`p-2 rounded-xl text-xs font-semibold text-center border transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? isOverridden
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-[#356AE6] text-white border-[#356AE6] shadow-sm'
                          : slot.is_available
                          ? 'bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                          : isOverridden
                          ? 'bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                          : 'bg-slate-100/70 text-slate-400 border-slate-200/50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-xs font-bold">
                        {slot.start_time} - {slot.end_time}
                      </span>
                      {isOverridden ? (
                        <span className="text-[9px] text-amber-700 font-semibold truncate max-w-full">
                          Keys Secured
                        </span>
                      ) : !slot.is_available ? (
                        <span className="text-[9px] text-rose-500 font-normal truncate max-w-full">
                          {slot.reason}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Duration Selector & Real-Time Booking Timing */}
          {selectedSlotIndex !== null && availability && (
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 rounded-2xl border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#356AE6]" />
                    Select Duration
                  </label>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                    Max {availability.maximum_duration_minutes || 240} mins ({((availability.maximum_duration_minutes || 240) / 60).toFixed(0)} hrs)
                  </span>
                </div>

                {/* Duration Option Buttons with Timing Ranges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Array.from(
                    {
                      length: Math.min(
                        Math.max(1, Math.floor((availability.maximum_duration_minutes || 240) / (availability.slot_interval_minutes || 30))),
                        8
                      )
                    },
                    (_, i) => i + 1
                  ).map((multiplier) => {
                    const isAdmin = user?.role === 'ADMIN';
                    const mins = multiplier * (availability.slot_interval_minutes || 30);
                    const canFit = selectedSlotIndex + multiplier <= availability.slots.length;
                    const endSlot = canFit ? availability.slots[selectedSlotIndex + multiplier - 1] : null;
                    const isContinuous = canFit && availability.slots
                      .slice(selectedSlotIndex, selectedSlotIndex + multiplier)
                      .every((s) => s.is_available || (isAdmin && keysSecured && Boolean(s.can_admin_override)));
                    const isSelectable = canFit && isContinuous;

                    return (
                      <button
                        type="button"
                        key={mins}
                        disabled={!isSelectable}
                        onClick={() => setDurationIntervals(multiplier)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          durationIntervals === multiplier
                            ? 'bg-[#356AE6] text-white border-[#356AE6] shadow-sm'
                            : isSelectable
                            ? 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                            : 'bg-slate-100/70 text-slate-300 border-slate-200/50 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <span className="text-xs font-bold">{mins} mins</span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            durationIntervals === multiplier
                              ? 'text-blue-100'
                              : isSelectable
                              ? 'text-slate-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {endSlot ? endSlot.end_time : 'Out of range'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Prominent Real-Time Booking Timing Banner */}
                {availability.slots[selectedSlotIndex] && (
                  <div className="p-3 bg-white/95 rounded-xl border border-blue-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Booking Timing
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#356AE6]">{availability.slots[selectedSlotIndex].start_time}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-[#356AE6]">
                          {availability.slots[selectedSlotIndex + durationIntervals - 1]?.end_time || '—'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 ml-1">IST</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {durationIntervals * (availability.slot_interval_minutes || 30)} mins ({((durationIntervals * (availability.slot_interval_minutes || 30)) / 60).toFixed(1)} hrs)
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {availability.date}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Purpose Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Practice Purpose / Routine Details (Optional)
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Vibrance Inter-College Megamix Routine"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#356AE6]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedSlotIndex === null}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#356AE6] hover:bg-blue-600 shadow-md shadow-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Securing Slot...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
