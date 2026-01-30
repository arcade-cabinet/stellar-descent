export interface CommsMessage {
  sender: string;
  callsign: string;
  text: string;
  portrait?: 'commander' | 'marcus' | 'player' | 'ai' | 'armory';
}

export interface TouchInput {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring: boolean;
  isSprinting: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'foldable';

export type Orientation = 'landscape' | 'portrait';

export interface ScreenInfo {
  width: number;
  height: number;
  orientation: Orientation;
  deviceType: DeviceType;
  isTouchDevice: boolean;
  isFoldable?: boolean;
  pixelRatio: number;
}
