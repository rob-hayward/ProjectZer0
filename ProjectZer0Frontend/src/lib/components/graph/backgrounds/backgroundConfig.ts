// src/lib/components/graph/backgrounds/backgroundConfig.ts
import { COLORS } from '$lib/constants/colors';

// Base style constants
const NODE_STYLE = {
    RADIUS: 3,
    GLOW_RADIUS: 5,
    GLOW_OPACITY: 0.25
} as const;

// Simple movement constants based on the reference example
const MOVEMENT_STYLE = {
    BASE_VELOCITY: 0.15,      // Initial velocity range (-0.15 to 0.15)
    VELOCITY_SCALE: 0.5,      // Scale factor for velocity (like the 0.5 in the reference)
    DRIFT_FORCE: 0.008,       // Small random adjustments
    MAX_SPEED: 0.25          // Maximum allowed speed
} as const;

export interface BackgroundNodeStyle {
    mainRadius: number;
    glowRadius: number;
    mainColor: string;
    glowColor: string;
    glowOpacity: number;
}

export interface BackgroundEdgeStyle {
    width: number;
    color: string;
    glowColor: string;
    glowWidth: number;
    opacity: number;
}

export interface ViewportConfig {
    origin: {
        x: number;
        y: number;
    };
    scale: number;
    preserveAspectRatio: string;
}

export interface AnimationConfig {
    baseVelocity: number;
    velocityScale: number;
    driftForce: number;
    maxSpeed: number;
}

export interface BackgroundConfig {
    nodeCount: number;
    viewportScale: number;
    minConnections: number;
    maxConnections: number;
    nodeStyles: BackgroundNodeStyle[];
    edgeStyle: BackgroundEdgeStyle;
    viewport: ViewportConfig;
    animation: AnimationConfig;
}

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
    nodeCount: 35,
    viewportScale: 1.5,
    minConnections: 2,
    maxConnections: 4,
    viewport: {
        origin: {
            x: -0.5,
            y: -0.5
        },
        scale: 1,
        preserveAspectRatio: 'xMidYMid meet'
    },
    animation: {
        baseVelocity: MOVEMENT_STYLE.BASE_VELOCITY,
        velocityScale: MOVEMENT_STYLE.VELOCITY_SCALE,
        driftForce: MOVEMENT_STYLE.DRIFT_FORCE,
        maxSpeed: MOVEMENT_STYLE.MAX_SPEED
    },
    nodeStyles: [
        {
            mainRadius: NODE_STYLE.RADIUS,
            glowRadius: NODE_STYLE.GLOW_RADIUS,
            mainColor: COLORS.PRIMARY.BLUE,
            glowColor: COLORS.PRIMARY.BLUE,
            glowOpacity: NODE_STYLE.GLOW_OPACITY
        },
        {
            mainRadius: NODE_STYLE.RADIUS,
            glowRadius: NODE_STYLE.GLOW_RADIUS,
            mainColor: COLORS.PRIMARY.PURPLE,
            glowColor: COLORS.PRIMARY.PURPLE,
            glowOpacity: NODE_STYLE.GLOW_OPACITY
        },
        {
            mainRadius: NODE_STYLE.RADIUS,
            glowRadius: NODE_STYLE.GLOW_RADIUS,
            mainColor: COLORS.PRIMARY.GREEN,
            glowColor: COLORS.PRIMARY.GREEN,
            glowOpacity: NODE_STYLE.GLOW_OPACITY
        }
    ],
    edgeStyle: {
        width: 1.2,
        color: COLORS.GRAPH.EDGE.DEFAULT,
        glowColor: COLORS.UI.TEXT.TERTIARY,
        glowWidth: 1,
        opacity: 0.08
    }
};