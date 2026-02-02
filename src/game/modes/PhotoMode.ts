/**
 * PhotoMode - Capture stunning screenshots with a free-flying camera
 *
 * Features:
 * - Free camera controls (WASD + mouse)
 * - Adjustable FOV, depth of field, focus distance
 * - Filter presets (Cinematic, Noir, Vintage, Neon, Horror)
 * - Real-time effect adjustments (brightness, contrast, saturation, etc.)
 * - Photo capture and local gallery storage
 * - Game pause/resume integration
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ScreenshotTools } from '@babylonjs/core/Misc/screenshotTools';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';

const log = getLogger('PhotoMode');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Filter preset names for photo mode
 */
export type PhotoFilter = 'normal' | 'cinematic' | 'noir' | 'vintage' | 'neon' | 'horror';

/**
 * Photo mode settings state
 */
export interface PhotoModeSettings {
  // Camera
  fov: number; // 30-120 degrees
  focusDistance: number; // meters
  depthOfField: number; // blur intensity 0-1

  // Effects
  filter: PhotoFilter;
  brightness: number; // -1 to 1
  contrast: number; // 0.5 to 2
  saturation: number; // 0 to 2
  vignette: number; // 0 to 1
  filmGrain: number; // 0 to 1
  bloom: number; // 0 to 2
  exposure: number; // 0.5 to 2
  chromaticAberration: number; // 0 to 0.1

  // UI
  showLetterbox: boolean;
  hideUI: boolean;
}

/**
 * Stored photo metadata
 */
export interface PhotoMetadata {
  id: string;
  timestamp: number;
  levelId?: string;
  filter: PhotoFilter;
  thumbnail?: string;
}

/**
 * Photo mode event callbacks
 */
export interface PhotoModeCallbacks {
  onEnter?: () => void;
  onExit?: () => void;
  onCapture?: (photo: PhotoMetadata) => void;
  onSettingsChange?: (settings: PhotoModeSettings) => void;
}

// ============================================================================
// FILTER PRESETS
// ============================================================================

const FILTER_PRESETS: Record<PhotoFilter, Partial<PhotoModeSettings>> = {
  normal: {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    vignette: 0.2,
    filmGrain: 0,
    bloom: 0.5,
    exposure: 1,
    showLetterbox: false,
  },
  cinematic: {
    brightness: -0.05,
    contrast: 1.15,
    saturation: 0.9,
    vignette: 0.4,
    filmGrain: 0.02,
    bloom: 0.6,
    exposure: 0.95,
    showLetterbox: true,
  },
  noir: {
    brightness: 0.1,
    contrast: 1.5,
    saturation: 0,
    vignette: 0.6,
    filmGrain: 0.08,
    bloom: 0.3,
    exposure: 0.85,
    showLetterbox: true,
  },
  vintage: {
    brightness: 0.05,
    contrast: 0.9,
    saturation: 0.7,
    vignette: 0.5,
    filmGrain: 0.12,
    bloom: 0.4,
    exposure: 1.1,
    showLetterbox: false,
  },
  neon: {
    brightness: 0,
    contrast: 1.3,
    saturation: 1.8,
    vignette: 0.3,
    filmGrain: 0,
    bloom: 1.5,
    exposure: 1.05,
    showLetterbox: false,
  },
  horror: {
    brightness: -0.15,
    contrast: 1.2,
    saturation: 0.4,
    vignette: 0.7,
    filmGrain: 0.06,
    bloom: 0.2,
    exposure: 0.75,
    showLetterbox: false,
  },
};

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: PhotoModeSettings = {
  fov: 70,
  focusDistance: 10,
  depthOfField: 0,
  filter: 'normal',
  brightness: 0,
  contrast: 1,
  saturation: 1,
  vignette: 0.2,
  filmGrain: 0,
  bloom: 0.5,
  exposure: 1,
  chromaticAberration: 0,
  showLetterbox: false,
  hideUI: true,
};

// ============================================================================
// STORAGE KEYS
// ============================================================================

const PHOTO_GALLERY_KEY = 'stellar_descent_photo_gallery';
const PHOTO_SETTINGS_KEY = 'stellar_descent_photo_settings';

// ============================================================================
// PHOTO MODE CLASS
// ============================================================================

export class PhotoMode {
  // State
  public isActive = false;
  private isPaused = false;

  // Scene references
  private scene: Scene;
  private originalCamera: Camera | null = null;
  private freeCamera: FreeCamera | null = null;

