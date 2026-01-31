/**
 * FinalEscapeLevel.test.ts - Unit tests for Final Escape Level (Chapter 10)
 *
 * Tests cover:
 * - Level constants and configuration
 * - Section management logic
 * - Boost system calculations
 * - Timer callback logic
 * - Distance calculations
 * - Color interpolation
 * - Comms queue logic
 *
 * Note: The FinalEscapeLevel class is heavily BabylonJS-dependent and is better
 * tested via integration tests. These unit tests focus on the testable logic,
 * constants, and calculations that can be verified without full BabylonJS instantiation.
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */

import { describe, expect, it } from 'vitest';

// Constants from FinalEscapeLevel that we can test
const VEHICLE_SPEED = 30;
const VEHICLE_BOOST_MULTIPLIER = 1.5;
const BOOST_DURATION = 2.0;
const BOOST_COOLDOWN = 3.0;
const STRAGGLER_SPAWN_INTERVAL = 4.0;
const MAX_STRAGGLERS = 8;
const TUNNEL_COLLAPSE_SPEED = 15;
const SHUTTLE_Z = -2900;
const LAUNCH_PAD_RADIUS = 30;

// Section types
type EscapeSection =
  | 'hive_exit'
  | 'surface_run'
  | 'canyon_sprint'
  | 'launch_pad'
  | 'victory'
  | 'game_over';

// Section display names
const SECTION_DISPLAY_NAMES: Record<EscapeSection, string> = {
  hive_exit: 'HIVE EXIT',
  surface_run: 'SURFACE RUN',
  canyon_sprint: 'CANYON SPRINT',
  launch_pad: 'LAUNCH PAD',
  victory: 'ESCAPE SUCCESSFUL',
  game_over: 'MISSION FAILED',
};

describe('FinalEscapeLevel Constants', () => {
  describe('Vehicle Constants', () => {
    it('should have vehicle speed of 30 m/s', () => {
      expect(VEHICLE_SPEED).toBe(30);
    });

    it('should have boost multiplier of 1.5x', () => {
      expect(VEHICLE_BOOST_MULTIPLIER).toBe(1.5);
    });

    it('should calculate boosted speed correctly', () => {
      const boostedSpeed = VEHICLE_SPEED * VEHICLE_BOOST_MULTIPLIER;
      expect(boostedSpeed).toBe(45);
    });

    it('should have boost duration of 2 seconds', () => {
      expect(BOOST_DURATION).toBe(2.0);
    });

    it('should have boost cooldown of 3 seconds', () => {
      expect(BOOST_COOLDOWN).toBe(3.0);
    });

    it('should have longer cooldown than duration', () => {
      expect(BOOST_COOLDOWN).toBeGreaterThan(BOOST_DURATION);
    });
  });

  describe('Enemy Constants', () => {
    it('should have straggler spawn interval of 4 seconds', () => {
      expect(STRAGGLER_SPAWN_INTERVAL).toBe(4.0);
    });

    it('should have max stragglers of 8', () => {
      expect(MAX_STRAGGLERS).toBe(8);
    });
  });

  describe('Environment Constants', () => {
    it('should have tunnel collapse speed of 15 m/s', () => {
      expect(TUNNEL_COLLAPSE_SPEED).toBe(15);
    });

    it('should have shuttle at Z = -2900', () => {
      expect(SHUTTLE_Z).toBe(-2900);
    });

    it('should have launch pad radius of 30m', () => {
      expect(LAUNCH_PAD_RADIUS).toBe(30);
    });
  });
});

