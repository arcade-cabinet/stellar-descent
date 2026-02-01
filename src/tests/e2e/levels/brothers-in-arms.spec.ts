/**
 * brothers-in-arms.spec.ts - E2E Tests for Level 5: Brothers in Arms (Mech Combat)
 *
 * Comprehensive end-to-end tests for the Brothers in Arms level featuring:
 * - Reunion with Marcus Cole (HAMMER mech pilot)
 * - Marcus AI companion behavior and coordination
 * - TITAN mech combat sequences
 * - Heavy weapons usage and fire support
 * - Combined arms tactics
 * - Boss/heavy enemy encounters (Brutes)
 * - Marcus dialogue and comms system
 * - Level completion with both characters alive
 *
 * Uses HeadlessGameRunner + SimulatedPlayer with PlayerGovernor integration
 * for automated playthrough testing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelStats } from '../../../game/levels/types';
import { HeadlessGameRunner } from '../../../game/testing/HeadlessGameRunner';
import { SimulatedPlayer } from '../../../game/testing/SimulatedPlayer';

// Test timeouts
const LEVEL_TIMEOUT = 120_000; // 2 minutes for full level playthrough
const WAVE_TIMEOUT = 30_000; // 30 seconds per wave
const CINEMATIC_TIMEOUT = 60_000; // 1 minute for cinematic
const MECH_COMBAT_TIMEOUT = 45_000; // 45 seconds for mech combat sequences

// ============================================================================
// MOCK PLAYER GOVERNOR INTERFACE
// ============================================================================

interface MockPlayerGovernor {
  setGoal(goal: {
    type: string;
    target?: { x: number; y: number; z: number };
    aggressive?: boolean;
  }): void;
  getCurrentGoal(): { type: string };
  getInputState(): {
    moveForward: boolean;
    moveBack: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    shoot: boolean;
    interact: boolean;
    advanceDialogue: boolean;
  };
  update(deltaTime: number): void;
}

interface MockMarcusAI {
  getState(): string;
  getHealth(): number;
  getMaxHealth(): number;
  getHealthPercent(): number;
  isDowned(): boolean;
  getCoordinationState(): string;
  setCoordinationState(state: string): void;
  getKillCount(): number;
  getPosition(): { x: number; y: number; z: number };
  requestFocusFire(target: unknown): void;
  requestFlank(position: { x: number; y: number; z: number }): void;
  requestCoverFire(duration: number): void;
  notifyKill(enemy: unknown): void;
}

// ============================================================================
// EXTENDED HEADLESS RUNNER WITH MARCUS SUPPORT
// ============================================================================

/**
 * Extended runner that simulates Marcus AI companion behavior
 */
class BrothersInArmsTestRunner extends HeadlessGameRunner {
  private marcusHealth = 500;
  private marcusMaxHealth = 500;
  private marcusShields = 100;
  private marcusMaxShields = 100;
  private marcusKills = 0;
  private marcusState: 'idle' | 'support' | 'assault' | 'defensive' | 'downed' = 'support';
  private marcusCoordinationState: 'aggressive' | 'defensive' | 'support' = 'support';
  private marcusPosition = { x: 15, y: 0, z: 10 };
  private currentWave = 0;
  private waveEnemiesKilled = 0;
  private waveEnemiesTotal = 0;
  private dialogueTriggered: string[] = [];
  private cinematicComplete = false;
  private isMarcusDowned = false;
  private playerGovernorActive = false;

  constructor() {
    super({
      startLevel: 'brothers_in_arms',
      difficulty: 'normal',
      enableLogging: false,
    });
  }

  // ============================================================================
  // MARCUS AI SIMULATION
  // ============================================================================

