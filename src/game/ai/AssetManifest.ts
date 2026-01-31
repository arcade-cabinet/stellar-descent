/**
 * Gemini AI Asset Manifest
 *
 * JSON-driven manifest of all AI-generated assets for Stellar Descent.
 * This defines all cinematics, portraits, and dynamic content that will be
 * generated using Google Gemini's Veo and Imagen models.
 */

import type {
  AssetManifest,
  CinematicAssetDef,
  PortraitAssetDef,
  QuestImageDef,
  TextContentDef,
} from './types';

// ============================================================================
// CINEMATIC DEFINITIONS (Veo 3.1)
// ============================================================================

/**
 * Level intro cinematics generated via Veo 3.1
 */
export const CINEMATIC_ASSETS: CinematicAssetDef[] = [
  // ACT 1: THE DROP
  {
    id: 'cinematic_anchor_station_intro',
    type: 'video',
    prompt: `Cinematic sci-fi space station interior scene. Camera slowly moves through
    a cryo-bay with multiple hibernation pods glowing with soft blue light. Warning alarms
    flash red in the background. One pod begins to open with steam and hydraulic sounds.
    Dark metallic corridors with holographic displays. Dramatic lighting with lens flares.
    High-end CGI quality, Alien movie aesthetic, atmospheric tension.`,
    duration: 15,
    style: 'space_station',
    aspectRatio: '21:9',
    level: 'anchor_station',
    negativePrompt: 'cartoon, anime, low quality, blurry, text, watermark',
    personGeneration: false,
    priority: 10,
  },
  {
    id: 'cinematic_landfall_intro',
    type: 'video',
    prompt: `Cinematic military dropship descent through alien planet atmosphere. POV from
    inside looking out window at orange-red sky with swirling dust clouds. Turbulence shakes
    the camera. Silhouettes of other drop pods falling alongside. Surface approaching rapidly
    with alien terrain visible - red canyons and strange rock formations. Military HUD
    elements flickering. Intensity increases as ground approaches. Starship Troopers meets
    Halo ODST aesthetic.`,
    duration: 12,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'landfall',
    negativePrompt: 'cartoon, anime, low quality, blurry, faces, humans visible',
    personGeneration: false,
    priority: 9,
  },
  {
    id: 'cinematic_canyon_run_intro',
    type: 'video',
    prompt: `Cinematic vehicle chase scene in alien canyon environment. Military ATV/buggy
    speeding through narrow red rock canyons at high speed. Dust clouds trailing behind.
    Alien flora glimpsed on canyon walls - bioluminescent plants. Quick cuts between
    vehicle exterior and cockpit view. Hostile creatures glimpsed pursuing in distance.
    Mad Max meets Starship Troopers aesthetic. Dynamic camera work, intense action.`,
    duration: 10,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'canyon_run',
    negativePrompt: 'cartoon, anime, low quality, blurry, faces',
    personGeneration: false,
    priority: 8,
  },

  // ACT 2: THE SEARCH
  {
    id: 'cinematic_fob_delta_intro',
    type: 'video',
    prompt: `Horror sci-fi scene of abandoned military base. Camera slowly pans through
    destroyed corridors with flickering lights. Claw marks on walls, blood splatters
    (not gore). Overturned equipment, scattered weapons. Emergency lights casting red
    shadows. Something moves in the darkness at edge of frame. Alien movie tension,
    Dead Space aesthetic. Atmospheric fog, dust particles in light beams.`,
    duration: 12,
    style: 'horror_scifi',
    aspectRatio: '21:9',
    level: 'fob_delta',
    negativePrompt: 'cartoon, anime, bright colors, happy, gore, bodies',
    personGeneration: false,
    priority: 7,
  },
  {
    id: 'cinematic_brothers_intro',
    type: 'video',
    prompt: `Epic reunion scene in dust storm on alien planet surface. Two military mechs
    emerge from the swirling orange dust, one damaged and limping. Dramatic silhouettes
    against storm. Lightning flashes illuminate alien landscape. Mechs acknowledge each
    other with weapon salute. Hostile creatures visible in lightning flashes surrounding
    them. Pacific Rim meets Starship Troopers. Epic scale, emotional weight.`,
    duration: 15,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'brothers_in_arms',
    negativePrompt: 'cartoon, anime, low quality, faces visible',
    personGeneration: false,
    priority: 6,
  },

  // ACT 3: THE TRUTH
  {
    id: 'cinematic_southern_ice_intro',
    type: 'video',
    prompt: `Cinematic frozen wasteland environment on alien planet. Camera sweeps over
    endless ice fields with strange crystalline formations. Blizzard conditions with
    visibility dropping. Alien structures partially buried in ice. Aurora-like lights
    in the sky with unnatural colors (purple, green). Temperature warning HUD overlay.
    The Thing meets Prometheus aesthetic. Desolate beauty, ominous atmosphere.`,
    duration: 12,
    style: 'frozen_wasteland',
    aspectRatio: '21:9',
    level: 'southern_ice',
    negativePrompt: 'cartoon, anime, warm colors, tropical',
    personGeneration: false,
    priority: 5,
  },
  {
    id: 'cinematic_the_breach_intro',
    type: 'video',
    prompt: `Dramatic reveal of alien queen in massive organic hive chamber. Camera slowly
    pushes through bioluminescent tunnel into vast cavern. Strange organic architecture
    with pulsing veins and alien eggs. In the center, a massive creature begins to stir -
    the QUEEN. Multiple glowing eyes open. Terrible screech echoes. Aliens movie queen
    reveal aesthetic. Horror, scale, dread. Bio-mechanical H.R. Giger influence.`,
    duration: 20,
    style: 'alien_organic',
    aspectRatio: '21:9',
    level: 'the_breach',
    negativePrompt: 'cartoon, anime, cute, friendly, bright colors',
    personGeneration: false,
    priority: 10, // Boss intro - high priority
  },

  // ACT 4: ENDGAME
  {
    id: 'cinematic_hive_assault_intro',
    type: 'video',
    prompt: `Combined arms military assault on alien hive entrance. Multiple vehicles
    (tanks, APCs, mechs) advancing through alien-infested surface terrain. Explosions,
    tracer fire, alien creatures being destroyed. Soldiers in powered armor moving in
    formation. Dropships providing air support. The hive entrance looms ahead - a massive
    organic structure. Starship Troopers final battle aesthetic. Epic scale warfare.`,
    duration: 15,
    style: 'military_tactical',
    aspectRatio: '21:9',
    level: 'hive_assault',
    negativePrompt: 'cartoon, anime, gore, graphic violence',
    personGeneration: false,
    priority: 4,
  },
  {
    id: 'cinematic_extraction_intro',
    type: 'video',
    prompt: `Desperate military extraction scene. Soldiers taking defensive positions
    around a landing zone marker. Alien creatures swarming from multiple directions.
    Extraction shuttle visible in the sky, approaching through hostile fire. Explosions,
    defensive fire, coordinated retreat. Dust storm intensifying. Black Hawk Down meets
    Starship Troopers. Intense, desperate, heroic.`,
    duration: 12,
    style: 'military_tactical',
    aspectRatio: '21:9',
    level: 'extraction',
    negativePrompt: 'cartoon, anime, calm, peaceful',
    personGeneration: false,
    priority: 3,
  },
  {
    id: 'cinematic_final_escape_intro',
    type: 'video',
    prompt: `Apocalyptic escape sequence through collapsing alien hive. Vehicle racing
    through tunnels as everything collapses behind. Explosions, falling debris, alien
    structures disintegrating. Glimpses of surviving creatures being crushed. Light
    visible ahead - the exit. Ground cracking, lava visible below. Timer HUD element
    counting down. Halo Warthog Run meets Aliens escape sequence. Maximum intensity,
    triumphant desperation.`,
    duration: 15,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    level: 'final_escape',
    negativePrompt: 'cartoon, anime, slow, calm',
    personGeneration: false,
    priority: 10, // Finale - high priority
  },
];

