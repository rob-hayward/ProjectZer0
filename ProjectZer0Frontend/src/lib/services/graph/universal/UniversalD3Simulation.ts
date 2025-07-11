// src/lib/services/graph/universal/UniversalD3Simulation.ts
// D3 force simulation management for Universal Graph

import * as d3 from 'd3';
import type { EnhancedNode, EnhancedLink } from '$lib/types/graph/enhanced';
import { asD3Nodes, asD3Links } from '$lib/types/graph/enhanced';
import { UNIVERSAL_FORCES } from './UniversalForceConfig';
import { UNIVERSAL_LAYOUT } from './UniversalConstants';

export interface SimulationCallbacks {
    onTick: (nodes: EnhancedNode[]) => void;
    onEnd: () => void;
    onSettlementTick?: (nodes: EnhancedNode[], tickCount: number) => void;
}

/**
 * Manages D3 force simulation for Universal Graph
 */
export class UniversalD3Simulation {
    private simulation: d3.Simulation<any, any>;
    private isInSettlementPhase = false;
    private settlementTickCounter = 0;
    private lastDOMUpdateTime = 0;
    private callbacks: SimulationCallbacks;
    
    constructor(callbacks: SimulationCallbacks) {
        this.callbacks = callbacks;
        this.simulation = this.initializeSimulation();
    }
    
    /**
     * Initialize D3 simulation with base parameters
     */
    private initializeSimulation(): d3.Simulation<any, any> {
        const simulation = d3.forceSimulation()
            .velocityDecay(UNIVERSAL_FORCES.SIMULATION.VELOCITY_DECAY)
            .alphaDecay(UNIVERSAL_FORCES.SIMULATION.ALPHA_DECAY)
            .alphaMin(UNIVERSAL_FORCES.SIMULATION.ALPHA_MIN)
            .alphaTarget(UNIVERSAL_FORCES.SIMULATION.ALPHA_TARGET);

        let tickCount = 0;
        
        simulation.on('tick', () => {
            tickCount++;
            const nodes = simulation.nodes() as unknown as EnhancedNode[];
            
            // Enforce fixed positions for system nodes
            this.enforceFixedPositions(nodes);
            
            // Handle settlement phase updates
            if (this.isInSettlementPhase) {
                this.handleSettlementTick(nodes);
            } else {
                // Normal tick during drop phase
                if (tickCount % 100 === 0) {
                    console.log(`[D3Simulation] Drop phase - Tick #${tickCount}, alpha: ${simulation.alpha().toFixed(4)}`);
                }
                this.callbacks.onTick(nodes);
            }
        });

        simulation.on('end', () => {
            if (this.isInSettlementPhase) {
                this.handleSettlementEnd();
                // Don't call onEnd callback here - settlement end handles it
            } else {
                console.log('[D3Simulation] Drop phase complete');
                this.callbacks.onEnd();
            }
        });
        
        return simulation;
    }
    
    /**
     * Handle tick during settlement phase
     */
    private handleSettlementTick(nodes: EnhancedNode[]): void {
        this.settlementTickCounter++;
        
        // Logging at intervals
        if (this.settlementTickCounter % UNIVERSAL_LAYOUT.SETTLEMENT.TICK_LOG_INTERVAL === 0) {
            this.logSettlementProgress(nodes);
        }
        
        // Update callbacks
        this.callbacks.onTick(nodes);
        
        if (this.callbacks.onSettlementTick) {
            this.callbacks.onSettlementTick(nodes, this.settlementTickCounter);
        }
        
        // Check if settled
        if (this.settlementTickCounter > UNIVERSAL_LAYOUT.SETTLEMENT.MAX_SETTLEMENT_TICKS) {
            this.checkIfSettled(nodes);
        }
    }
    
