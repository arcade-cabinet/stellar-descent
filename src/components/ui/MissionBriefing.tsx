import { useCallback, useEffect, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { LORE, MISSION_BRIEFINGS } from '../../game/core/lore';
import { CAMPAIGN_LEVELS, type LevelConfig, type LevelId } from '../../game/levels/types';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './MissionBriefing.module.css';

/**
 * Enemy intel entry for briefing
 */
export interface EnemyIntelEntry {
  type: string;
  threat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  description: string;
  weakness?: string;
}

/**
 * Mission briefing data structure
 */
export interface MissionBriefingData {
  missionName: string;
  missionSubtitle?: string;
  actName: string;
  chapter: number;
  commanderBriefing: string;
  environmentDescription: string;
  objectives: string[];
  suggestedLoadout: LoadoutItem[];
  environmentType: 'station' | 'surface' | 'underground' | 'orbital';
  threatLevel: 'minimal' | 'moderate' | 'high' | 'extreme';
  enemyIntel: EnemyIntelEntry[];
}

/**
 * Loadout item for suggested equipment
 */
export interface LoadoutItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  equipped: boolean;
}

/**
 * Props for MissionBriefing component
 */
interface MissionBriefingProps {
  isOpen: boolean;
  levelId: LevelId;
  onBeginMission: () => void;
  onCancel: () => void;
}

/**
 * Generate mission briefing data from level config and lore
 */