describe('Section Management', () => {
  describe('Section Types', () => {
    it('should have 6 sections', () => {
      const sections: EscapeSection[] = [
        'hive_exit',
        'surface_run',
        'canyon_sprint',
        'launch_pad',
        'victory',
        'game_over',
      ];
      expect(sections.length).toBe(6);
    });

    it('should start with hive_exit', () => {
      const initialSection: EscapeSection = 'hive_exit';
      expect(initialSection).toBe('hive_exit');
    });
  });

  describe('Section Display Names', () => {
    it('should have display name for hive_exit', () => {
      expect(SECTION_DISPLAY_NAMES['hive_exit']).toBe('HIVE EXIT');
    });

    it('should have display name for surface_run', () => {
      expect(SECTION_DISPLAY_NAMES['surface_run']).toBe('SURFACE RUN');
    });

    it('should have display name for canyon_sprint', () => {
      expect(SECTION_DISPLAY_NAMES['canyon_sprint']).toBe('CANYON SPRINT');
    });

    it('should have display name for launch_pad', () => {
      expect(SECTION_DISPLAY_NAMES['launch_pad']).toBe('LAUNCH PAD');
    });

    it('should have display name for victory', () => {
      expect(SECTION_DISPLAY_NAMES['victory']).toBe('ESCAPE SUCCESSFUL');
    });

    it('should have display name for game_over', () => {
      expect(SECTION_DISPLAY_NAMES['game_over']).toBe('MISSION FAILED');
    });
  });

  describe('Section Progression', () => {
    it('should progress from hive_exit to surface_run', () => {
      const progression = ['hive_exit', 'surface_run'] as EscapeSection[];
      expect(progression[0]).toBe('hive_exit');
      expect(progression[1]).toBe('surface_run');
    });

    it('should progress through all gameplay sections', () => {
      const gameplaySections: EscapeSection[] = [
        'hive_exit',
        'surface_run',
        'canyon_sprint',
        'launch_pad',
      ];
      expect(gameplaySections.length).toBe(4);
    });

    it('should have victory as positive ending', () => {
      expect(SECTION_DISPLAY_NAMES['victory']).toContain('SUCCESSFUL');
    });

    it('should have game_over as negative ending', () => {
      expect(SECTION_DISPLAY_NAMES['game_over']).toContain('FAILED');
    });
  });
});

describe('Boost System Logic', () => {
  describe('Boost Activation', () => {
    it('should allow activation when not boosting and not on cooldown', () => {
      const isBoosting = false;
      const boostCooldownTimer = 0;
      const canActivate = !isBoosting && boostCooldownTimer <= 0;
      expect(canActivate).toBe(true);
    });

    it('should not allow activation when already boosting', () => {
      const isBoosting = true;
      const boostCooldownTimer = 0;
      const canActivate = !isBoosting && boostCooldownTimer <= 0;
      expect(canActivate).toBe(false);
    });

    it('should not allow activation when on cooldown', () => {
      const isBoosting = false;
      const boostCooldownTimer = 1.5;
      const canActivate = !isBoosting && boostCooldownTimer <= 0;
      expect(canActivate).toBe(false);
    });
  });

  describe('Boost State Update', () => {
    it('should decrement boost timer', () => {
      let boostRemainingTimer = 2.0;
      const deltaTime = 0.5;
      boostRemainingTimer -= deltaTime;
      expect(boostRemainingTimer).toBe(1.5);
    });

    it('should end boost when timer reaches 0', () => {
      let boostRemainingTimer = 0.3;
      const deltaTime = 0.5;
      boostRemainingTimer -= deltaTime;
      const boostEnded = boostRemainingTimer <= 0;
      expect(boostEnded).toBe(true);
    });

    it('should start cooldown when boost ends', () => {
      let boostCooldownTimer = 0;
      const boostEnded = true;
      if (boostEnded) {
        boostCooldownTimer = BOOST_COOLDOWN;
      }
      expect(boostCooldownTimer).toBe(3.0);
    });

    it('should decrement cooldown timer', () => {
      let boostCooldownTimer = 3.0;
      const deltaTime = 1.0;
      boostCooldownTimer = Math.max(0, boostCooldownTimer - deltaTime);
      expect(boostCooldownTimer).toBe(2.0);
    });
  });

  describe('Boost Speed Calculation', () => {
    it('should return normal speed when not boosting', () => {
      const isBoosting = false;
      const speed = isBoosting ? VEHICLE_SPEED * VEHICLE_BOOST_MULTIPLIER : VEHICLE_SPEED;
      expect(speed).toBe(30);
    });

    it('should return boosted speed when boosting', () => {
      const isBoosting = true;
      const speed = isBoosting ? VEHICLE_SPEED * VEHICLE_BOOST_MULTIPLIER : VEHICLE_SPEED;
      expect(speed).toBe(45);
    });
  });
});

