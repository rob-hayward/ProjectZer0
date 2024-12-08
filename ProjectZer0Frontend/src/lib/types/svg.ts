// src/lib/types/svg.ts
import type { NodeMode, NodeStyle } from './nodes';

export interface SvgNodeProps {
    centerX: number;
    centerY: number;
    radius: number;
    transform?: string;
    isHovered?: boolean;
    mode?: NodeMode;
    style?: NodeStyle;
}

export interface SvgNodeState {
    width: number;
    height: number;
    viewBox: string;
}

export interface SvgTextConfig {
    x: number;
    y: number;
    fontFamily?: string;
    fontSize?: string;
    fill?: string;
    textAnchor?: 'start' | 'middle' | 'end';
    dominantBaseline?: 'auto' | 'middle' | 'hanging';
}

export interface SvgGradientConfig {
    id: string;
    colors: {
        start: string;
        end: string;
    };
    opacity?: {
        start: number;
        end: number;
    };
}

export interface SvgAnimationConfig {
    duration: string;
    easing: string;
    delay?: string;
}