# Stellar Descent - Asset Pipeline

## Overview

This directory contains Blender Python (bpy) scripts for processing 3D assets
into game-ready GLB files. All scripts are designed to run headless via Blender's
`--background` flag.

## Scripts

### `retexture_marines.py` - Marine Armor Retexturing

Imports original marine GLBs from the `space-marines` project and applies
planet-appropriate dark brown armor with role-specific accent colors.

**What it does:**
1. Imports original textured GLBs (8-18MB with full 2K diffuse/emissive/bump/AO)
2. Tints diffuse textures to dark warm brown `RGB(0.14, 0.11, 0.08)` using
   luminance-preserving algorithm (72% tint strength)
3. Tints emissive textures to role-specific amber/earth accent colors (80% strength)
4. Sets PBR values: `metallic=0.65`, `roughness=0.42`
5. Leaves bump and AO textures untouched (they provide surface detail)
6. Exports with all modified textures re-packed into the GLB

**Usage:**
```bash
# Retexture all 4 marines
blender --background --python scripts/retexture_marines.py -- \
    --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \
    --output public/models/npcs/marine/

# Single role
blender --background --python scripts/retexture_marines.py -- \
    --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \
    --output public/models/npcs/marine/ \
    --role marine_elite

# Dry run (inspect without writing)
blender --background --python scripts/retexture_marines.py -- \
    --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \
    --output public/models/npcs/marine/ \
    --dry-run
```

**Source mapping:**
| Game Role | Source GLB | Output | Role Accent |
|-----------|-----------|--------|-------------|
| marine_soldier | soldier_a.glb | marine_soldier.glb | Amber (0.45, 0.35, 0.20) |
| marine_sergeant | sargent_a.glb | marine_sergeant.glb | Gold (0.55, 0.40, 0.08) |
| marine_elite | cyber_soldier_a.glb | marine_elite.glb | Dark red (0.60, 0.15, 0.08) |
| marine_crusader | crusader_a.glb | marine_crusader.glb | Burnt orange (0.50, 0.30, 0.12) |

### `camo_palettes.py` - Color Palette & Weathering System

Shared Python module defining all armor colors, role markings, and
planet weathering configurations. Imported by `retexture_marines.py`.

**Design philosophy:**
- 1000 years in the future: powered hardshell armor, not fabric camo
- All marines share the same dark brown-gunmetal base color
- Color blends with Kepler-442b's rocky arid surface
- Role markings use muted earth-tone accents (amber, gold, dark red, burnt orange)
- No bright blues, silvers, or neon colors
- Weathering accumulates through the campaign (ice, ash, acid, grime)

**Key constants:**
- `ARMOR_SCHEME` - Base plate color, metallic, roughness, visor, trim
- `MARINE_ROLES` - Per-role shoulder/emissive colors
- `SOURCE_GLB_MAP` - Maps role names to original space-marines GLBs
- `WEATHERING_LAYERS` - Biome-specific damage (ice, volcanic, hive, station, surface)
- `CAMPAIGN_ORDER` - Level sequence for progressive weathering

### `batch_fbx_to_glb.py` - FBX Batch Converter

Converts directories of FBX files to GLB format.

```bash
blender --background --python scripts/batch_fbx_to_glb.py -- /input/dir/ /output/dir/
```

### `batch_blend_to_glb.py` - Blend File Batch Converter

Converts directories of .blend files to GLB format.

```bash
blender --background --python scripts/batch_blend_to_glb.py -- /input/dir/ /output/dir/
```

## GLB Asset Organization

```
public/models/
  npcs/
    marine/           # 4 retextured marine variants (10-18MB each)
  enemies/
    chitin/           # Alien enemy models
  vehicles/           # Player/enemy vehicles
  spaceships/         # Dropships, shuttles
  environment/
    station/          # ~180 modular station pieces (walls, floors, pillars, etc.)
    modular/          # Generic modular building pieces
    alien-flora/      # Organic alien vegetation
    industrial/       # Industrial structures
    station-external/ # Station exterior pieces
  props/
    weapons/          # 43 weapon models + ammo
    containers/       # Crates, barrels
    debris/           # Rubble, wreckage
    collectibles/     # Pickups, audio logs
    atmospheric/      # Fog, particle meshes
    doors/            # Door models
    electrical/       # Panels, cables
    furniture/        # Tables, chairs
    pipes/            # Pipe segments
    decals/           # Surface decals
```

## Blender 5.0 Compatibility

The retexture pipeline includes monkey-patches for known Blender 5.0 glTF bugs:
- **Joint weight mismatch**: Some GLBs have inconsistent vertex joint counts.
  The patch catches the ValueError and retries import without skinning data.
- **armature_display**: Context error on import. Caught and skipped.

## Tinting Algorithm

The `tint_image_pixels()` function preserves texture detail while changing hue:

```
luminance = 0.299*R + 0.587*G + 0.114*B  (Rec. 709)
tinted = luminance * target_color
result = original * (1 - strength) + tinted * strength
```

This means scratches, wear patterns, paint chips, and surface detail all survive
the retexture. Only the overall color hue changes.
