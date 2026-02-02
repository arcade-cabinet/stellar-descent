/**
 * ConditionHUD - React component for environmental condition display
 *
 * Displays:
 * - Temperature gauge (cold levels)
 * - Oxygen meter (breach scenarios)
 * - Toxicity level (hive areas)
 * - Radiation indicator
 * - Condition status icons with warning states
 * - Screen overlay effects for environmental conditions
 *
 * Styling follows the existing military/industrial aesthetic of the game.
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { HazardType } from './HazardSystem';

// ============================================================================
// TYPES
// ============================================================================

export interface ConditionMeterData {
  type: HazardType;
  value: number; // 0-1 (1 = full/safe)
  isActive: boolean;
  isCritical: boolean;
}

export interface ConditionHUDProps {
  /** Condition meters to display */
  meters: ConditionMeterData[];
  /** Whether to show screen overlay effects */
  showOverlay?: boolean;
  /** Overlay color (RGBA) */
  overlayColor?: { r: number; g: number; b: number; a: number };
  /** Weather condition text (optional) */
  weatherText?: string;
  /** Active warning messages */
  warnings?: string[];
  /** Whether player's weapon is jammed */
  isWeaponJammed?: boolean;
  /** Visibility percentage (0-1) */
  visibility?: number;
}

// ============================================================================
// METER CONFIGURATIONS
// ============================================================================

interface MeterConfig {
  label: string;
  icon: string;
  color: string;
  warningColor: string;
  criticalColor: string;
  warningThreshold: number;
  criticalThreshold: number;
}

const METER_CONFIGS: Record<HazardType, MeterConfig> = {
  cold: {
    label: 'TEMP',
    icon: '\u2744', // Snowflake
    color: '#4da6ff',
    warningColor: '#66b3ff',
    criticalColor: '#99ccff',
    warningThreshold: 0.4,
    criticalThreshold: 0.15,
  },
  oxygen: {
    label: 'O2',
    icon: '\u2b24', // Circle (representing O2)
    color: '#66ff66',
    warningColor: '#ffff66',
    criticalColor: '#ff6666',
    warningThreshold: 0.4,
    criticalThreshold: 0.2,
  },
  toxic: {
    label: 'TOX',
    icon: '\u2623', // Biohazard
    color: '#66ff99',
    warningColor: '#99ff66',
    criticalColor: '#ff9966',
    warningThreshold: 0.5,
    criticalThreshold: 0.25,
  },
  radiation: {
    label: 'RAD',
    icon: '\u2622', // Radioactive
    color: '#ffff66',
    warningColor: '#ffcc33',
    criticalColor: '#ff6633',
    warningThreshold: 0.7,
    criticalThreshold: 0.4,
  },
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    position: 'absolute' as const,
    left: '20px',
    bottom: '120px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    pointerEvents: 'none' as const,
    zIndex: 100,
  },

  meterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    minWidth: '140px',
  },

  meterContainerWarning: {
    border: '1px solid rgba(255, 200, 0, 0.6)',
    animation: 'pulse-warning 1s ease-in-out infinite',
  },

  meterContainerCritical: {
    border: '1px solid rgba(255, 50, 50, 0.8)',
    animation: 'pulse-critical 0.5s ease-in-out infinite',
  },

  meterIcon: {
    fontSize: '16px',
    width: '20px',
    textAlign: 'center' as const,
  },

  meterLabel: {
    fontSize: '10px',
    fontFamily: "'Courier New', monospace",
    color: 'rgba(255, 255, 255, 0.7)',
    width: '32px',
    letterSpacing: '1px',
  },

  meterBarContainer: {
    flex: 1,
    height: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '2px',
    overflow: 'hidden' as const,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },

  meterBar: {
    height: '100%',
    transition: 'width 0.2s ease-out, background-color 0.3s',
    borderRadius: '1px',
  },

  meterValue: {
    fontSize: '10px',
    fontFamily: "'Courier New', monospace",
    color: 'rgba(255, 255, 255, 0.9)',
    width: '28px',
    textAlign: 'right' as const,
  },

  overlay: {
    position: 'fixed' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    zIndex: 50,
    transition: 'background-color 0.3s',
  },

  warningsContainer: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none' as const,
    zIndex: 150,
  },

  warningText: {
    fontSize: '24px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold' as const,
    color: '#ff4444',
    textShadow: '0 0 10px rgba(255, 68, 68, 0.5)',
    animation: 'flash 0.5s ease-in-out infinite',
    letterSpacing: '2px',
  },

  weatherText: {
    position: 'absolute' as const,
    top: '80px',
    right: '20px',
    fontSize: '12px',
    fontFamily: "'Courier New', monospace",
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: '1px',
    pointerEvents: 'none' as const,
    zIndex: 100,
  },

  weaponJammed: {
    position: 'absolute' as const,
    bottom: '50%',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '16px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold' as const,
    color: '#ff6644',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 16px',
    borderRadius: '4px',
    border: '2px solid #ff6644',
    animation: 'flash 0.3s ease-in-out infinite',
    pointerEvents: 'none' as const,
    zIndex: 160,
  },

  visibilityOverlay: {
    position: 'fixed' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    zIndex: 45,
    background:
      'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.3) 100%)',
    transition: 'opacity 0.5s',
  },
};

