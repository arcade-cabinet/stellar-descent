import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { CommsMessage, TouchInput } from '../types';

interface GameContextType {
  // Player state
  playerHealth: number;
  maxHealth: number;
  setPlayerHealth: (health: number) => void;

  // Combat stats
  kills: number;
  addKill: () => void;

  // Mission/Objective
  missionText: string;
  setMissionText: (text: string) => void;
  objectiveTitle: string;
  objectiveInstructions: string;
  setObjective: (title: string, instructions: string) => void;
  currentChapter: number;
  setCurrentChapter: (chapter: number) => void;

  // Touch input
  touchInput: TouchInput | null;
  setTouchInput: (input: TouchInput | null) => void;

  // Notifications
  showNotification: (text: string, duration?: number) => void;
  notification: { text: string; id: number } | null;

  // Comms display
  showComms: (message: CommsMessage) => void;
  hideComms: () => void;
  currentComms: CommsMessage | null;
  commsDismissedFlag: number; // Increments when comms dismissed

  // Game events
  onDamage: () => void;
  damageFlash: boolean;

  // Calibration mode (shooting range)
  isCalibrating: boolean;
  setIsCalibrating: (value: boolean) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [maxHealth] = useState(100);
  const [kills, setKills] = useState(0);
  const [missionText, setMissionText] = useState('DROP ZONE ALPHA');
  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [objectiveInstructions, setObjectiveInstructions] = useState('');
  const [currentChapter, setCurrentChapter] = useState(2);
  const [touchInput, setTouchInput] = useState<TouchInput | null>(null);
  const [notification, setNotification] = useState<{ text: string; id: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [currentComms, setCurrentComms] = useState<CommsMessage | null>(null);
  const [commsDismissedFlag, setCommsDismissedFlag] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const addKill = useCallback(() => {
    setKills((k) => k + 1);
  }, []);

  const setObjective = useCallback((title: string, instructions: string) => {
    setObjectiveTitle(title);
    setObjectiveInstructions(instructions);
  }, []);

  // Keep track of timeouts to clear them on unmount
  const notificationTimeouts = useRef<number[]>([]);
  const damageTimeouts = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      notificationTimeouts.current.forEach(window.clearTimeout);
      damageTimeouts.current.forEach(window.clearTimeout);
    };
  }, []);

  const showNotification = useCallback((text: string, duration = 3000) => {
    const id = Date.now();
    setNotification({ text, id });
    const timeoutId = window.setTimeout(() => {
      setNotification((current) => (current?.id === id ? null : current));
    }, duration);
    notificationTimeouts.current.push(timeoutId);
  }, []);

  const showComms = useCallback((message: CommsMessage) => {
    setCurrentComms(message);
  }, []);

  const hideComms = useCallback(() => {
    setCurrentComms(null);
    setCommsDismissedFlag((prev) => prev + 1);
  }, []);

  const onDamage = useCallback(() => {
    setDamageFlash(true);
    const timeoutId = window.setTimeout(() => setDamageFlash(false), 300);
    damageTimeouts.current.push(timeoutId);
  }, []);

  const value: GameContextType = {
    playerHealth,
    maxHealth,
    setPlayerHealth,
    kills,
    addKill,
    missionText,
    setMissionText,
    objectiveTitle,
    objectiveInstructions,
    setObjective,
    currentChapter,
    setCurrentChapter,
    touchInput,
    setTouchInput,
    showNotification,
    notification,
    showComms,
    hideComms,
    currentComms,
    commsDismissedFlag,
    onDamage,
    damageFlash,
    isCalibrating,
    setIsCalibrating,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
