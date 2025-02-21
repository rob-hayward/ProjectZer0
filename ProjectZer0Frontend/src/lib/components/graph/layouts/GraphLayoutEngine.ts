// src/lib/components/graph/layouts/GraphLayoutEngine.ts
import type { GraphNode, GraphLink, GraphData, NodePosition, ViewType } from '../../../types/graph/core';
import type { LayoutConfig } from '../../../types/graph/layout';
import { LayoutService } from '../../../services/graph/layout/LayoutService';
import { COORDINATE_SPACE } from '../../../constants/graph';

export class GraphLayoutEngine {
    private layoutService: LayoutService;
    private definitionNodeModes: Map<string, 'preview' | 'detail'>;
    private _viewType: ViewType;
    private _width: number;
    private _height: number;
    private currentPositions: Map<string, NodePosition>;
    private previousData: {
        nodes: GraphNode[];
        links: GraphLink[];
    } | null = null;
    private engineId: string;

    constructor(width: number, height: number, viewType: ViewType, isPreviewMode = false) {
        this.engineId = Math.random().toString(36).substr(2, 9);
        console.debug(`[ENGINE:${this.engineId}:Init] Creating layout engine`, { 
            worldWidth: COORDINATE_SPACE.WORLD.WIDTH, 
            worldHeight: COORDINATE_SPACE.WORLD.HEIGHT, 
            viewType, 
            isPreviewMode
        });

        this._width = COORDINATE_SPACE.WORLD.WIDTH;
        this._height = COORDINATE_SPACE.WORLD.HEIGHT;
        this._viewType = viewType;
        this.currentPositions = new Map();
        this.definitionNodeModes = new Map();
        
        const config: LayoutConfig = {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType,
            isPreviewMode
        };
        
        this.layoutService = new LayoutService(config);
    }

    private getNodeId(node: string | GraphNode): string {
        return typeof node === 'string' ? node : node.id;
    }

    private hasSignificantChanges(newData: GraphData): boolean {
        if (!this.previousData) {
            console.debug(`[ENGINE:${this.engineId}:Changes] No previous data, forcing update`);
            return true;
        }

        // Check for word node state change
        const wordNodeChanged = this.hasWordNodeStateChanged(newData);
        if (wordNodeChanged) {
            console.debug(`[ENGINE:${this.engineId}:Changes] Word node state changed, forcing update`);
            return true;
        }

        const nodesChanged = !this.areNodesEqual(this.previousData.nodes, newData.nodes);
        const linksChanged = !this.areLinksEqual(this.previousData.links, newData.links || []);

        console.debug(`[ENGINE:${this.engineId}:Changes] Change detection result`, {
            nodesChanged,
            linksChanged,
            currentPositions: this.currentPositions.size
        });

        return nodesChanged || linksChanged || !this.currentPositions.size;
    }

    private hasWordNodeStateChanged(newData: GraphData): boolean {
        if (!this.previousData) return false;
        
        const prevWordNode = this.previousData.nodes.find(n => n.type === 'word');
        const currWordNode = newData.nodes.find(n => n.type === 'word');
        
        if (!prevWordNode || !currWordNode) return false;
        
        if (prevWordNode.mode !== currWordNode.mode) {
            console.debug(`[ENGINE:${this.engineId}:Changes] Word node mode changed`, {
                from: prevWordNode.mode,
                to: currWordNode.mode
            });
            return true;
        }
        
        return false;
    }

    private areNodesEqual(prev: GraphNode[], curr: GraphNode[]): boolean {
        if (prev.length !== curr.length) {
            return false;
        }
        
        for (let i = 0; i < prev.length; i++) {
            if (prev[i].id !== curr[i].id || 
                prev[i].type !== curr[i].type || 
                prev[i].group !== curr[i].group ||
                prev[i].mode !== curr[i].mode) {
                return false;
            }
        }

        return true;
    }

    private areLinksEqual(prev: GraphLink[], curr: GraphLink[]): boolean {
        if (prev.length !== curr.length) {
            return false;
        }
        
        for (let i = 0; i < prev.length; i++) {
            const prevSource = this.getNodeId(prev[i].source);
            const prevTarget = this.getNodeId(prev[i].target);
            const currSource = this.getNodeId(curr[i].source);
            const currTarget = this.getNodeId(curr[i].target);
            
            if (prevSource !== currSource || 
                prevTarget !== currTarget || 
                prev[i].type !== curr[i].type) {
                return false;
            }
        }

        return true;
    }

