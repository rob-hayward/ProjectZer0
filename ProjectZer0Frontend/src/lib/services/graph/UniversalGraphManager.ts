// src/lib/services/graph/UniversalGraphManager.ts
// Dedicated graph manager optimized for universal graph view with consolidated relationships

import * as d3 from 'd3';
import { writable, derived, type Readable } from 'svelte/store';
import type { 
    GraphData, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink,
    EnhancedNode,
    EnhancedLink, 
    RenderableNode, 
    RenderableLink, 
    LayoutUpdateConfig,
    ConsolidatedKeywordMetadata,
    ConsolidatedRelationshipUtils
} from '$lib/types/graph/enhanced';
import { asD3Nodes, asD3Links } from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, NODE_CONSTANTS } from '$lib/constants/graph';
import { COLORS } from '$lib/constants/colors';
import { UniversalGraphLayout } from './layouts/UniversalGraphLayout';
import { coordinateSystem } from './CoordinateSystem';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

/**
 * UniversalGraphManager - Specialized manager for universal graph view
 * Optimized for consolidated relationships and high-performance rendering
 */
export class UniversalGraphManager {
    private simulation: d3.Simulation<any, any>;
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private managerId: string;
    private simulationActive = false;
    private layoutStrategy: UniversalGraphLayout | null = null;
    
    // Performance-optimized caches
    private nodeRadiusCache = new Map<string, number>();
    private linkPathCache = new Map<string, { path: string; metadata: any }>();
    
    // Performance metrics for consolidated relationships
    private performanceMetrics = {
        originalRelationshipCount: 0,
        consolidatedRelationshipCount: 0,
        consolidationRatio: 1.0,
        lastUpdateTime: 0,
        renderTime: 0
    };

    // Public derived stores for renderable data
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;

