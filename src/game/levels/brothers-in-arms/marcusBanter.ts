/**
 * Marcus Banter System - Brothers in Arms Level
 *
 * Provides dynamic combat callouts, situation-based dialogue, and banter
 * from Marcus during the wave combat sections. Creates an immersive
 * experience of fighting alongside a capable AI ally.
 *
 * DIALOGUE CATEGORIES:
 * - Combat callouts (enemy spotted, kills confirmed, etc.)
 * - Situation triggers (low health, multiple enemies, brute spotted, etc.)
 * - Idle banter (between waves, nostalgic remarks)
 * - Player acknowledgements (good shots, combos, etc.)
 * - Brotherly banter and emotional beats
 * - Story dialogue at key locations
 *
 * CHARACTER DYNAMIC:
 * - James (Player): Protective older brother, calm under pressure
 * - Marcus (AI Ally): Spirited younger brother, eager to prove himself
 *
 * The dialogue establishes their relationship through:
 * - Shared memories from childhood and past missions
 * - Marcus looking up to James while showing his own competence
 * - James's protective instincts vs Marcus's desire for independence
 * - Humor and warmth even in dire circumstances
 */

import type { CommsMessage } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

export type DialogueTrigger =
  // Combat events
  | 'enemy_spotted'
  | 'enemy_killed'
  | 'multi_kill'
  | 'headshot'
  | 'grenade_kill'
  | 'marcus_kill'
  | 'brute_spotted'
  | 'brute_killed'
  | 'spitter_spotted'
  | 'drone_swarm'
  // Player state
  | 'player_low_health'
  | 'player_critical'
  | 'player_healed'
  | 'player_near_death_save'
  // Combat situations
  | 'surrounded'
  | 'flanked'
  | 'cover_recommended'
  | 'clear_area'
  // Wave events
  | 'wave_start'
  | 'wave_halfway'
  | 'wave_almost_done'
  | 'wave_complete'
  | 'final_wave_start'
  | 'all_waves_complete'
  // Idle/downtime
  | 'idle_banter'
  | 'between_waves'
  // Fire support
  | 'fire_support_acknowledged'
  | 'fire_support_complete'
  // Special
  | 'first_kill'
  | 'kill_streak_5'
  | 'kill_streak_10'
  | 'near_breach'
  // Brotherly emotional beats
  | 'marcus_taking_damage'
  | 'marcus_low_health'
  | 'marcus_recovered'
  | 'coordinated_kill'
  | 'long_range_kill'
  | 'close_call_player'
  | 'close_call_marcus'
  | 'brotherly_moment'
  | 'reminisce_europa'
  | 'reminisce_childhood'
  | 'reminisce_training'
  | 'comment_on_mech'
  | 'worry_about_family'
  | 'determination'
  | 'gratitude'
  // Location-based story triggers
  | 'viewing_breach_first'
  | 'near_canyon_wall'
  | 'defending_position'
  | 'marcus_repositioning'
  // Marcus downed/revive events
  | 'marcus_downed'
  | 'marcus_reviving'
  | 'marcus_revived'
  | 'player_assist_revive';

export interface DialogueLine {
  text: string;
  /** Priority level (higher = more likely to interrupt) */
  priority: number;
  /** Minimum seconds before this line can repeat */
  cooldown: number;
}

export interface BanterState {
  lastDialogueTime: number;
  lastTriggerTimes: Map<DialogueTrigger, number>;
  currentKillStreak: number;
  totalKills: number;
  marcusKills: number;
  playerKills: number;
  linesSpoken: Set<string>;
  currentWave: number;
}

export interface BanterConfig {
  /** Minimum time between any dialogue (ms) */
  globalCooldown: number;
  /** Chance (0-1) to trigger optional banter */
  banterChance: number;
  /** Whether to allow interrupting current dialogue */
  allowInterrupts: boolean;
}

// ============================================================================
// CHARACTER DEFINITION
// ============================================================================

const MARCUS: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// ============================================================================
// DIALOGUE POOLS
// ============================================================================

/**
 * Combat callouts - Short, punchy lines for active combat
 * Marcus uses military brevity but his youth shows through
 */
const ENEMY_SPOTTED_LINES: DialogueLine[] = [
  { text: 'Contact!', priority: 3, cooldown: 8 },
  { text: 'Eyes front!', priority: 3, cooldown: 8 },
  { text: 'Got movement!', priority: 3, cooldown: 8 },
  { text: 'Hostiles incoming!', priority: 4, cooldown: 10 },
  { text: 'Here they come!', priority: 4, cooldown: 10 },
  { text: 'Heads up, James!', priority: 4, cooldown: 12 },
  { text: 'More coming in!', priority: 3, cooldown: 8 },
  { text: 'Got a visual!', priority: 3, cooldown: 8 },
];

const ENEMY_KILLED_LINES: DialogueLine[] = [
  { text: 'Tango down!', priority: 2, cooldown: 5 },
  { text: 'Got one!', priority: 2, cooldown: 5 },
  { text: 'Scratch one!', priority: 2, cooldown: 5 },
  { text: 'Another one bites the dust.', priority: 2, cooldown: 8 },
  { text: 'Clean kill.', priority: 2, cooldown: 6 },
  { text: 'Nice shot!', priority: 2, cooldown: 5 },
  { text: 'That one felt personal.', priority: 2, cooldown: 10 },
  { text: 'Just like you taught me.', priority: 3, cooldown: 15 },
];

const MULTI_KILL_LINES: DialogueLine[] = [
  { text: 'Nice grouping!', priority: 5, cooldown: 15 },
  { text: 'Two for one, love it!', priority: 5, cooldown: 15 },
  { text: 'That was beautiful, James!', priority: 5, cooldown: 15 },
  { text: 'Efficient as always.', priority: 5, cooldown: 12 },
  { text: 'They never stood a chance!', priority: 5, cooldown: 15 },
  { text: 'Show off.', priority: 4, cooldown: 20 },
  {
    text: "Alright, now you're just showing off for your little brother.",
    priority: 5,
    cooldown: 25,
  },
  { text: "That's the big brother I remember!", priority: 5, cooldown: 20 },
];

