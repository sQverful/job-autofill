/**
 * Stub auth manager for lightweight background
 */

export const authManager = {
  getAuthState: async () => ({ isAuthenticated: false, user: null, tokens: null }),
  destroy: () => {},
};
