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
        // UPDATED: Word nodes use Indigo from Newton's wheel
        WORD: {
            background: `${COLORS.PRIMARY.INDIGO}33`,
            border: `${COLORS.PRIMARY.INDIGO}FF`,
            text: `${COLORS.PRIMARY.INDIGO}FF`,
            hover: `${COLORS.PRIMARY.INDIGO}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.INDIGO}66`,
                end: `${COLORS.PRIMARY.INDIGO}33`
            }
        },
        // UPDATED: Definition nodes use Blue-Violet from Newton's wheel
        DEFINITION: {
            live: {
                background: `${COLORS.PRIMARY.BLUE_VIOLET}33`,
                border: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                text: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                hover: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.BLUE_VIOLET}66`,
                    end: `${COLORS.PRIMARY.BLUE_VIOLET}33`
                }
            },
            alternative: {
                background: `${COLORS.PRIMARY.BLUE_VIOLET}33`,
                border: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                text: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                hover: `${COLORS.PRIMARY.BLUE_VIOLET}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.BLUE_VIOLET}66`,
                    end: `${COLORS.PRIMARY.BLUE_VIOLET}33`
                }
            }
        },
        // UPDATED: Statement nodes use Yellow from Newton's wheel
        STATEMENT: {
            background: `${COLORS.PRIMARY.YELLOW}33`,
            border: `${COLORS.PRIMARY.YELLOW}FF`,
            text: `${COLORS.PRIMARY.YELLOW}FF`,
            hover: `${COLORS.PRIMARY.YELLOW}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.YELLOW}66`,
                end: `${COLORS.PRIMARY.YELLOW}33`
            }
        },
        // UPDATED: OpenQuestion nodes use Cyan from Newton's wheel
        OPENQUESTION: {
            background: `${COLORS.PRIMARY.CYAN}33`,
            border: `${COLORS.PRIMARY.CYAN}FF`,
            text: `${COLORS.PRIMARY.CYAN}FF`,
            hover: `${COLORS.PRIMARY.CYAN}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.CYAN}66`,
                end: `${COLORS.PRIMARY.CYAN}33`
            }
        },
        // UPDATED: Quantity nodes use Orange from Newton's wheel
        QUANTITY: {
            background: `${COLORS.PRIMARY.ORANGE}33`,
            border: `${COLORS.PRIMARY.ORANGE}FF`,
            text: `${COLORS.PRIMARY.ORANGE}FF`,
            hover: `${COLORS.PRIMARY.ORANGE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.ORANGE}66`,
                end: `${COLORS.PRIMARY.ORANGE}33`
            }
        },
        // UPDATED: Comment nodes use Magenta from Newton's wheel
        COMMENT: {
            background: `${COLORS.PRIMARY.MAGENTA}33`,
            border: `${COLORS.PRIMARY.MAGENTA}FF`,
            text: `${COLORS.PRIMARY.MAGENTA}FF`,
            hover: `${COLORS.PRIMARY.MAGENTA}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.MAGENTA}66`,
                end: `${COLORS.PRIMARY.MAGENTA}33`
            }
        },
        ANSWER: {
            background: 'rgba(100, 200, 255, 0.1)',
            border: 'rgba(100, 200, 255, 1)',
            hover: 'rgba(100, 200, 255, 0.3)',
            gradient: {
                start: 'rgba(100, 200, 255, 0.2)',
                end: 'rgba(100, 200, 255, 0.05)'
            }
        },
        EVIDENCE: {
            background: 'rgba(200, 100, 255, 0.1)',
            border: 'rgba(200, 100, 255, 1)',
            hover: 'rgba(200, 100, 255, 0.3)',
            gradient: {
                start: 'rgba(200, 100, 255, 0.2)',
                end: 'rgba(200, 100, 255, 0.05)'
            }
        },
        EDIT_PROFILE: {
            background: '#FFFFFF33',      // White with 20% opacity
            border: '#FFFFFFFF',         // Solid white
            text: '#FFFFFFFF',           // Solid white
            hover: '#FFFFFFFF',          // Solid white
            gradient: {
                start: '#FFFFFF66',      // White with 40% opacity
                end: '#FFFFFF33'         // White with 20% opacity
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