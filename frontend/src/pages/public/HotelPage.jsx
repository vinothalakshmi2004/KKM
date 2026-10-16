import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { getPublicHotel, getPublicHotels, dataOf, listOf } from '../../api/services';
import HotelExperience from '../../components/landing/HotelExperience';
import BrandLogo from '../../components/BrandLogo';

export default function HotelPage() {
  const { slug } = useParams();

  // Opening a hotel from further down the landing page should start at its top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  const { data: hotel, isLoading, error } = useQuery({
    queryKey: ['public-hotel', slug],
    queryFn: () => getPublicHotel(slug).then(dataOf),
  });

  // "All hotels" link only makes sense when there is more than one
  const { data: hotels = [] } = useQuery({
    queryKey: ['public-hotels'],
    queryFn: () => getPublicHotels().then(listOf),
  });

  if (isLoading) {
    return (
      <div className="site min-h-screen flex items-center justify-center bg-night">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="site min-h-screen flex flex-col items-center justify-center gap-4 bg-night text-center px-6">
        <BrandLogo full className="w-24 h-24 rounded-2xl" />
        <p className="font-display text-3xl text-white">Hotel not found</p>
        <p className="text-white/70">The page you're looking for doesn't exist or is no longer available.</p>
        <Link to="/" className="btn-gold mt-2"><ChevronLeft className="w-4 h-4" /> Back to home</Link>
      </div>
    );
  }

  return <HotelExperience key={hotel.slug} hotel={hotel} backToHotels={hotels.length > 1} />;
}