    /**
     * Check if nodes have settled
     */
    private checkIfSettled(nodes: EnhancedNode[]): void {
        const contentNodes = nodes.filter(n => 
            n.type === 'statement' || n.type === 'openquestion'
        );
        
        const totalMovement = contentNodes.reduce((sum, n) => {
            return sum + Math.abs(n.vx ?? 0) + Math.abs(n.vy ?? 0);
        }, 0);
        
        const avgMovement = totalMovement / (contentNodes.length || 1);
        const movingNodes = contentNodes.filter(n => 
            Math.abs(n.vx ?? 0) > UNIVERSAL_LAYOUT.SETTLEMENT.STUCK_VELOCITY_THRESHOLD || 
            Math.abs(n.vy ?? 0) > UNIVERSAL_LAYOUT.SETTLEMENT.STUCK_VELOCITY_THRESHOLD
        );
        const movingRatio = movingNodes.length / (contentNodes.length || 1);
        
        console.log(`[D3Simulation] Settlement check at tick ${this.settlementTickCounter}:`, {
            avgVelocity: avgMovement.toFixed(3),
            movingNodes: movingNodes.length,
            totalNodes: contentNodes.length,
            movingRatio: movingRatio.toFixed(2),
            alpha: this.simulation.alpha().toFixed(4)
        });
        
        if (avgMovement < UNIVERSAL_LAYOUT.SETTLEMENT.MIN_MOVEMENT_THRESHOLD && 
            this.simulation.alpha() < UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA_THRESHOLD) {
            
            console.log(`[D3Simulation] Nodes settled! Avg velocity: ${avgMovement.toFixed(3)}, Moving ratio: ${movingRatio.toFixed(2)}`);
            
            // Mark settlement as complete
            this.isInSettlementPhase = false;
            this.settlementTickCounter = 0;
            
            // Instead of stopping, put simulation to sleep
            this.sleepSimulation();
            
            // Notify callbacks that we're done settling
            this.callbacks.onEnd();
        }
    }
    
    /**
     * Log settlement progress
     */
    private logSettlementProgress(nodes: EnhancedNode[]): void {
        const contentNodes = nodes.filter(n => 
            n.type === 'statement' || n.type === 'openquestion'
        );
        
        const movingNodes = contentNodes.filter(n => 
            Math.abs(n.vx ?? 0) > UNIVERSAL_LAYOUT.SETTLEMENT.STUCK_VELOCITY_THRESHOLD || 
            Math.abs(n.vy ?? 0) > UNIVERSAL_LAYOUT.SETTLEMENT.STUCK_VELOCITY_THRESHOLD
        );
        
        const avgVelocity = movingNodes.reduce((sum, n) => {
            const v = Math.sqrt((n.vx ?? 0) ** 2 + (n.vy ?? 0) ** 2);
            return sum + v;
        }, 0) / (movingNodes.length || 1);
        
        console.log(`[D3Simulation] Settlement tick ${this.settlementTickCounter}:`, {
            alpha: this.simulation.alpha().toFixed(4),
            movingNodes: `${movingNodes.length}/${contentNodes.length}`,
            avgVelocity: avgVelocity.toFixed(2),
            forces: this.getActiveForces()
        });
    }
    
    /**
     * Handle settlement phase end
     */
    private handleSettlementEnd(): void {
        console.log(`[D3Simulation] Settlement phase ended after ${this.settlementTickCounter} ticks`);
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const contentNodes = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion');
        
        const distances = contentNodes.map(n => Math.sqrt((n.x ?? 0) ** 2 + (n.y ?? 0) ** 2));
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        
        console.log('[D3Simulation] Final statistics:', {
            nodes: contentNodes.length,
            avgDistance: avgDist.toFixed(1),
            finalAlpha: this.simulation.alpha()
        });
        
        this.isInSettlementPhase = false;
        this.settlementTickCounter = 0;
        
        // Call onEnd callback here since we handled the settlement
        this.callbacks.onEnd();
    }
    