const HEADSHOT_LINES: DialogueLine[] = [
  { text: 'Right between the eyes!', priority: 4, cooldown: 12 },
  { text: 'Textbook shot!', priority: 4, cooldown: 12 },
  { text: 'Sharp shooting!', priority: 4, cooldown: 12 },
  { text: 'You still got it, brother.', priority: 5, cooldown: 20 },
  { text: 'Damn, James. That was surgical.', priority: 5, cooldown: 15 },
  {
    text: "Remember when you taught me that shot? Still can't do it that clean.",
    priority: 5,
    cooldown: 30,
  },
  { text: 'That one was for Dad.', priority: 6, cooldown: 45 },
];

const GRENADE_KILL_LINES: DialogueLine[] = [
  { text: 'Boom! Nice throw!', priority: 5, cooldown: 10 },
  { text: 'Frag out - and down!', priority: 5, cooldown: 10 },
  { text: 'That cleared them out!', priority: 5, cooldown: 10 },
  { text: 'Love the fireworks!', priority: 4, cooldown: 12 },
];

const MARCUS_KILL_LINES: DialogueLine[] = [
  { text: 'Got him!', priority: 2, cooldown: 4 },
  { text: 'Autocannon doing work!', priority: 3, cooldown: 8 },
  { text: 'Target eliminated.', priority: 2, cooldown: 5 },
  { text: 'HAMMER delivers!', priority: 3, cooldown: 10 },
  { text: 'Dropping them like flies!', priority: 3, cooldown: 10 },
  { text: "That's one for me!", priority: 2, cooldown: 6 },
  { text: 'Score one for the little brother!', priority: 3, cooldown: 15 },
  { text: 'Bet you wish you had this mech, huh?', priority: 3, cooldown: 20 },
  { text: 'I learned from the best.', priority: 4, cooldown: 25 },
];

/**
 * Special enemy callouts
 */
const BRUTE_SPOTTED_LINES: DialogueLine[] = [
  { text: 'BRUTE! Watch yourself!', priority: 8, cooldown: 30 },
  { text: 'Big one incoming! Focus fire!', priority: 8, cooldown: 30 },
  { text: 'Alpha target! Take it down!', priority: 8, cooldown: 30 },
  { text: "That thing's huge - aim for the joints!", priority: 8, cooldown: 30 },
];

const BRUTE_KILLED_LINES: DialogueLine[] = [
  { text: 'The bigger they are... you know the rest.', priority: 7, cooldown: 60 },
  { text: 'Brute down! Nice work!', priority: 7, cooldown: 60 },
  { text: "That'll teach them to send the big guns.", priority: 7, cooldown: 60 },
];

const SPITTER_SPOTTED_LINES: DialogueLine[] = [
  { text: 'Spitter! Watch for acid!', priority: 7, cooldown: 20 },
  { text: 'Green glow - spitter on the field!', priority: 7, cooldown: 20 },
  { text: 'Acid incoming! Keep moving!', priority: 7, cooldown: 20 },
];

const DRONE_SWARM_LINES: DialogueLine[] = [
  { text: 'Swarm incoming! Spread your fire!', priority: 6, cooldown: 25 },
  { text: "They're everywhere!", priority: 6, cooldown: 25 },
  { text: "Don't let them surround you!", priority: 6, cooldown: 25 },
];

/**
 * Player state reactions - Marcus's protective instincts shine through
 * These lines show his fear of losing his brother
 */
const PLAYER_LOW_HEALTH_LINES: DialogueLine[] = [
  { text: 'James, your vitals are dropping!', priority: 7, cooldown: 30 },
  { text: 'Get to cover! You need a breather!', priority: 7, cooldown: 30 },
  { text: "You're hit bad - fall back!", priority: 7, cooldown: 30 },
  { text: "Don't you die on me!", priority: 8, cooldown: 45 },
  { text: 'James! Get behind me!', priority: 8, cooldown: 30 },
  { text: "I can't lose you too!", priority: 8, cooldown: 60 },
  {
    text: "You're not allowed to die. That's an order from your little brother!",
    priority: 7,
    cooldown: 45,
  },
];

const PLAYER_CRITICAL_LINES: DialogueLine[] = [
  { text: 'JAMES! Find cover NOW!', priority: 9, cooldown: 60 },
  { text: "You're critical! I'm covering you!", priority: 9, cooldown: 60 },
  { text: 'Stay with me, brother!', priority: 9, cooldown: 60 },
  { text: 'No no no - JAMES! Get behind something!', priority: 9, cooldown: 60 },
  { text: "I didn't survive three weeks alone just to watch you die!", priority: 9, cooldown: 90 },
  { text: 'HAMMER moving to shield you - hold on!', priority: 9, cooldown: 60 },
];

const PLAYER_HEALED_LINES: DialogueLine[] = [
  { text: 'Looking better. Stay sharp.', priority: 4, cooldown: 45 },
  { text: "Good, you're back in the fight.", priority: 4, cooldown: 45 },
  { text: "That's better. Had me worried there.", priority: 4, cooldown: 45 },
  { text: "Okay. Don't scare me like that again.", priority: 5, cooldown: 60 },
];

const NEAR_DEATH_SAVE_LINES: DialogueLine[] = [
  { text: 'Close one! Thought I lost you there.', priority: 8, cooldown: 120 },
  { text: 'Mom would kill me if I let you die here.', priority: 8, cooldown: 120 },
  { text: "My heart stopped. Please don't do that again.", priority: 8, cooldown: 120 },
  { text: 'James... I thought... Just stay close, okay?', priority: 9, cooldown: 150 },
  { text: 'You stubborn idiot. You scared the hell out of me.', priority: 8, cooldown: 120 },
];

/**
 * Combat situation callouts
 */