// ============================================================================
// CHARACTER PORTRAIT DEFINITIONS (Imagen)
// ============================================================================

/**
 * Character portraits for dialogue system
 */
export const PORTRAIT_ASSETS: PortraitAssetDef[] = [
  // Sergeant James Cole (Player)
  {
    id: 'portrait_cole_neutral',
    type: 'image',
    prompt: `Military sci-fi portrait of a battle-hardened space marine sergeant. Male,
    mid-30s, short dark hair, strong jaw, determined eyes. Wearing futuristic combat
    helmet with visor up. Subtle scars. Dark background with subtle blue rim lighting.
    Realistic rendering, cinematic quality. Similar to Mass Effect character portraits.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'cole',
    emotion: 'neutral',
  },
  {
    id: 'portrait_cole_combat',
    type: 'image',
    prompt: `Military sci-fi portrait of a space marine sergeant in intense combat focus.
    Male, mid-30s, visor down with HUD reflection visible. Sweat, dust on armor.
    Concentrated expression. Muzzle flash lighting from side. Realistic rendering.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'cole',
    emotion: 'combat',
  },

  // Corporal Marcus Cole (Brother)
  {
    id: 'portrait_marcus_neutral',
    type: 'image',
    prompt: `Military sci-fi portrait of a mech pilot. Male, late-20s, similar features
    to protagonist (brothers), slightly younger. Mech pilot helmet with retracted faceplate.
    Confident but weary expression. Scorch marks on helmet. Dark background with orange
    rim lighting. Realistic rendering.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'marcus',
    emotion: 'neutral',
  },
  {
    id: 'portrait_marcus_injured',
    type: 'image',
    prompt: `Military sci-fi portrait of an injured mech pilot. Male, late-20s, helmet
    cracked with blood visible. Pained but determined expression. Warning lights
    reflecting in eyes. Smoke in background. Realistic rendering.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'marcus',
    emotion: 'injured',
  },

  // ATHENA AI
  {
    id: 'portrait_athena_normal',
    type: 'image',
    prompt: `Holographic AI avatar portrait. Abstract feminine face formed from blue
    light particles and data streams. Geometric patterns suggesting features. Calm,
    professional appearance. Circuit board patterns in background. TRON meets Cortana
    aesthetic. Glowing edges, digital artifacts.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'athena',
    emotion: 'normal',
  },
  {
    id: 'portrait_athena_alert',
    type: 'image',
    prompt: `Holographic AI avatar portrait showing urgency. Abstract feminine face
    formed from red-orange warning light particles. Fragmented, data corruption visible.
    Alert symbols floating around. Circuit patterns glitching. Digital distress.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'athena',
    emotion: 'alert',
  },

  // Command Staff
  {
    id: 'portrait_commander_reyes',
    type: 'image',
    prompt: `Military commander portrait. Female, 40s, Hispanic, silver-streaked dark
    hair in tight bun. Command uniform with medals. Stern but fair expression. Command
    bridge background with tactical displays. Authority and experience evident.
    Realistic rendering.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'reyes',
    emotion: 'neutral',
  },
  {
    id: 'portrait_pilot_phoenix',
    type: 'image',
    prompt: `Dropship pilot portrait. Helmet on with tinted visor partially up.
    Cocky smile visible. Flight suit with mission patches. Cockpit controls reflected
    in visor. Top Gun meets sci-fi aesthetic. Confident, skilled.`,
    style: 'portrait_realistic',
    aspectRatio: '1:1',
    resolution: '2K',
    characterId: 'phoenix',
    emotion: 'neutral',
  },
];

// ============================================================================
// QUEST/MISSION IMAGE DEFINITIONS (Imagen)
// ============================================================================

/**
 * Loading screens, achievement icons, and briefing images
 */
export const QUEST_IMAGES: QuestImageDef[] = [
  // Loading Screens
  {
    id: 'loading_act1',
    type: 'image',
    prompt: `Wide cinematic shot of space station orbiting alien planet. Station in
    foreground with planet's orange-red surface below. Stars in background. Dramatic
    lighting with sun creating lens flare. Prometheus station aesthetic. Epic scale.`,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'anchor_station',
    purpose: 'loading_screen',
  },
  {
    id: 'loading_act2',
    type: 'image',
    prompt: `Wide shot of alien canyon landscape at sunset. Red rock formations with
    alien flora. Distant military convoy visible as small silhouettes. Dust clouds on
    horizon. Beautiful but hostile environment. Grand Teton meets Mars aesthetic.`,
    style: 'cinematic_scifi',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'canyon_run',
    purpose: 'loading_screen',
  },
  {
    id: 'loading_act3',
    type: 'image',
    prompt: `Frozen alien wasteland under aurora. Ice spires and crystalline formations.
    Blizzard conditions in distance. Abandoned research station barely visible.
    Beautiful desolation. Antarctica meets alien planet aesthetic.`,
    style: 'frozen_wasteland',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'southern_ice',
    purpose: 'loading_screen',
  },
  {
    id: 'loading_act4',
    type: 'image',
    prompt: `Massive alien hive structure emerging from planet surface. Bio-organic
    architecture with pulsing lights. Military forces assembling in foreground.
    Storm clouds overhead with lightning. Final battle aesthetic. Epic scale dread.`,
    style: 'alien_organic',
    aspectRatio: '21:9',
    resolution: '4K',
    level: 'hive_assault',
    purpose: 'loading_screen',
  },

  // Mission Briefing Images
  {
    id: 'briefing_landfall',
    type: 'image',
    prompt: `Tactical display showing planetary drop trajectory. Holographic planet
    with landing zone marked. Drop pod trajectories as dotted lines. Military UI
    aesthetic with grid overlay. Blue and orange color scheme.`,
    style: 'military_tactical',
    aspectRatio: '16:9',
    resolution: '2K',
    level: 'landfall',
    purpose: 'briefing',
  },
  {
    id: 'briefing_queen',
    type: 'image',
    prompt: `Tactical scan of alien queen creature. Wire-frame overlay showing weak
    points highlighted in red. Size comparison with human silhouette showing massive
    scale. Warning text and bio-signatures. Military scanner aesthetic.`,
    style: 'military_tactical',
    aspectRatio: '16:9',
    resolution: '2K',
    level: 'the_breach',
    purpose: 'briefing',
  },

  // Achievement Icons
  {
    id: 'achievement_survivor',
    type: 'image',
    prompt: `Military medal/badge icon. Skull with crossed rifles behind it. Metallic
    gold and dark steel colors. "SURVIVOR" text subtly incorporated. Worn, battle-damaged
    appearance. Icon style, clean edges.`,
    style: 'military_tactical',
    aspectRatio: '1:1',
    resolution: '1K',
    level: 'anchor_station',
    purpose: 'achievement',
  },
  {
    id: 'achievement_queen_slayer',
    type: 'image',
    prompt: `Military medal/badge icon. Alien queen skull impaled on combat knife.
    Purple and gold colors. "QUEEN SLAYER" theme. Premium, legendary appearance.
    Glowing edges. Icon style.`,
    style: 'military_tactical',
    aspectRatio: '1:1',
    resolution: '1K',
    level: 'the_breach',
    purpose: 'achievement',
  },
];

// ============================================================================
// TEXT CONTENT DEFINITIONS (Gemini Text)
// ============================================================================

/**
 * Dynamic text content for audio logs, briefings, and dialogue variations
 */
export const TEXT_CONTENT: TextContentDef[] = [
  // Audio Log Templates
  {
    id: 'audio_log_scientist_01',
    type: 'text',
    prompt: `Write a short audio log entry (50-75 words) from a terrified scientist
    at FOB Delta. They discovered something horrifying about the alien creatures -
    they're not just predators, they're intelligent and coordinating. The log cuts off
    suddenly. Use first person, present tense, include timestamps. Avoid cliches.`,
    maxTokens: 150,
    category: 'audio_log',
    level: 'fob_delta',
    systemInstruction: `You are writing for a military sci-fi horror game. Tone should
    be tense, realistic, and slightly desperate. No purple prose. Short sentences.
    Include specific technical/scientific details to feel authentic.`,
  },
  {
    id: 'audio_log_soldier_01',
    type: 'text',
    prompt: `Write a short audio log entry (50-75 words) from a soldier's final
    recording. They're describing their last stand defending civilians. Focus on
    camaraderie with squadmates, not horror. Ends on hopeful note despite doom.
    Military terminology authentic.`,
    maxTokens: 150,
    category: 'audio_log',
    level: 'extraction',
    systemInstruction: `Military sci-fi tone. Authentic military terminology and radio
    protocol. Focus on human connection and sacrifice. Avoid melodrama - understated
    courage is more impactful.`,
  },

  // Dynamic Dialogue Variations
  {
    id: 'dialogue_athena_warning_variations',
    type: 'text',
    prompt: `Generate 5 variations of an AI warning about incoming hostile contacts.
    Each should be 10-15 words. Professional military AI tone. Include specific
    details like direction, count, threat level. Return as JSON array of strings.`,
    maxTokens: 200,
    category: 'dialogue',
    characterId: 'athena',
    systemInstruction: `You are ATHENA, a military AI. Be precise, efficient, no
    wasted words. Use military terminology (bearing, contacts, threat level).
    Slight urgency in phrasing but never panic.`,
  },
  {
    id: 'dialogue_marcus_banter_variations',
    type: 'text',
    prompt: `Generate 5 variations of combat banter from Marcus (brother/mech pilot)
    to the player. Mix of: competition ("I got more kills"), concern ("watch your six"),
    and dark humor. 10-15 words each. Return as JSON array.`,
    maxTokens: 200,
    category: 'dialogue',
    level: 'brothers_in_arms',
    characterId: 'marcus',
    systemInstruction: `Marcus is a mech pilot, younger brother of protagonist.
    Cocky but caring. Mix of military professional and brotherly ribbing.
    Hides worry behind humor.`,
  },

  // Mission Briefing Content
  {
    id: 'briefing_the_breach',
    type: 'text',
    prompt: `Write a 100-word military mission briefing for assaulting an alien
    queen's lair. Include: objective (eliminate queen), known threats (queen abilities,
    spawned creatures), recommended loadout, extraction plan. Professional military
    briefing format.`,
    maxTokens: 250,
    category: 'briefing',
    level: 'the_breach',
    characterId: 'reyes',
    systemInstruction: `Commander Reyes delivering briefing. Stern, professional,
    strategic. Acknowledges danger but projects confidence. Use military structure:
    SITUATION, MISSION, EXECUTION, SUPPORT.`,
  },
];

// ============================================================================
// COMPLETE MANIFEST
// ============================================================================

/**
 * Complete asset manifest combining all definitions
 */
export const ASSET_MANIFEST: AssetManifest = {
  version: '1.0.0',
  generatedAt: Date.now(),
  cinematics: CINEMATIC_ASSETS,
  dialoguePortraits: PORTRAIT_ASSETS,
  questImages: QUEST_IMAGES,
  textContent: TEXT_CONTENT,
};

/**
 * Get all assets for a specific level
 */
export function getAssetsForLevel(levelId: string): {
  cinematics: CinematicAssetDef[];
  portraits: PortraitAssetDef[];
  questImages: QuestImageDef[];
  textContent: TextContentDef[];
} {
  return {
    cinematics: CINEMATIC_ASSETS.filter((c) => c.level === levelId),
    portraits: PORTRAIT_ASSETS, // Portraits are shared across levels
    questImages: QUEST_IMAGES.filter((q) => q.level === levelId),
    textContent: TEXT_CONTENT.filter((t) => t.level === levelId || !t.level),
  };
}

/**
 * Get asset by ID from manifest
 */
export function getAssetById(
  id: string
): CinematicAssetDef | PortraitAssetDef | QuestImageDef | TextContentDef | undefined {
  return (
    CINEMATIC_ASSETS.find((a) => a.id === id) ||
    PORTRAIT_ASSETS.find((a) => a.id === id) ||
    QUEST_IMAGES.find((a) => a.id === id) ||
    TEXT_CONTENT.find((a) => a.id === id)
  );
}

/**
 * Get all cinematics sorted by priority (highest first)
 */
export function getCinematicsByPriority(): CinematicAssetDef[] {
  return [...CINEMATIC_ASSETS].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export default ASSET_MANIFEST;