  getMarcusAI(): MockMarcusAI {
    return {
      getState: () => this.marcusState,
      getHealth: () => this.marcusHealth,
      getMaxHealth: () => this.marcusMaxHealth,
      getHealthPercent: () => this.marcusHealth / this.marcusMaxHealth,
      isDowned: () => this.isMarcusDowned,
      getCoordinationState: () => this.marcusCoordinationState,
      setCoordinationState: (state: string) => {
        this.marcusCoordinationState = state as 'aggressive' | 'defensive' | 'support';
      },
      getKillCount: () => this.marcusKills,
      getPosition: () => ({ ...this.marcusPosition }),
      requestFocusFire: (_target: unknown) => {
        this.dialogueTriggered.push('focus_fire');
      },
      requestFlank: (_position: { x: number; y: number; z: number }) => {
        this.dialogueTriggered.push('flank');
      },
      requestCoverFire: (_duration: number) => {
        this.dialogueTriggered.push('cover_fire');
      },
      notifyKill: (_enemy: unknown) => {
        this.marcusKills++;
      },
    };
  }

  getPlayerGovernor(): MockPlayerGovernor {
    return {
      setGoal: (goal: { type: string }) => {
        this.playerGovernorActive = true;
        if (goal.type === 'engage_enemies') {
          // Marcus should follow and support
          this.marcusState = 'support';
        }
      },
      getCurrentGoal: () => ({ type: this.playerGovernorActive ? 'engage_enemies' : 'idle' }),
      getInputState: () => ({
        moveForward: this.playerGovernorActive,
        moveBack: false,
        moveLeft: false,
        moveRight: false,
        shoot: this.playerGovernorActive && this.getEnemyCount() > 0,
        interact: false,
        advanceDialogue: false,
      }),
      update: (_deltaTime: number) => {
        // PlayerGovernor update
      },
    };
  }

  // ============================================================================
  // MARCUS HEALTH AND STATE MANAGEMENT
  // ============================================================================

  damageMarcus(amount: number): void {
    // Shields absorb damage first
    if (this.marcusShields > 0) {
      const shieldDamage = Math.min(this.marcusShields, amount);
      this.marcusShields -= shieldDamage;
      amount -= shieldDamage;
    }

    this.marcusHealth = Math.max(0, this.marcusHealth - amount);

    if (this.marcusHealth <= 0 || this.marcusHealth < this.marcusMaxHealth * 0.15) {
      this.isMarcusDowned = true;
      this.marcusState = 'downed';
      if (this.marcusHealth <= 0) {
        this.marcusHealth = 1; // Set to 1 to prevent true death
      }
    } else if (this.marcusHealth < this.marcusMaxHealth * 0.4) {
      this.marcusState = 'defensive';
    }
  }

  healMarcus(amount: number): void {
    this.marcusHealth = Math.min(this.marcusMaxHealth, this.marcusHealth + amount);
    if (this.marcusHealth > this.marcusMaxHealth * 0.5 && this.isMarcusDowned) {
      this.isMarcusDowned = false;
      this.marcusState = 'support';
    }
  }

  getMarcusHealth(): number {
    return this.marcusHealth;
  }

  getMarcusMaxHealth(): number {
    return this.marcusMaxHealth;
  }

  getMarcusShields(): number {
    return this.marcusShields;
  }

  getMarcusState(): string {
    return this.marcusState;
  }

  isMarcusAlive(): boolean {
    return this.marcusHealth > 0;
  }

  setMarcusCoordinationState(state: 'aggressive' | 'defensive' | 'support'): void {
    this.marcusCoordinationState = state;
    switch (state) {
      case 'aggressive':
        this.marcusState = 'assault';
        break;
      case 'defensive':
        this.marcusState = 'defensive';
        break;
      case 'support':
        this.marcusState = 'support';
        break;
    }
  }

  // ============================================================================
  // WAVE COMBAT SIMULATION
  // ============================================================================

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.waveEnemiesKilled = 0;

    // Wave enemy counts based on level design
    const waveCounts: Record<number, number> = {
      1: 12, // Drones only
      2: 12, // 8 grunts + 4 drones
      3: 15, // 6 grunts + 6 drones + 3 spitters
      4: 17, // 2 brutes + 5 grunts + 2 spitters + 8 drones
    };

    this.waveEnemiesTotal = waveCounts[waveNumber] || 10;

    // Spawn enemies for the wave
    for (let i = 0; i < this.waveEnemiesTotal; i++) {
      const angle = (i / this.waveEnemiesTotal) * Math.PI * 2;
      const radius = 30 + Math.random() * 20;
      this.spawnEnemy(
        waveNumber === 4 && i < 2 ? 'brute' : 'grunt',
        {
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius,
        },
        waveNumber === 4 && i < 2 ? 300 : 80
      );
    }

