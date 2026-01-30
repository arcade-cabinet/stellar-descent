/**
 * Audio Logs Collectible System
 *
 * Audio logs are scattered throughout levels to provide lore and worldbuilding.
 * Each log contains a transcript, speaker info, and ties to a specific level.
 *
 * Based on LORE.md:
 * - Station: Pre-invasion recordings from crew
 * - Surface: Survivor distress calls
 * - Hive: Research team logs before they were overrun
 */

import type { LevelId } from '../levels/types';

/**
 * Speaker/character that recorded the audio log
 */
export interface AudioLogSpeaker {
  name: string;
  title: string;
  portrait: 'commander' | 'ai' | 'marcus' | 'researcher' | 'soldier' | 'technician' | 'unknown';
}

/**
 * Audio log data structure
 */
export interface AudioLog {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Speaker who recorded this log */
  speaker: AudioLogSpeaker;
  /** Level where this log can be found */
  levelId: LevelId;
  /** Full transcript text */
  transcript: string;
  /** Duration in seconds (for simulated playback) */
  duration: number;
  /** Date of recording (in-universe) */
  recordingDate: string;
  /** Optional: Position hint for placement in level */
  positionHint?: { x: number; y: number; z: number };
  /** Optional: Category/tag for filtering */
  category: 'personal' | 'military' | 'research' | 'emergency';
}

/**
 * Audio log discovery state
 */
export interface AudioLogDiscovery {
  logId: string;
  discoveredAt: number; // Unix timestamp
  levelId: LevelId;
  hasBeenPlayed: boolean;
}

// ============================================================================
// SPEAKERS DATABASE
// ============================================================================

export const SPEAKERS: Record<string, AudioLogSpeaker> = {
  vasquez: {
    name: 'Commander Elena Vasquez',
    title: 'Commanding Officer, ANCHOR STATION PROMETHEUS',
    portrait: 'commander',
  },
  marcus: {
    name: 'Corporal Marcus Cole',
    title: 'Mech Operator, Vanguard Recon Team',
    portrait: 'marcus',
  },
  chen: {
    name: 'Dr. Lily Chen',
    title: 'Chief Xenobiologist',
    portrait: 'researcher',
  },
  rodriguez: {
    name: 'Sergeant Miguel Rodriguez',
    title: 'Vanguard Team Lead',
    portrait: 'soldier',
  },
  prometheus_ai: {
    name: 'PROMETHEUS',
    title: 'Station AI System',
    portrait: 'ai',
  },
  kowalski: {
    name: 'Tech Specialist Jan Kowalski',
    title: 'Communications Officer',
    portrait: 'technician',
  },
  unknown_survivor: {
    name: 'Unknown Survivor',
    title: 'Colonist',
    portrait: 'unknown',
  },
  williams: {
    name: 'Private Sarah Williams',
    title: 'Vanguard Scout',
    portrait: 'soldier',
  },
};

// ============================================================================
// AUDIO LOGS DATABASE
// ============================================================================

