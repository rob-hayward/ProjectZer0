// ProjectZer0Frontend/src/lib/constants/colors.ts
export const COLORS = {
    // Synthwave / Space Theme — luminous colours for dark backgrounds, all supporting white text
PRIMARY: {
    // === Core Content Nodes ===
    OPEN_QUESTION: '#1468E8',   // Azure Neon Noir — exploratory, energetic
    ANSWER:        '#7A2FD3',   // Ultra Violet Noir — intellectual, decisive
    QUANTITY:      '#2C6C8C',   // Deep Teal Pulse — analytical, numerical
    STATEMENT:     '#534B7B',   // Magenta Noir — declarative, confident

    // === Supporting Nodes ===
    WORD:          '#009E87',   // Alpine Green Noir — foundational, grounded
    DEFINITION:    '#0E6F4A',   // Blue Graphite — precise, technical
    CATEGORY:      '#2F5D82',   // Muted Violet Carbon — organizational
    EVIDENCE:      '#B4523A',   // Slate Cyan Noir — supportive, reliable
    COMMENT:       '#D02B89',   // Ember Copper Noir — expressive, warm contrast

    // === Functional / Utility ===
    HIDDEN:         '#0F172A',
    CENTRAL_UTILITY:'#FFFFFF',

    // === Voting Colors ===
    GREEN: '#28D97E',
    RED:   '#E03A2E',

    // === Legacy (unchanged) ===
    BLUE:      '#3498db',
    PURPLE:    '#9b59b6',
    TURQUOISE: '#1abc9c',
    FOREST:    '#27ae60',
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
