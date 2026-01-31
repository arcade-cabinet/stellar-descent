"""
Stellar Descent - Marine Armor Retexturing Pipeline

Imports the ORIGINAL textured marine GLBs from the space-marines project,
tints their existing 2K textures to planet-appropriate dark brown armor,
sets PBR material values, and exports with all textures embedded.

This preserves the full texture detail (diffuse, emissive, bump, AO) from
the source models while applying a unified color scheme.

Approach:
  1. Import original GLB (8-18MB with full 2K textures)
  2. For each diffuse/albedo texture: desaturate and tint to dark warm brown
  3. For each emissive texture: tint to role-specific amber/earth accent
  4. Set metallic=0.65, roughness=0.42 on all Principled BSDFs
  5. Leave bump and AO textures untouched (they're detail, not color)
  6. Export GLB with all modified textures re-packed

Usage:
    # Retexture all 4 marines from space-marines originals:
    blender --background --python scripts/retexture_marines.py -- \\
        --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \\
        --output public/models/npcs/marine/

    # Retexture a single role:
    blender --background --python scripts/retexture_marines.py -- \\
        --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \\
        --output public/models/npcs/marine/ \\
        --role marine_soldier

    # Dry run (inspect without writing):
    blender --background --python scripts/retexture_marines.py -- \\
        --source ~/src/arcade-cabinet/space-marines/ExportedGLB/ \\
        --output public/models/npcs/marine/ \\
        --dry-run

Requires: Blender 3.6+ (tested on 5.0), numpy
"""

import bpy
import sys
import os
import json
import numpy as np
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))
from camo_palettes import (
    ARMOR_SCHEME, MARINE_ROLES, SOURCE_GLB_MAP,
    get_level_palette, get_campaign_progress,
)


# ---------------------------------------------------------------------------
# Blender 5.0 compatibility patches
# ---------------------------------------------------------------------------

def apply_blender_patches():
    """Monkey-patch known Blender 5.0 glTF import bugs."""
    try:
        import io_scene_gltf2.blender.imp.mesh as gltf_mesh
        original_do_primitives = gltf_mesh.do_primitives

        def patched_do_primitives(gltf, mesh_idx, skin_idx, mesh, ob):
            try:
                return original_do_primitives(gltf, mesh_idx, skin_idx, mesh, ob)
            except ValueError as e:
                if 'concatenation axis' in str(e):
                    print(f"    [PATCH] Joint weight mismatch, retrying without skin")
                    return original_do_primitives(gltf, mesh_idx, None, mesh, ob)
                raise

        gltf_mesh.do_primitives = patched_do_primitives
        print("  Applied Blender 5.0 joint weight patch")
    except Exception as e:
        print(f"  Patch skipped: {e}")


# ---------------------------------------------------------------------------
# Texture tinting
# ---------------------------------------------------------------------------

def tint_image_pixels(image, target_color: np.ndarray, strength: float = 0.7):
    """
    Tint an image toward a target color while preserving luminance detail.

    Algorithm:
      1. Extract luminance from each pixel (preserves surface detail)
      2. Multiply luminance by target color (applies uniform hue)
      3. Blend result with original at given strength

    This means scratches, wear patterns, paint chips etc. all survive the
    retexture — only the overall hue changes.
    """
    w, h = image.size
    n_pixels = w * h * 4
    pixels = np.array(image.pixels[:n_pixels]).reshape(h, w, 4)
    rgb = pixels[:, :, :3]
    alpha = pixels[:, :, 3:4]

    # Perceived luminance (Rec. 709)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    lum = lum[:, :, np.newaxis]

    # Tinted version: luminance * target color
    tinted = lum * target_color[np.newaxis, np.newaxis, :]

    # Blend with original
    result = rgb * (1.0 - strength) + tinted * strength
    result = np.clip(result, 0.0, 1.0)

    # Reconstruct RGBA and write back
    final = np.concatenate([result, alpha], axis=2)
    image.pixels[:n_pixels] = final.flatten().tolist()
    image.update()
    image.pack()


