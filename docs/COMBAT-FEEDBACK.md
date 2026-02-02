# Combat Feedback Systems

This document describes the combat feedback systems that provide satisfying hit confirmation and enemy reactions in Stellar Descent. These systems bridge the gap between player input and game response, creating the "game juice" that makes combat feel impactful.

## Overview

Combat feedback is implemented through several interconnected systems:

| System | Location | Purpose |
|--------|----------|---------|
| Hitmarker | `DamageFeedback.ts` | Visual hit confirmation |
| Hit Audio | `WeaponSoundManager.ts` | Audio hit confirmation |
| Damage Numbers | `DamageFeedback.ts` | Floating damage values |
| Hit Reactions | `DamageFeedback.ts` | Enemy stagger/knockback |
| Death Effects | `DeathEffects.ts` | Enemy death particles |
| Enemy Hit VFX | `WeaponEffects.ts` | Blood/splatter particles |

---

## Hitmarker System

The hitmarker provides instant visual confirmation when damage is dealt.

### Architecture

```
Combat System detects hit
        │
        ▼
DamageFeedbackManager.applyDamageFeedback()
        │
        ├──► applyHitFlash()      - Enemy flashes
        ├──► applyScalePunch()    - Enemy scale reaction
        ├──► applyKnockback()     - Enemy position reaction
        ├──► showDamageNumber()   - Floating number
        └──► triggerScreenShake() - Camera shake
```

### Configuration

```typescript
interface DamageFeedbackConfig {
  // Hit Flash
  enableHitFlash: boolean;
  hitFlashDuration: number;     // Milliseconds
  hitFlashColor: Color3;

  // Knockback
  enableKnockback: boolean;
  knockbackScale: number;       // Distance per damage point

  // Damage Numbers
  enableDamageNumbers: boolean;
  damageNumberSpeed: number;    // Float speed (units/sec)
  damageNumberDuration: number; // Display time (ms)

  // Screen Shake
  enableScreenShake: boolean;
  screenShakeThreshold: number;
  screenShakeScale: number;
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  enableHitFlash: true,
  hitFlashDuration: 100,
  hitFlashColor: new Color3(1, 0.2, 0.2),  // Red

  enableKnockback: true,
  knockbackScale: 0.02,

  enableDamageNumbers: true,
  damageNumberSpeed: 2,
  damageNumberDuration: 1000,

  enableScreenShake: true,
  screenShakeThreshold: 15,
  screenShakeScale: 0.1,
};
```

### Usage

```typescript
import { damageFeedback } from './game/effects/DamageFeedback';

// Initialize with scene and optional config
damageFeedback.init(scene, {
  enableDamageNumbers: true,
  hitFlashDuration: 80,
});

// Apply all feedback effects at once (recommended)
damageFeedback.applyDamageFeedback(
  enemyMesh,    // Target mesh or TransformNode
  damage,       // Damage amount
  hitDirection, // Vector3 for knockback direction
  isCritical    // Boolean for critical hit
);

// Update each frame (required for damage numbers)
damageFeedback.update(deltaTime);
```

### Individual Effects

You can also trigger effects individually:

```typescript
// Just the hit flash
damageFeedback.applyHitFlash(enemyMesh, intensity);

// Just the knockback
damageFeedback.applyKnockback(enemyMesh, hitDirection, damage);

// Just the scale punch
damageFeedback.applyScalePunch(enemyMesh, intensity);

// Just the damage number
damageFeedback.showDamageNumber(worldPosition, damage, isCritical);

// Just screen shake
damageFeedback.triggerScreenShake(damage, isPlayerDamage);
```

---

## Hit Audio System

Procedural audio provides satisfying hit confirmation sounds.

### Sound Types

| Sound | Method | Purpose |
|-------|--------|---------|
| Hit Marker | `playHitMarker()` | Standard hit confirmation |
| Headshot | `playHeadshot()` | Critical hit feedback |
| Kill | `playKillConfirmation()` | Enemy defeated |
| Damage | `playDamageDealt()` | Scaled by damage amount |

### Implementation

```typescript
import { weaponSoundManager } from './game/core/WeaponSoundManager';

// Standard hit confirmation (double-tick)
weaponSoundManager.playHitMarker(volume);

// Headshot/critical hit (ascending ding)
weaponSoundManager.playHeadshot(volume);

// Kill confirmation (satisfying "donk")
weaponSoundManager.playKillConfirmation(volume);

// Damage-scaled feedback
weaponSoundManager.playDamageDealt(damage, volume);
```

