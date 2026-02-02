/**
 * LandfallLevel Communications
 * Radio/dialogue messages for the Landfall level.
 * All messages are now sent via EventBus.
 */

import { getEventBus } from '../../core/EventBus';

// ---------------------------------------------------------------------------
// Comms Message Definitions
// ---------------------------------------------------------------------------

/**
 * Comms message from ATHENA about enemy air traffic.
 */
export function sendEnemyAirTrafficWarning(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Warning: Enemy air traffic detected. Wraith patrols in the area. Maintain stealth profile.',
    },
  });
}

/**
 * Initial comms after clearing the station.
 */
export function sendClearOfStationMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Clear of station. Debris belt ahead. Spread and stabilize.',
    },
  });
}

/**
 * Message when debris field is cleared.
 */
export function sendDebrisClearedMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Debris cleared. Ignite retros when ready. LZ beacon locked.',
    },
  });
}

/**
 * Message when jets are ignited.
 */
export function sendJetsIgnitedMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Retros online. Target the LZ pad. Watch your fuel.',
    },
  });
}

/**
 * Perfect landing message.
 */
export function sendPerfectLandingMessage(asteroidsDodged: number): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: `Touchdown on LZ pad. ${asteroidsDodged} debris dodged. Exemplary, Sergeant.`,
    },
  });
}

/**
 * Near miss landing message.
 */
export function sendNearMissLandingMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Landed outside LZ perimeter. Movement detected. Fight to the pad!',
    },
  });
}

/**
 * Rough landing message.
 */
export function sendRoughLandingMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: `Hard touchdown. Suit integrity compromised. Multiple hostiles converging.`,
    },
  });
}

/**
 * Crash landing message.
 */
export function sendCrashLandingMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Critical impact. Medical nanites deployed. You need to move, Sergeant.',
    },
  });
}

/**
 * Slingshot / trajectory lost message.
 */
export function sendSlingshotMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'Commander Vasquez',
      callsign: 'PROMETHEUS ACTUAL',
      portrait: 'commander',
      text: "Specter, we've lost your signal. Specter, respond... Damn it.",
    },
  });
}

/**
 * Seismic warning before combat.
 */
export function sendSeismicWarningMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Sergeant, detecting seismic activity nearby. Possible subsurface contacts.',
    },
  });
}

/**
 * Combat begins message.
 */
export function sendCombatBeginsMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'CONTACTS EMERGING! Chitin Drones - fast but fragile. Use cover and aim for center mass!',
    },
  });
}

/**
 * Combat tutorial for players who skipped station.
 */
export function sendCombatTutorialMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Sergeant, I detect you may have skipped station training. I will provide tactical guidance.',
    },
  });
}

/**
 * Combat cleared debrief message.
 */
export function sendCombatClearedMessage(killCount: number): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: `Impressive, Sergeant. ${killCount} Chitin Drones neutralized. You handled that ambush well.`,
    },
  });
}

/**
 * LZ secured message.
 */
export function sendLZSecuredMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'LZ secured. FOB Delta is expecting you. This was just the beginning, Sergeant.',
    },
  });
}

/**
 * FOB Delta waypoint message.
 */
export function sendFOBDeltaWaypointMessage(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'I have marked FOB Delta on your HUD. The base went dark 36 hours ago. Proceed with caution, Sergeant.',
    },
  });
}

// ---------------------------------------------------------------------------
// Additional Tactical Comms
// ---------------------------------------------------------------------------

/**
 * Low fuel warning during powered descent.
 */
export function sendLowFuelWarning(fuelPercent: number): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: `Warning: Thruster fuel at ${Math.round(fuelPercent)}%. Conserve for final approach.`,
    },
  });
}

/**
 * Enemy flanking warning during combat.
 */
export function sendFlankingWarning(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Hostiles flanking your position! Reposition to cover!',
    },
  });
}

/**
 * Health low warning.
 */
export function sendHealthLowWarning(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Suit integrity critical. Medical nanites engaged. Find cover, Sergeant.',
    },
  });
}

/**
 * Reload reminder when out of ammo.
 */
export function sendReloadReminder(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Magazine empty. Press R to reload. Stay behind cover while reloading.',
    },
  });
}

/**
 * Enemy down confirmation.
 */
export function sendEnemyDownConfirmation(remaining: number): void {
  if (remaining > 0) {
    getEventBus().emit({
      type: 'COMMS_MESSAGE',
      message: {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: `Hostile eliminated. ${remaining} contacts remaining on sensors.`,
      },
    });
  }
}

/**
 * Acid pool warning.
 */
export function sendAcidPoolWarning(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Detecting corrosive compounds. Avoid the glowing pools - they will damage your suit.',
    },
  });
}

/**
 * First kill encouragement.
 */
export function sendFirstKillEncouragement(): void {
  getEventBus().emit({
    type: 'COMMS_MESSAGE',
    message: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'First kill confirmed. Good shooting, Sergeant. Keep your head down.',
    },
  });
}
