// src/lib/services/graph/layouts/OpenQuestionAnswerLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../constants/graph';

/**
 * Layout strategy for open question and statement nodes (as answers)
 * 
 * Features:
 * - Central question node fixed at the center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Most popular statement positioned to the right of the question node
 * - Alternative statements positioned using golden angle distribution
 * - Vote-weighted positioning for statement nodes
 * - Smooth transitions between preview and detail modes
 * - Support for hidden nodes with smaller size and adjusted positioning
 * - All statements use standard statement node styling
 */
export class OpenQuestionAnswerLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_ALT_ANGLE = Math.PI;
    private statementAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    // Track expanded statements and their ring indices
    private expandedStatements: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    // Track hidden statements and their ring indices
    private hiddenNodes: Map<string, { ringIndex: number, adjustment: number }> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug('[OpenQuestionAnswerLayout] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    /**
     * Clear ALL forces from the simulation
     */
    private clearAllForces(): void {
        console.debug('[OpenQuestionAnswerLayout] Clearing all forces');
        
        const sim = this.simulation as any;
        
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision',
            'positioning', 'custom'
        ];
        
        potentialForceNames.forEach(name => {
            try {
                sim.force(name, null);
            } catch (e) {
                // Ignore errors
            }
        });
        
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            console.warn('[OpenQuestionAnswerLayout] Some forces still remain:', remainingForces);
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[OpenQuestionAnswerLayout] Cannot remove force: ${name}`);
                }
            });
        }
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug('[OpenQuestionAnswerLayout] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });

        this.simulation.stop();
        this.clearAllForces();
        this.updateExpansionState(nodes);
        this.updateHiddenState(nodes);

        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;

            if (!node.fixed && node.group !== 'central') {
                node.fx = undefined;
                node.fy = undefined;
            }
        });

        NavigationNodeLayout.positionNavigationNodes(
            nodes, 
            this.getNodeRadius.bind(this)
        );

        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (!centralNode) {
            console.warn('[OpenQuestionAnswerLayout] No central node found');
            return;
        }

        centralNode.fx = 0;
        centralNode.fy = 0;
        centralNode.x = 0;
        centralNode.y = 0;
        centralNode.vx = 0;
        centralNode.vy = 0;
        centralNode.fixed = true;
        
        if (centralNode.metadata) {
            centralNode.metadata.fixed = true;
        }

        console.debug('[OpenQuestionAnswerLayout] Central node positioned at center with fixed constraints', {
            id: centralNode.id,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy },
            velocity: { vx: centralNode.vx, vy: centralNode.vy }
        });

        const mostPopularStatement = nodes.find(n => n.type === 'statement' && n.group === 'live-definition');
        if (mostPopularStatement) {
            this.positionMostPopularStatement(mostPopularStatement);
        }

        const alternatives = nodes
            .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
            .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));

        this.positionAlternativeStatements(alternatives);
        this.enforceFixedPositions();
    }

    /**
     * Configure forces for this layout
     */
    configureForces(): void {
        console.debug('[OpenQuestionAnswerLayout] Configuring forces');

        this.clearAllForces();
        NavigationNodeLayout.configureNoForces(this.simulation);

        this.simulation.on('tick.fixedPosition', () => {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            
            const centralNode = nodes.find(n => n.fixed || n.group === 'central');
            if (centralNode) {
                centralNode.x = 0;
                centralNode.y = 0;
                centralNode.fx = 0;
                centralNode.fy = 0;
                centralNode.vx = 0;
                centralNode.vy = 0;
            }
            
            nodes.forEach(node => {
                if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
        });
        
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Ensure positions are fixed
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            centralNode.fixed = true;
            
            if (typeof centralNode.index === 'number') {
                centralNode.index = 0;
            }
            
            console.debug('[OpenQuestionAnswerLayout] Enforced central node position at (0,0)');
        }
        
        NavigationNodeLayout.enforceFixedPositions(nodes);
        this.simulation.alpha(0).alphaTarget(0);
    }

    /**
     * Handle node mode changes
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug('[OpenQuestionAnswerLayout] Node state change', {
            nodeId,
            mode
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[OpenQuestionAnswerLayout] Node not found for state change:', nodeId);
            return;
        }

        const oldMode = node.mode;
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[OpenQuestionAnswerLayout] Node mode updated', {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius
        });

        this.expansionState.set(nodeId, mode === 'detail');

        if (node.type === 'statement') {
            let ringIndex = 0;
            if (node.group === 'live-definition') {
                ringIndex = 0;
            } else {
                const alternatives = nodes
                    .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
                    .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                    
                const altIndex = alternatives.findIndex(d => d.id === nodeId);
                ringIndex = altIndex + 1;
            }
            
            const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                              COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                              COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                
            if (mode === 'detail') {
                this.expandedStatements.set(nodeId, { ringIndex, adjustment });
                console.debug('[OpenQuestionAnswerLayout] Added expanded statement:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.expandedStatements.delete(nodeId);
                console.debug('[OpenQuestionAnswerLayout] Removed expanded statement:', {
                    nodeId
                });
            }
        }

        if (node.type === 'openquestion') {
            console.debug('[OpenQuestionAnswerLayout] Question node mode changed, repositioning all nodes');
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            this.repositionStatements(nodes);
        }
        
        if (node.type === 'statement') {
            console.debug('[OpenQuestionAnswerLayout] Statement node mode changed, repositioning all statements');
            this.repositionStatements(nodes);
        }
        
        this.simulation.stop();
        this.enforceFixedPositions();
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        console.debug('[OpenQuestionAnswerLayout] Node visibility change', {
            nodeId,
            isHidden
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[OpenQuestionAnswerLayout] Node not found for visibility change:', nodeId);
            return;
        }

        const oldHiddenState = node.isHidden;
        node.isHidden = isHidden;
        
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[OpenQuestionAnswerLayout] Node visibility updated', {
            nodeId,
            oldHiddenState,
            newHiddenState: isHidden,
            oldRadius,
            newRadius: node.radius
        });

        if (node.type === 'statement') {
            let ringIndex = 0;
            if (node.group === 'live-definition') {
                ringIndex = 0;
            } else {
                const alternatives = nodes
                    .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
                    .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                    
                const altIndex = alternatives.findIndex(d => d.id === nodeId);
                ringIndex = altIndex + 1;
            }
            
            const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                               COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                
            if (isHidden) {
                this.hiddenNodes.set(nodeId, { ringIndex, adjustment });
                console.debug('[OpenQuestionAnswerLayout] Added hidden statement:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.hiddenNodes.delete(nodeId);
                console.debug('[OpenQuestionAnswerLayout] Removed hidden statement:', {
                    nodeId
                });
            }
        }

        if (node.type === 'openquestion') {
            console.debug('[OpenQuestionAnswerLayout] Question node visibility changed, repositioning all nodes');
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            this.repositionStatements(nodes);
        }
        
        if (node.type === 'statement') {
            console.debug('[OpenQuestionAnswerLayout] Statement node visibility changed, repositioning all statements');
            this.repositionStatements(nodes);
        }
        
        this.simulation.stop();
        this.enforceFixedPositions();
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Track expansion state changes
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.type === 'statement' || node.type === 'openquestion') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                if (wasExpanded !== isExpanded) {
                    console.debug('[OpenQuestionAnswerLayout] Node expansion state changed:', {
                        nodeId: node.id,
                        from: wasExpanded,
                        to: isExpanded
                    });
                }
                
                this.expansionState.set(node.id, isExpanded);
                
                if (node.type === 'statement') {
                    if (isExpanded) {
                        let ringIndex = 0;
                        if (node.group === 'live-definition') {
                            ringIndex = 0;
                        } else {
                            const alternatives = nodes
                                .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
                                .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                                
                            const altIndex = alternatives.findIndex(d => d.id === node.id);
                            ringIndex = altIndex + 1;
                        }
                        
                        const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                          COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                          COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                          
                        this.expandedStatements.set(node.id, { ringIndex, adjustment });
                    } else {
                        this.expandedStatements.delete(node.id);
                    }
                }
            }
        });
    }

    /**
     * Track hidden node state changes
     */
    private updateHiddenState(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.type === 'statement' || node.type === 'openquestion') {
                const wasHidden = this.hiddenNodes.has(node.id);
                const isHidden = node.isHidden || false;
                
                if (wasHidden !== isHidden) {
                    console.debug('[OpenQuestionAnswerLayout] Node hidden state changed:', {
                        nodeId: node.id,
                        from: wasHidden,
                        to: isHidden
                    });
                }
                
                if (node.type === 'statement') {
                    if (isHidden) {
                        let ringIndex = 0;
                        if (node.group === 'live-definition') {
                            ringIndex = 0;
                        } else {
                            const alternatives = nodes
                                .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
                                .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                                
                            const altIndex = alternatives.findIndex(d => d.id === node.id);
                            ringIndex = altIndex + 1;
                        }
                        
                        const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                          COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                          
                        this.hiddenNodes.set(node.id, { ringIndex, adjustment });
                        
                        console.debug('[OpenQuestionAnswerLayout] Added hidden node tracking:', {
                            nodeId: node.id,
                            ringIndex,
                            adjustment
                        });
                    } else {
                        if (this.hiddenNodes.has(node.id)) {
                            this.hiddenNodes.delete(node.id);
                            console.debug('[OpenQuestionAnswerLayout] Removed hidden node tracking:', {
                                nodeId: node.id
                            });
                        }
                    }
                }
            }
        });
    }

    /**
     * Position the most popular statement to the right of the question node
     */
    private positionMostPopularStatement(node: EnhancedNode): void {
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        const questionNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        const questionAdjustment = questionNode?.mode === 'preview' ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL - COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW) / 2 :
            0;
            
        const questionHiddenAdjustment = questionNode?.isHidden ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
            
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 :
            0;
            
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        const posX = baseRadius + expansionAdjustment - questionAdjustment - questionHiddenAdjustment + hiddenAdjustment;

        console.debug('[OpenQuestionAnswerLayout] Most popular statement positioned:', {
            id: node.id,
            baseRadius,
            expansionAdjustment,
            questionAdjustment,
            questionHiddenAdjustment,
            hiddenAdjustment,
            finalPosition: posX,
            isDetail: node.mode === 'detail',
            isHidden: node.isHidden
        });

        node.x = posX;
        node.y = 0;

        this.statementAngles.set(node.id, 0);
    }

    /**
     * Position all alternative statements
     */
    private positionAlternativeStatements(alternatives: EnhancedNode[]): void {
        alternatives.forEach((node, index) => {
            const { angle, radius } = this.calculateAltStatementPosition(node, index);

            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            console.debug('[OpenQuestionAnswerLayout] Alternative statement positioned:', {
                id: node.id,
                index,
                angle: angle * (180 / Math.PI),
                radius,
                position: { x: node.x, y: node.y },
                isDetail: node.mode === 'detail',
                isHidden: node.isHidden
            });
        });
    }

    /**
     * Calculate position for alternative statement with all adjustments
     */
    private calculateAltStatementPosition(node: EnhancedNode, index: number): { angle: number, radius: number } {
        const nodeId = node.id;
        let angle = this.statementAngles.get(nodeId);
        
        if (angle === undefined) {
            angle = index === 0 ? 
                this.FIRST_ALT_ANGLE : 
                (this.FIRST_ALT_ANGLE + (this.GOLDEN_ANGLE * index)) % (2 * Math.PI);
            this.statementAngles.set(nodeId, angle);
        }

        const ringIndex = index + 1;

        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + ((index + 1) * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT));

        const questionNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        const questionAdjustment = questionNode?.mode === 'preview' ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL - COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW) / 2 :
            0;
            
        const questionHiddenAdjustment = questionNode?.isHidden ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
            
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 :
            0;
            
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        let innerExpandedAdjustment = 0;
        this.expandedStatements.forEach((data, id) => {
            if (data.ringIndex < ringIndex) {
                innerExpandedAdjustment += data.adjustment;
                console.debug('[OpenQuestionAnswerLayout] Adding inner expanded adjustment:', {
                    forNodeId: node.id,
                    fromNodeId: id,
                    innerRingIndex: data.ringIndex,
                    thisRingIndex: ringIndex,
                    adjustment: data.adjustment
                });
            }
        });
        
        let innerHiddenAdjustment = 0;
        this.hiddenNodes.forEach((data, id) => {
            if (data.ringIndex < ringIndex) {
                innerHiddenAdjustment += data.adjustment;
                console.debug('[OpenQuestionAnswerLayout] Adding inner hidden adjustment:', {
                    forNodeId: node.id,
                    fromNodeId: id,
                    innerRingIndex: data.ringIndex,
                    thisRingIndex: ringIndex,
                    adjustment: data.adjustment
                });
            }
        });
        
        const radius = baseRadius + 
                      expansionAdjustment + 
                      hiddenAdjustment - 
                      questionAdjustment - 
                      questionHiddenAdjustment + 
                      innerExpandedAdjustment + 
                      innerHiddenAdjustment;

        console.debug('[OpenQuestionAnswerLayout] Alternative statement position calculated:', {
            nodeId: node.id,
            ringIndex,
            baseRadius,
            expansionAdjustment,
            hiddenAdjustment,
            questionAdjustment,
            questionHiddenAdjustment,
            innerExpandedAdjustment,
            innerHiddenAdjustment,
            finalRadius: radius
        });

        return { angle, radius };
    }

    /**
     * Reposition all statement nodes
     */
    private repositionStatements(nodes: EnhancedNode[]): void {
        const mostPopularStatement = nodes.find(n => n.type === 'statement' && n.group === 'live-definition');
        if (mostPopularStatement) {
            this.positionMostPopularStatement(mostPopularStatement);
        }

        const alternatives = nodes
            .filter(n => n.type === 'statement' && n.group === 'alternative-definition')
            .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));

        this.positionAlternativeStatements(alternatives);
    }

    /**
     * Update data and handle mode changes
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug('[OpenQuestionAnswerLayout] Updating layout data', {
            nodeCount: nodes.length,
            linkCount: links.length
        });

        this.simulation.stop();
        this.updateExpansionState(nodes);
        this.updateHiddenState(nodes);
        this.clearAllForces();
        this.initializeNodePositions(nodes);
        this.simulation.nodes(asD3Nodes(nodes));
        this.configureForces();
        this.simulation.alpha(0).alphaTarget(0);
        this.enforceFixedPositions();
    }
    
    /**
     * Stops the layout strategy and clears all forces
     */
    public stop(): void {
        console.debug('[OpenQuestionAnswerLayout] Stopping layout');
        super.stop();
        if (this.simulation) {
            this.clearAllForces();
        }
    }
}