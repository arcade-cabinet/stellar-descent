#!/usr/bin/env python3
"""
convert-weapons.py - Convert FBX weapon assets to GLB for FPS view

Source: ~/assets/Quaternius/FPS/Ultimate Gun Pack - July 2019/FBX/
Target: public/assets/models/props/weapons/fps_*.glb

Run with: blender --background --python scripts/convert-weapons.py
"""

import bpy
import os
import sys

# Mapping: fps_<name>.glb -> source FBX basename
WEAPON_MAP = {
    # Assault Rifles
    "fps_assault_rifle": "AssaultRifle_1",
    "fps_battle_rifle": "AssaultRifle2_1",
    "fps_burst_rifle": "AssaultRifle_2",
    "fps_burst_rifle_n94": "AssaultRifle_3",
    "fps_carbine": "AssaultRifle_4",
    "fps_suppressed_carbine": "AssaultRifle2_2",
    "fps_semiauto_dmr": "AssaultRifle_5",

    # Pistols
    "fps_sidearm": "Pistol_4",
    "fps_classic_pistol": "Pistol_1",
    "fps_heavy_pistol": "Pistol_3",
    "fps_auto_pistol": "Pistol_2",
    "fps_revolver": "Revolver_2",
    "fps_revolver_shotgun": "Revolver_1",

    # SMGs
    "fps_pulse_smg": "SubmachineGun_2",
    "fps_pdw": "SubmachineGun_1",
    "fps_smg_mp5": "SubmachineGun_3",
    "fps_smg_ump": "SubmachineGun_4",

    # Shotguns
    "fps_auto_shotgun": "Shotgun_1",
    "fps_double_barrel": "Shotgun_SawedOff",
    "fps_tactical_shotgun": "Shotgun_3",
    "fps_tactical_shotgun_s12": "Shotgun_2",

    # Snipers
    "fps_sniper_rifle": "SniperRifle_1",
    "fps_bolt_sniper": "SniperRifle_1",
    "fps_dmr": "SniperRifle_2",
    "fps_dmr_precision": "SniperRifle_3",
    "fps_longrange_sniper": "SniperRifle_4",
    "fps_marksman_rifle": "SniperRifle_5",
    "fps_precision_sniper": "SniperRifle_6",
    "fps_tactical_sniper": "SniperRifle_3",
    "fps_urban_sniper": "SniperRifle_4",

    # Heavy / LMG
    "fps_bullpup_lmg": "Bullpup_1",
    "fps_heavy_lmg": "Bullpup_2",
    "fps_saw_lmg": "Bullpup_1",
    "fps_support_lmg": "Bullpup_2",
    "fps_plasma_cannon": "Bullpup_3",
}

# Attachments: target -> (source_dir, source_file)
ATTACHMENT_MAP = {
    "attachment_combat_scope": ("Accessories", "Scope_1"),
    "attachment_sniper_sight": ("Accessories", "Scope_3"),
    "attachment_diagonal_grip": ("Accessories", "Grip"),
    "attachment_holo_sight": ("Accessories", "Scope_2"),
}

# Ammo boxes: target -> source GLB path (Kenney already has GLBs)
AMMO_MAP = {
    "ammo_box_556": "~/assets/Kenney/3D assets/Weapon Pack/Models/GLTF format/ammo_machinegun.glb",
    "ammo_box_9mm": "~/assets/Kenney/3D assets/Weapon Pack/Models/GLTF format/ammo_uzi.glb",
    "ammo_box_762": "~/assets/Kenney/3D assets/Weapon Pack/Models/GLTF format/ammo_sniper.glb",
    "ammo_box_12gauge": "~/assets/Kenney/3D assets/Weapon Pack/Models/GLTF format/ammo_shotgun.glb",
}

# Paths
SOURCE_DIR = os.path.expanduser("~/assets/Quaternius/FPS/Ultimate Gun Pack - July 2019/FBX")
TARGET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public/assets/models/props/weapons")


def clear_scene():
    """Remove all objects from scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def convert_weapon(target_name: str, source_name: str) -> bool:
    """Convert a single FBX to GLB."""
    source_path = os.path.join(SOURCE_DIR, f"{source_name}.fbx")
    target_path = os.path.join(TARGET_DIR, f"{target_name}.glb")

    if not os.path.exists(source_path):
        print(f"ERROR: Source not found: {source_path}")
        return False

    print(f"Converting: {source_name}.fbx -> {target_name}.glb")

    # Clear scene
    clear_scene()

    # Import FBX
    bpy.ops.import_scene.fbx(filepath=source_path)

    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=target_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
    )

    # Verify output
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        size = os.path.getsize(target_path)
        print(f"  SUCCESS: {target_path} ({size:,} bytes)")
        return True
    else:
        print(f"  FAILED: Output file empty or missing")
        return False


def convert_attachment(target_name: str, subdir: str, source_name: str) -> bool:
    """Convert an attachment FBX to GLB."""
    source_path = os.path.join(SOURCE_DIR, subdir, f"{source_name}.fbx")
    target_path = os.path.join(TARGET_DIR, f"{target_name}.glb")

    if not os.path.exists(source_path):
        print(f"ERROR: Source not found: {source_path}")
        return False

    print(f"Converting: {subdir}/{source_name}.fbx -> {target_name}.glb")

    clear_scene()
    bpy.ops.import_scene.fbx(filepath=source_path)
    bpy.ops.export_scene.gltf(
        filepath=target_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
    )

    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        size = os.path.getsize(target_path)
        print(f"  SUCCESS: {target_path} ({size:,} bytes)")
        return True
    else:
        print(f"  FAILED: Output file empty or missing")
        return False


def copy_ammo(target_name: str, source_path: str) -> bool:
    """Copy a GLB file directly (for Kenney assets that are already GLB)."""
    import shutil
    source_path = os.path.expanduser(source_path)
    target_path = os.path.join(TARGET_DIR, f"{target_name}.glb")

    if not os.path.exists(source_path):
        print(f"ERROR: Source not found: {source_path}")
        return False

    print(f"Copying: {os.path.basename(source_path)} -> {target_name}.glb")

    shutil.copy2(source_path, target_path)

    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        size = os.path.getsize(target_path)
        print(f"  SUCCESS: {target_path} ({size:,} bytes)")
        return True
    else:
        print(f"  FAILED: Copy failed")
        return False


def main():
    print("=" * 60)
    print("FPS Weapon Conversion")
    print("=" * 60)
    print(f"Source: {SOURCE_DIR}")
    print(f"Target: {TARGET_DIR}")
    print()

    if not os.path.exists(SOURCE_DIR):
        print(f"ERROR: Source directory not found: {SOURCE_DIR}")
        sys.exit(1)

    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR, exist_ok=True)

    success = 0
    failed = 0

    # Convert weapons
    print("\n--- FPS Weapons ---")
    for target_name, source_name in WEAPON_MAP.items():
        if convert_weapon(target_name, source_name):
            success += 1
        else:
            failed += 1

    # Convert attachments
    print("\n--- Attachments ---")
    for target_name, (subdir, source_name) in ATTACHMENT_MAP.items():
        if convert_attachment(target_name, subdir, source_name):
            success += 1
        else:
            failed += 1

    # Copy ammo boxes (already GLB)
    print("\n--- Ammo Boxes ---")
    for target_name, source_path in AMMO_MAP.items():
        if copy_ammo(target_name, source_path):
            success += 1
        else:
            failed += 1

    print()
    print("=" * 60)
    print(f"Conversion complete: {success} success, {failed} failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