function generateBriefingData(levelId: LevelId): MissionBriefingData {
  const config: LevelConfig = CAMPAIGN_LEVELS[levelId];

  // Get mission briefing from lore based on chapter
  const missionKey = `mission${config.chapter}` as keyof typeof MISSION_BRIEFINGS;
  const briefing = MISSION_BRIEFINGS[missionKey] || MISSION_BRIEFINGS.mission1;

  // Map level type to environment type
  const envTypeMap: Record<string, MissionBriefingData['environmentType']> = {
    station: 'station',
    drop: 'orbital',
    canyon: 'surface',
    base: 'station',
    brothers: 'surface',
    hive: 'underground',
    extraction: 'surface',
    vehicle: 'surface',
    ice: 'surface',
    combined_arms: 'underground',
    finale: 'surface',
  };

  // Map level to threat level
  const threatMap: Record<LevelId, MissionBriefingData['threatLevel']> = {
    anchor_station: 'minimal',
    landfall: 'moderate',
    canyon_run: 'moderate',
    fob_delta: 'moderate',
    brothers_in_arms: 'high',
    southern_ice: 'high',
    the_breach: 'extreme',
    hive_assault: 'extreme',
    extraction: 'high',
    final_escape: 'extreme',
  };

  // Enemy intel per level - detailed hostile information
  const enemyIntelMap: Record<LevelId, EnemyIntelEntry[]> = {
    anchor_station: [], // Tutorial - no hostiles
    landfall: [
      {
        type: 'CHITIN DRONE',
        threat: 'LOW',
        description: 'Fast-moving scouts. Weak carapace armor. Attack in swarms of 3-5.',
        weakness: 'Headshots deal 2x damage. Easily staggered.',
      },
      {
        type: 'CHITIN SOLDIER',
        threat: 'MEDIUM',
        description: 'Primary combat unit. Reinforced exoskeleton. Melee attacks.',
        weakness: 'Exposed joints on legs. Slow to turn.',
      },
    ],
    canyon_run: [
      {
        type: 'CHITIN FLYER',
        threat: 'MEDIUM',
        description: 'Aerial pursuit units. Attack from above during vehicle transit.',
        weakness: 'Fragile wings. Turret fire effective. Avoid stopping.',
      },
      {
        type: 'CHITIN BURROWER',
        threat: 'HIGH',
        description: 'Ambush predator. Erupts from canyon walls and road surface.',
        weakness: 'Watch for ground tremors. Boost through impact zones.',
      },
      {
        type: 'ROCK SLIDE TRAP',
        threat: 'MEDIUM',
        description: 'Canyon walls destabilized by hive tunneling. Environmental hazard.',
        weakness: 'Visual debris cues before collapse. Maintain speed.',
      },
    ],
    fob_delta: [
      {
        type: 'CHITIN SOLDIER',
        threat: 'MEDIUM',
        description: 'Patrolling interior corridors. Enhanced aggression in confined spaces.',
        weakness: 'Flanking effective. Limited ranged capability.',
      },
      {
        type: 'CHITIN SPITTER',
        threat: 'MEDIUM',
        description: 'Ranged acid attack. Corrosive projectiles. Prefers elevated positions.',
        weakness: 'Fragile at close range. Telegraph attack windup.',
      },
      {
        type: 'AMBUSH SPAWN',
        threat: 'HIGH',
        description: 'Enemies may emerge from vents and floor grates without warning.',
        weakness: 'Watch for visual cues: dust, sounds, flickering lights.',
      },
    ],
    brothers_in_arms: [
      {
        type: 'CHITIN BRUTE',
        threat: 'HIGH',
        description: 'Heavy assault variant. Heavily armored. Devastating charge attack.',
        weakness: 'Expose weak point after charge. Vulnerable to explosives.',
      },
      {
        type: 'SWARM WAVE',
        threat: 'HIGH',
        description: 'Coordinated multi-type assault. Mixed drones, soldiers, and spitters.',
        weakness: 'Prioritize spitters first. Use mech support fire.',
      },
      {
        type: 'CHITIN HARVESTER',
        threat: 'MEDIUM',
        description: 'Large gatherer unit. Non-aggressive unless provoked. Summons reinforcements.',
        weakness: 'Can be avoided. Eliminate quickly if engaged.',
      },
    ],
    southern_ice: [
      {
        type: 'FROST CHITIN',
        threat: 'HIGH',
        description: 'Cold-adapted variant with ice-crystal carapace. Slower but extremely durable.',
        weakness: 'Incendiary weapons melt armor plating. Vulnerable to heat.',
      },
      {
        type: 'CHITIN BURROWER',
        threat: 'HIGH',
        description: 'Tunnels through frozen ground. Erupts beneath targets. Pack hunter.',
        weakness: 'Seismic sensors detect approach. Keep moving on ice.',
      },
      {
        type: 'ICE STORM',
        threat: 'MEDIUM',
        description: 'Environmental hazard. Reduces visibility to near zero. Slows movement.',
        weakness: 'Seek shelter during storms. Use thermal imaging.',
      },
    ],
    the_breach: [
      {
        type: 'HIVE GUARDIAN',
        threat: 'HIGH',
        description: 'Elite defenders near queen chamber. Enhanced armor and speed.',
        weakness: 'Target glowing nerve clusters. Predictable patrol routes.',
      },
      {
        type: 'TOXIC CLOUD',
        threat: 'MEDIUM',
        description: 'Environmental hazard. Spore clouds cause damage over time.',
        weakness: 'Move through quickly. Avoid combat in clouds.',
      },
      {
        type: 'CHITIN QUEEN',
        threat: 'EXTREME',
        description: 'Hive central intelligence. Multiple attack phases. Summons reinforcements.',
        weakness: 'Target egg sacs between phases. Focus fire on exposed abdomen.',
      },
    ],
    hive_assault: [
      {
        type: 'HIVE COLOSSUS',
        threat: 'EXTREME',
        description: 'Massive siege unit guarding hive entrance. Armored shell deflects small arms.',
        weakness: 'Vehicle-mounted weapons required. Target leg joints to immobilize.',
      },
      {
        type: 'SWARM TIDE',
        threat: 'HIGH',
        description: 'Overwhelming numbers of drones and soldiers. Continuous assault waves.',
        weakness: 'Area-of-effect weapons. Vehicle turret suppression fire.',
      },
      {
        type: 'SPORE MINES',
        threat: 'MEDIUM',
        description: 'Organic explosive traps embedded in hive walls and floors.',
        weakness: 'Shoot from distance to detonate safely. Avoid tight corridors.',
      },
    ],
    extraction: [
      {
        type: 'FERAL CHITIN',
        threat: 'HIGH',
        description: 'Uncoordinated but aggressive survivors. Erratic attack patterns.',
        weakness: 'No longer coordinated. Keep moving toward extraction.',
      },
      {
        type: 'EMERGING SWARM',
        threat: 'HIGH',
        description: 'Continuous spawns from collapsing tunnels. Unlimited reinforcements.',
        weakness: 'Do not engage. Sprint to extraction point.',
      },
    ],
    final_escape: [
      {
        type: 'COLLAPSING TERRAIN',
        threat: 'EXTREME',
        description: 'Hive detonation causes cascading ground collapse. Timed destruction.',
        weakness: 'Maintain maximum vehicle speed. Do not stop for any reason.',
      },
      {
        type: 'CHITIN INTERCEPTOR',
        threat: 'HIGH',
        description: 'Desperate aerial attackers ramming the vehicle. Suicide assault.',
        weakness: 'Turret can shoot them down. Boost through swarms.',
      },
      {
        type: 'DEBRIS FIELD',
        threat: 'HIGH',
        description: 'Falling structures and rock formations blocking escape route.',
        weakness: 'Navigate alternate paths. Boost through smaller obstacles.',
      },
    ],
  };

  // Generate environment descriptions based on level
  const envDescriptions: Record<LevelId, string> = {
    anchor_station: `${LORE.locations.anchorStation.description}. Artificial gravity active. Atmosphere: Controlled. Temperature: 21C standard. Current status: OPERATIONAL.`,
    landfall: `${LORE.locations.dropZone.description}. Atmosphere: Thin (14% O2), respirator recommended. Temperature: -12C to 45C variance. Gravity: 0.87G. Hostile contact: CONFIRMED.`,
    canyon_run: `Southern rift valley terrain. Narrow canyon passages with sheer cliff walls. Vehicle transit required - terrain impassable on foot. Aerial and subterranean hostile contacts detected along route. Temperature: 38C. Visibility: Variable due to dust columns.`,
    fob_delta: `${LORE.locations.fobDelta.description}. Power status: OFFLINE. Structural integrity: COMPROMISED. Perimeter breached from subterranean attack vectors. Atmosphere: Degraded.`,
    brothers_in_arms: `Open canyon terrain with scattered rock formations. Extreme temperature variance. Seismic activity detected. M-47 Titan support available. Heavy Chitin presence confirmed.`,
    southern_ice: `Polar region of Kepler's Promise. Frozen wasteland with subzero temperatures (-67C to -23C). Ice sheet thickness: Variable. Cryovolcanic activity detected. New cold-adapted Chitin variants confirmed. Suit thermal systems critical. Visibility: Poor during ice storms.`,
    the_breach: `${LORE.locations.hiveEntrance.description}. Bioluminescent environment. Toxic atmosphere - suit integrity critical. Ambient temperature: 35C. Hive Queen presence: CONFIRMED.`,
    hive_assault: `Combined surface-to-underground assault corridor. Vehicle staging area transitions to infantry-only hive tunnels. Expect heavy fortification. Spore concentration: LETHAL without filtration. Multi-phase operation with vehicle and infantry segments.`,
    extraction: `${LORE.locations.extractionPoint.description}. Terrain: Open desert with minimal cover. Enemy density: EXTREME. Dropship ETA: Variable based on hive collapse.`,
    final_escape: `Collapsing hive superstructure triggering surface-level seismic cascade. Timed vehicle escape along crumbling ridgeline. Ground integrity: FAILING. Aerial Chitin pursuit confirmed. No stops. No second chances. Reach the dropship or die.`,
  };

  // Generate loadout suggestions based on level
  const loadoutSuggestions: Record<LevelId, LoadoutItem[]> = {
    anchor_station: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'pistol',
        name: 'M6D SIDEARM',
        description: 'Backup weapon, reliable',
        icon: '|',
        equipped: true,
      },
    ],
    landfall: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'pistol',
        name: 'M6D SIDEARM',
        description: 'Backup weapon, reliable',
        icon: '|',
        equipped: true,
      },
      {
        id: 'flares',
        name: 'SIGNAL FLARES',
        description: 'Mark position for extraction',
        icon: '*',
        equipped: true,
      },
    ],
    canyon_run: [
      {
        id: 'turret',
        name: 'LRV TURRET',
        description: 'Vehicle-mounted chain gun',
        icon: '#',
        equipped: true,
      },
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Dismount weapon',
        icon: '>',
        equipped: true,
      },
      {
        id: 'boost',
        name: 'NITRO BOOST x3',
        description: 'Emergency vehicle acceleration',
        icon: '!',
        equipped: true,
      },
    ],
    fob_delta: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'shotgun',
        name: 'M90 SHOTGUN',
        description: 'Close quarters devastation',
        icon: '=',
        equipped: false,
      },
      {
        id: 'flashlight',
        name: 'TAC LIGHT',
        description: 'Essential for dark environments',
        icon: 'o',
        equipped: true,
      },
    ],
    brothers_in_arms: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'rockets',
        name: 'M41 ROCKET LAUNCHER',
        description: 'Anti-armor capability',
        icon: '#',
        equipped: false,
      },
      {
        id: 'grenades',
        name: 'FRAG GRENADES x4',
        description: 'Area denial',
        icon: '@',
        equipped: true,
      },
    ],
    southern_ice: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'flamer',
        name: 'M240 FLAMETHROWER',
        description: 'Melts ice armor on frost Chitin',
        icon: '~',
        equipped: false,
      },
      {
        id: 'thermal',
        name: 'THERMAL PACK',
        description: 'Prevents hypothermia in blizzard',
        icon: '+',
        equipped: true,
      },
    ],
    the_breach: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'flamer',
        name: 'M240 FLAMETHROWER',
        description: 'Hive clearance specialist',
        icon: '~',
        equipped: false,
      },
      {
        id: 'medkit',
        name: 'ENHANCED MEDKIT',
        description: 'Critical for sustained ops',
        icon: '+',
        equipped: true,
      },
    ],
    hive_assault: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'rockets',
        name: 'M41 ROCKET LAUNCHER',
        description: 'Anti-armor for hive colossi',
        icon: '#',
        equipped: true,
      },
      {
        id: 'grenades',
        name: 'FRAG GRENADES x6',
        description: 'Area denial for swarm tides',
        icon: '@',
        equipped: true,
      },
    ],
    extraction: [
      {
        id: 'rifle',
        name: 'M4A2 PULSE RIFLE',
        description: 'Standard issue assault rifle',
        icon: '>',
        equipped: true,
      },
      {
        id: 'smg',
        name: 'M7 SMG',
        description: 'High mobility weapon',
        icon: '/',
        equipped: false,
      },
      {
        id: 'beacon',
        name: 'EVAC BEACON',
        description: 'Signal extraction',
        icon: '^',
        equipped: true,
      },
    ],
    final_escape: [
      {
        id: 'turret',
        name: 'LRV TURRET',
        description: 'Vehicle-mounted chain gun',
        icon: '#',
        equipped: true,
      },
      {
        id: 'boost',
        name: 'NITRO BOOST x5',
        description: 'Maximum acceleration for escape',
        icon: '!',
        equipped: true,
      },
      {
        id: 'beacon',
        name: 'EVAC BEACON',
        description: 'Signal final extraction',
        icon: '^',
        equipped: true,
      },
    ],
  };

  return {
    missionName: config.missionName,
    missionSubtitle: config.missionSubtitle,
    actName: config.actName,
    chapter: config.chapter,
    commanderBriefing:
      briefing.text?.trim() || 'Mission parameters are being transmitted. Stand by.',
    environmentDescription: envDescriptions[levelId],
    objectives: ('objectives' in briefing ? briefing.objectives : undefined) || [
      'Proceed to objective',
      'Assess situation',
      'Report findings',
    ],
    suggestedLoadout: loadoutSuggestions[levelId],
    environmentType: envTypeMap[config.type] || 'surface',
    threatLevel: threatMap[levelId],
    enemyIntel: enemyIntelMap[levelId],
  };
}