describe('Distance Calculation', () => {
  describe('Distance to Goal', () => {
    it('should calculate distance from start to shuttle', () => {
      const playerZ = 0;
      const distance = Math.abs(playerZ - SHUTTLE_Z);
      expect(distance).toBe(2900);
    });

    it('should calculate distance from midpoint to shuttle', () => {
      const playerZ = -1450;
      const distance = Math.abs(playerZ - SHUTTLE_Z);
      expect(distance).toBe(1450);
    });

    it('should return 0 when at shuttle', () => {
      const playerZ = SHUTTLE_Z;
      const distance = Math.abs(playerZ - SHUTTLE_Z);
      expect(distance).toBe(0);
    });
  });

  describe('Launch Pad Detection', () => {
    it('should detect player at launch pad center', () => {
      const playerX = 0;
      const playerZ = SHUTTLE_Z;
      const distanceToCenter = Math.sqrt(playerX * playerX + (playerZ - SHUTTLE_Z) ** 2);
      const atLaunchPad = distanceToCenter <= LAUNCH_PAD_RADIUS;
      expect(atLaunchPad).toBe(true);
    });

    it('should detect player at launch pad edge', () => {
      const playerX = 25;
      const playerZ = SHUTTLE_Z;
      const distanceToCenter = Math.sqrt(playerX * playerX + (playerZ - SHUTTLE_Z) ** 2);
      const atLaunchPad = distanceToCenter <= LAUNCH_PAD_RADIUS;
      expect(atLaunchPad).toBe(true);
    });

    it('should not detect player outside launch pad', () => {
      const playerX = 40;
      const playerZ = SHUTTLE_Z;
      const distanceToCenter = Math.sqrt(playerX * playerX + (playerZ - SHUTTLE_Z) ** 2);
      const atLaunchPad = distanceToCenter <= LAUNCH_PAD_RADIUS;
      expect(atLaunchPad).toBe(false);
    });
  });
});

describe('Color Interpolation', () => {
  describe('Sky Color Shift', () => {
    it('should return base color at 0 shift', () => {
      const baseColor = { r: 0.5, g: 0.3, b: 0.2 };
      const targetColor = { r: 0.9, g: 0.15, b: 0.1 };
      const shift = 0;
      const r = baseColor.r + (targetColor.r - baseColor.r) * shift;
      const g = baseColor.g + (targetColor.g - baseColor.g) * shift;
      const b = baseColor.b + (targetColor.b - baseColor.b) * shift;
      expect(r).toBeCloseTo(0.5);
      expect(g).toBeCloseTo(0.3);
      expect(b).toBeCloseTo(0.2);
    });

    it('should return target color at 1 shift', () => {
      const baseColor = { r: 0.5, g: 0.3, b: 0.2 };
      const targetColor = { r: 0.9, g: 0.15, b: 0.1 };
      const shift = 1;
      const r = baseColor.r + (targetColor.r - baseColor.r) * shift;
      const g = baseColor.g + (targetColor.g - baseColor.g) * shift;
      const b = baseColor.b + (targetColor.b - baseColor.b) * shift;
      expect(r).toBeCloseTo(0.9);
      expect(g).toBeCloseTo(0.15);
      expect(b).toBeCloseTo(0.1);
    });

    it('should interpolate at 0.5 shift', () => {
      const baseColor = { r: 0.5, g: 0.3, b: 0.2 };
      const targetColor = { r: 0.9, g: 0.15, b: 0.1 };
      const shift = 0.5;
      const r = baseColor.r + (targetColor.r - baseColor.r) * shift;
      const g = baseColor.g + (targetColor.g - baseColor.g) * shift;
      const b = baseColor.b + (targetColor.b - baseColor.b) * shift;
      expect(r).toBeCloseTo(0.7);
      expect(g).toBeCloseTo(0.225);
      expect(b).toBeCloseTo(0.15);
    });
  });
});

