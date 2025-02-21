// src/lib/components/graph/backgrounds/backgroundConfig.ts
import { COLORS } from '$lib/constants/colors';
import { COORDINATE_SPACE } from '$lib/constants/graph';

// Base style constants
const NODE_STYLE = {
    RADIUS: 100,             // Much larger for visibility in world space
    GLOW_RADIUS: 200,        // Larger glow for better effect
    GLOW_OPACITY: 1.4        // Increased opacity for visibility
} as const;

// Movement constants scaled for world space
const MOVEMENT_STYLE = {
    BASE_VELOCITY: 100,      // Increased for visible movement in large space
    VELOCITY_SCALE: 1.2,     // Adjusted for smooth but noticeable movement
    DRIFT_FORCE: 10,         // Increased for more dynamic movement
    MAX_SPEED: 200          // Increased to allow more movement
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
    nodeCount: 3000,          // More nodes for better coverage
    viewportScale: 1,        // Keep at 1 since we're using world space
    minConnections: 8,       // More connections for denser network
    maxConnections: 8,       // More maximum connections
    viewport: {
        origin: {
            x: -COORDINATE_SPACE.WORLD.WIDTH / 2,
            y: -COORDINATE_SPACE.WORLD.HEIGHT / 2
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
        width: 50,           // Much wider edges for visibility
        color: COLORS.GRAPH.EDGE.DEFAULT,
        glowColor: COLORS.UI.TEXT.TERTIARY,
        glowWidth: 25,       // Wider glow
        opacity: 1.15        // Slightly increased opacity
    }
};