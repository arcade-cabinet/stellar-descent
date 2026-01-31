import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getAudioManager } from '../core/AudioManager';
import { hitAudioManager } from '../core/HitAudioManager';
import {
  DEFAULT_WEAPON,
  getWeaponBySlot,
  getWeaponSlot,
  WEAPON_SLOTS,
  type WeaponId,
} from '../entities/weapons';
import {
  registerWeaponActions,
  type WeaponActions,
  type WeaponStateSnapshot,
} from './useWeaponActions';

/**
 * Weapon state for ammo management
 */
export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazineSize: number;
  maxReserveAmmo: number;
  isReloading: boolean;
  reloadTimeMs: number;
  currentWeaponId: WeaponId;
  currentWeaponSlot: number;
}

/**
 * Default weapon configuration for standard rifle
 */
export const DEFAULT_WEAPON_STATE: WeaponState = {
  currentAmmo: 30,
  reserveAmmo: 90,
  maxMagazineSize: 30,
  maxReserveAmmo: 150,
  isReloading: false,
  reloadTimeMs: 1800, // 1.8 seconds
  currentWeaponId: DEFAULT_WEAPON,
  currentWeaponSlot: 0,
};

interface WeaponContextType {
  // State
  weapon: WeaponState;
  canFire: boolean;
  isLowAmmo: boolean;

  // Actions
  fire: () => boolean; // Returns true if fired successfully
  startReload: () => void;
  cancelReload: () => void;
  addAmmo: (amount: number) => void;
  resetWeapon: () => void;
  switchWeapon: (slot: number) => void;

  // Configuration
  setWeaponConfig: (config: Partial<WeaponState>) => void;

  // Reload progress (0-1)
  reloadProgress: number;
}

const WeaponContext = createContext<WeaponContextType | null>(null);

