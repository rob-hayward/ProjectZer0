// src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
   RADIUS: {
       CENTER: 0,
       LIVE_DEFINITION: {
           ANGLE: -Math.PI / 360,
           PADDING: {
               PREVIEW: 275,
               DETAIL: 275
           }
       },
       ALTERNATIVE_DEFINITIONS: {
           PREVIEW: {
               SCALE: 5,
               SPACING: 0,
               MIN_RADIUS: 675,
               MAX_RADIUS: 2000,
               VOTE_SCALE: 5
           },
           DETAIL: {
                SCALE: 1,
                SPACING: 20,
                MIN_RADIUS: 1370,    // Base distance
                MAX_RADIUS: 4000,    // Much smaller maximum to constrain spread
                VOTE_SCALE: 0       // Minimal vote-based increment
            },
            ANGULAR_SEPARATION: Math.PI / 1,
            VOTE_SCALE_FACTOR: 1    // Minimal scaling factor
        }
   },

   FORCES: {
       CHARGE: {  // Restored CHARGE structure
           WORD: 0,
           DEFINITION: {
               LIVE: -400,
               ALTERNATIVE: -600,
               PREVIEW: -600
           }
       },
       COLLISION: {
           STRENGTH: {
               NORMAL: 1.0,
               PREVIEW: 1.2
           },
           PADDING: {
               NORMAL: 30,
               PREVIEW: 20
           }
       },
       LINK: {
           STRENGTH: {
               LIVE: 1.0,
               ALTERNATIVE: 0.5,
               VOTE_SCALE: 0.05
           }
       },
       RADIAL: {  // Restored RADIAL structure
           STRENGTH: {
               NORMAL: 1.0,
               PREVIEW: 1.2
           }
       }
   },

   NAVIGATION: {
       RADIUS: {
           DETAIL: 350,
           PREVIEW: 130
       },
       SPACING: {
           DETAIL: 60,
           PREVIEW: 45
       },
       STRENGTH: {
           RADIAL: 2.0,
           COLLISION: 1.5,
           CHARGE: -200
       }
   },

   SIMULATION: {
       VELOCITY_DECAY: 0.7,
       ALPHA_DECAY: 0.02,
       ITERATIONS: 500
   },

   EDGES: {
       WORD_TO_LIVE: {
           COLOR: COLORS.PRIMARY.BLUE,
           OPACITY: 0.8
       },
       WORD_TO_ALTERNATIVE: {
           COLOR: COLORS.PRIMARY.PURPLE,
           OPACITY: {
               NORMAL: 0.8,
               PREVIEW: 0.6
           }
       }
   },

   TRANSITIONS: {
       DURATION: 750,
       EASING: 'cubic-bezier(0.4, 0, 0.2, 1)'
   }
} as const;