// src/lib/utils/svgAnimations.ts
interface GlowEffect {
    color: string;
    radius: number;
    intensity: number;
    fade?: boolean;
 }
 
 export function createGlowFilter(effect: GlowEffect): {
    id: string;
    element: string;
 } {
    const id = `glow-${Math.random().toString(36).slice(2)}`;
    
    // Match canvas intensity calculations exactly
    const intensityHex = Math.floor(effect.intensity * 255)
        .toString(16)
        .padStart(2, '0');
    
    const intensityHighHex = Math.floor(effect.intensity * 1.5 * 255)
        .toString(16)
        .padStart(2, '0');
 
    // Simplified filter matching canvas gradient behavior
    const element = `
        <filter id="${id}" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${effect.fade ? effect.radius - 20 : 0}" result="blur"/>
            <feFlood flood-color="${effect.color}" flood-opacity="${effect.fade ? 0 : 1}" result="color"/>
            <feComposite in="color" in2="blur" operator="in" result="glow"/>
            <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    `;
 
    return { id, element };
 }
 
 export function createGlowGradient(effect: GlowEffect): {
    id: string;
    element: string;
 } {
    const id = `glow-gradient-${Math.random().toString(36).slice(2)}`;
    
    const intensityHex = Math.floor(effect.intensity * 255)
        .toString(16)
        .padStart(2, '0');
    
    const intensityHighHex = Math.floor(effect.intensity * 1.5 * 255)
        .toString(16)
        .padStart(2, '0');
 
    // Exactly match canvas gradient stops
    const stops = effect.fade
        ? `
            <stop offset="0%" stop-color="${effect.color}" stop-opacity="0"/>
            <stop offset="70%" stop-color="${effect.color}" stop-opacity="${effect.intensity}"/>
            <stop offset="100%" stop-color="${effect.color}" stop-opacity="${effect.intensity * 1.5}"/>
        `
        : `
            <stop offset="0%" stop-color="${effect.color}" stop-opacity="1"/>
            <stop offset="50%" stop-color="${effect.color}" stop-opacity="${effect.intensity}"/>
            <stop offset="100%" stop-color="${effect.color}" stop-opacity="0"/>
        `;
 
    // Match canvas gradient radius behavior
    const element = `
        <radialGradient id="${id}" 
            cx="50%" cy="50%" 
            r="${effect.radius}" 
            fx="50%" fy="50%"
            gradientUnits="userSpaceOnUse"
        >
            ${stops}
        </radialGradient>
    `;
 
    return { id, element };
 }