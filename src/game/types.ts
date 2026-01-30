export interface TouchInput {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring: boolean;
  isSprinting: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
  /** Current weapon slot (0-2, undefined = no change requested) */
  weaponSlot?: number;
  /** Reload action triggered */
  isReloading?: boolean;
  /** Context-sensitive interaction triggered */
  isInteracting?: boolean;
  /** Whether aim assist is enabled */
  aimAssist?: boolean;
  /** Aim assist strength (0-1) */
  aimAssistStrength?: number;
}

export interface CommsMessage {
  sender: string;
  callsign: string;
  portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
  text: string;
}

export type DeviceType = 'mobile' | 'tablet' | 'foldable' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface ScreenInfo {
  width: number;
  height: number;
  deviceType: DeviceType;
  orientation: Orientation;
  pixelRatio: number;
  isTouchDevice: boolean;
  isFoldable: boolean;
  /** Convenience: true if deviceType is 'mobile' or 'foldable' */
  isMobile: boolean;
}
