import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { tokens } from '../../utils/designTokens';

// All materials for the space station - industrial, pipes, perspex windows
export function createStationMaterials(scene: Scene): Map<string, StandardMaterial> {
  const materials = new Map<string, StandardMaterial>();

  // Main hull - dark gunmetal
  const hullMat = new StandardMaterial('hullMat', scene);
  hullMat.diffuseColor = Color3.FromHexString('#1A1D21');
  hullMat.specularColor = new Color3(0.3, 0.3, 0.35);
  hullMat.specularPower = 32;
  materials.set('hull', hullMat);

  // Floor - industrial grating
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseColor = Color3.FromHexString('#2A2D31');
  floorMat.specularColor = new Color3(0.2, 0.2, 0.2);
  materials.set('floor', floorMat);

  // Pipes - copper/bronze accent
  const pipeMat = new StandardMaterial('pipeMat', scene);
  pipeMat.diffuseColor = Color3.FromHexString('#8B6914');
  pipeMat.specularColor = new Color3(0.5, 0.4, 0.2);
  pipeMat.specularPower = 64;
  materials.set('pipe', pipeMat);

  // Perspex windows - slight blue tint, see-through
  const windowMat = new StandardMaterial('windowMat', scene);
  windowMat.diffuseColor = Color3.FromHexString('#1A3040');
  windowMat.alpha = 0.25;
  windowMat.specularColor = new Color3(0.8, 0.9, 1.0);
  windowMat.specularPower = 128;
  materials.set('window', windowMat);

  // Window frame - darker metal
  const windowFrameMat = new StandardMaterial('windowFrameMat', scene);
  windowFrameMat.diffuseColor = Color3.FromHexString('#0D0F11');
  windowFrameMat.specularColor = new Color3(0.4, 0.4, 0.4);
  materials.set('windowFrame', windowFrameMat);

  // Emergency lighting - red accents
  const emergencyMat = new StandardMaterial('emergencyMat', scene);
  emergencyMat.emissiveColor = Color3.FromHexString('#FF2020');
  emergencyMat.diffuseColor = Color3.FromHexString('#400000');
  materials.set('emergency', emergencyMat);

  // Active systems - green glow
  const activeMat = new StandardMaterial('activeMat', scene);
  activeMat.emissiveColor = Color3.FromHexString('#00FF40');
  activeMat.diffuseColor = Color3.FromHexString('#002010');
  materials.set('active', activeMat);

  // Drop pod - military olive
  const podMat = new StandardMaterial('podMat', scene);
  podMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
  podMat.specularColor = new Color3(0.2, 0.2, 0.15);
  materials.set('pod', podMat);

  // Guide line on floor - yellow stripe
  const guideMat = new StandardMaterial('guideMat', scene);
  guideMat.emissiveColor = Color3.FromHexString('#FFD700');
  guideMat.diffuseColor = Color3.FromHexString('#3A3000');
  guideMat.alpha = 0.8;
  materials.set('guide', guideMat);

  // Screen glow - blue displays
  const screenMat = new StandardMaterial('screenMat', scene);
  screenMat.emissiveColor = Color3.FromHexString('#003366');
  screenMat.diffuseColor = Color3.FromHexString('#001122');
  materials.set('screen', screenMat);

  // Caution stripes - yellow/black
  const cautionMat = new StandardMaterial('cautionMat', scene);
  cautionMat.diffuseColor = Color3.FromHexString('#CCAA00');
  materials.set('caution', cautionMat);

  return materials;
}

export function disposeMaterials(materials: Map<string, StandardMaterial>): void {
  for (const [, mat] of materials) {
    mat.dispose();
  }
  materials.clear();
}
