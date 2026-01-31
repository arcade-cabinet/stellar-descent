/**
 * SpawnConfigZod - Zod-based spawn configuration schemas
 *
 * Provides runtime-validated, declarative spawn wave definitions using Zod schemas.
 * This offers type inference from schemas and runtime validation for external configs.
 *
 * Design goals:
 *   - Replace hardcoded spawn logic with pure data
 *   - Runtime validation for configs loaded from JSON/external sources
 *   - Type safety through Zod inference
 *   - Support multiple trigger strategies (immediate, objective, timer, proximity, manual)
 */

import { z } from 'zod';

// ============================================================================
// SPECIES ENUM
// ============================================================================

/**
 * All supported alien species for spawning.
 * Maps to species definitions in aliens.ts and IceChitin.ts.
 */
export const AlienSpeciesEnum = z.enum([
  // Standard Chitin species
  'drone',
  'soldier',
  'warrior',
  'spitter',
  // Ice variants (Southern Ice level)
  'ice_drone',
  'ice_warrior',
  // Legacy/alternate names
  'skitterer',
  'lurker',
  'spewer',
  'husk',
  'heavy',
  'stalker',
  'broodmother',
  'queen',
]);

export type AlienSpecies = z.infer<typeof AlienSpeciesEnum>;

// ============================================================================
// SPAWN UNIT SCHEMA
// ============================================================================

/**
 * A single spawn unit within a wave.
 * Defines the species, count, spawn location, and timing.
 */
export const SpawnUnitSchema = z.object({
  /** Alien species identifier */
  species: AlienSpeciesEnum,
  /** Number of this species to spawn */
  count: z.number().int().positive(),
  /** Named spawn point ID - must match a key in spawnPoints */
  spawnPoint: z.string(),
  /** Delay in seconds after wave start before this unit begins spawning */
  delay: z.number().nonnegative().default(0),
  /** Radius around spawn point for position randomization */
  spread: z.number().nonnegative().default(5),
  /** Optional stat overrides for this specific unit group */
  overrides: z
    .object({
      healthMultiplier: z.number().positive().optional(),
      damageMultiplier: z.number().positive().optional(),
      speedMultiplier: z.number().positive().optional(),
      scale: z.number().positive().optional(),
    })
    .optional(),
});

export type SpawnUnit = z.infer<typeof SpawnUnitSchema>;

// ============================================================================
// TRIGGER TYPE SCHEMA
// ============================================================================

/**
 * Wave trigger types:
 * - immediate: starts as soon as level begins
 * - objective: starts when a specific objective is completed
 * - timer: starts after a delay from level start
 * - proximity: starts when player enters a radius
 * - manual: only starts via explicit API call
 */
export const TriggerTypeEnum = z.enum([
  'immediate',
  'objective',
  'timer',
  'proximity',
  'manual',
]);

export type TriggerType = z.infer<typeof TriggerTypeEnum>;

// ============================================================================
// SPAWN WAVE SCHEMA
// ============================================================================

/**
 * A complete wave definition.
 * Includes trigger conditions, units to spawn, and progression.
 */
export const SpawnWaveSchema = z.object({
  /** Unique wave identifier */
  id: z.string(),
  /** Human-readable label for HUD display */
  label: z.string().optional(),
  /** How this wave is triggered */
  trigger: TriggerTypeEnum,
  /**
   * Value for the trigger:
   * - objective: objective ID string
   * - timer: seconds as string (e.g., "30")
   * - proximity: distance as string (e.g., "25")
   * - immediate/manual: not used
   */
  triggerValue: z.string().optional(),
  /**
   * Position for proximity trigger (x,y,z as string "x,y,z")
   */
  triggerPosition: z.string().optional(),
  /** Units to spawn in this wave */
  units: z.array(SpawnUnitSchema),
  /** Next wave ID to trigger on completion, or 'victory' for level end */
  onComplete: z.string().optional(),
  /** Seconds between individual spawns within the wave */
  spawnInterval: z.number().positive().default(1.0),
  /** Maximum concurrent enemies from this wave */
  maxConcurrent: z.number().positive().optional(),
});

export type SpawnWave = z.infer<typeof SpawnWaveSchema>;

// ============================================================================
// SPAWN POINT SCHEMA
// ============================================================================

/**
 * Position tuple for spawn points.
 */
export const PositionTupleSchema = z.tuple([
  z.number(), // x
  z.number(), // y
  z.number(), // z
]);

export type PositionTuple = z.infer<typeof PositionTupleSchema>;

/**
 * Spawn point configuration.
 */
export const SpawnPointSchema = z.object({
  /** World-space position as [x, y, z] tuple */
  position: PositionTupleSchema,
  /** Y-axis rotation in degrees for spawned entities */
  rotation: z.number().default(0),
  /** Optional species restrictions for this point */
  allowedSpecies: z.array(AlienSpeciesEnum).optional(),
});

