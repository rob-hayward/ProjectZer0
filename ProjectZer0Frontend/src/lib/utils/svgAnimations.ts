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
    
    // Convert intensity to hex, matching canvas implementation
    const intensityHex = Math.floor(effect.intensity * 255)
        .toString(16)
        .padStart(2, '0');
    
    const intensityHighHex = Math.floor(effect.intensity * 1.5 * 255)
        .toString(16)
        .padStart(2, '0');

    // Create SVG filter that mimics the canvas radial gradient
    const element = `
        <filter id="${id}" x="-100%" y="-100%" width="300%" height="300%">
            ${effect.fade ? `
                <!-- Fading glow effect -->
                <feGaussianBlur in="SourceAlpha" stdDeviation="${effect.radius / 6}" result="blur"/>
                <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="
                        1 0 0 0 ${parseInt(effect.color.slice(1,3), 16)/255}
                        0 1 0 0 ${parseInt(effect.color.slice(3,5), 16)/255}
                        0 0 1 0 ${parseInt(effect.color.slice(5,7), 16)/255}
                        0 0 0 ${effect.intensity * 1.5} 0
                    "
                    result="coloredBlur"
                />
                <feGaussianBlur in="SourceAlpha" stdDeviation="${(effect.radius - 20) / 6}" result="innerBlur"/>
                <feColorMatrix
                    in="innerBlur"
                    type="matrix"
                    values="
                        1 0 0 0 ${parseInt(effect.color.slice(1,3), 16)/255}
                        0 1 0 0 ${parseInt(effect.color.slice(3,5), 16)/255}
                        0 0 1 0 ${parseInt(effect.color.slice(5,7), 16)/255}
                        0 0 0 ${effect.intensity} 0
                    "
                    result="coloredInnerBlur"
                />
            ` : `
                <!-- Solid center glow effect -->
                <feGaussianBlur in="SourceAlpha" stdDeviation="${effect.radius / 6}" result="blur"/>
                <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="
                        1 0 0 0 ${parseInt(effect.color.slice(1,3), 16)/255}
                        0 1 0 0 ${parseInt(effect.color.slice(3,5), 16)/255}
                        0 0 1 0 ${parseInt(effect.color.slice(5,7), 16)/255}
                        0 0 0 ${effect.intensity} 0
                    "
                />
            `}
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                ${effect.fade ? `<feMergeNode in="coloredInnerBlur"/>` : ''}
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

    const element = `
        <radialGradient id="${id}" 
            cx="50%" cy="50%" 
            r="50%" 
            fx="50%" fy="50%"
        >
            ${stops}
        </radialGradient>
    `;

    return { id, element };
}