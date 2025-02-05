// src/lib/services/graph/layout/LayoutService.ts
import * as d3 from 'd3';
import type { 
    GraphData, 
    GraphEdge, 
    GraphNode, 
    NodePosition, 
    ViewType,
    NodeType 
} from '../../../types/graph/core';
import type { LayoutNode, LayoutLink, LayoutConfig } from '../../../types/graph/layout';
import { SingleNodeLayout } from '../simulation/layouts/SingleNodeLayout';
import { WordDefinitionLayout } from '../simulation/layouts/WordDefinitionLayout';
import { BaseLayoutStrategy } from '../simulation/layouts/BaseLayoutStrategy';

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

    // Public getters
    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get viewType(): ViewType {
        return this._viewType;
    }

    constructor(config: LayoutConfig) {
        console.log('Initializing LayoutService:', config);
        
        this._width = config.width;
        this._height = config.height;
        this._viewType = config.viewType;
        
        this.state = {
            isPreviewMode: config.isPreviewMode || false,
            definitionModes: new Map()
        };

        this.layoutStrategy = this.createLayoutStrategy(config.viewType);
    }

    private createLayoutStrategy(viewType: ViewType): BaseLayoutStrategy {
        console.log('Creating layout strategy for view type:', viewType);
        let strategy: BaseLayoutStrategy;
        switch (viewType) {
            case 'word':
                strategy = new WordDefinitionLayout(this._width, this._height, viewType);
                break;
            case 'dashboard':
            case 'edit-profile':
            case 'create-node':
            default:
                strategy = new SingleNodeLayout(this._width, this._height, viewType);
                break;
        }
        console.log('Created layout strategy:', {
            type: viewType,
            width: this._width,
            height: this._height,
            strategyType: strategy.constructor.name
        });
        return strategy;
    }

    private transformToLayoutFormat(data: GraphData): {
        nodes: LayoutNode[];
        links: LayoutLink[];
    } {
        console.log('Transforming data to layout format');

        const layoutNodes = data.nodes.map(node => {
            const nodeType = (node.type === 'definition' ? 'definition' :
                            node.type === 'word' ? 'word' :
                            node.type === 'navigation' ? 'navigation' :
                            'central') as NodeType | 'central';

            const layoutNode: LayoutNode = {
                id: node.id,
                type: nodeType,
                subtype: node.type === 'definition' 
                    ? (node.group === 'live-definition' ? 'live' : 'alternative')
                    : undefined,
                metadata: {
                    group: this.getLayoutGroup(node),
                    fixed: node.group === 'central',
                    isDetail: node.type === 'word' ? !this.state.isPreviewMode :
                             this.state.definitionModes.get(node.id) === 'detail',
                    votes: node.type === 'definition' ? this.getNodeVotes(node) : undefined
                }
            };
            return layoutNode;
        });

        const layoutLinks = (data.links || []).map(link => {
            const linkType = link.type === 'live' ? 'definition' : 'navigation';
            return {
                source: typeof link.source === 'string' ? link.source : link.source.id,
                target: typeof link.target === 'string' ? link.target : link.target.id,
                type: linkType,
                strength: linkType === 'definition' ? 0.7 : 0.3
            } as LayoutLink;
        });

        console.log('Layout data transformed:', {
            isPreviewMode: this.state.isPreviewMode,
            nodes: layoutNodes.map(n => ({
                id: n.id,
                type: n.type,
                isDetail: n.metadata.isDetail
            }))
        });
        
        return { nodes: layoutNodes, links: layoutLinks };
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

    public updateLayout(graphNodes: GraphNode[], graphLinks: GraphEdge[] = [], forceSkipAnimation: boolean = false): Map<string, NodePosition> {
        console.log('LayoutService updateLayout called with:', {
            nodeCount: graphNodes.length,
            linkCount: graphLinks.length,
            viewType: this._viewType,
            currentStrategy: this.layoutStrategy.constructor.name,
            forceSkipAnimation
        });

        const layoutData = this.transformToLayoutFormat({ 
            nodes: graphNodes, 
            links: graphLinks 
        });

        // Let layout strategy handle the positioning
        console.log('Updating layout strategy with transformed data:', {
            nodeCount: layoutData.nodes.length,
            linkCount: layoutData.links.length,
            nodes: layoutData.nodes.map(n => ({
                id: n.id,
                type: n.type,
                isDetail: n.metadata.isDetail
            }))
        });
        
        this.layoutStrategy.updateData(layoutData.nodes, layoutData.links, forceSkipAnimation);

        // Get positions from simulation
        const simNodes = this.layoutStrategy.getSimulation().nodes();
        const positions = new Map(simNodes.map(node => [
            node.id,
            {
                x: node.x ?? 0,
                y: node.y ?? 0,
                scale: 1,
                svgTransform: `translate(${node.x ?? 0}, ${node.y ?? 0})`
            }
        ]));

        console.log('Layout positions calculated:', {
            positionCount: positions.size
        });

        return positions;
    }

    public updatePreviewMode(isPreview: boolean): void {
        if (this.state.isPreviewMode !== isPreview) {
            console.log('Preview mode changed:', { 
                old: this.state.isPreviewMode, 
                new: isPreview,
                currentNodeCount: this.layoutStrategy.getSimulation().nodes().length
            });
            
            this.state.isPreviewMode = isPreview;
            
            // Get current simulation state
            const currentNodes = this.layoutStrategy.getSimulation().nodes();
            const currentLinks = (this.layoutStrategy.getSimulation().force('link') as d3.ForceLink<LayoutNode, LayoutLink>)?.links() || [];
            
            console.log('Current simulation state:', {
                nodeCount: currentNodes.length,
                linkCount: currentLinks.length
            });
            
            // Update isDetail metadata for word node
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
            
            // Update the layout with both nodes and links
            this.layoutStrategy.updateData(updatedNodes, currentLinks);
        }
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        const hadChanges = Array.from(modes.entries()).some(
            ([nodeId, mode]) => this.state.definitionModes.get(nodeId) !== mode
        );
        
        if (hadChanges) {
            console.log('Definition modes changed:', { 
                old: Object.fromEntries(this.state.definitionModes),
                new: Object.fromEntries(modes)
            });
            this.state.definitionModes = new Map(modes);
            // Force refresh of the layout
            const simNodes = this.layoutStrategy.getSimulation().nodes();
            this.layoutStrategy.updateData(simNodes, []);
        }
    }

    public resize(width: number, height: number): void {
        console.log('Resizing layout:', { width, height });
        this._width = width;
        this._height = height;
        this.layoutStrategy.updateDimensions(width, height);
    }

    public stop(): void {
        console.log('Stopping layout service');
        this.layoutStrategy.stop();
    }

    public getSimulation() {
        return this.layoutStrategy.getSimulation();
    }
}