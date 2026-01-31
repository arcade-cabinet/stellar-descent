import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import React, { useEffect, useRef } from 'react';

// Side effect imports - need these for proper ES6 tree-shaking
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/loaders/glTF';
// Import shaders for StandardMaterial to work properly
import '@babylonjs/core/Shaders/default.vertex';
import '@babylonjs/core/Shaders/default.fragment';

import { useGame } from '../game/context/GameContext';
import { getLogger } from '../game/core/Logger';
import { AssetManager } from '../game/core/AssetManager';
import { disposeAudioManager, getAudioManager } from '../game/core/AudioManager';
import { GameManager } from '../game/core/GameManager';
import { getPerformanceManager } from '../game/core/PerformanceManager';
import { defaultLevelFactories } from '../game/levels/factories';
import {
  CAMPAIGN_LEVELS,
  type ILevel,
  type LevelCallbacks,
  type LevelId,
} from '../game/levels/types';
import styles from './GameCanvas.module.css';

// ---------------------------------------------------------------------------
// Rock formation GLB paths (replaces procedural cylinders)
// ---------------------------------------------------------------------------

/** Tall rock pillar GLBs for menu scene background decoration */
const ROCK_FORMATION_GLBS = [
  '/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  '/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  '/models/environment/alien-flora/alien_tall_rock_3_01.glb',
];

// Planet configuration
const PLANET_RADIUS = 6000;