export const AUDIO_LOGS: AudioLog[] = [
  // ---------------------------------------------------------------------------
  // ANCHOR STATION - Pre-invasion recordings
  // ---------------------------------------------------------------------------
  {
    id: 'station_01',
    title: 'Mission Briefing Supplement',
    speaker: SPEAKERS.vasquez,
    levelId: 'anchor_station',
    category: 'military',
    duration: 45,
    recordingDate: '3147.089',
    transcript: `This is Commander Vasquez, supplemental briefing for Operation Kepler.

What we're sending you into... it's not what the official reports say. The seismic activity that started three weeks ago - it's not natural. Something woke up down there.

Vanguard Team went dark 72 hours ago. Their last transmission mentioned "movement from below." I've requested orbital bombardment authorization, but Colonial Command wants boots on the ground first.

Find out what happened. Find your brother. And Sergeant... if what I suspect is true, getting out alive might be more important than completing the mission.

Vasquez out.`,
    positionHint: { x: -3, y: 1.5, z: 5 },
  },
  {
    id: 'station_02',
    title: 'Routine Maintenance Log',
    speaker: SPEAKERS.prometheus_ai,
    levelId: 'anchor_station',
    category: 'personal',
    duration: 32,
    recordingDate: '3147.086',
    transcript: `Station maintenance log, automated entry.

All systems operating within normal parameters. Drop pod bays A through D have completed their monthly inspection cycle. Hangar bay atmospheric seals rated at 99.7% efficiency.

Addendum: Unusual radio interference detected from planetary surface. Source triangulated to northern canyon region, coinciding with FOB Delta coordinates. Pattern does not match known natural phenomena.

Flagging for communications officer review.

End log.`,
    positionHint: { x: 8, y: 1.5, z: -15 },
  },
  {
    id: 'station_03',
    title: "Marcus's Personal Log",
    speaker: SPEAKERS.marcus,
    levelId: 'anchor_station',
    category: 'personal',
    duration: 55,
    recordingDate: '3147.082',
    transcript: `Hey James, if you're hearing this... well, I guess something went sideways.

I volunteered for Vanguard because I wanted to prove I could handle a real mission without you watching my back. Stupid, right? The mech they gave me is beautiful though - M-47 Titan class. I named her "Big Betty."

The planet... it's not what the surveys said. There's something wrong here. The locals call it "Kepler's Promise" but I'm starting to think it's more like Kepler's Curse.

If things go bad, don't come after me. I mean it.

...Who am I kidding. You'd never listen anyway.

See you on the other side, brother.`,
    positionHint: { x: 2, y: 1.5, z: -8 },
  },

  // ---------------------------------------------------------------------------
  // LANDFALL - First contact recordings
  // ---------------------------------------------------------------------------
  {
    id: 'landfall_01',
    title: 'Distress Beacon Alpha',
    speaker: SPEAKERS.unknown_survivor,
    levelId: 'landfall',
    category: 'emergency',
    duration: 38,
    recordingDate: '3147.088',
    transcript: `[Static]...is anyone receiving? This is mining outpost Gamma-7. We're under attack!

They came from underground - things with claws and... oh God, they're everywhere. The perimeter didn't even slow them down.

We've barricaded in the comm building but the walls... they're coming through the walls!

If anyone can hear this, do NOT send rescue. I repeat, do NOT come to the surface. They're too many. They're too—

[Transmission cuts to static]`,
    positionHint: { x: 15, y: 0.5, z: -30 },
  },
  {
    id: 'landfall_02',
    title: 'Geological Survey Update',
    speaker: SPEAKERS.chen,
    levelId: 'landfall',
    category: 'research',
    duration: 48,
    recordingDate: '3147.075',
    transcript: `Dr. Chen, xenobiology field report, day 45.

The tunnel systems we've discovered are far more extensive than initial surveys indicated. They extend at least 400 meters below the surface, possibly deeper.

What's troubling is the construction. These aren't natural formations. The walls show tool marks - no, scratch that - claw marks. Organized, deliberate patterns.

Something built these tunnels. Something intelligent.

I've requested a full excavation team, but Command is focused on mineral extraction. They're not listening.

I'll continue documenting independently. Someone needs to understand what we're dealing with before—

[Recording ends abruptly]`,
    positionHint: { x: -20, y: 2, z: 45 },
  },
  {
    id: 'landfall_03',
    title: 'Vanguard Check-In',
    speaker: SPEAKERS.rodriguez,
    levelId: 'landfall',
    category: 'military',
    duration: 35,
    recordingDate: '3147.087',
    transcript: `Rodriguez to Prometheus, daily sitrep.

We've established FOB Delta at the designated coordinates. The local terrain is... unsettling. Rock formations that look almost organic. Private Williams swears she saw movement in the canyon last night.

The mech pilot - Cole - he's green but capable. His machine is our best asset if things go hot.

Seismic sensors are picking up regular tremors. Not earthquakes. More like... footsteps. But that would require something massive.

Requesting additional ammunition resupply and a UAV sweep of the northern ridge.

Rodriguez out.`,
    positionHint: { x: 5, y: 1, z: -15 },
  },

  // ---------------------------------------------------------------------------
  // FOB DELTA - Horror and investigation
  // ---------------------------------------------------------------------------
  {
    id: 'fob_delta_01',
    title: 'Final Vanguard Transmission',
    speaker: SPEAKERS.rodriguez,
    levelId: 'fob_delta',
    category: 'emergency',
    duration: 42,
    recordingDate: '3147.089',
    transcript: `[Weapons fire, screaming in background]

This is Rodriguez! FOB Delta is overrun! They came from below - punched right through the floor!

Williams is down. Kowalski is trying to get a signal out. Cole took the mech to draw them away from the command center.

There's... there's hundreds of them. Maybe thousands. The big ones are organizing the smaller ones like a goddamn army.

If anyone receives this, orbital strike these coordinates! Burn it all! There's a nest under us, a massive nest, and something down there is controlling them!

Tell Command... tell them we found what they were looking for. We just didn't know what it—

[Transmission ends with inhuman shrieking]`,
    positionHint: { x: 0, y: 1.2, z: -5 },
  },
  {
    id: 'fob_delta_02',
    title: 'Emergency Broadcast',
    speaker: SPEAKERS.kowalski,
    levelId: 'fob_delta',
    category: 'emergency',
    duration: 28,
    recordingDate: '3147.089',
    transcript: `[Alarms blaring]

This is Kowalski, broadcasting on all frequencies! FOB Delta emergency!

I've managed to boost the signal but I don't know if anyone can hear us through the interference. These things... they emit some kind of jamming field when they swarm.

I'm uploading everything we've documented to the station servers. Bio readings, tactical assessments, the works. If we don't make it, at least the data survives.

The creatures - they're not just animals. They communicate. They plan. And they really, really don't want us here.

Cole's mech is still fighting. If anyone can survive this, it's—

[Power failure sounds, then silence]`,
    positionHint: { x: 8, y: 1, z: 10 },
  },
  {
    id: 'fob_delta_03',
    title: 'Research Notes: Strain-X',
    speaker: SPEAKERS.chen,
    levelId: 'fob_delta',
    category: 'research',
    duration: 52,
    recordingDate: '3147.088',
    transcript: `Final field notes, Dr. Chen.

I've classified the hostile species as Strain-X, pending official designation. Initial autopsy of recovered specimen reveals:

Chitinous exoskeleton - hence the nickname "Chitin" spreading among the troops. Six-limbed body plan. Compound eyes sensitive to infrared. Most disturbing: evidence of a distributed nervous system suggesting hive-mind connectivity.

They're not native to this planet. The biochemistry doesn't match local life. They were here before us, dormant, waiting.

Our mining operations woke them. The vibrations from the drills... it was like ringing a dinner bell.

I've attached recommendations for containment but I fear it's too late. The queen - yes, there's a queen - she's already mobilizing the entire colony.

God help anyone who has to go down there.`,
    positionHint: { x: -6, y: 0.8, z: -8 },
  },

  // ---------------------------------------------------------------------------
  // BROTHERS IN ARMS - Marcus and combat
  // ---------------------------------------------------------------------------
  {
    id: 'brothers_01',
    title: "Betty's Last Stand",
    speaker: SPEAKERS.marcus,
    levelId: 'brothers_in_arms',
    category: 'personal',
    duration: 40,
    recordingDate: '3147.089',
    transcript: `Marcus Cole, Titan pilot, probably final log.

Big Betty's taken a beating but she's still kicking. Lost the left arm to one of those big red bastards, but the autocannons are operational.

I drew the swarm away from FOB Delta. Rodriguez ordered me to run, but... some of my squad mates are still in there. I can't just leave.

The creatures have pulled back. Regrouping, I think. They're smarter than they look.

If James is coming for me - and knowing that stubborn idiot, he probably is - I'll be here. Holding the line.

Come on, brother. Let's show these bugs what the Cole boys are made of.`,
    positionHint: { x: 25, y: 2, z: -40 },
  },
  {
    id: 'brothers_02',
    title: 'Private Williams Last Words',
    speaker: SPEAKERS.williams,
    levelId: 'brothers_in_arms',
    category: 'personal',
    duration: 35,
    recordingDate: '3147.089',
    transcript: `This is Williams. If anyone finds this... tell my family I died fighting.

I managed to get away from the FOB when they breached the north wall. I'm hidden in a rock formation about 2 klicks east.

My leg's torn up pretty bad. The medkit's empty. I can see more of them moving through the canyon - hundreds, marching like an army toward something in the hills.

There's a big one leading them. Twice the size of the others, with these bioluminescent markings. They follow it like soldiers follow a general.

I don't think I'm going to make it. But if anyone survives this... find the nest. Kill their queen.

It's the only way this ends.`,
    positionHint: { x: -35, y: 0.5, z: 20 },
  },
  {
    id: 'brothers_03',
    title: 'The Breach Discovery',
    speaker: SPEAKERS.rodriguez,
    levelId: 'brothers_in_arms',
    category: 'military',
    duration: 44,
    recordingDate: '3147.088',
    transcript: `Rodriguez, tactical assessment.

We've located the primary entrance to the underground hive system. It's a sinkhole approximately 100 meters in diameter, northwest of FOB Delta. The troops are calling it "The Breach."

Thermal imaging shows massive heat signatures below. Bio-luminescent growths cover the walls. The air coming up is warm, humid, and smells like... rotting vegetation? No, more like a hospital. Antiseptic.

I've ordered the area cordoned off. No one goes near it until we have orbital support.

But Command wants samples. They want us to go IN there.

They have no idea what's waiting for us down below.

Rodriguez out.`,
    positionHint: { x: 0, y: 1.5, z: -60 },
  },

  // ---------------------------------------------------------------------------
  // THE BREACH - Deep hive, Queen encounter
  // ---------------------------------------------------------------------------
  {
    id: 'breach_01',
    title: 'Hive Reconnaissance',
    speaker: SPEAKERS.chen,
    levelId: 'the_breach',
    category: 'research',
    duration: 55,
    recordingDate: '3147.087',
    transcript: `Dr. Chen, hive interior observations.

Against my better judgment, I've accompanied the initial recon team into the upper hive.

The architecture is... beautiful, in a horrifying way. Organic construction using a secreted resin that hardens stronger than steel. The tunnels are precisely engineered for temperature and humidity control.

We've found chambers that appear to be nurseries. Egg clusters the size of shuttlecraft. Most are dormant, but some... some are hatching.

The workers ignore us as long as we don't threaten the eggs. But the soldiers - those red-brown brutes - they're watching. Waiting.

There's something deeper. I can feel vibrations through the floor. A heartbeat. The queen is down there.

I have to see her. I have to understand.

[Recording becomes muffled, then ends]`,
    positionHint: { x: 10, y: -5, z: -20 },
  },
  {
    id: 'breach_02',
    title: 'The Queen Awaits',
    speaker: SPEAKERS.prometheus_ai,
    levelId: 'the_breach',
    category: 'research',
    duration: 38,
    recordingDate: '3147.089',
    transcript: `PROMETHEUS automated analysis, hive queen assessment.

Based on recovered sensor data and Dr. Chen's final transmissions, the following profile has been compiled:

The queen specimen measures approximately 4 meters in height. She is partially embedded in the hive structure, serving as both leader and literal heart of the colony.

All Chitin behavior patterns originate from her. When she summons, they respond. When she dies, projections indicate 72-96 hours of disorientation among remaining forces.

Recommendation: Targeted elimination of the queen offers the highest probability of neutralizing the Chitin threat.

Warning: The queen chamber is protected by her most powerful guardians. Any assault team should expect maximum resistance.

This is not a rescue mission. This is pest control.

End analysis.`,
    positionHint: { x: -8, y: -15, z: -45 },
  },
  {
    id: 'breach_03',
    title: "Chen's Last Discovery",
    speaker: SPEAKERS.chen,
    levelId: 'the_breach',
    category: 'research',
    duration: 48,
    recordingDate: '3147.088',
    transcript: `[Whispered, breathing heavily]

I've reached the queen's chamber. She's... magnificent. Terrifying. But magnificent.

She sees me. I know she does. Those compound eyes tracking my every move. But she hasn't called her guards.

I think... I think she's curious. She's never seen a human before. We're as alien to her as she is to us.

I'm going to try to communicate. Not words - she wouldn't understand. But patterns. Mathematics. The universal language.

If I can just show her that we're intelligent, that we can coexist...

[Long pause]

She's... she's responding. The bio-luminescent patterns on her carapace are shifting. She's...

Oh God. She's not trying to communicate.

She's summoning her soldiers.

[Sounds of movement, then screaming]

She doesn't want peace. She wants war. And now she knows everything about us. Everything.

If anyone hears this, you need to kill her. You need to—

[Recording ends]`,
    positionHint: { x: 0, y: -20, z: -80 },
  },

  // ---------------------------------------------------------------------------
  // EXTRACTION - Final battle and escape
  // ---------------------------------------------------------------------------
  {
    id: 'extraction_01',
    title: 'LZ Omega Coordinates',
    speaker: SPEAKERS.vasquez,
    levelId: 'extraction',
    category: 'military',
    duration: 32,
    recordingDate: '3147.089',
    transcript: `Emergency broadcast to all surviving personnel.

The queen is dead. I repeat, the queen is confirmed eliminated. Seismic readings show the hive is collapsing.

LZ Omega has been designated at the following coordinates for emergency extraction. Dropship Valkyrie is en route, ETA 5 minutes from when you receive this message.

To Sergeant Cole and Corporal Cole: outstanding work. You've done what an entire battalion couldn't.

Now get to that LZ. The Chitin are in disarray but they won't stay that way forever. Move fast, stay alive, and I'll see you on board Prometheus.

Vasquez out. And... thank you.`,
    positionHint: { x: 0, y: 1, z: 0 },
  },
  {
    id: 'extraction_02',
    title: 'Colony Future Report',
    speaker: SPEAKERS.prometheus_ai,
    levelId: 'extraction',
    category: 'research',
    duration: 42,
    recordingDate: '3147.090',
    transcript: `PROMETHEUS post-operation analysis.

With the queen eliminated, remaining Chitin forces are exhibiting fragmented behavior patterns. Territorial instincts remain, but coordinated attacks have ceased.

Projections indicate the colony will require 6-8 months to produce a new queen from surviving genetic material. This provides a window for either:

Option A: Full evacuation and orbital bombardment
Option B: Establishing reinforced defensive perimeters and continuing terraforming operations

Command has not yet indicated which option will be pursued.

Personal observation: The Chitin were here first. We awakened them. One could argue they were simply defending their home.

Such philosophical considerations are beyond this unit's programming. Recommend human leadership make final determination.

End report.`,
    positionHint: { x: 15, y: 0.5, z: 25 },
  },
  {
    id: 'extraction_03',
    title: 'Home',
    speaker: SPEAKERS.marcus,
    levelId: 'extraction',
    category: 'personal',
    duration: 45,
    recordingDate: '3147.090',
    transcript: `Marcus Cole, post-mission debrief. Personal addendum.

Big Betty didn't make it. Had to eject when her reactor went critical during the escape. Damn shame - she was a good mech.

But James got me out. Of course he did. That's what big brothers do, right? Even when you tell them not to come, they come anyway. Stubborn jackass.

We killed their queen. We stopped the invasion. And somehow, against all odds, we both made it home.

Command's talking about promotions. Medals. The "Heroes of Kepler's Promise." I don't feel like a hero. I feel like someone who got very, very lucky.

But you know what? I think I'm done trying to prove myself. Next drop, I'm requesting a spot on James's team.

Where I belong.

Cole out.`,
    positionHint: { x: -10, y: 1.2, z: 40 },
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all audio logs for a specific level
 */
export function getAudioLogsByLevel(levelId: LevelId): AudioLog[] {
  return AUDIO_LOGS.filter((log) => log.levelId === levelId);
}

/**
 * Get a specific audio log by ID
 */
export function getAudioLogById(logId: string): AudioLog | undefined {
  return AUDIO_LOGS.find((log) => log.id === logId);
}

/**
 * Get audio log count per level
 */
export function getAudioLogCountByLevel(): Record<LevelId, number> {
  const counts: Record<string, number> = {};
  for (const log of AUDIO_LOGS) {
    counts[log.levelId] = (counts[log.levelId] || 0) + 1;
  }
  return counts as Record<LevelId, number>;
}

/**
 * Get total audio log count
 */
export function getTotalAudioLogCount(): number {
  return AUDIO_LOGS.length;
}
