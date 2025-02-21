// src/lib/services/graph/layout/LayoutService.ts
import * as d3 from 'd3';
import type { 
    GraphData, 
    GraphLink, 
    GraphNode, 
    NodePosition, 
    ViewType,
    NodeType 
} from '../../../types/graph/core';
import type { LayoutNode, LayoutLink, LayoutConfig } from '../../../types/graph/layout';
import { SingleNodeLayout } from '../simulation/layouts/SingleNodeLayout';
import { WordDefinitionLayout } from '../simulation/layouts/WordDefinitionLayout';
import { BaseLayoutStrategy } from '../simulation/layouts/BaseLayoutStrategy';
import { COORDINATE_SPACE } from '../../../constants/graph';

interface LayoutState {
    isPreviewMode: boolean;
    definitionModes: Map<string, 'preview' | 'detail'>;
}

export class LayoutService {
    private layoutStrategy: BaseLayoutStrategy;
    private _width: number;
    private _height: number;
    private _viewType: ViewType;
    private state: LayoutState;
    private serviceId: string;

    // Public getters
    get width(): number { return this._width; }
    get height(): number { return this._height; }
    get viewType(): ViewType { return this._viewType; }

    constructor(config: LayoutConfig) {
        this.serviceId = Math.random().toString(36).substr(2, 9);
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Construction`, {
            config,
            worldDimensions: {
                width: COORDINATE_SPACE.WORLD.WIDTH,
                height: COORDINATE_SPACE.WORLD.HEIGHT
            }
        });
        
        // Always use world dimensions for internal calculations
        this._width = COORDINATE_SPACE.WORLD.WIDTH;
        this._height = COORDINATE_SPACE.WORLD.HEIGHT;
        this._viewType = config.viewType;
        
        this.state = {
            isPreviewMode: config.isPreviewMode || false,
            definitionModes: new Map()
        };

        this.layoutStrategy = this.createLayoutStrategy(config.viewType);
    }

    private getNodeSize(node: GraphNode): number {
        if (node.type === 'word') {
            return node.mode === 'detail' ? 
                COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL : 
                COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW;
        }
        
        if (node.type === 'definition') {
            return node.mode === 'detail' ?
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL :
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW;
        }
        
        return COORDINATE_SPACE.NODES.SIZES.NAVIGATION;
    }

    private createLayoutStrategy(viewType: ViewType): BaseLayoutStrategy {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Creating strategy`, {
            viewType,
            dimensions: { width: this._width, height: this._height }
        });

