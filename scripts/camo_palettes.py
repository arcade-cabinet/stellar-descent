"""
Stellar Descent - Marine Armor Palette & Weathering System

Design philosophy:
  - It's 1000 years in the future. Marines wear powered hardshell armor, not
    fabric BDUs with camo patterns.
  - All marines share the same standard-issue armor color scheme by unit/company.
  - Base armor color is dark brown-gunmetal that blends with Kepler-442b's
    rocky arid surface, volcanic ash, and industrial grime.
  - Weathering tells the story: how long they've been on THIS planet and what
    biomes they've pushed through. Ice buildup, volcanic ash, alien bio-residue,
    station hydraulic fluid, chitin acid burns.
  - Role markings (rank/squad) use muted amber/earth-tone trim and shoulder
    insignia, not bright blues or silvers.

The planet "Kepler-442b" has these biomes:
  - Frozen ice wastes (southern pole)
  - Volcanic canyon systems
  - Alien hive organic tunnels
  - Human-built station/industrial zones (abandoned colonial infrastructure)
  - Rocky arid surface (between outposts)

Marines deploy from orbit in drop pods. Their armor picks up planet grime over
the campaign — early missions show cleaner armor, later missions show cumulative
battle damage and environmental staining.

Usage:
    from camo_palettes import ARMOR_SCHEME, WEATHERING_LAYERS, get_weathering
    base = ARMOR_SCHEME
    wear = get_weathering('southern-ice', campaign_progress=0.6)
"""

# All colors are (R, G, B) in 0-1 range

# ---------------------------------------------------------------------------
# STANDARD-ISSUE ARMOR  (same for all marines, all levels)
# Planet-appropriate: warm dark brown that blends with rocky/volcanic surface
# ---------------------------------------------------------------------------

ARMOR_SCHEME = {
    'name': 'UNSC Stellar Descent - 7th Colonial Marine Regiment',

    # Primary hardshell plates — dark warm brown-gunmetal
    # Blends with planet surface: rocky arid terrain, volcanic ash, station grime
    'plate_color':      (0.14, 0.11, 0.08),    # dark warm brown
    'plate_metallic':   0.65,
    'plate_roughness':  0.42,

    # Under-armor / joint mesh — near-black technical fabric
    'undersuit_color':  (0.06, 0.05, 0.04),    # near-black warm
    'undersuit_metallic': 0.0,
    'undersuit_roughness': 0.85,

    # Visor / HUD — amber tactical display (not bright green)
    'visor_color':      (0.75, 0.55, 0.08),    # amber tactical
    'visor_emission':   2.5,                     # glow strength

    # Trim / piping — dark olive accent on armor edges
    'trim_color':       (0.22, 0.20, 0.14),    # dark olive-brown

    # Tint strength for retexturing pipeline (how much to shift original textures)
    'diffuse_tint_strength':   0.72,   # 72% tint toward plate_color
    'emissive_tint_strength':  0.80,   # 80% tint toward role emissive
}

# ---------------------------------------------------------------------------
# ROLE / RANK MARKINGS  (colored shoulder trim + insignia)
# All earth tones — muted, tactical, planet-appropriate
# No bright blues, silvers, or neon colors
# ---------------------------------------------------------------------------

MARINE_ROLES = {
    'marine_soldier': {
        'name': 'Private',
        'shoulder_color': (0.45, 0.35, 0.20),   # amber — standard issue
        'emissive_color': (0.45, 0.35, 0.20),   # amber accents
        'stripe_count': 0,
        'armor_variant': 'standard',
    },
    'marine_sergeant': {
        'name': 'Sergeant',
        'shoulder_color': (0.55, 0.40, 0.08),   # deeper gold chevrons
        'emissive_color': (0.55, 0.40, 0.08),
        'stripe_count': 3,
        'armor_variant': 'standard',
    },
    'marine_elite': {
        'name': 'Spec-Ops',
        'shoulder_color': (0.60, 0.15, 0.08),   # dark red-amber
        'emissive_color': (0.60, 0.15, 0.08),
        'stripe_count': 1,
        'armor_variant': 'heavy',
    },
    'marine_crusader': {
        'name': 'Crusader',
        'shoulder_color': (0.50, 0.30, 0.12),   # burnt orange
        'emissive_color': (0.50, 0.30, 0.12),
        'stripe_count': 2,
        'armor_variant': 'heavy',
    },
}

# ---------------------------------------------------------------------------
# SOURCE GLB MAPPING
# Maps our game role names to the original space-marines exported GLBs
# The _a/_b/_c variants have different texture sets; we use _a as default
# ---------------------------------------------------------------------------

SOURCE_GLB_MAP = {
    'marine_soldier':  'soldier_a.glb',
    'marine_sergeant': 'sargent_a.glb',
    'marine_elite':    'cyber_soldier_a.glb',
    'marine_crusader': 'crusader_a.glb',
}

