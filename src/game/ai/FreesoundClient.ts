/**
 * FreesoundClient - Freesound.org API Client
 *
 * Integrates with Freesound.org API v2 for searching, downloading, and managing
 * royalty-free audio assets for Stellar Descent. Supports caching to IndexedDB,
 * audio processing via Web Audio API, and license attribution tracking.
 *
 * API Documentation: https://freesound.org/docs/api/
 */

import { getLogger } from '../core/Logger';
import type {
  AudioProcessingOptions,
  CachedAudioAsset,
  FreesoundClientOptions,
  FreesoundDownloadResult,
  FreesoundLicense,
  FreesoundSearchOptions,
  FreesoundSearchResult,
  FreesoundSound,
  FreesoundSoundPreview,
} from './types';

const log = getLogger('FreesoundClient');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Freesound API base URL */
const API_BASE_URL = 'https://freesound.org/apiv2';

/** IndexedDB database name for audio caching */
const AUDIO_CACHE_DB_NAME = 'stellar_descent_audio_cache';
const AUDIO_CACHE_DB_VERSION = 1;
const AUDIO_CACHE_STORE_NAME = 'audio_assets';
const AUDIO_CREDITS_STORE_NAME = 'audio_credits';

/** Default rate limit delay between API calls (ms) */
const DEFAULT_RATE_LIMIT_DELAY = 500;

/** Maximum number of results per page */
const MAX_PAGE_SIZE = 150;

/** Default fields to retrieve for sound info */
const DEFAULT_SOUND_FIELDS = [
  'id',
  'name',
  'description',
  'tags',
  'license',
  'duration',
  'channels',
  'samplerate',
  'bitdepth',
  'filesize',
  'download',
  'previews',
  'username',
  'url',
  'avg_rating',
  'num_downloads',
  'created',
  'type',
].join(',');

/** Default fields for search results (lighter than full info) */
const DEFAULT_SEARCH_FIELDS = [
  'id',
  'name',
  'tags',
  'license',
  'duration',
  'previews',
  'username',
  'url',
  'avg_rating',
  'num_downloads',
].join(',');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Delay utility for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Map Freesound license URL to our license type
 */
function parseLicense(licenseUrl: string): FreesoundLicense {
  if (licenseUrl.includes('publicdomain') || licenseUrl.includes('cc0')) {
    return 'cc0';
  }
  if (licenseUrl.includes('by-nc')) {
    return 'cc-by-nc';
  }
  if (licenseUrl.includes('by-sa')) {
    return 'cc-by-sa';
  }
  if (licenseUrl.includes('/by/')) {
    return 'cc-by';
  }
  return 'other';
}

/**
 * Build query string from object
 */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return entries.join('&');
}

// ============================================================================
// INDEXEDDB CACHE OPERATIONS
// ============================================================================

/**
 * Open the IndexedDB audio cache database
 */
function openAudioCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(AUDIO_CACHE_DB_NAME, AUDIO_CACHE_DB_VERSION);

    request.onerror = () => {
      log.error('Failed to open audio cache database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Audio assets store
      if (!db.objectStoreNames.contains(AUDIO_CACHE_STORE_NAME)) {
        const store = db.createObjectStore(AUDIO_CACHE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('freesoundId', 'freesoundId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        log.info('Created audio asset cache store');
      }

      // Credits store for attribution tracking
      if (!db.objectStoreNames.contains(AUDIO_CREDITS_STORE_NAME)) {
        db.createObjectStore(AUDIO_CREDITS_STORE_NAME, { keyPath: 'freesoundId' });
        log.info('Created audio credits store');
      }
    };
  });
}

/**
 * Get cached audio asset from IndexedDB
 */
async function getCachedAudio(assetId: string): Promise<CachedAudioAsset | null> {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(AUDIO_CACHE_STORE_NAME);
      const request = store.get(assetId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as CachedAudioAsset | null);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    log.warn('Failed to get cached audio:', error);
    return null;
  }
}

/**
 * Save audio asset to IndexedDB cache
 */
