// ProjectZer0Frontend/src/lib/constants/colors.ts
export const COLORS = {
    // Synthwave / Space Theme — luminous colours for dark backgrounds, all supporting white text
    PRIMARY: {
        // === Core Content Nodes ===
        STATEMENT: '#FF9E00',     // Bright amber — confident, central assertions
        OPEN_QUESTION: '#00B4D8', // Cyan — inquisitive, cool, invites exploration
        ANSWER: '#8338EC',        // Electric violet — intellectual, pairs naturally with question cyan
        QUANTITY: '#FF4D6D',      // Neon pink-red — energetic, numeric, grabs focus

        // === Supporting Nodes ===
        WORD: '#7B2CBF',          // Deep purple — foundational concepts
        DEFINITION: '#9D4EDD',    // Medium violet — ties closely to Word, but more luminous
        EVIDENCE: '#4361EE',      // Vibrant blue — reliable, precise, supportive
        COMMENT: '#F72585',       // Hot magenta — expressive, social, conversational

        // === Functional / Utility ===
        HIDDEN: '#0F172A',        // Deep space navy
        CENTRAL_UTILITY: '#FFFFFF', // White — neutral anchor, black text on this one

        // === Voting Colors (unchanged) ===
        GREEN: '#2ECC71',         // Positive vote
        RED: '#E74C3C',           // Negative vote

        // === Legacy (retain for compatibility) ===
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