  // Settings
  private settings: PhotoModeSettings = { ...DEFAULT_SETTINGS };
  private savedOriginalSettings: Partial<PhotoModeSettings> | null = null;

  // Camera control state
  private moveSpeed = 5;
  private rotationSpeed = 0.002;
  private keysPressed: Set<string> = new Set();
  private maxRangeFromPlayer = 100; // Maximum distance from player position
  private playerPosition: Vector3 = Vector3.Zero();

  // Callbacks
  private callbacks: PhotoModeCallbacks = {};

  // Event listener cleanup
  private cleanupListeners: (() => void)[] = [];

  // Gallery
  private gallery: PhotoMetadata[] = [];

  constructor(scene: Scene, callbacks?: PhotoModeCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks || {};
    this.loadGallery();
    this.loadSavedSettings();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Enter photo mode - pauses game and enables free camera
   */
  enterPhotoMode(): void {
    if (this.isActive) return;

    log.info('Entering photo mode');
    this.isActive = true;

    // Store original camera
    this.originalCamera = this.scene.activeCamera;

    // Store player position for range limiting
    if (this.originalCamera) {
      this.playerPosition = this.originalCamera.position.clone();
    }

    // Create free camera at current position
    this.createFreeCamera();

    // Save original post-processing settings
    this.saveOriginalSettings();

    // Apply current filter
    this.applyFilter(this.settings.filter);

    // Set up controls
    this.setupControls();

    // Pause the game
    this.pauseGame();

    // Notify callback
    this.callbacks.onEnter?.();
  }

  /**
   * Exit photo mode - resumes game and restores original camera
   */
  exitPhotoMode(): void {
    if (!this.isActive) return;

    log.info('Exiting photo mode');
    this.isActive = false;

    // Restore original settings
    this.restoreOriginalSettings();

    // Restore original camera
    if (this.originalCamera) {
      this.scene.activeCamera = this.originalCamera;
    }

    // Dispose free camera
    if (this.freeCamera) {
      this.freeCamera.dispose();
      this.freeCamera = null;
    }

    // Clean up controls
    this.cleanupControls();

    // Resume game
    this.resumeGame();

    // Notify callback
    this.callbacks.onExit?.();
  }

  /**
   * Capture a photo and save to gallery
   */
  async capturePhoto(): Promise<Blob | null> {
    if (!this.isActive || !this.freeCamera) {
      log.warn('Cannot capture photo - photo mode not active');
      return null;
    }

    try {
      log.info('Capturing photo...');

      // Get screenshot as data URL
      const dataUrl = await this.takeScreenshot();
      if (!dataUrl) {
        log.error('Failed to capture screenshot');
        return null;
      }

      // Convert to blob
      const blob = await this.dataUrlToBlob(dataUrl);

      // Create metadata
      const metadata: PhotoMetadata = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        filter: this.settings.filter,
        thumbnail: await this.createThumbnail(dataUrl),
      };

      // Add to gallery
      this.gallery.push(metadata);
      this.saveGallery();

      // Save full image to IndexedDB
      await this.savePhotoToStorage(metadata.id, blob);

      // Notify callback
      this.callbacks.onCapture?.(metadata);

      log.info(`Photo captured: ${metadata.id}`);
      return blob;
    } catch (error) {
      log.error('Failed to capture photo:', error);
      return null;
    }
  }

  /**
   * Pause the game (freeze physics, AI, etc.)
   */
  pauseGame(): void {
    this.isPaused = true;
    // The actual pause is handled by the game state machine
    // Photo mode just sets a flag that the game loop should check
  }

  /**
   * Resume the game
   */
  resumeGame(): void {
    this.isPaused = false;
  }

  /**
   * Check if game is paused by photo mode
   */
  isGamePaused(): boolean {
    return this.isPaused;
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  /**
   * Get current settings
   */
  getSettings(): PhotoModeSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<PhotoModeSettings>): void {
    const oldFilter = this.settings.filter;
    this.settings = { ...this.settings, ...updates };

    // If filter changed, apply preset
    if (updates.filter && updates.filter !== oldFilter) {
      this.applyFilter(updates.filter);
    } else {
      // Apply individual settings
      this.applySettings();
    }

    // Save settings
    this.saveSettings();

    // Notify callback
    this.callbacks.onSettingsChange?.(this.settings);
  }

