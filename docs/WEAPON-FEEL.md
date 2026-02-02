# Weapon Feel Systems

This document describes the weapon feedback systems that make shooting in Stellar Descent feel satisfying and responsive. Great FPS games are defined by how their weapons "feel" - the visual and audio feedback that sells the power of each weapon.

## Overview

Weapon feel is implemented through several interconnected systems:

| System | Location | Purpose |
|--------|----------|---------|
| Recoil | `WeaponAnimations.ts` | Camera kick on firing |
| Muzzle Flash | `MuzzleFlash.ts` | Visual flash and light |
| Screen Shake | `PostProcessManager.ts` + `DamageFeedback.ts` | Camera trauma |
| Shell Casings | `WeaponEffects.ts` | Ejected brass |
| Weapon Sounds | `WeaponSoundManager.ts` | Procedural audio |
| View Model | `FirstPersonWeapons.ts` | First-person weapon rendering |

---

## Recoil System

The recoil system provides visual feedback when weapons are fired through camera kick and weapon model movement.

### Architecture

```
FirstPersonWeapons.fireWeapon()
        │
        ▼
WeaponAnimationController.triggerFire()
        │
        ▼
  Recoil state updated
        │
        ▼
  Per-frame update applies:
    - Position offset (kickback)
    - Rotation offset (pitch up)
    - Random jitter
        │
        ▼
  Recovery over time
```

### Configuration

Each weapon category has a recoil profile defined in `WeaponAnimations.ts`:

```typescript
interface WeaponAnimationProfile {
  /** Recoil kick distance (backward along local Z) */
  recoilKickBack: number;
  /** Recoil pitch (upward rotation in radians) */
  recoilPitchUp: number;
  /** Recoil recovery speed (units/s) */
  recoilRecoverySpeed: number;
  // ... other animation properties
}
```

### Category Profiles

| Category | Kick Back | Pitch Up | Recovery Speed |
|----------|-----------|----------|----------------|
| Sidearm | 0.03 | 0.04 | 8.0 |
| SMG | 0.02 | 0.02 | 10.0 |
| Rifle | 0.04 | 0.035 | 6.0 |
| Marksman | 0.06 | 0.05 | 4.0 |
| Shotgun | 0.07 | 0.055 | 4.5 |
| Heavy | 0.08 | 0.06 | 3.0 |

### Per-Weapon Overrides

Specific weapons can override their category defaults:

```typescript
const WEAPON_OVERRIDES = {
  revolver: {
    recoilKickBack: 0.055,
    recoilPitchUp: 0.05,
    recoilRecoverySpeed: 5.0,
  },
  sniper_rifle: {
    recoilKickBack: 0.09,
    recoilPitchUp: 0.07,
    recoilRecoverySpeed: 2.5,
  },
  double_barrel: {
    recoilKickBack: 0.1,
    recoilPitchUp: 0.08,
    recoilRecoverySpeed: 3.5,
  },
};
```

### Usage

```typescript
import { FirstPersonWeaponSystem } from './game/weapons/FirstPersonWeapons';

const fpWeapons = FirstPersonWeaponSystem.getInstance();

// Fire weapon (triggers recoil + muzzle flash)
fpWeapons.fireWeapon();

// Recoil is automatically updated each frame via the update() loop
```

---

## Screen Shake System

Screen shake provides visceral feedback for impacts and explosions. It's integrated with the damage feedback system.

### Integration Points

1. **DamageFeedbackManager** - Triggers shake on damage events
2. **PostProcessManager** - Applies camera shake via chromatic aberration intensity
3. **Level implementations** - Can trigger custom shake events

### Configuration

```typescript
interface DamageFeedbackConfig {
  enableScreenShake: boolean;
  screenShakeThreshold: number;  // Minimum damage to trigger shake
  screenShakeScale: number;       // Intensity multiplier per damage point
}

const DEFAULT_CONFIG = {
  enableScreenShake: true,
  screenShakeThreshold: 15,
  screenShakeScale: 0.1,
};
```

### Usage