async function cacheAudio(asset: CachedAudioAsset): Promise<void> {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(AUDIO_CACHE_STORE_NAME);
      store.put(asset);

      transaction.oncomplete = () => {
        db.close();
        log.debug(`Cached audio asset: ${asset.id}`);
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.warn('Failed to cache audio asset:', error);
  }
}

/**
 * Save credit/attribution info
 */
async function saveCredit(credit: {
  freesoundId: number;
  name: string;
  author: string;
  license: FreesoundLicense;
  url: string;
}): Promise<void> {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_CREDITS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(AUDIO_CREDITS_STORE_NAME);
      store.put(credit);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.warn('Failed to save credit:', error);
  }
}

/**
 * Get all credits for attribution
 */
async function getAllCredits(): Promise<
  Array<{
    freesoundId: number;
    name: string;
    author: string;
    license: FreesoundLicense;
    url: string;
  }>
> {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_CREDITS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(AUDIO_CREDITS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    log.warn('Failed to get credits:', error);
    return [];
  }
}

/**
 * Clear all cached audio assets
 */
async function clearAudioCache(): Promise<void> {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(AUDIO_CACHE_STORE_NAME);
      store.clear();

      transaction.oncomplete = () => {
        db.close();
        log.info('Audio cache cleared');
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    log.error('Failed to clear audio cache:', error);
  }
}

// ============================================================================
// AUDIO PROCESSING (Web Audio API)
// ============================================================================

/**
 * Process audio buffer with various effects
 */
async function processAudioBuffer(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  options: AudioProcessingOptions
): Promise<AudioBuffer> {
  // Create offline context for rendering
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;

  // Calculate new duration after trim
  let startSample = 0;
  let endSample = buffer.length;

  if (options.trim) {
    startSample = Math.floor(options.trim.start * sampleRate);
    endSample = Math.floor(options.trim.end * sampleRate);
  }

  const trimmedLength = endSample - startSample;

  // Calculate fade samples
  const fadeInSamples = options.fadeIn ? Math.floor(options.fadeIn * sampleRate) : 0;
  const fadeOutSamples = options.fadeOut ? Math.floor(options.fadeOut * sampleRate) : 0;

  // Create output buffer
  const outputBuffer = audioContext.createBuffer(channels, trimmedLength, sampleRate);

  for (let channel = 0; channel < channels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < trimmedLength; i++) {
      let sample = inputData[startSample + i];

      // Apply fade in
      if (i < fadeInSamples) {
        sample *= i / fadeInSamples;
      }

      // Apply fade out
      if (i > trimmedLength - fadeOutSamples) {
        const fadeProgress = (trimmedLength - i) / fadeOutSamples;
        sample *= fadeProgress;
      }

      // Apply normalization (peak normalization)
      if (options.normalize) {
        // Normalization is applied after collecting all samples
        // We'll do a second pass
      }

      outputData[i] = sample;
    }
  }

  // Normalize if requested
  if (options.normalize) {
    // Find peak across all channels
    let peak = 0;
    for (let channel = 0; channel < channels; channel++) {
      const data = outputBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i]));
      }
    }

    // Normalize to 0.95 to avoid clipping
    if (peak > 0) {
      const gain = 0.95 / peak;
      for (let channel = 0; channel < channels; channel++) {
        const data = outputBuffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          data[i] *= gain;
        }
      }
    }
  }

  return outputBuffer;
}

/**
 * Apply pitch shift to audio buffer (simple resampling approach)
 */
function applyPitchShift(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  semitones: number
): AudioBuffer {
  // Calculate pitch ratio (2^(semitones/12))
  const pitchRatio = 2 ** (semitones / 12);

  // New buffer length
  const newLength = Math.floor(buffer.length / pitchRatio);
  const outputBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * pitchRatio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation
      outputData[i] =
        inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
    }
  }

  return outputBuffer;
}

/**
 * Apply simple reverb using convolution (impulse response simulation)
 */
