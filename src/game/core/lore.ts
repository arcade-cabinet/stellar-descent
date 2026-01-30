// STELLAR DESCENT: PROXIMA BREACH
// A tactical combat experience set in humanity's first interstellar frontier

export const GAME_TITLE = 'STELLAR DESCENT';
export const GAME_SUBTITLE = 'PROXIMA BREACH';
export const GAME_VERSION = '1.0.0';

export const LORE = {
  setting: {
    year: 3147,
    location: 'Proxima Centauri b',
    designation: 'PCb-7 "Kepler\'s Promise"',
    distance: '4.24 light years from Earth',
    stellarBody: 'Proxima Centauri (Red Dwarf)',
  },

  backstory: `
THE YEAR IS 3147.

Humanity has spread beyond the cradle of Earth, establishing footholds
across the Alpha Centauri system. The Terran Expansion Authority oversees
colonization efforts from massive orbital platforms known as ANCHOR STATIONS -
mobile deployment bases that position above target worlds to stage
pacification and terraforming operations.

ANCHOR STATION PROMETHEUS has been positioned above Proxima Centauri b,
designated PCb-7 "Kepler's Promise" - a rocky world with thin atmosphere
and extreme temperature variance. Initial surveys indicated no hostile
life forms. The world was cleared for Phase One colonization.

RECON TEAM VANGUARD was deployed 72 hours ago to establish Forward
Operating Base DELTA at the northern canyon region. Their mission:
secure the landing zone, survey mineral deposits, and prepare for
the arrival of terraforming equipment.

36 hours ago, all communication with FOB DELTA ceased.

Orbital scans show the base intact but no movement. No distress beacon.
No explanation. Just silence.

You are SERGEANT JAMES COLE, 7th Drop Marines "Hell Jumpers".
Your brother, CORPORAL MARCUS COLE, was assigned to Vanguard as
mech support in his M-47 "Titan" combat walker.

Command has authorized a solo reconnaissance drop.
Find out what happened. Locate survivors.
And if hostile contact is confirmed - eliminate the threat.

The drop pod is prepped. Kepler's Promise awaits.
  `,

  characters: {
    player: {
      name: 'Sergeant James Cole',
      callsign: 'SPECTER',
      unit: '7th Drop Marines "Hell Jumpers"',
      background: 'Veteran of the Titan Campaign, decorated for valor during the Europa Uprising',
    },
    brother: {
      name: 'Corporal Marcus Cole',
      callsign: 'HAMMER',
      unit: 'Vanguard Recon Team',
      mech: 'M-47 "Titan" Combat Walker',
      status: 'MIA',
    },
    commandingOfficer: {
      name: 'Commander Elena Vasquez',
      callsign: 'ACTUAL',
      position: 'ANCHOR STATION PROMETHEUS Command',
    },
  },

  enemies: {
    designation: 'STRAIN-X / "Chitin"',
    origin: 'Subterranean - previously undetected during orbital survey',
    description: `
Insectoid species living in vast underground hive networks. Apparently
dormant during initial surveys, possibly awakened by seismic activity
from mining operations. Highly aggressive, organized hive structure
with worker, soldier, and specialized variants. Evidence suggests
a central queen controlling the hive mind.
    `,
    variants: {
      drone: 'Fast-moving scouts, weak individually but attack in swarms',
      soldier: 'Armored warriors, primary combat unit',
      spitter: 'Ranged acid attack, targets from distance',
      brute: 'Heavy assault variant, extremely durable',
      queen: 'Hive central intelligence, must be eliminated to collapse swarm',
    },
  },

  locations: {
    anchorStation: {
      name: 'ANCHOR STATION PROMETHEUS',
      description: 'Orbital deployment platform, 2.3km in length, housing 4,000 personnel',
    },
    dropZone: {
      name: 'DROP ZONE ALPHA',
      description: 'Initial landing coordinates, rocky desert terrain with sparse vegetation',
    },
    fobDelta: {
      name: 'FOB DELTA',
      description: 'Forward Operating Base established by Vanguard team, prefab structures',
    },
    hiveEntrance: {
      name: 'THE BREACH',
      description: 'Massive sinkhole leading to underground hive network',
    },
    hiveCore: {
      name: "QUEEN'S CHAMBER",
      description: "Central nexus of the Chitin hive, queen's lair",
    },
    extractionPoint: {
      name: 'LZ OMEGA',
      description: 'Emergency extraction coordinates for dropship pickup',
    },
  },
};