const SURROUNDED_LINES: DialogueLine[] = [
  { text: "They're flanking! Watch your six!", priority: 7, cooldown: 25 },
  { text: 'Multiple contacts - all directions!', priority: 7, cooldown: 25 },
  { text: 'Back to back! Just like training!', priority: 6, cooldown: 30 },
];

const FLANKED_LINES: DialogueLine[] = [
  { text: 'Behind you!', priority: 8, cooldown: 10 },
  { text: 'Check your rear!', priority: 8, cooldown: 10 },
  { text: 'Contact from behind!', priority: 8, cooldown: 10 },
];

const COVER_RECOMMENDED_LINES: DialogueLine[] = [
  { text: 'Use those rocks for cover!', priority: 5, cooldown: 30 },
  { text: "Don't be a hero - get behind something!", priority: 5, cooldown: 30 },
];

const CLEAR_AREA_LINES: DialogueLine[] = [
  { text: 'Area clear. Catch your breath.', priority: 4, cooldown: 20 },
  { text: 'Sector secure.', priority: 4, cooldown: 20 },
  { text: 'All hostiles neutralized.', priority: 4, cooldown: 20 },
];

/**
 * Wave progression dialogue
 */
const WAVE_HALFWAY_LINES: DialogueLine[] = [
  { text: "Halfway there! Don't let up!", priority: 5, cooldown: 60 },
  { text: 'Keep the pressure on!', priority: 5, cooldown: 60 },
  { text: "We're thinning them out!", priority: 5, cooldown: 60 },
];

const WAVE_ALMOST_DONE_LINES: DialogueLine[] = [
  { text: 'Just a few more!', priority: 5, cooldown: 60 },
  { text: 'Finish them off!', priority: 5, cooldown: 60 },
  { text: 'Last ones - make it count!', priority: 5, cooldown: 60 },
];

const FINAL_WAVE_START_LINES: DialogueLine[] = [
  { text: "Final wave! Everything they've got!", priority: 8, cooldown: 120 },
  { text: 'This is it! Give them hell!', priority: 8, cooldown: 120 },
  { text: "Last push! Don't hold anything back!", priority: 8, cooldown: 120 },
];

const ALL_WAVES_COMPLETE_LINES: DialogueLine[] = [
  { text: "That's all of them... We did it, James.", priority: 9, cooldown: 300 },
  { text: 'Just like old times. Damn good to fight beside you again.', priority: 9, cooldown: 300 },
];

/**
 * Idle and between-wave banter - Establishes the brothers' relationship
 * These moments of quiet let their bond shine through
 */
const BETWEEN_WAVES_LINES: DialogueLine[] = [
  { text: 'Remember when we thought basic training was hard?', priority: 3, cooldown: 60 },
  { text: 'Wish we had a beer. This would be a great story.', priority: 3, cooldown: 60 },
  { text: "Dad's old hunting rifle couldn't handle these things.", priority: 3, cooldown: 60 },
  { text: 'You ever miss the quiet ops? Intel gathering, recon?', priority: 3, cooldown: 60 },
  { text: 'These things stink worse than your old gym bag.', priority: 3, cooldown: 60 },
  { text: 'Remember the lake house? Simpler times.', priority: 3, cooldown: 75 },
  {
    text: "I kept thinking about that summer at Grandpa's. Before all this.",
    priority: 4,
    cooldown: 90,
  },
  { text: 'You know I only joined up because of you, right?', priority: 4, cooldown: 120 },
  {
    text: 'Thought I was done for. Then I heard your callsign on the comms. Cried like a baby.',
    priority: 5,
    cooldown: 150,
  },
];

const IDLE_BANTER_LINES: DialogueLine[] = [
  { text: 'Been down here three weeks. Felt like three years.', priority: 2, cooldown: 90 },
  { text: "The mech's taking a beating but she'll hold.", priority: 2, cooldown: 90 },
  { text: 'Thanks for coming, James. Seriously.', priority: 3, cooldown: 120 },
  { text: 'When we get back, drinks are on me. Permanently.', priority: 2, cooldown: 90 },
  { text: "Mom's gonna have a fit when she hears about this.", priority: 2, cooldown: 90 },
  { text: 'You know she still calls me every week? Even out here.', priority: 3, cooldown: 100 },
  {
    text: 'I kept your old dog tags in the cockpit. Felt like you were watching over me.',
    priority: 4,
    cooldown: 180,
  },
  {
    text: 'I thought about a lot of things alone out here. Mostly regrets.',
    priority: 3,
    cooldown: 120,
  },
  {
    text: "Should've told you more often. You're a good brother, James.",
    priority: 5,
    cooldown: 240,
  },
  { text: "When I make it home, I'm hugging Mom so hard.", priority: 3, cooldown: 90 },
  {
    text: "HAMMER's AI keeps me company, but it's not the same as talking to you.",
    priority: 3,
    cooldown: 100,
  },
];

/**
 * Brotherly emotional beats - Deep character moments
 * These are rarer but carry significant emotional weight
 */
const BROTHERLY_MOMENT_LINES: DialogueLine[] = [
  { text: 'I always wanted to be like you, James. Still do.', priority: 6, cooldown: 300 },
  {
    text: 'Remember when I broke my arm and you carried me three miles home? Never told you how much that meant.',
    priority: 6,
    cooldown: 300,
  },
  { text: 'Dad would be proud. Both of us, fighting side by side.', priority: 6, cooldown: 300 },
  {
    text: "You know what kept me going? Knowing you'd come. You always do.",
    priority: 7,
    cooldown: 360,
  },
  {
    text: "I'm not the scared kid who followed you into the woods anymore. But I'm still your little brother.",
    priority: 6,
    cooldown: 300,
  },
];

