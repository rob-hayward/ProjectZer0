// ProjectZer0Frontend/src/lib/constants/colors.ts
// Destiny-inspired palette: vivid but refined, designed for white text on deep space background.

export const COLORS = {
  // PRIMARY palette (content + support), each with a hover/light variant for gradients and glows
  PRIMARY: {
    // === Core Content Nodes ===
    OPEN_QUESTION: '#5BB7FF',      // Bright cerulean — discovery
    OPEN_QUESTION_HOVER: '#8FDFFF',

    ANSWER: '#B68CFF',             // Lavender-violet — resolution
    ANSWER_HOVER: '#D8B8FF',

    QUANTITY: '#48E0C2',           // Aqua-tech — numeric
    QUANTITY_HOVER: '#78F0D9',

    STATEMENT: '#FF7FD1',          // Magenta-crystal — declarative
    STATEMENT_HOVER: '#FF9FD8',

    // === Supporting Nodes ===
    WORD: '#FFD86E',               // Warm golden-data
    WORD_HOVER: '#FFE59A',

    DEFINITION: '#FFB447',         // Amber-clarity
    DEFINITION_HOVER: '#FFD07A',

    CATEGORY: '#FF8A3D',           // Orange-coral organizational
    CATEGORY_HOVER: '#FFAB78',

    EVIDENCE: '#67F28E',           // Clean supportive green
    EVIDENCE_HOVER: '#8EF7B9',

    COMMENT: '#FF6B6B',            // Lively coral-red
    COMMENT_HOVER: '#FF8B8B',

    // === Functional / Utility ===
    HIDDEN: '#0F172A',             // deep space navy
    CENTRAL_UTILITY: '#FFFFFF',    // white anchor (use black text on this one if needed)

    // === Voting Colors (kept modern) ===
    GREEN: '#32FF9A',              // Positive vote
    RED: '#FF5A7A',                // Negative vote

    // === Legacy (retain for compatibility) ===
    BLUE: '#3498db',
    PURPLE: '#9b59b6',
    TURQUOISE: '#1abc9c',
    FOREST: '#27ae60'
  },

  // UI colors
  UI: {
    BACKGROUND: '#030014', // deep cosmic black-violet
    TEXT: {
      PRIMARY: '#FFFFFF',
      SECONDARY: 'rgba(255,255,255,0.75)',
      TERTIARY: 'rgba(255,255,255,0.5)'
    },
    BORDER: {
      LIGHT: 'rgba(255,255,255,0.25)',
      LIGHTER: 'rgba(255,255,255,0.4)'
    }
  },

  // Graph specific colors used as defaults in nodes.ts
  GRAPH: {
    NODE: {
      BACKGROUND: 'rgba(10, 10, 25, 0.8)',
      BORDER: 'rgba(255, 255, 255, 0.22)',
      HOVER_BORDER: 'rgba(255, 255, 255, 0.45)',
      GLOW: 'rgba(255, 255, 255, 0.12)'
    },
    EDGE: {
      DEFAULT: 'rgba(255,255,255,0.18)',
      HIGHLIGHT: 'rgba(255,255,255,0.45)'
    }
  }
} as const;
