// ProjectZer0Frontend/src/lib/components/graph/nodes/index.ts
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Base interface for all node components
export interface NodeComponentProps {
    node: RenderableNode;
    onModeChange?: (mode: 'preview' | 'detail') => void;
}

// HOC to handle common node behavior
export function withNodeBehavior(Component: any) {
    return function NodeWrapper(props: NodeComponentProps) {
        const { node, onModeChange } = props;
        
        // Common node behaviors like transitions and interactions
        function handleModeChange(mode: 'preview' | 'detail') {
            if (onModeChange) {
                onModeChange(mode);
            }
        }
        
        return {
            Component,
            props: {
                ...props,
                handleModeChange,
                style: node.style,
                transform: node.position.svgTransform
            }
        };
    };
}