### Sound Design

**Hit Marker:**
- Sharp double-tick (1200Hz then 1600Hz)
- Duration: ~65ms
- Clean, non-intrusive confirmation

**Headshot:**
- Ascending ding (1500Hz -> 2000Hz -> 2400Hz)
- Crispy high-frequency accent
- Duration: ~150ms
- Rewarding and distinct

**Kill Confirmation:**
- Deep "donk" (400Hz -> 200Hz)
- High accent note (1800Hz -> 1400Hz)
- Duration: ~180ms
- Satisfying closure

---

## Enemy Hit Reactions

Enemies react visually to damage through multiple channels.

### Hit Flash

Materials temporarily change color on hit:

```typescript
// Flash the enemy red
damageFeedback.applyHitFlash(enemyMesh, intensity);

// Intensity ranges from 0-1
// 0.5 = half damage glow
// 1.0 = full damage glow
```

**How it works:**
1. Store original material colors
2. Apply flash color to diffuse and emissive
3. Schedule restoration after `hitFlashDuration`
4. Handle material types (StandardMaterial gets color change, others get replacement)

### Scale Punch

Quick scale animation on hit:

```typescript
damageFeedback.applyScalePunch(enemyMesh, intensity);
```

**Animation curve:**
- Frame 0: Original scale
- Frame 2: Scale up by 15% * intensity
- Frame 8: Return to original

### Knockback

Position-based reaction to hits:

```typescript
damageFeedback.applyKnockback(enemyMesh, hitDirection, damage);
```

**Calculation:**
```typescript
knockbackAmount = damage * knockbackScale;  // Default 0.02
knockbackDirection = hitDirection.normalize().negate();
```

**Animation curve:**
- Frame 0: Original position
- Frame 3: Knocked back position
- Frame 10: Return to original

Uses Bezier easing for snappy feel.

---

## Death Effects

The death effects system provides dramatic enemy destruction.

### Death Effect Types

```typescript
type DeathEffectType =
  | 'dissolve'      // Standard fade-out
  | 'disintegrate'  // Fast disintegration
  | 'explode'       // Large explosion
  | 'ichor_burst'   // Alien death with green goo
  | 'mechanical'    // Robot debris
  | 'boss';         // Epic boss death
```

### Usage

```typescript
import { deathEffects } from './game/effects/DeathEffects';

// Initialize
deathEffects.init(scene);

// Standard enemy death
deathEffects.playEnemyDeath(position, isAlien, scale, mesh);

// Boss death (larger, more dramatic)
deathEffects.playBossDeath(position, isAlien, scale, mesh);

// Mechanical enemy death (debris)
deathEffects.playMechanicalDeath(position, scale, mesh);

// Custom death effect
deathEffects.playDeathEffect({
  position: worldPosition,
  type: 'explode',
  scale: 1.5,
  mesh: enemyMesh,
  isAlien: true,
  onComplete: () => {
    // Clean up entity
  },
});
```

### Effect Details

**Dissolve (Standard):**
- 80 particles over 800ms
- Gray colors fading to transparent
- Mesh shrinks and rises
- Particles rise with gravity: +2

**Disintegrate:**
- 120 particles over 500ms
- Orange/red energy colors
- Bright flash (3 intensity light)
- Mesh shrinks with random jitter

**Explode:**
- 150 particles over 600ms
- Orange/yellow fire colors
- Strong light flash (5 intensity)
- Debris particle emission

**Ichor Burst (Alien):**
- 100 particles over 700ms
- Green toxic colors
- 60 additional goo splatter particles
- Ground splatter decal
- Particles fall with gravity: -3

**Mechanical:**
- 60 particles over 1000ms
- Gray/metal colors
- Spark burst
- 4-8 GLB debris chunks with physics
- Debris bounces and fades

**Boss:**
- 300 particles over 2000ms
- Gold/orange colors
- Intense light flash (5 intensity, 1.5s)
- Shockwave ring expanding
- Multiple debris emissions

### Preloading Debris Assets

For mechanical deaths, debris GLB models must be preloaded:

```typescript
import { preloadDeathEffectAssets } from './game/effects/DeathEffects';

// During level load
await preloadDeathEffectAssets(scene);

// Now mechanical deaths work
deathEffects.playMechanicalDeath(position, scale);
```

---

## Kill Confirmation

Full kill confirmation combines multiple systems:

