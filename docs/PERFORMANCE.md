# Mobile Performance Optimization

This document describes the mobile performance optimization system implemented for Stellar Descent.

## Overview

The performance system automatically adapts rendering quality based on device capabilities, maintaining smooth frame rates on mobile devices while preserving visual fidelity on desktop.

## Key Components

### 1. PerformanceManager (`src/game/core/PerformanceManager.ts`)

Central singleton managing all performance-related settings.

**Features:**
- FPS tracking with P50/P95 latency metrics
- Dynamic resolution scaling based on frame rate
- Platform-aware quality presets (mobile/tablet/desktop)
- Battery-aware optimizations (reduces quality when battery < 20%)
- Debug overlay for development (FPS counter, metrics)

**Quality Levels:**
| Level | Resolution | Particles | Shadows | LOD Mult | Target FPS |
|-------|------------|-----------|---------|----------|------------|
| Ultra | 100% | 100% | 4096px | 1.5x | 60 |
| High | 100% | 80% | 2048px | 1.0x | 60 |
| Medium | 90% | 50% | 1024px | 0.8x | 60 |
| Low | 75% | 30% | 512px | 0.6x | 30 |
| Potato | 50% | 15% | Off | 0.4x | 30 |

**Usage:**
```typescript
import { getPerformanceManager } from './game/core/PerformanceManager';

const perfManager = getPerformanceManager();
perfManager.initialize(engine, scene);

// In render loop:
perfManager.update();

// Manual quality override:
perfManager.setQuality('medium');

// Enable debug overlay:
perfManager.configure({ debugOverlay: true });
```

### 2. Particle System Optimization

The `ParticleManager` integrates with `PerformanceManager` to automatically:
- Reduce particle counts on mobile (via `getAdjustedParticleCount()`)
- Skip non-essential particle effects when over budget
- Scale emission rates based on quality level

### 3. LOD Management (`src/game/core/LODManager.ts`)

Level-of-detail system with performance-aware distance scaling:
- Closer LOD transitions on mobile (via `lodDistanceMultiplier`)
- Automatic culling at distance
- Category-based LOD configurations (enemy, prop, environment)

### 4. Chunk Loading Optimization (`src/game/world/chunkManager.ts`)

Adaptive world loading:
- Reduced load radius on mobile (2-3 chunks vs 3-5 on desktop)
- Simplified mesh tessellation (8 segments vs 16 on cylinders)
- Earlier unloading of distant chunks

### 5. Mobile Shader Optimizer (`src/game/core/MobileShaderOptimizer.ts`)

Simplified shaders for mobile:
- Vertex-based lighting (cheaper than per-pixel)
- Unlit shaders for UI/effects
- Automatic material optimization (disable specular, normal maps)

## Engine Optimizations

Applied in `GameCanvas.tsx`:

**Mobile:**
- Disabled anti-aliasing on high-DPI devices
- Disabled stencil buffer
- `powerPreference: 'low-power'`
- Resolution capping on high-DPI (devicePixelRatio > 2)
- Disabled fog, lens flares, probes, procedural textures

**Desktop:**
- Full anti-aliasing
- `powerPreference: 'high-performance'`
- Adaptive device ratio

## Dynamic Resolution Scaling

When FPS drops below 25:
1. Resolution scale decreases by 15%
2. Minimum: 50% of native resolution
3. Cooldown: 30 frames between adjustments

When FPS rises above 55:
1. Resolution scale increases by 7.5%
2. Maximum: preset resolution scale
3. Slower recovery to prevent oscillation

## Performance Monitoring

Enable the debug overlay for real-time metrics:

```typescript
getPerformanceManager().configure({ debugOverlay: true });
```

Displays:
- Current FPS
- Frame time (ms)
- P50/P95 frame times
- Quality level
- Resolution scale
- Active mesh count
- Particle system count
- Battery level (if available)

## Testing Performance

Use the keyboard shortcut in development:
- Press `P` to toggle the performance overlay

## Recommended Settings by Device

| Device | Quality | Expected FPS |
|--------|---------|--------------|
| iPhone 12+ | Low | 30-45 |
| iPhone 15 Pro | Medium | 45-60 |
| iPad Pro | Medium-High | 60 |
| Android Flagship | Low-Medium | 30-45 |
| Desktop (integrated GPU) | Medium | 60 |
| Desktop (dedicated GPU) | High-Ultra | 60 |

## Performance Budget

Default budgets per quality level:

| Quality | Draw Calls | Triangles | Particle Systems |
|---------|------------|-----------|------------------|
| Ultra | 3000 | Unlimited | 100 |
| High | 2000 | Unlimited | 75 |
| Medium | 1500 | Unlimited | 50 |
| Low | 1000 | Unlimited | 30 |
| Potato | 500 | Unlimited | 15 |

## Future Improvements

1. **Texture Streaming**: Load lower-resolution textures first, upgrade as bandwidth allows
2. **Occlusion Culling**: Skip rendering of occluded objects
3. **Instanced Rendering**: Batch similar meshes (rocks, debris)
4. **Web Workers**: Offload terrain generation to background threads
5. **WASM Physics**: Use WebAssembly for physics calculations
