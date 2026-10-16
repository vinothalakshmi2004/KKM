import { env } from '../../config/env.js';

/**
 * Razorpay provider: same interface as the dummy provider. NOT WIRED YET.
 *
 * TODO (when enabling online payment):
 *  1. `npm install razorpay` and set PAYMENT_MODE=razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
 *  2. createOrder(booking): razorpay.orders.create({ amount: Math.round(booking.grandTotal * 100),
 *     currency: 'INR', receipt: booking.onlineRef, notes: { bookingId: String(booking._id) } })
 *     and return { provider: 'razorpay', status: 'created', orderId, amount, currency, keyId }.
 *  3. verify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }): check
 *     HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET) === signature
 *     (crypto.timingSafeEqual), then create ONE Payment (mode "UPI"/"Card") through the
 *     existing addPayment() service and set booking.online.paymentStatus = "Paid".
 *  4. Add a webhook route (payment.captured) that does the same idempotently, keyed by payment id.
 *  5. Expose a POST /api/public/payments/verify route and call it from the booking page's
 *     Razorpay Checkout handler.
 */
export const razorpayProvider = {
  name: 'razorpay',

  async createOrder(_booking) {
    if (!env.razorpay.keyId || !env.razorpay.keySecret) {
      throw new Error('Razorpay keys are not configured');
    }
    throw new Error('Razorpay payments are not enabled yet');
  },

  async verify(_payload) {
    throw new Error('Razorpay payments are not enabled yet');
  },
};