# ---------------------------------------------------------------------------
# PLANET WEATHERING LAYERS
# Accumulated environmental damage. Each layer has an intensity that scales
# with campaign_progress (0.0 = fresh drop, 1.0 = final mission).
# ---------------------------------------------------------------------------

WEATHERING_LAYERS = {
    # Frozen ice wastes
    'ice': {
        'description': 'Frost buildup on joints, ice crystal deposits in crevices',
        'tint':             (0.70, 0.82, 0.92),  # pale ice blue
        'dirt_intensity':   0.10,                  # minimal — cold and clean
        'frost_buildup':    0.45,                  # ice crystal deposits
        'scratch_intensity': 0.30,                 # ice abrasion
        'edge_wear':        0.20,
        'acid_burns':       0.0,
    },

    # Volcanic canyon
    'volcanic': {
        'description': 'Volcanic ash coating, heat discoloration, molten splatter',
        'tint':             (0.40, 0.25, 0.15),  # warm ash brown
        'dirt_intensity':   0.55,                  # heavy ash deposits
        'frost_buildup':    0.0,
        'scratch_intensity': 0.40,
        'edge_wear':        0.45,                  # heat warping
        'acid_burns':       0.10,
    },

    # Alien hive organic tunnels
    'hive': {
        'description': 'Chitin acid burns, bio-luminescent residue, organic slime',
        'tint':             (0.25, 0.35, 0.18),  # sickly green-brown
        'dirt_intensity':   0.50,                  # bio residue
        'frost_buildup':    0.0,
        'scratch_intensity': 0.35,
        'edge_wear':        0.30,
        'acid_burns':       0.55,                  # chitin acid pitting
    },

    # Human station / industrial
    'station': {
        'description': 'Hydraulic fluid, lubricant stains, concrete dust, sparks',
        'tint':             (0.30, 0.28, 0.25),  # industrial grey-brown
        'dirt_intensity':   0.35,
        'frost_buildup':    0.0,
        'scratch_intensity': 0.50,                 # metal-on-metal combat
        'edge_wear':        0.45,
        'acid_burns':       0.05,
    },

    # Rocky arid surface (between outposts)
    'surface': {
        'description': 'Alien dust, fine grit abrasion, UV fading',
        'tint':             (0.45, 0.38, 0.30),  # alien dirt (warm ochre)
        'dirt_intensity':   0.45,
        'frost_buildup':    0.0,
        'scratch_intensity': 0.35,
        'edge_wear':        0.30,
        'acid_burns':       0.08,
    },
}

# Map game levels to their primary weathering layer
LEVEL_WEATHERING_MAP = {
    'anchor-station':   'station',
    'landfall':         'surface',     # fresh drop onto planet surface
    'fob-delta':        'station',
    'southern-ice':     'ice',
    'canyon-run':       'volcanic',
    'hive-assault':     'hive',
    'mining-depths':    'station',
    'brothers-in-arms': 'surface',
    'the-breach':       'hive',
    'extraction':       'surface',
    'final-escape':     'station',
}

# Campaign level ordering (for calculating cumulative weathering)
CAMPAIGN_ORDER = [
    'landfall',           # Mission 1 — fresh armor
    'anchor-station',     # Mission 2
    'fob-delta',          # Mission 3
    'southern-ice',       # Mission 4
    'canyon-run',         # Mission 5
    'hive-assault',       # Mission 6
    'mining-depths',      # Mission 7
    'brothers-in-arms',   # Mission 8
    'the-breach',         # Mission 9
    'extraction',         # Mission 10
    'final-escape',       # Mission 11 — battle-scarred veterans
]


def get_campaign_progress(level_id: str) -> float:
    """How far through the campaign this level is (0.0 to 1.0)."""
    try:
        idx = CAMPAIGN_ORDER.index(level_id)
        return idx / max(len(CAMPAIGN_ORDER) - 1, 1)
    except ValueError:
        return 0.5


def get_weathering(level_id: str, campaign_progress: float = None) -> dict:
    """
    Get the weathering configuration for a level.
    Intensity scales with campaign progress — armor gets dirtier over time.
    """
    if campaign_progress is None:
        campaign_progress = get_campaign_progress(level_id)

    layer_name = LEVEL_WEATHERING_MAP.get(level_id, 'surface')
    layer = WEATHERING_LAYERS[layer_name].copy()

    # Scale weathering intensities by campaign progress
    # Early missions: 40% of full weathering
    # Final mission: 100% of full weathering
    scale = 0.4 + 0.6 * campaign_progress

    for key in ('dirt_intensity', 'frost_buildup', 'scratch_intensity',
                'edge_wear', 'acid_burns'):
        if key in layer:
            layer[key] *= scale

    # Add cumulative battle damage (increases monotonically)
    layer['battle_damage'] = campaign_progress * 0.6  # up to 60% coverage by endgame

    return layer


def get_level_palette(level_id: str) -> dict:
    """Get complete armor + weathering config for a level."""
    return {
        'armor': ARMOR_SCHEME,
        'weathering': get_weathering(level_id),
        'campaign_progress': get_campaign_progress(level_id),
        'level': level_id,
    }
