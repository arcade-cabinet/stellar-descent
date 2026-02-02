import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Minimap.module.css';

/**
 * Entity position in world space
 */
interface EntityPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Enemy blip on the minimap
 */
export interface MinimapEnemy {
  id: string;
  position: EntityPosition;
  type: 'chitin' | 'warrior' | 'spitter' | 'queen' | 'mech' | 'vehicle';
  isAlerted?: boolean;
}

/**
 * Objective marker on the minimap
 */
export interface MinimapObjective {
  id: string;
  position: EntityPosition;
  isActive: boolean;
  type?: 'main' | 'optional' | 'waypoint';
  label?: string;
}

/**
 * Ally position on the minimap
 */
export interface MinimapAlly {
  id: string;
  position: EntityPosition;
  name: string;
  isMarcus?: boolean;
}

/**
 * Terrain structure for optional outline rendering
 */
export interface MinimapStructure {
  id: string;
  points: Array<{ x: number; z: number }>;
  type: 'wall' | 'building' | 'obstacle';
}

export interface MinimapProps {
  /** Player position in world space */
  playerPosition: EntityPosition;
  /** Player heading in radians (0 = North/+Z, positive = clockwise) */
  playerHeading: number;
  /** Enemy positions and types */
  enemies?: MinimapEnemy[];
  /** Objective markers */
  objectives?: MinimapObjective[];
  /** Allied unit positions */
  allies?: MinimapAlly[];
  /** Optional terrain/structure outlines */
  structures?: MinimapStructure[];
  /** Minimap radius in world units (default: 50) */
  range?: number;
  /** Whether the map rotates with player heading (default: true) */
  rotateWithPlayer?: boolean;
  /** Size of the minimap in pixels (default: 150) */
  size?: number;
  /** Whether minimap is visible */
  visible?: boolean;
  /** Enable expanded/zoomed view on touch */
  allowExpand?: boolean;
}

// Update throttle interval (ms) - targets ~12-15 FPS
const UPDATE_INTERVAL = 75;

// Blip sizes
const PLAYER_BLIP_SIZE = 8;
const ENEMY_BLIP_SIZE = 5;
const ALLY_BLIP_SIZE = 5;
const OBJECTIVE_BLIP_SIZE = 6;

/**
 * Radar-style minimap component for tactical awareness.
 * Uses Canvas 2D for performant rendering at throttled frame rate.
 */
