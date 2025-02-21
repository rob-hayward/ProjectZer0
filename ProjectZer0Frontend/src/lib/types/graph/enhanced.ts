// src/lib/types/graph/enhanced.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { GraphNode, GraphLink, NodeType, LinkType, NodeGroup, NodeMode } from './core';

// Enhanced D3 simulation node
export interface EnhancedNode extends GraphNode, SimulationNodeDatum {
  radius: number;  // Explicit radius based on node type and mode
}

// Enhanced D3 simulation link
export interface EnhancedLink extends GraphLink, SimulationLinkDatum<EnhancedNode> {
  // Any additional properties specific to simulation
}

// Final renderable node with all display properties
export interface RenderableNode {
  id: string;
  type: NodeType;
  group: NodeGroup;
  mode?: NodeMode;
  data: any;
  radius: number;
  position: {
    x: number;
    y: number;
    svgTransform: string;
  };
}

// Final renderable link with pre-calculated path
export interface RenderableLink {
  id: string;
  type: LinkType;
  sourceId: string;
  targetId: string;
  sourceType: NodeType;
  targetType: NodeType;
  path: string;
}