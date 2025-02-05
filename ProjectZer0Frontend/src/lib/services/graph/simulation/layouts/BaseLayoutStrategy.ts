// src/lib/services/graph/simulation/layouts/BaseLayoutStrategy.ts
import * as d3 from 'd3';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { SIMULATION, DIMENSIONS } from '../../../../constants/graph';

export interface EdgePath {
    path: string;
    sourcePoint: { x: number; y: number };
    targetPoint: { x: number; y: number };
}

export abstract class BaseLayoutStrategy {
    protected simulation: d3.Simulation<LayoutNode, LayoutLink>;
    protected width: number;
    protected height: number;
    protected viewType: ViewType;
    protected edgePaths: Map<string, EdgePath>;

    constructor(width: number, height: number, viewType: ViewType) {
        console.log('BaseLayoutStrategy constructor:', { width, height, viewType });
        this.width = width;
        this.height = height;
        this.viewType = viewType;
        this.edgePaths = new Map();
        this.simulation = this.initializeBaseSimulation();
    }

    protected initializeBaseSimulation(): d3.Simulation<LayoutNode, LayoutLink> {
        return d3.forceSimulation<LayoutNode>()
            .velocityDecay(SIMULATION.BASE.VELOCITY_DECAY)
            .alphaDecay(SIMULATION.BASE.ALPHA_DECAY)
            .alphaMin(SIMULATION.BASE.ALPHA_MIN);
    }

    protected getLinkId(link: LayoutLink): string {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return `${sourceId}-${targetId}`;
    }

    protected calculateEdgePath(link: LayoutLink): EdgePath {
        const source = link.source as LayoutNode;
        const target = link.target as LayoutNode;

        if (!source.x || !source.y || !target.x || !target.y) {
            return {
                path: '',
                sourcePoint: { x: 0, y: 0 },
                targetPoint: { x: 0, y: 0 }
            };
        }

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            return {
                path: '',
                sourcePoint: { x: source.x, y: source.y },
                targetPoint: { x: target.x, y: target.y }
            };
        }

        const unitX = dx / distance;
        const unitY = dy / distance;

        const sourcePoint = {
            x: source.x + (unitX * 0),
            y: source.y + (unitY * 0)
        };
        const targetPoint = {
            x: target.x - (unitX * 0),
            y: target.y - (unitY * 0)
        };

        const path = `M${sourcePoint.x},${sourcePoint.y}L${targetPoint.x},${targetPoint.y}`;

        return { path, sourcePoint, targetPoint };
    }

    abstract initializeNodePositions(nodes: LayoutNode[]): void;
    abstract configureForces(): void;

    public updateData(nodes: LayoutNode[], links: LayoutLink[], skipAnimation: boolean = false): void {
        console.log('BaseLayoutStrategy updateData called:', {
            strategyType: this.constructor.name,
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        this.simulation.stop();
        this.simulation.nodes([]);
        
        ['link', 'charge', 'collision', 'radial'].forEach(forceName => {
            this.simulation.force(forceName, null);
        });

        this.initializeNodePositions(nodes);
        this.configureForces();
        this.simulation.nodes(nodes);

        const linkForce = this.simulation.force('link') as d3.ForceLink<LayoutNode, LayoutLink>;
        if (linkForce && links.length > 0) {
            linkForce.links(links);
            links.forEach(link => {
                const edgeId = this.getLinkId(link);
                this.edgePaths.set(edgeId, this.calculateEdgePath(link));
            });
        }

        this.simulation.on('tick', () => {
            links.forEach(link => {
                const edgeId = this.getLinkId(link);
                this.edgePaths.set(edgeId, this.calculateEdgePath(link));
            });
        });

        if (skipAnimation) {
            this.simulation.alpha(0);
        } else {
            this.simulation.alpha(SIMULATION.BASE.ALPHA_VALUES.START);
        }

        this.simulation.restart();
    }

    public getEdgePath(sourceId: string, targetId: string): EdgePath | undefined {
        return this.edgePaths.get(`${sourceId}-${targetId}`);
    }

    public stop(): void {
        this.simulation.stop();
    }

    public getSimulation(): d3.Simulation<LayoutNode, LayoutLink> {
        return this.simulation;
    }

    public updateDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.simulation.alpha(SIMULATION.BASE.ALPHA_VALUES.RESTART).restart();
    }

    public reheat(): void {
        this.simulation.alpha(SIMULATION.BASE.ALPHA_VALUES.RESTART).restart();
    }
}