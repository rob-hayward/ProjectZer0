// src/lib/types/svgLayout.ts
export interface SvgViewport {
    width: number;
    height: number;
}

export interface SvgAnimation {
    duration: number;
    easing: string;
}

export interface SvgLayoutConfig {
    renderMode: 'svg';
    viewport: SvgViewport;
    animation: SvgAnimation;
    // SVG-specific layout settings
    initialZoom: number;
    minZoom: number;
    maxZoom: number;
    minNodeSize: number;
    maxNodeSize: number;
    // Custom layout properties
    centerRadius: number;
    ringSpacing: number;
}

export interface SvgNodePosition {
    // Base position properties
    x: number;
    y: number;
    scale: number;
    rotation: number;
    // SVG-specific
    svgTransform: string;
    renderOrder: number;
    // Additional metadata
    ring: number;
    ringPosition: number;
    distanceFromCenter: number;
}