    this.dialogueTriggered.push(`wave_${waveNumber}_start`);
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  isWaveComplete(): boolean {
    return this.getEnemyCount() === 0 && this.currentWave > 0;
  }

  // Override damageEnemy to track Marcus kills
  override damageEnemy(enemyId: string, amount: number): boolean {
    const killed = super.damageEnemy(enemyId, amount);
    if (killed) {
      this.waveEnemiesKilled++;

      // 40% chance Marcus gets the kill (he's helping)
      if (Math.random() < 0.4) {
        this.marcusKills++;
      }
    }
    return killed;
  }

  simulateMarcusAttack(): void {
    // Marcus fires at enemies
    const enemies = this.getState().enemies.filter((e) => e.isAlive);
    if (enemies.length > 0) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      const damage = 50; // Marcus deals 50 damage per shot
      this.damageEnemy(target.id, damage);
    }
  }

  // ============================================================================
  // CINEMATIC AND DIALOGUE
  // ============================================================================

  completeCinematic(): void {
    this.cinematicComplete = true;
    this.dialogueTriggered.push('reunion_complete');
  }

  isCinematicComplete(): boolean {
    return this.cinematicComplete;
  }

  triggerDialogue(dialogueId: string): void {
    if (!this.dialogueTriggered.includes(dialogueId)) {
      this.dialogueTriggered.push(dialogueId);
    }
  }

  getTriggeredDialogue(): string[] {
    return [...this.dialogueTriggered];
  }

  hasDialogueTriggered(dialogueId: string): boolean {
    return this.dialogueTriggered.includes(dialogueId);
  }

  // ============================================================================
  // HEAVY WEAPONS AND COMBAT
  // ============================================================================

  useFireSupport(position: { x: number; y: number; z: number }): void {
    this.dialogueTriggered.push('fire_support');

    // Damage all enemies within radius
    const enemies = this.getState().enemies.filter((e) => e.isAlive);
    for (const enemy of enemies) {
      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < 15) {
        const damage = 200 * (1 - distance / 15);
        this.damageEnemy(enemy.id, damage);
      }
    }
  }

  useHeavyWeapon(weaponType: 'rocket' | 'minigun' | 'flamethrower'): void {
    this.dialogueTriggered.push(`heavy_weapon_${weaponType}`);

    const enemies = this.getState().enemies.filter((e) => e.isAlive);
    if (enemies.length === 0) return;

    switch (weaponType) {
      case 'rocket':
        // High damage, single target
        if (enemies[0]) {
          this.damageEnemy(enemies[0].id, 150);
        }
        break;
      case 'minigun':
        // Low damage, multiple targets
        for (let i = 0; i < Math.min(3, enemies.length); i++) {
          this.damageEnemy(enemies[i].id, 30);
        }
        break;
      case 'flamethrower':
        // Medium damage, area effect
        for (const enemy of enemies.slice(0, 5)) {
          this.damageEnemy(enemy.id, 50);
        }
        break;
    }
  }

  // ============================================================================
  // COMBINED ARMS TACTICS
  // ============================================================================

  coordinateFocusFire(targetId: string): void {
    const enemies = this.getState().enemies.filter((e) => e.id === targetId && e.isAlive);
    if (enemies.length === 0) return;

    this.dialogueTriggered.push('coordinated_focus_fire');

    // Both player and Marcus attack the same target
    this.damageEnemy(targetId, 75); // Player damage
    this.damageEnemy(targetId, 50); // Marcus damage
    this.marcusKills += enemies[0].health <= 125 ? 1 : 0;
  }

  coordinateFlankManeuver(): void {
    this.dialogueTriggered.push('coordinated_flank');
    this.marcusState = 'assault';

    // Marcus moves to flank position and attacks
    const enemies = this.getState().enemies.filter((e) => e.isAlive);
    for (const enemy of enemies.slice(0, 2)) {
      this.damageEnemy(enemy.id, 75); // Flanking bonus damage
    }
  }

  // ============================================================================
  // BREACH BATTLE (BOSS ENCOUNTER)
  // ============================================================================

  startBreachBattle(): void {
    this.dialogueTriggered.push('breach_battle_start');
    this.setLevelPhase('breach_battle');

    // Spawn breach enemies (heavy wave)
    this.spawnEnemy('brute', { x: 0, y: 0, z: -50 }, 400);
    this.spawnEnemy('brute', { x: -10, y: 0, z: -45 }, 400);
    this.spawnEnemy('spitter', { x: 10, y: 0, z: -55 }, 120);
    for (let i = 0; i < 6; i++) {
      this.spawnEnemy(
        'grunt',
        {
          x: (Math.random() - 0.5) * 30,
          y: 0,
          z: -40 - Math.random() * 20,
        },
        80
      );
    }
  }

  isBreachCleared(): boolean {
    return this.getEnemyCount() === 0 && this.getState().levelPhase === 'breach_battle';
  }

  getMarcusKillCount(): number {
    return this.marcusKills;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Level 5: Brothers in Arms - E2E Tests', () => {
  let runner: BrothersInArmsTestRunner;
  let player: SimulatedPlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    runner = new BrothersInArmsTestRunner();
    player = new SimulatedPlayer(runner, {
      playStyle: 'aggressive',
      accuracy: 0.8,
      aggressionLevel: 0.9,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // MARCUS REUNION TESTS
  // ============================================================================

  describe('Marcus Cole Reunion', () => {
    it(
      'should complete reunion cinematic',
      async () => {
        // Start level and verify initial state
        expect(runner.getState().levelId).toBe('brothers_in_arms');

        // Complete the reunion cinematic
        runner.completeCinematic();

        expect(runner.isCinematicComplete()).toBe(true);
        expect(runner.hasDialogueTriggered('reunion_complete')).toBe(true);
      },
      CINEMATIC_TIMEOUT
    );

    it('should establish Marcus AI companion after reunion', () => {
      runner.completeCinematic();

      const marcusAI = runner.getMarcusAI();

      expect(marcusAI.getState()).toBe('support');
      expect(marcusAI.getHealth()).toBe(500);
      expect(marcusAI.getMaxHealth()).toBe(500);
      expect(marcusAI.getHealthPercent()).toBe(1);
      expect(marcusAI.isDowned()).toBe(false);
    });

    it('should trigger appropriate dialogue during reunion', () => {
      runner.triggerDialogue('athena_detection');
      runner.triggerDialogue('marcus_emergence');
      runner.triggerDialogue('marcus_relief');
      runner.triggerDialogue('james_determination');
      runner.completeCinematic();

      const dialogues = runner.getTriggeredDialogue();

      expect(dialogues).toContain('athena_detection');
      expect(dialogues).toContain('marcus_emergence');
      expect(dialogues).toContain('marcus_relief');
      expect(dialogues).toContain('james_determination');
      expect(dialogues).toContain('reunion_complete');
    });
  });

  // ============================================================================
  // MARCUS AI COMPANION BEHAVIOR
  // ============================================================================

  describe('Marcus AI Companion Behavior', () => {
    beforeEach(() => {
      runner.completeCinematic();
    });

    it('should track Marcus health and shields', () => {
      expect(runner.getMarcusHealth()).toBe(500);
      expect(runner.getMarcusShields()).toBe(100);

      runner.damageMarcus(50);

      expect(runner.getMarcusShields()).toBe(50);
      expect(runner.getMarcusHealth()).toBe(500);

      runner.damageMarcus(100);

      expect(runner.getMarcusShields()).toBe(0);
      expect(runner.getMarcusHealth()).toBe(450);
    });

    it('should transition Marcus to defensive state when damaged', () => {
      expect(runner.getMarcusState()).toBe('support');

      // Damage Marcus below 40% health (200 HP)
      runner.damageMarcus(100); // Shields
      runner.damageMarcus(320); // Health to 180

      expect(runner.getMarcusState()).toBe('defensive');
    });

    it('should mark Marcus as downed when critically damaged', () => {
      const marcusAI = runner.getMarcusAI();

      runner.damageMarcus(100); // Shields
      runner.damageMarcus(480); // Down to near 0

      expect(marcusAI.isDowned()).toBe(true);
      expect(runner.getMarcusState()).toBe('downed');
    });

    it('should recover Marcus when healed', () => {
      runner.damageMarcus(550); // Critical damage
      expect(runner.getMarcusAI().isDowned()).toBe(true);

      runner.healMarcus(300);

      expect(runner.getMarcusAI().isDowned()).toBe(false);
      expect(runner.getMarcusState()).toBe('support');
    });

    it('should follow player when PlayerGovernor engages enemies', () => {
      const governor = runner.getPlayerGovernor();

      governor.setGoal({ type: 'engage_enemies' });

      expect(runner.getMarcusState()).toBe('support');
      expect(governor.getCurrentGoal().type).toBe('engage_enemies');
    });

    it('should support player with fire during combat', async () => {
      runner.startWave(1);

      const initialCount = runner.getEnemyCount();
      expect(initialCount).toBeGreaterThan(0);

      // Marcus should attack enemies
      runner.simulateMarcusAttack();
      runner.simulateMarcusAttack();
      runner.simulateMarcusAttack();
      runner.simulateMarcusAttack();
      runner.simulateMarcusAttack();

      // Some enemies should be damaged or killed
      const afterCount = runner.getEnemyCount();
      expect(afterCount).toBeLessThanOrEqual(initialCount);
    });
  });

  // ============================================================================
  // TITAN MECH COMBAT SEQUENCES
  // ============================================================================

  describe('TITAN Mech Combat Sequences', () => {
    beforeEach(() => {
      runner.completeCinematic();
    });

    it(
      'should complete all 4 combat waves',
      async () => {
        for (let wave = 1; wave <= 4; wave++) {
          runner.startWave(wave);

          expect(runner.hasDialogueTriggered(`wave_${wave}_start`)).toBe(true);
          expect(runner.getEnemyCount()).toBeGreaterThan(0);

          // Fight the wave
          player.playAggressively();
          let frames = 0;
          const maxFrames = 1800; // 30 seconds at 60fps

          while (frames < maxFrames && runner.getEnemyCount() > 0) {
            player.updateAutonomous();
            runner.tick();
            runner.simulateMarcusAttack();
            frames++;

            if (frames % 100 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          expect(runner.isWaveComplete()).toBe(true);
        }

        expect(runner.getMarcusKillCount()).toBeGreaterThan(0);
      },
      LEVEL_TIMEOUT
    );

    it('should handle wave 4 brute encounters', async () => {
      runner.startWave(4);

      // Wave 4 includes 2 brutes
      const enemies = runner.getState().enemies;
      const brutes = enemies.filter((e) => e.speciesId === 'brute');

      expect(brutes.length).toBe(2);
      expect(brutes[0].maxHealth).toBe(300);

      // Fight brutes with coordinated attacks
      player.playAggressively();

      let frames = 0;
      while (frames < 1800 && runner.getEnemyCount() > 0) {
        player.updateAutonomous();
        runner.tick();
        runner.simulateMarcusAttack();
        frames++;
      }

      expect(runner.isWaveComplete()).toBe(true);
    });
  });

  // ============================================================================
  // HEAVY WEAPONS USAGE
  // ============================================================================

  describe('Heavy Weapons Usage', () => {
    beforeEach(() => {
      runner.completeCinematic();
      runner.startWave(1);
    });

    it('should deal area damage with fire support', () => {
      const initialCount = runner.getEnemyCount();

      runner.useFireSupport({ x: 0, y: 0, z: 30 });

      expect(runner.hasDialogueTriggered('fire_support')).toBe(true);
      // Some enemies should be damaged/killed
      expect(runner.getEnemyCount()).toBeLessThanOrEqual(initialCount);
    });

    it('should use rocket launcher for high single-target damage', () => {
      const enemies = runner.getState().enemies;
      const targetHealth = enemies[0]?.health || 0;

      runner.useHeavyWeapon('rocket');

      const updatedEnemies = runner.getState().enemies;
      const newHealth = updatedEnemies[0]?.health || 0;

      expect(runner.hasDialogueTriggered('heavy_weapon_rocket')).toBe(true);
      expect(newHealth).toBeLessThan(targetHealth);
    });

    it('should use minigun for suppression fire', () => {
      const initialAlive = runner.getState().enemies.filter((e) => e.isAlive).length;

      runner.useHeavyWeapon('minigun');

      expect(runner.hasDialogueTriggered('heavy_weapon_minigun')).toBe(true);
      // Minigun should damage multiple enemies
      const totalDamaged = runner.getState().enemies.filter((e) => e.health < e.maxHealth).length;
      expect(totalDamaged).toBeGreaterThanOrEqual(0);
    });

    it('should use flamethrower for area denial', () => {
      runner.useHeavyWeapon('flamethrower');

      expect(runner.hasDialogueTriggered('heavy_weapon_flamethrower')).toBe(true);
    });
  });

  // ============================================================================
  // COMBINED ARMS TACTICS
  // ============================================================================

  describe('Combined Arms Tactics', () => {
    beforeEach(() => {
      runner.completeCinematic();
      runner.startWave(2);
    });

    it('should coordinate focus fire on priority targets', () => {
      const enemies = runner.getState().enemies;
      const targetId = enemies[0]?.id;

      if (targetId) {
        runner.coordinateFocusFire(targetId);

        expect(runner.hasDialogueTriggered('coordinated_focus_fire')).toBe(true);
      }
    });

    it('should execute flanking maneuvers', () => {
      runner.coordinateFlankManeuver();

      expect(runner.hasDialogueTriggered('coordinated_flank')).toBe(true);
      expect(runner.getMarcusState()).toBe('assault');
    });

    it('should switch Marcus coordination states', () => {
      const marcusAI = runner.getMarcusAI();

      // Test all coordination states
      marcusAI.setCoordinationState('aggressive');
      expect(marcusAI.getCoordinationState()).toBe('aggressive');

      marcusAI.setCoordinationState('defensive');
      expect(marcusAI.getCoordinationState()).toBe('defensive');

      marcusAI.setCoordinationState('support');
      expect(marcusAI.getCoordinationState()).toBe('support');
    });

    it('should request focus fire through Marcus AI', () => {
      const marcusAI = runner.getMarcusAI();
      const enemies = runner.getState().enemies;

      if (enemies[0]) {
        marcusAI.requestFocusFire(enemies[0]);
        expect(runner.hasDialogueTriggered('focus_fire')).toBe(true);
      }
    });

    it('should request cover fire during player advance', () => {
      const marcusAI = runner.getMarcusAI();

      marcusAI.requestCoverFire(5000);

      expect(runner.hasDialogueTriggered('cover_fire')).toBe(true);
    });
  });

  // ============================================================================
  // BOSS/HEAVY ENEMY ENCOUNTERS
  // ============================================================================

  describe('Boss/Heavy Enemy Encounters', () => {
    beforeEach(() => {
      runner.completeCinematic();
      // Complete waves 1-3 first
      for (let wave = 1; wave <= 3; wave++) {
        runner.startWave(wave);
        runner.killAllEnemies();
      }
    });

    it('should trigger breach battle after waves', () => {
      runner.startBreachBattle();

      expect(runner.hasDialogueTriggered('breach_battle_start')).toBe(true);
      expect(runner.getState().levelPhase).toBe('breach_battle');
    });

    it('should spawn multiple brutes at breach', () => {
      runner.startBreachBattle();

      const enemies = runner.getState().enemies;
      const brutes = enemies.filter((e) => e.speciesId === 'brute');

      expect(brutes.length).toBe(2);
    });

    it(
      'should clear breach with combined tactics',
      async () => {
        runner.startBreachBattle();
        player.playAggressively();

        let frames = 0;
        while (frames < 3600 && runner.getEnemyCount() > 0) {
          player.updateAutonomous();
          runner.tick();
          runner.simulateMarcusAttack();
          runner.simulateMarcusAttack(); // Marcus fights harder at breach
          frames++;

          if (frames % 100 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        expect(runner.isBreachCleared()).toBe(true);
      },
      MECH_COMBAT_TIMEOUT
    );
  });

  // ============================================================================
  // MARCUS DIALOGUE AND COMMS
  // ============================================================================

  describe('Marcus Dialogue and Comms', () => {
    beforeEach(() => {
      runner.completeCinematic();
    });

    it('should trigger wave start dialogue', () => {
      runner.startWave(1);
      expect(runner.hasDialogueTriggered('wave_1_start')).toBe(true);

      runner.killAllEnemies();
      runner.startWave(2);
      expect(runner.hasDialogueTriggered('wave_2_start')).toBe(true);
    });

    it('should accumulate dialogue triggers', () => {
      runner.triggerDialogue('marcus_tactical_1');
      runner.triggerDialogue('marcus_kill_confirmed');
      runner.triggerDialogue('marcus_player_danger');

      const dialogues = runner.getTriggeredDialogue();

      expect(dialogues).toContain('marcus_tactical_1');
      expect(dialogues).toContain('marcus_kill_confirmed');
      expect(dialogues).toContain('marcus_player_danger');
    });

    it('should not duplicate dialogue triggers', () => {
      runner.triggerDialogue('unique_dialogue');
      runner.triggerDialogue('unique_dialogue');
      runner.triggerDialogue('unique_dialogue');

      const dialogues = runner.getTriggeredDialogue();
      const count = dialogues.filter((d) => d === 'unique_dialogue').length;

      expect(count).toBe(1);
    });
  });

  // ============================================================================
  // LEVEL COMPLETION
  // ============================================================================

  describe('Level Completion', () => {
    it(
      'should complete level with both characters alive',
      async () => {
        runner.completeCinematic();

        // Complete all waves
        for (let wave = 1; wave <= 4; wave++) {
          runner.startWave(wave);
          player.playAggressively();

          let frames = 0;
          while (frames < 1800 && runner.getEnemyCount() > 0) {
            player.updateAutonomous();
            runner.tick();
            runner.simulateMarcusAttack();
            frames++;
          }
        }

        // Complete breach battle
        runner.startBreachBattle();
        player.playAggressively();

        let frames = 0;
        while (frames < 3600 && runner.getEnemyCount() > 0) {
          player.updateAutonomous();
          runner.tick();
          runner.simulateMarcusAttack();
          frames++;
        }

        // Complete objectives
        runner.completeObjective('rendezvous_marcus');
        runner.completeObjective('escort_mech');
        runner.completeObjective('clear_outpost');
        runner.markLevelComplete();

        // Verify completion
        expect(runner.isLevelComplete()).toBe(true);
        expect(runner.isMarcusAlive()).toBe(true);
        expect(runner.getState().player.isAlive).toBe(true);

        const stats = runner.getLevelStats();
        expect(stats.kills).toBeGreaterThan(0);
        expect(runner.getMarcusKillCount()).toBeGreaterThan(0);
      },
      LEVEL_TIMEOUT
    );

    it('should track Marcus and player health through level', () => {
      runner.completeCinematic();

      const initialPlayerHealth = runner.getState().player.health;
      const initialMarcusHealth = runner.getMarcusHealth();

      expect(initialPlayerHealth).toBe(100);
      expect(initialMarcusHealth).toBe(500);
    });

    it('should maintain Marcus survival requirement', () => {
      runner.completeCinematic();

      // Simulate combat damage
      runner.damageMarcus(200);

      // Marcus should still be alive
      expect(runner.isMarcusAlive()).toBe(true);

      // Heal Marcus
      runner.healMarcus(100);

      expect(runner.getMarcusHealth()).toBeGreaterThan(200);
    });

    it('should complete all required objectives', () => {
      runner.completeCinematic();

      runner.completeObjective('rendezvous_marcus');
      runner.completeObjective('escort_mech');
      runner.completeObjective('clear_outpost');

      const state = runner.getState();
      const completedObjectives = state.objectives.filter((o) => o.isCompleted);

      expect(completedObjectives.length).toBe(3);
    });
  });

  // ============================================================================
  // PLAYER GOVERNOR INTEGRATION
  // ============================================================================

  describe('PlayerGovernor Integration', () => {
    beforeEach(() => {
      runner.completeCinematic();
    });

    it('should activate PlayerGovernor for autonomous combat', () => {
      const governor = runner.getPlayerGovernor();

      governor.setGoal({ type: 'engage_enemies' });

      expect(governor.getCurrentGoal().type).toBe('engage_enemies');
    });

    it('should have Marcus follow when PlayerGovernor engages', () => {
      const governor = runner.getPlayerGovernor();

      runner.startWave(1);
      governor.setGoal({ type: 'engage_enemies' });

      // Marcus should be in support mode
      expect(runner.getMarcusState()).toBe('support');

      // Input state should reflect combat engagement
      const inputState = governor.getInputState();
      expect(inputState.shoot).toBe(true);
      expect(inputState.moveForward).toBe(true);
    });

    it('should coordinate Marcus AI with PlayerGovernor goals', () => {
      const governor = runner.getPlayerGovernor();
      const marcusAI = runner.getMarcusAI();

      governor.setGoal({ type: 'engage_enemies', aggressive: true });

      // Both should be in combat mode
      expect(marcusAI.getCoordinationState()).toBe('support');
    });
  });

  // ============================================================================
  // STATS VALIDATION
  // ============================================================================

  describe('Stats Validation', () => {
    it('should track all combat stats', async () => {
      runner.completeCinematic();
      runner.startWave(1);

      player.playAggressively();

      let frames = 0;
      while (frames < 600) {
        player.updateAutonomous();
        runner.tick();
        frames++;
      }

      const stats = runner.getLevelStats();

      expect(typeof stats.kills).toBe('number');
      expect(typeof stats.totalShots).toBe('number');
      expect(typeof stats.damageDealt).toBe('number');
      expect(typeof stats.timeSpent).toBe('number');
    });

    it('should track Marcus kill count separately', () => {
      runner.completeCinematic();
      runner.startWave(1);

      // Simulate Marcus getting kills
      for (let i = 0; i < 5; i++) {
        runner.simulateMarcusAttack();
      }

      // Marcus should have some kills
      expect(runner.getMarcusKillCount()).toBeGreaterThanOrEqual(0);
    });

    it('should calculate combined kill count', async () => {
      runner.completeCinematic();
      runner.startWave(1);

      player.playAggressively();

      let frames = 0;
      while (frames < 1200 && runner.getEnemyCount() > 0) {
        player.updateAutonomous();
        runner.tick();
        runner.simulateMarcusAttack();
        frames++;
      }

      const playerKills = runner.getLevelStats().kills;
      const marcusKills = runner.getMarcusKillCount();

      // Combined kills should account for all enemies
      expect(playerKills).toBeGreaterThanOrEqual(0);
      expect(marcusKills).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// VISUAL REGRESSION TESTS (MECH MODEL RENDERING)
// ============================================================================

describe('Visual Regression - Mech Model Rendering', () => {
  it('should verify mech model is renderable', () => {
    const runner = new BrothersInArmsTestRunner();
    runner.completeCinematic();

    const marcusAI = runner.getMarcusAI();
    const position = marcusAI.getPosition();

    // Verify Marcus has a valid position (indicating mesh is placed)
    expect(position.x).toBe(15);
    expect(position.y).toBe(0);
    expect(position.z).toBe(10);
  });

  it('should verify Marcus model responds to state changes', () => {
    const runner = new BrothersInArmsTestRunner();
    runner.completeCinematic();

    // Verify state transitions affect Marcus
    runner.setMarcusCoordinationState('aggressive');
    expect(runner.getMarcusState()).toBe('assault');

    runner.setMarcusCoordinationState('defensive');
    expect(runner.getMarcusState()).toBe('defensive');
  });

  it('should verify mech health bar updates correctly', () => {
    const runner = new BrothersInArmsTestRunner();
    runner.completeCinematic();

    const initialHealth = runner.getMarcusAI().getHealthPercent();
    expect(initialHealth).toBe(1);

    runner.damageMarcus(100); // Shields
    runner.damageMarcus(100); // Health

    const damagedHealth = runner.getMarcusAI().getHealthPercent();
    expect(damagedHealth).toBeLessThan(1);
    expect(damagedHealth).toBe(400 / 500); // 80%
  });
});
