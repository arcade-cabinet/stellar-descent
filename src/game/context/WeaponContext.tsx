import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getAudioManager } from '../core/AudioManager';
import { getEventBus } from '../core/EventBus';
import { hitAudioManager } from '../core/HitAudioManager';
import { WEAPONS, type WeaponId } from '../entities/weapons';
import {
  registerWeaponActions,
  type WeaponActions,
  type WeaponStateSnapshot,
} from './useWeaponActions';

// ---------------------------------------------------------------------------
// Per-weapon ammo state
// ---------------------------------------------------------------------------

/**
 * Ammo state for a single weapon in the inventory
 */
export interface WeaponAmmoState {
  currentAmmo: number;
  reserveAmmo: number;
}

/**
 * Complete weapon inventory state
 */
export interface WeaponInventoryState {
  /** Weapons in slots 1-4 (index 0-3), null means empty slot */
  slots: (WeaponId | null)[];
  /** Per-weapon ammo tracking */
  ammo: Partial<Record<WeaponId, WeaponAmmoState>>;
  /** Currently equipped weapon slot (0-3) */
  currentSlot: number;
  /** Last weapon slot for quick-swap (Q key) */
  lastSlot: number;
}

/**
 * Weapon state for ammo management
 */
export interface WeaponState {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazineSize: number;
  maxReserveAmmo: number;
  isReloading: boolean;
  isSwitching: boolean;
  reloadTimeMs: number;
  currentWeaponId: WeaponId;
  currentWeaponSlot: number;
  /** Full inventory state */
  inventory: WeaponInventoryState;
}

// ---------------------------------------------------------------------------
// Switch animation timing constants
// ---------------------------------------------------------------------------

/** Time to lower the current weapon (ms) */
const SWITCH_LOWER_TIME = 200;
/** Time to raise the new weapon (ms) */
const SWITCH_RAISE_TIME = 300;
/** Total switch animation time (ms) */
const SWITCH_TOTAL_TIME = SWITCH_LOWER_TIME + SWITCH_RAISE_TIME;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

/**
 * Create default ammo state for a weapon based on its definition
 */
function createDefaultAmmoState(weaponId: WeaponId): WeaponAmmoState {
  const def = WEAPONS[weaponId];
  return {
    currentAmmo: def.magazineSize,
    reserveAmmo: def.reserveAmmo,
  };
}

/**
 * Create the default inventory with pistol in slot 1
 */
function createDefaultInventory(): WeaponInventoryState {
  const startingWeapon: WeaponId = 'sidearm';
  return {
    slots: [startingWeapon, null, null, null],
    ammo: {
      [startingWeapon]: createDefaultAmmoState(startingWeapon),
    },
    currentSlot: 0,
    lastSlot: 0,
  };
}

/**
 * Default weapon configuration - starts with pistol
 */
