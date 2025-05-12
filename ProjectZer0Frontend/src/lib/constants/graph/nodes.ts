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
    VOTE_BASED_STYLING: {
        // Number of votes required for each visual increment
        VOTES_PER_INCREMENT: 10,
        // Maximum vote count for styling (prevents excessive styling)
        MAX_VOTE_THRESHOLD: 100,
        // Glow effect enhancements
        GLOW: {
            // Base values for zero net votes
            BASE: {
                INTENSITY: 2,
                OPACITY: 0.3
            },
            // Maximum values at max vote threshold
            MAX: {
                INTENSITY: 8,
                OPACITY: 0.8
            },
            // Increment per VOTES_PER_INCREMENT votes
            INCREMENT: {
                INTENSITY: 0.6,
                OPACITY: 0.05
            }
        },
        // Ring styling enhancements
        RING: {
            // Base values for zero net votes
            BASE: {
                WIDTH: 1,
                OPACITY: 0.5
            },
            // Maximum values at max vote threshold
            MAX: {
                WIDTH: 3,
                OPACITY: 1.0
            },
            // Increment per VOTES_PER_INCREMENT votes
            INCREMENT: {
                WIDTH: 0.2,
                OPACITY: 0.05
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
        },
        STATEMENT: {
            background: `${COLORS.PRIMARY.GREEN}33`,
            border: `${COLORS.PRIMARY.GREEN}FF`,
            text: `${COLORS.PRIMARY.GREEN}FF`,
            hover: `${COLORS.PRIMARY.GREEN}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.GREEN}66`,
                end: `${COLORS.PRIMARY.GREEN}33`
            }
        },
        QUANTITY: {
            background: `${COLORS.PRIMARY.TURQUOISE}33`,
            border: `${COLORS.PRIMARY.TURQUOISE}FF`,
            text: `${COLORS.PRIMARY.TURQUOISE}FF`,
            hover: `${COLORS.PRIMARY.TURQUOISE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.TURQUOISE}66`,
                end: `${COLORS.PRIMARY.TURQUOISE}33`
            }
        },
        COMMENT: {
            background: `${COLORS.PRIMARY.YELLOW}33`,
            border: `${COLORS.PRIMARY.YELLOW}FF`,
            text: `${COLORS.PRIMARY.YELLOW}FF`,
            hover: `${COLORS.PRIMARY.YELLOW}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.YELLOW}66`,
                end: `${COLORS.PRIMARY.YELLOW}33`
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