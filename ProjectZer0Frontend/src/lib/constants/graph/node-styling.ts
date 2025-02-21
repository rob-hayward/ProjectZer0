// src/lib/constants/graph/nodes.ts
import { COLORS } from '../colors';

export const NODE_CONSTANTS = {
    STROKE: {
        preview: {
            normal: 3,
            hover: 6
        },
        detail: {
            normal: 2,
            hover: 3
        }
    },
    LINE_HEIGHT: {
        preview: 16,         
        detail: 24           
    },
    EFFECTS: {
        glow: {
            normal: {
                blur: 5,
                strength: 0.6,
                spread: 2
            },
            hover: {
                blur: 8,
                strength: 0.8,
                spread: 3
            }
        }
    },
    COLORS: {
        DASHBOARD: {
            background: `${COLORS.PRIMARY.BLUE}33`,
            border: `${COLORS.PRIMARY.BLUE}FF`,
            text: `${COLORS.PRIMARY.BLUE}FF`,
            hover: `${COLORS.PRIMARY.BLUE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.BLUE}66`,
                end: `${COLORS.PRIMARY.BLUE}33`
            }
        },
        WORD: {
            background: `${COLORS.PRIMARY.BLUE}33`,
            border: `${COLORS.PRIMARY.BLUE}FF`,
            text: `${COLORS.PRIMARY.BLUE}FF`,
            hover: `${COLORS.PRIMARY.BLUE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.BLUE}66`,
                end: `${COLORS.PRIMARY.BLUE}33`
            }
        },
        DEFINITION: {
            live: {
                background: `${COLORS.PRIMARY.BLUE}33`,
                border: `${COLORS.PRIMARY.BLUE}FF`,
                text: `${COLORS.PRIMARY.BLUE}FF`,
                hover: `${COLORS.PRIMARY.BLUE}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.BLUE}66`,
                    end: `${COLORS.PRIMARY.BLUE}33`
                }
            },
            alternative: {
                background: `${COLORS.PRIMARY.PURPLE}33`,
                border: `${COLORS.PRIMARY.PURPLE}FF`,
                text: `${COLORS.PRIMARY.PURPLE}FF`,
                hover: `${COLORS.PRIMARY.PURPLE}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.PURPLE}66`,
                    end: `${COLORS.PRIMARY.PURPLE}33`
                }
            }
        }
    },
    FONTS: {
        title: {
            family: 'Orbitron',
            size: '12px',
            weight: '500'
        },
        value: {
            family: 'Orbitron',
            size: '14px',
            weight: '300'
        },
        hover: {
            family: 'Orbitron',
            size: '10px',
            weight: '400'
        },
        word: {
            family: 'Orbitron',
            size: '14px',
            weight: '500'
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