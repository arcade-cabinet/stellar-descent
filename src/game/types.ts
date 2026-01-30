export interface TouchInput {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring: boolean;
  isSprinting: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
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
}
