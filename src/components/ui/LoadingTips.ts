/**
 * LoadingTips - Comprehensive tip database for loading screens
 *
 * Provides combat tips, movement tips, level-specific tips, and lore snippets
 * organized by category and level for contextual display during loading.
 */

import type { LevelId, LevelType } from '../../game/levels/types';

export type TipCategory =
  | 'COMBAT'
  | 'TACTICAL'
  | 'MOVEMENT'
  | 'EQUIPMENT'
  | 'SURVIVAL'
  | 'AWARENESS'
  | 'INTEL'
  | 'LORE';

export interface GameTip {
  category: TipCategory;
  tip: string;
  /** If set, tip only shows for these levels */
  levelIds?: LevelId[];
  /** If set, tip only shows for these level types */
  levelTypes?: LevelType[];
  /** Priority for selection (higher = more likely) */
  priority?: number;
}

// ============================================================================
// COMBAT TIPS
// ============================================================================
const COMBAT_TIPS: GameTip[] = [
  {
    category: 'COMBAT',
    tip: 'Headshots deal critical damage. Aim for weak points on Xenos.',
    priority: 2,
  },
  {
    category: 'COMBAT',
    tip: 'Short controlled bursts conserve ammo and maintain accuracy.',
    priority: 2,
  },
  {
    category: 'COMBAT',
    tip: 'Grenades are effective against clustered hostiles. Cook them for tighter timing.',
  },
  {
    category: 'COMBAT',
    tip: 'Different weapons excel at different ranges. Shotguns up close, rifles at distance.',
    priority: 1,
  },
  {
    category: 'COMBAT',
    tip: 'Xeno carapace is weakest at joint articulations. Target limbs to slow them down.',
  },
  {
    category: 'COMBAT',
    tip: 'Reload during lulls in combat. An empty magazine at the wrong moment is fatal.',
    priority: 2,
  },
  {
    category: 'COMBAT',
    tip: 'Melee attacks can stagger nearby enemies. Use them when surrounded.',
  },
  {
    category: 'COMBAT',
    tip: 'Watch your ammo counter. Scavenging in combat is a death sentence.',
  },
  {
    category: 'COMBAT',
    tip: 'Explosive barrels can clear rooms. Position enemies near them before detonating.',
  },
];

// ============================================================================
// TACTICAL TIPS
// ============================================================================
const TACTICAL_TIPS: GameTip[] = [
  {
    category: 'TACTICAL',
    tip: 'Listen for audio cues - Xenos make distinct sounds before attacking.',
    priority: 2,
  },
  {
    category: 'TACTICAL',
    tip: 'Use the environment for cover. Xeno acid cannot penetrate solid barriers.',
  },
  {
    category: 'TACTICAL',
    tip: 'Prioritize Spitters - their acid can hit you from range.',
    priority: 2,
  },
  {
    category: 'TACTICAL',
    tip: 'Funneling enemies through chokepoints gives you the advantage.',
  },
  {
    category: 'TACTICAL',
    tip: 'Darkness favors the Xenos. Use flares to illuminate threats.',
    levelTypes: ['base', 'hive'],
  },
  {
    category: 'TACTICAL',
    tip: 'High ground provides better sightlines and defensive positions.',
    levelTypes: ['canyon', 'brothers', 'extraction', 'ice', 'combined_arms'],
  },
  {
    category: 'TACTICAL',
    tip: 'Burrowers attack from below. Watch for disturbed ground.',
  },
  {
    category: 'TACTICAL',
    tip: 'Ambush points often have supply caches nearby. Check before engaging.',
  },
  {
    category: 'TACTICAL',
    tip: 'Sound attracts more Xenos. Suppressors reduce detection range.',
  },
];

