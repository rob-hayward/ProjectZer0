// src/lib/services/graph/simulation/layouts/WordDefinitionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { LAYOUTS, DIMENSIONS, SIMULATION } from '../../../../constants/graph';
import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

export class WordDefinitionLayout extends BaseLayoutStrategy {
    private readonly INITIAL_RING_SPACING = 250;
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_ALT_ANGLE = Math.PI;
    private isPreviewMode: boolean = false;

    constructor(width: number, height: number, viewType: ViewType) {
        super(DIMENSIONS.WIDTH, DIMENSIONS.HEIGHT, viewType);
        console.log('[WordDefinitionLayout] Constructed:', {
            width: DIMENSIONS.WIDTH,
            height: DIMENSIONS.HEIGHT,
            viewType
        });
    }

    private getWordNodeRadiusAdjustment(): number {
        const wordNode = this.simulation.nodes().find(n => n.metadata.fixed);
        if (!wordNode) return 0;
        
        const detailRadius = NODE_CONSTANTS.SIZES.WORD.detail / 4;
        const previewRadius = NODE_CONSTANTS.SIZES.WORD.preview / 2;
        const radiusDifference = detailRadius - previewRadius;

        console.log('[WordDefinitionLayout] Word node radius adjustment:', {
            isDetail: wordNode.metadata.isDetail,
            adjustment: wordNode.metadata.isDetail ? 0 : radiusDifference
        });
        
        return wordNode.metadata.isDetail ? 0 : radiusDifference;
    }

    private getDefinitionSizeIncrease(): number {
        const detailSize = NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail;
        const previewSize = NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview;
        return (detailSize - previewSize) / 2;
    }