    constructor() {
        this.managerId = `universal-${Math.random().toString(36).substring(2, 9)}`;
        this.simulation = this.initializeSimulation();
    
        // Create optimized derived stores
        this.renderableNodes = derived(this.nodesStore, (nodes) => 
            this.createRenderableNodes(nodes)
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore], 
            ([nodes, links]) => this.createRenderableLinks(nodes, links)
        );
    }

    /**
     * Get performance metrics for monitoring consolidation effectiveness
     */
    public getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Set graph data with consolidated relationship optimization
     */
    public setData(data: GraphData, config?: LayoutUpdateConfig): void {
        const startTime = performance.now();
        
        // Stop any running simulation
        this.stopSimulation();
        
        // Clear caches for fresh start
        this.clearCaches();
        
        // Transform and optimize data
        const enhancedNodes = this.transformNodes(data.nodes);
        const enhancedLinks = this.transformLinks(data.links || []);
        
        // Track performance metrics
        this.updatePerformanceMetrics(data.links || []);
        
        // Update stores
        this.nodesStore.set(enhancedNodes);
        this.linksStore.set(enhancedLinks);
        
        // Configure D3 simulation
        this.configureSimulation(enhancedNodes, enhancedLinks);
        
        // Apply universal graph layout
        this.applyUniversalLayout();
        
        // Start simulation unless disabled
        if (!config?.skipAnimation) {
            this.startSimulation();
        }
        
        // Track render time
        this.performanceMetrics.renderTime = performance.now() - startTime;
        
        // Log performance improvement
        if (this.performanceMetrics.consolidationRatio > 1) {
            console.log(`[UniversalGraphManager] Optimization complete:`, {
                originalLinks: this.performanceMetrics.originalRelationshipCount,
                consolidatedLinks: this.performanceMetrics.consolidatedRelationshipCount,
                reductionRatio: `${this.performanceMetrics.consolidationRatio.toFixed(2)}x`,
                renderTime: `${this.performanceMetrics.renderTime.toFixed(2)}ms`,
                nodeCount: enhancedNodes.length
            });
        }
    }

    /**
     * Update node mode with universal graph optimizations
     */
    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const node = currentNodes[nodeIndex];
        if (node.mode === mode) return;
        
        // Stop simulation for update
        this.simulation.alpha(0).alphaTarget(0);
        
        // Clear radius cache for this node
        this.clearNodeRadiusCache(nodeId);
        
        // Calculate new radius
        const newRadius = this.getNodeRadius({
            ...node,
            mode: mode
        });
        
        // Create updated node
        const updatedNode: EnhancedNode = {
            ...node,
            mode,
            expanded: mode === 'detail',
            radius: newRadius,
            metadata: {
                ...node.metadata,
                isDetail: mode === 'detail'
            }
        };
        
        // Update nodes array
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        // Update simulation and store
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        // Handle central/control nodes
        if (node.group === 'central' || node.fixed) {
            this.centerNode(updatedNode);
        }
        
        // Let layout strategy handle the change
        if (this.layoutStrategy) {
            this.layoutStrategy.handleNodeStateChange(nodeId, mode);
        }
        
        // Smooth restart
        this.simulation.alpha(0.1).restart();
        this.simulationActive = true;
    }

    /**
     * Update node visibility with optimized handling
     */
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const oldNode = currentNodes[nodeIndex];
        if (oldNode.isHidden === isHidden) return;
        
        // Clear caches for this node
        this.clearNodeRadiusCache(nodeId);
        
        // When transitioning from hidden to visible, reset to preview mode
        let updatedMode = oldNode.mode;
        if (oldNode.isHidden && !isHidden) {
            updatedMode = 'preview';
        }
        
        // Calculate new radius
        const newRadius = this.getNodeRadius({
            ...oldNode,
            mode: updatedMode,
            isHidden: isHidden
        });
        
        // Create updated node
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden: isHidden,
            hiddenReason: hiddenReason,
            mode: updatedMode,
            radius: newRadius,
            expanded: updatedMode === 'detail'
        };
        
        // Update nodes array
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        // Update simulation and store
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        // Smooth restart
        this.simulation.alpha(0.2).restart();
        this.simulationActive = true;
    }

    /**
     * Apply visibility preferences in batch for performance
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) return;
        
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!currentNodes || currentNodes.length === 0) return;
        
        let changedNodeCount = 0;
        const updatedNodes = [...currentNodes];
        
        // Apply preferences efficiently
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const nodeIndex = updatedNodes.findIndex(n => n.id === nodeId);
            if (nodeIndex >= 0) {
                const node = updatedNodes[nodeIndex];
                const newHiddenState = !isVisible;
                
                if (node.isHidden !== newHiddenState) {
                    // Update node properties
                    updatedNodes[nodeIndex] = {
                        ...node,
                        isHidden: newHiddenState,
                        hiddenReason: 'user',
                        radius: this.getNodeRadius({
                            ...node,
                            isHidden: newHiddenState
                        })
                    };
                    changedNodeCount++;
                }
            }
        });
        
        // Only update if changes were made
        if (changedNodeCount > 0) {
            this.simulation.nodes(updatedNodes);
            this.nodesStore.set(updatedNodes);
            
            console.log(`[UniversalGraphManager] Applied ${changedNodeCount} visibility preferences`);
            
            // Smooth restart
            this.simulation.alpha(0.1).restart();
            this.simulationActive = true;
        }
    }

    /**
     * Stop the simulation and cleanup
     */
    public stop(): void {
        this.stopSimulation();
        if (this.layoutStrategy) {
            this.layoutStrategy.stop();
            this.layoutStrategy = null;
        }
        this.clearCaches();
    }

    /**
     * Force immediate tick updates
     */
    public forceTick(ticks: number = 1): void {
        this.simulation.alpha(0).alphaTarget(0);
        
        for (let i = 0; i < ticks; i++) {
            this.simulation.tick();
        }
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        this.nodesStore.set([...nodes]);
    }

    // Private methods

    private initializeSimulation(): d3.Simulation<any, any> {
        const simulation = d3.forceSimulation()
            .force('link', d3.forceLink()
                .id((d: any) => (d as EnhancedNode).id)
                .strength((l: any) => this.getLinkStrength(l as EnhancedLink)))
            .force('charge', d3.forceManyBody()
                .strength(-1000) // Strong repulsion for good spacing
                .distanceMin(100)
                .distanceMax(800))
            .force('collision', d3.forceCollide()
                .radius((d: any) => (d as EnhancedNode).radius + 40)
                .strength(0.9)
                .iterations(3))
            .velocityDecay(0.4)
            .alphaDecay(0.03)
            .alphaMin(0.01);
        
        // Optimized tick handler
        simulation.on('tick', () => {
            const nodes = simulation.nodes() as unknown as EnhancedNode[];
            
            // Handle fixed nodes
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    this.centerNode(node);
                } else if (node.type === 'navigation') {
                    this.enforceNavigationPosition(node);
                }
            });
            
            // Update store
            this.nodesStore.set([...nodes]);
        });
        
        return simulation;
    }

    private configureSimulation(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        this.simulation.nodes(asD3Nodes(nodes));
        
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }
    }

    private applyUniversalLayout(): void {
        if (this.layoutStrategy) {
            this.layoutStrategy.stop();
        }
        
        this.layoutStrategy = new UniversalGraphLayout(
            COORDINATE_SPACE.WORLD.WIDTH,
            COORDINATE_SPACE.WORLD.HEIGHT,
            'universal'
        );
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        this.layoutStrategy.setSimulation(this.simulation as any);
        this.layoutStrategy.initializeNodePositions(nodes);
        this.layoutStrategy.configureForces();
        
        this.simulation.nodes(asD3Nodes(nodes));
    }

    private startSimulation(): void {
        if (this.simulationActive) return;
        
        this.simulation.alpha(0.8).restart();
        this.simulationActive = true;
    }

    private stopSimulation(): void {
        if (!this.simulationActive) return;
        
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        // Clear velocities
        const nodes = this.simulation.nodes();
        nodes.forEach((node: any) => {
            node.vx = 0;
            node.vy = 0;
        });
        
        this.simulationActive = false;
    }

    private updatePerformanceMetrics(links: GraphLink[]): void {
        let originalCount = 0;
        let consolidatedCount = 0;
        
        links.forEach(link => {
            consolidatedCount++;
            
            if (link.type === 'shared_keyword' && link.metadata?.consolidatedKeywords) {
                originalCount += (link.metadata.consolidatedKeywords as ConsolidatedKeywordMetadata).relationCount;
            } else {
                originalCount++;
            }
        });
        
        this.performanceMetrics = {
            originalRelationshipCount: originalCount,
            consolidatedRelationshipCount: consolidatedCount,
            consolidationRatio: originalCount > 0 ? originalCount / consolidatedCount : 1.0,
            lastUpdateTime: Date.now(),
            renderTime: 0 // Will be set in setData
        };
    }

    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        return nodes.map(node => {
            // Get visibility and radius
            const netVotes = this.getNodeVotes(node);
            const isHidden = (node.type === 'statement' || node.type === 'openquestion') && netVotes < 0;
            
            // Determine mode
            let nodeMode: NodeMode | undefined = node.mode;
            if (node.group === 'central' && !node.mode) {
                nodeMode = 'detail';
            }
            
            // Calculate radius
            const nodeRadius = this.getNodeRadius({
                ...node,
                mode: nodeMode,
                isHidden: isHidden
            });
            
            // Build enhanced node data
            let nodeData: any = {
                ...(node.data || {}),
                id: node.id
            };
            
            // Add type-specific properties
            if (node.type === 'statement') {
                const votes = node.metadata?.votes as any;
                nodeData = {
                    ...nodeData,
                    statement: node.data && 'content' in node.data ? node.data.content : 
                               node.data && 'statement' in node.data ? (node.data as any).statement : '',
                    positiveVotes: votes?.positive || 0,
                    negativeVotes: votes?.negative || 0,
                    netVotes: votes?.net || 0,
                    votes: votes
                };
            } else if (node.type === 'openquestion') {
                const answerCount = node.metadata?.answer_count || 0;
                nodeData = {
                    ...nodeData,
                    questionText: node.data && 'content' in node.data ? node.data.content : 
                                 node.data && 'questionText' in node.data ? (node.data as any).questionText : '',
                    answerCount: answerCount
                };
            }
            
            const enhancedNode: EnhancedNode = {
                id: node.id,
                type: node.type,
                data: nodeData,
                group: node.group,
                mode: nodeMode,
                radius: nodeRadius,
                fixed: node.group === 'central',
                expanded: nodeMode === 'detail',
                isHidden,
                hiddenReason: isHidden ? 'community' : undefined,
                
                // D3 properties
                x: null,
                y: null,
                vx: null,
                vy: null,
                fx: null,
                fy: null,
                
                metadata: {
                    group: this.getLayoutGroup(node),
                    fixed: node.group === 'central',
                    isDetail: nodeMode === 'detail',
                    votes: netVotes,
                    // Preserve universal graph metadata
                    consensus_ratio: node.metadata?.consensus_ratio,
                    participant_count: node.metadata?.participant_count,
                    net_votes: node.metadata?.net_votes,
                    answer_count: node.metadata?.answer_count,
                    related_statements_count: node.metadata?.related_statements_count,
                    // User-specific data
                    userVoteStatus: node.metadata?.userVoteStatus,
                    userVisibilityPreference: node.metadata?.userVisibilityPreference,
                    ...(node.metadata || {})
                }
            };
            
            // Set initial position for central nodes
            if (enhancedNode.fixed || enhancedNode.group === 'central') {
                enhancedNode.fx = 0;
                enhancedNode.fy = 0;
                enhancedNode.x = 0;
                enhancedNode.y = 0;
            }
            
            return enhancedNode;
        });
    }

    private transformLinks(links: GraphLink[]): EnhancedLink[] {
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            // Determine strength based on type and consolidation
            let strength = 0.3;
            let relationshipType: 'direct' | 'keyword' = 'keyword';
            
            if (link.type === 'shared_keyword') {
                relationshipType = 'keyword';
                if (link.metadata?.consolidatedKeywords) {
                    // Use total strength from consolidated metadata, but cap it
                    strength = Math.min(1.0, link.metadata.consolidatedKeywords.totalStrength);
                } else {
                    strength = 0.5;
                }
            } else if (link.type === 'answers') {
                strength = 0.8;
                relationshipType = 'direct';
            } else if (link.type === 'related_to') {
                strength = 0.6;
                relationshipType = 'direct';
            }
            
            // Build enhanced metadata
            const linkMetadata: any = {
                ...(link.metadata || {}),
                linkType: link.type,
                sourceId,
                targetId
            };
            
            // Handle consolidated relationships
            if (link.type === 'shared_keyword' && link.metadata?.consolidatedKeywords) {
                linkMetadata.isConsolidated = true;
                linkMetadata.originalRelationshipCount = link.metadata.consolidatedKeywords.relationCount;
                
                // Backward compatibility
                linkMetadata.keyword = link.metadata.consolidatedKeywords.primaryKeyword;
                linkMetadata.sharedWords = link.metadata.consolidatedKeywords.sharedWords;
                linkMetadata.relationCount = link.metadata.consolidatedKeywords.relationCount;
            }
            
            return {
                id: link.id || `${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: link.type,
                relationshipType,
                strength,
                metadata: linkMetadata
            };
        });
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        return nodes.map(node => {
            const radius = node.radius;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const svgTransform = coordinateSystem.createSVGTransform(x, y);
            
            return {
                id: node.id,
                type: node.type,
                group: node.group,
                mode: node.mode,
                data: node.data,
                radius: radius,
                isHidden: node.isHidden,
                hiddenReason: node.hiddenReason,
                position: { x, y, svgTransform },
                metadata: node.metadata,
                style: {
                    previewSize: radius,
                    detailSize: radius,
                    colors: {
                        background: this.getNodeBackground(node),
                        border: this.getNodeBorder(node),
                        text: COLORS.UI.TEXT.PRIMARY,
                        hover: this.getNodeHover(node),
                        gradient: {
                            start: this.getNodeGradientStart(node),
                            end: this.getNodeGradientEnd(node)
                        }
                    },
                    padding: {
                        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
                        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
                    },
                    lineHeight: {
                        preview: NODE_CONSTANTS.LINE_HEIGHT.preview,
                        detail: NODE_CONSTANTS.LINE_HEIGHT.detail
                    },
                    stroke: {
                        preview: {
                            normal: NODE_CONSTANTS.STROKE.preview.normal,
                            hover: NODE_CONSTANTS.STROKE.preview.hover
                        },
                        detail: {
                            normal: NODE_CONSTANTS.STROKE.detail.normal,
                            hover: NODE_CONSTANTS.STROKE.detail.hover
                        }
                    },
                    highlightColor: this.getNodeColor(node)
                }
            };
        });
    }

    private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
        if (nodes.length === 0 || links.length === 0) return [];
        
        const nodeMap = new Map<string, EnhancedNode>();
        nodes.forEach(node => nodeMap.set(node.id, node));
        
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);
            
            if (!source || !target || source.isHidden || target.isHidden) {
                return null;
            }
            
            const path = this.calculateLinkPath(source, target, link);
            const sourceTransform = coordinateSystem.createSVGTransform(source.x ?? 0, source.y ?? 0);
            const targetTransform = coordinateSystem.createSVGTransform(target.x ?? 0, target.y ?? 0);
            
            // Enhanced metadata with consolidated support
            const enhancedMetadata: any = { ...link.metadata };
            
            if (link.type === 'shared_keyword') {
                if (link.metadata?.consolidatedKeywords) {
                    enhancedMetadata.sharedWords = link.metadata.consolidatedKeywords.sharedWords;
                    enhancedMetadata.relationCount = link.metadata.consolidatedKeywords.relationCount;
                    enhancedMetadata.keyword = link.metadata.consolidatedKeywords.primaryKeyword;
                    enhancedMetadata.isConsolidated = true;
                } else {
                    enhancedMetadata.sharedWords = [enhancedMetadata.keyword || ''];
                    enhancedMetadata.relationCount = 1;
                    enhancedMetadata.isConsolidated = false;
                }
            }
            
            return {
                id: link.id,
                type: link.type,
                sourceId: source.id,
                targetId: target.id,
                sourceType: source.type,
                targetType: target.type,
                path,
                sourcePosition: { 
                    x: source.x ?? 0, 
                    y: source.y ?? 0,
                    svgTransform: sourceTransform
                },
                targetPosition: { 
                    x: target.x ?? 0, 
                    y: target.y ?? 0,
                    svgTransform: targetTransform
                },
                strength: link.strength,
                relationshipType: link.relationshipType,
                metadata: enhancedMetadata
            };
        }).filter(Boolean) as RenderableLink[];
    }

    // Helper methods

    private getLinkStrength(link: EnhancedLink): number {
        // For consolidated relationships, use their calculated strength
        if (link.metadata?.consolidatedKeywords) {
            return Math.min(0.8, link.metadata.consolidatedKeywords.totalStrength * 0.5);
        }
        return link.strength || 0.3;
    }

    private centerNode(node: EnhancedNode): void {
        node.x = 0;
        node.y = 0;
        node.fx = 0;
        node.fy = 0;
        node.vx = 0;
        node.vy = 0;
    }

    private enforceNavigationPosition(node: EnhancedNode): void {
        if (node.fx !== null && node.fx !== undefined) {
            node.x = node.fx;
        }
        if (node.fy !== null && node.fy !== undefined) {
            node.y = node.fy;
        }
        node.vx = 0;
        node.vy = 0;
    }

    private calculateLinkPath(source: EnhancedNode, target: EnhancedNode, link?: EnhancedLink): string {
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        
        // Cache key with link info
        const linkInfo = link ? `${link.type}-${link.metadata?.isConsolidated ? 'consolidated' : 'single'}` : 'default';
        const cacheKey = `${source.id}-${target.id}-${linkInfo}-${sourceX.toFixed(1)}-${sourceY.toFixed(1)}-${targetX.toFixed(1)}-${targetY.toFixed(1)}`;
        
        if (this.linkPathCache.has(cacheKey)) {
            return this.linkPathCache.get(cacheKey)!.path;
        }
        
        if (sourceX === targetX && sourceY === targetY) return '';
        
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const sourceRadius = source.radius * 0.95;
        const targetRadius = target.radius * 0.95;
        
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        const path = `M${startX},${startY}L${endX},${endY}`;
        
        // Cache with metadata
        this.linkPathCache.set(cacheKey, {
            path,
            metadata: {
                linkType: link?.type || 'unknown',
                isConsolidated: link?.metadata?.isConsolidated || false
            }
        });
        
        // Limit cache size
        if (this.linkPathCache.size > 500) {
            const firstKey = this.linkPathCache.keys().next().value;
            if (firstKey) this.linkPathCache.delete(firstKey);
        }
        
        return path;
    }

    private getNodeRadius(node: GraphNode | EnhancedNode): number {
        const cacheKey = `${node.id}-${node.type}-${node.mode || 'preview'}-${('isHidden' in node && node.isHidden) ? 'hidden' : 'visible'}`;
        
        if (this.nodeRadiusCache.has(cacheKey)) {
            return this.nodeRadiusCache.get(cacheKey)!;
        }
        
        if ('isHidden' in node && node.isHidden) {
            const radius = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
            this.nodeRadiusCache.set(cacheKey, radius);
            return radius;
        }
        
        let radius = 0;
        switch(node.type) {
            case 'statement':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
                break;
            case 'openquestion':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.PREVIEW / 2;
                break;
            case 'navigation':
                radius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
                break;
            case 'dashboard':
                if (node.data && 'sub' in node.data && node.data.sub === 'universal-controls') {
                    radius = node.mode === 'detail' ?
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 :
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
                } else {
                    radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
                }
                break;
            default:
                radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
        
        this.nodeRadiusCache.set(cacheKey, radius);
        return radius;
    }

    private getLayoutGroup(node: GraphNode): "central" | "word" | "definition" | "navigation" | "statement" {
        if (node.group === 'central') return 'central';
        if (node.group === 'live-definition' || node.group === 'alternative-definition') return 'definition';
        return node.type as "word" | "navigation" | "statement";
    }

    private getNodeVotes(node: GraphNode): number {
        if (node.type === 'statement' || node.type === 'openquestion') {
            const votes = node.metadata?.votes as any;
            if (votes) {
                const positiveVotes = getNeo4jNumber(votes.positive);
                const negativeVotes = getNeo4jNumber(votes.negative);
                return positiveVotes - negativeVotes;
            }
        }
        return 0;
    }

    private getNodeColor(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            case 'openquestion':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
            case 'navigation':
                return 'transparent';
            case 'dashboard':
                return COLORS.UI.TEXT.PRIMARY;
            default:
                return COLORS.UI.TEXT.PRIMARY;
        }
    }

    private extractBaseColorFromStyle(style: any): string {
        if (style.border) {
            return style.border.substring(0, 7);
        }
        return COLORS.UI.TEXT.PRIMARY;
    }

    private getNodeBackground(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.background;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.background;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.background;
            default:
                return 'rgba(0, 0, 0, 0.5)';
        }
    }

    private getNodeBorder(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.border;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.border;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.border;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    private getNodeHover(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.hover;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.hover;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.hover;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    private getNodeGradientStart(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.start;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.start;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.start;
            default:
                return 'rgba(255, 255, 255, 0.4)';
        }
    }

    private getNodeGradientEnd(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.end;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.end;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.end;
            default:
                return 'rgba(255, 255, 255, 0.2)';
        }
    }

    private clearCaches(): void {
        this.nodeRadiusCache.clear();
        this.linkPathCache.clear();
    }

    private clearNodeRadiusCache(nodeId: string): void {
        for (const key of Array.from(this.nodeRadiusCache.keys())) {
            if (key.startsWith(`${nodeId}-`)) {
                this.nodeRadiusCache.delete(key);
            }
        }
    }
}