const REMINISCE_EUROPA_LINES: DialogueLine[] = [
  {
    text: 'Europa was bad, but at least it was cold. These things thrive in heat.',
    priority: 3,
    cooldown: 90,
  },
  {
    text: "Remember the ice spiders on Europa? I'll take these over those any day.",
    priority: 3,
    cooldown: 90,
  },
  {
    text: "You saved my life on Europa. Guess I'm still working off that debt.",
    priority: 4,
    cooldown: 120,
  },
  {
    text: 'The Europa drop was my first real combat. You kept me alive.',
    priority: 4,
    cooldown: 150,
  },
];

const REMINISCE_CHILDHOOD_LINES: DialogueLine[] = [
  {
    text: 'Remember building that treehouse? You let me hammer in the last nail.',
    priority: 3,
    cooldown: 120,
  },
  {
    text: 'I still have that scar from when we were play-fighting with sticks.',
    priority: 3,
    cooldown: 120,
  },
  {
    text: 'Mom always said you were born thirty years old. Too serious.',
    priority: 3,
    cooldown: 120,
  },
  {
    text: 'You used to read me stories when I had nightmares. Funny how that stuck with me.',
    priority: 4,
    cooldown: 180,
  },
];

const REMINISCE_TRAINING_LINES: DialogueLine[] = [
  {
    text: "Drill sergeant said we were the worst recruits he'd ever seen. Look at us now.",
    priority: 3,
    cooldown: 90,
  },
  {
    text: 'You covered for me so many times in training. Never got to thank you properly.',
    priority: 4,
    cooldown: 120,
  },
  {
    text: 'Remember when you talked me out of quitting after week two?',
    priority: 4,
    cooldown: 120,
  },
];

const COMMENT_ON_MECH_LINES: DialogueLine[] = [
  {
    text: "They gave me HAMMER because nobody else wanted the old girl. She's got character.",
    priority: 2,
    cooldown: 90,
  },
  {
    text: "Eight meters of walking destruction. And she still can't outrun you.",
    priority: 3,
    cooldown: 90,
  },
  {
    text: "Wish you could see inside the cockpit. I've got pictures of the family up here.",
    priority: 3,
    cooldown: 120,
  },
  {
    text: "The techs said HAMMER was obsolete. Tell that to the things I've killed.",
    priority: 3,
    cooldown: 100,
  },
];

const WORRY_ABOUT_FAMILY_LINES: DialogueLine[] = [
  { text: "Think Mom knows we're both down here?", priority: 3, cooldown: 120 },
  {
    text: "If I don't make it... tell Mom I love her. And that I'm sorry for the grey hairs.",
    priority: 5,
    cooldown: 300,
  },
  { text: "We both better make it home. Mom can't lose both of us.", priority: 5, cooldown: 180 },
];

const DETERMINATION_LINES: DialogueLine[] = [
  { text: "We're Coles. We don't quit.", priority: 4, cooldown: 120 },
  { text: "Dad didn't raise quitters. Let's finish this.", priority: 4, cooldown: 120 },
  {
    text: "I've survived three weeks alone. With you here? We're unstoppable.",
    priority: 5,
    cooldown: 150,
  },
  {
    text: "They don't know who they're messing with. The Cole brothers.",
    priority: 5,
    cooldown: 180,
  },
];

const GRATITUDE_LINES: DialogueLine[] = [
  { text: 'I know you disobeyed orders to come find me. Thank you.', priority: 5, cooldown: 300 },
  { text: 'You always put family first. Even when it costs you.', priority: 5, cooldown: 300 },
  { text: "When this is over, I'll never take you for granted again.", priority: 5, cooldown: 300 },
];

/**
 * Fire support callouts
 */
const FIRE_SUPPORT_ACKNOWLEDGED_LINES: DialogueLine[] = [
  { text: 'Covering fire! Get down!', priority: 6, cooldown: 30 },
  { text: 'Suppressing! Move when ready!', priority: 6, cooldown: 30 },
  { text: 'HAMMER going loud!', priority: 6, cooldown: 30 },
  { text: "On it! They won't know what hit them!", priority: 6, cooldown: 30 },
];

const FIRE_SUPPORT_COMPLETE_LINES: DialogueLine[] = [
  { text: 'Suppression complete. Area softened up.', priority: 4, cooldown: 30 },
  { text: "That should've thinned the herd.", priority: 4, cooldown: 30 },
];

/**
 * Kill streak acknowledgements
 */
const FIRST_KILL_LINES: DialogueLine[] = [
  { text: "First blood! Let's keep it going!", priority: 5, cooldown: 300 },
  { text: "There's the James I know!", priority: 5, cooldown: 300 },
];

const KILL_STREAK_5_LINES: DialogueLine[] = [
  { text: "You're on fire! Keep it up!", priority: 5, cooldown: 60 },
  { text: "Five down - they can't touch you!", priority: 5, cooldown: 60 },
];

const KILL_STREAK_10_LINES: DialogueLine[] = [
  { text: 'TEN! Command should see this!', priority: 6, cooldown: 120 },
  { text: "You're a one-man army out there!", priority: 6, cooldown: 120 },
  { text: 'Remind me never to get on your bad side.', priority: 6, cooldown: 120 },
];

const NEAR_BREACH_LINES: DialogueLine[] = [
  { text: "That's the hive entrance. Stay focused.", priority: 5, cooldown: 60 },
  { text: 'The source of all this is down there.', priority: 5, cooldown: 60 },
  { text: "Can't follow you into that pit. HAMMER's too big.", priority: 6, cooldown: 120 },
  { text: 'I hate that you have to go down there alone.', priority: 6, cooldown: 120 },
  { text: "Promise me you'll come back. Promise me, James.", priority: 7, cooldown: 180 },
];

/**
 * Marcus taking damage - Shows his vulnerability despite the mech
 */
const MARCUS_TAKING_DAMAGE_LINES: DialogueLine[] = [
  { text: "I'm hit!", priority: 5, cooldown: 20 },
  { text: "HAMMER's taking fire!", priority: 5, cooldown: 20 },
  { text: 'Got one on me!', priority: 5, cooldown: 20 },
  { text: 'Ow! That one got through!', priority: 5, cooldown: 25 },
];

