// src/lib/components/welcome/constants.ts
import { Color } from 'three';

export const CAMERA = {
  FOV: 100,
  NEAR: 0.1,
  FAR: 2000,
  POSITION_Z: 9
};

export const SKYBOX = {
  RADIUS: 200,
  SEGMENTS: 128
};

export const LARGER_SPHERE = {
  RADIUS: 6.2,
  SEGMENTS: 64
};

export const SMALLER_SPHERE = {
  RADIUS: 0.47,
  SEGMENTS: 128,
  POSITION_Z: 8.3
};

export const COLORS = {
  WHITE: new Color(0xFFFFFF),
  BLACK: new Color(0x000000)
};

export const BACKGROUND = {
    NODE_COUNT: 55,
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 2,
    NODE_SIZE: 0.3,
    EDGE_OPACITY: 0.02,
    NODE_OPACITY: 0.6,
    Z_POSITION: -50,
    FIELD_SIZE: 375,         // Increased from 100 to cover 4x the area
    MOVEMENT: {
      BASE_VELOCITY: 0.065,  // Halved from 0.15
      VELOCITY_SCALE: 0.25,  // Halved from 0.5
      DRIFT_FORCE: 0.002,    // Reduced from 0.008 for smoother movement
      MAX_SPEED: 0.125       // Halved from 0.25
    }
  };

export const ANIMATION_DURATION = 13;