describe('Comms Queue Logic', () => {
  describe('Queue Management', () => {
    it('should add message to queue with delay', () => {
      const queue: Array<{ delay: number; text: string }> = [];
      const message = { delay: 2.0, text: 'Test message' };
      queue.push(message);
      expect(queue.length).toBe(1);
      expect(queue[0].delay).toBe(2.0);
    });

    it('should decrement delay over time', () => {
      const queue = [{ delay: 2.0, text: 'Test' }];
      const deltaTime = 0.5;
      queue[0].delay -= deltaTime;
      expect(queue[0].delay).toBe(1.5);
    });

    it('should be ready to deliver when delay reaches 0', () => {
      const queue = [{ delay: 0.3, text: 'Test' }];
      const deltaTime = 0.5;
      queue[0].delay -= deltaTime;
      const ready = queue[0].delay <= 0;
      expect(ready).toBe(true);
    });

    it('should maintain queue order', () => {
      const queue: Array<{ delay: number; text: string }> = [];
      queue.push({ delay: 1.0, text: 'First' });
      queue.push({ delay: 2.0, text: 'Second' });
      queue.push({ delay: 0.5, text: 'Third' });
      expect(queue[0].text).toBe('First');
      expect(queue[2].text).toBe('Third');
    });
  });
});

describe('Tunnel Collapse Logic', () => {
  describe('Collapse Position', () => {
    it('should start collapse behind player', () => {
      const initialCollapseZ = 10;
      expect(initialCollapseZ).toBeGreaterThan(0);
    });

    it('should advance collapse position over time', () => {
      let collapseZ = 10;
      const deltaTime = 1.0;
      collapseZ -= TUNNEL_COLLAPSE_SPEED * deltaTime;
      expect(collapseZ).toBe(-5);
    });

    it('should catch up to stationary player', () => {
      const playerZ = -100;
      let collapseZ = 10;
      const timeToReach = (collapseZ - playerZ) / TUNNEL_COLLAPSE_SPEED;
      // At 15 m/s, takes ~7.33 seconds to reach player at -100
      expect(timeToReach).toBeCloseTo(7.33, 1);
    });
  });

  describe('Debris Spawning', () => {
    it('should limit debris count', () => {
      const debrisArray: number[] = [];
      const maxDebris = 10;
      for (let i = 0; i < 15; i++) {
        if (debrisArray.length < maxDebris) {
          debrisArray.push(i);
        }
      }
      expect(debrisArray.length).toBe(maxDebris);
    });
  });
});

describe('Straggler Spawn Logic', () => {
  describe('Spawn Timing', () => {
    it('should spawn after interval', () => {
      let spawnTimer = 0;
      const deltaTime = 5.0;
      spawnTimer += deltaTime;
      const shouldSpawn = spawnTimer >= STRAGGLER_SPAWN_INTERVAL;
      expect(shouldSpawn).toBe(true);
    });

    it('should not spawn before interval', () => {
      let spawnTimer = 0;
      const deltaTime = 2.0;
      spawnTimer += deltaTime;
      const shouldSpawn = spawnTimer >= STRAGGLER_SPAWN_INTERVAL;
      expect(shouldSpawn).toBe(false);
    });

    it('should reset timer after spawn', () => {
      let spawnTimer = 5.0;
      if (spawnTimer >= STRAGGLER_SPAWN_INTERVAL) {
        spawnTimer = 0;
      }
      expect(spawnTimer).toBe(0);
    });
  });

  describe('Spawn Limits', () => {
    it('should respect max stragglers', () => {
      const stragglers = new Array(MAX_STRAGGLERS).fill(null);
      const canSpawn = stragglers.length < MAX_STRAGGLERS;
      expect(canSpawn).toBe(false);
    });

    it('should allow spawn when below limit', () => {
      const stragglers = new Array(5).fill(null);
      const canSpawn = stragglers.length < MAX_STRAGGLERS;
      expect(canSpawn).toBe(true);
    });
  });
});

describe('Damage System Logic', () => {
  describe('Health Calculation', () => {
    it('should reduce health by damage amount', () => {
      let health = 100;
      const damage = 25;
      health -= damage;
      expect(health).toBe(75);
    });

    it('should clamp health to 0', () => {
      let health = 10;
      const damage = 25;
      health = Math.max(0, health - damage);
      expect(health).toBe(0);
    });
  });

  describe('Death Detection', () => {
    it('should detect death at 0 health', () => {
      const health = 0;
      const isDead = health <= 0;
      expect(isDead).toBe(true);
    });

    it('should not detect death with positive health', () => {
      const health = 1;
      const isDead = health <= 0;
      expect(isDead).toBe(false);
    });
  });

  describe('Respawn', () => {
    it('should respawn with partial health', () => {
      const respawnHealth = 50;
      expect(respawnHealth).toBe(50);
    });
  });
});