const MARCUS_LOW_HEALTH_LINES: DialogueLine[] = [
  { text: "HAMMER's in bad shape. Armor's failing.", priority: 7, cooldown: 60 },
  { text: "I'm taking too much damage here!", priority: 7, cooldown: 60 },
  { text: "Systems are failing. But I'm not leaving you!", priority: 8, cooldown: 90 },
  { text: 'If HAMMER goes down... James, you need to run.', priority: 8, cooldown: 120 },
];

const MARCUS_RECOVERED_LINES: DialogueLine[] = [
  { text: 'Repairs holding. Back in the fight.', priority: 4, cooldown: 60 },
  { text: "HAMMER's back online. Let's go.", priority: 4, cooldown: 60 },
  { text: "Okay, I'm good. Don't worry about me.", priority: 4, cooldown: 60 },
];

/**
 * Close calls - When either brother narrowly avoids death
 */
const CLOSE_CALL_PLAYER_LINES: DialogueLine[] = [
  { text: 'JAMES! You okay?!', priority: 8, cooldown: 45 },
  { text: 'That was too close!', priority: 7, cooldown: 45 },
  { text: 'My heart just stopped. Are you hurt?', priority: 8, cooldown: 60 },
  { text: 'Next time, duck faster!', priority: 6, cooldown: 45 },
];

const CLOSE_CALL_MARCUS_LINES: DialogueLine[] = [
  { text: 'Whoa! That almost got me!', priority: 6, cooldown: 30 },
  { text: 'Too close! Way too close!', priority: 6, cooldown: 30 },
  { text: "HAMMER's warning systems are screaming at me!", priority: 6, cooldown: 45 },
];

/**
 * Coordinated actions - When the brothers work together
 */
const COORDINATED_KILL_LINES: DialogueLine[] = [
  { text: 'Teamwork! Just like old times!', priority: 5, cooldown: 30 },
  { text: "You spot 'em, I drop 'em!", priority: 5, cooldown: 30 },
  { text: "That's how the Cole brothers do it!", priority: 6, cooldown: 45 },
  { text: 'See? Unstoppable together.', priority: 5, cooldown: 40 },
];

const LONG_RANGE_KILL_LINES: DialogueLine[] = [
  { text: 'Nice reach! You always had the better aim.', priority: 4, cooldown: 30 },
  { text: 'Got him from way out there. Impressive.', priority: 4, cooldown: 30 },
];

/**
 * Location-based story triggers - First time seeing key areas
 */
const VIEWING_BREACH_FIRST_LINES: DialogueLine[] = [
  {
    text: "There it is. The Breach. That's where they keep coming from.",
    priority: 7,
    cooldown: 600,
  },
  {
    text: 'I watched them pour out of there for days. Thousands of them.',
    priority: 7,
    cooldown: 600,
  },
  { text: 'Something ancient lives down there. I can feel it.', priority: 7, cooldown: 600 },
];

const NEAR_CANYON_WALL_LINES: DialogueLine[] = [
  { text: 'Use the walls for cover. I learned that the hard way.', priority: 3, cooldown: 90 },
  { text: 'Stay out of the open. They can smell you.', priority: 3, cooldown: 90 },
];

const DEFENDING_POSITION_LINES: DialogueLine[] = [
  { text: 'This is where I held them off. For three weeks.', priority: 4, cooldown: 120 },
  {
    text: "I know every rock, every angle. They won't surprise us here.",
    priority: 4,
    cooldown: 120,
  },
];

/**
 * Marcus downed/revive lines - Critical emotional moment when Marcus is incapacitated
 */
const MARCUS_DOWNED_LINES: DialogueLine[] = [
  { text: 'HAMMER down! Systems critical!', priority: 9, cooldown: 120 },
  { text: "James... I'm hit bad! Can't move!", priority: 9, cooldown: 120 },
  { text: 'Major failure! Need time to reboot!', priority: 9, cooldown: 120 },
  { text: "I'm down! Hold them off!", priority: 9, cooldown: 120 },
];

const MARCUS_REVIVING_LINES: DialogueLine[] = [
  { text: 'Systems coming back online...', priority: 6, cooldown: 10 },
  { text: 'Rebooting primary systems...', priority: 6, cooldown: 10 },
  { text: 'Almost there... just need a moment...', priority: 6, cooldown: 10 },
  { text: "Don't give up on me yet...", priority: 7, cooldown: 15 },
];

const MARCUS_REVIVED_LINES: DialogueLine[] = [
  { text: "I'm back! Sorry about that!", priority: 7, cooldown: 180 },
  { text: 'HAMMER operational! Thanks for the cover!', priority: 7, cooldown: 180 },
  { text: "Back in action! Let's finish this!", priority: 7, cooldown: 180 },
  { text: "That was close... won't happen again!", priority: 7, cooldown: 180 },
];

const PLAYER_ASSIST_REVIVE_LINES: DialogueLine[] = [
  { text: 'Your presence is boosting my morale, brother!', priority: 5, cooldown: 8 },
  { text: 'Having you close helps the systems recalibrate!', priority: 5, cooldown: 8 },
  { text: 'Thanks for staying with me, James!', priority: 5, cooldown: 8 },
  { text: 'Almost there - keep them off us!', priority: 5, cooldown: 8 },
];

const MARCUS_REPOSITIONING_LINES: DialogueLine[] = [
  { text: 'Moving to a better angle!', priority: 3, cooldown: 30 },
  { text: 'Repositioning!', priority: 3, cooldown: 30 },
  { text: 'Finding higher ground!', priority: 3, cooldown: 30 },
];

// ============================================================================
// DIALOGUE MAPPING
// ============================================================================

