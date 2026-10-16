/**
 * "dummy" payment provider: no money moves. The booking stays "Pay at hotel" with its
 * full balance, and no Payment record is ever created, so nothing is counted as income.
 */
export const dummyProvider = {
  name: 'dummy',

  async createOrder(_booking) {
    return { provider: 'dummy', status: 'skipped' };
  },

  async verify(_payload) {
    return { provider: 'dummy', status: 'skipped', verified: false };
  },
};
