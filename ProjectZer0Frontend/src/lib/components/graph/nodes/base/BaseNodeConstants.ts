// src/components/graph/nodes/base/BaseNodeConstants.ts
export const CIRCLE_RADIUS = 290;

export const NODE_CONSTANTS = {
    SIZES: {
        WORD: {
            preview: 200,      
            zoomed: 600       
        },
        DEFINITION: {
            preview: 360,
            zoomed: 600
        }
    },
    PADDING: {
        preview: 20,         
        zoomed: 40           
    },
    LINE_HEIGHT: {
        preview: 16,         
        zoomed: 24           
    },
    COLORS: {
        WORD: {
            background: 'rgba(0, 0, 0, 0.7)',
            border: 'rgba(255, 255, 255, 0.2)',
            text: 'rgba(255, 255, 255, 0.9)',
            hover: 'rgba(255, 255, 255, 0.4)'
        },
        DEFINITION: {
            background: 'rgba(0, 0, 0, 0.8)',
            border: 'rgba(74, 144, 226, 0.2)',
            text: 'rgba(255, 255, 255, 0.9)',
            hover: 'rgba(74, 144, 226, 0.4)'
        }
    },
    FONTS: {
        title: '24px "Orbitron", sans-serif',
        value: '26px "Orbitron", sans-serif',
        hover: '18px "Orbitron", sans-serif'
    }
} as const;