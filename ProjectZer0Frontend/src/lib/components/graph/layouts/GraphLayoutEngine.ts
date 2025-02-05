// ProjectZer0Frontend/src/lib/components/graph/layouts/GraphLayoutEngine.ts
import type { GraphNode, GraphEdge, GraphData, NodePosition, ViewType } from '../../../types/graph/core';
import type { LayoutConfig } from '../../../types/graph/layout';
import { LayoutService } from '../../../services/graph/layout/LayoutService';

export class GraphLayoutEngine {
    private layoutService: LayoutService;
    private definitionNodeModes: Map<string, 'preview' | 'detail'>;
    private _viewType: ViewType;

    constructor(width: number, height: number, viewType: ViewType, isPreviewMode = false) {
        console.log('Creating GraphLayoutEngine:', { width, height, viewType, isPreviewMode });
        this._viewType = viewType;
        
        const config: LayoutConfig = {
            width,
            height,
            viewType,
            isPreviewMode
        };
        
        this.layoutService = new LayoutService(config);
        this.definitionNodeModes = new Map();
    }

    get width(): number {
        return this.layoutService.width;
    }

    get height(): number {
        return this.layoutService.height;
    }

    get viewType(): ViewType {
        return this._viewType;
    }

    public updateLayout(data: GraphData, skipAnimation: boolean = false): Map<string, NodePosition> {
        console.log('GraphLayoutEngine updateLayout called:', {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length || 0,
            viewType: this._viewType,
            skipAnimation
        });
        
        if (this._viewType !== this.layoutService.viewType) {
            console.log('View type changed, recreating layout service:', {
                from: this.layoutService.viewType,
                to: this._viewType
            });
            
            const config: LayoutConfig = {
                width: this.width,
                height: this.height,
                viewType: this._viewType,
                isPreviewMode: false
            };
            
            this.layoutService.stop();
            this.layoutService = new LayoutService(config);
            this.layoutService.updateDefinitionModes(this.definitionNodeModes);
        }
        
        return this.layoutService.updateLayout(data.nodes, data.links || [], skipAnimation);
    }

    public updatePreviewMode(isPreview: boolean): void {
        this.layoutService.updatePreviewMode(isPreview);
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        this.definitionNodeModes = new Map(modes);
        this.layoutService.updateDefinitionModes(modes);
    }

    public resize(width: number, height: number): void {
        this.layoutService.resize(width, height);
    }

    public stop(): void {
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
            // Layout service will be recreated on next updateLayout call
        }
    }
}