const DIALOGUE_MAP: Record<DialogueTrigger, DialogueLine[]> = {
  // Combat events
  enemy_spotted: ENEMY_SPOTTED_LINES,
  enemy_killed: ENEMY_KILLED_LINES,
  multi_kill: MULTI_KILL_LINES,
  headshot: HEADSHOT_LINES,
  grenade_kill: GRENADE_KILL_LINES,
  marcus_kill: MARCUS_KILL_LINES,
  brute_spotted: BRUTE_SPOTTED_LINES,
  brute_killed: BRUTE_KILLED_LINES,
  spitter_spotted: SPITTER_SPOTTED_LINES,
  drone_swarm: DRONE_SWARM_LINES,
  // Player state
  player_low_health: PLAYER_LOW_HEALTH_LINES,
  player_critical: PLAYER_CRITICAL_LINES,
  player_healed: PLAYER_HEALED_LINES,
  player_near_death_save: NEAR_DEATH_SAVE_LINES,
  // Combat situations
  surrounded: SURROUNDED_LINES,
  flanked: FLANKED_LINES,
  cover_recommended: COVER_RECOMMENDED_LINES,
  clear_area: CLEAR_AREA_LINES,
  // Wave events
  wave_start: [], // Handled by cinematics.ts COMMS
  wave_halfway: WAVE_HALFWAY_LINES,
  wave_almost_done: WAVE_ALMOST_DONE_LINES,
  wave_complete: [], // Handled by cinematics.ts COMMS
  final_wave_start: FINAL_WAVE_START_LINES,
  all_waves_complete: ALL_WAVES_COMPLETE_LINES,
  // Idle/downtime
  idle_banter: IDLE_BANTER_LINES,
  between_waves: BETWEEN_WAVES_LINES,
  // Fire support
  fire_support_acknowledged: FIRE_SUPPORT_ACKNOWLEDGED_LINES,
  fire_support_complete: FIRE_SUPPORT_COMPLETE_LINES,
  // Special kill events
  first_kill: FIRST_KILL_LINES,
  kill_streak_5: KILL_STREAK_5_LINES,
  kill_streak_10: KILL_STREAK_10_LINES,
  near_breach: NEAR_BREACH_LINES,
  // Brotherly emotional beats
  marcus_taking_damage: MARCUS_TAKING_DAMAGE_LINES,
  marcus_low_health: MARCUS_LOW_HEALTH_LINES,
  marcus_recovered: MARCUS_RECOVERED_LINES,
  coordinated_kill: COORDINATED_KILL_LINES,
  long_range_kill: LONG_RANGE_KILL_LINES,
  close_call_player: CLOSE_CALL_PLAYER_LINES,
  close_call_marcus: CLOSE_CALL_MARCUS_LINES,
  brotherly_moment: BROTHERLY_MOMENT_LINES,
  reminisce_europa: REMINISCE_EUROPA_LINES,
  reminisce_childhood: REMINISCE_CHILDHOOD_LINES,
  reminisce_training: REMINISCE_TRAINING_LINES,
  comment_on_mech: COMMENT_ON_MECH_LINES,
  worry_about_family: WORRY_ABOUT_FAMILY_LINES,
  determination: DETERMINATION_LINES,
  gratitude: GRATITUDE_LINES,
  // Location-based story triggers
  viewing_breach_first: VIEWING_BREACH_FIRST_LINES,
  near_canyon_wall: NEAR_CANYON_WALL_LINES,
  defending_position: DEFENDING_POSITION_LINES,
  marcus_repositioning: MARCUS_REPOSITIONING_LINES,
  // Marcus downed/revive events
  marcus_downed: MARCUS_DOWNED_LINES,
  marcus_reviving: MARCUS_REVIVING_LINES,
  marcus_revived: MARCUS_REVIVED_LINES,
  player_assist_revive: PLAYER_ASSIST_REVIVE_LINES,
};

// ============================================================================
// BANTER MANAGER CLASS
// ============================================================================

/**
 * MarcusBanterManager handles dynamic dialogue triggers during combat.
 * It manages cooldowns, priorities, and ensures dialogue feels natural
 * without being overwhelming.
 */
export class MarcusBanterManager {
  private state: BanterState;
  private config: BanterConfig;
  private onCommsMessage: (message: CommsMessage) => void;
  private currentDialoguePriority: number = 0;
  private pendingDialogue: ReturnType<typeof setTimeout> | null = null;

