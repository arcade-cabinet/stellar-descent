import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
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
  cautionMat.emissiveColor = Color3.FromHexString('#332200'); // Slight glow for visibility
  materials.set('caution', cautionMat);

  // Space window material - shows planet Alpha-7 and stars
  const spaceWindowMat = createSpaceWindowMaterial(scene);
  materials.set('spaceWindow', spaceWindowMat);

  // Holodeck material - glowing blue-cyan for VR training platforms
  const holodeckMat = new StandardMaterial('holodeckMat', scene);
  holodeckMat.diffuseColor = Color3.FromHexString('#102040');
  holodeckMat.emissiveColor = Color3.FromHexString('#0066AA');
  holodeckMat.alpha = 0.85;
  holodeckMat.backFaceCulling = false;
  materials.set('holodeck', holodeckMat);

  // Interactive metal for buttons and levers
  const interactiveMat = new StandardMaterial('interactiveMat', scene);
  interactiveMat.diffuseColor = Color3.FromHexString('#404550');
  interactiveMat.specularColor = new Color3(0.6, 0.6, 0.6);
  interactiveMat.specularPower = 48;
  materials.set('interactive', interactiveMat);

  // Warning material - pulsing amber
  const warningMat = new StandardMaterial('warningMat', scene);
  warningMat.diffuseColor = Color3.FromHexString('#804000');
  warningMat.emissiveColor = Color3.FromHexString('#FF6600');
  materials.set('warning', warningMat);

  // Target material - bright red for shooting range
  const targetMat = new StandardMaterial('targetMat', scene);
  targetMat.diffuseColor = Color3.FromHexString('#401010');
  targetMat.emissiveColor = Color3.FromHexString('#FF2020');
  materials.set('target', targetMat);

  return materials;
}

/**
 * Create a dynamic texture showing planet Alpha-7 and stars
 * This is used for sealed windows that show the view from orbit
 */
function createSpaceWindowMaterial(scene: Scene): StandardMaterial {
  const textureSize = 512;
  const dynamicTexture = new DynamicTexture(
    'spaceWindowTexture',
    { width: textureSize, height: textureSize },
    scene,
    false
  );

  const ctx = dynamicTexture.getContext();

  // Draw space background - deep blue-black
  const gradient = ctx.createLinearGradient(0, 0, 0, textureSize);
  gradient.addColorStop(0, '#020208');
  gradient.addColorStop(0.3, '#040410');
  gradient.addColorStop(0.5, '#030308');
  gradient.addColorStop(1, '#010105');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Draw stars - small white/blue dots
  const starCount = 150;
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * textureSize;
    const y = Math.random() * textureSize * 0.6; // Stars in upper portion
    const brightness = 0.3 + Math.random() * 0.7;
    const size = 0.5 + Math.random() * 1.5;

    // Star color varies from white to slight blue/yellow
    const colorVariant = Math.random();
    let r: number, g: number, b: number;
    if (colorVariant < 0.7) {
      // White stars
      r = g = b = brightness;
    } else if (colorVariant < 0.85) {
      // Blue-ish stars
      r = brightness * 0.7;
      g = brightness * 0.8;
      b = brightness;
    } else {
      // Yellow-ish stars
      r = brightness;
      g = brightness * 0.95;
      b = brightness * 0.7;
    }

    ctx.fillStyle = `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw planet Alpha-7 - red/orange Mars-like surface
  const planetCenterX = textureSize * 0.5;
  const planetCenterY = textureSize * 1.1; // Planet rises from bottom
  const planetRadius = textureSize * 0.55;

  // Planet base gradient - red/orange tones
  const planetGradient = ctx.createRadialGradient(
    planetCenterX - planetRadius * 0.3,
    planetCenterY - planetRadius * 0.3,
    0,
    planetCenterX,
    planetCenterY,
    planetRadius
  );
  planetGradient.addColorStop(0, '#C4562A'); // Light rust
  planetGradient.addColorStop(0.3, '#A64420'); // Medium rust
  planetGradient.addColorStop(0.6, '#8B3618'); // Darker rust
  planetGradient.addColorStop(0.85, '#6B280F'); // Dark edge
  planetGradient.addColorStop(1, '#3A1508'); // Very dark edge (shadow)

  ctx.fillStyle = planetGradient;
  ctx.beginPath();
  ctx.arc(planetCenterX, planetCenterY, planetRadius, 0, Math.PI * 2);
  ctx.fill();

  // Add atmosphere glow on the lit side
  const atmosphereGradient = ctx.createRadialGradient(
    planetCenterX - planetRadius * 0.2,
    planetCenterY - planetRadius * 0.2,
    planetRadius * 0.85,
    planetCenterX,
    planetCenterY,
    planetRadius * 1.05
  );
  atmosphereGradient.addColorStop(0, 'rgba(255, 180, 120, 0)');
  atmosphereGradient.addColorStop(0.5, 'rgba(255, 150, 100, 0.15)');
  atmosphereGradient.addColorStop(1, 'rgba(200, 100, 50, 0)');

  ctx.fillStyle = atmosphereGradient;
  ctx.beginPath();
  ctx.arc(planetCenterX, planetCenterY, planetRadius * 1.05, 0, Math.PI * 2);
  ctx.fill();

  // Add surface features - darker patches (craters/volcanic regions)
  // Using arc instead of ellipse for compatibility with Babylon.js ICanvasRenderingContext
  const featureCount = 12;
  for (let i = 0; i < featureCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * planetRadius * 0.7;
    const fx = planetCenterX + Math.cos(angle) * dist;
    const fy = planetCenterY + Math.sin(angle) * dist;
    const fRadius = 10 + Math.random() * 25;

    // Only draw if within visible planet area
    const distFromCenter = Math.sqrt((fx - planetCenterX) ** 2 + (fy - planetCenterY) ** 2);
    if (distFromCenter + fRadius < planetRadius * 0.9) {
      ctx.fillStyle = `rgba(60, 30, 15, ${0.2 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Add some lighter highlands
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI - Math.PI / 2; // Prefer lit side
    const dist = Math.random() * planetRadius * 0.6;
    const fx = planetCenterX + Math.cos(angle) * dist;
    const fy = planetCenterY + Math.sin(angle) * dist;
    const fRadius = 15 + Math.random() * 30;

    const distFromCenter = Math.sqrt((fx - planetCenterX) ** 2 + (fy - planetCenterY) ** 2);
    if (distFromCenter + fRadius < planetRadius * 0.85) {
      ctx.fillStyle = `rgba(220, 150, 100, ${0.15 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(fx, fy, fRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Update the texture
  dynamicTexture.update();

  // Create material using this texture
  const mat = new StandardMaterial('spaceWindowMat', scene);
  mat.diffuseTexture = dynamicTexture;
  mat.emissiveTexture = dynamicTexture;
  mat.emissiveColor = new Color3(0.15, 0.12, 0.1); // Slight glow
  mat.specularColor = new Color3(0.1, 0.1, 0.12);
  mat.specularPower = 64;

  return mat;
}

export function disposeMaterials(materials: Map<string, StandardMaterial>): void {
  for (const [, mat] of materials) {
    mat.dispose();
  }
  materials.clear();
}