export type SpawnPoint = z.infer<typeof SpawnPointSchema>;

// ============================================================================
// LEVEL SPAWN CONFIG SCHEMA
// ============================================================================

/**
 * Complete spawn configuration for a level.
 * Contains all spawn points and wave definitions.
 */
export const LevelSpawnConfigSchema = z.object({
  /** Level identifier - must match level ID in campaign */
  levelId: z.string(),
  /** Named spawn points available in this level */
  spawnPoints: z.record(z.string(), SpawnPointSchema),
  /** Ordered list of waves */
  waves: z.array(SpawnWaveSchema),
  /** Global max concurrent enemies (default: 40) */
  maxGlobalEnemies: z.number().positive().default(40),
  /** Default spawn interval when wave doesn't specify (default: 1.0) */
  defaultSpawnInterval: z.number().positive().default(1.0),
});

export type LevelSpawnConfig = z.infer<typeof LevelSpawnConfigSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a spawn configuration and returns typed result.
 * Throws ZodError if validation fails.
 *
 * @param config - Raw config object to validate
 * @returns Validated and typed LevelSpawnConfig
 */
export function validateSpawnConfig(config: unknown): LevelSpawnConfig {
  return LevelSpawnConfigSchema.parse(config);
}

/**
 * Safely validates a spawn configuration.
 * Returns result object instead of throwing.
 *
 * @param config - Raw config object to validate
 * @returns Safe parse result with success boolean and data/error
 */
export function safeValidateSpawnConfig(config: unknown) {
  return LevelSpawnConfigSchema.safeParse(config);
}

/**
 * Validates that all spawn points referenced in waves exist in the config.
 *
 * @param config - Validated spawn config
 * @returns Array of validation error messages, empty if valid
 */
export function validateSpawnPointReferences(config: LevelSpawnConfig): string[] {
  const errors: string[] = [];
  const spawnPointIds = new Set(Object.keys(config.spawnPoints));

  for (const wave of config.waves) {
    for (const unit of wave.units) {
      if (!spawnPointIds.has(unit.spawnPoint)) {
        errors.push(
          `Wave "${wave.id}" references unknown spawn point "${unit.spawnPoint}"`
        );
      }
    }
  }

  return errors;
}

/**
 * Validates wave chain references (onComplete targets).
 *
 * @param config - Validated spawn config
 * @returns Array of validation error messages, empty if valid
 */
export function validateWaveChain(config: LevelSpawnConfig): string[] {
  const errors: string[] = [];
  const waveIds = new Set(config.waves.map((w) => w.id));

  for (const wave of config.waves) {
    if (wave.onComplete && wave.onComplete !== 'victory') {
      if (!waveIds.has(wave.onComplete)) {
        errors.push(
          `Wave "${wave.id}" references unknown onComplete target "${wave.onComplete}"`
        );
      }
    }
  }

  return errors;
}

/**
 * Performs full validation of a spawn config including reference checks.
 *
 * @param config - Raw config object to validate
 * @returns Object with isValid boolean and any error messages
 */
export function validateSpawnConfigFull(config: unknown): {
  isValid: boolean;
  config: LevelSpawnConfig | null;
  errors: string[];
} {
  const parseResult = safeValidateSpawnConfig(config);

  if (!parseResult.success) {
    return {
      isValid: false,
      config: null,
      errors: parseResult.error.issues.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      ),
    };
  }

  const validConfig = parseResult.data;
  const refErrors = [
    ...validateSpawnPointReferences(validConfig),
    ...validateWaveChain(validConfig),
  ];

  return {
    isValid: refErrors.length === 0,
    config: validConfig,
    errors: refErrors,
  };
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Converts degrees to radians for rotation values.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Parses a position string "x,y,z" into a tuple.
 */
export function parsePositionString(posStr: string): [number, number, number] | null {
  const parts = posStr.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  return parts as [number, number, number];
}

/**
 * Parses trigger value based on trigger type.
 */
export function parseTriggerValue(
  trigger: TriggerType,
  value?: string,
  position?: string
): {
  delay?: number;
  objectiveFlag?: string;
  proximityCenter?: { x: number; y: number; z: number };
  proximityRadius?: number;
} {
  switch (trigger) {
    case 'timer':
      return { delay: value ? parseFloat(value) : 0 };
    case 'objective':
      return { objectiveFlag: value };
    case 'proximity': {
      const pos = position ? parsePositionString(position) : null;
      return {
        proximityCenter: pos ? { x: pos[0], y: pos[1], z: pos[2] } : undefined,
        proximityRadius: value ? parseFloat(value) : 30,
      };
    }
    default:
      return {};
  }
}
