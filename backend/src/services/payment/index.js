import { env } from '../../config/env.js';
import { dummyProvider } from './dummy.provider.js';
import { razorpayProvider } from './razorpay.provider.js';

/**
 * Payment providers share one interface:
 *   createOrder(booking) → { provider, status, ...providerData }
 *   verify(payload)      → { provider, status, verified }
 * Only "dummy" is active today; "razorpay" is a stub for later.
 */
const PROVIDERS = { dummy: dummyProvider, razorpay: razorpayProvider };

export const paymentMode = () => env.paymentMode;
export const paymentEnabled = () => env.paymentMode !== 'dummy';
export const getPaymentProvider = () => PROVIDERS[env.paymentMode] || dummyProvider;
