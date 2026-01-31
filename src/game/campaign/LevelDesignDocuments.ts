/**
 * Level Design Documents -- Creative Direction for Stellar Descent
 *
 * These documents represent the game director's vision for each of the 10
 * campaign levels. They describe pacing, emotional arcs, tension curves,
 * key moments, and narrative beats that drive the player experience from
 * the sterile corridors of Anchor Station Prometheus to the burning surface
 * of Kepler's Promise.
 *
 * Every level is designed to teach something new, challenge something old,
 * and push the story forward through environmental storytelling, comms
 * chatter, and scripted encounters. The campaign follows a four-act
 * structure -- THE DROP, THE SEARCH, THE TRUTH, ENDGAME -- with each act
 * escalating the stakes and transforming the player's understanding of
 * the world.
 */

import type { LevelId } from '../levels/types';
import type { LevelDesignDocument } from './LevelDesignData';

// ============================================================================
// COMPLETE LEVEL DESIGN DOCUMENTS
// ============================================================================

export const LEVEL_DESIGN_DOCUMENTS: Record<LevelId, LevelDesignDocument> = {
  // ==========================================================================
  // ACT 1: THE DROP
  // ==========================================================================

  // --------------------------------------------------------------------------
  // LEVEL 1: ANCHOR STATION PROMETHEUS
  // --------------------------------------------------------------------------
  anchor_station: {
    levelId: 'anchor_station',
    estimatedMinutes: { min: 8, max: 15 },
    pacingStyle: 'exploration',
    narrativeBeat:
      'Tutorial aboard the UNSC Prometheus -- orientation, weapons training, and the calm before the orbital drop.',
    emotionalArc:
      'Anticipation building to resolve. The player starts in quiet safety, absorbs the weight of the mission through environmental storytelling, and ends standing at the edge of a drop pod with nothing below but atmosphere and fire.',
    tensionCurve: [
      {
        progress: 0,
        tension: 1,
        description:
          'Wake-up sequence. Fluorescent lights hum. The barracks are empty except for your locker and a blinking terminal.',
      },
      {
        progress: 15,
        tension: 2,
        description:
          'Moving through the crew quarters. Audio logs hint at a mission gone wrong before yours. Coffee cups still warm on desks.',
      },
      {
        progress: 30,
        tension: 3,
        description:
          'Arrive at the shooting range. The drill sergeant walks you through weapon handling. Targets pop. The controls become muscle memory.',
      },
      {
        progress: 50,
        tension: 4,
        description:
          'Briefing room. Commander Vasquez lays out the mission -- Kepler\'s Promise, the lost colony, the silence. The holographic planet rotates slowly.',
      },
      {
        progress: 70,
        tension: 5,
        description:
          'Walking the observation deck. Through the viewport, the planet fills the frame -- swirling dust storms, fractured continents, and something glowing beneath the crust.',
      },
      {
        progress: 85,
        tension: 6,
        description:
          'Armory and loadout selection. The quartermaster hands you your gear with a look that says he does not expect to see it returned.',
      },
      {
        progress: 95,
        tension: 7,
        description:
          'Drop pod bay. The door seals behind you. Through the floor window, the planet grows larger. The countdown begins.',
      },
    ],
    keyMoments: [
      {
        name: 'The Empty Ship',
        description:
          'The player wakes alone in the barracks. Every bunk is made. Every locker is shut. The PA system crackles with automated messages meant for a crew of hundreds. The silence teaches the player that something has already gone wrong.',
        progressPercent: 5,
        type: 'reveal',
      },
      {
        name: 'Shooting Range Qualification',
        description:
          'A structured tutorial disguised as a military qualification drill. Pop-up targets, timed challenges, and weapon switching exercises. The drill sergeant provides color commentary and lore. This is where the player learns to fight.',
        progressPercent: 35,
        type: 'setpiece',
      },
      {
        name: 'Mission Briefing',
        description:
          'Commander Vasquez delivers the mission parameters via holographic display. The colony on Kepler\'s Promise went silent 72 hours ago. Previous recon teams have not reported back. Your squad is the last option. The briefing ends with: "Bring them home, or bring back answers."',
        progressPercent: 50,
        type: 'dialogue',
      },
      {
        name: 'The Drop',
        description:
          'The player steps into the drop pod. The bay door opens beneath them. The planet fills the viewport -- red dust, shattered mountains, and an alien world waiting. The pod launches with a bone-rattling jolt. This is the point of no return.',
        progressPercent: 95,
        type: 'setpiece',
      },
    ],
    narrativeSetup:
      'Anchor Station Prometheus hangs in high orbit above Kepler\'s Promise, a colony world that went dark three days ago. The station should be bustling with marines preparing for deployment, but the corridors are quiet -- most squads have already dropped. You are part of the final wave, a replacement pulled from cryo to fill a slot nobody wanted. The station itself tells a story: hastily evacuated mess halls, flickering emergency lights in sections that should not need them, and cargo manifests that list equipment the UNSC does not officially acknowledge. By the time you reach the drop pod bay, you understand that this is not a rescue mission. It is a last resort.',
    previousConnection:
      'This is the first level. The player has no prior context beyond the title screen briefing. The level must establish the world, the controls, and the stakes from zero.',
    newMechanics: [
      'Basic movement and look controls',
      'Weapon pickup and firing',
      'Interacting with terminals and doors',
      'Audio log collection',
      'HUD orientation (health, ammo, objective marker)',
      'Loadout selection at armory',
    ],
    enemyTypes: [],
    weaponsAvailable: [
      'MA5D Assault Rifle (training range)',
      'M6H Sidearm (training range)',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 2: LANDFALL
  // --------------------------------------------------------------------------
  landfall: {
    levelId: 'landfall',
    estimatedMinutes: { min: 10, max: 15 },
    pacingStyle: 'mixed',
    narrativeBeat:
      'HALO drop from orbit into a dust storm. First boots on alien soil, first contact with the Wraith.',
    emotionalArc:
      'Terror dissolving into determination. The freefall sequence is pure spectacle and vulnerability. Once on the ground, the player transitions from disorientation to competence as they clear their first encounters and establish a foothold.',
    tensionCurve: [
      {
        progress: 0,
        tension: 8,
        description:
          'Freefall. The atmosphere burns orange around the pod. G-forces press the HUD into distortion. Radio chatter fragments and dies.',
      },
      {
        progress: 10,
        tension: 9,
        description:
          'Impact. The pod tears open. Dust everywhere. Alarms wail. The player crawls out into a canyon choked with red haze.',
      },
      {
        progress: 20,
        tension: 5,
        description:
          'Regaining bearings. The dust settles enough to see wreckage from other pods. Some landed well. Some did not.',
      },
      {
        progress: 35,
        tension: 4,
        description:
          'Exploration of the landing zone. Gathering supplies from scattered pods. The canyon walls rise high on either side, funneling forward.',
      },
      {
        progress: 50,
        tension: 6,
        description:
          'First contact. Movement on the ridge. Organic shapes that should not exist here. The Wraith reveal themselves with a shriek that echoes off stone.',
      },
      {
        progress: 70,
        tension: 8,
        description:
          'Sustained firefight through canyon narrows. The Wraith attack in waves, probing, flanking, learning. The player learns too.',
      },
      {
        progress: 85,
        tension: 7,
        description:
          'Pushing through to a canyon overlook. The colony is visible in the distance -- structures intact but dark. No lights. No movement.',
      },
      {
        progress: 95,
        tension: 4,
        description:
          'Establishing a forward position. Radio contact with command restored. Reinforcements en route. A moment to breathe before the next push.',
      },
    ],
    keyMoments: [
      {
        name: 'Atmospheric Entry',
        description:
          'A scripted freefall sequence where the player watches the planet surface rush toward them through the pod viewport. The HUD shakes, radio comms fragment, and other pods streak past -- some trailing fire. The player has no control. They are a passenger in their own descent. The pod rips open on impact.',
        progressPercent: 5,
        type: 'setpiece',
      },
      {
        name: 'Pod Graveyard',
        description:
          'The player explores the scattered drop pods. Most are empty -- marines already moved out. One pod is crushed. Another is open but splashed with something that is not oil. The environmental storytelling here tells the player that the surface is hostile before any enemy appears.',
        progressPercent: 25,
        type: 'reveal',
      },
      {
        name: 'First Contact',
        description:
          'The Wraith appear -- not as a cutscene, but as shadows on the canyon wall that resolve into chitinous, wrong-jointed shapes. The first encounter is deliberately small: two Drones and a Stalker. The player wins, but the sounds the creatures make linger. Something intelligent is watching.',
        progressPercent: 50,
        type: 'combat',
      },
      {
        name: 'The Silent Colony',
        description:
          'From the canyon overlook, the player gets their first clear view of the colony below. Every building is intact. Every light is off. The wind carries no sound of human activity. The objective marker updates: "Investigate Colony Perimeter." The player understands the real mission has begun.',
        progressPercent: 85,
        type: 'reveal',
      },
    ],
    narrativeSetup:
      'The drop pod punches through the upper atmosphere of Kepler\'s Promise at terminal velocity. The ablative shielding burns away in layers, filling the viewport with molten orange. Comms are static. The altimeter spins. When the retro-rockets fire, the deceleration hits like a wall -- and then the pod tears open on impact, spilling the player into a canyon half-buried in red dust. Other pods are scattered across the canyon floor, some cracked open like eggs. The planet is beautiful in a hostile way: towering sandstone walls striated with mineral veins, a sky the color of a bruise, and wind that carries grit sharp enough to score polymer. The colony of Kepler\'s Promise is somewhere beyond the canyon. Between here and there, something is moving in the rocks.',
    previousConnection:
      'The player steps into the drop pod at the end of Anchor Station. The transition is seamless -- the pod bay door closes, the countdown hits zero, and the freefall begins. This level picks up mid-descent.',
    newMechanics: [
      'Freefall / on-rails descent sequence',
      'Sprint and slide movement',
      'Grenade throw',
      'Enemy target prioritization (Drone vs Stalker behavior)',
      'Supply scavenging from environment',
    ],
    enemyTypes: [
      'Wraith Drone (basic melee rusher)',
      'Wraith Stalker (ranged, uses cover)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
    ],
  },

  // ==========================================================================
  // ACT 2: THE SEARCH
  // ==========================================================================

  // --------------------------------------------------------------------------
  // LEVEL 3: CANYON RUN
  // --------------------------------------------------------------------------
  canyon_run: {
    levelId: 'canyon_run',
    estimatedMinutes: { min: 8, max: 12 },
    pacingStyle: 'chase',
    narrativeBeat:
      'High-speed vehicle pursuit through a narrow canyon. A Wraith ambush turns a recon run into a fight for survival.',
    emotionalArc:
      'Exhilaration tempered by dread. The vehicle section is pure adrenaline -- tight turns, mounted gun fire, and collapsing terrain. But the ambush at the midpoint flips the script: the hunter becomes the hunted. The player escapes, but barely, and with the knowledge that the Wraith are coordinated.',
    tensionCurve: [
      {
        progress: 0,
        tension: 3,
        description:
          'Vehicle startup. The Warthog\'s engine catches with a roar. The canyon stretches out ahead, wide enough to drive but narrow enough to worry.',
      },
      {
        progress: 15,
        tension: 5,
        description:
          'Building speed through open canyon. Rocky outcroppings blur past. The turret tracks contacts on the ridge -- watching, not yet attacking.',
      },
      {
        progress: 30,
        tension: 7,
        description:
          'The canyon narrows. Wraith Drones drop from the walls. The mounted gun opens up. Debris and chitin fly.',
      },
      {
        progress: 45,
        tension: 9,
        description:
          'Ambush. A massive Brute crashes through the canyon wall ahead, blocking the road. The vehicle swerves. Wraith pour in from all sides.',
      },
      {
        progress: 60,
        tension: 10,
        description:
          'Desperate fight through the kill zone. The Warthog takes hits. The engine smokes. The player must keep moving or be overwhelmed.',
      },
      {
        progress: 75,
        tension: 8,
        description:
          'Breaking through the ambush. The canyon opens into a rift valley. The Brute roars behind but cannot follow through the narrow exit.',
      },
      {
        progress: 90,
        tension: 5,
        description:
          'Limping the damaged vehicle toward a structure on the horizon. FOB Delta appears through the dust -- fences, prefabs, and silence.',
      },
      {
        progress: 100,
        tension: 3,
        description:
          'Vehicle dies at the perimeter gate of FOB Delta. The engine coughs its last. The base ahead is dark but intact.',
      },
    ],
    keyMoments: [
      {
        name: 'Saddle Up',
        description:
          'The player finds the Warthog parked at the canyon mouth -- banged up, dusty, but functional. The AI companion notes that the vehicle logs show it was abandoned mid-patrol. The keys are still in the ignition. This is the first time the player drives.',
        progressPercent: 5,
        type: 'setpiece',
      },
      {
        name: 'The Gauntlet',
        description:
          'Wraith Drones begin dropping from the canyon walls onto the road and the vehicle itself. The player must drive and shoot (or rely on AI gunner), weaving between fallen rocks and leaping creatures. The canyon becomes a shooting gallery at 120 km/h.',
        progressPercent: 35,
        type: 'combat',
      },
      {
        name: 'Brute Ambush',
        description:
          'A Wraith Brute -- massive, armored, enraged -- smashes through the canyon wall directly ahead. The road is blocked. Wraith flood in from side passages. The player must fight through a kill zone while the vehicle takes increasing damage. This is the first encounter with a Brute-class enemy.',
        progressPercent: 50,
        type: 'combat',
      },
      {
        name: 'FOB Delta Sighting',
        description:
          'As the canyon opens into the rift valley, the player spots FOB Delta in the distance -- a human-built forward operating base surrounded by defensive fencing. The lights are off. The gate is open. No response on comms. The vehicle limps toward it as the engine gives out.',
        progressPercent: 92,
        type: 'reveal',
      },
    ],
    narrativeSetup:
      'Command needs eyes on the southern rift valley, and the only way through is the canyon network that cuts through two hundred meters of sandstone. A Warthog sits at the canyon mouth -- abandoned by a previous recon team that never reported back. The plan is simple: drive fast, stay low, reach FOB Delta on the other side. The canyon has other plans. Within minutes of entering, it becomes clear that the Wraith have turned these narrows into a hunting ground. The walls are scored with claw marks. Organic resin coats the rocks in patterns that suggest deliberate construction. This is not random wildlife. This is a kill box, and the player just drove into it.',
    previousConnection:
      'After establishing a forward position at the end of Landfall, command orders the player south through the canyon network to reach FOB Delta. The Warthog was flagged by a recon drone at the canyon mouth.',
    newMechanics: [
      'Vehicle driving (Warthog)',
      'Mounted turret combat',
      'Vehicle health and damage states',
      'High-speed obstacle avoidance',
      'Brute enemy introduction (heavy armor class)',
    ],
    enemyTypes: [
      'Wraith Drone (canyon ambush variant)',
      'Wraith Stalker (ridge sniper)',
      'Wraith Brute (heavy armored -- first encounter)',
    ],
    weaponsAvailable: [
      'Warthog Mounted Turret',
      'MA5D Assault Rifle (dismounted)',
      'M6H Sidearm (dismounted)',
      'M9 Frag Grenades',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 4: FOB DELTA
  // --------------------------------------------------------------------------
  fob_delta: {
    levelId: 'fob_delta',
    estimatedMinutes: { min: 12, max: 18 },
    pacingStyle: 'combat',
    narrativeBeat:
      'Investigate an abandoned forward operating base. What started as a supply run becomes a horror-tinged gauntlet of escalating encounters.',
    emotionalArc:
      'Unease building to dread, then cathartic release. FOB Delta is a slow burn -- the player explores empty corridors, reads logs that describe a base falling apart, and encounters increasingly aggressive Wraith. The climax is a defense sequence where the player activates the base reactor and must hold until the systems come online.',
    tensionCurve: [
      {
        progress: 0,
        tension: 3,
        description:
          'Entering the perimeter. The gate is ajar. Sandbags are toppled. Shell casings litter the ground but there are no bodies.',
      },
      {
        progress: 15,
        tension: 4,
        description:
          'Exploring the outer buildings. Barracks with overturned bunks. A mess hall with food still on trays. Power is out. Emergency lighting only.',
      },
      {
        progress: 25,
        tension: 5,
        description:
          'First audio log found. A sergeant\'s voice, strained: "They come at night. We board the windows. They find another way."',
      },
      {
        progress: 40,
        tension: 6,
        description:
          'Reaching the command center. Screens are cracked. The tactical map shows patrol routes that all end at the same point -- underground.',
      },
      {
        progress: 55,
        tension: 7,
        description:
          'Descending to the sub-level. The lights fail. Flashlight only. Movement in the vents. Wraith Lurkers cling to the ceiling.',
      },
      {
        progress: 70,
        tension: 9,
        description:
          'Reactor defense. The player activates the backup reactor and must hold the control room as Wraith pour through breached walls and ventilation shafts.',
      },
      {
        progress: 85,
        tension: 8,
        description:
          'Power restored. Automated defenses come online. Turrets shred the remaining Wraith. The base lights snap on, revealing the full scale of the infestation -- resin coating every surface.',
      },
      {
        progress: 95,
        tension: 4,
        description:
          'Comms restored. A distress signal cuts through the static -- Corporal Marcus Cole, callsign "Ironside," is alive and pinned down 20 klicks east with his mech.',
      },
    ],
    keyMoments: [
      {
        name: 'Ghost Base',
        description:
          'The player walks through an entire military base that has been meticulously evacuated -- or emptied. No bodies. No blood. Just silence and the signs of a hasty departure. Personal effects remain. The sense is that the people left, but not voluntarily. Environmental storytelling carries the horror.',
        progressPercent: 10,
        type: 'reveal',
      },
      {
        name: 'The Sergeant\'s Logs',
        description:
          'A sequence of audio logs from Sergeant Chen, found throughout the base, chronicle the deterioration of FOB Delta over seven days. Each log is more desperate than the last. The final log is recorded in the dark: "If you are hearing this, do not go underground. Do not--" Static.',
        progressPercent: 30,
        type: 'dialogue',
      },
      {
        name: 'Lights Out',
        description:
          'The sub-level loses power entirely. The player is reduced to their flashlight. Wraith Lurkers -- a new enemy type that clings to surfaces and ambushes from above -- attack in the dark. This is the level\'s horror peak, designed to make the player feel genuinely vulnerable.',
        progressPercent: 55,
        type: 'combat',
      },
      {
        name: 'Reactor Defense',
        description:
          'The player activates the backup reactor and must defend it for 90 seconds while it cycles up. Wraith attack from ventilation shafts, breached walls, and the main corridor simultaneously. The player must manage angles, ammo, and grenades. When the reactor fires, the base turrets come online and the siege breaks.',
        progressPercent: 72,
        type: 'combat',
      },
      {
        name: 'Marcus\'s Signal',
        description:
          'With comms restored, a garbled distress signal comes through -- Corporal Marcus Cole, the player\'s pre-war friend, is alive. He is pinned down with his damaged mech at a position east of the base. The objective updates: "Reach Corporal Cole." This is the emotional hook for the next level.',
        progressPercent: 95,
        type: 'dialogue',
      },
    ],
    narrativeSetup:
      'FOB Delta was established six weeks ago as the primary forward operating base for the Kepler\'s Promise relief operation. Forty marines, two armor units, and a full medical staff. It reported on schedule for five weeks. Then the reports became sporadic -- equipment failures, personnel transfers that no one authorized, and supply requests for ammunition quantities that made no sense. Then nothing. The base sits in a shallow valley at the southern end of the rift, surrounded by defensive berms and prefab walls. From the outside, it looks intact. The gate is open. The lights are off. Every instinct says to turn around, but the comms relay inside is the only way to contact the fleet. The player must go in.',
    previousConnection:
      'The player arrives at the gates of FOB Delta after the Canyon Run. The Warthog is dead -- shot through and smoking. From here, the player proceeds on foot into the base.',
    newMechanics: [
      'Flashlight toggle',
      'Stationary turret defense',
      'Audio log collection (narrative progression)',
      'Multi-directional defense encounter',
      'Wraith Lurker enemy (ceiling ambush AI)',
    ],
    enemyTypes: [
      'Wraith Drone (interior swarm variant)',
      'Wraith Stalker (corridor flanker)',
      'Wraith Lurker (ceiling ambush -- new enemy)',
      'Wraith Brute (reactor defense wave)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun (found in armory)',
      'Base Defense Turret (stationary)',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 5: BROTHERS IN ARMS
  // --------------------------------------------------------------------------
  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    estimatedMinutes: { min: 15, max: 20 },
    pacingStyle: 'combat',
    narrativeBeat:
      'Reunite with Corporal Marcus Cole and his damaged mech. Together, fight through escalating waves in a last stand that cements the bond between soldier and machine.',
    emotionalArc:
      'Relief giving way to brotherhood and catharsis. Finding Marcus alive is the emotional payoff of the previous two levels. The wave defense that follows is exhausting but triumphant -- two soldiers against the swarm, holding the line not because they can win, but because they refuse to lose each other again.',
    tensionCurve: [
      {
        progress: 0,
        tension: 4,
        description:
          'Approaching Marcus\'s position through a dust storm. Visibility is low. His mech\'s beacon flickers on the HUD.',
      },
      {
        progress: 12,
        tension: 3,
        description:
          'Reunion. Marcus is alive, battered, and cracking jokes from the cockpit of a mech that is missing an arm. The warmth of a familiar voice.',
      },
      {
        progress: 25,
        tension: 5,
        description:
          'Fortifying the position. Marcus walks the player through mech coordination -- he draws fire, the player flanks. The dust storm provides cover but limits sightlines.',
      },
      {
        progress: 40,
        tension: 7,
        description:
          'Wave 1: Wraith Drones and Stalkers probe the defenses. Marcus\'s mech stomps through the front line while the player covers the flanks.',
      },
      {
        progress: 55,
        tension: 8,
        description:
          'Wave 2: Two Brutes lead the assault. Marcus engages one; the player must handle the other. Ammo is becoming scarce.',
      },
      {
        progress: 70,
        tension: 9,
        description:
          'Wave 3: A Wraith Spitter (new artillery enemy) bombards the position from range while ground forces close in. Marcus\'s mech takes critical damage.',
      },
      {
        progress: 85,
        tension: 10,
        description:
          'Final wave. Everything the Wraith have throws itself at the position. Marcus\'s mech is down to one weapon. The player is the last line.',
      },
      {
        progress: 95,
        tension: 5,
        description:
          'The swarm breaks. The dust storm clears enough to see the southern ice shelf on the horizon. Marcus patches his mech: "South it is."',
      },
    ],
    keyMoments: [
      {
        name: 'Reunion',
        description:
          'The player finds Marcus Cole pinned behind his damaged mech in a rocky depression. His cockpit hatch is jammed half-open. When he sees the player, he grins: "Took you long enough. I was about to start a book." The dialogue here establishes their history -- friends before the war, separated by deployment, and now together on a world that wants them dead.',
        progressPercent: 12,
        type: 'dialogue',
      },
      {
        name: 'Coordinated Defense',
        description:
          'Marcus walks the player through the mech coordination system. The player can designate targets for Marcus to prioritize. Marcus draws aggro with his heavy weapons while the player flanks. This is the first time the player fights alongside a persistent AI ally with tactical depth.',
        progressPercent: 28,
        type: 'setpiece',
      },
      {
        name: 'Brute Duel',
        description:
          'Two Brutes attack simultaneously. Marcus locks one down with his remaining arm cannon; the player must solo the other. This is a skill check -- everything learned about Brute behavior in Canyon Run is tested here without vehicle support.',
        progressPercent: 58,
        type: 'combat',
      },
      {
        name: 'Marcus Goes Down',
        description:
          'A Spitter barrage cripples Marcus\'s mech. His weapons go offline. He can still move but cannot fight. The player must solo the final wave while Marcus uses his mech as a mobile shield. The desperation is palpable. Marcus\'s comms chatter shifts from bravado to quiet encouragement.',
        progressPercent: 82,
        type: 'combat',
      },
      {
        name: 'Dust Clears',
        description:
          'After the final wave breaks, the dust storm lifts for the first time. The southern ice shelf is visible on the horizon -- a wall of white against the red desert. Marcus and the player share a quiet moment before moving out. No celebration. Just survival.',
        progressPercent: 95,
        type: 'reveal',
      },
    ],
    narrativeSetup:
      'Corporal Marcus Cole -- callsign "Ironside" -- has been fighting alone for nine days. His squad was wiped out defending a supply convoy. His Atlas-class mech lost its left arm to a Brute that ripped it off at the shoulder joint. He has been surviving on emergency rations and stubborn refusal to die, broadcasting a distress signal on a frequency that nobody was listening to until FOB Delta\'s comms came back online. The player approaches through a worsening dust storm, following the mech\'s beacon through rocky terrain that offers cover to things that do not need roads. Marcus is not just a squadmate -- he is the player character\'s oldest friend, referenced in audio logs throughout Anchor Station and FOB Delta. Finding him alive is the emotional axis of Act 2. Losing him is not an option.',
    previousConnection:
      'Marcus\'s distress signal was received at the end of FOB Delta. The player leaves the restored base on foot, heading east into the dust storm toward Marcus\'s last known position.',
    newMechanics: [
      'AI ally coordination (target designation)',
      'Mech companion tactical behavior',
      'Wave defense encounter structure',
      'Ammo scarcity management',
      'Wraith Spitter enemy (indirect fire artillery)',
    ],
    enemyTypes: [
      'Wraith Drone (swarm variant)',
      'Wraith Stalker (flanking assault)',
      'Wraith Brute (dual encounter)',
      'Wraith Spitter (artillery -- new enemy)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun',
      'SRS99 Sniper Rifle (found at Marcus\'s cache)',
    ],
  },

  // ==========================================================================
  // ACT 3: THE TRUTH
  // ==========================================================================

  // --------------------------------------------------------------------------
  // LEVEL 6: SOUTHERN ICE
  // --------------------------------------------------------------------------
  southern_ice: {
    levelId: 'southern_ice',
    estimatedMinutes: { min: 12, max: 15 },
    pacingStyle: 'mixed',
    narrativeBeat:
      'Cross a frozen wasteland toward the hive entrance. Environmental hazards and isolation replace overwhelming combat. The cold itself is the enemy.',
    emotionalArc:
      'Isolation deepening into dread. The ice shelf is vast and empty. Blizzard conditions reduce visibility to meters. Marcus\'s mech struggles with the terrain. The player feels small and exposed. When the Wraith appear, they are different here -- adapted, camouflaged, and patient. The level ends at a massive organic structure protruding from the ice -- the entrance to the hive.',
    tensionCurve: [
      {
        progress: 0,
        tension: 3,
        description:
          'Crossing onto the ice shelf. The temperature drops. Marcus\'s mech servos protest in the cold. Breath fogs inside the helmet.',
      },
      {
        progress: 15,
        tension: 4,
        description:
          'The blizzard closes in. Visibility drops to 20 meters. Navigation relies on compass and HUD markers. Ice crackles underfoot.',
      },
      {
        progress: 25,
        tension: 5,
        description:
          'Discovery of a frozen research outpost. Scientists were studying something beneath the ice. Their notes describe seismic anomalies and "thermal vents that breathe."',
      },
      {
        progress: 40,
        tension: 6,
        description:
          'Ice Wraith encounter. These adapted variants are nearly invisible against the white. They attack from snow drifts and refreeze wounds with contact.',
      },
      {
        progress: 55,
        tension: 7,
        description:
          'Crossing a frozen lake. The ice is thin in places -- dark water beneath. Ice Wraith Stalkers fire from the far shore. Movement cracks the surface.',
      },
      {
        progress: 70,
        tension: 6,
        description:
          'Marcus\'s mech breaks through the ice into a cavern below. He is alive but trapped. The player must find an alternate route down to reach him.',
      },
      {
        progress: 85,
        tension: 8,
        description:
          'Descending through ice caves toward Marcus. The walls are not entirely ice -- organic material weaves through the frost. The hive is close.',
      },
      {
        progress: 95,
        tension: 7,
        description:
          'Reaching Marcus in a massive underground cavern. Ahead: a wall of organic resin, pulsing with bioluminescence. The hive entrance. No turning back.',
      },
    ],
    keyMoments: [
      {
        name: 'The White Wall',
        description:
          'The blizzard descends with a sound like static. Within seconds, the world is white. The HUD compass becomes the only reliable navigation tool. Marcus\'s mech is a shadow beside the player, barely visible. The isolation is total. This is designed to make the player feel genuinely alone even with a companion.',
        progressPercent: 18,
        type: 'setpiece',
      },
      {
        name: 'The Research Outpost',
        description:
          'A small prefab station half-buried in snow. Inside: frozen coffee, data pads, and a whiteboard covered in equations. The researchers found thermal signatures beneath the ice that matched no geological model. One data pad contains a single entry: "It is not a volcano. It is breathing." This is the first direct evidence that the hive is alive.',
        progressPercent: 28,
        type: 'reveal',
      },
      {
        name: 'Thin Ice',
        description:
          'The player must cross a frozen lake while under fire from Ice Wraith Stalkers on the far shore. Moving too fast cracks the ice. Standing still makes the player a target. The tension is environmental and tactical simultaneously -- the ground itself is the hazard.',
        progressPercent: 55,
        type: 'setpiece',
      },
      {
        name: 'Marcus Falls',
        description:
          'The ice gives way beneath Marcus\'s mech. He drops into a cavern below with a crash that shakes the surface. His comms crackle: "I am fine. Mech is... less fine. Find another way down." The player must navigate ice caves alone to reach him. This separation heightens the isolation of the level.',
        progressPercent: 70,
        type: 'setpiece',
      },
      {
        name: 'The Breathing Wall',
        description:
          'The player reunites with Marcus in an enormous underground cavern. The far wall is not stone -- it is organic. A membrane of chitin and resin stretches floor to ceiling, pulsing rhythmically, glowing with faint bioluminescence. Warm air seeps through it. The hive is on the other side. Marcus looks at the player: "After you."',
        progressPercent: 95,
        type: 'reveal',
      },
    ],
    narrativeSetup:
      'The southern ice shelf of Kepler\'s Promise is a place that the colony surveys marked as "uninhabitable -- no strategic value." That assessment was wrong. Beneath kilometers of ancient ice, thermal imaging from the Prometheus has detected a heat signature the size of a city. Whatever the Wraith are, they did not come from the canyons. They came from below. Marcus and the player push south across the ice, following coordinates extracted from FOB Delta\'s research files. The blizzard hits within an hour -- a whiteout that reduces the world to a circle of visibility barely wider than the mech is tall. The cold is a mechanical threat: weapon systems slow, health drains in exposed positions, and the ice itself is unreliable. But the real danger is what has adapted to live here. The Wraith on the ice shelf are different -- white-armored, patient, and perfectly camouflaged. They do not swarm. They wait.',
    previousConnection:
      'After the wave defense at Brothers in Arms, Marcus and the player spot the southern ice shelf on the horizon. Command confirms the thermal anomaly beneath the ice. The two push south together.',
    newMechanics: [
      'Cold exposure mechanic (health drain in open areas)',
      'Low visibility navigation (blizzard conditions)',
      'Ice hazard traversal (cracking, thin ice)',
      'Companion separation sequence',
      'Ice Wraith camouflage detection',
    ],
    enemyTypes: [
      'Ice Wraith Drone (camouflaged snow variant)',
      'Ice Wraith Stalker (long-range, blizzard adapted)',
      'Ice Wraith Lurker (ice cave ceiling variant)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun',
      'SRS99 Sniper Rifle',
      'Thermal Flares (environmental tool)',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 7: THE BREACH
  // --------------------------------------------------------------------------
  the_breach: {
    levelId: 'the_breach',
    estimatedMinutes: { min: 15, max: 25 },
    pacingStyle: 'boss',
    narrativeBeat:
      'Enter the hive. Descend through alien architecture into the Queen\'s chamber. Fight the Hive Queen -- the turning point of the entire war.',
    emotionalArc:
      'Awe collapsing into terror, then rising to desperate triumph. The hive interior is unlike anything the player has seen -- organic, vast, and beautiful in a way that is deeply wrong. The descent strips away human reference points. The Queen fight is the campaign\'s midpoint climax: a multi-phase battle that demands everything the player has learned. Victory does not feel like winning. It feels like surviving.',
    tensionCurve: [
      {
        progress: 0,
        tension: 5,
        description:
          'Breaching the organic membrane. The hive interior opens up -- cavernous, humid, lit by bioluminescence. The architecture is not built. It is grown.',
      },
      {
        progress: 10,
        tension: 4,
        description:
          'Exploration of the upper hive. Tunnels branch in organic fractals. The walls pulse with fluid. Strange beauty. Oppressive silence.',
      },
      {
        progress: 20,
        tension: 6,
        description:
          'First hive combat. Wraith emerge from the walls themselves -- born from cocoons that split open as the player passes. They are protecting something below.',
      },
      {
        progress: 35,
        tension: 7,
        description:
          'The nursery. Rows of translucent pods containing Wraith in various stages of development. Some pods contain things that are not Wraith. The implications are staggering.',
      },
      {
        progress: 50,
        tension: 6,
        description:
          'Descent into the deep hive. The tunnels widen. The temperature rises. Marcus\'s mech barely fits. The bioluminescence shifts to a warning red.',
      },
      {
        progress: 65,
        tension: 8,
        description:
          'Approaching the Queen\'s chamber. The sound changes -- a low vibration felt in the chest. Guard Wraith attack with suicidal intensity. They are buying time.',
      },
      {
        progress: 80,
        tension: 10,
        description:
          'Queen boss fight -- Phase 1. She is enormous, anchored to the chamber ceiling, raining acid and summoning Drones. The player must destroy her anchor points while dodging ground attacks.',
      },
      {
        progress: 92,
        tension: 10,
        description:
          'Queen boss fight -- Phase 2. She drops to the floor, mobile and furious. Marcus distracts her while the player targets weak points exposed by her rage.',
      },
      {
        progress: 100,
        tension: 6,
        description:
          'The Queen falls. The hive convulses. Marcus pulls the player out as tunnels collapse. They emerge on the surface gasping. But the rumbling does not stop.',
      },
    ],
    keyMoments: [
      {
        name: 'Crossing the Threshold',
        description:
          'The player pushes through the organic membrane into the hive. The transition is visceral -- from ice and stone to warm, wet, living architecture. The sound design shifts entirely: no more wind, no more mechanical hum. Just the rhythm of something enormous breathing. The player is inside a living organism.',
        progressPercent: 3,
        type: 'setpiece',
      },
      {
        name: 'The Nursery',
        description:
          'A vast chamber filled with translucent pods. Most contain developing Wraith. Some contain human remains in early stages of conversion. This is the revelation that recontextualizes everything -- the missing colonists, the empty FOB, the bodies that were never found. The Wraith do not just kill. They assimilate.',
        progressPercent: 35,
        type: 'reveal',
      },
      {
        name: 'The Queen Awakens',
        description:
          'The chamber is cathedral-sized. The Queen hangs from the ceiling like a terrible chandelier -- segmented, armored, and ancient. She does not attack immediately. She studies. Her eyes -- dozens of them -- track the player. Then she screams, and the walls erupt with Drones. The boss fight begins.',
        progressPercent: 78,
        type: 'combat',
      },
      {
        name: 'Phase Shift',
        description:
          'When the Queen\'s anchor points are destroyed, she drops to the floor with an impact that staggers the player. Phase 2 is a mobile fight -- she charges, sweeps, and sprays acid in patterns the player must read and punish. Marcus draws her attention when his mech can still move, creating windows.',
        progressPercent: 90,
        type: 'combat',
      },
      {
        name: 'Pyrrhic Victory',
        description:
          'The Queen collapses. The hive begins to convulse. Tunnels cave in. Marcus grabs the player and they sprint for the surface as the world shakes apart behind them. They emerge into daylight, gasping, covered in ichor. But the ground is still shaking. Something bigger is waking up.',
        progressPercent: 98,
        type: 'setpiece',
      },
    ],
    narrativeSetup:
      'The membrane parts like a wound, and the hive swallows the player whole. Inside, the rules of the surface do not apply. There is no sky. There is no horizon. The architecture is organic -- tunnels of chitin and resin that branch and reconnect in patterns that suggest intention. Bioluminescent fluid pulses through veins in the walls, casting everything in shifting blue-green light. The air is warm and humid and tastes like copper. Marcus\'s mech fills the tunnels, his weapons hot, his voice steady in the comms: "Stay close. Stay loud. Anything that moves, we put down." But the hive is not just a nest. It is a factory. It is a cathedral. And at its heart, something ancient and intelligent waits on a throne of living tissue. The Hive Queen has been here longer than the colony. Longer than the surveys. She has been building an army, and the colony was not a target -- it was raw material.',
    previousConnection:
      'Marcus and the player stand before the organic membrane at the bottom of the ice caves in Southern Ice. They breach the membrane together and enter the hive.',
    newMechanics: [
      'Hive environment navigation (organic, non-linear)',
      'Multi-phase boss fight mechanics',
      'Boss weak point targeting',
      'Environmental hazards (acid pools, collapsing terrain)',
      'Timed escape sequence (post-boss)',
    ],
    enemyTypes: [
      'Wraith Drone (hive-born swarm)',
      'Wraith Guardian (heavy hive defender)',
      'Wraith Spitter (chamber artillery)',
      'Hive Queen (multi-phase boss)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun',
      'SRS99 Sniper Rifle',
      'M41 Rocket Launcher (found in hive -- human weapon cache)',
    ],
  },

  // ==========================================================================
  // ACT 4: ENDGAME
  // ==========================================================================

  // --------------------------------------------------------------------------
  // LEVEL 8: HIVE ASSAULT
  // --------------------------------------------------------------------------
  hive_assault: {
    levelId: 'hive_assault',
    estimatedMinutes: { min: 15, max: 20 },
    pacingStyle: 'holdout',
    narrativeBeat:
      'Combined arms assault on the main hive complex. Infantry, mechs, and orbital support push into the heart of the Wraith network to plant a seismic charge.',
    emotionalArc:
      'Grim resolve hardening into fury. The player is no longer alone -- a full marine assault force backs them up. The scale of combat is the largest in the game. But the Wraith fight with a desperation that mirrors the player\'s own. Every meter is paid for. The emotional peak is planting the charge and knowing that detonation will crack the planet\'s crust. There is no clean victory here.',
    tensionCurve: [
      {
        progress: 0,
        tension: 6,
        description:
          'Assault briefing. Command has committed everything -- three mech squads, two infantry platoons, and orbital fire support. The plan: punch through to the hive core and plant a seismic charge.',
      },
      {
        progress: 10,
        tension: 7,
        description:
          'The assault begins. Vehicles advance across the surface toward the hive entrance. Wraith pour out of tunnel openings across the landscape. Orbital strikes hammer the flanks.',
      },
      {
        progress: 25,
        tension: 8,
        description:
          'Entering the hive with the assault force. Tight corridors force infantry to take point. Mechs provide fire support from wider chambers. Casualties mount.',
      },
      {
        progress: 40,
        tension: 9,
        description:
          'The assault stalls at a fortified junction. Wraith Guardians have created a kill zone. The player must find a flanking route through ventilation tunnels.',
      },
      {
        progress: 55,
        tension: 8,
        description:
          'Flanking successful. The junction falls. The assault pushes deeper. The hive architecture becomes stranger -- larger, older, and covered in symbols that predate the colony by millennia.',
      },
      {
        progress: 70,
        tension: 9,
        description:
          'Reaching the hive core. A massive organic reactor -- the heart of the hive network. It pulses with energy. The charge must be planted at its base.',
      },
      {
        progress: 85,
        tension: 10,
        description:
          'Planting the charge while Wraith attack from every direction. Marcus holds the perimeter. Marines fall. The timer starts. 120 seconds to evacuate.',
      },
      {
        progress: 95,
        tension: 8,
        description:
          'Fighting retreat through collapsing tunnels. The assault force is decimated but the survivors push for the surface. The ground shakes with pre-detonation tremors.',
      },
    ],
    keyMoments: [
      {
        name: 'All Hands',
        description:
          'The assault briefing brings together every surviving marine on Kepler\'s Promise. The holographic display shows the hive network -- it extends across the entire southern hemisphere. The seismic charge will collapse the primary node, but collateral damage to the planet\'s crust is unavoidable. The Commander\'s final words: "We are not saving this world. We are making sure it does not follow us home."',
        progressPercent: 5,
        type: 'dialogue',
      },
      {
        name: 'Surface Push',
        description:
          'The assault across the surface is the game\'s largest combat setpiece. Warthogs, mechs, and infantry advance in formation while orbital strikes crater the ground ahead. Wraith emerge from dozens of tunnel openings. The scale is overwhelming. The player fights from a vehicle turret during the approach.',
        progressPercent: 15,
        type: 'setpiece',
      },
      {
        name: 'The Flanking Run',
        description:
          'When the assault stalls, the player volunteers to find a way around the fortified junction. A solo infiltration through narrow ventilation tunnels -- tight, dark, and infested with Lurkers. Success opens the junction from behind, allowing the assault to continue. This is a callback to the player\'s solo capability.',
        progressPercent: 45,
        type: 'combat',
      },
      {
        name: 'Planting the Charge',
        description:
          'The seismic charge is a backpack-sized device that will generate a cascading geological failure. The player plants it at the base of the hive core while Marcus and the remaining marines hold a shrinking perimeter. The arming sequence takes 30 seconds of vulnerability. The Wraith know what is happening.',
        progressPercent: 82,
        type: 'setpiece',
      },
      {
        name: 'Fighting Retreat',
        description:
          'With the charge armed and a 120-second timer running, the survivors sprint for the surface. Tunnels collapse behind them. Wraith block the path ahead. The player fights forward, not for victory, but for the exit. Marines are lost. The counter ticks down.',
        progressPercent: 92,
        type: 'combat',
      },
    ],
    narrativeSetup:
      'The Queen is dead, but the hive is not. Seismic data from the Prometheus shows the network extends across the entire southern hemisphere -- hundreds of interconnected nodes feeding into a primary core. Kill the core, and the network dies. Command has committed every remaining asset to a single push: Operation Cauterize. Three mech squads, two infantry platoons, orbital fire support from the Prometheus, and a geological seismic charge capable of cracking tectonic plates. The plan is brutal and the math is worse: the charge will destabilize the planet\'s crust within hours of detonation. Anyone still on the surface when the cascade begins will not leave. This is a one-way mission unless extraction arrives on time. Marcus checks his mech\'s ammunition counter and does not share the number.',
    previousConnection:
      'After escaping the collapsing hive in The Breach, the player and Marcus return to command with intelligence about the hive network. The seismic data confirms that killing the Queen was not enough. Operation Cauterize is authorized within hours.',
    newMechanics: [
      'Large-scale combined arms combat',
      'Orbital strike call-ins',
      'Timed objective under fire (charge planting)',
      'Fighting retreat encounter design',
      'Squad-level AI allies (marines)',
    ],
    enemyTypes: [
      'Wraith Drone (mass assault variant)',
      'Wraith Stalker (tunnel defender)',
      'Wraith Lurker (ventilation ambush)',
      'Wraith Brute (hive guardian)',
      'Wraith Guardian (fortified heavy -- elite)',
      'Wraith Spitter (core defense artillery)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun',
      'SRS99 Sniper Rifle',
      'M41 Rocket Launcher',
      'Warthog Mounted Turret',
      'Orbital Strike Beacon (limited use)',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 9: EXTRACTION
  // --------------------------------------------------------------------------
  extraction: {
    levelId: 'extraction',
    estimatedMinutes: { min: 10, max: 15 },
    pacingStyle: 'holdout',
    narrativeBeat:
      'Hold Landing Zone Omega until the evac Pelican arrives. Escalating waves test every skill the player has acquired across the campaign.',
    emotionalArc:
      'Desperation straining toward hope. The seismic charge is armed. The planet is dying. The only way off is a Pelican that is twenty minutes out. Every wave of Wraith feels like it could be the one that breaks through. The player cycles through every weapon, every tactic, every trick they have learned. When the Pelican finally touches down, the relief is physical.',
    tensionCurve: [
      {
        progress: 0,
        tension: 5,
        description:
          'Arriving at LZ Omega. A flat plateau with natural chokepoints. Time to fortify. The ground trembles with distant detonation echoes.',
      },
      {
        progress: 10,
        tension: 4,
        description:
          'Fortification phase. Placing turrets, mines, and barricades. Marcus positions his mech at the primary approach. The Pelican ETA: 18 minutes.',
      },
      {
        progress: 20,
        tension: 6,
        description:
          'Wave 1: Drones probe the perimeter. Testing defenses. The turrets handle most of it. An appetizer.',
      },
      {
        progress: 35,
        tension: 7,
        description:
          'Wave 2: Stalkers and Brutes push the southern approach. Mines detonate. The player repositions to cover a breach. Pelican ETA: 12 minutes.',
      },
      {
        progress: 50,
        tension: 8,
        description:
          'Wave 3: Spitters bombard from range while Lurkers infiltrate the perimeter from underground. A turret goes down. The defense contracts.',
      },
      {
        progress: 65,
        tension: 9,
        description:
          'Wave 4: A coordinated assault from three directions. Marcus is overwhelmed on the east flank. The player must choose which approach to reinforce.',
      },
      {
        progress: 80,
        tension: 10,
        description:
          'Final wave: Everything. Brutes, Guardians, Spitters, and a swarm of Drones that darkens the sky. The defenses crumble. It is guns and grenades and desperation.',
      },
      {
        progress: 95,
        tension: 7,
        description:
          'The Pelican breaks through the clouds. Door gunners open up on the Wraith. The ramp drops. Marcus shoves the player aboard. "GO!"',
      },
    ],
    keyMoments: [
      {
        name: 'Digging In',
        description:
          'The player has 90 seconds to place defensive emplacements before the first wave. Turret positions, mine placements, and barricade locations are all player-chosen. The defense layout directly affects difficulty. This is the payoff for learning the combat systems across nine previous levels.',
        progressPercent: 8,
        type: 'choice',
      },
      {
        name: 'Southern Breach',
        description:
          'Wave 2 breaks through the southern barricade. The player must sprint to cover the gap while Marcus holds the east. A Brute leads the charge through the breach. The player fights in close quarters with shotgun and grenades, plugging the gap with firepower.',
        progressPercent: 38,
        type: 'combat',
      },
      {
        name: 'Underground Assault',
        description:
          'Wraith Lurkers tunnel up inside the perimeter, bypassing all exterior defenses. They emerge behind the turret line. The player must clear the interior while the exterior defenses handle the frontal assault. Multi-tasking under pressure.',
        progressPercent: 52,
        type: 'combat',
      },
      {
        name: 'The Long Minute',
        description:
          'The final wave arrives with 90 seconds left on the Pelican timer. The defenses are gone. Marcus\'s mech is barely standing. The player is low on ammo. This is designed to be the most intense 90 seconds in the game -- pure survival against overwhelming force.',
        progressPercent: 82,
        type: 'combat',
      },
      {
        name: 'Dust Off',
        description:
          'The Pelican arrives with door gunners blazing. The ramp drops and Marcus physically pushes the player aboard. As the Pelican lifts off, the player watches the LZ disappear under a tide of Wraith. Marcus slumps against the bulkhead: "Tell me there is a bar on that ship."',
        progressPercent: 95,
        type: 'setpiece',
      },
    ],
    narrativeSetup:
      'The seismic charge is counting down. The planet\'s crust will begin to fracture in approximately forty minutes. The only extraction point is Landing Zone Omega -- a flat plateau two kilometers from the hive entrance, chosen because it is the only terrain flat enough for a Pelican to land in the worsening geological conditions. The Pelican is inbound from the Prometheus but the atmospheric turbulence from the seismic activity is slowing its approach. ETA: eighteen minutes. The Wraith know the hive is dying. They are not retreating. They are converging on every human signature on the surface, and the two brightest signatures are standing on an exposed plateau with a flare lit. Marcus parks his battered mech at the eastern approach and loads his last magazine. The player places turrets and mines with the care of someone who knows that every placement might be the difference between extraction and oblivion.',
    previousConnection:
      'After the fighting retreat from the hive in Hive Assault, the survivors make for LZ Omega. The seismic charge is armed and counting down. The Pelican is the only way off the planet.',
    newMechanics: [
      'Defensive emplacement placement (turrets, mines, barricades)',
      'Timed survival with countdown display',
      'Dynamic defense management (repositioning, prioritization)',
      'Ammo conservation across extended engagement',
    ],
    enemyTypes: [
      'Wraith Drone (mass swarm)',
      'Wraith Stalker (flanking specialist)',
      'Wraith Lurker (underground infiltration)',
      'Wraith Brute (breach leader)',
      'Wraith Guardian (elite heavy)',
      'Wraith Spitter (bombardment)',
    ],
    weaponsAvailable: [
      'MA5D Assault Rifle',
      'M6H Sidearm',
      'M9 Frag Grenades',
      'M45 Shotgun',
      'SRS99 Sniper Rifle',
      'M41 Rocket Launcher',
      'Deployable Turret (placed by player)',
      'M168 Proximity Mines (placed by player)',
    ],
  },

  // --------------------------------------------------------------------------
  // LEVEL 10: FINAL ESCAPE
  // --------------------------------------------------------------------------
  final_escape: {
    levelId: 'final_escape',
    estimatedMinutes: { min: 8, max: 12 },
    pacingStyle: 'chase',
    narrativeBeat:
      'The planet is breaking apart. A desperate vehicle sprint across collapsing terrain to reach the launch pad before the surface disintegrates.',
    emotionalArc:
      'Pure adrenaline burning to bittersweet triumph. This is the climax -- no exploration, no puzzle-solving, just speed and survival. The ground literally falls away behind the player. The emotional payload is the ending: reaching the launch pad, blasting off as the planet cracks open, and watching Kepler\'s Promise break apart from orbit. They made it. Barely. Together.',
    tensionCurve: [
      {
        progress: 0,
        tension: 7,
        description:
          'The Pelican sets down at the motor pool. A Warthog is waiting. The ground shakes. Lava geysers erupt in the distance. The launch pad is 8 kilometers away.',
      },
      {
        progress: 10,
        tension: 8,
        description:
          'Full speed down a fracturing highway. The road splits and buckles ahead. Wraith stragglers attack but they are desperate, not organized.',
      },
      {
        progress: 25,
        tension: 9,
        description:
          'The canyon collapses behind the vehicle. A wall of dust and fire chases the Warthog. The speedometer has to stay above critical or the collapse catches up.',
      },
      {
        progress: 40,
        tension: 9,
        description:
          'A bridge across a lava-filled chasm. Halfway across, the supports give. The Warthog goes airborne. The landing is rough but the vehicle holds.',
      },
      {
        progress: 55,
        tension: 10,
        description:
          'The surface cracks open ahead. A river of magma cuts across the road. The player must find an alternate route through collapsing structures at maximum speed.',
      },
      {
        progress: 70,
        tension: 10,
        description:
          'The launch pad is visible. A shuttle sits on the pad, engines warming. Wraith are swarming toward it. Marcus opens fire from the turret: "DRIVE!"',
      },
      {
        progress: 85,
        tension: 10,
        description:
          'Final approach. The road disintegrates behind the wheels. The Warthog hits the launch pad ramp and slides to a stop at the shuttle door.',
      },
      {
        progress: 95,
        tension: 8,
        description:
          'The shuttle launches. Through the viewport, the player watches Kepler\'s Promise fracture -- continents splitting, magma flooding the surface, the hive network burning.',
      },
    ],
    keyMoments: [
      {
        name: 'Clock Is Ticking',
        description:
          'The Pelican drops the player at a motor pool where a Warthog sits with the engine running. Marcus is already in the turret. The HUD displays a geological instability meter -- when it hits red, the surface fails completely. The timer is not minutes. It is the ground itself.',
        progressPercent: 3,
        type: 'setpiece',
      },
      {
        name: 'The Crumbling Road',
        description:
          'The highway ahead fractures in real time. Sections of road tilt and fall into chasms. The player must read the terrain at high speed, choosing paths that still exist. The collapse follows like a wave, always just behind the rear bumper. Slowing down is death.',
        progressPercent: 25,
        type: 'setpiece',
      },
      {
        name: 'Bridge Jump',
        description:
          'A bridge spanning a lava-filled rift begins collapsing from the far end. The player hits the ramp at full speed as the bridge disintegrates behind them. The Warthog goes airborne for three terrifying seconds before slamming down on the far side. Marcus whoops from the turret. The player\'s knuckles are white.',
        progressPercent: 42,
        type: 'setpiece',
      },
      {
        name: 'The Detour',
        description:
          'A magma river blocks the main route. The player must cut through a collapsing industrial district at full speed -- through buildings, over debris, and past Wraith that are themselves fleeing the destruction. The environment is as dangerous as any enemy. The detour is harrowing and disorienting by design.',
        progressPercent: 58,
        type: 'setpiece',
      },
      {
        name: 'Liftoff',
        description:
          'The Warthog skids to a stop at the shuttle ramp. Marcus and the player sprint aboard. The shuttle lifts off as the launch pad crumbles. Through the viewport, the player watches the planet die -- a world splitting open, fire and ash rising into the atmosphere, and the hive network finally, completely burning. Marcus sits down, exhales, and says nothing. The silence is the ending.',
        progressPercent: 92,
        type: 'setpiece',
      },
    ],
    narrativeSetup:
      'The seismic charge has done its work. Kepler\'s Promise is dying. The planet\'s crust has entered a cascading failure state -- tectonic plates are fracturing, magma is breaching the surface, and the hive network is collapsing into the geological chaos it created. The Pelican that extracted the player from LZ Omega drops them at a motor pool eight kilometers from the emergency launch pad where a shuttle is prepped for orbital escape. Eight kilometers of road that is falling apart in real time. A Warthog with a full tank and a mounted gun is the only option. Marcus climbs into the turret with the grim enthusiasm of a man who has decided that if this is the end, it will at least be fast. The drive ahead is not a combat mission. It is an escape from a dying world, and the world is not going quietly. Lava geysers, collapsing terrain, desperate Wraith, and the sheer geological violence of a planet tearing itself apart stand between the player and the shuttle. There is no plan B. There is no second route. There is only speed, reflexes, and the stubborn refusal of two soldiers to die on a world that is not theirs.',
    previousConnection:
      'The Pelican from the Extraction level drops the player at the motor pool. The seismic charge has detonated and the planet is in its death throes. This is the final level.',
    newMechanics: [
      'High-speed vehicle escape (no stopping)',
      'Dynamic terrain destruction (real-time road collapse)',
      'Geological instability meter (global timer)',
      'Vehicle jump sequences',
      'Environmental hazard navigation at speed (lava, debris, collapse)',
    ],
    enemyTypes: [
      'Wraith Drone (scattered, disorganized)',
      'Wraith Brute (roadblock encounters)',
    ],
    weaponsAvailable: [
      'Warthog Mounted Turret',
      'MA5D Assault Rifle (emergency dismount only)',
      'M6H Sidearm (emergency dismount only)',
    ],
  },
};
