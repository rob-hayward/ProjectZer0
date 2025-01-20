import { describe, it, expect, beforeEach } from 'vitest';
import { GraphLayout } from './GraphLayout';
import type { GraphData, GraphNode, GraphEdge } from '$lib/types/graph';
import type { WordNode, Definition } from '$lib/types/nodes';

describe('GraphLayout', () => {
    let layout: GraphLayout;
    const defaultWidth = 1000;
    const defaultHeight = 800;

    // Helper function to create test nodes
    function createTestNodes(): GraphNode[] {
        const now = new Date().toISOString();
        const wordData: WordNode = {
            id: 'word-1',
            word: 'test',
            createdBy: 'test-user',
            publicCredit: true,
            createdAt: now,
            updatedAt: now,
            positiveVotes: 0,
            negativeVotes: 0,
            definitions: []
        };
    
        const baseDefinition: Definition = {
            id: 'def-base',
            text: 'test definition',
            createdBy: 'test-user',
            createdAt: now,
            positiveVotes: 0,
            negativeVotes: 0
        };
    
        return [
            {
                id: 'word-1',
                group: 'central',
                type: 'word',
                data: wordData
            },
            {
                id: 'def-1',
                group: 'live-definition',
                type: 'definition',
                data: { ...baseDefinition, id: 'def-1', isLive: true }
            },
            {
                id: 'def-2',
                group: 'alternative-definition',
                type: 'definition',
                data: { ...baseDefinition, id: 'def-2' }
            },
            {
                id: 'def-3',
                group: 'alternative-definition',
                type: 'definition',
                data: { ...baseDefinition, id: 'def-3' }
            }
        ];
    }

    function createTestLinks(): GraphEdge[] {
        return [
            {
                source: 'word-1',
                target: 'def-1',
                type: 'live',
                value: 1
            },
            {
                source: 'word-1',
                target: 'def-2',
                type: 'alternative',
                value: 1
            },
            {
                source: 'word-1',
                target: 'def-3',
                type: 'alternative',
                value: 1
            }
        ];
    }

    beforeEach(() => {
        layout = new GraphLayout(defaultWidth, defaultHeight, 'word');
    });

    describe('Basic Initialization', () => {
        it('should create a layout instance with correct dimensions', () => {
            expect(layout).toBeDefined();
            expect(layout.width).toBe(defaultWidth);
            expect(layout.height).toBe(defaultHeight);
        });

        it('should initialize with default preview mode', () => {
            const newLayout = new GraphLayout(defaultWidth, defaultHeight, 'word', false);
            const data = {
                nodes: createTestNodes(),
                links: createTestLinks()
            };
            const positions = newLayout.updateLayout(data);
            expect(positions.size).toBe(4); // word + 3 definitions
        });
    });

    describe('Node Positioning', () => {
        describe('Central Word Node', () => {
            it('should position word node at the center', () => {
                const data: GraphData = {
                    nodes: [createTestNodes()[0]], // Only word node
                    links: []
                };

                const positions = layout.updateLayout(data);
                const wordPosition = positions.get('word-1');

                expect(wordPosition).toBeDefined();
                expect(wordPosition?.x).toBe(0);
                expect(wordPosition?.y).toBe(0);
            });
        });

        describe('Definition Node Positioning', () => {
            it('should position nodes with higher vote counts closer to center', () => {
                const nodes = createTestNodes();
                
                // Set up different vote counts
                (nodes[1].data as Definition).positiveVotes = 10; // Live def
                (nodes[2].data as Definition).positiveVotes = 5;  // Alt def 1
                (nodes[3].data as Definition).positiveVotes = 2;  // Alt def 2

                const data: GraphData = {
                    nodes,
                    links: createTestLinks()
                };

                const positions = layout.updateLayout(data);
                const distances = nodes.slice(1).map(node => {
                    const pos = positions.get(node.id);
                    const centerPos = positions.get('word-1');
                    if (!pos || !centerPos) return Infinity;
                    
                    return Math.sqrt(
                        Math.pow(pos.x - centerPos.x, 2) + 
                        Math.pow(pos.y - centerPos.y, 2)
                    );
                });

                // Check that distances increase as votes decrease
                expect(distances[0]).toBeLessThan(distances[1]);
                expect(distances[1]).toBeLessThan(distances[2]);
            });

            it('should maintain minimum distance between nodes', () => {
                const data: GraphData = {
                    nodes: createTestNodes(),
                    links: createTestLinks()
                };

                const positions = layout.updateLayout(data);

                // Check distances between definitions
                const nodes = Array.from(positions.entries())
                    .filter(([id]) => id !== 'word-1'); // Exclude central node

                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const [, pos1] = nodes[i];
                        const [, pos2] = nodes[j];
                        const distance = Math.sqrt(
                            Math.pow(pos2.x - pos1.x, 2) + 
                            Math.pow(pos2.y - pos1.y, 2)
                        );
                        expect(distance).toBeGreaterThan(150); // Minimum spacing requirement
                    }
                }
            });
        });
    });

    describe('Mode Transitions', () => {
        it('should update node positions when switching to preview mode', () => {
            const data: GraphData = {
                nodes: createTestNodes(),
                links: createTestLinks()
            };

            // Get initial positions
            const normalPositions = layout.updateLayout(data);
            
            // Switch to preview mode
            layout.updatePreviewMode(true);
            const previewPositions = layout.updateLayout(data);

            // Verify positions have changed appropriately
            for (const [id, pos] of normalPositions) {
                const previewPos = previewPositions.get(id);
                if (id !== 'word-1') { // Exclude central node
                    expect(previewPos?.scale).toBeLessThan(pos.scale);
                }
            }
        });

        it('should handle individual node detail mode transitions', () => {
            const data: GraphData = {
                nodes: createTestNodes(),
                links: createTestLinks()
            };

            const initialPositions = layout.updateLayout(data);

            // Transition one node to detail mode
            const definitionModes = new Map([['def-1', 'detail' as const]]);
            layout.updateDefinitionModes(definitionModes);
            
            const updatedPositions = layout.updateLayout(data);

            // Check that detail mode node has proper scale
            const def1Pos = updatedPositions.get('def-1');
            expect(def1Pos).toBeDefined();
            if (def1Pos) {
                expect(def1Pos.scale).toBeGreaterThan(1);
            }
        });
    });

    describe('Resize Handling', () => {
        it('should update dimensions on resize', () => {
            const newWidth = 800;
            const newHeight = 600;
            layout.resize(newWidth, newHeight);
            expect(layout.width).toBe(newWidth);
            expect(layout.height).toBe(newHeight);
        });
    });
});