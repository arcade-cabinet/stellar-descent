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
import { Scene } from '@babylonjs/core/scene';
import React, { useEffect, useRef } from 'react';

// Side effect imports
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/loaders/glTF';

import { useGame } from '../game/context/GameContext';
import { disposeAudioManager, getAudioManager } from '../game/core/AudioManager';
import { GameManager } from '../game/core/GameManager';
import { AnchorStationLevel } from '../game/levels/anchor-station';
import styles from './GameCanvas.module.css';

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

type GameState = 'menu' | 'loading' | 'tutorial' | 'dropping' | 'playing' | 'paused' | 'gameover';

interface LoadingProgress {
  stage: string;
  progress: number;
  detail?: string;
}

interface GameCanvasProps {
  gameState: GameState;
  onTutorialComplete: () => void;
  onDropComplete: () => void;
  onLoadingProgress?: (progress: LoadingProgress) => void;
}

export function GameCanvas({
  gameState,
  onTutorialComplete,
  onDropComplete,
  onLoadingProgress,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const tutorialLevelRef = useRef<AnchorStationLevel | null>(null);
  const prevGameStateRef = useRef<GameState>('menu');
  const planetRef = useRef<any>(null);

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
  } = useGame();

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
    if (commsDismissedFlag > 0 && tutorialLevelRef.current) {
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

      const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
      });

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

      // Initialize audio system
      getAudioManager().initialize(scene);

      // Register shaders
      Effect.ShadersStore['starfieldVertexShader'] = starfieldVertexShader;
      Effect.ShadersStore['starfieldFragmentShader'] = starfieldFragmentShader;
      Effect.ShadersStore['planetVertexShader'] = planetVertexShader;
      Effect.ShadersStore['planetFragmentShader'] = planetFragmentShader;

      // Starfield skybox
      const skybox = MeshBuilder.CreateBox('skybox', { size: 10000 }, scene);
      const skyboxMaterial = new ShaderMaterial(
        'starfieldMat',
        scene,
        {
          vertex: 'starfield',
          fragment: 'starfield',
        },
        {
          attributes: ['position'],
          uniforms: ['worldViewProjection', 'time'],
        }
      );
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

      const planetMaterial = new ShaderMaterial(
        'planetMat',
        scene,
        {
          vertex: 'planet',
          fragment: 'planet',
        },
        {
          attributes: ['position', 'normal', 'uv'],
          uniforms: ['world', 'worldViewProjection', 'sunDirection', 'cameraPosition'],
          samplers: ['surfaceTexture'],
        }
      );

      planetMaterial.setVector3('sunDirection', sunDirection);
      planetMaterial.setVector3('cameraPosition', menuCamera.position);
      planetMaterial.setTexture('surfaceTexture', surfaceTexture);
      planet.material = planetMaterial;

      planetRef.current = { planet, planetMaterial };

      // Rock formations
      const rockMat = new StandardMaterial('rockMat', scene);
      rockMat.diffuseColor = Color3.FromHexString('#5C4A3A');
      rockMat.specularColor = new Color3(0.1, 0.08, 0.06);

      for (let i = 0; i < 60; i++) {
        const height = 20 + Math.random() * 100;
        const rock = MeshBuilder.CreateCylinder(
          `rock_${i}`,
          {
            height: height,
            diameterTop: 2 + Math.random() * 8,
            diameterBottom: 8 + Math.random() * 20,
            tessellation: 6,
          },
          scene
        );

        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 600;
        rock.position.x = Math.cos(angle) * dist;
        rock.position.z = Math.sin(angle) * dist;
        rock.position.y = height / 2;
        rock.rotation.y = Math.random() * Math.PI;
        rock.material = rockMat;
      }

      // Render loop
      engine.runRenderLoop(() => {
        animationTime += engine.getDeltaTime() / 1000;

        skyboxMaterial.setFloat('time', animationTime);

        if (planetRef.current && scene.activeCamera) {
          planetRef.current.planetMaterial.setVector3(
            'cameraPosition',
            scene.activeCamera.position
          );
        }

        // Update active level/game based on current refs (not state)
        const deltaTime = engine.getDeltaTime() / 1000;

        if (tutorialLevelRef.current) {
          tutorialLevelRef.current.update(deltaTime);
        }

        if (gameManagerRef.current) {
          gameManagerRef.current.update();
        }

        scene.render();
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

      // Create tutorial level
      tutorialLevelRef.current = new AnchorStationLevel(scene, engine, canvas, {
        onCommsMessage: (msg) => {
          showComms(msg);
        },
        onObjectiveUpdate: (title, instructions) => {
          setObjective(title, instructions);
        },
        onTutorialComplete: () => {
          onTutorialComplete();
        },
        onNotification: showNotification,
        onCalibrationStart: () => setIsCalibrating(true),
        onCalibrationEnd: () => setIsCalibrating(false),
      });
      tutorialLevelRef.current.initialize();
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

      // Create game manager for surface gameplay
      if (!gameManagerRef.current) {
        gameManagerRef.current = new GameManager(scene, engine, canvas, {
          onHealthChange: setPlayerHealth,
          onKill: addKill,
          onDamage: onDamage,
          onNotification: showNotification,
        });
        gameManagerRef.current.initialize();
      }

      showNotification('ORBITAL DROP INITIATED', 4000);
    }

    // Transition: dropping -> playing
    if (gameState === 'playing' && prevState === 'dropping') {
      // The GameManager handles the drop sequence internally
      // Just update the state tracking
    }

    prevGameStateRef.current = gameState;
  }, [
    gameState,
    setPlayerHealth,
    addKill,
    onDamage,
    showNotification,
    showComms,
    hideComms,
    setObjective,
    onTutorialComplete,
    setIsCalibrating,
  ]);

  return (
    <canvas ref={canvasRef} className={styles.canvas} onContextMenu={(e) => e.preventDefault()} />
  );
}