export const DEFAULT_WEAPON_STATE: WeaponState = {
  currentAmmo: WEAPONS.sidearm.magazineSize,
  reserveAmmo: WEAPONS.sidearm.reserveAmmo,
  maxMagazineSize: WEAPONS.sidearm.magazineSize,
  maxReserveAmmo: WEAPONS.sidearm.reserveAmmo,
  isReloading: false,
  isSwitching: false,
  reloadTimeMs: WEAPONS.sidearm.reloadTime,
  currentWeaponId: 'sidearm',
  currentWeaponSlot: 0,
  inventory: createDefaultInventory(),
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
  addAmmo: (amount: number, weaponId?: WeaponId) => void;
  resetWeapon: () => void;
  switchWeapon: (slot: number) => void;
  switchToWeaponId: (weaponId: WeaponId) => void;
  cycleWeapon: (direction: 1 | -1) => void;
  quickSwap: () => void;

  // Inventory management
  grantWeapon: (weaponId: WeaponId) => boolean;
  hasWeapon: (weaponId: WeaponId) => boolean;
  getOwnedWeapons: () => WeaponId[];

  // Configuration
  setWeaponConfig: (config: Partial<WeaponState>) => void;

  // Reload progress (0-1)
  reloadProgress: number;

  // Switch progress (0-1)
  switchProgress: number;
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
  const [weapon, setWeapon] = useState<WeaponState>(() => {
    const base = { ...DEFAULT_WEAPON_STATE };
    if (initialConfig) {
      return { ...base, ...initialConfig };
    }
    return base;
  });

  const [reloadProgress, setReloadProgress] = useState(0);
  const [switchProgress, setSwitchProgress] = useState(0);
  const reloadStartTimeRef = useRef<number | null>(null);
  const reloadAnimationRef = useRef<number | null>(null);
  const switchStartTimeRef = useRef<number | null>(null);
  const switchAnimationRef = useRef<number | null>(null);
  const pendingSwitchRef = useRef<{ slot: number; weaponId: WeaponId } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reloadAnimationRef.current) {
        cancelAnimationFrame(reloadAnimationRef.current);
      }
      if (switchAnimationRef.current) {
        cancelAnimationFrame(switchAnimationRef.current);
      }
    };
  }, []);

  // Computed values - block firing during switch animation
  const canFire = weapon.currentAmmo > 0 && !weapon.isReloading && !weapon.isSwitching;
  const isLowAmmo = weapon.currentAmmo <= weapon.maxMagazineSize * 0.25;

  // Track previous ammo for low ammo warning
  const prevAmmoRef = useRef(weapon.currentAmmo);

  /**
   * Fire the weapon, decrementing ammo
   * Returns true if the shot was fired
   */
  const fire = useCallback((): boolean => {
    // Block firing during switch animation
    if (weapon.isSwitching) {
      return false;
    }

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

      // Emit ammo changed event for HUD
      const eventBus = getEventBus();
      eventBus.emit({ type: 'AMMO_CHANGED', current: newAmmo, max: prev.maxMagazineSize });

      // Also update inventory ammo state
      const updatedAmmo = { ...prev.inventory.ammo };
      updatedAmmo[prev.currentWeaponId] = {
        currentAmmo: newAmmo,
        reserveAmmo: prev.reserveAmmo,
      };

      return {
        ...prev,
        currentAmmo: newAmmo,
        inventory: {
          ...prev.inventory,
          ammo: updatedAmmo,
        },
      };
    });

    return true;
  }, [weapon.currentAmmo, weapon.isReloading, weapon.isSwitching, weapon.currentWeaponId]);

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
    weapon.reloadTimeMs, // Reload complete
    completeReload,
    weapon.currentWeaponId,
  ]);

  /**
   * Complete the reload, moving ammo from reserve to magazine
   */
  const completeReload = useCallback(() => {
    setWeapon((prev) => {
      const ammoNeeded = prev.maxMagazineSize - prev.currentAmmo;
      const ammoToAdd = Math.min(ammoNeeded, prev.reserveAmmo);
      const newCurrentAmmo = prev.currentAmmo + ammoToAdd;
      const newReserveAmmo = prev.reserveAmmo - ammoToAdd;

      // Play reload complete sound
      getAudioManager().playReloadComplete(prev.currentWeaponId, 0.4);

      // Emit ammo changed event for HUD
      const eventBus = getEventBus();
      eventBus.emit({ type: 'AMMO_CHANGED', current: newCurrentAmmo, max: prev.maxMagazineSize });

      // Update inventory ammo state
      const updatedAmmo = { ...prev.inventory.ammo };
      updatedAmmo[prev.currentWeaponId] = {
        currentAmmo: newCurrentAmmo,
        reserveAmmo: newReserveAmmo,
      };

      return {
        ...prev,
        currentAmmo: newCurrentAmmo,
        reserveAmmo: newReserveAmmo,
        isReloading: false,
        inventory: {
          ...prev.inventory,
          ammo: updatedAmmo,
        },
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
   * If weaponId is specified, adds to that weapon's reserve
   * Otherwise adds to current weapon
   */
  const addAmmo = useCallback((amount: number, weaponId?: WeaponId) => {
    setWeapon((prev) => {
      const targetId = weaponId || prev.currentWeaponId;
      const targetDef = WEAPONS[targetId];

      // If adding to current weapon, update both state and inventory
      if (targetId === prev.currentWeaponId) {
        const newReserve = Math.min(prev.reserveAmmo + amount, prev.maxReserveAmmo);
        const newAmmo = { ...prev.inventory.ammo };
        newAmmo[targetId] = {
          currentAmmo: prev.currentAmmo,
          reserveAmmo: newReserve,
        };

        // Emit ammo changed event
        const eventBus = getEventBus();
        eventBus.emit({ type: 'AMMO_CHANGED', current: prev.currentAmmo, max: newReserve });

        return {
          ...prev,
          reserveAmmo: newReserve,
          inventory: {
            ...prev.inventory,
            ammo: newAmmo,
          },
        };
      }

      // Adding to a different weapon in inventory
      const existingAmmo = prev.inventory.ammo[targetId];
      if (!existingAmmo) return prev;

      const newAmmo = { ...prev.inventory.ammo };
      newAmmo[targetId] = {
        currentAmmo: existingAmmo.currentAmmo,
        reserveAmmo: Math.min(existingAmmo.reserveAmmo + amount, targetDef.reserveAmmo),
      };

      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          ammo: newAmmo,
        },
      };
    });
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
   * Internal: Actually perform the weapon swap (called at midpoint of switch animation)
   */
  const performWeaponSwap = useCallback((slot: number, weaponId: WeaponId) => {
    const weaponDef = WEAPONS[weaponId];

    setWeapon((prev) => {
      // Save current weapon's ammo state before switching
      const updatedAmmo = { ...prev.inventory.ammo };
      if (prev.currentWeaponId) {
        updatedAmmo[prev.currentWeaponId] = {
          currentAmmo: prev.currentAmmo,
          reserveAmmo: prev.reserveAmmo,
        };
      }

      // Get ammo for the new weapon
      const newWeaponAmmo = updatedAmmo[weaponId] || createDefaultAmmoState(weaponId);

      // Update inventory
      const newInventory: WeaponInventoryState = {
        ...prev.inventory,
        ammo: updatedAmmo,
        currentSlot: slot,
        lastSlot: prev.inventory.currentSlot,
      };

      return {
        ...prev,
        currentWeaponId: weaponId,
        currentWeaponSlot: slot,
        maxMagazineSize: weaponDef.magazineSize,
        maxReserveAmmo: weaponDef.reserveAmmo,
        reloadTimeMs: weaponDef.reloadTime,
        currentAmmo: newWeaponAmmo.currentAmmo,
        reserveAmmo: newWeaponAmmo.reserveAmmo,
        inventory: newInventory,
      };
    });

    // Emit weapon switched event for HUD
    const eventBus = getEventBus();
    eventBus.emit({ type: 'WEAPON_SWITCHED', weaponId });
  }, []);

  /**
   * Complete the switch animation (called when raise animation finishes)
   */
  const completeSwitchAnimation = useCallback(() => {
    setWeapon((prev) => ({
      ...prev,
      isSwitching: false,
    }));
    switchStartTimeRef.current = null;
    setSwitchProgress(0);
    pendingSwitchRef.current = null;

    // Play weapon equip sound when switch completes
    const currentId = weapon.currentWeaponId;
    getAudioManager().playWeaponEquip(currentId, 0.4);
  }, [weapon.currentWeaponId]);

  /**
   * Start the weapon switch animation
   */
  const startSwitchAnimation = useCallback(
    (slot: number, weaponId: WeaponId) => {
      // Cancel any in-progress reload
      if (weapon.isReloading) {
        cancelReload();
      }

      // Cancel any in-progress switch
      if (switchAnimationRef.current) {
        cancelAnimationFrame(switchAnimationRef.current);
      }

      setWeapon((prev) => ({
        ...prev,
        isSwitching: true,
      }));

      pendingSwitchRef.current = { slot, weaponId };
      switchStartTimeRef.current = performance.now();
      setSwitchProgress(0);

      // Play weapon switch sound (holster)
      getAudioManager().playWeaponSwitch(0.35);

      // Animate switch progress
      const animateSwitch = () => {
        if (!switchStartTimeRef.current) return;

        const elapsed = performance.now() - switchStartTimeRef.current;
        const progress = Math.min(elapsed / SWITCH_TOTAL_TIME, 1);
        setSwitchProgress(progress);

        // At midpoint, perform the actual weapon swap
        if (elapsed >= SWITCH_LOWER_TIME && pendingSwitchRef.current) {
          performWeaponSwap(pendingSwitchRef.current.slot, pendingSwitchRef.current.weaponId);
          pendingSwitchRef.current = null; // Mark as swapped
        }

        if (progress < 1) {
          switchAnimationRef.current = requestAnimationFrame(animateSwitch);
        } else {
          // Switch complete
          completeSwitchAnimation();
        }
      };

      switchAnimationRef.current = requestAnimationFrame(animateSwitch);
    },
    [weapon.isReloading, cancelReload, performWeaponSwap, completeSwitchAnimation]
  );

  /**
   * Switch to a different weapon by slot (0-3)
   */
  const switchWeapon = useCallback(
    (slot: number) => {
      // Validate slot
      if (slot < 0 || slot > 3) return;

      // Check if slot has a weapon
      const weaponId = weapon.inventory.slots[slot];
      if (!weaponId) return;

      // Only switch if different weapon
      if (weaponId === weapon.currentWeaponId) return;

      // Don't switch if already switching
      if (weapon.isSwitching) return;

      startSwitchAnimation(slot, weaponId);
    },
    [weapon.inventory.slots, weapon.currentWeaponId, weapon.isSwitching, startSwitchAnimation]
  );

  /**
   * Switch to a specific weapon by ID (finds it in inventory)
   */
  const switchToWeaponId = useCallback(
    (weaponId: WeaponId) => {
      const slot = weapon.inventory.slots.indexOf(weaponId);
      if (slot >= 0) {
        switchWeapon(slot);
      }
    },
    [weapon.inventory.slots, switchWeapon]
  );

  /**
   * Cycle to next/previous weapon (mouse wheel)
   */
  const cycleWeapon = useCallback(
    (direction: 1 | -1) => {
      if (weapon.isSwitching) return;

      // Find next occupied slot
      const currentSlot = weapon.inventory.currentSlot;
      const slots = weapon.inventory.slots;
      let nextSlot = currentSlot;

      for (let i = 1; i <= 4; i++) {
        const checkSlot = (currentSlot + i * direction + 4) % 4;
        if (slots[checkSlot] !== null) {
          nextSlot = checkSlot;
          break;
        }
      }

      if (nextSlot !== currentSlot) {
        switchWeapon(nextSlot);
      }
    },
    [weapon.isSwitching, weapon.inventory.currentSlot, weapon.inventory.slots, switchWeapon]
  );

  /**
   * Quick swap to last used weapon (Q key)
   */
  const quickSwap = useCallback(() => {
    if (weapon.isSwitching) return;

    const lastSlot = weapon.inventory.lastSlot;
    const lastWeapon = weapon.inventory.slots[lastSlot];

    if (lastWeapon && lastSlot !== weapon.inventory.currentSlot) {
      switchWeapon(lastSlot);
    }
  }, [
    weapon.isSwitching,
    weapon.inventory.lastSlot,
    weapon.inventory.slots,
    weapon.inventory.currentSlot,
    switchWeapon,
  ]);

  /**
   * Grant a new weapon to the player (from pickup)
   * Returns true if weapon was newly added
   */
  const grantWeapon = useCallback(
    (weaponId: WeaponId): boolean => {
      // Check if already owned
      if (weapon.inventory.slots.includes(weaponId)) {
        // Already have it - add ammo instead
        addAmmo(WEAPONS[weaponId].magazineSize, weaponId);
        return false;
      }

      // Find first empty slot
      const emptySlot = weapon.inventory.slots.indexOf(null);
      if (emptySlot === -1) {
        // No empty slots - could implement weapon replacement here
        return false;
      }

      setWeapon((prev) => {
        const newSlots = [...prev.inventory.slots] as (WeaponId | null)[];
        newSlots[emptySlot] = weaponId;

        const newAmmo = { ...prev.inventory.ammo };
        newAmmo[weaponId] = createDefaultAmmoState(weaponId);

        return {
          ...prev,
          inventory: {
            ...prev.inventory,
            slots: newSlots,
            ammo: newAmmo,
          },
        };
      });

      return true;
    },
    [weapon.inventory.slots, addAmmo]
  );

  /**
   * Check if player owns a weapon
   */
  const hasWeapon = useCallback(
    (weaponId: WeaponId): boolean => {
      return weapon.inventory.slots.includes(weaponId);
    },
    [weapon.inventory.slots]
  );

  /**
   * Get list of owned weapons
   */
  const getOwnedWeapons = useCallback((): WeaponId[] => {
    return weapon.inventory.slots.filter((id): id is WeaponId => id !== null);
  }, [weapon.inventory.slots]);

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

  // Also track switching state
  const isSwitchingRef = useRef(weapon.isSwitching);

  useEffect(() => {
    isSwitchingRef.current = weapon.isSwitching;
  }, [weapon.isSwitching]);

  // Register weapon actions for non-React code
  useEffect(() => {
    const actions: WeaponActions = {
      fire,
      startReload,
      cancelReload,
      addAmmo,
      resetWeapon,
      switchWeapon,
      switchToWeaponId,
      cycleWeapon,
      quickSwap,
      grantWeapon,
      hasWeapon,
      getOwnedWeapons,
      getState: (): WeaponStateSnapshot => ({
        currentAmmo: weaponRef.current.currentAmmo,
        reserveAmmo: weaponRef.current.reserveAmmo,
        maxMagazineSize: weaponRef.current.maxMagazineSize,
        maxReserveAmmo: weaponRef.current.maxReserveAmmo,
        isReloading: weaponRef.current.isReloading,
        isSwitching: isSwitchingRef.current,
        canFire: canFireRef.current,
        isLowAmmo: isLowAmmoRef.current,
        currentWeaponId: weaponRef.current.currentWeaponId,
        currentWeaponSlot: weaponRef.current.currentWeaponSlot,
        inventory: weaponRef.current.inventory,
      }),
    };

    registerWeaponActions(actions);

    return () => {
      registerWeaponActions(null);
    };
  }, [
    fire,
    startReload,
    cancelReload,
    addAmmo,
    resetWeapon,
    switchWeapon,
    switchToWeaponId,
    cycleWeapon,
    quickSwap,
    grantWeapon,
    hasWeapon,
    getOwnedWeapons,
  ]);

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
    switchToWeaponId,
    cycleWeapon,
    quickSwap,
    grantWeapon,
    hasWeapon,
    getOwnedWeapons,
    setWeaponConfig,
    reloadProgress,
    switchProgress,
  };

  return <WeaponContext.Provider value={value}>{children}</WeaponContext.Provider>;
}
