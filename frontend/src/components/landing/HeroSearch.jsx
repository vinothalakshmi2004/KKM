import { useState } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';

const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);

/**
 * Booking search bar in the hero. "Check Availability" opens the online booking page
 * pre-filled with these values (or the WhatsApp enquiry form when online booking is off).
 * `hotels`: shows a hotel picker when there is more than one.
 */
export default function HeroSearch({ hotels = [], onSearch }) {
  const multi = hotels.length > 1;
  const [form, setForm] = useState({
    hotelSlug: hotels.length === 1 ? hotels[0].slug : '',
    checkIn: istDate(0),
    checkOut: istDate(1),
    guests: 2,
    rooms: 1,
    roomType: '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (form.checkOut <= form.checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }
    onSearch({ ...form, guests: Number(form.guests) || 1, rooms: Number(form.rooms) || 1 });
  };

  const cell = 'flex flex-col px-4 py-2.5 border-white/15 sm:border-l first:border-l-0';
  const lbl = 'text-[10px] font-semibold tracking-[0.2em] uppercase text-gold-300';
  const input = 'bg-transparent text-white text-sm font-medium outline-none mt-1 w-full [color-scheme:dark]';

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-5xl rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-2"
      aria-label="Search availability"
    >
      <div className={`grid grid-cols-2 ${multi ? 'lg:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_0.9fr_auto]' : 'lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_0.9fr_auto]'} gap-y-1 items-stretch`}>
        {multi && (
          <label className={`${cell} col-span-2 lg:col-span-1`}>
            <span className={lbl}>Hotel</span>
            <select value={form.hotelSlug} onChange={set('hotelSlug')} className={input}>
              <option value="" className="text-ink">Any hotel</option>
              {hotels.map((h) => <option key={h.slug} value={h.slug} className="text-ink">{h.name}</option>)}
            </select>
          </label>
        )}
        <label className={cell}>
          <span className={lbl}>Check-in</span>
          <input type="date" value={form.checkIn} min={istDate(0)} onChange={set('checkIn')} className={input} required />
        </label>
        <label className={cell}>
          <span className={lbl}>Check-out</span>
          <input type="date" value={form.checkOut} min={form.checkIn || istDate(0)} onChange={set('checkOut')} className={input} required />
        </label>
        <label className={cell}>
          <span className={lbl}>Guests</span>
          <input type="number" min={1} max={50} value={form.guests} onChange={set('guests')} className={input} />
        </label>
        <label className={cell}>
          <span className={lbl}>Rooms</span>
          <input type="number" min={1} max={20} value={form.rooms} onChange={set('rooms')} className={input} />
        </label>
        <label className={`${cell} col-span-2 lg:col-span-1`}>
          <span className={lbl}>Room type</span>
          <select value={form.roomType} onChange={set('roomType')} className={input}>
            <option value="" className="text-ink">Any</option>
            <option value="AC" className="text-ink">AC</option>
            <option value="Non-AC" className="text-ink">Non-AC</option>
          </select>
        </label>
        <div className="col-span-2 lg:col-span-1 p-1">
          <button type="submit" className="btn-gold w-full h-full !rounded-2xl !px-6 min-h-[52px]">
            <Search className="w-4 h-4" /> Check Availability
          </button>
        </div>
      </div>
    </form>
  );
}
