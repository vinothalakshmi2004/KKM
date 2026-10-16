import { Globe } from 'lucide-react';

/** Small marker for bookings the guest made on the website (source "Online"). */
export default function OnlineTag({ className = 'ml-2 align-middle' }) {
  return (
    <span className={`badge badge-blue gap-1 !px-2 ${className}`} title="Booked online by the guest">
      <Globe className="w-3 h-3" /> Online
    </span>
  );
}