export function useWeapon() {
  const context = useContext(WeaponContext);
  if (!context) {
    throw new Error('useWeapon must be used within a WeaponProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if not within provider
 * Useful for components that may or may not have weapon context
 */
export function useWeaponOptional(): WeaponContextType | null {
  return useContext(WeaponContext);
}

interface WeaponProviderProps {
  children: ReactNode;
  initialConfig?: Partial<WeaponState>;
}

export function WeaponProvider({ children, initialConfig }: WeaponProviderProps) {
  const [weapon, setWeapon] = useState<WeaponState>({
    ...DEFAULT_WEAPON_STATE,
    ...initialConfig,
  });

  const [reloadProgress, setReloadProgress] = useState(0);
  const reloadStartTimeRef = useRef<number | null>(null);
  const reloadAnimationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reloadAnimationRef.current) {
        cancelAnimationFrame(reloadAnimationRef.current);
      }
    };
  }, []);

  // Computed values
  const canFire = weapon.currentAmmo > 0 && !weapon.isReloading;
  const isLowAmmo = weapon.currentAmmo <= weapon.maxMagazineSize * 0.25;

  // Track previous ammo for low ammo warning
  const prevAmmoRef = useRef(weapon.currentAmmo);

  /**
   * Fire the weapon, decrementing ammo
   * Returns true if the shot was fired
   */
  const fire = useCallback((): boolean => {
    if (weapon.currentAmmo <= 0 || weapon.isReloading) {
      // Play empty click sound when out of ammo using HitAudioManager
      if (weapon.currentAmmo <= 0 && !weapon.isReloading) {
        hitAudioManager.playEmptyClick();
        // Also play weapon-specific empty click for variety
        getAudioManager().playEmptyClick(weapon.currentWeaponId, 0.2);
      }
      return false;
    }

    setWeapon((prev) => {
      const newAmmo = prev.currentAmmo - 1;
      const lowAmmoThreshold = Math.ceil(prev.maxMagazineSize * 0.25);

      // Play low ammo warning when crossing threshold
      if (prevAmmoRef.current > lowAmmoThreshold && newAmmo <= lowAmmoThreshold) {
        hitAudioManager.playLowAmmoWarning();
      }

      prevAmmoRef.current = newAmmo;

      return {
        ...prev,
        currentAmmo: newAmmo,
      };
    });

    return true;
  }, [weapon.currentAmmo, weapon.isReloading, weapon.currentWeaponId, weapon.maxMagazineSize]);

  /**
   * Start the reload sequence
   */
  const startReload = useCallback(() => {
    // Cannot reload if already reloading, magazine is full, or no reserve ammo
    if (
      weapon.isReloading ||
      weapon.currentAmmo >= weapon.maxMagazineSize ||
      weapon.reserveAmmo <= 0
    ) {
      return;
    }

    setWeapon((prev) => ({
      ...prev,
      isReloading: true,
    }));

    // Play weapon-specific reload sound sequence
    getAudioManager().playWeaponReload(weapon.currentWeaponId, 0.4);

    reloadStartTimeRef.current = performance.now();
    setReloadProgress(0);

    // Animate reload progress
    const animateReload = () => {
      if (!reloadStartTimeRef.current) return;

      const elapsed = performance.now() - reloadStartTimeRef.current;
      const progress = Math.min(elapsed / weapon.reloadTimeMs, 1);
      setReloadProgress(progress);

      if (progress < 1) {
        reloadAnimationRef.current = requestAnimationFrame(animateReload);
      } else {
        // Reload complete
        completeReload();
      }
    };

    reloadAnimationRef.current = requestAnimationFrame(animateReload);
  }, [
    weapon.isReloading,
    weapon.currentAmmo,
    weapon.maxMagazineSize,
    weapon.reserveAmmo,
    weapon.reloadTimeMs,
  ]);

  /**
   * Complete the reload, moving ammo from reserve to magazine
   */
  const completeReload = useCallback(() => {
    setWeapon((prev) => {
      const ammoNeeded = prev.maxMagazineSize - prev.currentAmmo;
      const ammoToAdd = Math.min(ammoNeeded, prev.reserveAmmo);

      // Play reload complete sound
      getAudioManager().playReloadComplete(prev.currentWeaponId, 0.4);

      return {
        ...prev,
        currentAmmo: prev.currentAmmo + ammoToAdd,
        reserveAmmo: prev.reserveAmmo - ammoToAdd,
        isReloading: false,
      };
    });

    reloadStartTimeRef.current = null;
    setReloadProgress(0);
  }, []);

  /**
   * Cancel an in-progress reload
   */
  const cancelReload = useCallback(() => {
    if (reloadAnimationRef.current) {
      cancelAnimationFrame(reloadAnimationRef.current);
    }

    setWeapon((prev) => ({
      ...prev,
      isReloading: false,
    }));

    reloadStartTimeRef.current = null;
    setReloadProgress(0);
  }, []);

  /**
   * Add ammo to reserve (from pickup)
   */
  const addAmmo = useCallback((amount: number) => {
    setWeapon((prev) => ({
      ...prev,
      reserveAmmo: Math.min(prev.reserveAmmo + amount, prev.maxReserveAmmo),
    }));
  }, []);

  /**
   * Reset weapon to default state
   */
  const resetWeapon = useCallback(() => {
    if (reloadAnimationRef.current) {
      cancelAnimationFrame(reloadAnimationRef.current);
    }

    setWeapon({
      ...DEFAULT_WEAPON_STATE,
      ...initialConfig,
    });

    reloadStartTimeRef.current = null;
    setReloadProgress(0);
  }, [initialConfig]);

  /**
   * Update weapon configuration
   */
  const setWeaponConfig = useCallback((config: Partial<WeaponState>) => {
    setWeapon((prev) => ({
      ...prev,
      ...config,
    }));
  }, []);

  /**
   * Switch to a different weapon by slot (0, 1, 2)
   */
  const switchWeapon = useCallback(
    (slot: number) => {
      // Cancel reload if switching
      if (weapon.isReloading) {
        cancelReload();
      }

      const weaponDef = getWeaponBySlot(slot);
      if (!weaponDef) return;

      // Only switch if different weapon
      if (weaponDef.id === weapon.currentWeaponId) return;

      // Play weapon switch sound (holster/draw)
      getAudioManager().playWeaponSwitch(0.35);

      // Play weapon equip sound after switch completes (weapon-specific ready sound)
      setTimeout(() => {
        getAudioManager().playWeaponEquip(weaponDef.id, 0.4);
      }, 350);

      setWeapon((prev) => ({
        ...prev,
        currentWeaponId: weaponDef.id,
        currentWeaponSlot: slot,
        // Update max values for new weapon
        maxMagazineSize: weaponDef.magazineSize,
        maxReserveAmmo: weaponDef.reserveAmmo,
        reloadTimeMs: weaponDef.reloadTime,
        // Start with full magazine for simplicity
        currentAmmo: weaponDef.magazineSize,
        reserveAmmo: weaponDef.reserveAmmo,
      }));
    },
    [weapon.isReloading, weapon.currentWeaponId, cancelReload]
  );

  // Create stable references for weapon actions
  const weaponRef = useRef(weapon);
  const canFireRef = useRef(canFire);
  const isLowAmmoRef = useRef(isLowAmmo);

  // Update refs when values change
  useEffect(() => {
    weaponRef.current = weapon;
    canFireRef.current = canFire;
    isLowAmmoRef.current = isLowAmmo;
  }, [weapon, canFire, isLowAmmo]);

  // Register weapon actions for non-React code
  useEffect(() => {
    const actions: WeaponActions = {
      fire,
      startReload,
      cancelReload,
      addAmmo,
      resetWeapon,
      switchWeapon,
      getState: (): WeaponStateSnapshot => ({
        currentAmmo: weaponRef.current.currentAmmo,
        reserveAmmo: weaponRef.current.reserveAmmo,
        maxMagazineSize: weaponRef.current.maxMagazineSize,
        maxReserveAmmo: weaponRef.current.maxReserveAmmo,
        isReloading: weaponRef.current.isReloading,
        canFire: canFireRef.current,
        isLowAmmo: isLowAmmoRef.current,
        currentWeaponId: weaponRef.current.currentWeaponId,
        currentWeaponSlot: weaponRef.current.currentWeaponSlot,
      }),
    };

    registerWeaponActions(actions);

    return () => {
      registerWeaponActions(null);
    };
  }, [fire, startReload, cancelReload, addAmmo, resetWeapon, switchWeapon]);

  const value: WeaponContextType = {
    weapon,
    canFire,
    isLowAmmo,
    fire,
    startReload,
    cancelReload,
    addAmmo,
    resetWeapon,
    switchWeapon,
    setWeaponConfig,
    reloadProgress,
  };

  return <WeaponContext.Provider value={value}>{children}</WeaponContext.Provider>;
}
