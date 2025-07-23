// src/lib/services/graph/universal/UniversalOpacityController.ts
// UPDATED: Event-based reveal factor system using working settlement trigger

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
    onLinkRenderingEnabled: () => void;
}

/**
 * UPDATED: Event-based reveal factor system with working settlement trigger
 */
export class UniversalOpacityController {
    private config: OpacityConfig;
    private callbacks: RevealSequenceCallbacks;
    
    // State management
    private nodeOpacityState: OpacityState = 'hidden';
    private revealStartTime: number = 0;
    
    // UPDATED: Single source of truth for phantom links reveal state
    private linkRenderingEnabled = false;
    
    // Animation frame management
    private animationFrameId: number | null = null;
    
    constructor(callbacks: RevealSequenceCallbacks) {
        this.callbacks = callbacks;
        
        // Minimal initialization logging
        console.log('[OpacityController] Reveal factor system initialized');
        
        // Default configuration
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0
        };
    }
    
    /**
     * CLEAN: getShouldRenderLinks - single source of truth for phantom links
     */
    public getShouldRenderLinks(): boolean {
        return this.linkRenderingEnabled;
    }
    
    /**
     * UPDATED: Get reveal factor for LinkRenderer to multiply with visual opacity
     * Returns: 0 (hidden) or 1 (revealed) - LinkRenderer handles visual opacity
     */
    public getLinkRevealFactor(): number {
        return this.linkRenderingEnabled ? 1 : 0;
    }
    
    /**
     * UPDATED: Settlement complete - enable phantom links using working trigger mechanism
     */
    public onSettlementComplete(): void {
        console.log('[OpacityController] Settlement complete - enabling phantom links');
        
        this.linkRenderingEnabled = true;
        
        // UPDATED: Use the same working trigger mechanism from hardcoded version
        // Instead of setting DOM opacity, dispatch event to update reveal factor
        this.triggerLinkRevealFactorUpdate();
        
        // Notify that links should now use reveal factor in their calculations
        if (this.callbacks.onLinkRenderingEnabled) {
            this.callbacks.onLinkRenderingEnabled();
        }
    }
    
    /**
     * UPDATED: Use the working DOM-based trigger mechanism to notify LinkRenderer
     * This uses the same timing as the hardcoded version that works
     */
    private triggerLinkRevealFactorUpdate(): void {
        if (typeof window === 'undefined') return;
        
        console.log('[OpacityController] Dispatching phantom-links-reveal event');
        
        // Dispatch custom event that LinkRenderer listens for
        const event = new CustomEvent('phantom-links-reveal', {
            detail: {
                revealFactor: this.getLinkRevealFactor(),
                linkRenderingEnabled: this.linkRenderingEnabled,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
        
        // Also trigger any existing listeners for compatibility
        const legacyEvent = new CustomEvent('phantom-links-state-change', {
            detail: {
                enabled: this.linkRenderingEnabled,
                revealState: 'revealed',
                linksCount: 0 // LinkRenderer will update this
            }
        });
        
        window.dispatchEvent(legacyEvent);
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
     * UPDATED: Set initial state for links - no longer sets opacity directly
     * LinkRenderer will use getLinkRevealFactor() to calculate final opacity
     */
    public setInitialLinkOpacity(link: EnhancedLink): void {
        // Don't set opacity directly - LinkRenderer will calculate it
        // Just ensure metadata exists for LinkRenderer to use
        if (!link.metadata) {
            link.metadata = {};
        }
        
        // LinkRenderer will use getLinkRevealFactor() for timing
        // No logging needed here - called for every link
    }
    
    /**
     * Calculate opacity for renderable nodes (unchanged)
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
     * UPDATED: Links now calculate their own opacity using reveal factor
     * This method is kept for compatibility but LinkRenderer should use getLinkRevealFactor()
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        // UPDATED: Return reveal factor only - LinkRenderer handles visual opacity
        return this.getLinkRevealFactor();
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
     * Complete the reveal sequence and trigger settlement
     */
    private completeRevealSequence(nodes: EnhancedNode[]): void {
        // Ensure all nodes are fully visible
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update state
        this.nodeOpacityState = 'revealed';
        
        // Final callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
        
        // Automatically trigger settlement completion for phantom links
        this.onSettlementComplete();
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
     * UPDATED: Force reveal all nodes immediately (for debugging)
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
        
        // Trigger settlement completion for phantom links
        this.onSettlementComplete();
    }
    
    /**
     * CLEAN: Reset with phantom links control
     */
    public reset(): void {
        console.log('[OpacityController] 🔄 RESET - disabling phantom links');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Reset states
        this.nodeOpacityState = 'hidden';
        this.revealStartTime = 0;
        
        // CRITICAL: Disable phantom links
        this.linkRenderingEnabled = false;
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
        linkRevealFactor: number;
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
            linkRenderingEnabled: this.linkRenderingEnabled,
            linkRevealFactor: this.getLinkRevealFactor() // UPDATED: Include reveal factor
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
     * DEBUG: Force enable method for testing
     */
    public debugForceEnable(): void {
        console.log('[OpacityController] Debug force enable called');
        
        this.linkRenderingEnabled = true;
        
        // UPDATED: Use event-based trigger instead of DOM manipulation
        this.triggerLinkRevealFactorUpdate();
        
        if (this.callbacks.onLinkRenderingEnabled) {
            this.callbacks.onLinkRenderingEnabled();
        }
    }
}