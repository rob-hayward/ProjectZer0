// ProjectZer0Frontend/src/lib/constants/colors.ts
export const COLORS = {
    // Synthwave / Space Theme — luminous colours for dark backgrounds, all supporting white text
PRIMARY: {
    // === Core Content Nodes (Cool Neons, Optimized for White Text) ===
    OPEN_QUESTION: '#00B8FF',  // Bright sky cyan — inviting, readable
    ANSWER: '#5A2CFF',         // Royal violet — intellectual contrast
    STATEMENT: '#E300D6',      // Electric fuchsia — bold, assertive
    QUANTITY: '#A445FF',       // Vivid purple — analytical, balanced

    // === Supporting Nodes (Warm Neons, Optimized for White Text) ===
    WORD: '#FFC400',           // Golden amber — foundational
    DEFINITION: '#A4FF00',     // Neon lime — conceptual clarity
    CATEGORY: '#00FFB0',       // Bright aqua-mint — organizational
    EVIDENCE: '#00E060',       // Emerald-teal — supportive precision
    COMMENT: '#FF5E1F',        // Fiery orange — expressive, conversational

    // === Functional / Utility ===
    HIDDEN: '#0B0B1F',
    CENTRAL_UTILITY: '#FFFFFF',

    // === Voting Colors (harmonized for contrast) ===
    GREEN: '#00D46A',
    RED: '#FF3B30',

    // === Legacy ===
    BLUE: '#3498db',
    PURPLE: '#9b59b6',
    TURQUOISE: '#1abc9c',
    FOREST: '#27ae60',
},

    // UI colors
    UI: {
        BACKGROUND: '#030014',  // Deep cosmic black-violet
        TEXT: {
            PRIMARY: '#FFFFFF',
            SECONDARY: 'rgba(255, 255, 255, 0.75)',
            TERTIARY: 'rgba(255, 255, 255, 0.5)'
        },
        BORDER: {
            LIGHT: 'rgba(255, 255, 255, 0.25)',
            LIGHTER: 'rgba(255, 255, 255, 0.4)'
        }
    },

    // Graph specific colors
    GRAPH: {
        NODE: {
            BACKGROUND: 'rgba(10, 10, 25, 0.8)',
            BORDER: 'rgba(255, 255, 255, 0.2)',
            HOVER_BORDER: 'rgba(255, 255, 255, 0.45)',
            GLOW: 'rgba(255, 255, 255, 0.15)'
        },
        EDGE: {
            DEFAULT: 'rgba(255, 255, 255, 0.2)',
            HIGHLIGHT: 'rgba(255, 255, 255, 0.5)'
        }
    }
} as const;