def classify_texture(image_name: str) -> str:
    """Classify a texture by its purpose based on filename conventions."""
    name = image_name.lower()
    if any(k in name for k in ['diffuse', 'color', 'basecolor', 'albedo']):
        return 'diffuse'
    if any(k in name for k in ['emissive', 'emission', 'glow']):
        return 'emissive'
    if any(k in name for k in ['bump', 'normal', 'nrm']):
        return 'normal'
    if any(k in name for k in ['ao', 'ambient', 'occlusion']):
        return 'ao'
    if any(k in name for k in ['rough', 'roughness']):
        return 'roughness'
    if any(k in name for k in ['metal', 'metallic', 'metalness']):
        return 'metallic'
    return 'unknown'


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def clear_scene():
    """Remove all objects and orphan data."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.images:
        if block.users == 0:
            bpy.data.images.remove(block)


def retexture_marine(
    source_glb: Path,
    output_glb: Path,
    role_key: str,
    dry_run: bool = False,
) -> bool:
    """
    Full retexture pipeline for one marine.

    1. Clear scene
    2. Import original GLB (with full 2K textures)
    3. Tint diffuse textures -> dark warm brown
    4. Tint emissive textures -> role accent color
    5. Set PBR values (metallic, roughness)
    6. Export with embedded textures
    """
    role = MARINE_ROLES.get(role_key, MARINE_ROLES['marine_soldier'])
    armor = ARMOR_SCHEME

    plate_color = np.array(armor['plate_color'])
    emissive_color = np.array(role.get('emissive_color', role['shoulder_color']))
    diffuse_strength = armor.get('diffuse_tint_strength', 0.72)
    emissive_strength = armor.get('emissive_tint_strength', 0.80)

    print(f"\n{'='*60}")
    print(f"  {role_key.upper()} ({role['name']})")
    print(f"  Source:  {source_glb.name} ({source_glb.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  Output:  {output_glb}")
    print(f"  Plate:   RGB({plate_color[0]:.2f}, {plate_color[1]:.2f}, {plate_color[2]:.2f})")
    print(f"  Emissive: RGB({emissive_color[0]:.2f}, {emissive_color[1]:.2f}, {emissive_color[2]:.2f})")
    print(f"{'='*60}")

    # 1. Clear
    clear_scene()

    # 2. Import
    try:
        bpy.ops.import_scene.gltf(filepath=str(source_glb))
    except Exception as e:
        print(f"  ERROR importing: {e}")
        return False

    mesh_count = sum(1 for o in bpy.data.objects if o.type == 'MESH')
    img_count = len(bpy.data.images)
    mat_count = len(bpy.data.materials)
    print(f"  Imported: {mesh_count} meshes, {mat_count} materials, {img_count} images")

    # 3-4. Tint textures
    tinted = {'diffuse': 0, 'emissive': 0, 'kept': 0}
    for img in bpy.data.images:
        tex_type = classify_texture(img.name)
        if tex_type == 'diffuse':
            tint_image_pixels(img, plate_color, diffuse_strength)
            tinted['diffuse'] += 1
            print(f"    Tinted diffuse:  {img.name} ({img.size[0]}x{img.size[1]})")
        elif tex_type == 'emissive':
            tint_image_pixels(img, emissive_color, emissive_strength)
            tinted['emissive'] += 1
            print(f"    Tinted emissive: {img.name} ({img.size[0]}x{img.size[1]})")
        else:
            tinted['kept'] += 1
            print(f"    Kept {tex_type:10s}: {img.name}")

    print(f"  Textures: {tinted['diffuse']} diffuse tinted, "
          f"{tinted['emissive']} emissive tinted, {tinted['kept']} unchanged")

    # 5. Set PBR values on all materials
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value = armor['plate_metallic']
                node.inputs['Roughness'].default_value = armor['plate_roughness']

    # 6. Export
    if dry_run:
        print(f"  DRY RUN — would export to {output_glb}")
        return True

    output_glb.parent.mkdir(parents=True, exist_ok=True)
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_glb),
            export_format='GLB',
            export_apply=True,
            export_yup=True,
            export_image_format='AUTO',
            export_materials='EXPORT',
        )
        size_mb = output_glb.stat().st_size / 1024 / 1024
        print(f"  => {output_glb.name}: {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  ERROR exporting: {e}")
        return False


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def get_args():
    argv = sys.argv
    if '--' in argv:
        return argv[argv.index('--') + 1:]
    return []


def parse_args(raw_args):
    import argparse
    parser = argparse.ArgumentParser(
        description='Retexture marine GLBs with planet-appropriate dark armor')
    parser.add_argument(
        '--source', required=True,
        help='Directory with original space-marines ExportedGLB files')
    parser.add_argument(
        '--output', required=True,
        help='Output directory for retextured marines')
    parser.add_argument(
        '--role', default=None,
        help='Process single role (marine_soldier, marine_sergeant, marine_elite, marine_crusader)')
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Preview changes without writing files')
    return parser.parse_args(raw_args)


def main():
    args = parse_args(get_args())
    source_dir = Path(args.source)
    output_dir = Path(args.output)

    if not source_dir.exists():
        print(f"ERROR: Source directory not found: {source_dir}")
        sys.exit(1)

    # Apply Blender 5.0 compatibility patches
    apply_blender_patches()

    # Determine which roles to process
    if args.role:
        roles = {args.role: SOURCE_GLB_MAP[args.role]}
    else:
        roles = SOURCE_GLB_MAP

    print(f"\nStellar Descent - Marine Armor Retexture Pipeline")
    print(f"{'='*60}")
    print(f"Source:  {source_dir}")
    print(f"Output:  {output_dir}")
    print(f"Roles:   {len(roles)}")
    print(f"Armor:   {ARMOR_SCHEME['name']}")
    print(f"Plate:   RGB{ARMOR_SCHEME['plate_color']}")
    print(f"Metallic: {ARMOR_SCHEME['plate_metallic']}")
    print(f"Roughness: {ARMOR_SCHEME['plate_roughness']}")

    results = {}
    for role_key, source_name in roles.items():
        source_glb = source_dir / source_name
        output_glb = output_dir / f"{role_key}.glb"

        if not source_glb.exists():
            print(f"\n  WARNING: {source_glb} not found, skipping {role_key}")
            results[role_key] = False
            continue

        results[role_key] = retexture_marine(
            source_glb, output_glb, role_key, args.dry_run
        )

    # Summary
    print(f"\n{'='*60}")
    print(f"RESULTS:")
    for role_key, success in results.items():
        status = 'OK' if success else 'FAILED'
        out = output_dir / f"{role_key}.glb"
        if success and out.exists():
            size = out.stat().st_size / 1024 / 1024
            print(f"  {role_key:20s} {status} ({size:.1f} MB)")
        else:
            print(f"  {role_key:20s} {status}")

    ok = sum(1 for v in results.values() if v)
    fail = sum(1 for v in results.values() if not v)
    print(f"\n  {ok} succeeded, {fail} failed")

    # Write manifest
    if not args.dry_run and ok > 0:
        manifest = {
            'pipeline': 'retexture_marines.py',
            'armor_scheme': ARMOR_SCHEME['name'],
            'plate_color': list(ARMOR_SCHEME['plate_color']),
            'plate_metallic': ARMOR_SCHEME['plate_metallic'],
            'plate_roughness': ARMOR_SCHEME['plate_roughness'],
            'roles': {
                k: {
                    'name': MARINE_ROLES[k]['name'],
                    'source': SOURCE_GLB_MAP[k],
                    'output': f"{k}.glb",
                    'emissive_color': list(MARINE_ROLES[k].get('emissive_color',
                                          MARINE_ROLES[k]['shoulder_color'])),
                }
                for k in results if results[k]
            },
        }
        manifest_path = output_dir / 'retexture_manifest.json'
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f"\nManifest: {manifest_path}")


if __name__ == '__main__':
    main()