    /**
     * Enforce fixed positions for system nodes
     */
    private enforceFixedPositions(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.fixed || node.group === 'central') {
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                node.vx = 0;
                node.vy = 0;
            } else if (node.type === 'navigation') {
                if (node.fx !== null && node.fx !== undefined) {
                    node.x = node.fx;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.y = node.fy;
                }
                node.vx = 0;
                node.vy = 0;
            }
        });
    }
    
    /**
     * Configure forces for drop phase
     */
    public configureDropPhaseForces(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        this.simulation.nodes(asD3Nodes(nodes));
        
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }

        // Minimal forces during drop phase
        this.simulation.force('collision', d3.forceCollide()
            .radius((d: any) => (d as EnhancedNode).radius + UNIVERSAL_LAYOUT.NODE_SIZING.COLLISION_PADDING.DROP_PHASE)
            .strength(UNIVERSAL_FORCES.DROP_PHASE.COLLISION.STRENGTH)
            .iterations(UNIVERSAL_FORCES.DROP_PHASE.COLLISION.ITERATIONS)
        );

        this.simulation.force('charge', d3.forceManyBody()
            .strength(UNIVERSAL_FORCES.DROP_PHASE.CHARGE.STRENGTH)
            .distanceMin(UNIVERSAL_FORCES.DROP_PHASE.CHARGE.DISTANCE_MIN)
            .distanceMax(UNIVERSAL_FORCES.DROP_PHASE.CHARGE.DISTANCE_MAX)
            .theta(UNIVERSAL_FORCES.DROP_PHASE.CHARGE.THETA)
        );

        this.simulation.force('centerX', d3.forceX(0).strength(UNIVERSAL_FORCES.DROP_PHASE.CENTER.X_STRENGTH));
        this.simulation.force('centerY', d3.forceY(0).strength(UNIVERSAL_FORCES.DROP_PHASE.CENTER.Y_STRENGTH));

        // Apply drop phase simulation parameters
        this.simulation
            .velocityDecay(UNIVERSAL_FORCES.SIMULATION.DROP_PHASE.VELOCITY_DECAY)
            .alphaDecay(UNIVERSAL_FORCES.SIMULATION.DROP_PHASE.ALPHA_DECAY)
            .alphaMin(UNIVERSAL_FORCES.SIMULATION.DROP_PHASE.ALPHA_MIN);
    }
    
    /**
     * Configure forces for settlement phase
     */
    public configureSettlementPhaseForces(): void {
        // Clear ALL forces first
        this.clearAllForces();
        
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // 1. Moderate charge force for natural repulsion
        this.simulation.force('charge', d3.forceManyBody()
            .strength(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CHARGE.STRENGTH)
            .distanceMin(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CHARGE.DISTANCE_MIN)
            .distanceMax(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CHARGE.DISTANCE_MAX)
            .theta(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CHARGE.THETA)
        );
        
        // 2. Collision force with reasonable radius
        this.simulation.force('collision', d3.forceCollide()
            .radius((d: any) => {
                const node = d as EnhancedNode;
                return node.radius + UNIVERSAL_LAYOUT.NODE_SIZING.COLLISION_PADDING.SETTLEMENT_PHASE;
            })
            .strength(UNIVERSAL_FORCES.SETTLEMENT_PHASE.COLLISION.STRENGTH)
            .iterations(UNIVERSAL_FORCES.SETTLEMENT_PHASE.COLLISION.ITERATIONS)
        );
        
        // 3. Gentle center force to prevent explosion
        this.simulation.force('centerX', d3.forceX(0).strength(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CENTER.X_STRENGTH));
        this.simulation.force('centerY', d3.forceY(0).strength(UNIVERSAL_FORCES.SETTLEMENT_PHASE.CENTER.Y_STRENGTH));
        
        // 4. Soft radial constraint based on votes
        this.simulation.force('softRadial', this.createSoftRadialForce());
        
        // 5. Angular spreading force
        this.simulation.force('angular', this.createAngularSpreadingForce());
        
        // Apply settlement phase parameters
        this.simulation
            .velocityDecay(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.VELOCITY_DECAY)
            .alphaDecay(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA_DECAY)
            .alphaMin(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA_MIN);
    }
    
    /**
     * Create soft radial force based on votes
     */
    private createSoftRadialForce() {
        return (alpha: number) => {
            const nodes = this.simulation.nodes() as EnhancedNode[];
            
            nodes.forEach(node => {
                if (node.type === 'statement' || node.type === 'openquestion') {
                    const targetDistance = (node as any).voteBasedDistance || 400;
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const currentDistance = Math.sqrt(x * x + y * y);
                    
                    if (currentDistance > 0) {
                        const distanceDiff = targetDistance - currentDistance;
                        const force = distanceDiff * UNIVERSAL_FORCES.SETTLEMENT_PHASE.SOFT_RADIAL.STRENGTH_MULTIPLIER * alpha;
                        
                        const fx = (x / currentDistance) * force;
                        const fy = (y / currentDistance) * force;
                        
                        if (node.vx !== null && node.vx !== undefined) node.vx += fx;
                        if (node.vy !== null && node.vy !== undefined) node.vy += fy;
                    }
                }
            });
        };
    }
    
    /**
     * Create angular spreading force to break spiral pattern
     */
    private createAngularSpreadingForce() {
        return (alpha: number) => {
            const nodes = this.simulation.nodes() as EnhancedNode[];
            const angleMap = new Map<number, EnhancedNode[]>();
            
            // Group nodes by similar angles
            nodes.forEach(node => {
                if (node.type === 'statement' || node.type === 'openquestion') {
                    const angle = Math.atan2(node.y ?? 0, node.x ?? 0);
                    const angleKey = Math.round(angle * UNIVERSAL_FORCES.SETTLEMENT_PHASE.ANGULAR_SPREADING.ANGLE_BUCKETS) / 
                                   UNIVERSAL_FORCES.SETTLEMENT_PHASE.ANGULAR_SPREADING.ANGLE_BUCKETS;
                    
                    if (!angleMap.has(angleKey)) {
                        angleMap.set(angleKey, []);
                    }
                    angleMap.get(angleKey)!.push(node);
                }
            });
            
            // Apply gentle repulsion between nodes at similar angles
            angleMap.forEach(nodesAtAngle => {
                if (nodesAtAngle.length > 1) {
                    for (let i = 0; i < nodesAtAngle.length; i++) {
                        for (let j = i + 1; j < nodesAtAngle.length; j++) {
                            const nodeA = nodesAtAngle[i];
                            const nodeB = nodesAtAngle[j];
                            
                            const dx = (nodeB.x ?? 0) - (nodeA.x ?? 0);
                            const dy = (nodeB.y ?? 0) - (nodeA.y ?? 0);
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance > 0 && distance < UNIVERSAL_FORCES.SETTLEMENT_PHASE.ANGULAR_SPREADING.REPULSION_DISTANCE) {
                                const force = (UNIVERSAL_FORCES.SETTLEMENT_PHASE.ANGULAR_SPREADING.REPULSION_DISTANCE - distance) * 
                                            UNIVERSAL_FORCES.SETTLEMENT_PHASE.ANGULAR_SPREADING.FORCE_MULTIPLIER * alpha;
                                const fx = (dx / distance) * force;
                                const fy = (dy / distance) * force;
                                
                                if (nodeA.vx !== null && nodeA.vx !== undefined) nodeA.vx -= fx;
                                if (nodeA.vy !== null && nodeA.vy !== undefined) nodeA.vy -= fy;
                                if (nodeB.vx !== null && nodeB.vx !== undefined) nodeB.vx += fx;
                                if (nodeB.vy !== null && nodeB.vy !== undefined) nodeB.vy += fy;
                            }
                        }
                    }
                }
            });
        };
    }
    
    /**
     * Start settlement phase
     */
    public startSettlementPhase(): void {
        console.log('[D3Simulation] 🚀 SETTLEMENT PHASE STARTING');
        this.isInSettlementPhase = true;
        this.settlementTickCounter = 0;
        
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Unpin ALL content nodes
        nodes.forEach(node => {
            if (node.type === 'statement' || node.type === 'openquestion') {
                node.fx = null;
                node.fy = null;
                
                // Small initial velocity
                const angle = Math.atan2(node.y ?? 0, node.x ?? 0) + 
                            (Math.random() - 0.5) * UNIVERSAL_FORCES.INITIAL_VELOCITY.ANGLE_VARIATION;
                const speed = UNIVERSAL_FORCES.INITIAL_VELOCITY.SETTLEMENT_SPEED;
                node.vx = Math.cos(angle) * speed;
                node.vy = Math.sin(angle) * speed;
            }
        });
        
        // Configure natural forces
        this.configureSettlementPhaseForces();
        
        // Restart with settlement parameters
        this.simulation
            .alpha(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA)
            .alphaDecay(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA_DECAY)
            .alphaMin(UNIVERSAL_FORCES.SIMULATION.SETTLEMENT_PHASE.ALPHA_MIN)
            .alphaTarget(UNIVERSAL_FORCES.SIMULATION.ALPHA_TARGET)
            .restart();
    }
    
    /**
     * Update nodes in simulation
     */
    public updateNodes(nodes: EnhancedNode[]): void {
        this.simulation.nodes(asD3Nodes(nodes));
    }
    
    /**
     * Update links in simulation
     */
    public updateLinks(links: EnhancedLink[]): void {
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }
    }
    
    /**
     * Start/restart simulation
     */
    public start(alpha: number = 1.0): void {
        this.simulation.alpha(alpha).restart();
    }
    
    /**
     * Put simulation to sleep (keep alive but dormant)
     */
    public sleepSimulation(): void {
        console.log('[D3Simulation] Putting simulation to sleep');
        
        // Get final positions
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Set simulation to dormant state
        this.simulation
            .alphaTarget(0)      // Target alpha of 0
            .alpha(0.001)        // Very low alpha (not zero)
            .velocityDecay(0.8); // High decay to minimize drift
        
        // Clear velocities but keep positions flexible
        nodes.forEach((node: any) => {
            node.vx = 0;
            node.vy = 0;
            // Do NOT set fx/fy unless node is truly fixed
            // This allows nodes to respond to future changes
        });
        
        console.log('[D3Simulation] Simulation sleeping, ready for interactions');
    }
    
    /**
     * Wake simulation for interaction
     */
    public wakeSimulation(energy: number = 0.3): void {
        console.log(`[D3Simulation] Waking simulation with energy: ${energy}`);
        
        // Reset velocity decay for active movement
        this.simulation
            .velocityDecay(UNIVERSAL_FORCES.SIMULATION.VELOCITY_DECAY)
            .alpha(energy)
            .alphaTarget(0)
            .restart();
    }
    
    /**
     * Stop simulation
     */
    public stopSimulation(): void {
        console.log('[D3Simulation] stopSimulation called');
        console.trace('[D3Simulation] Called from:');
        
        // Get final positions before stopping
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Log sample positions BEFORE stopping
        const beforeSample = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion').slice(0, 3);
        console.log('[D3Simulation] Positions BEFORE stop:', 
            beforeSample.map(n => ({
                id: n.id.substring(0, 8),
                x: n.x?.toFixed(1),
                y: n.y?.toFixed(1),
                fx: n.fx,
                fy: n.fy
            }))
        );
        
        // For truly stopping (only when destroying the graph)
        // Preserve positions with fx/fy
        nodes.forEach((node: any) => {
            if (node.x !== undefined && node.y !== undefined) {
                node.fx = node.x;
                node.fy = node.y;
            }
            node.vx = 0;
            node.vy = 0;
        });
        
        // Now stop the simulation
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        this.isInSettlementPhase = false;
        this.settlementTickCounter = 0;
        
        // Log sample positions AFTER stopping
        const afterSample = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion').slice(0, 3);
        console.log('[D3Simulation] Positions AFTER stop:', 
            afterSample.map(n => ({
                id: n.id.substring(0, 8),
                x: n.x?.toFixed(1),
                y: n.y?.toFixed(1),
                fx: n.fx?.toFixed(1),
                fy: n.fy?.toFixed(1)
            }))
        );
        
        console.log('[D3Simulation] Simulation stopped, positions preserved');
    }
    
    /**
     * Force simulation to tick
     */
    public forceTick(ticks: number = 1): void {
        this.simulation.alpha(0).alphaTarget(0);
        
        for (let i = 0; i < ticks; i++) {
            this.simulation.tick();
        }
    }
    
    /**
     * Get simulation instance
     */
    public getSimulation(): d3.Simulation<any, any> {
        return this.simulation;
    }
    
    /**
     * Get active forces
     */
    private getActiveForces(): string[] {
        const forces: string[] = [];
        const forceNames = ['charge', 'collision', 'softRadial', 'angular', 'link', 'centerX', 'centerY'];
        forceNames.forEach(name => {
            if (this.simulation.force(name)) {
                forces.push(name);
            }
        });
        return forces;
    }
    
    /**
     * Clear all forces
     */
    private clearAllForces(): void {
        const forceNames = ['radial', 'voteRadial', 'centerX', 'centerY', 'link', 'charge', 'collision', 'softRadial', 'angular'];
        forceNames.forEach(name => {
            this.simulation.force(name, null);
        });
    }
    
    /**
     * Check if in settlement phase
     */
    public isSettling(): boolean {
        return this.isInSettlementPhase;
    }
    
    /**
     * Get settlement tick count
     */
    public getSettlementTickCount(): number {
        return this.settlementTickCounter;
    }
}