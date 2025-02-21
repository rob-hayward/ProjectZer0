// src/lib/services/graph/simulation/layouts/BaseLayoutStrategy.ts
import * as d3 from 'd3';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../../constants/graph';

export interface LinkPath {
    path: string;
    sourcePoint: { x: number; y: number };
    targetPoint: { x: number; y: number };
}

export abstract class BaseLayoutStrategy {
    protected simulation: d3.Simulation<LayoutNode, LayoutLink>;
    protected width: number;
    protected height: number;
    protected viewType: ViewType;
    protected linkPaths: Map<string, LinkPath>;
    protected strategyId: string;

    constructor(width: number, height: number, viewType: ViewType) {
        this.strategyId = Math.random().toString(36).substr(2, 9);
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Init] Constructor`, {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });

        this.width = COORDINATE_SPACE.WORLD.WIDTH;
        this.height = COORDINATE_SPACE.WORLD.HEIGHT;
        this.viewType = viewType;
        this.linkPaths = new Map();
        this.simulation = this.initializeBaseSimulation();
    }

    protected initializeBaseSimulation(): d3.Simulation<LayoutNode, LayoutLink> {
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Init] Creating simulation`);

        const simulation = d3.forceSimulation<LayoutNode>()
            .velocityDecay(COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY)
            .alphaDecay(COORDINATE_SPACE.ANIMATION.ALPHA_DECAY)
            .alphaMin(COORDINATE_SPACE.ANIMATION.ALPHA_MIN);

        simulation.on('tick', () => {
            if (simulation.alpha() < 0.3) {
                console.debug(`[BASE-STRATEGY:${this.strategyId}:Simulation] Tick`, {
                    alpha: simulation.alpha(),
                    nodePositions: simulation.nodes()
                        .filter(n => n.metadata.fixed)
                        .map(n => ({
                            id: n.id,
                            type: n.type,
                            position: { x: n.x ?? 0, y: n.y ?? 0 },
                            fixed: { fx: n.fx, fy: n.fy }
                        }))
                });
            }
            this.updateLinkPaths();
        });

        return simulation;
    }

    protected getLinkId(link: LayoutLink): string {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return `${sourceId}-${targetId}`;
    }

    protected calculateLinkPath(link: LayoutLink): LinkPath {
        const source = typeof link.source === 'object' ? link.source : 
            this.simulation.nodes().find(n => n.id === link.source);
        const target = typeof link.target === 'object' ? link.target :
            this.simulation.nodes().find(n => n.id === link.target);

        if (!source || !target) {
            console.warn(`[BASE-STRATEGY:${this.strategyId}:Link] Missing node reference`, {
                sourceId: typeof link.source === 'string' ? link.source : link.source.id,
                targetId: typeof link.target === 'string' ? link.target : link.target.id
            });
            return {
                path: '',
                sourcePoint: { x: 0, y: 0 },
                targetPoint: { x: 0, y: 0 }
            };
        }

        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;

        return {
            path: `M${sourceX},${sourceY}L${targetX},${targetY}`,
            sourcePoint: { x: sourceX, y: sourceY },
            targetPoint: { x: targetX, y: targetY }
        };
    }

    protected updateLinkPaths(): void {
        const links = (this.simulation.force('link') as d3.ForceLink<LayoutNode, LayoutLink>)?.links() || [];
        links.forEach(link => {
            const linkId = this.getLinkId(link);
            this.linkPaths.set(linkId, this.calculateLinkPath(link));
        });
    }

    abstract initializeNodePositions(nodes: LayoutNode[]): void;
    abstract configureForces(): void;

    public updateData(nodes: LayoutNode[], links: LayoutLink[], skipAnimation: boolean = false): void {
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Update] Updating data`, {
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
        }

        // Initial link path calculation
        links.forEach(link => {
            const linkId = this.getLinkId(link);
            this.linkPaths.set(linkId, this.calculateLinkPath(link));
        });

        this.simulation
            .alpha(skipAnimation ? 0 : FORCE_SIMULATION.SIMULATION.BASE.ALPHA_VALUES.START)
            .restart();
    }

    public getLinkPath(sourceId: string, targetId: string): LinkPath | undefined {
        return this.linkPaths.get(`${sourceId}-${targetId}`);
    }

    public stop(): void {
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Lifecycle] Stopping`);
        this.simulation.stop();
    }

    public getSimulation(): d3.Simulation<LayoutNode, LayoutLink> {
        return this.simulation;
    }

    public updateDimensions(width: number, height: number): void {
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Lifecycle] Updating dimensions`, {
            from: { width: this.width, height: this.height },
            to: { width: COORDINATE_SPACE.WORLD.WIDTH, height: COORDINATE_SPACE.WORLD.HEIGHT }
        });

        this.width = COORDINATE_SPACE.WORLD.WIDTH;
        this.height = COORDINATE_SPACE.WORLD.HEIGHT;
        this.simulation.alpha(FORCE_SIMULATION.SIMULATION.BASE.ALPHA_VALUES.RESTART).restart();
    }

    public reheat(): void {
        console.debug(`[BASE-STRATEGY:${this.strategyId}:Lifecycle] Reheating simulation`);
        this.simulation.alpha(FORCE_SIMULATION.SIMULATION.BASE.ALPHA_VALUES.RESTART).restart();
    }
}