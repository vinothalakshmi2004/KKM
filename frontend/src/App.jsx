import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Public pages
import LandingPage from './pages/public/LandingPage';
import HotelPage from './pages/public/HotelPage';
import LoginPage from './pages/public/LoginPage';
import BookPage from './pages/public/BookPage';
import BookingConfirmed from './pages/public/BookingConfirmed';
import BookingStatus from './pages/public/BookingStatus';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Hotels from './pages/admin/Hotels';
import Rooms from './pages/admin/Rooms';
import Bookings from './pages/admin/Bookings';
import BookingDetail from './pages/admin/BookingDetail';
import NewBooking from './pages/admin/NewBooking';
import Inhouse from './pages/admin/Inhouse';
import Guests from './pages/admin/Guests';
import GuestDetail from './pages/admin/GuestDetail';
import Income from './pages/admin/Income';
import Expenses from './pages/admin/Expenses';
import Reports from './pages/admin/Reports';
import Gallery from './pages/admin/Gallery';
import Enquiries from './pages/admin/Enquiries';
import Settings from './pages/admin/Settings';
import Onboarding from './pages/admin/Onboarding';
import Invoices from './pages/admin/Invoices';
import InvoiceDetail from './pages/admin/InvoiceDetail';
import OnlineBookings from './pages/admin/OnlineBookings';
import Employees from './pages/admin/Employees';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/hotel/:slug" element={<HotelPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/book/:slug" element={<BookPage />} />
      <Route path="/booking-confirmed" element={<BookingConfirmed />} />
      <Route path="/booking-status" element={<BookingStatus />} />

      {/* Admin */}
      <Route path="/admin/onboarding" element={
        <ProtectedRoute><Onboarding /></ProtectedRoute>
      } />
      <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
      <Route path="/admin/hotels" element={<AdminRoute><Hotels /></AdminRoute>} />
      <Route path="/admin/rooms" element={<AdminRoute><Rooms /></AdminRoute>} />
      <Route path="/admin/bookings" element={<AdminRoute><Bookings /></AdminRoute>} />
      <Route path="/admin/bookings/new" element={<AdminRoute><NewBooking /></AdminRoute>} />
      <Route path="/admin/bookings/:id" element={<AdminRoute><BookingDetail /></AdminRoute>} />
      <Route path="/admin/online-bookings" element={<AdminRoute><OnlineBookings /></AdminRoute>} />
      <Route path="/admin/invoices" element={<AdminRoute><Invoices /></AdminRoute>} />
      <Route path="/admin/invoices/:id" element={<AdminRoute><InvoiceDetail /></AdminRoute>} />
      <Route path="/admin/inhouse" element={<AdminRoute><Inhouse /></AdminRoute>} />
      <Route path="/admin/guests" element={<AdminRoute><Guests /></AdminRoute>} />
      <Route path="/admin/guests/:id" element={<AdminRoute><GuestDetail /></AdminRoute>} />
      <Route path="/admin/income" element={<AdminRoute><Income /></AdminRoute>} />
      <Route path="/admin/expenses" element={<AdminRoute><Expenses /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><Reports /></AdminRoute>} />
      <Route path="/admin/gallery" element={<AdminRoute><Gallery /></AdminRoute>} />
      <Route path="/admin/enquiries" element={<AdminRoute><Enquiries /></AdminRoute>} />
      <Route path="/admin/employees" element={<AdminRoute><Employees /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
