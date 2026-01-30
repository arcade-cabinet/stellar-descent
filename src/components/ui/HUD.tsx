import { useGame } from '../../game/context/GameContext';
import styles from './HUD.module.css';

interface HUDProps {
  health: number;
  maxHealth: number;
  kills: number;
  missionText: string;
}

export function HUD({ health, maxHealth, kills, missionText }: HUDProps) {
  const { notification, damageFlash } = useGame();
  const rawPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  const clampedPercent = Math.max(0, Math.min(100, Number.isNaN(rawPercent) ? 0 : rawPercent));

  const getHealthColor = () => {
    if (clampedPercent > 50) return '#4CAF50';
    if (clampedPercent > 25) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className={styles.hud}>
      {/* Damage flash overlay */}
      {damageFlash && <div className={styles.damageFlash} />}

      {/* Health bar - bottom left */}
      <div className={styles.healthContainer}>
        <span className={styles.healthLabel}>HEALTH</span>
        <div className={styles.healthBar}>
          <div
            className={styles.healthFill}
            style={{
              width: `${clampedPercent}%`,
              backgroundColor: getHealthColor(),
            }}
          />
        </div>
        <span className={styles.healthText}>
          {Math.floor(health)}/{maxHealth}
        </span>
      </div>

      {/* Mission text - top center */}
      <div className={styles.missionContainer}>
        <span className={styles.missionText}>{missionText}</span>
      </div>

      {/* Kills counter - top right */}
      <div className={styles.killsContainer}>
        <span className={styles.killsLabel}>KILLS</span>
        <span className={styles.killsCount}>{kills}</span>
      </div>

      {/* Crosshair - center */}
      <div className={styles.crosshair}>
        <div className={styles.crosshairDot} />
        <div className={`${styles.crosshairLine} ${styles.top}`} />
        <div className={`${styles.crosshairLine} ${styles.bottom}`} />
        <div className={`${styles.crosshairLine} ${styles.left}`} />
        <div className={`${styles.crosshairLine} ${styles.right}`} />
      </div>

      {/* Notification */}
      {notification && (
        <div className={styles.notification} key={notification.id}>
          {notification.text}
        </div>
      )}
    </div>
  );
}
