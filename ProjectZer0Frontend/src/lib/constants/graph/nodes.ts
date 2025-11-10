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
        VOTES_PER_INCREMENT: 10,
        MAX_VOTE_THRESHOLD: 100,
        GLOW: {
            BASE: { INTENSITY: 2, OPACITY: 0.3 },
            MAX: { INTENSITY: 8, OPACITY: 0.8 },
            INCREMENT: { INTENSITY: 0.6, OPACITY: 0.05 }
        },
        RING: {
            BASE: { WIDTH: 1, OPACITY: 0.5 },
            MAX: { WIDTH: 3, OPACITY: 1.0 },
            INCREMENT: { WIDTH: 0.2, OPACITY: 0.05 }
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

        // === Synthwave Palette Nodes ===

        WORD: {
            background: `${COLORS.PRIMARY.WORD}33`,
            border: `${COLORS.PRIMARY.WORD}FF`,
            text: `${COLORS.PRIMARY.WORD}FF`,
            hover: `${COLORS.PRIMARY.WORD}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.WORD}66`,
                end: `${COLORS.PRIMARY.WORD}33`
            }
        },

        DEFINITION: {
            live: {
                background: `${COLORS.PRIMARY.DEFINITION}33`,
                border: `${COLORS.PRIMARY.DEFINITION}FF`,
                text: `${COLORS.PRIMARY.DEFINITION}FF`,
                hover: `${COLORS.PRIMARY.DEFINITION}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.DEFINITION}66`,
                    end: `${COLORS.PRIMARY.DEFINITION}33`
                }
            },
            alternative: {
                background: `${COLORS.PRIMARY.DEFINITION}33`,
                border: `${COLORS.PRIMARY.DEFINITION}FF`,
                text: `${COLORS.PRIMARY.DEFINITION}FF`,
                hover: `${COLORS.PRIMARY.DEFINITION}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.DEFINITION}66`,
                    end: `${COLORS.PRIMARY.DEFINITION}33`
                }
            }
        },

        STATEMENT: {
            background: `${COLORS.PRIMARY.STATEMENT}33`,
            border: `${COLORS.PRIMARY.STATEMENT}FF`,
            text: `${COLORS.PRIMARY.STATEMENT}FF`,
            hover: `${COLORS.PRIMARY.STATEMENT}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.STATEMENT}66`,
                end: `${COLORS.PRIMARY.STATEMENT}33`
            }
        },

        OPENQUESTION: {
            background: `${COLORS.PRIMARY.OPEN_QUESTION}33`,
            border: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
            text: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
            hover: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.OPEN_QUESTION}66`,
                end: `${COLORS.PRIMARY.OPEN_QUESTION}33`
            }
        },

        ANSWER: {
            background: `${COLORS.PRIMARY.ANSWER}33`,
            border: `${COLORS.PRIMARY.ANSWER}FF`,
            text: `${COLORS.PRIMARY.ANSWER}FF`,
            hover: `${COLORS.PRIMARY.ANSWER}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.ANSWER}66`,
                end: `${COLORS.PRIMARY.ANSWER}33`
            }
        },

        QUANTITY: {
            background: `${COLORS.PRIMARY.QUANTITY}33`,
            border: `${COLORS.PRIMARY.QUANTITY}FF`,
            text: `${COLORS.PRIMARY.QUANTITY}FF`,
            hover: `${COLORS.PRIMARY.QUANTITY}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.QUANTITY}66`,
                end: `${COLORS.PRIMARY.QUANTITY}33`
            }
        },

        COMMENT: {
            background: `${COLORS.PRIMARY.COMMENT}33`,
            border: `${COLORS.PRIMARY.COMMENT}FF`,
            text: `${COLORS.PRIMARY.COMMENT}FF`,
            hover: `${COLORS.PRIMARY.COMMENT}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.COMMENT}66`,
                end: `${COLORS.PRIMARY.COMMENT}33`
            }
        },

        EVIDENCE: {
            background: `${COLORS.PRIMARY.EVIDENCE}33`,
            border: `${COLORS.PRIMARY.EVIDENCE}FF`,
            text: `${COLORS.PRIMARY.EVIDENCE}FF`,
            hover: `${COLORS.PRIMARY.EVIDENCE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.EVIDENCE}66`,
                end: `${COLORS.PRIMARY.EVIDENCE}33`
            }
        },

        EDIT_PROFILE: {
            background: '#FFFFFF33',
            border: '#FFFFFFFF',
            text: '#FFFFFFFF',
            hover: '#FFFFFFFF',
            gradient: {
                start: '#FFFFFF66',
                end: '#FFFFFF33'
            }
        }
    },

    FONTS: {
        title: { family: 'Orbitron', size: '12px', weight: '500' },
        value: { family: 'Orbitron', size: '14px', weight: '300' },
        hover: { family: 'Orbitron', size: '10px', weight: '400' },
        word: { family: 'Orbitron', size: '14px', weight: '500' }
    },

    SVG: {
        filters: {
            glow: { deviation: 3, strength: 0.5 },
            hover: { deviation: 5, strength: 0.7 }
        },
        animation: {
            duration: '0.3s',
            easing: 'ease-out'
        }
    }
} as const;