async function applyReverb(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  reverbTime: number = 0.5
): Promise<AudioBuffer> {
  // Create a simple impulse response
  const sampleRate = buffer.sampleRate;
  const irLength = Math.floor(reverbTime * sampleRate);
  const irBuffer = audioContext.createBuffer(buffer.numberOfChannels, irLength, sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const irData = irBuffer.getChannelData(channel);
    for (let i = 0; i < irLength; i++) {
      // Exponential decay with some noise
      const decay = Math.exp(-3 * (i / irLength));
      irData[i] = (Math.random() * 2 - 1) * decay * 0.3;
    }
  }

  // Use offline audio context for convolution
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length + irLength,
    sampleRate
  );

  // Create nodes
  const sourceNode = offlineContext.createBufferSource();
  sourceNode.buffer = buffer;

  const convolverNode = offlineContext.createConvolver();
  convolverNode.buffer = irBuffer;

  const dryGain = offlineContext.createGain();
  dryGain.gain.value = 0.7;

  const wetGain = offlineContext.createGain();
  wetGain.gain.value = 0.3;

  // Connect dry path
  sourceNode.connect(dryGain);
  dryGain.connect(offlineContext.destination);

  // Connect wet path
  sourceNode.connect(convolverNode);
  convolverNode.connect(wetGain);
  wetGain.connect(offlineContext.destination);

  sourceNode.start();

  return offlineContext.startRendering();
}

/**
 * Convert AudioBuffer to ArrayBuffer (WAV format)
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data (interleaved)
  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      // Clamp and convert to 16-bit
      const s = Math.max(-1, Math.min(1, sample));
      const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

// ============================================================================
// FREESOUND CLIENT CLASS
// ============================================================================

/**
 * Main class for interacting with Freesound.org API
 */
export class FreesoundClient {
  private apiKey: string | null = null;
  private options: Required<FreesoundClientOptions>;
  private isInitialized = false;
  private lastRequestTime = 0;
  private audioContext: AudioContext | null = null;

  constructor(apiKey?: string, options: FreesoundClientOptions = {}) {
    this.apiKey = apiKey ?? null;
    this.options = {
      rateLimitDelayMs: options.rateLimitDelayMs ?? DEFAULT_RATE_LIMIT_DELAY,
      verbose: options.verbose ?? false,
      preferredFormat: options.preferredFormat ?? 'ogg',
      maxRetries: options.maxRetries ?? 3,
      cacheEnabled: options.cacheEnabled ?? true,
    };
  }

  /**
   * Initialize the client with API key
   */
  async initialize(apiKey?: string): Promise<boolean> {
    // Try to get API key from options, parameter, or environment
    this.apiKey = apiKey ?? this.apiKey ?? this.getApiKeyFromEnv();

    if (!this.apiKey) {
      log.warn('Freesound API key not configured. Audio asset download disabled.');
      log.info('Set VITE_FREESOUND_API_KEY environment variable to enable audio features.');
      return false;
    }

    // Initialize AudioContext for processing
    if (isBrowser()) {
      try {
        this.audioContext = new AudioContext();
      } catch (error) {
        log.warn('Failed to create AudioContext:', error);
      }
    }

    this.isInitialized = true;
    log.info('Freesound client initialized successfully');
    return true;
  }