  constructor(onCommsMessage: (message: CommsMessage) => void, config: Partial<BanterConfig> = {}) {
    this.onCommsMessage = onCommsMessage;
    this.config = {
      globalCooldown: 3000, // 3 seconds between any dialogue
      banterChance: 0.4, // 40% chance for optional banter
      allowInterrupts: true,
      ...config,
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): BanterState {
    return {
      lastDialogueTime: 0,
      lastTriggerTimes: new Map(),
      currentKillStreak: 0,
      totalKills: 0,
      marcusKills: 0,
      playerKills: 0,
      linesSpoken: new Set(),
      currentWave: 0,
    };
  }

  /**
   * Reset the banter state (e.g., when starting a new game)
   */
  reset(): void {
    this.state = this.createInitialState();
    this.currentDialoguePriority = 0;
    if (this.pendingDialogue) {
      clearTimeout(this.pendingDialogue);
      this.pendingDialogue = null;
    }
  }

  /**
   * Trigger a dialogue event. Returns true if dialogue was triggered.
   */
  trigger(event: DialogueTrigger, forcePlay: boolean = false): boolean {
    const now = Date.now();
    const lines = DIALOGUE_MAP[event];

    // No lines for this trigger
    if (!lines || lines.length === 0) {
      return false;
    }

    // Check global cooldown (unless forced)
    if (!forcePlay && now - this.state.lastDialogueTime < this.config.globalCooldown) {
      return false;
    }

    // Check trigger-specific cooldown
    const lastTriggerTime = this.state.lastTriggerTimes.get(event) || 0;
    const selectedLine = this.selectLine(lines, lastTriggerTime, now);

    if (!selectedLine) {
      return false;
    }

    // Check priority (can this interrupt current dialogue?)
    if (
      !forcePlay &&
      !this.config.allowInterrupts &&
      selectedLine.priority <= this.currentDialoguePriority
    ) {
      return false;
    }

    // Random chance for low-priority banter
    if (!forcePlay && selectedLine.priority <= 3 && Math.random() > this.config.banterChance) {
      return false;
    }

    // Clear any pending dialogue if this is higher priority
    if (this.pendingDialogue && selectedLine.priority > this.currentDialoguePriority) {
      clearTimeout(this.pendingDialogue);
      this.pendingDialogue = null;
    }

    // Speak the line
    this.speakLine(selectedLine, event);
    return true;
  }

  /**
   * Select a line from the pool, respecting cooldowns and variety
   */
  private selectLine(
    lines: DialogueLine[],
    lastTriggerTime: number,
    now: number
  ): DialogueLine | null {
    // Filter lines that are off cooldown
    const availableLines = lines.filter((line) => {
      const timeSinceTrigger = (now - lastTriggerTime) / 1000;
      return timeSinceTrigger >= line.cooldown;
    });

    if (availableLines.length === 0) {
      return null;
    }

    // Prefer lines we haven't spoken yet (variety)
    const unspokenLines = availableLines.filter((line) => !this.state.linesSpoken.has(line.text));

    const pool = unspokenLines.length > 0 ? unspokenLines : availableLines;

    // Weighted random selection by priority
    const totalWeight = pool.reduce((sum, line) => sum + line.priority, 0);
    let random = Math.random() * totalWeight;

    for (const line of pool) {
      random -= line.priority;
      if (random <= 0) {
        return line;
      }
    }

    return pool[0];
  }

  /**
   * Actually deliver the dialogue line
   */
  private speakLine(line: DialogueLine, event: DialogueTrigger): void {
    const now = Date.now();

    this.state.lastDialogueTime = now;
    this.state.lastTriggerTimes.set(event, now);
    this.state.linesSpoken.add(line.text);
    this.currentDialoguePriority = line.priority;

    const message: CommsMessage = {
      ...MARCUS,
      text: line.text,
    };

    this.onCommsMessage(message);

    // Reset priority after a delay (allow new dialogue)
    this.pendingDialogue = setTimeout(() => {
      this.currentDialoguePriority = 0;
      this.pendingDialogue = null;
    }, 2000);
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON TRIGGERS
  // ============================================================================

  /**
   * Call when player kills an enemy
   */
  onPlayerKill(enemyType?: string, isHeadshot: boolean = false): void {
    this.state.playerKills++;
    this.state.totalKills++;
    this.state.currentKillStreak++;

    // Check for special kill triggers
    if (this.state.playerKills === 1) {
      this.trigger('first_kill', true);
      return;
    }

    if (this.state.currentKillStreak === 5) {
      this.trigger('kill_streak_5', true);
      return;
    }

    if (this.state.currentKillStreak === 10) {
      this.trigger('kill_streak_10', true);
      return;
    }

    if (enemyType === 'brute') {
      this.trigger('brute_killed', true);
      return;
    }

    if (isHeadshot) {
      this.trigger('headshot');
      return;
    }

    // Regular kill callout
    this.trigger('enemy_killed');
  }

  /**
   * Call when player gets a multi-kill (2+ enemies in quick succession)
   */
  onMultiKill(): void {
    this.trigger('multi_kill', true);
  }

  /**
   * Call when player uses grenade and gets kills
   */
  onGrenadeKill(killCount: number): void {
    if (killCount > 0) {
      this.trigger('grenade_kill', true);
    }
  }

  /**
   * Call when Marcus kills an enemy
   */
  onMarcusKill(): void {
    this.state.marcusKills++;
    this.state.totalKills++;
    this.trigger('marcus_kill');
  }

  /**
   * Call when new enemy type is spotted
   */
  onEnemySpotted(enemyType: string, count: number = 1): void {
    if (enemyType === 'brute') {
      this.trigger('brute_spotted', true);
    } else if (enemyType === 'spitter') {
      this.trigger('spitter_spotted');
    } else if (enemyType === 'drone' && count >= 5) {
      this.trigger('drone_swarm');
    } else {
      this.trigger('enemy_spotted');
    }
  }

  /**
   * Call when player health changes
   */
  onPlayerHealthChange(health: number, maxHealth: number, previousHealth: number): void {
    const healthPercent = health / maxHealth;
    const prevHealthPercent = previousHealth / maxHealth;

    // Near death save (was critical, now recovering)
    if (prevHealthPercent <= 0.15 && healthPercent > 0.3) {
      this.trigger('player_near_death_save', true);
      return;
    }

    // Healed significantly
    if (healthPercent > prevHealthPercent + 0.2 && healthPercent > 0.5) {
      this.trigger('player_healed');
      return;
    }

    // Critical health
    if (healthPercent <= 0.15 && prevHealthPercent > 0.15) {
      this.trigger('player_critical', true);
      return;
    }

    // Low health
    if (healthPercent <= 0.35 && prevHealthPercent > 0.35) {
      this.trigger('player_low_health', true);
    }
  }

  /**
   * Call to check combat situation based on enemy positions
   */
  onCombatSituation(enemiesInFront: number, enemiesBehind: number, enemiesTotal: number): void {
    if (enemiesBehind > 0 && enemiesInFront > 0) {
      this.trigger('flanked', true);
    } else if (enemiesTotal >= 5) {
      this.trigger('surrounded');
    }
  }

  /**
   * Call when area is cleared of enemies
   */
  onAreaCleared(): void {
    this.state.currentKillStreak = 0;
    this.trigger('clear_area');
  }

  /**
   * Call when fire support is requested
   */
  onFireSupportCalled(): void {
    this.trigger('fire_support_acknowledged', true);
  }

  /**
   * Call when fire support finishes
   */
  onFireSupportComplete(): void {
    this.trigger('fire_support_complete');
  }

  /**
   * Call when wave progression changes
   */
  onWaveProgress(currentEnemies: number, totalEnemies: number, waveNumber: number): void {
    this.state.currentWave = waveNumber;

    const progress = 1 - currentEnemies / totalEnemies;

    if (progress >= 0.5 && progress < 0.75) {
      this.trigger('wave_halfway');
    } else if (progress >= 0.85) {
      this.trigger('wave_almost_done');
    }
  }

  /**
   * Call when a new wave starts
   */
  onWaveStart(waveNumber: number, isFinalWave: boolean): void {
    this.state.currentWave = waveNumber;
    this.state.currentKillStreak = 0;

    if (isFinalWave) {
      this.trigger('final_wave_start', true);
    }
    // Regular wave starts handled by cinematics.ts COMMS
  }

  /**
   * Call when all waves are complete
   */
  onAllWavesComplete(): void {
    this.trigger('all_waves_complete', true);
  }

  /**
   * Call periodically during downtime between waves
   */
  onIdleUpdate(): void {
    const timeSinceLastDialogue = Date.now() - this.state.lastDialogueTime;

    // Only trigger idle banter after significant silence
    if (timeSinceLastDialogue > 15000) {
      this.trigger('between_waves');
    } else if (timeSinceLastDialogue > 30000) {
      this.trigger('idle_banter');
    }
  }

  /**
   * Call when player approaches the breach
   */
  onNearBreach(): void {
    this.trigger('near_breach');
  }

  // ============================================================================
  // NEW CONVENIENCE METHODS FOR BROTHERLY BANTER
  // ============================================================================

  /**
   * Call when Marcus takes damage
   */
  onMarcusTakeDamage(damage: number, healthPercent: number): void {
    if (healthPercent <= 0.25) {
      this.trigger('marcus_low_health', true);
    } else if (damage >= 30) {
      this.trigger('marcus_taking_damage');
    }
  }

  /**
   * Call when Marcus recovers from low health
   */
  onMarcusRecovered(): void {
    this.trigger('marcus_recovered');
  }

  /**
   * Call when both brothers damage the same enemy leading to a kill
   */
  onCoordinatedKill(): void {
    this.trigger('coordinated_kill', true);
  }

  /**
   * Call when player gets a long-range kill (>50m)
   */
  onLongRangeKill(): void {
    this.trigger('long_range_kill');
  }

  /**
   * Call when player narrowly avoids death (health drops below 10% then recovers)
   */
  onPlayerCloseCall(): void {
    this.trigger('close_call_player', true);
  }

  /**
   * Call when Marcus narrowly avoids a big hit
   */
  onMarcusCloseCall(): void {
    this.trigger('close_call_marcus');
  }

  /**
   * Call to trigger a random brotherly emotional moment
   * Use sparingly - these are high-impact moments
   */
  triggerBrotherlyMoment(): void {
    // Pick from several emotional beat categories with weighted randomness
    const categories: DialogueTrigger[] = [
      'brotherly_moment',
      'reminisce_europa',
      'reminisce_childhood',
      'reminisce_training',
      'worry_about_family',
      'determination',
      'gratitude',
    ];
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    this.trigger(selectedCategory);
  }

  /**
   * Call when player first sees the breach
   */
  onViewingBreachFirst(): void {
    this.trigger('viewing_breach_first', true);
  }

  /**
   * Call when player is near canyon walls (cover advice)
   */
  onNearCanyonWall(): void {
    this.trigger('near_canyon_wall');
  }

  /**
   * Call at Marcus's original defensive position
   */
  onDefendingPosition(): void {
    this.trigger('defending_position');
  }

  /**
   * Call when Marcus is repositioning
   */
  onMarcusRepositioning(): void {
    this.trigger('marcus_repositioning');
  }

  /**
   * Call to trigger mech-related banter
   */
  onCommentOnMech(): void {
    this.trigger('comment_on_mech');
  }

  /**
   * Extended idle update that can trigger deeper emotional moments
   * during longer lulls in combat
   */
  onExtendedIdle(): void {
    const timeSinceLastDialogue = Date.now() - this.state.lastDialogueTime;

    if (timeSinceLastDialogue > 60000) {
      // After 1 minute of silence, chance for deeper emotional beat
      if (Math.random() < 0.3) {
        this.triggerBrotherlyMoment();
      }
    } else if (timeSinceLastDialogue > 45000) {
      // Reminiscing banter
      const reminisceTypes: DialogueTrigger[] = [
        'reminisce_europa',
        'reminisce_childhood',
        'reminisce_training',
        'comment_on_mech',
      ];
      const selected = reminisceTypes[Math.floor(Math.random() * reminisceTypes.length)];
      this.trigger(selected);
    } else if (timeSinceLastDialogue > 30000) {
      this.trigger('idle_banter');
    } else if (timeSinceLastDialogue > 15000) {
      this.trigger('between_waves');
    }
  }

  /**
   * Get current stats for debugging/UI
   */
  getStats(): { playerKills: number; marcusKills: number; totalKills: number } {
    return {
      playerKills: this.state.playerKills,
      marcusKills: this.state.marcusKills,
      totalKills: this.state.totalKills,
    };
  }

  // ============================================================================
  // MARCUS DOWNED/REVIVE EVENTS
  // ============================================================================

  /**
   * Call when Marcus is downed (critical system failure)
   */
  onMarcusDowned(): void {
    this.trigger('marcus_downed', true);
  }

  /**
   * Call periodically while Marcus is reviving (recovery progress updates)
   */
  onMarcusReviving(): void {
    this.trigger('marcus_reviving');
  }

  /**
   * Call when Marcus fully recovers from downed state
   */
  onMarcusRevived(): void {
    this.trigger('marcus_revived', true);
  }

  /**
   * Call when player is close to Marcus while he's downed (assisting recovery)
   */
  onPlayerAssistRevive(): void {
    this.trigger('player_assist_revive');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a configured MarcusBanterManager instance
 */
export function createMarcusBanterManager(
  onCommsMessage: (message: CommsMessage) => void,
  config?: Partial<BanterConfig>
): MarcusBanterManager {
  return new MarcusBanterManager(onCommsMessage, config);
}
