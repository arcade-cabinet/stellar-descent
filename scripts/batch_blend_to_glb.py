"""
Blender headless script to batch convert .blend files to GLB.

Usage:
    blender --background --python batch_blend_to_glb.py -- /input/dir/ /output/dir/

Note: Each .blend file is opened directly (not imported), then exported as GLB.
"""

import bpy
import os
import sys
from pathlib import Path


def get_args():
    argv = sys.argv
    if "--" in argv:
        return argv[argv.index("--") + 1:]
    return []


def convert_blend_to_glb(blend_path, output_path):
    """Open a .blend file and export all scene content as GLB."""
    try:
        bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    except Exception as e:
        print(f"  ERROR opening {blend_path}: {e}")
        return False

    try:
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format='GLB',
            export_apply=True,
            export_yup=True,
        )
    except Exception as e:
        print(f"  ERROR exporting {output_path}: {e}")
        return False

    return True


def main():
    args = get_args()
    if len(args) < 2:
        print("Usage: blender --background --python batch_blend_to_glb.py -- /input/dir/ /output/dir/")
        sys.exit(1)

    input_dir = Path(args[0])
    output_dir = Path(args[1])
    output_dir.mkdir(parents=True, exist_ok=True)

    blend_files = sorted(input_dir.glob("*.blend"))
    print(f"Found {len(blend_files)} .blend files to convert")

    success = 0
    failed = 0
    for i, blend_path in enumerate(blend_files):
        stem = blend_path.stem
        out_path = output_dir / f"{stem}.glb"
        print(f"[{i+1}/{len(blend_files)}] Converting: {blend_path.name} -> {out_path.name}")
        if convert_blend_to_glb(blend_path, out_path):
            success += 1
        else:
            failed += 1

    print(f"\nConversion complete: {success} success, {failed} failed out of {len(blend_files)} total")


if __name__ == "__main__":
    main()