```typescript
import { damageFeedback } from './game/effects/DamageFeedback';

// Initialize with scene
damageFeedback.init(scene, {
  enableScreenShake: true,
  screenShakeThreshold: 10,
});

// Set the shake callback (provided by level/camera system)
damageFeedback.setScreenShakeCallback((intensity) => {
  // Apply shake to camera
  camera.applyShake(intensity);
});

// Trigger shake on damage dealt
damageFeedback.triggerScreenShake(damage, isPlayerDamage);

// Player damage always shakes; enemy damage shakes above threshold
```

### Intensity Calculation

```typescript
// Player taking damage: always shakes
intensity = Math.min(8, 1 + damage / 10);

// Dealing damage: only above threshold
if (damage >= screenShakeThreshold) {
  intensity = (damage - threshold) * screenShakeScale + 0.5;
  intensity = Math.min(4, intensity);
}
```

---

## Muzzle Flash System

The muzzle flash system provides visual feedback at the weapon's barrel including:

- Flash sprite (billboard)
- Point light pulse
- Smoke wisps
- Spark particles

### Architecture

```
FirstPersonWeapons.emitMuzzleFlash()
        │
        ├──► WeaponEffects.emitMuzzleFlash()
        │           │
        │           ├──► ParticleManager.emitMuzzleFlash()
        │           ├──► emitMuzzleSmoke()
        │           ├──► emitMuzzleSparks()
        │           └──► emitPlasmaCharge() (plasma weapons)
        │
        └──► MuzzleFlashManager.emit()
                    │
                    ├──► Flash sprite + material
                    ├──► Point light pulse
                    └──► Pooled smoke particles
```

### Configuration

```typescript
interface MuzzleFlashConfig {
  scale: number;           // Effect scale (1.0 = normal)
  lightIntensity: number;  // Point light intensity
  lightRange: number;      // Light falloff range
  lightColor: Color3;      // Light color
  flashDuration: number;   // Duration in milliseconds
  emitSmoke: boolean;      // Emit smoke wisps
  emitSparks: boolean;     // Emit spark particles
}
```

### Weapon-Specific Presets

| Weapon Type | Scale | Light Intensity | Duration | Notes |
|-------------|-------|-----------------|----------|-------|
| Rifle | 1.0 | 2.5 | 50ms | Standard flash |
| Pistol | 0.7 | 1.5 | 40ms | Smaller, quicker |
| Shotgun | 1.8 | 4.0 | 80ms | Large, bright |
| Plasma | 1.2 | 3.0 | 70ms | Blue, no smoke |
| Heavy | 2.0 | 5.0 | 100ms | Massive flash |

### Usage

```typescript
import { muzzleFlash } from './game/effects/MuzzleFlash';

// Initialize
muzzleFlash.init(scene);

// Single flash
muzzleFlash.emit(position, direction, 'rifle');

// Sustained fire (for automatic weapons)
const handle = muzzleFlash.startSustainedFlash(position, direction, 'rifle');
// ... later
handle.stop();
```

### Pooling

Muzzle flash uses object pooling for performance:

- Max 10 flash sprites/lights
- Max 15 smoke particle systems
- Pre-warmed on initialization
- Auto-recycled after animation

---

## Shell Casing System

Shell casings add visual polish through ejected brass with simple physics.

### Implementation

Located in `WeaponEffects.ts`:

```typescript
emitShellCasing(
  position: Vector3,      // Ejection position (side of weapon)
  ejectionDirection: Vector3,  // Direction to eject
  weaponType: WeaponType  // Affects casing size
): void
```

### Casing Sizes

| Weapon Type | Casing Diameter |
|-------------|-----------------|
| Default | 0.04 |
| Shotgun | 0.06 |
| Heavy | 0.08 |

### Physics Simulation

Casings use simplified physics:

- Initial velocity in ejection direction
- Gravity at -15 units/s^2
- Ground bounce with 0.3 restitution
- Friction on horizontal velocity (0.7)
- Angular velocity for tumbling
- Auto-dispose after 2 seconds

### Particle Effect

In addition to the mesh, a particle effect is emitted:

