export type SoundMode = 'modern' | 'retro';

export type GameSettings = {
  soundMode: SoundMode;
};

const STORAGE_KEY = 'fou-du-roi-settings';
const DEFAULT_SETTINGS: GameSettings = {
  soundMode: 'modern',
};

type SettingsListener = (settings: GameSettings) => void;

const listeners = new Set<SettingsListener>();
let settings = loadSettings();

function loadSettings(): GameSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      soundMode: parsed.soundMode === 'retro' ? 'retro' : DEFAULT_SETTINGS.soundMode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(nextSettings: GameSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  } catch {
    // Ignore storage failures and keep the in-memory setting.
  }
}

export function getGameSettings(): GameSettings {
  return settings;
}

export function updateGameSettings(patch: Partial<GameSettings>): void {
  settings = {
    ...settings,
    ...patch,
  };
  persistSettings(settings);
  listeners.forEach((listener) => listener(settings));
}

export function subscribeToGameSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  listener(settings);
  return () => listeners.delete(listener);
}
