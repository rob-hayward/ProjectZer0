// ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/styles/previewNodeStyles.ts
export interface PreviewNodeStyle {
    size: number;
    padding: number;
    lineHeight: number;
    colors: {
        background: string;
        border: string;
        hoverBorder: string;
        title: string;
        text: string;
        gradient?: {
            start: string;
            end: string;
        };
    };
    font: {
        titleSize: string;
        textSize: string;
        family: string;
    };
}

// Base styles that all nodes share
const baseFont = {
    font: {
        titleSize: '6px',
        textSize: '6px',
        family: '"Orbitron", sans-serif'
    }
} as const;

export const WORD_NODE_STYLE: PreviewNodeStyle = {
    size: 150,
    padding: 15,
    lineHeight: 8,
    colors: {
        background: 'rgba(0, 0, 0, 0.7)',
        border: 'rgba(255, 255, 255, 0.1)',
        hoverBorder: 'rgba(255, 255, 255, 0.3)',
        title: 'rgba(255, 255, 255, 0.9)',
        text: 'rgba(255, 255, 255, 1)',
    },
    font: baseFont.font
} as const;

export const LIVE_DEFINITION_STYLE: PreviewNodeStyle = {
    size: 130,
    padding: 12,
    lineHeight: 8,
    colors: {
        background: 'rgba(0, 0, 0, 0.8)',
        border: 'rgba(74, 144, 226, 0.1)',
        hoverBorder: 'rgba(74, 144, 226, 0.3)',
        title: 'rgba(74, 144, 226, 0.9)',
        text: 'rgba(255, 255, 255, 0.9)',
        gradient: {
            start: 'rgba(74, 144, 226, 0.1)',
            end: 'rgba(74, 144, 226, 0)'
        }
    },
    font: baseFont.font
} as const;

export const ALTERNATIVE_DEFINITION_STYLE: PreviewNodeStyle = {
    size: 130,
    padding: 12,
    lineHeight: 8,
    colors: {
        background: 'rgba(0, 0, 0, 0.8)',
        border: 'rgba(255, 255, 255, 0.1)',
        hoverBorder: 'rgba(255, 255, 255, 0.2)',
        title: 'rgba(255, 255, 255, 0.7)',
        text: 'rgba(255, 255, 255, 0.8)',
        gradient: {
            start: 'rgba(255, 255, 255, 0.05)',
            end: 'rgba(255, 255, 255, 0)'
        }
    },
    font: baseFont.font
} as const;

export type PreviewNodeType = 'word' | 'liveDefinition' | 'alternativeDefinition';

export function getNodeStyle(type: PreviewNodeType): PreviewNodeStyle {
    switch (type) {
        case 'word':
            return WORD_NODE_STYLE;
        case 'liveDefinition':
            return LIVE_DEFINITION_STYLE;
        case 'alternativeDefinition':
            return ALTERNATIVE_DEFINITION_STYLE;
    }
}