export function Minimap({
  playerPosition,
  playerHeading,
  enemies = [],
  objectives = [],
  allies = [],
  structures = [],
  range = 50,
  rotateWithPlayer = true,
  size = 150,
  visible = true,
  allowExpand = true,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Effective size based on expansion state
  const effectiveSize = isExpanded ? Math.min(size * 2, 300) : size;
  const effectiveRange = isExpanded ? range * 1.5 : range;

  // Convert world position to canvas position
  const worldToCanvas = useCallback(
    (
      worldX: number,
      worldZ: number,
      playerX: number,
      playerZ: number,
      heading: number,
      canvasSize: number,
      mapRange: number,
      rotate: boolean
    ): { x: number; y: number; inRange: boolean } => {
      // Offset from player
      let dx = worldX - playerX;
      let dz = worldZ - playerZ;

      // Rotate if map rotates with player
      if (rotate) {
        const cos = Math.cos(-heading);
        const sin = Math.sin(-heading);
        const rotatedX = dx * cos - dz * sin;
        const rotatedZ = dx * sin + dz * cos;
        dx = rotatedX;
        dz = rotatedZ;
      }

      // Scale to canvas coordinates (center is player)
      const scale = canvasSize / 2 / mapRange;
      const canvasX = canvasSize / 2 + dx * scale;
      const canvasY = canvasSize / 2 - dz * scale; // Invert Z for screen Y

      // Check if within circular range
      const distance = Math.sqrt(dx * dx + dz * dz);
      const inRange = distance <= mapRange;

      return { x: canvasX, y: canvasY, inRange };
    },
    []
  );

  // Draw the minimap
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = effectiveSize / 2;
    const centerY = effectiveSize / 2;
    const radius = effectiveSize / 2 - 2;

    // Clear and clip to circle
    ctx.clearRect(0, 0, effectiveSize, effectiveSize);
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background with gradient
    const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    bgGradient.addColorStop(0, 'rgba(20, 25, 15, 0.9)');
    bgGradient.addColorStop(0.7, 'rgba(28, 32, 22, 0.85)');
    bgGradient.addColorStop(1, 'rgba(35, 40, 28, 0.8)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, effectiveSize, effectiveSize);

    // Grid lines (concentric circles)
    ctx.strokeStyle = 'rgba(74, 93, 35, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();

    // Sweep line effect (radar sweep)
    const sweepAngle = (Date.now() / 2000) * Math.PI * 2;
    const sweepGradient = ctx.createConicGradient(sweepAngle, centerX, centerY);
    sweepGradient.addColorStop(0, 'rgba(74, 93, 35, 0.4)');
    sweepGradient.addColorStop(0.1, 'rgba(74, 93, 35, 0.1)');
    sweepGradient.addColorStop(0.15, 'rgba(74, 93, 35, 0)');
    sweepGradient.addColorStop(1, 'rgba(74, 93, 35, 0)');
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw structures (terrain outlines)
    if (structures.length > 0) {
      ctx.strokeStyle = 'rgba(100, 120, 80, 0.4)';
      ctx.lineWidth = 1;

      structures.forEach((structure) => {
        if (structure.points.length < 2) return;

        ctx.beginPath();
        let firstPoint = true;

        structure.points.forEach((point) => {
          const canvasPos = worldToCanvas(
            point.x,
            point.z,
            playerPosition.x,
            playerPosition.z,
            playerHeading,
            effectiveSize,
            effectiveRange,
            rotateWithPlayer
          );

          if (firstPoint) {
            ctx.moveTo(canvasPos.x, canvasPos.y);
            firstPoint = false;
          } else {
            ctx.lineTo(canvasPos.x, canvasPos.y);
          }
        });

        if (structure.type === 'building') {
          ctx.closePath();
          ctx.fillStyle = 'rgba(60, 70, 50, 0.3)';
          ctx.fill();
        }
        ctx.stroke();
      });
    }

    // Draw objectives (yellow/green markers)
    objectives.forEach((objective) => {
      const pos = worldToCanvas(
        objective.position.x,
        objective.position.z,
        playerPosition.x,
        playerPosition.z,
        playerHeading,
        effectiveSize,
        effectiveRange,
        rotateWithPlayer
      );

      if (!pos.inRange) {
        // Draw at edge if out of range
        const angle = Math.atan2(
          objective.position.z - playerPosition.z,
          objective.position.x - playerPosition.x
        );
        let edgeAngle = angle;
        if (rotateWithPlayer) {
          edgeAngle -= playerHeading;
        }
        pos.x = centerX + Math.cos(edgeAngle) * (radius - OBJECTIVE_BLIP_SIZE);
        pos.y = centerY - Math.sin(edgeAngle) * (radius - OBJECTIVE_BLIP_SIZE);
      }

      const isMain = objective.type === 'main' || objective.isActive;
      ctx.fillStyle = isMain ? '#FFD700' : '#90EE90';

      // Diamond shape for objectives
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - OBJECTIVE_BLIP_SIZE);
      ctx.lineTo(pos.x + OBJECTIVE_BLIP_SIZE, pos.y);
      ctx.lineTo(pos.x, pos.y + OBJECTIVE_BLIP_SIZE);
      ctx.lineTo(pos.x - OBJECTIVE_BLIP_SIZE, pos.y);
      ctx.closePath();
      ctx.fill();

      // Pulse effect for active objectives
      if (objective.isActive) {
        const pulseSize = OBJECTIVE_BLIP_SIZE + 2 + Math.sin(Date.now() / 300) * 2;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - pulseSize);
        ctx.lineTo(pos.x + pulseSize, pos.y);
        ctx.lineTo(pos.x, pos.y + pulseSize);
        ctx.lineTo(pos.x - pulseSize, pos.y);
        ctx.closePath();
        ctx.stroke();
      }
    });

    // Draw allies (blue blips)
    allies.forEach((ally) => {
      const pos = worldToCanvas(
        ally.position.x,
        ally.position.z,
        playerPosition.x,
        playerPosition.z,
        playerHeading,
        effectiveSize,
        effectiveRange,
        rotateWithPlayer
      );

      if (!pos.inRange) return;

      // Marcus gets a special marker
      if (ally.isMarcus) {
        ctx.fillStyle = '#4DA6FF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ALLY_BLIP_SIZE + 1, 0, Math.PI * 2);
        ctx.fill();

        // Inner dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#4DA6FF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ALLY_BLIP_SIZE, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw enemies (red blips)
    enemies.forEach((enemy) => {
      const pos = worldToCanvas(
        enemy.position.x,
        enemy.position.z,
        playerPosition.x,
        playerPosition.z,
        playerHeading,
        effectiveSize,
        effectiveRange,
        rotateWithPlayer
      );

      if (!pos.inRange) return;

      // Larger/special blips for boss-type enemies
      const isBoss = enemy.type === 'queen' || enemy.type === 'mech';
      const blipSize = isBoss ? ENEMY_BLIP_SIZE + 2 : ENEMY_BLIP_SIZE;

      // Alerted enemies pulse
      const alertPulse = enemy.isAlerted ? 0.7 + Math.sin(Date.now() / 200) * 0.3 : 1;

      ctx.fillStyle = enemy.isAlerted ? `rgba(255, 80, 80, ${alertPulse})` : '#CC3333';

      if (isBoss) {
        // Triangle for boss enemies
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - blipSize);
        ctx.lineTo(pos.x + blipSize, pos.y + blipSize);
        ctx.lineTo(pos.x - blipSize, pos.y + blipSize);
        ctx.closePath();
        ctx.fill();
      } else {
        // Circle for regular enemies
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, blipSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw player (center, with heading indicator)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#4a5d23';
    ctx.lineWidth = 2;

    // Player triangle pointing in heading direction
    ctx.save();
    ctx.translate(centerX, centerY);
    if (!rotateWithPlayer) {
      ctx.rotate(-playerHeading);
    }

    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_BLIP_SIZE);
    ctx.lineTo(PLAYER_BLIP_SIZE * 0.6, PLAYER_BLIP_SIZE * 0.5);
    ctx.lineTo(-PLAYER_BLIP_SIZE * 0.6, PLAYER_BLIP_SIZE * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Restore context
    ctx.restore();

    // Draw compass ring (outside clip)
    ctx.strokeStyle = '#4a5d23';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Draw cardinal directions
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `bold ${effectiveSize > 200 ? 12 : 10}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cardinalOffset = radius + 10;

    if (rotateWithPlayer) {
      // Cardinals rotate opposite to player heading
      const cardinals = [
        { label: 'N', angle: -playerHeading },
        { label: 'E', angle: Math.PI / 2 - playerHeading },
        { label: 'S', angle: Math.PI - playerHeading },
        { label: 'W', angle: -Math.PI / 2 - playerHeading },
      ];

      cardinals.forEach(({ label, angle }) => {
        const x = centerX + Math.sin(angle) * cardinalOffset;
        const y = centerY - Math.cos(angle) * cardinalOffset;

        // Only draw if visible in quadrant
        if (x >= -10 && x <= effectiveSize + 10 && y >= -10 && y <= effectiveSize + 10) {
          ctx.fillStyle = label === 'N' ? '#FFD700' : '#e8e8e8';
          ctx.fillText(label, x, y);
        }
      });
    } else {
      // Fixed north-up
      ctx.fillStyle = '#FFD700';
      ctx.fillText('N', centerX, centerY - cardinalOffset);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText('S', centerX, centerY + cardinalOffset);
      ctx.fillText('E', centerX + cardinalOffset, centerY);
      ctx.fillText('W', centerX - cardinalOffset, centerY);
    }
  }, [
    effectiveSize,
    effectiveRange,
    playerPosition,
    playerHeading,
    enemies,
    objectives,
    allies,
    structures,
    rotateWithPlayer,
    worldToCanvas,
  ]);

  // Animation loop with throttling
  useEffect(() => {
    if (!visible) return;

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= UPDATE_INTERVAL) {
        draw();
        lastUpdateRef.current = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [visible, draw]);

  // Handle touch/click to expand
  const handleInteraction = useCallback(() => {
    if (allowExpand) {
      setIsExpanded((prev) => !prev);
    }
  }, [allowExpand]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.minimapContainer} ${isExpanded ? styles.expanded : ''}`}
      style={{
        width: effectiveSize + 24,
        height: effectiveSize + 24,
      }}
      onClick={handleInteraction}
      onTouchEnd={handleInteraction}
      role="img"
      aria-label="Tactical minimap showing player position, enemies, and objectives"
    >
      <canvas
        ref={canvasRef}
        width={effectiveSize}
        height={effectiveSize}
        className={styles.minimapCanvas}
      />
      {/* Range indicator */}
      <div className={styles.rangeIndicator}>
        <span>{Math.round(effectiveRange)}m</span>
      </div>
      {/* Expand hint on mobile */}
      {allowExpand && (
        <div className={styles.expandHint}>{isExpanded ? 'TAP TO SHRINK' : 'TAP TO EXPAND'}</div>
      )}
    </div>
  );
}

export default Minimap;