    public updateLayout(data: GraphData, skipAnimation: boolean = false): Map<string, NodePosition> {
        console.debug(`[ENGINE:${this.engineId}:Update] Starting layout update`, {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length || 0,
            viewType: this._viewType,
            hasCurrentPositions: this.currentPositions.size > 0
        });

        // Check if view type requires service recreation
        if (this._viewType !== this.layoutService.viewType) {
            console.debug(`[ENGINE:${this.engineId}:Update] View type changed`, {
                from: this.layoutService.viewType,
                to: this._viewType
            });
            this.recreateLayoutService();
            // Force update after service recreation
            this.previousData = null;
            this.currentPositions.clear();
        }

        // Check for word node change - force update if detected
        const wordNodeChanged = this.hasWordNodeStateChanged(data);
        if (wordNodeChanged) {
            skipAnimation = false;
        }

        // Check for significant changes or no current positions
        if (!this.currentPositions.size || this.hasSignificantChanges(data)) {
            console.debug(`[ENGINE:${this.engineId}:Update] Updating positions`, {
                wordNodeChanged,
                skipAnimation
            });
            
            this.currentPositions = this.layoutService.updateLayout(
                data.nodes,
                data.links || [],
                skipAnimation
            );

            // Store current data for future comparison
            this.previousData = {
                nodes: [...data.nodes],
                links: [...(data.links || [])]
            };

            // Debug central node position
            const centralNode = data.nodes.find(n => n.group === 'central');
            if (centralNode) {
                const pos = this.currentPositions.get(centralNode.id);
                console.debug(`[ENGINE:${this.engineId}:Update] Central node position`, {
                    nodeId: centralNode.id,
                    position: pos
                });
            }
        }

        return this.currentPositions;
    }

    public updatePreviewMode(isPreview: boolean): void {
        console.debug(`[ENGINE:${this.engineId}:Mode] Preview mode update`, { 
            isPreview,
            currentModes: Array.from(this.definitionNodeModes.entries())
        });
        
        // Reset state to force update
        this.previousData = null;
        this.currentPositions.clear();
        this.layoutService.updatePreviewMode(isPreview);
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        console.debug(`[ENGINE:${this.engineId}:Mode] Definition modes update`, { 
            modeCount: modes.size,
            modes: Array.from(modes.entries())
        });
        
        // Reset state to force update
        this.previousData = null;
        this.currentPositions.clear();
        this.definitionNodeModes = new Map(modes);
        this.layoutService.updateDefinitionModes(modes);
    }

    public resize(width: number, height: number): void {
        this._width = COORDINATE_SPACE.WORLD.WIDTH;
        this._height = COORDINATE_SPACE.WORLD.HEIGHT;
        this.layoutService.resize(this._width, this._height);
    }

    public stop(): void {
        console.debug(`[ENGINE:${this.engineId}:Stop] Stopping engine`);
        this.layoutService.stop();
    }

    public getSimulation() {
        return this.layoutService.getSimulation();
    }

    public updateViewType(viewType: ViewType): void {
        console.debug(`[ENGINE:${this.engineId}:ViewType] View type update`, {
            from: this._viewType,
            to: viewType
        });
        
        if (this._viewType !== viewType) {
            this._viewType = viewType;
            // Immediately recreate service when view type changes
            this.recreateLayoutService();
        }
    }

    private recreateLayoutService(): void {
        console.debug(`[ENGINE:${this.engineId}:Service] Recreating layout service`);
        
        // Stop current service
        this.layoutService.stop();
        
        // Create new service with world dimensions
        const config: LayoutConfig = {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType: this._viewType,
            isPreviewMode: false
        };
        
        // Initialize new service
        this.layoutService = new LayoutService(config);
        
        // Reset state
        this.previousData = null;
        this.currentPositions.clear();
        
        // Reapply definition modes
        this.layoutService.updateDefinitionModes(this.definitionNodeModes);
    }
}