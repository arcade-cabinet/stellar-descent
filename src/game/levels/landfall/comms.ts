/**
 * LandfallLevel Communications
 * Radio/dialogue messages and comms callbacks for the Landfall level.
 */

import type { LevelCallbacks } from '../types';

// ---------------------------------------------------------------------------
// Comms Message Definitions
// ---------------------------------------------------------------------------

/**
 * Comms message from ATHENA about enemy air traffic.
 */
export function sendEnemyAirTrafficWarning(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Warning: Enemy air traffic detected. Wraith patrols in the area. Maintain stealth profile.',
  });
}

/**
 * Initial comms after clearing the station.
 */
export function sendClearOfStationMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Clear of station. Debris belt ahead. Spread and stabilize.',
  });
}

/**
 * Message when debris field is cleared.
 */
export function sendDebrisClearedMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Debris cleared. Ignite retros when ready. LZ beacon locked.',
  });
}

/**
 * Message when jets are ignited.
 */
export function sendJetsIgnitedMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Retros online. Target the LZ pad. Watch your fuel.',
  });
}

/**
 * Perfect landing message.
 */
export function sendPerfectLandingMessage(callbacks: LevelCallbacks, asteroidsDodged: number): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: `Touchdown on LZ pad. ${asteroidsDodged} debris dodged. Exemplary, Sergeant.`,
  });
}

/**
 * Near miss landing message.
 */
export function sendNearMissLandingMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Landed outside LZ perimeter. Movement detected. Fight to the pad!',
  });
}

/**
 * Rough landing message.
 */
export function sendRoughLandingMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: `Hard touchdown. Suit integrity compromised. Multiple hostiles converging.`,
  });
}

/**
 * Crash landing message.
 */
export function sendCrashLandingMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Critical impact. Medical nanites deployed. You need to move, Sergeant.',
  });
}

/**
 * Slingshot / trajectory lost message.
 */
export function sendSlingshotMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'Commander Vasquez',
    callsign: 'PROMETHEUS ACTUAL',
    portrait: 'commander',
    text: "Specter, we've lost your signal. Specter, respond... Damn it.",
  });
}

/**
 * Seismic warning before combat.
 */
export function sendSeismicWarningMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Sergeant, detecting seismic activity nearby. Possible subsurface contacts.',
  });
}

/**
 * Combat begins message.
 */
export function sendCombatBeginsMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'CONTACTS EMERGING! Chitin Drones - fast but fragile. Use cover and aim for center mass!',
  });
}

/**
 * Combat tutorial for players who skipped station.
 */
export function sendCombatTutorialMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'Sergeant, I detect you may have skipped station training. I will provide tactical guidance.',
  });
}

/**
 * Combat cleared debrief message.
 */
export function sendCombatClearedMessage(callbacks: LevelCallbacks, killCount: number): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: `Impressive, Sergeant. ${killCount} Chitin Drones neutralized. You handled that ambush well.`,
  });
}

/**
 * LZ secured message.
 */
export function sendLZSecuredMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'LZ secured. FOB Delta is expecting you. This was just the beginning, Sergeant.',
  });
}

/**
 * FOB Delta waypoint message.
 */
export function sendFOBDeltaWaypointMessage(callbacks: LevelCallbacks): void {
  callbacks.onCommsMessage({
    sender: 'PROMETHEUS A.I.',
    callsign: 'ATHENA',
    portrait: 'ai',
    text: 'I have marked FOB Delta on your HUD. The base went dark 36 hours ago. Proceed with caution, Sergeant.',
  });
}
