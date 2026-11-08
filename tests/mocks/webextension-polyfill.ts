/** Minimal webextension-polyfill stand-in for jsdom unit tests. */
const browser = {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => undefined,
    },
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
  },
};

export default browser;