export const MISSION_BRIEFINGS = {
  prologue: {
    title: 'MISSION BRIEFING',
    location: 'ANCHOR STATION PROMETHEUS - Briefing Room',
    text: `
PRIORITY ALPHA TRANSMISSION
FROM: TEA COMMAND
TO: SGT. JAMES COLE, 7TH DROP MARINES

Sergeant, we've lost contact with Recon Team Vanguard at FOB Delta.
Your brother Marcus was among them. I know this is personal, but
you're our best operative for this mission.

Your objectives are clear:
1. Perform orbital drop to coordinates ALPHA-7
2. Proceed to FOB Delta and assess situation
3. Locate any survivors, including Corporal Cole
4. If hostile contact confirmed, you are weapons free

The M-47 mechs stationed at the FOB should still be operational.
If Marcus is alive, he'll be your best asset on the ground.

Command is standing by. Prometheus Actual, out.
    `,
  },

  mission1: {
    title: 'CHAPTER 1: THE DROP',
    subtitle: 'Tutorial Mission',
    location: 'ANCHOR STATION PROMETHEUS - Hangar Bay',
    objectives: [
      'Complete weapons familiarization',
      'Navigate to drop pod',
      'Execute orbital insertion',
    ],
    text: `
The hangar bay stretches before you, a cathedral of steel and purpose.
Drop pods line the launch rails like bullets in a magazine.
Your pod awaits - designation HELL-7.

Before you drop, familiarize yourself with your equipment.
The hostiles down there won't give you a tutorial.
    `,
  },

  mission2: {
    title: "CHAPTER 2: KEPLER'S PROMISE",
    subtitle: 'Surface Exploration',
    location: 'PCb-7 Surface - Drop Zone Alpha',
    objectives: [
      'Survive landing',
      'Establish bearings',
      'Proceed to FOB Delta',
      'Eliminate hostile contacts',
    ],
    text: `
The pod screams through the thin atmosphere, retro-thrusters fighting
against terminal velocity. Through the viewport, the alien landscape
unfurls - rust-red rock formations jutting toward a pale sun,
endless desert broken by deep canyon systems.

Somewhere out there, your brother is waiting.
Or whatever happened to him.

Time to find out.
    `,
  },

  mission3: {
    title: 'CHAPTER 3: FOB DELTA',
    subtitle: 'The Silent Camp',
    location: 'Forward Operating Base Delta',
    objectives: [
      'Investigate FOB Delta',
      'Search for survivors',
      'Access command center logs',
      'Locate Corporal Marcus Cole',
    ],
    text: `
The prefab structures of FOB Delta stand silent against the horizon.
No movement. No lights. The wind carries only dust.

But something is wrong. The perimeter barriers have been breached
from BELOW. Deep gouges in the earth lead toward a massive sinkhole
that wasn't on any survey map.

They came from underground. And your brother's mech signature
is still active - inside the base.
    `,
  },

  mission4: {
    title: 'CHAPTER 4: BROTHERS IN ARMS',
    subtitle: 'Team Operations',
    location: 'PCb-7 Surface - Open World',
    objectives: [
      'Link up with Marcus Cole',
      'Defend against Chitin waves',
      'Locate hive entrance',
      'Prepare for underground assault',
    ],
    text: `
Marcus is alive. Battered, but alive. His Titan mech has seen
better days, but it's still combat-capable.

"James... you shouldn't have come. There's something down there,
something big. A queen. She controls them all."

The ground trembles. More are coming.
It's time to take the fight to them.
    `,
  },

  mission5: {
    title: 'CHAPTER 5: INTO THE BREACH',
    subtitle: 'Hive Assault',
    location: 'Subterranean Hive Network',
    objectives: [
      'Descend into hive network',
      "Navigate to queen's chamber",
      'Eliminate the Chitin Queen',
      'Escape before hive collapse',
    ],
    text: `
The sinkhole yawns before you, a wound in the planet's surface.
Bioluminescent growths line the walls, pulsing with alien life.
The stench of the hive rises on warm, fetid air.

"We go together," Marcus says, his mech's weapons cycling.
"Like old times."

No backup. No extraction until it's done.
Kill the queen. End this.
    `,
  },

  mission6: {
    title: 'CHAPTER 6: EXTRACTION',
    subtitle: 'Survival Run',
    location: 'PCb-7 Surface - Route to LZ Omega',
    objectives: [
      'Escape collapsing hive',
      'Fight through remaining Chitin forces',
      'Reach extraction point LZ Omega',
      'Signal for pickup',
    ],
    text: `
The queen is dead. The hive is dying. But the Chitin don't know
they've lost yet - and they're angry.

The surface erupts with fleeing drones and enraged soldiers.
LZ Omega is 3 klicks north. The dropship won't wait forever.

Run. Fight. Survive.
Get home.
    `,
  },

  epilogue: {
    title: 'MISSION COMPLETE',
    location: 'ANCHOR STATION PROMETHEUS',
    text: `
The dropship's engines whine as it docks with Prometheus.
The nightmare of Kepler's Promise fades below, but the scars remain.

The Chitin threat has been neutralized. The queen is dead.
Terraforming can proceed - though they'll need to clear those
tunnels first.

Marcus will live. The mech is scrap, but he walked away.
That's more than most got.

Command is already talking about the next drop. Another world.
Another threat. That's the life of a Hell Jumper.

But for now... for now you rest.

STELLAR DESCENT: PROXIMA BREACH
MISSION COMPLETE

Thank you for playing.
    `,
  },
};

export const RADIO_CHATTER = {
  missionStart: [
    'Prometheus Actual to Specter. Drop window opens in 30 seconds.',
    'Green light confirmed. Godspeed, Sergeant.',
    "Telemetry locked. You're cleared for orbital insertion.",
  ],
  combat: [
    'Contact! Hostile signatures inbound!',
    'Specter, be advised - multiple contacts on approach.',
    'Prometheus tracking heavy movement in your sector.',
  ],
  marcus: [
    'Hammer here. Good to see you, brother.',
    'Watch your six - they come from below.',
    'Titan systems nominal. Ready to bring the thunder.',
    'Just like the Europa job, eh James?',
  ],
  victory: [
    'Confirmed kill. Good shooting, Specter.',
    'Target neutralized. Prometheus acknowledges.',
    "That's how Hell Jumpers do it.",
  ],
  queen: [
    'Seismic activity spiking - something big is moving!',
    "That's the queen! Light her up!",
    "She's down! The hive is collapsing!",
  ],
  extraction: [
    'Dropship inbound to LZ Omega. ETA 5 minutes.',
    'Specter, Hammer - get to extraction NOW.',
    "We see you on approach. Hold tight, we're coming.",
  ],
};
