# Design System & UI/UX Guidelines

This document defines the visual design system, UI patterns, and user experience guidelines for STELLAR DESCENT: PROXIMA BREACH.

## Design Philosophy

### Core Principles

1. **Military Tactical Aesthetic**
   - Think modern military equipment, not sci-fi fantasy
   - Utilitarian, functional design
   - Stencil typography, angular shapes
   - Worn, battle-tested appearance

2. **Harsh Alien Environment**
   - Proxima Centauri is a red dwarf star
   - Intense, contrasty lighting
   - Dust, rock, and sparse vegetation
   - No lush environments or soft lighting

3. **Mobile-First Responsive**
   - Design for 375px width first
   - Scale up to tablets and desktop
   - Touch targets minimum 44px
   - Thumb-reachable controls

## Color System

### Primary Palette (Military)

```text
Olive:        #4A5D23  - Primary brand color
Olive Dark:   #3B4A1C  - Darker variant
Olive Light:  #5C7A2E  - Lighter variant
Khaki:        #C3B091  - Secondary warm
Khaki Dark:   #9A8A6F  - Darker khaki
Tan:          #D4B896  - Warm accent
Sand:         #E8DCC4  - Light warm
```

### Accent Colors

```text
Rust:         #8B4513  - Warning accent
Amber:        #FFBF00  - Highlight/active
Brass:        #B5A642  - Metallic accent
Copper:       #B87333  - Secondary metallic
Gunmetal:     #2A3439  - Dark metallic
```

### UI Colors

```text
Background:   #1C1C1C  - Primary dark
Background Alt: #2D2D2D - Secondary dark
Surface:      #3A3A3A  - Elevated surface
Text:         #E8E8E8  - Primary text
Text Muted:   #A0A0A0  - Secondary text
Success:      #4CAF50  - Positive actions
Warning:      #FF9800  - Caution
Danger:       #F44336  - Critical/damage
Health:       #4CAF50  - Health bar
Shield:       #2196F3  - Shield (if added)
Energy:       #FFEB3B  - Energy/ammo
```

### Environment Colors

```text
Sky:          #87CEEB  - Alien sky
Sun:          #FFF8DC  - Star color
Sun Glow:     #FFD700  - Bloom color
Rock:         #8B7355  - Rock formations
Rock Dark:    #5C4033  - Shadowed rock
Rock Light:   #A08060  - Sunlit rock
Dust:         #C4A77D  - Dust particles
```

### Forbidden Colors

