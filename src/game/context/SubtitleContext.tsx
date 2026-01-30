import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * Speaker types for dialogue subtitles
 * Each speaker can have distinct styling (color, icon, etc.)
 */
export type SpeakerType =
  | 'commander'
  | 'ai'
  | 'marcus'
  | 'armory'
  | 'player'
  | 'narrator'
  | 'radio';

/**
 * Subtitle font size options for accessibility
 */
export type SubtitleFontSize = 'small' | 'medium' | 'large' | 'extra-large';

/**
 * Subtitle position on screen
 */
export type SubtitlePosition = 'bottom' | 'top';

/**
 * Speaker display configuration
 */
export interface SpeakerConfig {
  /** Display name for the speaker */
  name: string;
  /** Color for speaker name (CSS color value) */
  color: string;
  /** Optional prefix/icon character */
  prefix?: string;
}

/**
 * Default speaker configurations
 */
export const DEFAULT_SPEAKER_CONFIGS: Record<SpeakerType, SpeakerConfig> = {
  commander: {
    name: 'CDR. VALENCIA',
    color: '#b5a642', // Gold/command color
    prefix: '[CMD]',
  },
  ai: {
    name: 'SHIP AI',
    color: '#00aaff', // Cyan/tech color
    prefix: '[AI]',
  },
  marcus: {
    name: 'SGT. MARCUS COLE',
    color: '#6b8e23', // Olive drab/military
    prefix: '[SGT]',
  },
  armory: {
    name: 'GUNNY KOWALSKI',
    color: '#ff6b35', // Orange/armory
    prefix: '[GNY]',
  },
  player: {
    name: 'CPL. CHEN',
    color: '#888888', // Neutral gray
    prefix: '[YOU]',
  },
  narrator: {
    name: '',
    color: '#cccccc', // Light gray
    prefix: '',
  },
  radio: {
    name: 'RADIO',
    color: '#66cc66', // Green/comms
    prefix: '[RDO]',
  },
};

/**
 * Subtitle entry for display
 */
export interface SubtitleEntry {
  id: string;
  speaker: SpeakerType;
  text: string;
  timestamp: number;
  /** Duration in ms before auto-dismiss (0 = manual dismiss) */
  duration: number;
  /** Whether this entry is currently fading out */
  isFadingOut?: boolean;
  /** Priority level for queue ordering (higher = more important) */
  priority?: number;
  /** Associated sound effect (if any) */
  soundEffect?: SoundEffectType;
}

/**
 * Options for showing a subtitle
 */
export interface ShowSubtitleOptions {
  /** Duration in ms before auto-dismiss (0 = manual dismiss) */
  duration?: number;
  /** Priority level for queue ordering (higher = more important) */
  priority?: number;
  /** Associated sound effect description */
  soundEffect?: SoundEffectType;
}

/**
 * Sound effect types for audio descriptions
 */
export type SoundEffectType =
  | 'gunfire'
  | 'explosion'
  | 'footsteps'
  | 'alarm'
  | 'door'
  | 'reload'
  | 'impact'
  | 'radio_static'
  | 'engine'
  | 'ambient';

/**
 * Sound effect descriptions for accessibility
 */
export const SOUND_EFFECT_DESCRIPTIONS: Record<SoundEffectType, string> = {
  gunfire: '[GUNFIRE]',
  explosion: '[EXPLOSION]',
  footsteps: '[FOOTSTEPS]',
  alarm: '[ALARM]',
  door: '[DOOR OPENS]',
  reload: '[WEAPON RELOAD]',
  impact: '[IMPACT]',
  radio_static: '[RADIO STATIC]',
  engine: '[ENGINE ROAR]',
  ambient: '[AMBIENT SOUNDS]',
};

/**
 * Subtitle settings
 */
export interface SubtitleSettings {
  /** Whether subtitles are enabled */
  enabled: boolean;
  /** Font size for subtitles */
  fontSize: SubtitleFontSize;
  /** Position of subtitle display */
  position: SubtitlePosition;
  /** Whether to show speaker names */
  showSpeakerName: boolean;
  /** Whether to show speaker prefix/icon */
  showSpeakerPrefix: boolean;
  /** Background opacity (0-1) */
  backgroundOpacity: number;
  /** Custom speaker colors (overrides defaults) */
  speakerColors: Partial<Record<SpeakerType, string>>;
  /** High contrast mode for better visibility */
  highContrastMode: boolean;
  /** Add text outline/shadow for readability */
  textOutline: boolean;
  /** Show sound effect descriptions [GUNFIRE], [EXPLOSION], etc. */
  showSoundEffects: boolean;
  /** Maximum characters per line before wrapping */
  maxCharsPerLine: number;
}

