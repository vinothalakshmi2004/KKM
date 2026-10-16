import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createHotel } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';

const schema = z.object({
  name: z.string().min(2, 'Hotel name required'),
  address: z.string().min(5, 'Address required'),
  city: z.string().min(2, 'City required'),
  phone: z.string().min(10, 'Phone required'),
  whatsappNumber: z.string().min(10, 'WhatsApp number required'),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  checkInTime: z.string().default('12:00'),
  checkOutTime: z.string().default('11:00'),
});

export default function Onboarding() {
  const navigate = useNavigate();
  const { selectHotel } = useHotel();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { checkInTime: '12:00', checkOutTime: '11:00' },
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => v && fd.append(k, v));
      return createHotel(fd);
    },
    onSuccess: (res) => {
      const hotel = res.data?.data || res.data;
      selectHotel(hotel._id || hotel.id);
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast.success('Hotel created! Add your rooms next.');
      navigate('/admin/rooms');
    },
    onError: () => toast.error('Failed to create hotel. Please try again.'),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-bg))] p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <BrandLogo full className="w-28 h-28 mx-auto rounded-2xl shadow-lg mb-4 block" />
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Welcome! Let's set up your hotel</h1>
          <p className="text-ink-500 dark:text-ink-400 text-sm mt-1">You can add more hotels later from the Hotels page.</p>
        </div>

        <div className="card shadow-lg">
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Hotel Name *</label>
                <input {...register('name')} className="input" placeholder="e.g. KKM Grand" />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address *</label>
                <input {...register('address')} className="input" placeholder="Street address" />
                {errors.address && <p className="form-error">{errors.address.message}</p>}
              </div>
              <div>
                <label className="label">City *</label>
                <input {...register('city')} className="input" placeholder="e.g. Chennai" />
                {errors.city && <p className="form-error">{errors.city.message}</p>}
              </div>
              <div>
                <label className="label">Phone *</label>
                <input {...register('phone')} className="input" placeholder="04XX-XXXXXX" />
                {errors.phone && <p className="form-error">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label">WhatsApp Number *</label>
                <input {...register('whatsappNumber')} className="input" placeholder="91XXXXXXXXXX" />
                {errors.whatsappNumber && <p className="form-error">{errors.whatsappNumber.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" {...register('email')} className="input" placeholder="hotel@example.com" />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label">Check-in Time</label>
                <input type="time" {...register('checkInTime')} className="input" />
              </div>
              <div>
                <label className="label">Check-out Time</label>
                <input type="time" {...register('checkOutTime')} className="input" />
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {mutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
              ) : (
                <>Create Hotel <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
