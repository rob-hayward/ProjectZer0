// src/lib/services/graph/simulation/GraphLayoutEngine.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { GraphLayoutEngine } from './GraphLayoutEngine';
import { LayoutService } from '../../../services/graph/layout/LayoutService';
import type { GraphData, NodeGroup } from '../../../types/graph/core';
import type { WordNode } from '../../../types/nodes';

// Mock the LayoutService
vi.mock('../../../services/graph/layout/LayoutService');

describe('GraphLayoutEngine', () => {
    let mockLayoutService: any;
    
    const mockWordData: WordNode = {
        id: 'word1',
        word: 'test',
        createdBy: 'test-user',
        publicCredit: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        positiveVotes: 0,
        negativeVotes: 0,
        definitions: []
    };

    const mockGraphData: GraphData = {
        nodes: [
            {
                id: 'word1',
                type: 'word',
                data: mockWordData,
                group: 'central' as NodeGroup
            }
        ],
        links: []
    };

    beforeEach(() => {
        // Create a fresh mock object for each test
        mockLayoutService = {
            width: 800,
            height: 600,
            updateLayout: vi.fn().mockReturnValue(new Map()),
            updatePreviewMode: vi.fn(),
            updateDefinitionModes: vi.fn(),
            resize: vi.fn(),
            stop: vi.fn()
        };

        // Make the LayoutService constructor return our mock
        (LayoutService as unknown as Mock).mockImplementation(() => mockLayoutService);
    });

    it('should instantiate LayoutService with correct config', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', true);
        expect(LayoutService).toHaveBeenCalledWith({
            width: 1000,
            height: 800,
            viewType: 'word',
            isPreviewMode: true
        });

        // Verify getter methods
        expect(engine.width).toBe(800);
        expect(engine.height).toBe(600);
    });

    it('should delegate updateLayout() to layoutService', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        
        engine.updateLayout(mockGraphData);
        
        expect(mockLayoutService.updateLayout).toHaveBeenCalledWith(
            mockGraphData.nodes,
            mockGraphData.links
        );
    });

    it('should delegate updatePreviewMode()', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        engine.updatePreviewMode(true);

        expect(mockLayoutService.updatePreviewMode).toHaveBeenCalledWith(true);
    });

    it('should delegate updateDefinitionModes()', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        const modes = new Map<string, 'preview' | 'detail'>([['node1', 'detail']]);
        
        engine.updateDefinitionModes(modes);
        expect(mockLayoutService.updateDefinitionModes).toHaveBeenCalledWith(modes);
        
        // Verify internal state update
        expect(engine['definitionNodeModes']).toEqual(modes);
    });

    it('should delegate resize()', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        engine.resize(1280, 720);
        
        expect(mockLayoutService.resize).toHaveBeenCalledWith(1280, 720);
    });

    it('should call stop() on underlying service', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        engine.stop();
        
        expect(mockLayoutService.stop).toHaveBeenCalled();
    });

    it('should return the layoutService from getSimulation()', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        const sim = engine.getSimulation();
        expect(sim).toBe(mockLayoutService);
    });

    it('should handle empty data gracefully', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        const emptyData: GraphData = { nodes: [], links: [] };
        
        const result = engine.updateLayout(emptyData);
        expect(result).toBeInstanceOf(Map);
        expect(mockLayoutService.updateLayout).toHaveBeenCalledWith([], []);
    });

    it('should maintain definition modes across updates', () => {
        const engine = new GraphLayoutEngine(1000, 800, 'word', false);
        const modes = new Map<string, 'preview' | 'detail'>([['node1', 'detail']]);
        
        engine.updateDefinitionModes(modes);
        engine.updateLayout(mockGraphData);
        
        // Verify modes are maintained after layout updates
        expect(engine['definitionNodeModes']).toEqual(modes);
    });
});