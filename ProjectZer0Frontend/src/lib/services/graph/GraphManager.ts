// src/lib/services/graph/GraphManager.ts
import * as d3 from 'd3';
import { writable, derived, get } from 'svelte/store';
import type { GraphNode, GraphLink, GraphData, ViewType, NodeMode } from '$lib/types/graph/core';
import type { EnhancedNode, EnhancedLink, RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE } from '$lib/constants/graph';
import { BaseLayoutStrategy } from './simulation/layouts/BaseLayoutStrategy';
import { WordDefinitionLayout } from './simulation/layouts/WordDefinitionLayout';
import { SingleNodeLayout } from './simulation/layouts/SingleNodeLayout';

export class GraphManager {
  // Private state
  private simulation: d3.Simulation<EnhancedNode, EnhancedLink>;
  private layoutStrategy: BaseLayoutStrategy;
  private viewType: ViewType;
  
  // Stores for reactivity
  private nodesStore = writable<EnhancedNode[]>([]);
  private linksStore = writable<EnhancedLink[]>([]);
  
  // Derived stores for rendering
  public renderableNodes = derived(this.nodesStore, (nodes) => this.createRenderableNodes(nodes));
  public renderableLinks = derived(
    [this.nodesStore, this.linksStore], 
    ([nodes, links]) => this.createRenderableLinks(nodes, links)
  );
  
  constructor(viewType: ViewType) {
    this.viewType = viewType;
    this.layoutStrategy = this.createLayoutStrategy(viewType);
    this.simulation = this.initializeSimulation();
    
    // Update stores when simulation ticks
    this.simulation.on('tick', () => {
      this.nodesStore.set([...this.simulation.nodes()]);
    });
  }
  
  public setData(data: GraphData): void {
    // Transform input data to enhanced data
    const enhancedNodes = this.transformNodes(data.nodes);
    const enhancedLinks = this.transformLinks(data.links || []);
    
    // Update stores
    this.nodesStore.set(enhancedNodes);
    this.linksStore.set(enhancedLinks);
    
    // Configure simulation
    this.simulation.nodes(enhancedNodes);
    
    const linkForce = this.simulation.force('link') as d3.ForceLink<EnhancedNode, EnhancedLink>;
    if (linkForce) {
      linkForce.links(enhancedLinks);
    }
    
    // Initialize node positions using strategy
    this.layoutStrategy.initializeNodePositions(enhancedNodes);
    
    // Start simulation
    this.simulation.alpha(1).restart();
  }
  
  public updateNodeMode(nodeId: string, mode: NodeMode): void {
    // Get current nodes
    const nodes = get(this.nodesStore);
    
    // Find and update node
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;
    
    const node = nodes[nodeIndex];
    node.mode = mode;
    
    // Recalculate radius and other properties
    this.updateNodeDerivedProperties(node);
    
    // Update store
    this.nodesStore.set([...nodes]);
    
    // Update layout strategy
    this.layoutStrategy.handleNodeStateChange(nodeId, mode);
    
    // Restart simulation with low alpha
    this.simulation.alpha(0.3).restart();
  }
  
  // Private methods
  private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
    return nodes.map(node => {
      const enhancedNode: EnhancedNode = {
        ...node,
        radius: this.getNodeRadius(node),
        // Add any other enhanced properties
      };
      return enhancedNode;
    });
  }
  
  private transformLinks(links: GraphLink[]): EnhancedLink[] {
    return links.map(link => {
      const enhancedLink: EnhancedLink = {
        ...link,
        // Add any other enhanced properties
      };
      return enhancedLink;
    });
  }
  
  private getNodeRadius(node: GraphNode): number {
    if (node.type === 'word') {
      return node.mode === 'detail' ? 
        COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
        COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
    } else if (node.type === 'definition') {
      return node.mode === 'detail' ?
        COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
        COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
    } else {
      return COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
    }
  }
  
  private updateNodeDerivedProperties(node: EnhancedNode): void {
    node.radius = this.getNodeRadius(node);
    // Update any other properties dependent on node state
  }
  
  private createLayoutStrategy(viewType: ViewType): BaseLayoutStrategy {
    switch (viewType) {
      case 'word':
        return new WordDefinitionLayout(
          COORDINATE_SPACE.WORLD.WIDTH, 
          COORDINATE_SPACE.WORLD.HEIGHT, 
          viewType
        );
      default:
        return new SingleNodeLayout(
          COORDINATE_SPACE.WORLD.WIDTH, 
          COORDINATE_SPACE.WORLD.HEIGHT, 
          viewType
        );
    }
  }
  
  private initializeSimulation(): d3.Simulation<EnhancedNode, EnhancedLink> {
    return d3.forceSimulation<EnhancedNode>()
      .force('link', d3.forceLink<EnhancedNode, EnhancedLink>().id(d => d.id))
      .force('charge', d3.forceManyBody())
      .force('collision', d3.forceCollide<EnhancedNode>(d => d.radius + 10))
      .velocityDecay(COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY)
      .alphaDecay(COORDINATE_SPACE.ANIMATION.ALPHA_DECAY)
      .alphaMin(COORDINATE_SPACE.ANIMATION.ALPHA_MIN);
  }
  
  private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
    return nodes.map(node => ({
      id: node.id,
      type: node.type,
      group: node.group,
      mode: node.mode,
      data: node.data,
      radius: node.radius,
      position: {
        x: node.x || 0,
        y: node.y || 0,
        svgTransform: `translate(${node.x || 0}, ${node.y || 0})`
      }
    }));
  }
  
  private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
    return links.map(link => {
      const source = typeof link.source === 'string' 
        ? nodes.find(n => n.id === link.source) 
        : link.source as EnhancedNode;
        
      const target = typeof link.target === 'string' 
        ? nodes.find(n => n.id === link.target)
        : link.target as EnhancedNode;
      
      if (!source || !target) return null;
      
      // Calculate link path
      const path = this.calculateLinkPath(source, target);
      
      return {
        id: `${source.id}-${target.id}`,
        type: link.type,
        sourceId: source.id,
        targetId: target.id,
        sourceType: source.type,
        targetType: target.type,
        path
      };
    }).filter(Boolean) as RenderableLink[];
  }
  
  private calculateLinkPath(source: EnhancedNode, target: EnhancedNode): string {
    const sourceX = source.x || 0;
    const sourceY = source.y || 0;
    const targetX = target.x || 0;
    const targetY = target.y || 0;
    
    // Calculate vector
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return '';
    
    // Calculate unit vector
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Calculate points on perimeter using node radii
    const startX = sourceX + unitX * source.radius;
    const startY = sourceY + unitY * source.radius;
    const endX = targetX - unitX * target.radius;
    const endY = targetY - unitY * target.radius;
    
    return `M${startX},${startY}L${endX},${endY}`;
  }
}