// src/lib/components/graph/layouts/GraphLayoutEngine.ts
import type { GraphNode, GraphEdge, GraphData, NodePosition, ViewType } from '../../../types/graph/core';
import type { LayoutConfig } from '../../../types/graph/layout';
import { LayoutService } from '../../../services/graph/layout/LayoutService';

export class GraphLayoutEngine {
    private layoutService: LayoutService;
    private definitionNodeModes: Map<string, 'preview' | 'detail'>;
    private _viewType: ViewType;
    private _width: number;
    private _height: number;
    private currentPositions: Map<string, NodePosition>;
    private previousData: {
        nodes: GraphNode[];
        links: GraphEdge[];
    } | null = null;

    constructor(width: number, height: number, viewType: ViewType, isPreviewMode = false) {
        console.log('Creating GraphLayoutEngine:', { width, height, viewType, isPreviewMode });
        this._width = width;
        this._height = height;
        this._viewType = viewType;
        this.currentPositions = new Map();
        this.definitionNodeModes = new Map();
        
        const config: LayoutConfig = {
            width,
            height,
            viewType,
            isPreviewMode
        };
        
        this.layoutService = new LayoutService(config);
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get viewType(): ViewType {
        return this._viewType;
    }

    private hasSignificantChanges(newData: GraphData): boolean {
        if (!this.previousData || !this.previousData.nodes || !this.previousData.links) {
            return true;
        }
    
        // Check for mode changes in nodes
        const hasModesChanged = Array.from(this.definitionNodeModes.entries()).some(
            ([nodeId, mode]) => {
                const prevNode = this.previousData?.nodes.find(n => n.id === nodeId);
                const newNode = newData.nodes.find(n => n.id === nodeId);
                return prevNode && newNode && 
                       (prevNode.type !== newNode.type || prevNode.group !== newNode.group);
            }
        );
    
        if (hasModesChanged) {
            console.log('Mode changes detected, requiring layout update');
            return true;
        }
    
        // Check for structural changes in nodes
        const structuralChanges = !this.areNodesEqual(this.previousData.nodes, newData.nodes) ||
                                !this.areLinksEqual(this.previousData.links, newData.links || []);
    
        if (structuralChanges) {
            console.log('Structural changes detected, requiring layout update');
            return true;
        }
    
        return false;
    }

    private areNodesEqual(prev: GraphNode[], curr: GraphNode[]): boolean {
        if (prev.length !== curr.length) return false;
        
        return prev.every((node, index) => 
            node.id === curr[index].id &&
            node.type === curr[index].type &&
            node.group === curr[index].group
        );
    }

    private areLinksEqual(prev: GraphEdge[], curr: GraphEdge[]): boolean {
        if (prev.length !== curr.length) return false;
        
        return prev.every((link, index) => {
            const prevSource = typeof link.source === 'string' ? link.source : link.source.id;
            const prevTarget = typeof link.target === 'string' ? link.target : link.target.id;
            const currSource = typeof curr[index].source === 'string' ? curr[index].source : curr[index].source.id;
            const currTarget = typeof curr[index].target === 'string' ? curr[index].target : curr[index].target.id;
            
            return prevSource === currSource && 
                   prevTarget === currTarget && 
                   link.type === curr[index].type;
        });
    }

    public updateLayout(data: GraphData, skipAnimation: boolean = false): Map<string, NodePosition> {
        console.log('GraphLayoutEngine updateLayout called:', {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length || 0,
            viewType: this._viewType,
            skipAnimation
        });

        // Check if we need to update the layout
        if (!this.hasSignificantChanges(data)) {
            console.log('No significant changes detected, returning current positions');
            return this.currentPositions;
        }
        
        // Check if layout service needs to be recreated
        if (this._viewType !== this.layoutService.viewType) {
            console.log('View type changed, recreating layout service:', {
                from: this.layoutService.viewType,
                to: this._viewType
            });
            
            this.recreateLayoutService();
        }
        
        // Update layout and store current positions
        this.currentPositions = this.layoutService.updateLayout(
            data.nodes,
            data.links || [],
            skipAnimation
        );

        // Store data for future comparison
        this.previousData = {
            nodes: [...data.nodes],
            links: [...(data.links || [])]
        };

        return this.currentPositions;
    }

    public updatePreviewMode(isPreview: boolean): void {
        console.log('GraphLayoutEngine updatePreviewMode:', { isPreview });
        // Clear cached data to force layout recalculation
        this.previousData = null;
        this.layoutService.updatePreviewMode(isPreview);
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        console.log('GraphLayoutEngine updateDefinitionModes:', { 
            modeCount: modes.size,
            modes: Array.from(modes.entries())
        });
        // Clear cached data to force layout recalculation
        this.previousData = null;
        this.definitionNodeModes = new Map(modes);
        this.layoutService.updateDefinitionModes(modes);
    }

    public resize(width: number, height: number): void {
        console.log('GraphLayoutEngine resize:', { width, height });
        this._width = width;
        this._height = height;
        this.layoutService.resize(width, height);
    }

    public stop(): void {
        console.log('GraphLayoutEngine stopping');
        this.layoutService.stop();
    }

    public getSimulation() {
        return this.layoutService.getSimulation();
    }

    public updateViewType(viewType: ViewType): void {
        console.log('GraphLayoutEngine updateViewType:', {
            from: this._viewType,
            to: viewType
        });
        if (this._viewType !== viewType) {
            this._viewType = viewType;
        }
    }

    private recreateLayoutService(): void {
        const config: LayoutConfig = {
            width: this._width,
            height: this._height,
            viewType: this._viewType,
            isPreviewMode: false
        };
        
        this.layoutService.stop();
        this.layoutService = new LayoutService(config);
        this.layoutService.updateDefinitionModes(this.definitionNodeModes);
    }
}