    private getDefinitionRingIndex(node: LayoutNode): number {
        if (node.type !== 'definition') return -1;
        if (node.subtype === 'live') return 0;
        
        const alternatives = this.simulation.nodes()
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0));
        
        return alternatives.indexOf(node) + 1;
    }

    private getRingSpacingAdjustment(ringIndex: number): number {
        const nodes = this.simulation.nodes();
        console.log('[WordDefinitionLayout] Calculating ring spacing for ring:', ringIndex);
        
        // Get all definitions sorted by ring index
        const definitionNodes = nodes
            .filter(n => n.type === 'definition')
            .map(n => ({
                node: n,
                ringIndex: n.subtype === 'live' ? 0 : this.getDefinitionRingIndex(n)
            }))
            .sort((a, b) => a.ringIndex - b.ringIndex);

        // Calculate size increase once
        const sizeIncrease = this.getDefinitionSizeIncrease();
        let totalAdjustment = 0;

        // Calculate cumulative adjustment for each ring up to current
        for (let targetRing = 0; targetRing <= ringIndex; targetRing++) {
            const expandedNodesInRing = definitionNodes
                .filter(({ node, ringIndex: defRingIndex }) => 
                    defRingIndex === targetRing && node.metadata.isDetail);

            if (expandedNodesInRing.length > 0) {
                totalAdjustment += sizeIncrease;
                console.log('[WordDefinitionLayout] Ring adjustment increment:', {
                    ringIndex: targetRing,
                    expandedNodes: expandedNodesInRing.length,
                    sizeIncrease,
                    currentTotal: totalAdjustment
                });
            }
        }

        console.log('[WordDefinitionLayout] Final ring spacing calculation:', {
            ringIndex,
            totalAdjustment,
            affectedNodes: definitionNodes
                .filter(({ ringIndex: defRingIndex }) => defRingIndex <= ringIndex)
                .map(({ node }) => ({
                    id: node.id,
                    isDetail: node.metadata.isDetail
                }))
        });

        return totalAdjustment;
    }

    private calculateAltDefinitionPosition(index: number): { angle: number, radius: number } {
        let angle;
        if (index === 0) {
            angle = this.FIRST_ALT_ANGLE;
        } else {
            angle = this.FIRST_ALT_ANGLE + (this.GOLDEN_ANGLE * index);
            angle = angle % (2 * Math.PI);
        }

        const ringIndex = index + 1; // Ring index starts at 1 for alternatives
        const baseRadius = this.INITIAL_RING_SPACING * (1.25 + (ringIndex * 0.2));
        const wordAdjustment = this.getWordNodeRadiusAdjustment();
        const ringAdjustment = this.getRingSpacingAdjustment(ringIndex);

        // Calculate final radius with all adjustments
        const radius = baseRadius + ringAdjustment - wordAdjustment;

        console.log('[WordDefinitionLayout] Alternative definition position:', {
            index,
            ringIndex,
            baseRadius,
            wordAdjustment,
            ringAdjustment,
            finalRadius: radius,
            angle: angle * (180 / Math.PI)
        });

        return { angle, radius };
    }

    initializeNodePositions(nodes: LayoutNode[]): void {
        console.log('[WordDefinitionLayout] Initializing node positions:', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });
        
        nodes.forEach(node => {
            node.x = undefined;
            node.y = undefined;
            node.vx = 0;
            node.vy = 0;
        });

        // Initialize navigation nodes
        NavigationNodeLayout.initializeNavigationNodes(nodes, this.getNodeSize.bind(this));

        // Position central word node
        const wordNode = nodes.find(n => n.metadata.fixed);
        if (!wordNode) return;
        wordNode.x = 0;
        wordNode.y = 0;
        wordNode.fx = 0;
        wordNode.fy = 0;

        // Position live definition
        const liveDefinition = nodes.find(n => n.type === 'definition' && n.subtype === 'live');
        if (liveDefinition) {
            const radiusAdjustment = this.getWordNodeRadiusAdjustment();
            const ringAdjustment = this.getRingSpacingAdjustment(0);
            const selfAdjustment = liveDefinition.metadata.isDetail ? 
                (NODE_CONSTANTS.SIZES.DEFINITION.live.detail - 
                 NODE_CONSTANTS.SIZES.DEFINITION.live.preview) / 2 : 0;
            
            const posX = this.INITIAL_RING_SPACING * 1.1 + ringAdjustment - radiusAdjustment + selfAdjustment;
            
            console.log('[WordDefinitionLayout] Live definition position:', {
                id: liveDefinition.id,
                radiusAdjustment,
                ringAdjustment,
                selfAdjustment,
                finalPosition: posX,
                isDetail: liveDefinition.metadata.isDetail
            });
            
            liveDefinition.x = posX;
            liveDefinition.y = 0;
            liveDefinition.fx = posX;
            liveDefinition.fy = 0;
        }

        // Position alternative definitions
        const alternatives = nodes
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0));

        alternatives.forEach((node, index) => {
            const { angle, radius } = this.calculateAltDefinitionPosition(index);
            const selfExpansion = node.metadata.isDetail ? 
                (NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail - 
                 NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview) / 2 : 0;
            
            const finalRadius = radius + selfExpansion;
            
            console.log('[WordDefinitionLayout] Alternative definition position:', {
                id: node.id,
                index,
                baseRadius: radius,
                selfExpansion,
                finalRadius,
                angle: angle * (180 / Math.PI),
                isDetail: node.metadata.isDetail
            });
            
            node.x = Math.cos(angle) * finalRadius;
            node.y = Math.sin(angle) * finalRadius;
            node.fx = node.x;
            node.fy = node.y;
        });
    }

    configureForces(): void {
        console.log('[WordDefinitionLayout] Configuring forces');

        // Configure navigation node forces
        NavigationNodeLayout.configureNavigationForces(this.simulation, this.getNodeSize.bind(this));

        // Configure collision detection
        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type === 'navigation') return 0;
                const size = this.getNodeSize(node);
                const padding = SIMULATION.FORCES.COLLISION.PADDING[
                    node.type === 'definition' ? 'DEFINITION' : 'BASE'
                ];
                return (size / 2) + padding;
            })
            .strength(SIMULATION.FORCES.COLLISION.STRENGTH)
            .iterations(SIMULATION.FORCES.COLLISION.ITERATIONS);

        // Configure simulation forces
        this.simulation
            .force('collision', collision)
            .force('charge', d3.forceManyBody().strength(-300))
            .restart();
    }

    public updateData(nodes: LayoutNode[], links: LayoutLink[], skipAnimation: boolean = false): void {
        console.log('[WordDefinitionLayout] Update data called:', {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation,
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                subtype: n.subtype,
                isDetail: n.metadata.isDetail
            }))
        });

        this.simulation.stop();
        this.initializeNodePositions(nodes);
        this.simulation.nodes(nodes);
        this.configureForces();
        
        if (skipAnimation) {
            this.simulation.alpha(0);
        } else {
            this.simulation.alpha(1);
        }
        
        this.simulation.restart();
    }

    public updatePreviewMode(isPreview: boolean): void {
        console.log('[WordDefinitionLayout] Update preview mode:', { isPreview });
        if (this.isPreviewMode !== isPreview) {
            this.isPreviewMode = isPreview;
            const currentNodes = this.simulation.nodes();
            this.updateData(currentNodes, [], false);
        }
    }

    private getNodeSize(node: LayoutNode): number {
        if (node.type === 'word' || node.type === 'central') {
            return node.metadata.isDetail ? 
                NODE_CONSTANTS.SIZES.WORD.detail :
                NODE_CONSTANTS.SIZES.WORD.preview;
        } 
        
        if (node.type === 'definition') {
            if (node.subtype === 'live') {
                return node.metadata.isDetail ?
                    NODE_CONSTANTS.SIZES.DEFINITION.live.detail :
                    NODE_CONSTANTS.SIZES.DEFINITION.live.preview;
            } else {
                return node.metadata.isDetail ?
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail :
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview;
            }
        }
        
        return NODE_CONSTANTS.SIZES.NAVIGATION.size;
    }
}