// src/lib/components/graph/nodes/base/BaseNodeConstants.ts
export const CIRCLE_RADIUS = 290;

export const NODE_CONSTANTS = {
    SIZES: {
        WORD: {
            preview: 300,      
            zoomed: 600       
        },
        DEFINITION: {
            base: {
                preview: 360,
                zoomed: 600
            },
            live: {
                preview: 360,
                zoomed: 600
            },
            alternative: {
                preview: 320,
                zoomed: 600
            }
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
            live: {
                background: 'rgba(74, 144, 226, 0.1)',
                border: 'rgba(74, 144, 226, 0.3)',
                text: 'rgba(74, 144, 226, 0.9)',
                hover: 'rgba(74, 144, 226, 0.5)',
                gradient: {
                    start: 'rgba(74, 144, 226, 0.2)',
                    end: 'rgba(74, 144, 226, 0.1)'
                }
            },
            alternative: {
                background: 'rgba(0, 0, 0, 0.8)',
                border: 'rgba(255, 255, 255, 0.2)',
                text: 'rgba(255, 255, 255, 0.9)',
                hover: 'rgba(255, 255, 255, 0.4)',
                gradient: {
                    start: 'rgba(0, 0, 0, 0.9)',
                    end: 'rgba(0, 0, 0, 0.8)'
                }
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
    },
    LAYOUT: {
        RADIUS: {
            CENTER: 0,
            LIVE_DEFINITION: 200,
            ALTERNATIVE_BASE: 300,
            MAX_RADIUS: 500
        },
        FORCES: {
            CHARGE: -800,
            COLLISION: 150,
            RADIAL: 0.7
        }
    }
} as const;