/**
 * Default subtitle settings - optimized for accessibility
 */
export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true, // Subtitles on by default for accessibility
  fontSize: 'medium',
  position: 'bottom',
  showSpeakerName: true,
  showSpeakerPrefix: true,
  backgroundOpacity: 0.8,
  speakerColors: {},
  highContrastMode: false,
  textOutline: true, // On by default for better readability
  showSoundEffects: true, // On by default for accessibility
  maxCharsPerLine: 60,
};

const STORAGE_KEY = 'stellar-descent-subtitles';

/**
 * Load subtitle settings from localStorage
 */
function loadSettings(): SubtitleSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SUBTITLE_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load subtitle settings from localStorage:', e);
  }
  return { ...DEFAULT_SUBTITLE_SETTINGS };
}

/**
 * Save subtitle settings to localStorage
 */
function saveSettings(settings: SubtitleSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save subtitle settings to localStorage:', e);
  }
}

interface SubtitleContextType {
  /** Current subtitle settings */
  settings: SubtitleSettings;

  /** Update a single setting */
  updateSetting: <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => void;

  /** Update multiple settings at once */
  updateSettings: (updates: Partial<SubtitleSettings>) => void;

  /** Reset settings to defaults */
  resetSettings: () => void;

  /** Current subtitle entries being displayed */
  subtitles: SubtitleEntry[];

  /** Show a subtitle with options */
  showSubtitle: (
    speaker: SpeakerType,
    text: string,
    options?: ShowSubtitleOptions | number
  ) => string;

  /** Hide a specific subtitle by id (with optional fade) */
  hideSubtitle: (id: string, fade?: boolean) => void;

  /** Clear all subtitles */
  clearSubtitles: () => void;

  /** Get speaker configuration (with any custom color overrides) */
  getSpeakerConfig: (speaker: SpeakerType) => SpeakerConfig;

  /** Font size in pixels based on current setting */
  fontSizePx: number;

  /** Show a sound effect description subtitle */
  showSoundEffect: (soundEffect: SoundEffectType, duration?: number) => string;

  /** Format text with proper line breaks for display */
  formatSubtitleText: (text: string) => string[];

  /** Queue a subtitle to show after current ones finish */
  queueSubtitle: (speaker: SpeakerType, text: string, options?: ShowSubtitleOptions) => void;

  /** Process the next item in the queue */
  processQueue: () => void;

  /** Current queue length */
  queueLength: number;
}

const SubtitleContext = createContext<SubtitleContextType | null>(null);

/**
 * Hook to access subtitle context
 */
export function useSubtitles() {
  const context = useContext(SubtitleContext);
  if (!context) {
    throw new Error('useSubtitles must be used within a SubtitleProvider');
  }
  return context;
}

/**
 * Font size mapping to pixels
 */
const FONT_SIZE_MAP: Record<SubtitleFontSize, number> = {
  small: 14,
  medium: 18,
  large: 22,
  'extra-large': 28,
};

interface SubtitleProviderProps {
  children: ReactNode;
}

/** Maximum number of simultaneous subtitles to display */
const MAX_VISIBLE_SUBTITLES = 3;

/** Fade out duration in milliseconds */
const FADE_OUT_DURATION = 300;

/** Queue item for delayed subtitle display */
interface QueuedSubtitle {
  speaker: SpeakerType;
  text: string;
  options: ShowSubtitleOptions;
}