  /**
   * Apply a filter preset
   */
  applyFilter(filter: PhotoFilter): void {
    const preset = FILTER_PRESETS[filter];
    this.settings = { ...this.settings, ...preset, filter };
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Reset settings to default
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.applySettings();
    this.saveSettings();
    this.callbacks.onSettingsChange?.(this.settings);
  }

  /**
   * Set FOV (30-120 degrees)
   */
  setFOV(fov: number): void {
    this.settings.fov = Math.max(30, Math.min(120, fov));
    if (this.freeCamera) {
      this.freeCamera.fov = (this.settings.fov * Math.PI) / 180;
    }
    this.saveSettings();
  }

  /**
   * Set focus distance for depth of field
   */
  setFocusDistance(distance: number): void {
    this.settings.focusDistance = Math.max(0.1, Math.min(1000, distance));
    this.applyDepthOfField();
    this.saveSettings();
  }

  /**
   * Set depth of field blur intensity (0-1)
   */
  setDepthOfField(intensity: number): void {
    this.settings.depthOfField = Math.max(0, Math.min(1, intensity));
    this.applyDepthOfField();
    this.saveSettings();
  }

  // ============================================================================
  // CAMERA CONTROLS
  // ============================================================================

  /**
   * Update camera based on input (call from render loop)
   */
  update(deltaTime: number): void {
    if (!this.isActive || !this.freeCamera) return;

    // Calculate movement direction
    const forward = this.freeCamera.getDirection(Vector3.Forward());
    const right = this.freeCamera.getDirection(Vector3.Right());
    const up = Vector3.Up();

    const moveDirection = Vector3.Zero();

    // WASD movement
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) {
      moveDirection.addInPlace(forward);
    }
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) {
      moveDirection.subtractInPlace(forward);
    }
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) {
      moveDirection.subtractInPlace(right);
    }
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) {
      moveDirection.addInPlace(right);
    }

    // Q/E for vertical movement
    if (this.keysPressed.has('KeyQ')) {
      moveDirection.subtractInPlace(up);
    }
    if (this.keysPressed.has('KeyE')) {
      moveDirection.addInPlace(up);
    }

    // Apply movement
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      const velocity = moveDirection.scale(this.moveSpeed * deltaTime);
      const newPosition = this.freeCamera.position.add(velocity);

      // Check range limit from player
      const distanceFromPlayer = Vector3.Distance(newPosition, this.playerPosition);
      if (distanceFromPlayer <= this.maxRangeFromPlayer) {
        this.freeCamera.position = newPosition;
      } else {
        // Clamp to max range
        const direction = newPosition.subtract(this.playerPosition).normalize();
        this.freeCamera.position = this.playerPosition.add(
          direction.scale(this.maxRangeFromPlayer)
        );
      }
    }
  }

  /**
   * Adjust camera speed via scroll wheel
   */
  adjustSpeed(delta: number): void {
    const factor = delta > 0 ? 0.9 : 1.1;
    this.moveSpeed = Math.max(1, Math.min(50, this.moveSpeed * factor));
    log.debug(`Camera speed: ${this.moveSpeed.toFixed(1)}`);
  }

  // ============================================================================
  // GALLERY MANAGEMENT
  // ============================================================================

  /**
   * Get all photos in gallery
   */
  getGallery(): PhotoMetadata[] {
    return [...this.gallery];
  }

  /**
   * Get a specific photo blob by ID
   */
  async getPhoto(photoId: string): Promise<Blob | null> {
    return this.loadPhotoFromStorage(photoId);
  }

  /**
   * Delete a photo from gallery
   */
  async deletePhoto(photoId: string): Promise<boolean> {
    const index = this.gallery.findIndex((p) => p.id === photoId);
    if (index === -1) return false;

    this.gallery.splice(index, 1);
    this.saveGallery();
    await this.deletePhotoFromStorage(photoId);
    log.info(`Deleted photo: ${photoId}`);
    return true;
  }

  /**
   * Clear all photos from gallery
   */
  async clearGallery(): Promise<void> {
    for (const photo of this.gallery) {
      await this.deletePhotoFromStorage(photo.id);
    }
    this.gallery = [];
    this.saveGallery();
    log.info('Gallery cleared');
  }

  /**
   * Export a photo for sharing (download or share API)
   */
  async sharePhoto(photoId: string): Promise<boolean> {
    const blob = await this.getPhoto(photoId);
    if (!blob) return false;

    const file = new File([blob], `stellar_descent_${photoId}.png`, {
      type: 'image/png',
    });

    // Try Web Share API first
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Stellar Descent Photo',
        });
        return true;
      } catch (_error) {
        // User cancelled or error - fall through to download
        log.debug('Share cancelled or failed, falling back to download');
      }
    }

    // Fallback to download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellar_descent_${photoId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  // ============================================================================
  // PRIVATE METHODS - CAMERA
  // ============================================================================

  private createFreeCamera(): void {
    const startPosition = this.originalCamera?.position.clone() || Vector3.Zero();
    const startTarget = this.originalCamera
      ? startPosition.add(
          (this.originalCamera as FreeCamera).getDirection?.(Vector3.Forward()) || Vector3.Forward()
        )
      : Vector3.Forward();

    this.freeCamera = new FreeCamera('photoModeCamera', startPosition, this.scene);
    this.freeCamera.setTarget(startTarget);
    this.freeCamera.minZ = 0.1;
    this.freeCamera.maxZ = 2000;
    this.freeCamera.fov = (this.settings.fov * Math.PI) / 180;

    // Disable built-in inputs - we handle everything manually
    this.freeCamera.inputs.clear();

    // Set as active camera
    this.scene.activeCamera = this.freeCamera;
  }

  private setupControls(): void {
    // Keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keysPressed.add(e.code);

      // Escape to exit
      if (e.code === 'Escape') {
        this.exitPhotoMode();
      }

      // Space to capture
      if (e.code === 'Space') {
        e.preventDefault();
        this.capturePhoto();
      }

      // R to reset position
      if (e.code === 'KeyR') {
        if (this.freeCamera && this.originalCamera) {
          this.freeCamera.position = this.originalCamera.position.clone();
        }
      }

      // F to reset settings
      if (e.code === 'KeyF') {
        this.resetSettings();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.code);
    };

    // Mouse look
    const handleMouseMove = (e: MouseEvent) => {
      if (!this.freeCamera || !document.pointerLockElement) return;

      this.freeCamera.rotation.y += e.movementX * this.rotationSpeed;
      this.freeCamera.rotation.x -= e.movementY * this.rotationSpeed;

      // Clamp vertical rotation
      this.freeCamera.rotation.x = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, this.freeCamera.rotation.x)
      );
    };

    // Mouse wheel for speed
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.adjustSpeed(e.deltaY);
    };

    // Click to lock pointer
    const handleClick = () => {
      if (!document.pointerLockElement && this.scene.getEngine().getRenderingCanvas()) {
        this.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
      }
    };

    // Add listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('wheel', handleWheel, { passive: false });
    this.scene.getEngine().getRenderingCanvas()?.addEventListener('click', handleClick);

    // Store cleanup functions
    this.cleanupListeners = [
      () => window.removeEventListener('keydown', handleKeyDown),
      () => window.removeEventListener('keyup', handleKeyUp),
      () => document.removeEventListener('mousemove', handleMouseMove),
      () => document.removeEventListener('wheel', handleWheel),
      () => this.scene.getEngine().getRenderingCanvas()?.removeEventListener('click', handleClick),
    ];
  }

  private cleanupControls(): void {
    this.keysPressed.clear();
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];

    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // ============================================================================
  // PRIVATE METHODS - EFFECTS
  // ============================================================================

  private saveOriginalSettings(): void {
    // Store current post-processing state to restore later
    // This would integrate with PostProcessManager
    this.savedOriginalSettings = { ...this.settings };
  }

  private restoreOriginalSettings(): void {
    // Restore original post-processing state
    if (this.savedOriginalSettings) {
      // Integration with PostProcessManager would happen here
      this.savedOriginalSettings = null;
    }
  }

  private applySettings(): void {
    // Apply all current settings to the renderer
    // This integrates with BabylonJS image processing

    const imageProcessing = this.scene.imageProcessingConfiguration;
    if (!imageProcessing) return;

    // Exposure (maps to our exposure setting)
    imageProcessing.exposure = this.settings.exposure;

    // Contrast
    imageProcessing.contrast = this.settings.contrast;

    // Vignette
    imageProcessing.vignetteEnabled = this.settings.vignette > 0;
    if (imageProcessing.vignetteEnabled) {
      imageProcessing.vignetteWeight = this.settings.vignette;
      imageProcessing.vignetteStretch = 0.5;
      imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

      // Apply color based on filter
      if (this.settings.filter === 'vintage') {
        imageProcessing.vignetteColor = new Color4(0.3, 0.2, 0.1, 0);
      } else if (this.settings.filter === 'horror') {
        imageProcessing.vignetteColor = new Color4(0.1, 0, 0, 0);
      } else {
        imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
      }
    }

    // Tone mapping
    imageProcessing.toneMappingEnabled = true;
    imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

    // Apply FOV if camera exists
    if (this.freeCamera) {
      this.freeCamera.fov = (this.settings.fov * Math.PI) / 180;
    }
  }

  private applyDepthOfField(): void {
    // Depth of field would be applied via DefaultRenderingPipeline
    // This is a placeholder for integration
    log.debug(
      `DoF: distance=${this.settings.focusDistance}, intensity=${this.settings.depthOfField}`
    );
  }

  // ============================================================================
  // PRIVATE METHODS - SCREENSHOT
  // ============================================================================

  private async takeScreenshot(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.freeCamera) {
        resolve(null);
        return;
      }

      const canvas = this.scene.getEngine().getRenderingCanvas();
      if (!canvas) {
        resolve(null);
        return;
      }

      // Render one frame to ensure latest state
      this.scene.render();

      // Use BabylonJS screenshot tools
      ScreenshotTools.CreateScreenshot(
        this.scene.getEngine(),
        this.freeCamera,
        { width: canvas.width, height: canvas.height },
        (data) => {
          resolve(data);
        }
      );
    });
  }

  private async createThumbnail(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Create 200px wide thumbnail
        const scale = 200 / img.width;
        canvas.width = 200;
        canvas.height = img.height * scale;

        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  // ============================================================================
  // PRIVATE METHODS - STORAGE
  // ============================================================================

  private loadGallery(): void {
    try {
      const stored = localStorage.getItem(PHOTO_GALLERY_KEY);
      if (stored) {
        this.gallery = JSON.parse(stored);
        log.info(`Loaded ${this.gallery.length} photos from gallery`);
      }
    } catch (error) {
      log.warn('Failed to load photo gallery:', error);
      this.gallery = [];
    }
  }

  private saveGallery(): void {
    try {
      localStorage.setItem(PHOTO_GALLERY_KEY, JSON.stringify(this.gallery));
    } catch (error) {
      log.error('Failed to save photo gallery:', error);
    }
  }

  private loadSavedSettings(): void {
    try {
      const stored = localStorage.getItem(PHOTO_SETTINGS_KEY);
      if (stored) {
        const saved = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...saved };
      }
    } catch (error) {
      log.warn('Failed to load photo settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(PHOTO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      log.error('Failed to save photo settings:', error);
    }
  }

  private async savePhotoToStorage(photoId: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('StellarDescentPhotos', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readwrite');
        const store = transaction.objectStore('photos');

        const photoData = { id: photoId, blob };
        const storeRequest = store.put(photoData);

        storeRequest.onsuccess = () => resolve();
        storeRequest.onerror = () => reject(storeRequest.error);
      };
    });
  }

  private async loadPhotoFromStorage(photoId: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('StellarDescentPhotos', 1);

      request.onerror = () => resolve(null);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readonly');
        const store = transaction.objectStore('photos');
        const getRequest = store.get(photoId);

        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result?.blob || null);
        };
        getRequest.onerror = () => resolve(null);
      };
    });
  }

  private async deletePhotoFromStorage(photoId: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('StellarDescentPhotos', 1);

      request.onerror = () => resolve();

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('photos', 'readwrite');
        const store = transaction.objectStore('photos');
        store.delete(photoId);
        resolve();
      };
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    if (this.isActive) {
      this.exitPhotoMode();
    }

    this.cleanupControls();

    if (this.freeCamera) {
      this.freeCamera.dispose();
      this.freeCamera = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let photoModeInstance: PhotoMode | null = null;

/**
 * Initialize the photo mode system
 */
export function initPhotoMode(scene: Scene, callbacks?: PhotoModeCallbacks): PhotoMode {
  if (photoModeInstance) {
    photoModeInstance.dispose();
  }
  photoModeInstance = new PhotoMode(scene, callbacks);
  return photoModeInstance;
}

/**
 * Get the photo mode instance
 */
export function getPhotoMode(): PhotoMode | null {
  return photoModeInstance;
}

/**
 * Dispose the photo mode system
 */
export function disposePhotoMode(): void {
  if (photoModeInstance) {
    photoModeInstance.dispose();
    photoModeInstance = null;
  }
}
