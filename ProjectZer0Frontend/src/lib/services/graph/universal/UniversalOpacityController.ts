// src/lib/services/graph/universal/UniversalOpacityController.ts
// CLEAN IMPLEMENTATION - Single Authority for Phantom Links

import type { EnhancedNode, EnhancedLink, RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';

export type OpacityState = 'hidden' | 'revealing' | 'revealed';
export type RevealPattern = 'center-out' | 'vote-ranking' | 'spiral-sequence';

interface OpacityConfig {
    revealDuration: number;
    revealPattern: RevealPattern;
    nodeRevealDelay: number;
}

interface RevealSequenceCallbacks {
    onNodeOpacityUpdate: (nodes: EnhancedNode[]) => void;
    onRevealComplete: () => void;
    onLinkRenderingEnabled: () => void; // CLEAN: Single callback for phantom links
}

/**
 * CLEAN ARCHITECTURE: Single authority for ALL opacity concerns
 * - Node opacity during construction phase
 * - Link rendering enablement (phantom links)
 * - Settlement-based timing coordination
 */
export class UniversalOpacityController {
    private config: OpacityConfig;
    private callbacks: RevealSequenceCallbacks;
    
    // State management
    private nodeOpacityState: OpacityState = 'hidden';
    private revealStartTime: number = 0;
    
    // CLEAN: Single source of truth for phantom links
    private linkRenderingEnabled = false;
    
    // Animation frame management
    private animationFrameId: number | null = null;
    
    constructor(callbacks: RevealSequenceCallbacks) {
        this.callbacks = callbacks;
        
        console.log('[OpacityController] CLEAN ARCHITECTURE - Single authority initialized');
        
        // Default configuration
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0
        };
    }
    
    /**
     * DEBUG: Enhanced getShouldRenderLinks with detailed logging
     */
    public getShouldRenderLinks(): boolean {
        const timestamp = new Date().toISOString().substr(14, 9); // Get milliseconds
        console.log(`[OpacityController] ${timestamp} getShouldRenderLinks() called, returning:`, this.linkRenderingEnabled);
        
        // DEBUG: Log call stack to see WHO is calling this
        if (typeof console.trace !== 'undefined') {
            console.trace('[OpacityController] getShouldRenderLinks() call stack:');
        }
        
        return this.linkRenderingEnabled;
    }
    
    /**
     * DEBUG: Enhanced onSettlementComplete with detailed logging
     */
    public onSettlementComplete(): void {
        const timestamp = new Date().toISOString().substr(14, 9);
        console.log(`[OpacityController] ${timestamp} 🔗 onSettlementComplete() called`);
        console.log(`[OpacityController] ${timestamp} 🔗 BEFORE: linkRenderingEnabled =`, this.linkRenderingEnabled);
        
        this.linkRenderingEnabled = true;
        
        console.log(`[OpacityController] ${timestamp} 🔗 AFTER: linkRenderingEnabled =`, this.linkRenderingEnabled);
        console.log(`[OpacityController] ${timestamp} 🔗 About to call onLinkRenderingEnabled callback`);
        
        // Verify callback exists
        if (this.callbacks.onLinkRenderingEnabled) {
            console.log(`[OpacityController] ${timestamp} 🔗 Callback exists, calling now...`);
            this.callbacks.onLinkRenderingEnabled();
            console.log(`[OpacityController] ${timestamp} 🔗 Callback completed`);
        } else {
            console.error(`[OpacityController] ${timestamp} 🔗 ERROR: onLinkRenderingEnabled callback is missing!`);
        }
        
        console.log(`[OpacityController] ${timestamp} 🔗 onSettlementComplete() completed`);
    }
    
    /**
     * Configure opacity behavior
     */
    public configure(config: Partial<OpacityConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Set initial opacity for nodes during creation
     */
    public setInitialNodeOpacity(node: EnhancedNode): void {
        if (node.type === 'statement' || node.type === 'openquestion') {
            if (this.nodeOpacityState === 'hidden') {
                (node as any).opacity = 0;
            } else {
                (node as any).opacity = 1;
            }
        } else {
            // System nodes always visible
            (node as any).opacity = 1;
        }
    }
    
    /**
     * Calculate opacity for renderable nodes
     */
    public calculateNodeOpacity(node: RenderableNode): number {
        // Check if node has D3-controlled opacity
        if ((node as any).opacity !== undefined && (node as any).opacity !== null) {
            return (node as any).opacity;
        }
        
        // For hidden nodes, let HiddenNode component handle its own display
        if (node.isHidden) {
            return 1;
        }
        
        // Default to fully visible
        return 1;
    }
    
    /**
     * CLEAN: Simple link opacity - no phantom links logic here
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        // Just return standard opacity - phantom links handled by DOM rendering
        return 1;
    }
    
    /**
     * Start the reveal sequence for nodes only
     */
    public startRevealSequence(nodes: EnhancedNode[]): void {
        console.log(`[OpacityController] Starting ${this.config.revealPattern} reveal sequence for nodes`);
        
        this.nodeOpacityState = 'revealing';
        this.revealStartTime = Date.now();
        
        // Start animation loop for nodes only
        this.startAnimationLoop(nodes);
    }
    
    /**
     * Animation loop for smooth opacity transitions
     */
    private startAnimationLoop(nodes: EnhancedNode[]): void {
        const animate = () => {
            const now = Date.now();
            
            // Update node opacity
            if (this.nodeOpacityState === 'revealing') {
                const nodeAnimationComplete = this.updateNodeOpacity(nodes, now);
                
                if (nodeAnimationComplete) {
                    this.completeRevealSequence(nodes);
                    return;
                }
            }
            
            // Continue animation
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        this.animationFrameId = requestAnimationFrame(animate);
    }
    
    /**
     * Update node opacity during reveal phase
     */
    private updateNodeOpacity(nodes: EnhancedNode[], now: number): boolean {
        const elapsed = now - this.revealStartTime;
        const progress = Math.min(1, elapsed / this.config.revealDuration);
        
        // Get content nodes and sort by reveal pattern
        const contentNodes = this.getSortedContentNodes(nodes);
        
        contentNodes.forEach(({ node }, index) => {
            const totalNodes = contentNodes.length;
            const nodeRevealStart = (index / totalNodes) * 0.8;
            const nodeRevealDuration = 0.2;
            
            const nodeProgress = Math.max(0, (progress - nodeRevealStart) / nodeRevealDuration);
            const clampedProgress = Math.min(1, nodeProgress);
            
            // Apply smooth easing
            const opacity = this.easeOutCubic(clampedProgress);
            (node as any).opacity = opacity;
        });
        
        // Keep system nodes visible
        nodes.forEach(node => {
            if (node.type !== 'statement' && node.type !== 'openquestion') {
                (node as any).opacity = 1;
            }
        });
        
        // Trigger callback for node updates
        this.callbacks.onNodeOpacityUpdate(nodes);
        
        // Check if node animation is complete
        if (progress >= 1) {
            this.nodeOpacityState = 'revealed';
            console.log('[OpacityController] Node reveal sequence complete');
            return true;
        }
        
        return false;
    }
    
    /**
     * Complete the reveal sequence
     */
    private completeRevealSequence(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] Node reveal sequence complete');
        
        // Ensure all nodes are fully visible
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update state
        this.nodeOpacityState = 'revealed';
        
        // Final callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
    }
    
    /**
     * Sort content nodes based on reveal pattern
     */
    private getSortedContentNodes(nodes: EnhancedNode[]): Array<{ node: EnhancedNode; sortValue: number }> {
        const contentNodes = nodes
            .filter(n => n.type === 'statement' || n.type === 'openquestion')
            .map(node => {
                let sortValue: number;
                
                switch (this.config.revealPattern) {
                    case 'center-out':
                        sortValue = Math.sqrt((node.x || 0) ** 2 + (node.y || 0) ** 2);
                        break;
                        
                    case 'vote-ranking':
                        const netVotes = (node as any).netVotes || 0;
                        sortValue = -netVotes;
                        break;
                        
                    case 'spiral-sequence':
                        const angle = Math.atan2(node.y || 0, node.x || 0);
                        const normalizedAngle = ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
                        sortValue = normalizedAngle;
                        break;
                        
                    default:
                        sortValue = 0;
                }
                
                return { node, sortValue };
            })
            .sort((a, b) => a.sortValue - b.sortValue);
            
        return contentNodes;
    }
    
    /**
     * Smooth easing function
     */
    private easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }
    
    /**
     * Force reveal all nodes immediately (for debugging)
     */
    public forceRevealAll(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] Force revealing all nodes');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Set states
        this.nodeOpacityState = 'revealed';
        
        // Set full opacity for nodes
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Trigger callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
        
        // CLEAN: Enable phantom links immediately
        console.log('[OpacityController] Force enabling phantom links');
        this.linkRenderingEnabled = true;
        this.callbacks.onLinkRenderingEnabled();
    }
    
    /**
     * DEBUG: Enhanced reset with detailed logging
     */
    public reset(): void {
        const timestamp = new Date().toISOString().substr(14, 9);
        console.log(`[OpacityController] ${timestamp} 🔄 RESET called`);
        console.log(`[OpacityController] ${timestamp} 🔄 BEFORE reset: linkRenderingEnabled =`, this.linkRenderingEnabled);
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log(`[OpacityController] ${timestamp} 🔄 Cancelled animation frame`);
        }
        
        // Reset states
        this.nodeOpacityState = 'hidden';
        this.revealStartTime = 0;
        
        // CRITICAL: Disable phantom links
        this.linkRenderingEnabled = false;
        
        console.log(`[OpacityController] ${timestamp} 🔄 AFTER reset: linkRenderingEnabled =`, this.linkRenderingEnabled);
        console.log(`[OpacityController] ${timestamp} 🔗 Phantom links disabled on reset`);
    }
    
    /**
     * Get current reveal status
     */
    public getRevealStatus(): {
        nodeState: OpacityState;
        nodeProgress: number;
        pattern: RevealPattern;
        duration: number;
        linkRenderingEnabled: boolean;
    } {
        const now = Date.now();
        
        const nodeProgress = this.nodeOpacityState === 'revealing' && this.revealStartTime > 0
            ? Math.min(1, (now - this.revealStartTime) / this.config.revealDuration)
            : (this.nodeOpacityState === 'revealed' ? 1 : 0);
            
        return {
            nodeState: this.nodeOpacityState,
            nodeProgress,
            pattern: this.config.revealPattern,
            duration: this.config.revealDuration,
            linkRenderingEnabled: this.linkRenderingEnabled
        };
    }
    
    /**
     * Configure reveal pattern
     */
    public configureRevealPattern(pattern: RevealPattern): void {
        this.config.revealPattern = pattern;
    }
    
    /**
     * Configure reveal timing
     */
    public configureRevealTiming(duration: number): void {
        this.config.revealDuration = Math.max(1000, Math.min(5000, duration));
    }
    
    /**
     * Cleanup resources
     */
    public dispose(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * DEBUG: Add a method to get detailed state information
     */
    public getDetailedState(): {
        linkRenderingEnabled: boolean;
        nodeOpacityState: OpacityState;
        revealStartTime: number;
        hasAnimationFrame: boolean;
        timestamp: string;
    } {
        const timestamp = new Date().toISOString().substr(14, 9);
        return {
            linkRenderingEnabled: this.linkRenderingEnabled,
            nodeOpacityState: this.nodeOpacityState,
            revealStartTime: this.revealStartTime,
            hasAnimationFrame: this.animationFrameId !== null,
            timestamp
        };
    }

    /**
     * DEBUG: Force enable method for testing
     */
    public debugForceEnable(): void {
        const timestamp = new Date().toISOString().substr(14, 9);
        console.log(`[OpacityController] ${timestamp} 🐛 DEBUG FORCE ENABLE called`);
        console.log(`[OpacityController] ${timestamp} 🐛 BEFORE: linkRenderingEnabled =`, this.linkRenderingEnabled);
        
        this.linkRenderingEnabled = true;
        
        console.log(`[OpacityController] ${timestamp} 🐛 AFTER: linkRenderingEnabled =`, this.linkRenderingEnabled);
        
        if (this.callbacks.onLinkRenderingEnabled) {
            console.log(`[OpacityController] ${timestamp} 🐛 Calling callback...`);
            this.callbacks.onLinkRenderingEnabled();
            console.log(`[OpacityController] ${timestamp} 🐛 Callback completed`);
        } else {
            console.error(`[OpacityController] ${timestamp} 🐛 ERROR: No callback available!`);
        }
    }
}