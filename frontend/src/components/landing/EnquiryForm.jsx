import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createPublicEnquiry } from '../../api/services';

// Same rules as the original hotel-page enquiry form, plus the hotel choice and room count
const schema = z
  .object({
    hotelSlug: z.string().min(1, 'Choose a hotel'),
    name: z.string().min(2, 'Name required'),
    phone: z.string().min(10, 'Valid phone required'),
    checkIn: z.string().min(1, 'Check-in required'),
    checkOut: z.string().min(1, 'Check-out required'),
    roomType: z.string().optional(),
    guests: z.coerce.number({ invalid_type_error: 'Enter number of guests' }).min(1, 'At least 1 guest'),
    rooms: z.coerce.number({ invalid_type_error: 'Enter number of rooms' }).min(1, 'At least 1 room').optional(),
    message: z.string().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });

function Field({ label, error, children, className = '' }) {
  return (
    <div className={className}>
      <label className="site-label">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/**
 * WhatsApp enquiry form. Saves the enquiry (POST /public/enquiries), then opens WhatsApp
 * with the details for the chosen hotel.
 * `hotels`: [{ slug, name, whatsappNumber }]; a hotel picker is shown when there is more than one.
 */
export default function EnquiryForm({ hotels, prefill = {}, onDone, compact = false }) {
  const single = hotels.length === 1;
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      hotelSlug: prefill.hotelSlug || (single ? hotels[0].slug : ''),
      checkIn: prefill.checkIn || '',
      checkOut: prefill.checkOut || '',
      guests: prefill.guests || 2,
      rooms: prefill.rooms || 1,
      roomType: prefill.roomType || '',
      name: '',
      phone: '',
      message: '',
    },
  });

  // A new prefill (e.g. another "Book Now") replaces the dates and choices
  useEffect(() => {
    reset((values) => ({
      ...values,
      ...Object.fromEntries(Object.entries(prefill).filter(([, v]) => v !== undefined && v !== '')),
      hotelSlug: prefill.hotelSlug || values.hotelSlug || (single ? hotels[0].slug : ''),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(prefill)]);

  const checkIn = watch('checkIn');

  const mutation = useMutation({
    mutationFn: ({ rooms, message, ...data }) =>
      createPublicEnquiry({
        ...data,
        // The enquiry has no room-count field; keep it in the message for the hotel
        message: [rooms > 1 ? `Rooms needed: ${rooms}` : '', message].filter(Boolean).join('\n'),
      }),
    onSuccess: (_, formData) => {
      const hotel = hotels.find((h) => h.slug === formData.hotelSlug);
      toast.success(hotel?.whatsappNumber ? 'Enquiry sent! Redirecting to WhatsApp…' : 'Enquiry sent! We will contact you soon.');
      const msg = encodeURIComponent(
        `Hi! I'd like to enquire about a room booking${hotel ? ` at ${hotel.name}` : ''}.\n\nName: ${formData.name}\nPhone: ${formData.phone}\nCheck-in: ${formData.checkIn}\nCheck-out: ${formData.checkOut}\nRoom Type: ${formData.roomType || 'Any'}\nGuests: ${formData.guests}\n${formData.rooms > 1 ? `Rooms: ${formData.rooms}\n` : ''}${formData.message ? 'Message: ' + formData.message : ''}`
      );
      reset();
      onDone?.();
      const waNumber = hotel?.whatsappNumber?.replace(/\D/g, '');
      // Navigate rather than window.open: after the await, popup blockers would stop a new window
      if (waNumber) window.location.href = `https://wa.me/${waNumber}?text=${msg}`;
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to send enquiry. Please try again.'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4" noValidate>
      {!single && (
        <Field label="Hotel" error={errors.hotelSlug?.message}>
          <select {...register('hotelSlug')} className="site-field">
            <option value="">Choose a hotel…</option>
            {hotels.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
          </select>
        </Field>
      )}
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <Field label="Your name" error={errors.name?.message}>
          <input {...register('name')} className="site-field" placeholder="Full name" autoComplete="name" />
        </Field>
        <Field label="Phone / WhatsApp" error={errors.phone?.message}>
          <input {...register('phone')} className="site-field" placeholder="10-digit mobile" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Check-in" error={errors.checkIn?.message}>
          <input type="date" {...register('checkIn')} min={today()} className="site-field" />
        </Field>
        <Field label="Check-out" error={errors.checkOut?.message}>
          <input type="date" {...register('checkOut')} min={checkIn || today()} className="site-field" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Guests" error={errors.guests?.message}>
          <input type="number" {...register('guests')} className="site-field" min={1} max={50} />
        </Field>
        <Field label="Rooms" error={errors.rooms?.message}>
          <input type="number" {...register('rooms')} className="site-field" min={1} max={20} />
        </Field>
        <Field label="Room type">
          <select {...register('roomType')} className="site-field">
            <option value="">Any</option>
            <option value="AC">AC</option>
            <option value="Non-AC">Non-AC</option>
          </select>
        </Field>
      </div>
      <Field label="Message (optional)">
        <textarea {...register('message')} className="site-field resize-none" rows={compact ? 2 : 3} placeholder="Any special requirements…" />
      </Field>
      <button type="submit" disabled={mutation.isPending} className="btn-gold w-full !rounded-xl !py-3.5">
        <MessageCircle className="w-5 h-5" />
        {mutation.isPending ? 'Sending…' : 'Send Enquiry on WhatsApp'}
      </button>
      <p className="text-xs text-center text-ink-soft">We'll confirm availability and price on WhatsApp. No payment is taken online.</p>
    </form>
  );
}