```typescript
// When enemy health reaches 0
function onEnemyDeath(enemy, lastHitDirection, isAlien) {
  const position = enemy.getAbsolutePosition();

  // 1. Play death effect
  deathEffects.playEnemyDeath(position, isAlien, 1.0, enemy.mesh);

  // 2. Audio confirmation
  weaponSoundManager.playKillConfirmation();

  // 3. Particle effects
  particleManager.emitAlienDeath(position, 1.0);
  // or
  particleManager.emitExplosion(position, 1.0);

  // 4. Screen shake (for significant kills)
  damageFeedback.triggerScreenShake(50, false);
}
```

---

## Enemy Hit VFX

Visual effects when bullets connect with enemies.

### Implementation

```typescript
import { weaponEffects } from './game/effects/WeaponEffects';

weaponEffects.emitEnemyHit(
  position,        // Hit position
  hitDirection,    // Bullet direction
  isAlien,         // Green vs red blood
  damage,          // Affects scale
  isCritical       // Extra effects for crits
);
```

### Effect Details

**Standard Hit:**
- Blood/ichor splatter particles
- Scale based on damage (0.5 + damage/50)
- Directional spray opposite hit direction
- Bullet impact sparks at hit point

**Critical Hit:**
- Everything from standard
- Additional burst effect (alien death or blood)

**Alien vs Human:**
| Type | Color | Particle Effect |
|------|-------|-----------------|
| Alien | Green | `emitAlienSplatter()` |
| Human | Red | `emitBloodSplatter()` |

---

## Performance Considerations

### Object Pooling

Damage numbers use a pool of 20 meshes:

```typescript
// Pool configuration
private readonly maxDamageNumbers = 20;

// Pooled objects include:
// - Plane mesh (billboard)
// - StandardMaterial
// - DynamicTexture for text
```

### Update Loop

The `update()` method must be called each frame:

```typescript
// In your game loop
function update(deltaTime) {
  damageFeedback.update(deltaTime);
}
```

This handles:
- Damage number floating animation
- Damage number fade-out
- Returning expired numbers to pool

### Animation Management

Active animations are tracked and can be cancelled:

```typescript
// Internally tracks animations
private activeAnimations: Map<string, Animatable[]>

// Cancels conflicting animations
private cancelAnimations(targetId: string)
```

This prevents animation stacking when enemies are hit rapidly.

---

## Customization Examples

### Disable Damage Numbers

```typescript
damageFeedback.configure({
  enableDamageNumbers: false,
});
```

### Increase Screen Shake

```typescript
damageFeedback.configure({
  screenShakeThreshold: 5,   // Shake on smaller hits
  screenShakeScale: 0.2,     // Stronger shake
});
```

### Faster Hit Flash

```typescript
damageFeedback.configure({
  hitFlashDuration: 50,  // Faster flash
});
```

### Different Flash Color

```typescript
damageFeedback.configure({
  hitFlashColor: new Color3(1, 1, 0),  // Yellow flash
});
```

### Custom Death Effect

```typescript
deathEffects.playDeathEffect({
  position: enemyPosition,
  type: 'explode',
  scale: 2.0,
  mesh: enemyMesh,
  isAlien: false,
  onComplete: () => {
    // Spawn loot, play sound, etc.
    spawnLoot(enemyPosition);
    playSound('explosion_large');
  },
});
```

---

## Integration with Combat System

### Complete Combat Flow

```
Player Fires
      │
      ▼
WeaponFire detected
      │
      ├──► Muzzle flash
      ├──► Fire sound
      └──► Recoil applied
      │
      ▼
Raycast/Projectile hit
      │
      ├──► Surface impact effect
      │         (metal sparks, dust, etc.)
      │
      └──► Enemy hit?
               │
               ├──► Hit VFX (blood/ichor)
               ├──► Hit audio (hitmarker)
               ├──► Damage feedback
               │         ├──► Hit flash
               │         ├──► Knockback
               │         ├──► Scale punch
               │         ├──► Damage number
               │         └──► Screen shake
               │
               └──► Health <= 0?
                        │
                        ├──► Kill audio
                        ├──► Death effect
                        └──► Combat state update
```

---

## Related Documentation

- [Weapon Feel](./WEAPON-FEEL.md) - Recoil, muzzle flash, shell casings
- [Architecture](./ARCHITECTURE.md) - System overview
- [FPS Completeness Analysis](./FPS-COMPLETENESS-ANALYSIS.md) - Gap analysis

---

*"A strong audio-visual experience is necessary to maintain immersion. Whether a weapon feels good to use has more to do with the SFX and VFX than damage."*
