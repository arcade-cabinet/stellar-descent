/**
 * WeaponSelector - Desktop weapon quick-switch HUD element
 *
 * Displays the 3 available weapons with:
 * - Keyboard shortcuts (1, 2, 3)
 * - Current weapon highlighted
 * - Weapon names
 * - Click to switch
 */

import React, { useCallback, useEffect } from 'react';
import { useWeaponOptional } from '../../game/context/WeaponContext';
import { getWeapon, WEAPON_SLOTS } from '../../game/entities/weapons';
import styles from './WeaponSelector.module.css';

interface WeaponSelectorProps {
  visible?: boolean;
}

export function WeaponSelector({ visible = true }: WeaponSelectorProps) {
  const weaponContext = useWeaponOptional();

  // Handle keyboard weapon switching
  useEffect(() => {
    if (!weaponContext || !visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-3 for weapon switching
      if (e.key === '1') {
        weaponContext.switchWeapon(0);
      } else if (e.key === '2') {
        weaponContext.switchWeapon(1);
      } else if (e.key === '3') {
        weaponContext.switchWeapon(2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [weaponContext, visible]);

  // Handle mouse wheel weapon cycling
  useEffect(() => {
    if (!weaponContext || !visible) return;

    const handleWheel = (e: WheelEvent) => {
      // Only cycle weapons if pointer is locked (in gameplay)
      if (document.pointerLockElement) {
        const currentSlot = weaponContext.weapon.currentWeaponSlot;
        const direction = e.deltaY > 0 ? 1 : -1;
        const newSlot = (currentSlot + direction + 3) % 3;
        weaponContext.switchWeapon(newSlot);
      }
    };

    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [weaponContext, visible]);

  const handleSlotClick = useCallback(
    (slot: number) => {
      weaponContext?.switchWeapon(slot);
    },
    [weaponContext]
  );

  if (!weaponContext) return null;

  const currentSlot = weaponContext.weapon.currentWeaponSlot;

  return (
    <div className={`${styles.weaponSelector} ${visible ? styles.visible : styles.hidden}`}>
      {WEAPON_SLOTS.map((weaponId, slot) => {
        const weapon = getWeapon(weaponId);
        const isActive = slot === currentSlot;
        const iconClass =
          weaponId === 'assault_rifle' ? 'rifle' : weaponId === 'plasma_cannon' ? 'plasma' : 'smg';

        return (
          <button
            key={slot}
            type="button"
            className={`${styles.weaponSlot} ${isActive ? styles.active : ''}`}
            onClick={() => handleSlotClick(slot)}
          >
            <span className={styles.weaponKey}>{slot + 1}</span>
            <span className={`${styles.weaponIcon} ${styles[iconClass]}`} />
            <span className={styles.weaponName}>{weapon.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}
