// ProjectZer0Frontend/src/lib/components/graph/layouts/__mocks__/GraphLayoutEngine.ts
import { vi } from 'vitest';
import type { GraphData } from '../../../../types/graph/core';

// Create mock position Map that will be returned by updateLayout
const mockPositions = new Map([
    ['word1', { x: 100, y: 100, svgTransform: 'translate(100,100)', scale: 1 }],
    ['nav1', { x: 200, y: 200, svgTransform: 'translate(200,200)', scale: 1 }]
]);

// Create the mock layout engine instance
export const mockLayoutEngine = {
    updateLayout: vi.fn().mockImplementation((data: GraphData) => {
        console.log('mockLayoutEngine.updateLayout called with:', {
            nodeCount: data.nodes.length,
            links: data.links?.length || 0
        });
        return mockPositions;
    }),
    updatePreviewMode: vi.fn().mockImplementation((isPreview: boolean) => {
        console.log('mockLayoutEngine.updatePreviewMode called with:', isPreview);
    }),
    updateDefinitionModes: vi.fn().mockImplementation((modes: Map<string, 'preview' | 'detail'>) => {
        console.log('mockLayoutEngine.updateDefinitionModes called with:', Object.fromEntries(modes));
    }),
    resize: vi.fn().mockImplementation((width: number, height: number) => {
        console.log('mockLayoutEngine.resize called with:', { width, height });
    }),
    stop: vi.fn().mockImplementation(() => {
        console.log('mockLayoutEngine.stop called');
    }),
    width: 1000,
    height: 800
};

// Create the mock constructor
export const GraphLayoutEngine = vi.fn().mockImplementation((width: number, height: number, viewType: string, isPreviewMode: boolean) => {
    console.log('Creating GraphLayoutEngine instance:', { width, height, viewType, isPreviewMode });
    return mockLayoutEngine;
});