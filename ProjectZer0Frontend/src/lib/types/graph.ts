// src/lib/types/graph.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import type { UserProfile } from './user';
import type { WordNode } from './nodes';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  data: UserProfile | WordNode | any;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: GraphNode | string;
  target: GraphNode | string;
}