  /**
   * Get API key from environment
   */
  private getApiKeyFromEnv(): string | null {
    // Vite environment variable
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FREESOUND_API_KEY) {
      return import.meta.env.VITE_FREESOUND_API_KEY;
    }
    // Node.js environment (for build scripts)
    if (typeof process !== 'undefined' && process.env?.FREESOUND_API_KEY) {
      return process.env.FREESOUND_API_KEY;
    }
    return null;
  }

  /**
   * Check if the client is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.apiKey !== null;
  }

  /**
   * Ensure rate limit is respected
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.options.rateLimitDelayMs) {
      await delay(this.options.rateLimitDelayMs - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Freesound API key not configured');
    }

    await this.enforceRateLimit();

    const queryString = buildQueryString({ ...params, token: this.apiKey });
    const url = `${API_BASE_URL}${endpoint}?${queryString}`;

    if (this.options.verbose) {
      log.debug(`API Request: ${endpoint}`);
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait and retry
            log.warn('Rate limited by Freesound API, waiting...');
            await delay(5000);
            continue;
          }
          throw new Error(`Freesound API error: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.options.maxRetries - 1) {
          log.warn(`API request failed, retrying (${attempt + 1}/${this.options.maxRetries})...`);
          await delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('API request failed');
  }

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  /**
   * Search for sounds on Freesound
   */
  async searchSounds(
    query: string,
    options: FreesoundSearchOptions = {}
  ): Promise<FreesoundSearchResult> {
    if (!this.isReady()) {
      throw new Error('Freesound client not initialized');
    }

    // Build filter string
    const filters: string[] = [];

    if (options.filter) {
      filters.push(options.filter);
    }

    if (options.minDuration !== undefined) {
      filters.push(`duration:[${options.minDuration} TO *]`);
    }

    if (options.maxDuration !== undefined) {
      filters.push(`duration:[* TO ${options.maxDuration}]`);
    }

    if (options.tags && options.tags.length > 0) {
      filters.push(`tag:(${options.tags.join(' OR ')})`);
    }

    if (options.license) {
      // Map our license type to Freesound license filter
      const licenseFilters: Record<string, string> = {
        cc0: 'license:"Creative Commons 0"',
        'cc-by': 'license:"Attribution"',
        'cc-by-nc': 'license:"Attribution Noncommercial"',
        'cc-by-sa': 'license:"Attribution Share Alike"',
      };
      if (licenseFilters[options.license]) {
        filters.push(licenseFilters[options.license]);
      }
    }

    const params: Record<string, string | number | undefined> = {
      query,
      page_size: Math.min(options.pageSize ?? 15, MAX_PAGE_SIZE),
      fields: options.fields?.join(',') ?? DEFAULT_SEARCH_FIELDS,
    };

    if (filters.length > 0) {
      params.filter = filters.join(' ');
    }

    if (options.sort) {
      const sortMap: Record<string, string> = {
        score: 'score',
        duration_desc: 'duration_desc',
        duration_asc: 'duration_asc',
        downloads_desc: 'downloads_desc',
        rating_desc: 'rating_desc',
        created_desc: 'created_desc',
      };
      params.sort = sortMap[options.sort] ?? 'score';
    }

    log.info(`Searching Freesound: "${query}"`);

    const response = await this.apiRequest<{
      count: number;
      next: string | null;
      previous: string | null;
      results: FreesoundSound[];
    }>('/search/text/', params);

    return {
      count: response.count,
      next: response.next,
      previous: response.previous,
      results: response.results.map((sound) => ({
        ...sound,
        license: parseLicense(sound.license),
      })),
    };
  }

  /**
   * Get detailed information about a specific sound
   */
  async getSoundInfo(id: number): Promise<FreesoundSound> {
    if (!this.isReady()) {
      throw new Error('Freesound client not initialized');
    }

    log.info(`Getting sound info: ${id}`);

    const response = await this.apiRequest<FreesoundSound>(`/sounds/${id}/`, {
      fields: DEFAULT_SOUND_FIELDS,
    });

    return {
      ...response,
      license: parseLicense(response.license as unknown as string),
    };
  }

  /**
   * Get sounds similar to a given sound
   */
  async getSimilarSounds(id: number, pageSize: number = 10): Promise<FreesoundSearchResult> {
    if (!this.isReady()) {
      throw new Error('Freesound client not initialized');
    }

    log.info(`Getting similar sounds to: ${id}`);

    const response = await this.apiRequest<{
      count: number;
      next: string | null;
      previous: string | null;
      results: FreesoundSound[];
    }>(`/sounds/${id}/similar/`, {
      page_size: pageSize,
      fields: DEFAULT_SEARCH_FIELDS,
    });

    return {
      count: response.count,
      next: response.next,
      previous: response.previous,
      results: response.results.map((sound) => ({
        ...sound,
        license: parseLicense(sound.license as unknown as string),
      })),
    };
  }

  // ==========================================================================
  // DOWNLOAD
  // ==========================================================================

  /**
   * Download a sound and optionally process it
   */
  async downloadSound(
    id: number,
    assetId: string,
    processing?: AudioProcessingOptions
  ): Promise<FreesoundDownloadResult> {
    if (!this.isReady()) {
      return {
        assetId,
        freesoundId: id,
        success: false,
        error: 'Freesound client not initialized',
      };
    }

    const startTime = performance.now();

    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = await getCachedAudio(assetId);
      if (cached) {
        log.info(`Using cached audio: ${assetId}`);
        return {
          assetId,
          freesoundId: id,
          success: true,
          audioData: cached.data,
          mimeType: cached.mimeType,
          duration: cached.duration,
          downloadTimeMs: 0,
        };
      }
    }

    try {
      // Get sound info first for metadata and download URL
      const soundInfo = await this.getSoundInfo(id);

      if (!soundInfo.download && !soundInfo.previews) {
        throw new Error('No download URL available for this sound');
      }

      // Determine download URL - prefer preview for faster downloads unless original is needed
      let downloadUrl: string;
      let mimeType: string;

      if (soundInfo.previews) {
        // Use preview based on preferred format
        const previews = soundInfo.previews as FreesoundSoundPreview;
        if (this.options.preferredFormat === 'ogg' && previews['preview-hq-ogg']) {
          downloadUrl = previews['preview-hq-ogg'];
          mimeType = 'audio/ogg';
        } else if (previews['preview-hq-mp3']) {
          downloadUrl = previews['preview-hq-mp3'];
          mimeType = 'audio/mpeg';
        } else if (previews['preview-lq-mp3']) {
          downloadUrl = previews['preview-lq-mp3'];
          mimeType = 'audio/mpeg';
        } else if (soundInfo.download) {
          downloadUrl = soundInfo.download;
          mimeType = this.getMimeTypeFromFilename(soundInfo.type ?? 'wav');
        } else {
          throw new Error('No suitable download URL found');
        }
      } else if (soundInfo.download) {
        downloadUrl = soundInfo.download;
        mimeType = this.getMimeTypeFromFilename(soundInfo.type ?? 'wav');
      } else {
        throw new Error('No download URL available');
      }

      // Add API key to download URL
      const authUrl = downloadUrl.includes('?')
        ? `${downloadUrl}&token=${this.apiKey}`
        : `${downloadUrl}?token=${this.apiKey}`;

      log.info(`Downloading sound: ${id} (${soundInfo.name})`);

      // Download the audio
      await this.enforceRateLimit();
      const response = await fetch(authUrl);

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      let audioData = await response.arrayBuffer();
      let duration = soundInfo.duration;

      // Process audio if requested and AudioContext is available
      if (processing && this.audioContext && isBrowser()) {
        try {
          log.debug(`Processing audio: ${assetId}`);

          // Decode the audio
          const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));

          let processedBuffer = audioBuffer;

          // Apply basic processing (trim, fade, normalize)
          if (processing.trim || processing.fadeIn || processing.fadeOut || processing.normalize) {
            processedBuffer = await processAudioBuffer(
              this.audioContext,
              processedBuffer,
              processing
            );
          }

          // Apply pitch shift
          if (processing.pitchShift && processing.pitchShift !== 0) {
            processedBuffer = applyPitchShift(
              this.audioContext,
              processedBuffer,
              processing.pitchShift
            );
          }

          // Apply reverb
          if (processing.reverb) {
            processedBuffer = await applyReverb(this.audioContext, processedBuffer, 0.5);
          }

          // Convert back to WAV
          audioData = audioBufferToWav(processedBuffer);
          mimeType = 'audio/wav';
          duration = processedBuffer.duration;
        } catch (procError) {
          log.warn(`Audio processing failed for ${assetId}, using original:`, procError);
        }
      }

      // Convert to base64 for caching
      const base64Data = this.arrayBufferToBase64(audioData);

      // Cache the result
      if (this.options.cacheEnabled) {
        await cacheAudio({
          id: assetId,
          freesoundId: id,
          type: 'audio',
          data: base64Data,
          mimeType,
          duration,
          manifestVersion: '1.0.0',
          cachedAt: Date.now(),
        });

        // Save credit info for attribution
        await saveCredit({
          freesoundId: id,
          name: soundInfo.name,
          author: soundInfo.username,
          license: soundInfo.license as FreesoundLicense,
          url: soundInfo.url,
        });
      }

      return {
        assetId,
        freesoundId: id,
        success: true,
        audioData: base64Data,
        mimeType,
        duration,
        downloadTimeMs: performance.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Download failed for ${assetId}:`, errorMessage);
      return {
        assetId,
        freesoundId: id,
        success: false,
        error: errorMessage,
        downloadTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Search and download the best matching sound for an asset definition
   */
  async searchAndDownload(
    assetId: string,
    query: string,
    searchOptions: FreesoundSearchOptions = {},
    processing?: AudioProcessingOptions
  ): Promise<FreesoundDownloadResult> {
    try {
      // Search for sounds
      const results = await this.searchSounds(query, {
        ...searchOptions,
        pageSize: 5, // Get top 5 results
      });

      if (results.results.length === 0) {
        return {
          assetId,
          freesoundId: 0,
          success: false,
          error: `No sounds found for query: "${query}"`,
        };
      }

      // Pick the best result (first one, as results are sorted by relevance)
      const bestMatch = results.results[0];

      log.info(`Best match for "${query}": ${bestMatch.name} (ID: ${bestMatch.id})`);

      // Download the sound
      return this.downloadSound(bestMatch.id, assetId, processing);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        assetId,
        freesoundId: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Check if an audio asset is cached
   */
  async isCached(assetId: string): Promise<boolean> {
    const cached = await getCachedAudio(assetId);
    return cached !== null;
  }

  /**
   * Get cached audio asset
   */
  async getCached(assetId: string): Promise<CachedAudioAsset | null> {
    return getCachedAudio(assetId);
  }

  /**
   * Clear all cached audio assets
   */
  async clearCache(): Promise<void> {
    await clearAudioCache();
  }

  /**
   * Get all attribution credits
   */
  async getCredits(): Promise<
    Array<{
      freesoundId: number;
      name: string;
      author: string;
      license: FreesoundLicense;
      url: string;
    }>
  > {
    return getAllCredits();
  }

  /**
   * Generate AUDIO_CREDITS.md content
   */
  async generateCreditsMarkdown(): Promise<string> {
    const credits = await this.getCredits();

    let markdown = '# Audio Credits\n\n';
    markdown +=
      'This game uses audio from [Freesound.org](https://freesound.org). ' +
      'All sounds are used under Creative Commons licenses.\n\n';
    markdown += '## Sound Effects\n\n';

    // Group by license
    const byLicense: Record<string, typeof credits> = {};
    for (const credit of credits) {
      const license = credit.license || 'unknown';
      if (!byLicense[license]) {
        byLicense[license] = [];
      }
      byLicense[license].push(credit);
    }

    const licenseNames: Record<string, string> = {
      cc0: 'Public Domain (CC0)',
      'cc-by': 'Attribution (CC BY)',
      'cc-by-nc': 'Attribution-NonCommercial (CC BY-NC)',
      'cc-by-sa': 'Attribution-ShareAlike (CC BY-SA)',
      other: 'Other Licenses',
    };

    for (const [license, sounds] of Object.entries(byLicense)) {
      markdown += `### ${licenseNames[license] || license}\n\n`;

      for (const sound of sounds) {
        markdown += `- **${sound.name}** by [${sound.author}](${sound.url})\n`;
      }

      markdown += '\n';
    }

    return markdown;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromFilename(type: string): string {
    const mimeTypes: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      aiff: 'audio/aiff',
      aif: 'audio/aiff',
    };
    return mimeTypes[type.toLowerCase()] ?? 'audio/wav';
  }

  /**
   * Dispose the client and clean up resources
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
    log.info('FreesoundClient disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global singleton instance */
let clientInstance: FreesoundClient | null = null;

/**
 * Get or create the global FreesoundClient instance
 */
export function getFreesoundClient(
  apiKey?: string,
  options?: FreesoundClientOptions
): FreesoundClient {
  if (!clientInstance) {
    clientInstance = new FreesoundClient(apiKey, options);
  }
  return clientInstance;
}

/**
 * Initialize the global client with API key from environment
 */
export async function initializeFreesoundClient(
  apiKey?: string,
  options?: FreesoundClientOptions
): Promise<boolean> {
  const client = getFreesoundClient(apiKey, options);
  return client.initialize(apiKey);
}

export default FreesoundClient;
