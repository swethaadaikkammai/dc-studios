import React from 'react';
import { Booking } from '../types';
import { StudioPassCard } from './StudioPassCard';

interface BookingDetailsModalProps {
  booking: Booking | null;
  onClose: () => void;
  onBookingCancelled?: () => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  booking,
  onClose,
  onBookingCancelled,
}) => {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <StudioPassCard
        booking={booking}
        onClose={onClose}
        onBookingCancelled={onBookingCancelled}
        isNewBooking={false}
      />
    </div>
  );
};