// Keyframe animations (injected into document)
const injectAnimations = () => {
  const styleId = 'condition-hud-animations';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes pulse-warning {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes pulse-critical {
      0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(255, 50, 50, 0.5); }
      50% { opacity: 0.8; box-shadow: 0 0 20px rgba(255, 50, 50, 0.8); }
    }
    @keyframes flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Individual condition meter component
 */
const ConditionMeter: React.FC<{ data: ConditionMeterData }> = ({ data }) => {
  const config = METER_CONFIGS[data.type];

  // Determine color based on value
  const getColor = () => {
    if (data.value <= config.criticalThreshold) {
      return config.criticalColor;
    }
    if (data.value <= config.warningThreshold) {
      return config.warningColor;
    }
    return config.color;
  };

  const containerStyle = {
    ...styles.meterContainer,
    ...(data.value <= config.criticalThreshold && data.isActive
      ? styles.meterContainerCritical
      : data.value <= config.warningThreshold && data.isActive
        ? styles.meterContainerWarning
        : {}),
    opacity: data.isActive ? 1 : 0.5,
  };

  const barStyle = {
    ...styles.meterBar,
    width: `${data.value * 100}%`,
    backgroundColor: getColor(),
  };

  const valuePercent = Math.round(data.value * 100);

  return (
    <div style={containerStyle}>
      <span style={{ ...styles.meterIcon, color: getColor() }}>{config.icon}</span>
      <span style={styles.meterLabel}>{config.label}</span>
      <div style={styles.meterBarContainer}>
        <div style={barStyle} />
      </div>
      <span style={{ ...styles.meterValue, color: getColor() }}>{valuePercent}%</span>
    </div>
  );
};

/**
 * Main ConditionHUD component
 */
export const ConditionHUD: React.FC<ConditionHUDProps> = ({
  meters,
  showOverlay = true,
  overlayColor,
  weatherText,
  warnings = [],
  isWeaponJammed = false,
  visibility = 1,
}) => {
  // Inject animations on mount
  useEffect(() => {
    injectAnimations();
  }, []);

  // Filter to only show active meters (or meters below full)
  const visibleMeters = useMemo(() => {
    return meters.filter((m) => m.isActive || m.value < 0.95);
  }, [meters]);

  // Calculate overlay style
  const overlayStyle = useMemo(() => {
    if (!showOverlay || !overlayColor || overlayColor.a < 0.01) {
      return null;
    }

    return {
      ...styles.overlay,
      backgroundColor: `rgba(${Math.round(overlayColor.r * 255)}, ${Math.round(overlayColor.g * 255)}, ${Math.round(overlayColor.b * 255)}, ${overlayColor.a})`,
    };
  }, [showOverlay, overlayColor]);

  // Calculate visibility overlay opacity
  const visibilityOpacity = useMemo(() => {
    return Math.max(0, 1 - visibility);
  }, [visibility]);

  // Render critical warnings
  const criticalWarnings = useMemo(() => {
    return warnings.filter(
      (w) => w.toLowerCase().includes('critical') || w.toLowerCase().includes('emergency')
    );
  }, [warnings]);

  return (
    <>
      {/* Condition meters */}
      {visibleMeters.length > 0 && (
        <div style={styles.container}>
          {visibleMeters.map((meter) => (
            <ConditionMeter key={meter.type} data={meter} />
          ))}
        </div>
      )}

      {/* Screen overlay effect */}
      {overlayStyle && <div style={overlayStyle} />}

      {/* Visibility reduction overlay */}
      {visibilityOpacity > 0.1 && (
        <div style={{ ...styles.visibilityOverlay, opacity: visibilityOpacity }} />
      )}

      {/* Weather indicator */}
      {weatherText && <div style={styles.weatherText}>{weatherText}</div>}

      {/* Critical warnings */}
      {criticalWarnings.length > 0 && (
        <div style={styles.warningsContainer}>
          {criticalWarnings.map((warning, index) => (
            <div key={index} style={styles.warningText}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Weapon jammed indicator */}
      {isWeaponJammed && <div style={styles.weaponJammed}>WEAPON JAMMED - CLEAR MECHANISM</div>}
    </>
  );
};

// ============================================================================
// HOOK FOR INTEGRATION
// ============================================================================

/**
 * Hook to get condition HUD data from the EnvironmentalConditionsManager
 */
export function useConditionHUDData(): ConditionHUDProps {
  const [meters, _setMeters] = useState<ConditionMeterData[]>([]);
  const [overlayColor, _setOverlayColor] = useState<{
    r: number;
    g: number;
    b: number;
    a: number;
  } | null>(null);
  const [warnings, _setWarnings] = useState<string[]>([]);
  const [isWeaponJammed, _setIsWeaponJammed] = useState(false);
  const [weatherText, _setWeatherText] = useState<string | undefined>();
  const [visibility, _setVisibility] = useState(1);

  useEffect(() => {
    // This would be connected to the EnvironmentalConditionsManager
    // For now, we just return empty state - actual integration happens at level level
    return () => {};
  }, []);

  return {
    meters,
    overlayColor: overlayColor ?? undefined,
    warnings,
    isWeaponJammed,
    weatherText,
    visibility,
  };
}

export default ConditionHUD;