Do NOT use:
- Neon colors (#00FFFF, #FF00FF, etc.)
- Pure blues (#0000FF)
- Cyberpunk purples (#9400D3)
- Gradients with blue/purple

## Typography

### Font Stack

```css
Primary:  'Rajdhani', sans-serif      /* UI text */
Mono:     'Share Tech Mono', monospace /* Data/numbers */
Display:  'Impact', sans-serif         /* Titles */
```

### Size Scale (Mobile Base)

```
XS:      12px  - Captions, labels
SM:      14px  - Secondary text
MD:      16px  - Body text
LG:      20px  - Subheadings
XL:      24px  - Section titles
XXL:     32px  - Page titles
Display: 48px  - Hero titles
```

### Desktop Multiplier: 1.15x

## Spacing System

### Base Scale

```
XS:  4px   - Tight spacing
SM:  8px   - Compact elements
MD:  16px  - Standard spacing
LG:  24px  - Generous spacing
XL:  32px  - Section separation
XXL: 48px  - Major sections
```

### Mobile Multiplier: 0.75x

## Components

### Buttons

### Primary Button

```text
Background: tokens.colors.primary.oliveDark
Text:       tokens.colors.ui.text
Border:     2px solid tokens.colors.primary.olive
Height:     50px (desktop), 48px (mobile)
Font:       Courier New, monospace, 16px
```

### Hover State

```text
Background: tokens.colors.primary.olive
Text:       tokens.colors.accent.brass
Transform:  scale(1.02)
```

### Disabled State

```text
Background: tokens.colors.ui.surface
Text:       tokens.colors.ui.textMuted
Opacity:    1 (don't use opacity for disabled)
```

### Health Bar

```
Container:
  Width:      250px (desktop), 180px (mobile)
  Height:     24px (desktop), 20px (mobile)
  Background: tokens.colors.ui.background + 'CC'
  Border:     2px solid tokens.colors.primary.olive

Fill:
  >50%:  tokens.colors.ui.health
  25-50%: tokens.colors.ui.warning
  <25%:  tokens.colors.ui.danger
```

### Notifications

```
Width:      320px (desktop), 260px (mobile)
Height:     50px (desktop), 40px (mobile)
Background: tokens.colors.primary.olive + 'EE'
Border:     2px solid tokens.colors.accent.brass
Animation:  Fade in from top, hold, fade out down
```

### Crosshair

```
Center Dot:
  Size:   4px (desktop), 6px (mobile)
  Color:  tokens.colors.accent.amber

Lines:
  Length: 12px (desktop), 16px (mobile)
  Width:  2px (desktop), 3px (mobile)
  Color:  tokens.colors.ui.text + '88'
  Gap:    8px (desktop), 10px (mobile)
```

## Touch Controls Layout

### Portrait Mode (Not Recommended)

```
+---------------------------+
|     [WAVE/MISSION]        |
|                           |
|                           |
|    SUGGEST LANDSCAPE      |
|                           |
|                           |
+---------------------------+
```

### Landscape Mode (Primary)

```
+-----------------------------------------------+
|  [HEALTH]              [MISSION]      [KILLS] |
|                                               |
|                    +                          |
|                                               |
|                                               |
|  [SPRINT]                          [FIRE]     |
|     O                                  O      |
|   (MOVE)                            (LOOK)    |
+-----------------------------------------------+
```

### Joystick Sizing

```
Mobile:
  Base:  min(120px, 22% of min dimension)
  Thumb: 45% of base

Tablet:
  Base:  min(140px, 18% of min dimension)
  Thumb: 45% of base

Desktop (if touch):
  Base:  min(160px, 15% of min dimension)
  Thumb: 45% of base
```

### Safe Areas

Always respect:
- `env(safe-area-inset-top)` - Notch/Dynamic Island
- `env(safe-area-inset-bottom)` - Home indicator
- `env(safe-area-inset-left/right)` - Landscape notch

## Motion & Animation

### Principles

1. **Purposeful** - Every animation serves a function
2. **Fast** - Keep under 300ms for UI, 500ms for emphasis
3. **Respect Preferences** - Honor `prefers-reduced-motion`

### Standard Timings

```
Instant:   0ms    - State changes
Fast:      100ms  - Hover effects
Normal:    200ms  - Transitions
Emphasis:  300ms  - Important changes
Dramatic:  500ms  - Major events
```

### Easing Functions

```
easeOutQuad    - Standard exit
easeInQuad     - Standard entrance
easeOutElastic - Bounce effects (damage shake)
linear         - Continuous animations
```

### Animation Examples

**Button Hover**
```javascript
anime({
  targets: button,
  scaleX: 1.02,
  scaleY: 1.02,
  duration: 100,
  easing: 'easeOutQuad'
});
```

**Damage Flash**
```javascript
anime({
  targets: damageOverlay,
  alpha: [0.4, 0],
  duration: 300,
  easing: 'easeOutQuad'
});
```

**Notification Entry**
```javascript
anime({
  targets: notification,
  alpha: [0, 1],
  top: ['-100px', '-80px'],
  duration: 300,
  easing: 'easeOutQuad'
});
```

## Iconography

### Current Icons

Using Unicode symbols for simplicity:
- Star: `★` - Insignia/rank
- Crosshair: Built from rectangles

### Future Considerations

When adding icons:
- SVG format only
- Single color (use currentColor)
- Minimum 24x24 touch target
- Military/tactical style

## Accessibility

### Color Contrast

- Text on dark: minimum 4.5:1 ratio
- Large text: minimum 3:1 ratio
- Interactive elements: clear focus states

### Touch Targets

- Minimum 44x44px for all interactive elements
- 8px minimum spacing between targets

### Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Readers

- All buttons have text labels
- Health displayed as "X of Y"
- Mission status announced

## Platform Considerations

### iOS Safari

- `viewport-fit=cover` for notch
- `-webkit-touch-callout: none` to prevent menus
- `touch-action: manipulation` to prevent zoom

### Android Chrome

- Theme color meta tag: `#1C1C1C`
- Fullscreen API supported
- Wake lock API supported

### Foldables

- Test in both folded and unfolded states
- Support `horizontal-viewport-segments` media query
- Avoid placing critical UI near fold

## Design Token Usage

Always import from designTokens.ts:

```typescript
import { tokens } from '../utils/designTokens';

// Colors
material.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
button.background = tokens.colors.ui.background;

// Spacing
container.left = `${tokens.spacing.md}px`;

// Border radius
button.cornerRadius = tokens.effects.borderRadius.sm;
```

Never hardcode values. If a value isn't in tokens, add it first.

---

*"Form follows function. Every element serves the mission."*