/**
 * MissionBriefing component
 * Displays pre-mission briefing with objectives, environment info, and loadout
 */
export function MissionBriefing({
  isOpen,
  levelId,
  onBeginMission,
  onCancel,
}: MissionBriefingProps) {
  const [briefingData, setBriefingData] = useState<MissionBriefingData | null>(null);
  const [activeTab, setActiveTab] = useState<'briefing' | 'intel' | 'loadout'>('briefing');
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const screenInfo = getScreenInfo();

  // Load briefing data when level changes
  useEffect(() => {
    if (isOpen && levelId) {
      const data = generateBriefingData(levelId);
      setBriefingData(data);
      setActiveTab('briefing');
      setDisplayedText('');
      setIsTyping(true);
    }
  }, [isOpen, levelId]);

  // Typewriter effect for commander briefing
  useEffect(() => {
    if (!isOpen || !briefingData || activeTab !== 'briefing') return;

    const text = briefingData.commanderBriefing;
    let index = 0;
    setDisplayedText('');
    setIsTyping(true);

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [isOpen, briefingData, activeTab]);

  // Play briefing sound on open
  useEffect(() => {
    if (isOpen) {
      getAudioManager().play('comms_open', { volume: 0.3 });
    }
  }, [isOpen]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleTabChange = useCallback(
    (tab: 'briefing' | 'intel' | 'loadout') => {
      playClickSound();
      setActiveTab(tab);
    },
    [playClickSound]
  );

  const handleBeginMission = useCallback(() => {
    playClickSound();
    getAudioManager().play('ui_click', { volume: 0.4 });
    onBeginMission();
  }, [playClickSound, onBeginMission]);

  const handleCancel = useCallback(() => {
    playClickSound();
    onCancel();
  }, [playClickSound, onCancel]);

  const handleSkipTyping = useCallback(() => {
    if (isTyping && briefingData) {
      setDisplayedText(briefingData.commanderBriefing);
      setIsTyping(false);
    }
  }, [isTyping, briefingData]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && !isTyping) {
        handleBeginMission();
      } else if (e.key === ' ' && isTyping) {
        e.preventDefault();
        handleSkipTyping();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTyping, handleCancel, handleBeginMission, handleSkipTyping]);

  if (!isOpen || !briefingData) return null;

  const getThreatLevelClass = () => {
    switch (briefingData.threatLevel) {
      case 'minimal':
        return styles.threatMinimal;
      case 'moderate':
        return styles.threatModerate;
      case 'high':
        return styles.threatHigh;
      case 'extreme':
        return styles.threatExtreme;
      default:
        return styles.threatModerate;
    }
  };

  const getEnvironmentIcon = () => {
    switch (briefingData.environmentType) {
      case 'station':
        return '[STN]';
      case 'surface':
        return '[SRF]';
      case 'underground':
        return '[UND]';
      case 'orbital':
        return '[ORB]';
      default:
        return '[---]';
    }
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
    >
      {/* Scan lines effect */}
      <div className={styles.scanLines} />

      <div className={styles.briefingPanel}>
        {/* Corner decorations */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.statusLight} />
            <span className={styles.headerLabel}>MISSION BRIEFING</span>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.timestamp}>
              {LORE.setting.year} {'// TEA COMMAND'}
            </span>
          </div>
        </header>

        {/* Mission Title Section */}
        <div className={styles.titleSection}>
          <div className={styles.chapterBadge}>CHAPTER {briefingData.chapter}</div>
          <h1 id="briefing-title" className={styles.missionName}>
            {briefingData.missionName}
          </h1>
          {briefingData.missionSubtitle && (
            <p className={styles.missionSubtitle}>{briefingData.missionSubtitle}</p>
          )}
          <div className={styles.actName}>{briefingData.actName}</div>
        </div>

        {/* Tab Navigation */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: nav with tablist is the correct semantic pattern for tab navigation */}
        <nav className={styles.tabNav} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'briefing'}
            className={`${styles.tab} ${activeTab === 'briefing' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('briefing')}
          >
            BRIEFING
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'intel'}
            className={`${styles.tab} ${activeTab === 'intel' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('intel')}
          >
            INTEL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'loadout'}
            className={`${styles.tab} ${activeTab === 'loadout' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('loadout')}
          >
            LOADOUT
          </button>
        </nav>

        {/* Tab Content */}
        <div className={styles.tabContent} role="tabpanel">
          {activeTab === 'briefing' && (
            <div className={styles.briefingContent}>
              {/* Commander portrait and message */}
              <div className={styles.commanderSection}>
                <div className={styles.portrait}>
                  <div className={styles.portraitFrame}>
                    <div className={styles.portraitInner}>
                      <span className={styles.portraitIcon}>CV</span>
                    </div>
                    <div className={styles.scanLine} />
                  </div>
                  <div className={styles.commanderInfo}>
                    <span className={styles.commanderName}>
                      {LORE.characters.commandingOfficer.name}
                    </span>
                    <span className={styles.commanderCallsign}>
                      [{LORE.characters.commandingOfficer.callsign}]
                    </span>
                  </div>
                </div>

                {/* biome-ignore lint/a11y/useSemanticElements: div with role=button is used for the text skip interaction */}
                <div
                  className={styles.briefingText}
                  onClick={handleSkipTyping}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === ' ' && handleSkipTyping()}
                  aria-label={isTyping ? 'Click to skip typing animation' : 'Commander briefing'}
                >
                  <pre className={styles.briefingTextContent}>
                    {displayedText}
                    {isTyping && <span className={styles.cursor}>|</span>}
                  </pre>
                </div>
              </div>

              {/* Mission Objectives */}
              <div className={styles.objectivesSection}>
                <h3 className={styles.sectionTitle}>PRIMARY OBJECTIVES</h3>
                <ul className={styles.objectivesList}>
                  {briefingData.objectives.map((objective, index) => (
                    <li key={`obj-${objective.slice(0, 20)}`} className={styles.objectiveItem}>
                      <span className={styles.objectiveMarker}>
                        [{String(index + 1).padStart(2, '0')}]
                      </span>
                      <span className={styles.objectiveText}>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'intel' && (
            <div className={styles.intelContent}>
              {/* Environment Info */}
              <div className={styles.intelSection}>
                <h3 className={styles.sectionTitle}>ENVIRONMENT DATA</h3>
                <div className={styles.intelGrid}>
                  <div className={styles.intelItem}>
                    <span className={styles.intelLabel}>TYPE</span>
                    <span className={styles.intelValue}>
                      {getEnvironmentIcon()} {briefingData.environmentType.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.intelItem}>
                    <span className={styles.intelLabel}>THREAT LEVEL</span>
                    <span className={`${styles.intelValue} ${getThreatLevelClass()}`}>
                      {briefingData.threatLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className={styles.environmentDescription}>
                  {briefingData.environmentDescription}
                </div>
              </div>

              {/* Enemy Intel - detailed hostile information */}
              {briefingData.enemyIntel.length > 0 ? (
                <div className={styles.intelSection}>
                  <h3 className={styles.sectionTitle}>HOSTILE INTELLIGENCE</h3>
                  <div className={styles.enemyIntelList}>
                    {briefingData.enemyIntel.map((enemy) => (
                      <div key={`enemy-${enemy.type}`} className={styles.enemyIntelCard}>
                        <div className={styles.enemyIntelHeader}>
                          <span className={styles.enemyType}>{enemy.type}</span>
                          <span
                            className={`${styles.threatBadge} ${
                              enemy.threat === 'LOW'
                                ? styles.threatLow
                                : enemy.threat === 'MEDIUM'
                                  ? styles.threatMedium
                                  : enemy.threat === 'HIGH'
                                    ? styles.threatHigh
                                    : styles.threatExtreme
                            }`}
                          >
                            {enemy.threat}
                          </span>
                        </div>
                        <p className={styles.enemyDescription}>{enemy.description}</p>
                        {enemy.weakness && (
                          <div className={styles.enemyWeakness}>
                            <span className={styles.weaknessLabel}>WEAKNESS:</span>
                            <span className={styles.weaknessText}>{enemy.weakness}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.intelSection}>
                  <h3 className={styles.sectionTitle}>HOSTILE INTELLIGENCE</h3>
                  <div className={styles.noHostiles}>
                    <span className={styles.noHostilesIcon}>[CLEAR]</span>
                    <span className={styles.noHostilesText}>
                      No hostile contacts expected. Standard safety protocols apply.
                    </span>
                  </div>
                </div>
              )}

              {/* General hostile background info */}
              <div className={styles.intelSection}>
                <h3 className={styles.sectionTitle}>ENEMY CLASSIFICATION</h3>
                <div className={styles.hostileInfo}>
                  <div className={styles.hostileDesignation}>
                    <span className={styles.intelLabel}>DESIGNATION</span>
                    <span className={styles.intelValue}>{LORE.enemies.designation}</span>
                  </div>
                  <div className={styles.hostileOrigin}>
                    <span className={styles.intelLabel}>ORIGIN</span>
                    <span className={styles.intelValue}>{LORE.enemies.origin}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'loadout' && (
            <div className={styles.loadoutContent}>
              <h3 className={styles.sectionTitle}>SUGGESTED LOADOUT</h3>
              <div className={styles.loadoutGrid}>
                {briefingData.suggestedLoadout.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.loadoutItem} ${item.equipped ? styles.loadoutEquipped : ''}`}
                  >
                    <div className={styles.loadoutIcon}>{item.icon}</div>
                    <div className={styles.loadoutInfo}>
                      <span className={styles.loadoutName}>{item.name}</span>
                      <span className={styles.loadoutDesc}>{item.description}</span>
                    </div>
                    <div className={styles.loadoutStatus}>
                      {item.equipped ? '[EQUIPPED]' : '[AVAILABLE]'}
                    </div>
                  </div>
                ))}
              </div>
              <p className={styles.loadoutNote}>
                Equipment is pre-assigned for this mission. Field modifications not available.
              </p>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerText}>7TH DROP MARINES {'// HELL JUMPERS'}</span>
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelButton} onClick={handleCancel}>
              ABORT
            </button>
            <button
              type="button"
              className={styles.beginButton}
              onClick={handleBeginMission}
              disabled={isTyping}
            >
              <span className={styles.buttonIcon}>&#9654;</span>
              BEGIN MISSION
            </button>
          </div>
        </footer>
      </div>

      {/* Hint text */}
      <p className={styles.hint}>
        {screenInfo.isTouchDevice
          ? 'TAP BEGIN MISSION TO START'
          : isTyping
            ? 'PRESS SPACE TO SKIP // ENTER TO BEGIN'
            : 'PRESS ENTER TO BEGIN MISSION'}
      </p>
    </div>
  );
}
