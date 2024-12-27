// src/lib/components/graph/nodes/navigation/navigationColors.ts
import { COLORS } from '$lib/constants/colors';

export const navigationColors = {
    explore: COLORS.PRIMARY.BLUE,
    'create-node': COLORS.PRIMARY.YELLOW,
    network: COLORS.PRIMARY.PURPLE,
    creations: COLORS.PRIMARY.GREEN,
    interactions: COLORS.PRIMARY.TURQUOISE,
    'edit-profile': COLORS.PRIMARY.ORANGE,
    logout: COLORS.PRIMARY.RED,
    dashboard: COLORS.PRIMARY.BLUE,  // Matching explore blue
    'alternative-definitions': COLORS.PRIMARY.PURPLE,  // Changed from FOREST to PURPLE
    'create-alternative': COLORS.PRIMARY.PURPLE,      // Same as alternative-definitions
    'discuss': COLORS.PRIMARY.TURQUOISE               // Using TURQUOISE for discussion
} as const;

export type NavigationNodeType = keyof typeof navigationColors;

export function getNavigationColor(nodeId: string): string {
    return navigationColors[nodeId as NavigationNodeType] || navigationColors.explore;
}