// Starfield shader
const starfieldVertexShader = `
  precision highp float;
  attribute vec3 position;
  uniform mat4 worldViewProjection;
  varying vec3 vPosition;

  void main() {
    vPosition = position;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

const starfieldFragmentShader = `
  precision highp float;
  varying vec3 vPosition;
  uniform float time;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float stars(vec3 ray) {
    vec3 p = ray * 300.0;
    float brightness = 0.0;

    for (float i = 0.0; i < 3.0; i++) {
      vec3 q = fract(p) - 0.5;
      vec3 id = floor(p);
      float h = hash(id);

      float size = 0.02 + h * 0.03;
      float star = smoothstep(size, 0.0, length(q));
      float twinkle = 0.7 + 0.3 * sin(time * (2.0 + h * 4.0) + h * 6.28);
      brightness += star * twinkle * (0.5 + h * 0.5);
      p *= 2.1;
    }

    return brightness;
  }

  float nebula(vec3 ray) {
    float n = 0.0;
    vec3 p = ray * 2.0;

    for (float i = 0.0; i < 4.0; i++) {
      float h = hash(floor(p));
      n += h * smoothstep(0.8, 0.2, length(fract(p) - 0.5));
      p *= 2.0;
    }

    return n * 0.15;
  }

  void main() {
    vec3 ray = normalize(vPosition);
    vec3 color = vec3(0.02, 0.02, 0.04);

    float neb = nebula(ray);
    color += vec3(0.15, 0.05, 0.1) * neb;

    float starBrightness = stars(ray);
    vec3 starColor = mix(
      vec3(1.0, 0.95, 0.9),
      vec3(0.9, 0.95, 1.0),
      hash(ray * 100.0)
    );
    color += starColor * starBrightness;

    // Proxima Centauri - red dwarf sun
    vec3 sunDir = normalize(vec3(0.4, 0.3, -0.5));
    float sunDist = 1.0 - dot(ray, sunDir);

    float corona = exp(-sunDist * 8.0) * 0.5;
    color += vec3(1.0, 0.4, 0.2) * corona;

    float sunDisk = smoothstep(0.03, 0.025, sunDist);
    color += vec3(1.0, 0.6, 0.3) * sunDisk * 2.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Planet surface shader
const planetVertexShader = `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;

  uniform mat4 world;
  uniform mat4 worldViewProjection;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUV;

  void main() {
    vec4 worldPos = world * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(world) * normal);
    vUV = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

const planetFragmentShader = `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUV;

  uniform vec3 sunDirection;
  uniform vec3 cameraPosition;
  uniform sampler2D surfaceTexture;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float dist = length(vWorldPos - cameraPosition);

    vec3 rock1 = vec3(0.6, 0.45, 0.35);
    vec3 rock2 = vec3(0.45, 0.32, 0.25);
    vec3 rust = vec3(0.7, 0.4, 0.25);
    vec3 dust = vec3(0.75, 0.6, 0.45);

    float largeNoise = fbm(vWorldPos.xz * 0.0002);
    float medNoise = fbm(vWorldPos.xz * 0.001);
    float detailNoise = fbm(vWorldPos.xz * 0.01);

    vec3 terrainColor = mix(rock1, rock2, largeNoise);
    terrainColor = mix(terrainColor, rust, medNoise * 0.5);
    terrainColor = mix(terrainColor, dust, detailNoise * 0.2);

    vec3 texColor = texture2D(surfaceTexture, vUV * 200.0).rgb;
    terrainColor *= mix(vec3(0.8), texColor, 0.4);

    float NdotL = max(dot(vNormal, sunDirection), 0.0);
    float ambient = 0.2;
    float diffuse = NdotL * 0.8;

    vec3 litColor = terrainColor * (ambient + diffuse);

    vec3 atmosphereColor = vec3(0.4, 0.25, 0.15);
    float atmosphereDensity = 1.0 - exp(-dist * 0.0003);
    litColor = mix(litColor, atmosphereColor, atmosphereDensity * 0.7);

    float horizonFactor = pow(1.0 - abs(dot(vNormal, normalize(cameraPosition - vWorldPos))), 3.0);
    litColor += vec3(0.3, 0.15, 0.05) * horizonFactor * 0.3;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

import type { CampaignPhase } from '../game/campaign/types';

const log = getLogger('GameCanvas');

/** @deprecated Use CampaignPhase from campaign/types instead */
export type GameState = CampaignPhase;

interface LoadingProgress {
  stage: string;
  progress: number;
  detail?: string;
}

interface GameCanvasProps {
  gameState: GameState;
  startLevelId?: LevelId | null;
  onTutorialComplete: () => void;
  onDropComplete: () => void;
  onLoadingProgress?: (progress: LoadingProgress) => void;
  onLevelChange?: (levelId: LevelId) => void;
  onLevelComplete?: () => void;
}

export function GameCanvas({
  gameState,
  startLevelId,
  onTutorialComplete,
  onDropComplete,
  onLoadingProgress,
  onLevelChange,
  onLevelComplete,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const tutorialLevelRef = useRef<(ILevel & { onCommsDismissed?: () => void }) | null>(null);
  const prevGameStateRef = useRef<GameState>('menu');
  const planetRef = useRef<{
    planet: ReturnType<typeof MeshBuilder.CreateSphere>;
    planetMaterial: StandardMaterial;
  } | null>(null);

  const {
    showNotification,
    setPlayerHealth,
    addKill,
    onDamage,
    touchInput,
    showComms,
    hideComms,
    setObjective,
    commsDismissedFlag,
    setIsCalibrating,
    setCompassData,
    setTutorialPhase,
    setIsTutorialActive,
    addHitMarker,
    addDamageIndicator,
  } = useGame();

  // Track pause state via ref for render loop access
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = gameState === 'paused';
  }, [gameState]);

  // Pass touch input to active level/game
  useEffect(() => {
    if (gameState === 'tutorial' && tutorialLevelRef.current) {
      tutorialLevelRef.current.setTouchInput(touchInput);
    } else if ((gameState === 'playing' || gameState === 'dropping') && gameManagerRef.current) {
      gameManagerRef.current.setTouchInput(touchInput);
    }
  }, [touchInput, gameState]);

  // Notify tutorial level when comms are dismissed
  useEffect(() => {
    if (commsDismissedFlag > 0 && tutorialLevelRef.current?.onCommsDismissed) {
      tutorialLevelRef.current.onCommsDismissed();
    }
  }, [commsDismissedFlag]);

  // Initialize Babylon engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;
    let animationTime = 0;

    async function initEngine() {
      if (!canvas || !mounted) return;

      // Check if mobile for engine options
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const pixelRatio = window.devicePixelRatio || 1;

      const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: false, // Disable for better performance
        stencil: !isMobileDevice, // Disable stencil on mobile
        antialias: !isMobileDevice || pixelRatio < 2, // Disable AA on high-DPI mobile
        powerPreference: isMobileDevice ? 'low-power' : 'high-performance',
        // Limit hardware scaling on high-DPI mobile devices
        adaptToDeviceRatio: !isMobileDevice,
      });

      // On mobile with high-DPI, limit resolution to save GPU
      if (isMobileDevice && pixelRatio > 2) {
        engine.setHardwareScalingLevel(pixelRatio / 2);
      }

      if (!mounted) {
        engine.dispose();
        return;
      }

      engineRef.current = engine;

      const scene = new Scene(engine);
      sceneRef.current = scene;

      // Enable better rendering
      scene.useRightHandedSystem = false;
      scene.clearColor = new Color4(0.01, 0.01, 0.02, 1);

      // Mobile-specific scene optimizations
      if (isMobileDevice) {
        // Reduce update frequency for non-essential systems
        scene.autoClear = true;
        scene.autoClearDepthAndStencil = true;
        // Disable expensive features
        scene.fogEnabled = false;
        scene.lensFlaresEnabled = false;
        scene.probesEnabled = false;
        scene.proceduralTexturesEnabled = false;
        // Aggressive frustum culling
        scene.skipFrustumClipping = false;
      }

      // Initialize audio system
      getAudioManager().initialize(scene);

      // Initialize performance manager for mobile optimizations
      const perfManager = getPerformanceManager();
      perfManager.initialize(engine, scene);

      // Enable debug overlay in development
      if (import.meta.env.DEV) {
        // Uncomment to enable FPS overlay: perfManager.configure({ debugOverlay: true });
      }

      // Register shaders
      Effect.ShadersStore['starfieldVertexShader'] = starfieldVertexShader;
      Effect.ShadersStore['starfieldFragmentShader'] = starfieldFragmentShader;
      Effect.ShadersStore['planetVertexShader'] = planetVertexShader;
      Effect.ShadersStore['planetFragmentShader'] = planetFragmentShader;

      // Starfield skybox - temporarily using solid color to bypass shader error
      const skybox = MeshBuilder.CreateBox('skybox', { size: 10000 }, scene);
      const skyboxMaterial = new StandardMaterial('starfieldMat', scene);
      skyboxMaterial.diffuseColor = Color3.FromHexString('#020204');
      skyboxMaterial.emissiveColor = Color3.FromHexString('#020204');
      skyboxMaterial.specularColor = new Color3(0, 0, 0);
      skyboxMaterial.backFaceCulling = false;
      skybox.material = skyboxMaterial;
      skybox.infiniteDistance = true;

      // Sun direction
      const sunDirection = new Vector3(0.4, 0.3, -0.5).normalize();

      // Lights
      const sunLight = new DirectionalLight('sun', sunDirection.scale(-1), scene);
      sunLight.intensity = 2.5;
      sunLight.diffuse = new Color3(1.0, 0.7, 0.5);
      sunLight.specular = new Color3(1.0, 0.8, 0.6);

      const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
      ambientLight.intensity = 0.35;
      ambientLight.diffuse = new Color3(0.45, 0.4, 0.35);
      ambientLight.groundColor = new Color3(0.2, 0.15, 0.1);

      // Menu camera
      const menuCamera = new FreeCamera('menuCamera', new Vector3(0, 100, -200), scene);
      menuCamera.setTarget(new Vector3(0, 0, 100));
      menuCamera.minZ = 0.1;
      menuCamera.maxZ = 50000;

      // Planet sphere
      const planet = MeshBuilder.CreateSphere(
        'planet',
        {
          diameter: PLANET_RADIUS * 2,
          segments: 128,
        },
        scene
      );
      planet.position.y = -PLANET_RADIUS;

      const surfaceTexture = new Texture('https://assets.babylonjs.com/textures/rock.png', scene);

      // Temporarily use StandardMaterial to bypass shader compilation issue
      const planetMaterial = new StandardMaterial('planetMat', scene);
      planetMaterial.diffuseColor = Color3.FromHexString('#8B6B4A');
      planetMaterial.specularColor = new Color3(0.15, 0.12, 0.1);
      planetMaterial.specularPower = 8;
      planetMaterial.diffuseTexture = surfaceTexture;
      planet.material = planetMaterial;

      planetRef.current = { planet, planetMaterial };

      // Rock formations - load GLB models asynchronously
      // Fire-and-forget load; rocks appear once assets are cached
      (async () => {
        // Preload all rock GLBs
        await Promise.all(
          ROCK_FORMATION_GLBS.map((path) =>
            AssetManager.loadAssetByPath(path, scene).catch((err) => {
              log.warn(`Failed to preload rock GLB ${path}:`, err);
              return null;
            })
          )
        );

        // Create rock formation instances
        const rockNodes: TransformNode[] = [];
        for (let i = 0; i < 60; i++) {
          // Pick a random rock variant
          const glbPath = ROCK_FORMATION_GLBS[i % ROCK_FORMATION_GLBS.length];
          const instanceName = `menuRock_${i}`;

          const rockNode = AssetManager.createInstanceByPath(
            glbPath,
            instanceName,
            scene,
            false, // No LOD for menu background
            'environment'
          );

          if (!rockNode) continue;

          // Random scale to vary heights (replaces height param from cylinders)
          const baseScale = 5 + Math.random() * 15;
          const heightVariance = 0.7 + Math.random() * 0.6;
          rockNode.scaling = new Vector3(
            baseScale * (0.8 + Math.random() * 0.4),
            baseScale * heightVariance * 1.5, // Taller for pillar effect
            baseScale * (0.8 + Math.random() * 0.4)
          );

          // Position in a ring around the scene
          const angle = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 600;
          rockNode.position.x = Math.cos(angle) * dist;
          rockNode.position.z = Math.sin(angle) * dist;
          rockNode.position.y = 0;

          // Random rotation + slight tilt for natural look
          rockNode.rotation.x = (Math.random() - 0.5) * 0.2;
          rockNode.rotation.y = Math.random() * Math.PI * 2;
          rockNode.rotation.z = (Math.random() - 0.5) * 0.2;

          rockNodes.push(rockNode);
        }
        log.info(`Created ${rockNodes.length} rock formation GLB instances`);
      })();

      // Render loop
      engine.runRenderLoop(() => {
        animationTime += engine.getDeltaTime() / 1000;

        // Update performance monitoring (dynamic resolution, FPS tracking)
        perfManager.update();

        // Skip game updates when paused (but still render)
        const isPaused = isPausedRef.current;

        // Update active level/game based on current refs (not state)
        const deltaTime = engine.getDeltaTime() / 1000;

        if (tutorialLevelRef.current) {
          // Only update game logic if not paused
          if (!isPaused) {
            tutorialLevelRef.current.update(deltaTime);
          }
          // Always render the level's own scene (levels create their own scene in ILevel architecture)
          tutorialLevelRef.current.getScene().render();
        } else if (gameManagerRef.current) {
          // Only update game logic if not paused
          if (!isPaused) {
            gameManagerRef.current.update();
          }
          // Always render - GameManager still uses the shared scene
          scene.render();
        } else {
          // Menu state - render the main scene with planet
          scene.render();
        }
      });
    }

    initEngine();

    const handleResize = () => {
      if (engineRef.current) engineRef.current.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mounted = false;
      tutorialLevelRef.current?.dispose();
      tutorialLevelRef.current = null;
      gameManagerRef.current?.dispose();
      gameManagerRef.current = null;
      sceneRef.current?.dispose();
      engineRef.current?.dispose();
      disposeAudioManager();
      // Clean up performance manager
      getPerformanceManager().dispose();
    };
  }, []);

  // Handle loading state - load assets when entering loading state
  useEffect(() => {
    if (gameState !== 'loading') return;

    const scene = sceneRef.current;
    if (!scene) return;

    let cancelled = false;

    async function loadAssets() {
      // Report initial progress
      onLoadingProgress?.({ stage: 'INITIALIZING SYSTEMS', progress: 0 });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;

      // Wait for scene to be ready
      onLoadingProgress?.({ stage: 'PREPARING SCENE', progress: 20 });
      if (scene) await scene.whenReadyAsync();
      if (cancelled) return;

      // Load textures
      onLoadingProgress?.({ stage: 'LOADING TEXTURES', progress: 40 });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;

      // Compile shaders (they compile on first use, trigger by waiting a frame)
      onLoadingProgress?.({ stage: 'COMPILING SHADERS', progress: 60 });
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      if (cancelled) return;

      // Initialize station assets
      onLoadingProgress?.({ stage: 'LOADING STATION ASSETS', progress: 80 });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;

      // Final
      onLoadingProgress?.({ stage: 'SYSTEMS ONLINE', progress: 100 });
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [gameState, onLoadingProgress]);

  // Handle game state changes
  useEffect(() => {
    const scene = sceneRef.current;
    const engine = engineRef.current;
    const canvas = canvasRef.current;

    if (!scene || !engine || !canvas) return;

    const prevState = prevGameStateRef.current;

    // Transition: menu/loading -> tutorial
    if (gameState === 'tutorial' && prevState !== 'tutorial') {
      // Dispose previous game manager if exists
      if (gameManagerRef.current) {
        gameManagerRef.current.dispose();
        gameManagerRef.current = null;
      }

      // Notify level change
      onLevelChange?.('anchor_station');

      // Create tutorial level with ILevel-compliant interface
      // Set tutorial as active
      setIsTutorialActive(true);
      setTutorialPhase(0);

      // Build LevelCallbacks for the ILevel interface
      const levelCallbacks: LevelCallbacks = {
        onCommsMessage: (msg) => {
          log.debug(
            'onCommsMessage callback, showing comms:',
            msg.text?.substring(0, 40)
          );
          showComms(msg);
        },
        onObjectiveUpdate: (title, instructions) => {
          setObjective(title, instructions);
        },
        onChapterChange: (_chapter) => {
          // Tutorial level is chapter 1
        },
        onHealthChange: setPlayerHealth,
        onKill: addKill,
        onDamage: onDamage,
        onNotification: showNotification,
        onLevelComplete: (_nextLevelId) => {
          // Tutorial complete - transition to next state
          setIsTutorialActive(false);
          onTutorialComplete();
        },
        onCombatStateChange: (_inCombat) => {
          // Tutorial doesn't track combat state
        },
        onActionGroupsChange: (_groups) => {
          // Action buttons handled by level internally
        },
        onActionHandlerRegister: (_handler) => {
          // Action handler registration
        },
        onHitMarker: (damage, isCritical, isKill) => {
          addHitMarker(damage, isCritical, isKill);
        },
        onDirectionalDamage: (angle, damage) => {
          addDamageIndicator(angle, damage);
        },
      };

      // Use factory system to create the tutorial level
      const levelConfig = CAMPAIGN_LEVELS.anchor_station;
      const factory = defaultLevelFactories[levelConfig.type];
      log.info(
        `Creating level via factory: ${levelConfig.id} (type: ${levelConfig.type})`
      );
      tutorialLevelRef.current = factory(engine, canvas, levelConfig, levelCallbacks);
      log.debug('Calling initialize()');
      tutorialLevelRef.current
        .initialize()
        .then(() => {
          log.info('initialize() completed');
        })
        .catch((e) => {
          log.error('initialize() failed:', e);
        });
    }

    // Transition: tutorial -> dropping OR menu -> dropping (skip)
    if (gameState === 'dropping' && prevState !== 'dropping' && prevState !== 'playing') {
      // Clean up tutorial
      if (tutorialLevelRef.current) {
        tutorialLevelRef.current.dispose();
        tutorialLevelRef.current = null;
      }
      hideComms();
      setObjective('', '');

      // Determine which level to load
      const dropLevelId: LevelId = (startLevelId as LevelId) || 'landfall';
      onLevelChange?.(dropLevelId);

      // Create game manager for surface gameplay (Landfall uses GameManager for HALO drop)
      if (!gameManagerRef.current) {
        gameManagerRef.current = new GameManager(scene, engine, canvas, {
          onHealthChange: setPlayerHealth,
          onKill: addKill,
          onDamage: onDamage,
          onNotification: showNotification,
          onCompassUpdate: setCompassData,
          onHitMarker: addHitMarker,
          onDirectionalDamage: addDamageIndicator,
        });
        gameManagerRef.current.initialize();
      }

      showNotification('ORBITAL DROP INITIATED', 4000);
    }

    // Transition: loading -> playing (for levels beyond tutorial/landfall)
    if (gameState === 'playing' && prevState !== 'playing' && prevState !== 'dropping') {
      // For non-tutorial, non-drop levels, create the level via factory
      const levelId = startLevelId as LevelId;
      if (levelId && levelId !== 'anchor_station' && levelId !== 'landfall') {
        // Clean up any existing level
        if (tutorialLevelRef.current) {
          tutorialLevelRef.current.dispose();
          tutorialLevelRef.current = null;
        }
        if (gameManagerRef.current) {
          gameManagerRef.current.dispose();
          gameManagerRef.current = null;
        }

        onLevelChange?.(levelId);

        const levelConfig = CAMPAIGN_LEVELS[levelId];
        const factory = defaultLevelFactories[levelConfig.type];
        const levelCallbacks: LevelCallbacks = {
          onCommsMessage: (msg) => showComms(msg),
          onObjectiveUpdate: (title, instructions) => setObjective(title, instructions),
          onChapterChange: (_chapter) => {},
          onHealthChange: setPlayerHealth,
          onKill: addKill,
          onDamage: onDamage,
          onNotification: showNotification,
          onLevelComplete: (_nextLevelId) => {
            onLevelComplete?.();
          },
          onCombatStateChange: (_inCombat) => {},
          onActionGroupsChange: (_groups) => {},
          onActionHandlerRegister: (_handler) => {},
          onHitMarker: (damage, isCritical, isKill) => addHitMarker(damage, isCritical, isKill),
          onDirectionalDamage: (angle, damage) => addDamageIndicator(angle, damage),
        };

        log.info(
          `Creating level via factory: ${levelId} (type: ${levelConfig.type})`
        );
        tutorialLevelRef.current = factory(engine, canvas, levelConfig, levelCallbacks);
        tutorialLevelRef.current
          .initialize()
          .then(() => {
            log.info(`Level ${levelId} initialized`);
          })
          .catch((e) => {
            log.error(`Level ${levelId} initialization failed:`, e);
          });
      }
    }

    // Transition: dropping -> playing
    if (gameState === 'playing' && prevState === 'dropping') {
      // The GameManager handles the drop sequence internally
      // Just update the state tracking
    }

    prevGameStateRef.current = gameState;
  }, [
    gameState,
    startLevelId,
    setPlayerHealth,
    addKill,
    onDamage,
    showNotification,
    showComms,
    hideComms,
    setObjective,
    onTutorialComplete,
    onLevelComplete,
    setIsCalibrating,
    onLevelChange,
    setCompassData,
    setTutorialPhase,
    setIsTutorialActive,
    addHitMarker,
    addDamageIndicator,
  ]);

  return (
    <canvas ref={canvasRef} className={styles.canvas} onContextMenu={(e) => e.preventDefault()} />
  );
}
