"""
Blender headless GLB audit script.
Usage: blender --background --python scripts/audit_glbs.py -- /path/to/models/
"""
import bpy
import sys
import json
import os
import mathutils

def get_args():
    argv = sys.argv
    if '--' in argv:
        return argv[argv.index('--') + 1:]
    return []

def audit_glb(filepath):
    bpy.ops.wm.read_homefile(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=filepath)
    except Exception as e:
        return {'file': filepath, 'error': str(e), 'status': 'IMPORT_FAILED'}

    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    armatures = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']

    if not meshes:
        return {'file': filepath, 'status': 'NO_GEOMETRY', 'object_count': len(bpy.data.objects)}

    total_verts = 0
    total_faces = 0
    min_corner = [float('inf')] * 3
    max_corner = [float('-inf')] * 3
    has_uvs = False
    material_count = 0
    material_names = []

    for obj in meshes:
        mesh = obj.data
        total_verts += len(mesh.vertices)
        total_faces += len(mesh.polygons)
        if mesh.uv_layers:
            has_uvs = True
        for mat in obj.data.materials:
            if mat:
                material_count += 1
                material_names.append(mat.name)
        for v in obj.bound_box:
            world_v = obj.matrix_world @ mathutils.Vector(v)
            for i in range(3):
                min_corner[i] = min(min_corner[i], world_v[i])
                max_corner[i] = max(max_corner[i], world_v[i])

    bbox_size = [max_corner[i] - min_corner[i] for i in range(3)]
    max_dim = max(bbox_size)
    status = 'OK'
    warnings = []
    file_size = os.path.getsize(filepath)

    if max_dim < 0.01:
        status = 'TINY'
        warnings.append(f'Max dimension is {max_dim:.6f} - model appears tiny')
    elif max_dim < 0.1:
        warnings.append(f'Small model: max dimension {max_dim:.4f}')
    elif max_dim > 100:
        warnings.append(f'Large model: max dimension {max_dim:.2f}')
    if not has_uvs:
        warnings.append('No UV maps found')
    if material_count == 0:
        warnings.append('No materials assigned')
    if total_verts < 10:
        warnings.append(f'Very low vertex count: {total_verts}')
    if warnings and status == 'OK':
        status = 'WARNING'

    return {
        'file': filepath,
        'filename': os.path.basename(filepath),
        'file_size_kb': round(file_size / 1024, 1),
        'status': status,
        'warnings': warnings,
        'mesh_count': len(meshes),
        'armature_count': len(armatures),
        'total_vertices': total_verts,
        'total_faces': total_faces,
        'has_uvs': has_uvs,
        'material_count': material_count,
        'materials': list(set(material_names)),
        'bbox_size': [round(s, 4) for s in bbox_size],
        'max_dimension': round(max_dim, 4),
    }

def main():
    args = get_args()
    if not args:
        print("Usage: blender --background --python audit_glbs.py -- /path/to/models/")
        sys.exit(1)
    models_dir = args[0]
    output_file = args[1] if len(args) > 1 else os.path.join(os.path.dirname(models_dir), 'asset-quality-report.json')
    glb_files = []
    for root, dirs, files in os.walk(models_dir):
        for f in files:
            if f.lower().endswith('.glb'):
                glb_files.append(os.path.join(root, f))
    glb_files.sort()
    print(f"\nAuditing {len(glb_files)} GLB files in {models_dir}...")
    results = []
    issues = []
    for i, glb in enumerate(glb_files):
        print(f"  [{i+1}/{len(glb_files)}] {os.path.basename(glb)}...", end=' ', flush=True)
        result = audit_glb(glb)
        results.append(result)
        if result['status'] != 'OK':
            print(f"[{result['status']}]")
            issues.append(result)
        else:
            print("OK")
    summary = {
        'total_files': len(glb_files),
        'ok': sum(1 for r in results if r['status'] == 'OK'),
        'warnings': sum(1 for r in results if r['status'] == 'WARNING'),
        'tiny': sum(1 for r in results if r['status'] == 'TINY'),
        'no_geometry': sum(1 for r in results if r['status'] == 'NO_GEOMETRY'),
        'import_failed': sum(1 for r in results if r['status'] == 'IMPORT_FAILED'),
    }
    report = {'summary': summary, 'issues': issues, 'all_results': results}
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n=== AUDIT SUMMARY ===")
    print(f"Total: {summary['total_files']}")
    print(f"OK: {summary['ok']}")
    print(f"Warnings: {summary['warnings']}")
    print(f"Tiny: {summary['tiny']}")
    print(f"No geometry: {summary['no_geometry']}")
    print(f"Import failed: {summary['import_failed']}")
    print(f"\nReport written to: {output_file}")

if __name__ == '__main__':
    main()