        switch (viewType) {
            case 'word':
                return new WordDefinitionLayout(this._width, this._height, viewType);
            case 'dashboard':
            case 'edit-profile':
            case 'create-node':
            default:
                return new SingleNodeLayout(this._width, this._height, viewType);
        }
    }

    private getLayoutGroup(node: GraphNode): "central" | "word" | "definition" | "navigation" {
        if (node.group === 'central') return 'central';
        if (node.group === 'live-definition' || node.group === 'alternative-definition') return 'definition';
        return node.type as "word" | "navigation";
    }

    private getNodeVotes(node: GraphNode): number {
        if (node.type === 'definition' && 'data' in node) {
            const def = node.data as { positiveVotes?: number; negativeVotes?: number };
            return (typeof def.positiveVotes === 'number' ? def.positiveVotes : 0) -
                   (typeof def.negativeVotes === 'number' ? def.negativeVotes : 0);
        }
        return 0;
    }

    private transformToLayoutFormat(data: GraphData): {
        nodes: LayoutNode[];
        links: LayoutLink[];
    } {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Transform] Starting data transformation`, {
            inputNodes: data.nodes.length,
            inputLinks: data.links?.length || 0
        });

        const layoutNodes = data.nodes.map(node => {
            const nodeType = (node.type === 'definition' ? 'definition' :
                            node.type === 'word' ? 'word' :
                            node.type === 'navigation' ? 'navigation' :
                            'central') as NodeType | 'central';

            const isDetail = node.type === 'word' ? 
                !this.state.isPreviewMode :
                this.state.definitionModes.get(node.id) === 'detail';

            return {
                id: node.id,
                type: nodeType,
                subtype: node.type === 'definition' 
                    ? (node.group === 'live-definition' ? 'live' : 'alternative')
                    : undefined,
                metadata: {
                    group: this.getLayoutGroup(node),
                    fixed: node.group === 'central',
                    isDetail,
                    votes: node.type === 'definition' ? this.getNodeVotes(node) : undefined
                }
            } as LayoutNode;
        });

        const layoutLinks = (data.links || []).map(link => {
            const linkType = link.type === 'live' ? 'definition' : 'navigation';
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;

            return {
                source: sourceId,
                target: targetId,
                type: linkType,
                strength: linkType === 'definition' ? 0.7 : 0.3
            } as LayoutLink;
        });

        return { nodes: layoutNodes, links: layoutLinks };
    }

    // Updated method in LayoutService.ts
public updateLayout(
    graphNodes: GraphNode[], 
    graphLinks: GraphLink[] = [], 
    skipAnimation: boolean = false
): Map<string, NodePosition> {
    console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Starting layout update`, {
        nodeCount: graphNodes.length,
        linkCount: graphLinks.length,
        skipAnimation
    });

    const layoutData = this.transformToLayoutFormat({ 
        nodes: graphNodes, 
        links: graphLinks 
    });

    // Apply the layout update
    this.layoutStrategy.updateData(layoutData.nodes, layoutData.links, skipAnimation);

    // Get positions from simulation
    const simNodes = this.layoutStrategy.getSimulation().nodes();
    const positions = new Map(simNodes.map(node => {
        const simNode = layoutData.nodes.find(n => n.id === node.id);
        const graphNode = graphNodes.find(n => n.id === node.id);
        
        if (!simNode || !graphNode) {
            console.warn(`[LAYOUT-SERVICE:${this.serviceId}:Position] Node not found`, {
                id: node.id
            });
            return [node.id, {
                x: 0,
                y: 0,
                scale: 1,
                svgTransform: 'translate(0, 0)'
            }];
        }
        
        // Ensure precise positioning by rounding coordinates
        const x = Math.round(node.x ?? 0);
        const y = Math.round(node.y ?? 0);

        // Create consistent transform
        const position = {
            x,
            y,
            scale: 1,
            svgTransform: `translate(${x}, ${y})`
        };

        // Debug position information
        if (node.metadata.fixed) {
            console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Position] Central node position`, {
                nodeId: node.id,
                type: node.type,
                rawPosition: { x: node.x, y: node.y },
                finalPosition: position,
                isFixed: node.metadata.fixed,
                fixedPosition: { fx: node.fx, fy: node.fy }
            });
        }

        return [node.id, position];
    }));

    return positions;
}

    public updatePreviewMode(isPreview: boolean): void {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Preview mode update`, { 
            from: this.state.isPreviewMode,
            to: isPreview
        });

        if (this.state.isPreviewMode !== isPreview) {
            this.state.isPreviewMode = isPreview;
            
            const currentNodes = this.layoutStrategy.getSimulation().nodes();
            const currentLinks = (this.layoutStrategy.getSimulation().force('link') as d3.ForceLink<LayoutNode, LayoutLink>)?.links() || [];
            
            const updatedNodes = currentNodes.map(node => {
                if (node.type === 'word' || node.metadata.fixed) {
                    return {
                        ...node,
                        metadata: {
                            ...node.metadata,
                            isDetail: !isPreview
                        }
                    };
                }
                return node;
            });
            
            this.layoutStrategy.updateData(updatedNodes, currentLinks);
        }
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Definition modes update`, {
            modeCount: modes.size
        });

        const changes = Array.from(modes.entries())
            .filter(([nodeId, mode]) => this.state.definitionModes.get(nodeId) !== mode);

        if (changes.length > 0) {
            this.state.definitionModes = new Map(modes);
            
            const currentNodes = this.layoutStrategy.getSimulation().nodes();
            const currentLinks = (this.layoutStrategy.getSimulation().force('link') as d3.ForceLink<LayoutNode, LayoutLink>)?.links() || [];
            
            const updatedNodes = currentNodes.map(node => ({
                ...node,
                metadata: {
                    ...node.metadata,
                    isDetail: node.type === 'definition' ? 
                        modes.get(node.id) === 'detail' : 
                        node.metadata.isDetail
                }
            }));
            
            this.layoutStrategy.updateData(updatedNodes, currentLinks);
        }
    }

    public resize(width: number, height: number): void {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Dimensions update`, { 
            from: { width: this._width, height: this._height },
            to: { width: COORDINATE_SPACE.WORLD.WIDTH, height: COORDINATE_SPACE.WORLD.HEIGHT }
        });

        // Always maintain world space dimensions
        this._width = COORDINATE_SPACE.WORLD.WIDTH;
        this._height = COORDINATE_SPACE.WORLD.HEIGHT;
        this.layoutStrategy.updateDimensions(this._width, this._height);
    }

    public stop(): void {
        console.debug(`[LAYOUT-SERVICE:${this.serviceId}:Lifecycle] Stopping service`);
        this.layoutStrategy.stop();
    }

    public getSimulation() {
        return this.layoutStrategy.getSimulation();
    }
}