// ============================================================================
// MOVEMENT TIPS
// ============================================================================
const MOVEMENT_TIPS: GameTip[] = [
  {
    category: 'MOVEMENT',
    tip: 'Keep moving. A stationary Marine is a dead Marine.',
    priority: 2,
  },
  {
    category: 'MOVEMENT',
    tip: 'Sprint to break contact, but remember stamina is limited.',
  },
  {
    category: 'MOVEMENT',
    tip: 'Crouch to reduce your profile and improve accuracy.',
  },
  {
    category: 'MOVEMENT',
    tip: 'Mantling obstacles quickly can mean the difference between life and death.',
  },
  {
    category: 'MOVEMENT',
    tip: 'Slide into cover during firefights. It makes you harder to hit.',
  },
  {
    category: 'MOVEMENT',
    tip: 'Walking produces less noise than running. Move quietly in hostile territory.',
    levelTypes: ['base', 'hive'],
  },
  {
    category: 'MOVEMENT',
    tip: 'Jump over low obstacles to maintain momentum during pursuit.',
  },
  {
    category: 'MOVEMENT',
    tip: 'Circle-strafing keeps you mobile while maintaining fire on targets.',
  },
];

// ============================================================================
// EQUIPMENT TIPS
// ============================================================================
const EQUIPMENT_TIPS: GameTip[] = [
  {
    category: 'EQUIPMENT',
    tip: 'Weapons have different effective ranges. Choose wisely.',
  },
  {
    category: 'EQUIPMENT',
    tip: 'Check terminals for supply requisition codes. They unlock weapon caches.',
    levelTypes: ['station', 'base'],
  },
  {
    category: 'EQUIPMENT',
    tip: 'Medkits restore health over time. Find cover before using them.',
    priority: 2,
  },
  {
    category: 'EQUIPMENT',
    tip: 'Your motion tracker has limited range in underground environments.',
    levelTypes: ['hive'],
  },
  {
    category: 'EQUIPMENT',
    tip: 'Armor piercing rounds are effective against heavily armored Xenos.',
  },
  {
    category: 'EQUIPMENT',
    tip: 'Flares last 30 seconds. Use them strategically in dark areas.',
    levelTypes: ['base', 'hive'],
  },
  {
    category: 'EQUIPMENT',
    tip: 'Repair kits can restore damaged mech systems in the field.',
    levelTypes: ['brothers'],
  },
];

// ============================================================================
// SURVIVAL TIPS
// ============================================================================
const SURVIVAL_TIPS: GameTip[] = [
  {
    category: 'SURVIVAL',
    tip: 'Conserve health packs for emergencies. Minor wounds heal over time.',
  },
  {
    category: 'SURVIVAL',
    tip: 'Check your six. Xenos are known for flanking maneuvers.',
    priority: 2,
  },
  {
    category: 'SURVIVAL',
    tip: 'Red lighting indicates dangerous areas. Proceed with extreme caution.',
    levelTypes: ['station', 'base'],
  },
  {
    category: 'SURVIVAL',
    tip: 'Acid damage continues after initial contact. Get to cover and wait it out.',
  },
  {
    category: 'SURVIVAL',
    tip: 'Emergency seals can lock down sections. Useful for creating safe zones.',
    levelTypes: ['station', 'base'],
  },
  {
    category: 'SURVIVAL',
    tip: "Xeno blood is acidic. Don't stand where you kill them.",
  },
  {
    category: 'SURVIVAL',
    tip: 'When overrun, fall back to a defensible position. Fighting retreats save lives.',
    priority: 2,
  },
];

// ============================================================================
// AWARENESS TIPS
// ============================================================================
const AWARENESS_TIPS: GameTip[] = [
  {
    category: 'AWARENESS',
    tip: 'Motion trackers are unreliable underground. Trust your instincts.',
    levelTypes: ['hive'],
  },
  {
    category: 'AWARENESS',
    tip: 'Watch ceiling vents and ducts. Xenos prefer vertical approaches.',
    levelTypes: ['station', 'base'],
    priority: 2,
  },
  {
    category: 'AWARENESS',
    tip: 'Flickering lights often indicate nearby Xeno activity.',
    levelTypes: ['station', 'base'],
  },
  {
    category: 'AWARENESS',
    tip: 'Environmental damage (sparks, leaks) can indicate structural weakness.',
  },
  {
    category: 'AWARENESS',
    tip: 'Audio logs contain valuable intel. Listen to everything you find.',
  },
  {
    category: 'AWARENESS',
    tip: 'Map markers show objectives. Check your tactical display regularly.',
  },
  {
    category: 'AWARENESS',
    tip: 'Hive resin on walls indicates heavy Xeno presence. Stay alert.',
    levelTypes: ['hive'],
  },
];

