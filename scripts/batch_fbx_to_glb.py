"""
Blender headless FBX -> GLB batch converter.
Usage: blender --background --python scripts/batch_fbx_to_glb.py -- /input/dir/ /output/dir/
"""
import bpy
import sys
import os

def get_args():
    argv = sys.argv
    if '--' in argv:
        return argv[argv.index('--') + 1:]
    return []

def convert_fbx_to_glb(input_path, output_path):
    bpy.ops.wm.read_homefile(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=input_path)
    except Exception as e:
        print(f"  ERROR importing: {e}")
        return False
    for obj in list(bpy.data.objects):
        if obj.name in ('Camera', 'Light', 'Cube') and obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    if not any(obj.type == 'MESH' for obj in bpy.data.objects):
        print("  WARNING: No mesh objects")
        return False
    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=False,
            export_apply=True,
        )
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  OK ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  ERROR exporting: {e}")
        return False

def main():
    args = get_args()
    if len(args) < 2:
        print("Usage: blender --background --python batch_fbx_to_glb.py -- /input/dir/ /output/dir/")
        sys.exit(1)
    input_dir = args[0]
    output_dir = args[1]
    os.makedirs(output_dir, exist_ok=True)
    fbx_files = []
    for root, dirs, files in os.walk(input_dir):
        for f in files:
            if f.lower().endswith('.fbx'):
                fbx_files.append(os.path.join(root, f))
    fbx_files.sort()
    print(f"\nConverting {len(fbx_files)} FBX files from {input_dir}...")
    success = 0
    failed = 0
    for i, fbx in enumerate(fbx_files):
        name = os.path.splitext(os.path.basename(fbx))[0]
        output_path = os.path.join(output_dir, f"{name}.glb")
        print(f"  [{i+1}/{len(fbx_files)}] {name}.fbx -> {name}.glb", end=' ', flush=True)
        if convert_fbx_to_glb(fbx, output_path):
            success += 1
        else:
            failed += 1
    print(f"\n=== CONVERSION COMPLETE ===")
    print(f"Success: {success}")
    print(f"Failed: {failed}")
    print(f"Output: {output_dir}")

if __name__ == '__main__':
    main()
