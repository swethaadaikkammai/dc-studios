import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Booking, Room, Team } from '../types';
import { BookingCard } from '../components/BookingCard';
import { BookingDetailsModal } from '../components/BookingDetailsModal';
import { CreateBookingModal } from '../components/CreateBookingModal';
import {
  Calendar as CalendarIcon,
  Clock,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Layers,
  MapPin,
  CheckCircle2,
  CalendarDays,
  LayoutGrid
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  isSameDay
} from 'date-fns';

interface TimeSlot {
  label: string;
  hour: number;
  minute: number;
  isHour: boolean;
}

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('calendar');
  const [isLoading, setIsLoading] = useState(true);

  // 20 half-hour intervals from 09:00 AM to 07:00 PM
  const TIME_SLOTS: TimeSlot[] = [
    { label: '09:00 AM', hour: 9, minute: 0, isHour: true },
    { label: '09:30 AM', hour: 9, minute: 30, isHour: false },
    { label: '10:00 AM', hour: 10, minute: 0, isHour: true },
    { label: '10:30 AM', hour: 10, minute: 30, isHour: false },
    { label: '11:00 AM', hour: 11, minute: 0, isHour: true },
    { label: '11:30 AM', hour: 11, minute: 30, isHour: false },
    { label: '12:00 PM', hour: 12, minute: 0, isHour: true },
    { label: '12:30 PM', hour: 12, minute: 30, isHour: false },
    { label: '01:00 PM', hour: 13, minute: 0, isHour: true },
    { label: '01:30 PM', hour: 13, minute: 30, isHour: false },
    { label: '02:00 PM', hour: 14, minute: 0, isHour: true },
    { label: '02:30 PM', hour: 14, minute: 30, isHour: false },
    { label: '03:00 PM', hour: 15, minute: 0, isHour: true },
    { label: '03:30 PM', hour: 15, minute: 30, isHour: false },
    { label: '04:00 PM', hour: 16, minute: 0, isHour: true },
    { label: '04:30 PM', hour: 16, minute: 30, isHour: false },
    { label: '05:00 PM', hour: 17, minute: 0, isHour: true },
    { label: '05:30 PM', hour: 17, minute: 30, isHour: false },
    { label: '06:00 PM', hour: 18, minute: 0, isHour: true },
    { label: '06:30 PM', hour: 18, minute: 30, isHour: false },
  ];

  const SLOT_HEIGHT = 50; // px height per 30-min interval
  const TOTAL_HEIGHT = TIME_SLOTS.length * SLOT_HEIGHT; // 1000px

  const loadScheduleData = async () => {
    setIsLoading(true);
    try {
      const [roomsData, teamsData, bookingsData] = await Promise.all([
        api.getRooms(),
        api.getTeams(),
        api.getBookings(),
      ]);
      setRooms(roomsData);
      setTeams(teamsData);
      // Strictly exclude cancelled bookings from the calendar view
      setBookings(bookingsData.filter((b) => b.status !== 'CANCELLED'));
    } catch (e) {
      console.error('Failed to load calendar data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleData();
  }, []);

  const today = new Date();

  // Quick dates for rolling 72-hour window
  const quickDates = [0, 1, 2, 3].map((offset) => {
    const d = addDays(today, offset);
    return {
      date: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : format(d, 'EEE, dd MMM'),
    };
  });

  // Filter bookings for the selected date - strictly exclude CANCELLED bookings so slots are visually available
  const filteredBookings = bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    const bStart = parseISO(b.start_at);
    if (!isSameDay(bStart, selectedDate)) return false;
    if (filterRoomId !== 'all' && b.room_id !== Number(filterRoomId)) return false;
    if (filterTeamId !== 'all' && b.team_id !== Number(filterTeamId)) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    return true;
  });

  const canCreateBooking = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';

  // Compute position of a booking in pixels
  const getBookingLayout = (booking: Booking) => {
    const start = parseISO(booking.start_at);
    const end = parseISO(booking.end_at);

    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();

    // Clamp within 09:00 (540m) and 19:00 (1140m)
    const offsetMins = Math.max(0, startMins - 540);
    const durationMins = Math.min(600 - offsetMins, endMins - startMins);

    const top = (offsetMins / 30) * SLOT_HEIGHT;
    const height = Math.max((durationMins / 30) * SLOT_HEIGHT - 4, 38);

    return { top, height, startFormatted: format(start, 'hh:mm a'), endFormatted: format(end, 'hh:mm a'), durationMins };
  };

  // Team border & badge palette
  const getTeamColor = (teamName: string = '') => {
    if (teamName.includes('Mirage')) return { bg: 'bg-rose-50', border: 'border-rose-400', badge: 'bg-rose-100 text-rose-800', bar: 'bg-rose-500' };
    if (teamName.includes('Unitrix')) return { bg: 'bg-sky-50', border: 'border-sky-400', badge: 'bg-sky-100 text-sky-800', bar: 'bg-sky-500' };
    if (teamName.includes('Riwayaat')) return { bg: 'bg-amber-50', border: 'border-amber-400', badge: 'bg-amber-100 text-amber-900', bar: 'bg-amber-500' };
    if (teamName.includes('Chargers')) return { bg: 'bg-orange-50', border: 'border-orange-400', badge: 'bg-orange-100 text-orange-800', bar: 'bg-orange-500' };
    if (teamName.includes('Bollywood') || teamName.includes('BBC')) return { bg: 'bg-purple-50', border: 'border-purple-400', badge: 'bg-purple-100 text-purple-800', bar: 'bg-purple-500' };
    if (teamName.includes('Maya')) return { bg: 'bg-teal-50', border: 'border-teal-400', badge: 'bg-teal-100 text-teal-800', bar: 'bg-teal-500' };
    if (teamName.includes('JnJ')) return { bg: 'bg-indigo-50', border: 'border-indigo-400', badge: 'bg-indigo-100 text-indigo-800', bar: 'bg-indigo-500' };
    if (teamName.includes('Heritage')) return { bg: 'bg-emerald-50', border: 'border-emerald-400', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' };
    if (teamName.includes('Freestylers')) return { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', badge: 'bg-fuchsia-100 text-fuchsia-800', bar: 'bg-fuchsia-500' };
    return { bg: 'bg-blue-50', border: 'border-blue-400', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-500' };
  };

  // Current time laser indicator
  const isViewingToday = isSameDay(selectedDate, today);
  const now = new Date();
  const currentMinutesFrom9 = (now.getHours() - 9) * 60 + now.getMinutes();
  const currentTimeTop = (currentMinutesFrom9 / 30) * SLOT_HEIGHT;
  const isNowInOperatingHours = currentMinutesFrom9 >= 0 && currentMinutesFrom9 <= 600;

  // Active rooms to display based on filter
  const displayedRooms = filterRoomId === 'all' 
    ? rooms 
    : rooms.filter((r) => r.id === Number(filterRoomId));

  const handleEmptySlotClick = (roomId: number) => {
    if (!canCreateBooking) return;
    setSelectedRoomForBooking(roomId);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">DC Studios Master Schedule</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              PRP201 & PRP202
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual day timetable for both dance studios in <span className="font-semibold text-slate-700">Asia/Kolkata (IST)</span>. Operating hours: 09:00 AM – 07:00 PM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Timetable Calendar
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Session Cards
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedRoomForBooking(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#356AE6] hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {user?.role === 'TEAM_HEAD' ? 'Request Studio' : 'Book Studio'}
          </button>
        </div>
      </div>

      {/* Date Navigation & Rolling 72h Chips */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-slate-900 px-3">
              {format(selectedDate, 'EEEE, dd MMMM yyyy')}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick 72-Hour Date Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {quickDates.map((item) => {
              const isSelected = isSameDay(selectedDate, item.date);
              return (
                <button
                  key={item.dateStr}
                  onClick={() => setSelectedDate(item.date)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-[#14213D] text-white border-[#14213D] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Bar & Legend */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </div>

            {/* Room Filter */}
            <select
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Studios (PRP201 & PRP202)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Team Filter */}
            <select
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Active Bookings</option>
              <option value="CONFIRMED">Confirmed Only</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Quick Visual Legend */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Confirmed Booking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
              <span>Available Slot</span>
            </div>
            {isViewingToday && isNowInOperatingHours && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                <span className="text-rose-600 font-bold">Current Time</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-center py-24 text-slate-400 text-sm flex flex-col items-center gap-2">
          <Hourglass className="w-6 h-6 animate-spin text-blue-500" />
          <span>Loading studio timetable...</span>
        </div>
      ) : viewMode === 'calendar' ? (
        /* ================= TIMETABLE CALENDAR VIEW ================= */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Scrollable Container */}
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Studio Headers Grid */}
              <div className="grid grid-cols-12 bg-slate-50/90 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-sm">
                {/* Time Column Header */}
                <div className="col-span-2 p-3.5 border-r border-slate-200 text-center font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Time (IST)
                </div>

                {/* Studio Columns Headers */}
                {displayedRooms.map((room) => {
                  const isRoom1 = room.name.includes('PRP201');
                  const roomBookings = filteredBookings.filter((b) => b.room_id === room.id);
                  const colSpanClass = displayedRooms.length === 1 ? 'col-span-10' : 'col-span-5';

                  return (
                    <div
                      key={room.id}
                      className={`${colSpanClass} p-3.5 border-r last:border-r-0 border-slate-200 flex items-center justify-between ${
                        isRoom1 ? 'bg-blue-50/40' : 'bg-indigo-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isRoom1 ? 'bg-[#356AE6] text-white' : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {isRoom1 ? 'Lane A' : 'Lane B'}
                        </span>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{room.name}</h3>
                          <span className="text-[11px] text-slate-500">Dance Practice Studio</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                          {roomBookings.length} {roomBookings.length === 1 ? 'Session' : 'Sessions'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timetable Body */}
              <div className="grid grid-cols-12 relative" style={{ height: `${TOTAL_HEIGHT}px` }}>
                {/* 1. Time Column Labels */}
                <div className="col-span-2 border-r border-slate-200 bg-slate-50/50 select-none">
                  {TIME_SLOTS.map((slot, idx) => (
                    <div
                      key={slot.label}
                      style={{ height: `${SLOT_HEIGHT}px` }}
                      className={`px-3 flex items-start justify-end text-[11px] font-semibold border-b ${
                        slot.isHour
                          ? 'border-slate-200 text-slate-700 pt-1'
                          : 'border-slate-100 text-slate-400 font-normal pt-1'
                      }`}
                    >
                      <span>{slot.label}</span>
                    </div>
                  ))}
                </div>

                {/* 2. Room Columns */}
                {displayedRooms.map((room) => {
                  const isRoom1 = room.name.includes('PRP201');
                  const roomBookings = filteredBookings.filter((b) => b.room_id === room.id);
                  const colSpanClass = displayedRooms.length === 1 ? 'col-span-10' : 'col-span-5';

                  return (
                    <div
                      key={room.id}
                      className={`${colSpanClass} relative border-r last:border-r-0 border-slate-200`}
                    >
                      {/* Background 30-min Slot Grid Lines */}
                      {TIME_SLOTS.map((slot, idx) => (
                        <div
                          key={slot.label}
                          onClick={() => handleEmptySlotClick(room.id)}
                          style={{ height: `${SLOT_HEIGHT}px` }}
                          className={`w-full border-b transition-colors group relative ${
                            slot.isHour ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/20'
                          } ${canCreateBooking ? 'hover:bg-blue-50/40 cursor-pointer' : ''}`}
                        >
                          {canCreateBooking && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-[#356AE6] bg-white/95 px-2.5 py-1 rounded-lg border border-blue-200 shadow-xs flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Book {slot.label}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Render Booked Sessions positioned accurately in this room */}
                      {roomBookings.map((b) => {
                        const layout = getBookingLayout(b);
                        const colors = getTeamColor(b.team?.name);

                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBooking(b)}
                            style={{
                              top: `${layout.top}px`,
                              height: `${layout.height}px`,
                            }}
                            className={`absolute left-1.5 right-1.5 rounded-2xl p-2.5 sm:p-3 border shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden z-10 ${colors.bg} ${colors.border} hover:shadow-md hover:scale-[1.008]`}
                          >
                            {/* Color Accent Bar */}
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${colors.bar}`} />

                            <div className="pl-1">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${colors.badge}`}>
                                    {b.team?.name || `Team #${b.team_id}`}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                    {layout.durationMins}m
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  {b.status === 'CONFIRMED' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                                      Booked
                                    </span>
                                  )}
                                  {b.status === 'COMPLETED' && (
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                      Completed
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Prominent Booking Timing Range */}
                              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 tracking-tight mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-[#356AE6] shrink-0" />
                                <span>{layout.startFormatted} – {layout.endFormatted}</span>
                              </div>

                              {/* Purpose details */}
                              {b.purpose && layout.height >= 70 && (
                                <p className="text-[11px] text-slate-600 line-clamp-1 mt-1 font-medium pl-0.5">
                                  {b.purpose}
                                </p>
                              )}
                            </div>

                            {/* Click Hint Footer on larger blocks */}
                            {layout.height >= 90 && (
                              <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/50 mt-1 pl-1">
                                <span className="text-slate-500 truncate">Booked by {b.creator?.username || 'Club Board'}</span>
                                <span className="text-[#356AE6] font-bold underline">View Pass →</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* 3. Current Live Time Laser Marker */}
                {isViewingToday && isNowInOperatingHours && (
                  <div
                    style={{ top: `${currentTimeTop}px` }}
                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  >
                    <div className="w-20 sm:w-24 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-r shadow-sm text-center uppercase tracking-widest shrink-0">
                      Now
                    </div>
                    <div className="flex-1 border-t-2 border-rose-500 relative">
                      <div className="w-2.5 h-2.5 bg-rose-600 rounded-full absolute -top-1.5 -left-1 ring-4 ring-rose-200"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timetable Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">PRP Operating Policy:</span>
              <span>Each studio session must start and end between 09:00 AM and 07:00 PM IST (up to 240 minutes).</span>
            </div>
            <div className="text-slate-400">
              Click any booked session to inspect pass • Click open slot to book
            </div>
          </div>
        </div>
      ) : (
        /* ================= CARDS LIST VIEW ================= */
        <div className="space-y-6">
          {/* Desktop Dual Lane View (PRP201 vs PRP202) */}
          <div className="hidden lg:grid grid-cols-2 gap-6">
            {rooms.map((room) => {
              const roomBookings = filteredBookings.filter((b) => b.room_id === room.id);
              const isRoom1 = room.name.includes('PRP201');

              return (
                <div
                  key={room.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                          isRoom1
                            ? 'bg-blue-50 text-[#356AE6] border border-blue-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {isRoom1 ? 'Lane A' : 'Lane B'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{room.name}</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {roomBookings.length} {roomBookings.length === 1 ? 'Session' : 'Sessions'}
                    </span>
                  </div>

                  {roomBookings.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      No bookings scheduled for this studio today.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {roomBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          onClick={() => setSelectedBooking(b)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile / Tablet Agenda Card Timeline */}
          <div className="lg:hidden space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Agenda for {format(selectedDate, 'dd MMMM yyyy')}
            </h3>

            {filteredBookings.length === 0 ? (
              <div className="py-12 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
                No studio sessions booked for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onClick={() => setSelectedBooking(b)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onBookingCreated={() => {
          loadScheduleData();
        }}
        initialRoomId={selectedRoomForBooking || undefined}
        initialDate={format(selectedDate, 'yyyy-MM-dd')}
      />

      <BookingDetailsModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBookingCancelled={() => {
          loadScheduleData();
        }}
      />
    </div>
  );
};
