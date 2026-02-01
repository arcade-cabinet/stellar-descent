import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DamageIndicator, HitMarker } from '../../components/ui/DamageIndicators';
import { getAchievementManager } from '../achievements';
import { getAudioManager, type MusicTrack } from '../core/AudioManager';

export interface CombatContextType {
  // Combat stats
  kills: number;
  addKill: () => void;

  // Game events
  onDamage: () => void;
  damageFlash: boolean;

  // Calibration mode (shooting range)
  isCalibrating: boolean;
  setIsCalibrating: (value: boolean) => void;

  // Music/combat state
  inCombat: boolean;
  setInCombat: (value: boolean) => void;
  playMusic: (track: MusicTrack) => void;

  // Damage indicators (for DamageIndicators component)
  damageIndicators: DamageIndicator[];
  addDamageIndicator: (angle: number, damage: number) => void;
  removeDamageIndicator: (id: number) => void;
  hitMarkers: HitMarker[];
  addHitMarker: (damage: number, isCritical?: boolean, isKill?: boolean) => void;
  removeHitMarker: (id: number) => void;
}

const CombatContext = createContext<CombatContextType | null>(null);

export function useCombat() {
  const context = useContext(CombatContext);
  if (!context) {
    throw new Error('useCombat must be used within a CombatProvider');
  }
  return context;
}

interface CombatProviderProps {
  children: ReactNode;
  currentChapter: number;
}

export function CombatProvider({ children, currentChapter }: CombatProviderProps) {
  const [kills, setKills] = useState(0);
  const [damageFlash, setDamageFlash] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [inCombat, setInCombatState] = useState(false);
  const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([]);
  const damageIndicatorIdRef = useRef(0);
  const hitMarkerIdRef = useRef(0);

  const damageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const combatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);
      if (combatTimeoutRef.current) clearTimeout(combatTimeoutRef.current);
    };
  }, []);

  // Play music function
  const playMusic = useCallback((track: MusicTrack) => {
    getAudioManager().playMusic(track, 2);
  }, []);

  // Combat state management with auto-decay
  const setInCombat = useCallback(
    (value: boolean) => {
      setInCombatState(value);

      if (value) {
        // Start combat music
        playMusic('combat');

        // Clear any existing decay timeout
        if (combatTimeoutRef.current) clearTimeout(combatTimeoutRef.current);

        // Auto-decay combat after 8 seconds of no activity
        combatTimeoutRef.current = setTimeout(() => {
          setInCombatState(false);
          // Return to exploration music
          playMusic('exploration');
        }, 8000);
      }
    },
    [playMusic]
  );

  // Music based on chapter changes
  useEffect(() => {
    // Don't override combat music
    if (inCombat) return;

    switch (currentChapter) {
      case 1:
        // Tutorial/Anchor Station - ambient
        playMusic('ambient');
        break;
      case 2:
        // Surface - exploration
        playMusic('exploration');
        break;
      case 7:
        // Boss fight (The Breach - Queen)
        playMusic('boss');
        break;
      case 9:
        // Extraction holdout
        playMusic('exploration');
        break;
      case 10:
        // Final Escape / Victory
        playMusic('victory');
        break;
      default:
        playMusic('exploration');
    }
  }, [currentChapter, inCombat, playMusic]);

  const addKill = useCallback(() => {
    setKills((k) => k + 1);
    // Track kill for achievement progress
    getAchievementManager().onKill();
  }, []);

  const onDamage = useCallback(() => {
    setDamageFlash(true);

    if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);

    damageTimeoutRef.current = setTimeout(() => setDamageFlash(false), 300);
  }, []);

  // Damage indicator management
  const addDamageIndicator = useCallback((angle: number, damage: number) => {
    const id = damageIndicatorIdRef.current++;
    setDamageIndicators((prev) => [...prev, { id, angle, damage, timestamp: performance.now() }]);
  }, []);

  const removeDamageIndicator = useCallback((id: number) => {
    setDamageIndicators((prev) => prev.filter((indicator) => indicator.id !== id));
  }, []);

  // Hit marker management
  const addHitMarker = useCallback((damage: number, isCritical = false, isKill = false) => {
    const id = hitMarkerIdRef.current++;
    setHitMarkers((prev) => [
      ...prev,
      { id, damage, isCritical, isKill, timestamp: performance.now() },
    ]);
  }, []);

  const removeHitMarker = useCallback((id: number) => {
    setHitMarkers((prev) => prev.filter((marker) => marker.id !== id));
  }, []);

  const value: CombatContextType = {
    kills,
    addKill,
    onDamage,
    damageFlash,
    isCalibrating,
    setIsCalibrating,
    inCombat,
    setInCombat,
    playMusic,
    damageIndicators,
    addDamageIndicator,
    removeDamageIndicator,
    hitMarkers,
    addHitMarker,
    removeHitMarker,
  };

  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>;
}
