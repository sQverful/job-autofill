/**
 * Stub state manager for lightweight background
 */

export const stateManager = {
  getState: () => ({ auth: { isAuthenticated: false }, autofill: { activeTabId: null, detectedForms: [] } }),
  getStateSlice: () => ({}),
  updateState: () => {},
  addNotification: () => {},
  destroy: () => {},
  getStats: () => ({ state: 'empty' }),
};