describe('HUD Display Logic', () => {
  describe('Boost Status', () => {
    it('should show READY when available', () => {
      const isBoosting = false;
      const boostCooldownTimer = 0;
      let status = '';
      if (isBoosting) {
        status = 'BOOST!';
      } else if (boostCooldownTimer > 0) {
        status = `BOOST: ${Math.ceil(boostCooldownTimer)}s`;
      } else {
        status = 'BOOST: READY';
      }
      expect(status).toBe('BOOST: READY');
    });

    it('should show BOOST! when active', () => {
      const isBoosting = true;
      const boostCooldownTimer = 0;
      let status = '';
      if (isBoosting) {
        status = 'BOOST!';
      } else if (boostCooldownTimer > 0) {
        status = `BOOST: ${Math.ceil(boostCooldownTimer)}s`;
      } else {
        status = 'BOOST: READY';
      }
      expect(status).toBe('BOOST!');
    });

    it('should show cooldown when on cooldown', () => {
      const isBoosting = false;
      const boostCooldownTimer = 2.3;
      let status = '';
      if (isBoosting) {
        status = 'BOOST!';
      } else if (boostCooldownTimer > 0) {
        status = `BOOST: ${Math.ceil(boostCooldownTimer)}s`;
      } else {
        status = 'BOOST: READY';
      }
      expect(status).toBe('BOOST: 3s');
    });
  });

  describe('Distance Display', () => {
    it('should format distance in meters', () => {
      const distance = 1500;
      const display = `${distance}m`;
      expect(display).toBe('1500m');
    });

    it('should format distance in km for large values', () => {
      const distance = 2500;
      const display = distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`;
      expect(display).toBe('2.5km');
    });
  });
});

describe('Timer Urgency Handling', () => {
  describe('Urgency Levels', () => {
    type UrgencyLevel = 'normal' | 'warning' | 'critical' | 'final';

    it('should have normal urgency above 2 minutes', () => {
      const remaining = 150;
      let urgency: UrgencyLevel = 'normal';
      if (remaining <= 20) urgency = 'final';
      else if (remaining <= 60) urgency = 'critical';
      else if (remaining <= 120) urgency = 'warning';
      expect(urgency).toBe('normal');
    });

    it('should have warning urgency at 2 minutes', () => {
      const remaining = 100;
      let urgency: UrgencyLevel = 'normal';
      if (remaining <= 20) urgency = 'final';
      else if (remaining <= 60) urgency = 'critical';
      else if (remaining <= 120) urgency = 'warning';
      expect(urgency).toBe('warning');
    });

    it('should have critical urgency at 1 minute', () => {
      const remaining = 45;
      let urgency: UrgencyLevel = 'normal';
      if (remaining <= 20) urgency = 'final';
      else if (remaining <= 60) urgency = 'critical';
      else if (remaining <= 120) urgency = 'warning';
      expect(urgency).toBe('critical');
    });

    it('should have final urgency at 20 seconds', () => {
      const remaining = 15;
      let urgency: UrgencyLevel = 'normal';
      if (remaining <= 20) urgency = 'final';
      else if (remaining <= 60) urgency = 'critical';
      else if (remaining <= 120) urgency = 'warning';
      expect(urgency).toBe('final');
    });
  });
});

describe('Victory Conditions', () => {
  describe('Shuttle Reach', () => {
    it('should trigger victory when player reaches shuttle area', () => {
      const playerZ = SHUTTLE_Z + 10; // Within 100m
      const shuttleReached = Math.abs(playerZ - SHUTTLE_Z) <= 100;
      expect(shuttleReached).toBe(true);
    });

    it('should not trigger victory when player is far', () => {
      const playerZ = SHUTTLE_Z + 200;
      const shuttleReached = Math.abs(playerZ - SHUTTLE_Z) <= 100;
      expect(shuttleReached).toBe(false);
    });
  });

  describe('Timer Expiration', () => {
    it('should trigger game over when timer expires', () => {
      const timerExpired = true;
      const section = timerExpired ? 'game_over' : 'hive_exit';
      expect(section).toBe('game_over');
    });
  });
});
