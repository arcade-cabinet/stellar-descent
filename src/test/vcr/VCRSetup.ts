/**
 * VCR Test Setup - HTTP Recording/Replay for GenAI Tests
 *
 * Uses Polly.JS for recording real API responses and MSW for mocking.
 * Recordings are stored in __recordings__/ for deterministic tests.
 */

import { Polly, type PollyConfig } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';
import * as path from 'path';

// Register adapters and persisters
Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

// ============================================================================
// CONFIGURATION
// ============================================================================

const RECORDINGS_DIR = path.join(__dirname, '__recordings__');

/**
 * Default Polly configuration for GenAI API recording
 */
export const DEFAULT_POLLY_CONFIG: PollyConfig = {
  adapters: ['node-http'],
  persister: 'fs',
  persisterOptions: {
    fs: {
      recordingsDir: RECORDINGS_DIR,
    },
  },
  recordIfMissing: true,
  matchRequestsBy: {
    method: true,
    headers: false, // Ignore headers (API keys change)
    body: true,
    order: false,
    url: {
      protocol: true,
      username: false,
      password: false,
      hostname: true,
      port: true,
      pathname: true,
      query: false, // Ignore query params (API keys)
      hash: false,
    },
  },
  // Sanitize API keys from recordings
  recordFailedRequests: true,
};

// ============================================================================
// VCR CONTEXT
// ============================================================================

export interface VCRContext {
  polly: Polly;
  mode: 'record' | 'replay' | 'passthrough';
}

/**
 * Create a VCR context for a test suite
 */
export function createVCRContext(
  name: string,
  options: Partial<PollyConfig> = {}
): VCRContext {
  const mode = process.env.VCR_MODE as 'record' | 'replay' | 'passthrough' || 'replay';

  const config: PollyConfig = {
    ...DEFAULT_POLLY_CONFIG,
    ...options,
    mode: mode === 'passthrough' ? 'passthrough' : mode,
  };

  const polly = new Polly(name, config);

  // Add request/response hooks for sanitization
  polly.server.any().on('beforePersist', (req, recording) => {
    // Sanitize API keys from request URLs
    if (recording.request?.url) {
      recording.request.url = recording.request.url.replace(
        /key=[^&]+/g,
        'key=REDACTED'
      );
    }

    // Sanitize API keys from request headers
    if (recording.request?.headers) {
      delete recording.request.headers['x-goog-api-key'];
      delete recording.request.headers['authorization'];
    }
  });

  return { polly, mode };
}

/**
 * Start VCR recording/replay
 */
export async function startVCR(context: VCRContext): Promise<void> {
  // Polly starts automatically on creation
}

/**
 * Stop VCR and persist recordings
 */
export async function stopVCR(context: VCRContext): Promise<void> {
  await context.polly.stop();
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Wrap a test function with VCR recording
 */
export function withVCR<T>(
  name: string,
  testFn: (context: VCRContext) => Promise<T>
): () => Promise<T> {
  return async () => {
    const context = createVCRContext(name);
    try {
      await startVCR(context);
      return await testFn(context);
    } finally {
      await stopVCR(context);
    }
  };
}

/**
 * Check if running in record mode
 */
export function isRecordMode(): boolean {
  return process.env.VCR_MODE === 'record';
}

/**
 * Check if running in replay mode
 */
export function isReplayMode(): boolean {
  return process.env.VCR_MODE !== 'record' && process.env.VCR_MODE !== 'passthrough';
}
