// ProjectZer0Frontend/src/lib/types/graph/props.ts
import type { GraphData, ViewType, NodeMode, RenderableNode, RenderableLink } from './enhanced';
import type { BackgroundConfig } from './background';

// Props for main Graph component
export interface GraphProps {
    data: GraphData;
    viewType: ViewType;
    backgroundConfig?: Partial<BackgroundConfig>;
}

// Props for NodeRenderer component
export interface NodeRendererProps {
    node: RenderableNode;
    onModeChange: (nodeId: string, mode: NodeMode) => void;
}

// Props for LinkRenderer component
export interface LinkRendererProps {
    link: RenderableLink;
}

// Custom events
export interface GraphEvents {
    modechange: CustomEvent<{ nodeId: string; mode: NodeMode }>;
}