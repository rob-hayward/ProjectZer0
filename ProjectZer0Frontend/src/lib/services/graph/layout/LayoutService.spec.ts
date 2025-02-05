import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayoutService } from './LayoutService';
import { ForceSimulation } from '../simulation/ForceSimulation';
import type { GraphNode, GraphData } from '../../../types/graph/core';
import type { WordNode, Definition } from '../../../types/nodes';
import type { NavigationOption } from '../../../types/navigation';
import type { UserProfile } from '../../../types/user';

// Mock ForceSimulation
const mockSimulationInstance = {
    updateData: vi.fn(),
    updateDimensions: vi.fn(),
    stop: vi.fn(),
    resetForces: vi.fn(),
    getSimulation: vi.fn().mockReturnValue({
        nodes: () => [
            { id: 'test1', x: 100, y: 100 },
            { id: 'test2', x: 200, y: 200 }
        ]
    })
};

vi.mock('../simulation/ForceSimulation', () => ({
    ForceSimulation: vi.fn().mockImplementation(() => mockSimulationInstance)
}));

// Create properly typed mock data
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

const mockDefinition: Definition = {
    id: 'def1',
    text: 'test definition',
    createdBy: 'test-user',
    createdAt: '2024-01-01',
    positiveVotes: 5,
    negativeVotes: 2
};

describe('LayoutService', () => {
    let service: LayoutService;
    const mockConfig = {
        width: 1000,
        height: 800,
        viewType: 'word' as const,
        isPreviewMode: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LayoutService(mockConfig);
    });

    describe('initialization', () => {
        it('should initialize with correct config', () => {
            expect(service['_width']).toBe(mockConfig.width);
            expect(service['_height']).toBe(mockConfig.height);
            expect(service['_viewType']).toBe(mockConfig.viewType);
            expect(service['state'].isPreviewMode).toBe(mockConfig.isPreviewMode);
            expect(ForceSimulation).toHaveBeenCalledWith(
                mockConfig.width,
                mockConfig.height,
                mockConfig.viewType
            );
        });
    });

    describe('data transformation', () => {
        const mockGraphData: GraphData = {
            nodes: [
                {
                    id: 'word1',
                    type: 'word',
                    data: mockWord,
                    group: 'central'
                },
                {
                    id: 'nav1',
                    type: 'navigation',
                    data: mockNavOption,
                    group: 'navigation'
                }
            ],
            links: []
        };

        it('should correctly transform nodes to layout format', () => {
            const transformedData = service['transformToLayoutFormat'](mockGraphData);
            expect(transformedData.nodes).toHaveLength(mockGraphData.nodes.length);
            expect(transformedData.nodes[0].metadata.fixed).toBe(true);
            expect(transformedData.nodes[1].type).toBe('navigation');
        });

        it('should handle definition nodes correctly', () => {
            const graphDataWithDef: GraphData = {
                nodes: [{
                    id: 'def1',
                    type: 'definition',
                    data: mockDefinition,
                    group: 'live-definition'
                }],
                links: []
            };

            const transformed = service['transformToLayoutFormat'](graphDataWithDef);
            const defNode = transformed.nodes[0];
            expect(defNode.type).toBe('definition');
            expect(defNode.subtype).toBe('live');
            expect(defNode.metadata.votes).toBe(3); // 5 - 2
        });
    });

    describe('layout updates', () => {
        it('should return cached positions if data hasn\'t changed', () => {
            const mockData = {
                nodes: [{
                    id: 'test1',
                    type: 'word' as const,
                    data: mockWord,
                    group: 'central' as const
                }],
                links: []
            };

            service.updateLayout(mockData.nodes, mockData.links);
            const firstPositions = service['getCurrentPositions']();

            service.updateLayout(mockData.nodes, mockData.links);
            const secondPositions = service['getCurrentPositions']();

            expect(mockSimulationInstance.updateData).toHaveBeenCalledTimes(1);
            expect(secondPositions).toEqual(firstPositions);
        });

        it('should update positions when data changes', () => {
            const firstData = {
                nodes: [{
                    id: 'test1',
                    type: 'word' as const,
                    data: mockWord,
                    group: 'central' as const
                }],
                links: []
            };

            const secondData = {
                nodes: [
                    firstData.nodes[0],
                    {
                        id: 'nav1',
                        type: 'navigation' as const,
                        data: mockNavOption,
                        group: 'navigation' as const
                    }
                ],
                links: []
            };

            service.updateLayout(firstData.nodes, firstData.links);
            service.updateLayout(secondData.nodes, secondData.links);

            expect(mockSimulationInstance.updateData).toHaveBeenCalledTimes(2);
        });
    });

    describe('state management', () => {
        it('should handle preview mode changes', () => {
            service.updatePreviewMode(true);
            expect(service['state'].isPreviewMode).toBe(true);
            expect(mockSimulationInstance.resetForces).toHaveBeenCalled();
        });

        it('should handle definition mode changes', () => {
            const modes = new Map([['node1', 'detail' as const]]);
            service.updateDefinitionModes(modes);
            expect(service['state'].definitionModes.get('node1')).toBe('detail');
            expect(mockSimulationInstance.resetForces).toHaveBeenCalled();
        });
    });
});