// ============================================================================
// INTEL TIPS
// ============================================================================
const INTEL_TIPS: GameTip[] = [
  {
    category: 'INTEL',
    tip: "Command's intel is often outdated. Expect the unexpected.",
  },
  {
    category: 'INTEL',
    tip: 'Data terminals contain mission-critical information. Access all of them.',
    levelTypes: ['station', 'base'],
  },
  {
    category: 'INTEL',
    tip: 'Dog tags of fallen Marines can be returned to Command for honors.',
  },
  {
    category: 'INTEL',
    tip: 'Security footage may reveal enemy patrol patterns.',
    levelTypes: ['base'],
  },
  {
    category: 'INTEL',
    tip: 'Supply manifests help locate hidden caches. Read everything.',
  },
];

// ============================================================================
// LEVEL-SPECIFIC TIPS
// ============================================================================
const LEVEL_SPECIFIC_TIPS: GameTip[] = [
  // Anchor Station
  {
    category: 'INTEL',
    tip: 'Anchor Station Prometheus serves as the forward staging area for all drops.',
    levelIds: ['anchor_station'],
    priority: 3,
  },
  {
    category: 'TACTICAL',
    tip: 'Complete your equipment check before deployment. There are no second chances.',
    levelIds: ['anchor_station'],
    priority: 3,
  },
  {
    category: 'EQUIPMENT',
    tip: 'Access the armory terminal to customize your loadout before the drop.',
    levelIds: ['anchor_station'],
    priority: 3,
  },

  // Landfall
  {
    category: 'SURVIVAL',
    tip: 'HALO insertion is disorienting. Get your bearings quickly on landing.',
    levelIds: ['landfall'],
    priority: 3,
  },
  {
    category: 'TACTICAL',
    tip: "Kepler's Promise terrain favors ambush tactics. Stay in the open at your peril.",
    levelIds: ['landfall'],
    priority: 3,
  },
  {
    category: 'AWARENESS',
    tip: 'Surface winds can affect accuracy at range. Compensate for drift.',
    levelIds: ['landfall'],
    priority: 2,
  },

  // FOB Delta
  {
    category: 'INTEL',
    tip: 'FOB Delta went dark 72 hours ago. Expect to find out why the hard way.',
    levelIds: ['fob_delta'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'The base has emergency power only. Conserve flashlight batteries.',
    levelIds: ['fob_delta'],
    priority: 3,
  },
  {
    category: 'TACTICAL',
    tip: 'Abandoned bases often have automated defenses. Watch for friendly fire.',
    levelIds: ['fob_delta'],
    priority: 2,
  },

  // Brothers in Arms
  {
    category: 'TACTICAL',
    tip: 'Corporal Cole pilots TITAN-class mech armor. Coordinate your attacks.',
    levelIds: ['brothers_in_arms'],
    priority: 3,
  },
  {
    category: 'COMBAT',
    tip: 'Mech armor draws Xeno attention. Use Cole as a distraction.',
    levelIds: ['brothers_in_arms'],
    priority: 3,
  },
  {
    category: 'EQUIPMENT',
    tip: 'TITAN mechs can provide mobile cover. Stay close during heavy fire.',
    levelIds: ['brothers_in_arms'],
    priority: 2,
  },

  // The Breach
  {
    category: 'INTEL',
    tip: 'The Hive Queen controls lesser Xenos telepathically. Kill her to scatter them.',
    levelIds: ['the_breach'],
    priority: 3,
  },
  {
    category: 'TACTICAL',
    tip: 'Hive tunnels are a maze. Mark your path or get lost forever.',
    levelIds: ['the_breach'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'The Queen protects her egg chamber. Expect maximum resistance.',
    levelIds: ['the_breach'],
    priority: 3,
  },

  // Extraction
  {
    category: 'TACTICAL',
    tip: 'LZ Omega is our only extraction point. Defend it at all costs.',
    levelIds: ['extraction'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'Evac arrives in waves. Survive until the final dropship.',
    levelIds: ['extraction'],
    priority: 3,
  },
  {
    category: 'COMBAT',
    tip: 'Set up defensive positions early. The Xenos will come in force.',
    levelIds: ['extraction'],
    priority: 3,
  },

  // Canyon Run
  {
    category: 'TACTICAL',
    tip: 'Keep your speed up. Stopping in the canyon is a death sentence.',
    levelIds: ['canyon_run'],
    priority: 3,
  },
  {
    category: 'COMBAT',
    tip: 'The turret tracks automatically but manual aiming is more accurate.',
    levelIds: ['canyon_run'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'Watch for ground tremors - burrowers erupt seconds later.',
    levelIds: ['canyon_run'],
    priority: 3,
  },
  {
    category: 'EQUIPMENT',
    tip: 'Save nitro boosts for ambush zones. You will need the speed.',
    levelIds: ['canyon_run'],
    priority: 2,
  },

  // Southern Ice
  {
    category: 'INTEL',
    tip: 'The polar region harbors cold-adapted Chitin. Their ice armor resists ballistics.',
    levelIds: ['southern_ice'],
    priority: 3,
  },
  {
    category: 'TACTICAL',
    tip: 'Fire melts Frost Chitin armor. The flamethrower is essential here.',
    levelIds: ['southern_ice'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'Blizzards reduce visibility to near zero. Use thermal imaging.',
    levelIds: ['southern_ice'],
    priority: 3,
  },
  {
    category: 'AWARENESS',
    tip: 'Ice can crack underfoot. Watch for thin sections over crevasses.',
    levelIds: ['southern_ice'],
    priority: 2,
  },

  // Hive Assault
  {
    category: 'TACTICAL',
    tip: 'The assault has two phases: vehicle breach, then infantry push.',
    levelIds: ['hive_assault'],
    priority: 3,
  },
  {
    category: 'COMBAT',
    tip: 'Hive Colossi require vehicle weapons or rockets. Small arms are ineffective.',
    levelIds: ['hive_assault'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'Spore mines are organic explosives. Shoot them from a distance.',
    levelIds: ['hive_assault'],
    priority: 3,
  },
  {
    category: 'EQUIPMENT',
    tip: 'Switch between vehicle turret and infantry weapons at dismount points.',
    levelIds: ['hive_assault'],
    priority: 2,
  },

  // Final Escape
  {
    category: 'TACTICAL',
    tip: 'The ground is collapsing behind you. There is no going back.',
    levelIds: ['final_escape'],
    priority: 3,
  },
  {
    category: 'SURVIVAL',
    tip: 'Every second counts. Do not stop for anything.',
    levelIds: ['final_escape'],
    priority: 3,
  },
  {
    category: 'COMBAT',
    tip: 'Interceptors will ram your vehicle. Shoot them before they close.',
    levelIds: ['final_escape'],
    priority: 3,
  },
  {
    category: 'EQUIPMENT',
    tip: 'Boost through debris fields. The vehicle can survive small impacts.',
    levelIds: ['final_escape'],
    priority: 2,
  },
];

// ============================================================================
// LORE SNIPPETS
// ============================================================================
const LORE_SNIPPETS: GameTip[] = [
  {
    category: 'LORE',
    tip: "Kepler's Promise was colonized 47 years ago. Contact was lost 3 weeks ago.",
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'The Xeno species was first encountered during the Tau Ceti expedition in 2287.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'Terran Expansion Authority Marines are the first line of defense for human colonies.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'Standard Xeno hive contains one Queen and up to 10,000 workers and warriors.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'Colonial Marines undergo 18 months of specialized xenobiology combat training.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'Xeno Queens can lay up to 200 eggs per day. Time is never on our side.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'TITAN-class mech armor was developed specifically for Xeno extermination.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'The Prometheus-class stations serve as orbital forward operating bases.',
    levelIds: ['anchor_station'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: 'Xeno acidic blood has a pH of approximately 0.2. Handle with extreme caution.',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: "Kepler's Promise was a mining colony. What they dug up remains classified.",
    levelIds: ['landfall', 'fob_delta'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: 'The first Xeno Queen autopsy took 47 scientists and 3 years to complete.',
    levelIds: ['the_breach'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: '"Steel and fire against fang and claw." - TEA Marine motto',
    priority: 1,
  },
  {
    category: 'LORE',
    tip: 'LRVs were designed for rapid desert reconnaissance. Canyon combat was not in the specs.',
    levelIds: ['canyon_run'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: "Kepler's Promise polar region was never surveyed on foot. Now we know why.",
    levelIds: ['southern_ice'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: 'Frost Chitin were first theorized when ice core samples showed organic compounds at depth.',
    levelIds: ['southern_ice'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: 'Combined arms doctrine against Chitin hives was developed after the Tau Ceti disaster.',
    levelIds: ['hive_assault'],
    priority: 2,
  },
  {
    category: 'LORE',
    tip: 'No Marine has ever survived a hive detonation on foot. Vehicles are mandatory for egress.',
    levelIds: ['final_escape'],
    priority: 2,
  },
];

// ============================================================================
// TIP DATABASE & UTILITIES
// ============================================================================

/** Complete tip database */
export const ALL_TIPS: GameTip[] = [
  ...COMBAT_TIPS,
  ...TACTICAL_TIPS,
  ...MOVEMENT_TIPS,
  ...EQUIPMENT_TIPS,
  ...SURVIVAL_TIPS,
  ...AWARENESS_TIPS,
  ...INTEL_TIPS,
  ...LEVEL_SPECIFIC_TIPS,
  ...LORE_SNIPPETS,
];

/**
 * Get tips filtered by level context
 * @param levelId - Current level being loaded
 * @param levelType - Type of level environment
 * @returns Array of applicable tips, weighted by priority
 */
export function getTipsForLevel(levelId?: LevelId, levelType?: LevelType): GameTip[] {
  const applicableTips = ALL_TIPS.filter((tip) => {
    // If tip has level restrictions, check them
    if (tip.levelIds && tip.levelIds.length > 0) {
      if (!levelId || !tip.levelIds.includes(levelId)) {
        return false;
      }
    }

    // If tip has level type restrictions, check them
    if (tip.levelTypes && tip.levelTypes.length > 0) {
      if (!levelType || !tip.levelTypes.includes(levelType)) {
        return false;
      }
    }

    return true;
  });

  // Sort by priority (higher first), then shuffle within same priority
  return applicableTips.sort((a, b) => {
    const priorityA = a.priority ?? 1;
    const priorityB = b.priority ?? 1;
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }
    return Math.random() - 0.5;
  });
}

/**
 * Get a shuffled array of tips for display
 * @param levelId - Current level
 * @param levelType - Level type
 * @param count - Number of tips to return (default: all)
 */
export function getShuffledTips(
  levelId?: LevelId,
  levelType?: LevelType,
  count?: number
): GameTip[] {
  const tips = getTipsForLevel(levelId, levelType);

  // Fisher-Yates shuffle
  for (let i = tips.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tips[i], tips[j]] = [tips[j], tips[i]];
  }

  // Return requested count or all
  return count ? tips.slice(0, count) : tips;
}

/**
 * Get tips by category
 */
export function getTipsByCategory(category: TipCategory): GameTip[] {
  return ALL_TIPS.filter((tip) => tip.category === category);
}

/**
 * Get a random tip, optionally filtered
 */
export function getRandomTip(levelId?: LevelId, levelType?: LevelType): GameTip {
  const tips = getTipsForLevel(levelId, levelType);
  return tips[Math.floor(Math.random() * tips.length)];
}
