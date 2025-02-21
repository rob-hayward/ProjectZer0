// src/lib/components/graph/backgrounds/SvgBackground.ts
import * as d3 from 'd3';
import type { BackgroundConfig } from '$lib/types/graph/background';
import { DEFAULT_BACKGROUND_CONFIG } from '$lib/types/graph/background';
import { COORDINATE_SPACE } from '$lib/constants/graph';

interface NetworkNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    connections: string[];
    styleIndex: number;
}

interface EdgeData {
    source: NetworkNode;
    target: NetworkNode;
}

export class SvgBackground {
    private nodes: NetworkNode[];
    private width: number;
    private height: number;
    private config: BackgroundConfig;
    private nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private edgesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private defs: d3.Selection<SVGDefsElement, unknown, null, undefined>;
    private gradientIds: string[] = [];
    private animationFrameId: number | null = null;

    constructor(
        container: SVGGElement,
        width: number,
        height: number,
        config: Partial<BackgroundConfig> = {}
    ) {
        this.config = { ...DEFAULT_BACKGROUND_CONFIG, ...config };
        const rootGroup = d3.select(container);

        // Use world dimensions
        this.width = COORDINATE_SPACE.WORLD.WIDTH;
        this.height = COORDINATE_SPACE.WORLD.HEIGHT;

        // Calculate center point
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        rootGroup
            .attr('viewBox', `${-halfWidth} ${-halfHeight} ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', this.config.viewport.preserveAspectRatio);

        this.defs = rootGroup.append('defs');
        this.edgesGroup = rootGroup.append('g').attr('class', 'edges');
        this.nodesGroup = rootGroup.append('g').attr('class', 'nodes');

        this.createGlowFilter();
        this.createGradients();
        this.nodes = this.createInitialNodes();
        this.initializeNodes();
    }

    private createGlowFilter(): void {
        const filter = this.defs.append('filter')
            .attr('id', 'nodeGlow')
            .attr('width', '300%')
            .attr('height', '300%')
            .attr('x', '-100%')
            .attr('y', '-100%');

        filter.append('feGaussianBlur')
            .attr('in', 'SourceGraphic')
            .attr('stdDeviation', '8')  // Increased blur for larger space
            .attr('result', 'blur');

        filter.append('feColorMatrix')
            .attr('in', 'blur')
            .attr('type', 'matrix')
            .attr('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7');
    }

    private createGradients(): void {
        this.gradientIds = this.config.nodeStyles.map((style, index) => {
            const gradientId = `edge-gradient-${index}`;
            const { r, g, b } = this.hexToRgb(style.mainColor);
            
            const gradient = this.defs.append('linearGradient')
                .attr('id', gradientId)
                .attr('gradientUnits', 'userSpaceOnUse');

            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', `rgba(${r}, ${g}, ${b}, ${this.config.edgeStyle.opacity})`);

            gradient.append('stop')
                .attr('offset', '50%')
                .attr('stop-color', `rgba(255, 255, 255, ${this.config.edgeStyle.opacity / 2})`);

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', `rgba(${r}, ${g}, ${b}, ${this.config.edgeStyle.opacity})`);

            return gradientId;
        });
    }

    private createInitialNodes(): NetworkNode[] {
        const spreadFactor = 0.9; // Use 90% of the space to keep nodes away from edges
        const scaledVelocity = this.config.animation.baseVelocity * (this.width / 20000); // Scale velocity to world size

        return Array.from({ length: this.config.nodeCount }, (_, i) => ({
            id: `node-${i}`,
            x: (Math.random() - 0.5) * this.width * spreadFactor,
            y: (Math.random() - 0.5) * this.height * spreadFactor,
            vx: (Math.random() - 0.5) * scaledVelocity,
            vy: (Math.random() - 0.5) * scaledVelocity,
            connections: this.generateConnections(i),
            styleIndex: Math.floor(Math.random() * this.config.nodeStyles.length)
        }));
    }

    private generateConnections(nodeIndex: number): string[] {
        const connectionCount = this.config.minConnections + 
            Math.floor(Math.random() * (this.config.maxConnections - this.config.minConnections + 1));
        
        const connections = new Set<string>();
        while (connections.size < connectionCount) {
            let targetIndex;
            do {
                targetIndex = Math.floor(Math.random() * this.config.nodeCount);
            } while (targetIndex === nodeIndex);
            connections.add(`node-${targetIndex}`);
        }
        
        return Array.from(connections);
    }

    private initializeNodes(): void {
        this.updateNodes();
        this.updateEdges();
    }

    private tick(): void {
        this.updateNodePositions();
        this.updateNodes();
        this.updateEdges();
        this.animationFrameId = requestAnimationFrame(() => this.tick());
    }

    private updateNodePositions(): void {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        const moveConfig = this.config.animation;
        const scaledDrift = moveConfig.driftForce * (this.width / 20000); // Scale drift to world size

        this.nodes.forEach(node => {
            // Add small random adjustments to velocity
            node.vx += (Math.random() - 0.5) * scaledDrift;
            node.vy += (Math.random() - 0.5) * scaledDrift;

            // Update position
            node.x += node.vx * moveConfig.velocityScale;
            node.y += node.vy * moveConfig.velocityScale;

            // Enforce maximum speed
            const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            if (speed > moveConfig.maxSpeed) {
                node.vx = (node.vx / speed) * moveConfig.maxSpeed;
                node.vy = (node.vy / speed) * moveConfig.maxSpeed;
            }

            // Smooth wrapping at boundaries with buffer
            const buffer = this.width * 0.05; // 5% buffer zone
            if (node.x < -halfWidth - buffer) node.x = halfWidth + buffer - 10;
            if (node.x > halfWidth + buffer) node.x = -halfWidth - buffer + 10;
            if (node.y < -halfHeight - buffer) node.y = halfHeight + buffer - 10;
            if (node.y > halfHeight + buffer) node.y = -halfHeight - buffer + 10;
        });
    }

    private updateEdges(): void {
        const edges = this.edgesGroup
            .selectAll<SVGPathElement, EdgeData>('path')
            .data(this.createEdgeData());

        edges.enter()
            .append('path')
            .merge(edges as any)
            .attr('d', (d: EdgeData) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`)
            .attr('stroke', (d: EdgeData) => `url(#${this.gradientIds[d.source.styleIndex]})`)
            .attr('stroke-width', this.config.edgeStyle.width)
            .attr('fill', 'none');

        edges.exit().remove();
    }

