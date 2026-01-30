import { vi } from 'vitest';

// Mock AudioManager to avoid Tone.js issues in test environment
// Tone.js requires a real AudioContext which happy-dom doesn't provide
vi.mock('../game/core/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    initialize: vi.fn(),
    dispose: vi.fn(),
    playSound: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    setMusicVolume: vi.fn(),
    setSFXVolume: vi.fn(),
    setVoiceVolume: vi.fn(),
    setAmbientVolume: vi.fn(),
    setMasterVolume: vi.fn(),
    playWeaponFire: vi.fn(),
    playWeaponReload: vi.fn(),
    playReloadStart: vi.fn(),
    playReloadComplete: vi.fn(),
    playEmptyClick: vi.fn(),
    playWeaponSwitch: vi.fn(),
    playWeaponEquip: vi.fn(),
    playImpact: vi.fn(),
    playExplosion: vi.fn(),
    playHitMarker: vi.fn(),
    playHeadshot: vi.fn(),
    playKillConfirmation: vi.fn(),
    playDamageDealt: vi.fn(),
    playUIClick: vi.fn(),
    playUIHover: vi.fn(),
    setLevelConfig: vi.fn(),
    setCombatState: vi.fn(),
    onEnemyKill: vi.fn(),
    onPlayerDamage: vi.fn(),
    onLevelComplete: vi.fn(),
    play: vi.fn(),
    startLoop: vi.fn(),
    stopLoop: vi.fn(),
  })),
  disposeAudioManager: vi.fn(),
}));

// Mock WebGL context for Babylon.js tests
const mockWebGLContext = {
  getExtension: vi.fn(() => null),
  getParameter: vi.fn(() => 0),
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  createProgram: vi.fn(() => ({})),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  drawArrays: vi.fn(),
  drawElements: vi.fn(),
  viewport: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  blendFunc: vi.fn(),
  depthFunc: vi.fn(),
  cullFace: vi.fn(),
  getShaderInfoLog: vi.fn(() => ''),
  getProgramInfoLog: vi.fn(() => ''),
  getUniformLocation: vi.fn(() => ({})),
  getAttribLocation: vi.fn(() => 0),
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  uniform2f: vi.fn(),
  uniform3f: vi.fn(),
  uniform4f: vi.fn(),
  uniformMatrix4fv: vi.fn(),
  createTexture: vi.fn(() => ({})),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  generateMipmap: vi.fn(),
  activeTexture: vi.fn(),
  createFramebuffer: vi.fn(() => ({})),
  bindFramebuffer: vi.fn(),
  framebufferTexture2D: vi.fn(),
  checkFramebufferStatus: vi.fn(() => 36053), // GL_FRAMEBUFFER_COMPLETE
  deleteShader: vi.fn(),
  deleteProgram: vi.fn(),
  deleteBuffer: vi.fn(),
  deleteTexture: vi.fn(),
  deleteFramebuffer: vi.fn(),
  pixelStorei: vi.fn(),
  getContextAttributes: vi.fn(() => ({ alpha: true, antialias: true })),
};

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    return mockWebGLContext as unknown as WebGLRenderingContext;
  }
  return null;
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16) as unknown as number;
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock pointer lock
Object.defineProperty(document, 'pointerLockElement', {
  value: null,
  writable: true,
});

HTMLElement.prototype.requestPointerLock = vi.fn();
