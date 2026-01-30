// Military Space Design Tokens - No cyberpunk, pure tactical aesthetics
export const tokens = {
  colors: {
    // Primary Military Palette
    primary: {
      olive: '#4A5D23',
      oliveDark: '#3B4A1C',
      oliveLight: '#5C7A2E',
      khaki: '#C3B091',
      khakiDark: '#9A8A6F',
      tan: '#D4B896',
      sand: '#E8DCC4',
    },
    // Accent Colors
    accent: {
      rust: '#8B4513',
      amber: '#FFBF00',
      brass: '#B5A642',
      copper: '#B87333',
      gunmetal: '#2A3439',
    },
    // UI Colors
    ui: {
      background: '#1C1C1C',
      backgroundAlt: '#2D2D2D',
      surface: '#3A3A3A',
      text: '#E8E8E8',
      textMuted: '#A0A0A0',
      success: '#4CAF50',
      warning: '#FF9800',
      danger: '#F44336',
      health: '#4CAF50',
      shield: '#2196F3',
      energy: '#FFEB3B',
    },
    // Environment
    environment: {
      sky: '#87CEEB',
      sun: '#FFF8DC',
      sunGlow: '#FFD700',
      rock: '#8B7355',
      rockDark: '#5C4033',
      rockLight: '#A08060',
      dust: '#C4A77D',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  typography: {
    fontFamily: {
      primary: 'Rajdhani, sans-serif',
      mono: 'Share Tech Mono, monospace',
      display: 'Impact, sans-serif',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
      display: 48,
    },
  },

  effects: {
    borderRadius: {
      sm: 2,
      md: 4,
      lg: 8,
    },
    shadows: {
      sm: '0 2px 4px rgba(0,0,0,0.3)',
      md: '0 4px 8px rgba(0,0,0,0.4)',
      lg: '0 8px 16px rgba(0,0,0,0.5)',
    },
  },
} as const;

// Camo pattern generator for UI elements
export function generateCamoPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const colors = [
    tokens.colors.primary.olive,
    tokens.colors.primary.oliveDark,
    tokens.colors.primary.khaki,
    tokens.colors.accent.gunmetal,
  ];

  // Base fill
  ctx.fillStyle = tokens.colors.primary.olive;
  ctx.fillRect(0, 0, width, height);

  // Generate organic camo blobs
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.beginPath();

    const x = Math.random() * width;
    const y = Math.random() * height;
    const points = 5 + Math.floor(Math.random() * 4);
    const radius = 20 + Math.random() * 60;

    for (let j = 0; j < points; j++) {
      const angle = (j / points) * Math.PI * 2;
      const r = radius * (0.5 + Math.random() * 0.5);
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;

      if (j === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();
    ctx.fill();
  }
}

// Military stencil text style
export const stencilStyle = {
  color: tokens.colors.ui.text,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
};