    private updateNodes(): void {
        const nodeSelection = this.nodesGroup
            .selectAll<SVGGElement, NetworkNode>('g.node')
            .data<NetworkNode>(this.nodes);

        const nodesEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'node');

        nodesEnter.append('circle')
            .attr('r', (d: NetworkNode) => this.config.nodeStyles[d.styleIndex].glowRadius)
            .attr('filter', 'url(#nodeGlow)');

        nodesEnter.append('circle')
            .attr('r', (d: NetworkNode) => this.config.nodeStyles[d.styleIndex].mainRadius);

        const allNodes = nodesEnter.merge(nodeSelection)
            .attr('transform', (d: NetworkNode) => `translate(${d.x},${d.y})`);

        allNodes.selectAll<SVGCircleElement, NetworkNode>('circle')
            .attr('fill', (d: NetworkNode) => {
                const style = this.config.nodeStyles[d.styleIndex];
                const { r, g, b } = this.hexToRgb(style.mainColor);
                return `rgba(${r}, ${g}, ${b}, ${style.glowOpacity})`;
            });

        nodeSelection.exit().remove();
    }

    private createEdgeData(): EdgeData[] {
        const edges: EdgeData[] = [];
        this.nodes.forEach(node => {
            node.connections.forEach(targetId => {
                const target = this.nodes.find(n => n.id === targetId);
                if (target) edges.push({ source: node, target });
            });
        });
        return edges;
    }

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    public resize(width: number, height: number): void {
        // Maintain world space dimensions
        this.width = COORDINATE_SPACE.WORLD.WIDTH;
        this.height = COORDINATE_SPACE.WORLD.HEIGHT;
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        const parentElement = this.nodesGroup.node()?.parentElement;
        if (parentElement) {
            d3.select(parentElement)
                .attr('viewBox', `${-halfWidth} ${-halfHeight} ${this.width} ${this.height}`);
        }
    }

    public start(): void {
        if (!this.animationFrameId) {
            this.tick();
        }
    }

    public stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public destroy(): void {
        this.stop();
        this.edgesGroup.remove();
        this.nodesGroup.remove();
        this.defs.remove();
    }
}