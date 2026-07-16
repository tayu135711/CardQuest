(function (global) {
  const storageKey = "cardquest:web-state:v4";

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { catches: [] };
      const parsed = JSON.parse(raw);
      return {
        catches: Array.isArray(parsed?.catches) ? parsed.catches : [],
      };
    } catch {
      return { catches: [] };
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function clearState() {
    saveState({ catches: [] });
  }

  function appendCatch(entry) {
    const state = loadState();
    state.catches = [...state.catches, entry];
    saveState(state);
    return state;
  }

  global.CardQuest = global.CardQuest || {};
  global.CardQuest.storage = {
    loadState,
    saveState,
    clearState,
    appendCatch,
  };
})(window);
