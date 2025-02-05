// src/lib/components/graph/layouts/GraphLayout.spec.ts

// Create a proper mock instance type
type MockLayoutInstance = {
    updateLayout: ReturnType<typeof vi.fn>;
    updatePreviewMode: ReturnType<typeof vi.fn>;
    updateDefinitionModes: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    width: number;
    height: number;
};

// Store mock factory for reuse
const createMockInstance = (): MockLayoutInstance => ({
    updateLayout: vi.fn().mockReturnValue(new Map([
        ['word1', { x: 100, y: 100, svgTransform: 'translate(100,100)', scale: 1 }],
        ['nav1', { x: 200, y: 200, svgTransform: 'translate(200,200)', scale: 1 }]
    ])),
    updatePreviewMode: vi.fn(),
    updateDefinitionModes: vi.fn(),
    resize: vi.fn(),
    stop: vi.fn(),
    width: 1000,
    height: 800
});

// Set up mocks before any imports
vi.mock('./GraphLayoutEngine', () => ({
    GraphLayoutEngine: class MockGraphLayoutEngine {
        constructor(width: number, height: number, viewType: string, isPreviewMode: boolean) {
            return createMockInstance();
        }
    }
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import GraphLayout from './GraphLayout.svelte';
import type { GraphData, NodeType } from '../../../types/graph/core';
import type { WordNode, NodeMode } from '../../../types/nodes';
import type { NavigationOption } from '../../../types/navigation';
import type { ComponentProps } from 'svelte';

const mockWord: WordNode = {
    id: 'word1',
    word: 'test',
    createdBy: 'test-user',
    publicCredit: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    positiveVotes: 0,
    negativeVotes: 0,
    definitions: []
};

const mockNavOption: NavigationOption = {
    id: 'nav1',
    label: 'Test Nav',
    icon: 'test-icon'
};

type GraphLayoutProps = ComponentProps<GraphLayout>;

describe('GraphLayout.svelte', () => {
    let mockInstance: MockLayoutInstance;
    let mockData: GraphData;
    let defaultProps: GraphLayoutProps;

    beforeEach(() => {
        console.log('\n--- Test Starting ---');
        vi.useFakeTimers();
        vi.clearAllMocks();
        
        mockData = {
            nodes: [
                { id: 'word1', type: 'word' as NodeType, data: mockWord, group: 'central' },
                { id: 'nav1', type: 'navigation' as NodeType, data: mockNavOption, group: 'navigation' }
            ],
            links: []
        };

        defaultProps = {
            data: mockData,
            width: 1000,
            height: 800,
            viewType: 'word',
            isPreviewMode: false
        };
    });

    afterEach(() => {
        console.log('--- Test Cleanup ---');
        cleanup();
        vi.useRealTimers();
    });

    async function renderAndWait(props = defaultProps) {
        console.log('Starting render with props:', JSON.stringify(props, null, 2));
        
        const result = render(GraphLayout, {
            props,
        });

        // Ensure layoutReady and mount happen first
        await tick();
        await vi.runAllTimersAsync();
        await tick();

        // Add test content to the slots
        const nodes = result.container.querySelector('.nodes');
        if (nodes) {
            props.data.nodes.forEach(node => {
                const g = document.createElement('g');
                g.setAttribute('class', 'mock-node-content');
                g.setAttribute('data-node-id', node.id);
                const circle = document.createElement('circle');
                circle.setAttribute('r', '5');
                g.appendChild(circle);
                nodes.appendChild(g);
            });
        }

        console.log('Initial render complete');
        
        // Wait for onMount and initialization
        await tick();
        console.log('First tick (mount) complete');
        
        // Wait for layout engine creation and initial update
        await vi.runAllTimersAsync();
        await tick();
        console.log('Layout initialization complete');
        
        // Wait for reactivity and updates to settle
        for (let i = 0; i < 3; i++) {
            await vi.advanceTimersByTimeAsync(10);
            await tick();
        }
        console.log('Layout stabilization complete');
        
        return result;
    }

    it('should render base structure', async () => {
        const { container } = await renderAndWait();
        expect(container.querySelector('.graph-layout')).toBeTruthy();
    });

    it('should render nodes with correct transforms', async () => {
        const { container } = await renderAndWait();
        
        const nodeElements = container.querySelectorAll('.node');
        expect(nodeElements.length).toBe(mockData.nodes.length);
        
        expect(nodeElements[0].getAttribute('transform')).toBe('translate(100,100)');
        expect(nodeElements[1].getAttribute('transform')).toBe('translate(200,200)');
    });

    it('should handle preview mode changes', async () => {
        const { component } = await renderAndWait();

        // Get the instance from updateLayout mock result
        const updateLayout = vi.spyOn(createMockInstance(), 'updateLayout');
        const updatePreviewMode = vi.spyOn(createMockInstance(), 'updatePreviewMode');
        
        await component.$set({ isPreviewMode: true });
        await tick();
        await vi.runAllTimersAsync();

        expect(updatePreviewMode).toHaveBeenCalledWith(true);
        expect(updateLayout).toHaveBeenCalled();
    });

    it('should handle data changes', async () => {
        const { component } = await renderAndWait();
        const updateLayout = vi.spyOn(createMockInstance(), 'updateLayout');

        const newData: GraphData = {
            nodes: [
                ...mockData.nodes,
                {
                    id: 'nav2',
                    type: 'navigation',
                    data: { id: 'nav2', label: 'New Nav', icon: 'test' },
                    group: 'navigation'
                }
            ],
            links: []
        };

        await component.$set({ data: newData });
        await tick();
        await vi.runAllTimersAsync();

        expect(updateLayout).toHaveBeenCalledWith(newData);
    });

    it('should handle mode changes', async () => {
        const { container } = await renderAndWait();
        
        const firstNode = container.querySelector('.node');
        expect(firstNode).toBeTruthy();

        const updateDefinitionModes = vi.spyOn(createMockInstance(), 'updateDefinitionModes');
        const updateLayout = vi.spyOn(createMockInstance(), 'updateLayout');

        const modeChangeEvent = new CustomEvent('modechange', {
            detail: { nodeId: 'word1', mode: 'detail' as NodeMode },
            bubbles: true
        });

        firstNode!.dispatchEvent(modeChangeEvent);
        await tick();
        await vi.runAllTimersAsync();

        expect(updateDefinitionModes).toHaveBeenCalled();
        expect(updateLayout).toHaveBeenCalled();
    });

    it('should cleanup on unmount', async () => {
        const { unmount } = await renderAndWait();
        const stop = vi.spyOn(createMockInstance(), 'stop');

        unmount();
        await vi.runAllTimersAsync();

        expect(stop).toHaveBeenCalled();
    });
});