export function SubtitleProvider({ children }: SubtitleProviderProps) {
  const [settings, setSettings] = useState<SubtitleSettings>(loadSettings);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [queue, setQueue] = useState<QueuedSubtitle[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of timeoutRefs.current.values()) {
        clearTimeout(timeout);
      }
      timeoutRefs.current.clear();
    };
  }, []);

  const updateSetting = useCallback(
    <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateSettings = useCallback((updates: Partial<SubtitleSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SUBTITLE_SETTINGS });
  }, []);

  /**
   * Format text with proper line breaks based on maxCharsPerLine setting
   */
  const formatSubtitleText = useCallback(
    (text: string): string[] => {
      const maxChars = settings.maxCharsPerLine;
      if (text.length <= maxChars) {
        return [text];
      }

      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxChars) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    },
    [settings.maxCharsPerLine]
  );

  /**
   * Calculate reading time based on text length
   * Approximately 150 words per minute reading speed
   */
  const calculateReadingTime = useCallback((text: string): number => {
    const wordsPerMinute = 150;
    const words = text.split(/\s+/).length;
    const minutes = words / wordsPerMinute;
    const ms = Math.max(2000, Math.min(8000, minutes * 60 * 1000));
    return ms;
  }, []);

  const hideSubtitle = useCallback((id: string, fade = true) => {
    // Clear any existing timeout for this subtitle
    const existingTimeout = timeoutRefs.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutRefs.current.delete(id);
    }

    if (fade) {
      // Mark as fading out
      setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, isFadingOut: true } : s)));

      // Remove after fade animation
      const fadeTimeout = setTimeout(() => {
        setSubtitles((prev) => prev.filter((s) => s.id !== id));
        timeoutRefs.current.delete(`fade-${id}`);
      }, FADE_OUT_DURATION);
      timeoutRefs.current.set(`fade-${id}`, fadeTimeout);
    } else {
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
    }
  }, []);

  const showSubtitle = useCallback(
    (speaker: SpeakerType, text: string, options?: ShowSubtitleOptions | number): string => {
      const id = `subtitle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Normalize options
      const opts: ShowSubtitleOptions =
        typeof options === 'number' ? { duration: options } : options || {};

      // Use calculated reading time if duration not specified
      const duration = opts.duration ?? calculateReadingTime(text);

      const entry: SubtitleEntry = {
        id,
        speaker,
        text,
        timestamp: Date.now(),
        duration,
        priority: opts.priority ?? 0,
        soundEffect: opts.soundEffect,
        isFadingOut: false,
      };

      setSubtitles((prev) => {
        // Sort by priority and timestamp, keep max visible
        const newSubtitles = [...prev, entry]
          .sort((a, b) => {
            if ((b.priority ?? 0) !== (a.priority ?? 0)) {
              return (b.priority ?? 0) - (a.priority ?? 0);
            }
            return a.timestamp - b.timestamp;
          })
          .slice(-MAX_VISIBLE_SUBTITLES);
        return newSubtitles;
      });

      // Auto-dismiss if duration is set
      if (duration > 0) {
        const timeout = setTimeout(() => {
          hideSubtitle(id, true);
          timeoutRefs.current.delete(id);
        }, duration);
        timeoutRefs.current.set(id, timeout);
      }

      return id;
    },
    [calculateReadingTime, hideSubtitle]
  );

  const showSoundEffect = useCallback(
    (soundEffect: SoundEffectType, duration = 2000): string => {
      if (!settings.showSoundEffects) {
        return '';
      }
      const description = SOUND_EFFECT_DESCRIPTIONS[soundEffect];
      return showSubtitle('narrator', description, { duration, priority: -1, soundEffect });
    },
    [settings.showSoundEffects, showSubtitle]
  );

  const clearSubtitles = useCallback(() => {
    // Clear all timeouts
    for (const timeout of timeoutRefs.current.values()) {
      clearTimeout(timeout);
    }
    timeoutRefs.current.clear();
    setSubtitles([]);
    setQueue([]);
  }, []);

  const processQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      showSubtitle(next.speaker, next.text, next.options);
      return rest;
    });
  }, [showSubtitle]);

  const queueSubtitle = useCallback(
    (speaker: SpeakerType, text: string, options: ShowSubtitleOptions = {}) => {
      setQueue((prev) => [...prev, { speaker, text, options }]);
    },
    []
  );

  // Process queue when subtitles are dismissed
  useEffect(() => {
    if (subtitles.length === 0 && queue.length > 0) {
      processQueue();
    }
  }, [subtitles.length, queue.length, processQueue]);

  const getSpeakerConfig = useCallback(
    (speaker: SpeakerType): SpeakerConfig => {
      const defaultConfig = DEFAULT_SPEAKER_CONFIGS[speaker];
      const customColor = settings.speakerColors[speaker];
      return customColor ? { ...defaultConfig, color: customColor } : defaultConfig;
    },
    [settings.speakerColors]
  );

  const fontSizePx = FONT_SIZE_MAP[settings.fontSize];

  const value: SubtitleContextType = {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    subtitles,
    showSubtitle,
    hideSubtitle,
    clearSubtitles,
    getSpeakerConfig,
    fontSizePx,
    showSoundEffect,
    formatSubtitleText,
    queueSubtitle,
    processQueue,
    queueLength: queue.length,
  };

  return <SubtitleContext.Provider value={value}>{children}</SubtitleContext.Provider>;
}
