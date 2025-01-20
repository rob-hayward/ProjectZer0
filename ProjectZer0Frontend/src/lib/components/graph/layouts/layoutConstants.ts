// layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
   RADIUS: {
       CENTER: 0,
       DEFINITIONS: {
           PREVIEW: {
               SCALE: 0.6,
               SPACING: 150,
               MIN_RADIUS: 250,
               MAX_RADIUS: 1500,
               VOTE_SCALE_FACTOR: 0.1  // Reduced for smoother scaling
           },
           DETAIL: {
               SCALE: 1.5,  // Increased from 1
               SPACING: 550,
               MIN_RADIUS: 600,
               MAX_RADIUS: 2000,
               VOTE_SCALE_FACTOR: 0.15
           }
       }
   },

   FORCES: {
       CHARGE: {
           WORD: -1000,
           DEFINITION: {
               PREVIEW: -800,
               DETAIL: -2000
           }
       },
       COLLISION: {
           STRENGTH: {
               NORMAL: 1.5,    // Increased from 1.0
               DETAIL: 2.0     // Increased from 1.5
           },
           PADDING: {
               NORMAL: 75,     // Increased from 50
               DETAIL: 400     // Increased from 350
           }
       },
       LINK: {
           STRENGTH: 0.5,     // Increased from 0.3
           DISTANCE: {
               PREVIEW: 400,
               DETAIL: 800,
               DETAIL_BONUS: 200
           }
       },
       RADIAL: {
           STRENGTH: {
               PREVIEW: 1.0,   // Increased from 0.8
               DETAIL: 0.7     // Increased from 0.5
           }
       }
   },

   NAVIGATION: {
       RADIUS: {
           DETAIL: 355,
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
       VELOCITY_DECAY: 0.4,
       ALPHA_DECAY: 0.02,
       ITERATIONS: 500,       // Increased from 300
       ALPHA_TARGET: {
           NORMAL: 0,
           TRANSITIONING: 0.3
       }
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