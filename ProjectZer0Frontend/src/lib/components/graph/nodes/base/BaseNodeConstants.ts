// src/lib/components/graph/nodes/base/BaseNodeConstants.ts
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
            hover: 'rgba(255, 255, 255, 0.4)',
            gradient: {
                start: 'rgba(0, 0, 0, 0.8)',
                end: 'rgba(0, 0, 0, 0.7)'
            }
        },
        DEFINITION: {
            background: 'rgba(0, 0, 0, 0.8)',
            border: 'rgba(74, 144, 226, 0.2)',
            text: 'rgba(255, 255, 255, 0.9)',
            hover: 'rgba(74, 144, 226, 0.4)',
            gradient: {
                start: 'rgba(0, 0, 0, 0.9)',
                end: 'rgba(0, 0, 0, 0.8)'
            }
        }
    },
    FONTS: {
        title: {
            family: 'Orbitron',
            size: '16px',
            weight: '500'
        },
        value: {
            family: 'Orbitron',
            size: '14px',
            weight: '400'
        },
        hover: {
            family: 'Orbitron',
            size: '10px',
            weight: '400'
        }
    },
    SVG: {
        filters: {
            glow: {
                deviation: 3,
                strength: 0.5
            },
            hover: {
                deviation: 5,
                strength: 0.7
            }
        },
        animation: {
            duration: '0.3s',
            easing: 'ease-out'
        }
    }
} as const;