```typescript
particleManager.emitShellCasing(position, ejectionDirection);
```

---

## Impact Decal System

Impact effects provide feedback when bullets hit surfaces.

### Surface Types

```typescript
type SurfaceMaterial =
  | 'metal'     // Bright sparks, ricochet
  | 'concrete'  // Dust and debris
  | 'organic'   // Blood/splatter
  | 'energy'    // Shield ripple
  | 'dirt'      // Dust cloud
  | 'default';  // Generic sparks
```

### Usage

```typescript
import { weaponEffects } from './game/effects/WeaponEffects';

// Emit impact based on surface
weaponEffects.emitImpact(
  position,
  surfaceNormal,
  'metal',
  1.0  // scale
);
```

### Surface-Specific Effects

| Surface | Primary Effect | Secondary Effect |
|---------|----------------|------------------|
| Metal | Bright orange/white sparks | Ricochet whine |
| Concrete | Dust puff | Gray debris sparks |
| Organic | Blood splatter | Blood mist |
| Energy | Blue energy ripple | Secondary glow |
| Dirt | Large dust cloud | Debris chunks |

---

## Adding New Weapons

To add a new weapon with proper feel:

### 1. Define the Weapon

In `entities/weapons.ts`:

```typescript
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  my_new_weapon: {
    id: 'my_new_weapon',
    name: 'New Weapon',
    category: 'rifle',  // Determines base animation profile
    tier: 2,
    damage: 35,
    fireRate: 600,
    magazineSize: 30,
    // ...
  },
};
```

### 2. Optional: Override Animation Profile

In `weapons/WeaponAnimations.ts`:

```typescript
const WEAPON_OVERRIDES = {
  my_new_weapon: {
    recoilKickBack: 0.045,
    recoilPitchUp: 0.04,
    recoilRecoverySpeed: 5.5,
    reloadDuration: 2.2,
    switchHalfDuration: 0.22,
    bobAmplitude: 0.014,
    bobFrequency: 1.05,
  },
};
```

### 3. Optional: Custom View Transform

In `weapons/FirstPersonWeapons.ts`:

```typescript
const VIEW_TRANSFORMS = {
  my_new_weapon: {
    position: new Vector3(0, -0.01, 0.03),
    scale: new Vector3(0.95, 0.95, 0.95),
    muzzleOffset: new Vector3(0, 0.005, 0.35),
  },
};
```

### 4. Optional: Custom Muzzle Flash

In `effects/MuzzleFlash.ts`:

```typescript
const WEAPON_FLASH_CONFIGS = {
  my_new_weapon: {
    scale: 1.1,
    lightIntensity: 2.8,
    flashDuration: 55,
  },
};
```

### 5. Add GLB Model

Place the weapon model in:

```
public/models/props/weapons/my_new_weapon.glb
```

### 6. Test the Feel

```bash
pnpm run dev
```

Things to check:
- Does the recoil feel appropriate for the weapon class?
- Is the muzzle flash visible but not overwhelming?
- Does the weapon bob naturally during movement?
- Is the reload animation smooth?
- Do the sounds match the weapon's character?

---

## Performance Considerations

### Particle Limits

All particle systems use adaptive counts based on device performance:

```typescript
import { getAdjustedParticleCount } from './core/PerformanceManager';

// Automatically scales particle count for device
const count = getAdjustedParticleCount(100);  // May return 50 on mobile
```

### Object Pooling

- Muzzle flash sprites: max 10
- Smoke particle systems: max 15
- Damage numbers: max 20

### Update Frequency

Weapon animations update every frame but use:
- Cached camera positions
- Reusable Vector3 temporaries
- Single-pass offset calculations

---

## Related Documentation

- [Combat Feedback](./COMBAT-FEEDBACK.md) - Hitmarkers, hit reactions, death effects
- [Architecture](./ARCHITECTURE.md) - System overview
- [FPS Completeness Analysis](./FPS-COMPLETENESS-ANALYSIS.md) - Gap analysis

---

*"A juicy game feels alive and responds to everything you do - tons of cascading action and response for minimal user input."*
