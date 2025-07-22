// src/lib/services/graph/universal/UniversalOpacityController.ts
// FIXED: Settlement completion trigger

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
 * FIXED: Settlement completion trigger for phantom links
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
        
        console.log('[OpacityController] HARDCODED TEST - Link opacity controller initialized');
        
        // Default configuration
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0
        };
    }
    
    /**
     * CLEAN: getShouldRenderLinks - single source of truth
     */
    public getShouldRenderLinks(): boolean {
        return this.linkRenderingEnabled;
    }
    
    /**
     * FIXED: onSettlementComplete - enable phantom links
     */
    public onSettlementComplete(): void {
        console.log('[OpacityController] 🔗 FIXED - Settlement complete, enabling phantom links');
        
        this.linkRenderingEnabled = true;
        
        // Force all links in DOM to be visible
        this.forceAllLinksVisible();
        
        // Verify callback exists and call it
        if (this.callbacks.onLinkRenderingEnabled) {
            this.callbacks.onLinkRenderingEnabled();
        }
        
        console.log('[OpacityController] 🔗 FIXED - Phantom links enabled and links forced visible');
    }
    
    /**
     * HARDCODED TEST: Force all link elements in DOM to be visible
     */
    private forceAllLinksVisible(): void {
        if (typeof window === 'undefined' || !window.document) return;
        
        console.log('[OpacityController] 🔗 HARDCODED TEST - Forcing all links visible via DOM');
        
        // Find all link elements in the DOM
        const linkElements = window.document.querySelectorAll('.link, .link-path, [data-link-id]');
        console.log(`[OpacityController] 🔗 Found ${linkElements.length} link elements`);
        
        // Force opacity to 1 on all link elements
        linkElements.forEach((element) => {
            if (element instanceof HTMLElement || element instanceof SVGElement) {
                (element as any).style.opacity = '1';
            }
        });
        
        // Also try to find SVG path elements specifically
        const pathElements = window.document.querySelectorAll('svg path[stroke]');
        console.log(`[OpacityController] 🔗 Found ${pathElements.length} SVG path elements`);
        
        pathElements.forEach((element) => {
            if (element instanceof SVGPathElement) {
                element.style.opacity = '1';
                element.setAttribute('opacity', '1');
            }
        });
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
     * HARDCODED TEST: Set initial opacity for links - start with 0
     */
    public setInitialLinkOpacity(link: EnhancedLink): void {
        // Start with 0 opacity
        (link as any).opacity = 0;
        
        // Also set in metadata
        if (link.metadata) {
            link.metadata.opacity = 0;
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
     * HARDCODED TEST: Calculate opacity for renderable links
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        // HARDCODED TEST: If phantom links are enabled, force opacity 1
        if (this.linkRenderingEnabled) {
            return 1;
        }
        
        // Check if link has D3-controlled opacity
        if ((link as any).opacity !== undefined && (link as any).opacity !== null) {
            return (link as any).opacity;
        }
        
        // Check metadata opacity
        if (link.metadata?.opacity !== undefined && link.metadata.opacity !== null) {
            return link.metadata.opacity;
        }
        
        // Default to hidden
        return 0;
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
     * FIXED: Complete the reveal sequence and trigger settlement
     */
    private completeRevealSequence(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] FIXED - Node reveal sequence complete, triggering settlement');
        
        // Ensure all nodes are fully visible
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update state
        this.nodeOpacityState = 'revealed';
        
        // Final callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
        
        // FIXED: Automatically trigger settlement completion for phantom links
        console.log('[OpacityController] FIXED - Auto-triggering onSettlementComplete()');
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
     * FIXED: Force reveal all nodes immediately (for debugging)
     */
    public forceRevealAll(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] FIXED - Force revealing all nodes and triggering settlement');
        
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
        
        // FIXED: Trigger settlement completion for phantom links
        console.log('[OpacityController] FIXED - Force triggering onSettlementComplete()');
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
     * DEBUG: Force enable method for testing
     */
    public debugForceEnable(): void {
        console.log('[OpacityController] 🐛 DEBUG FORCE ENABLE called');
        
        this.linkRenderingEnabled = true;
        
        // HARDCODED TEST: Force all links visible
        this.forceAllLinksVisible();
        
        if (this.callbacks.onLinkRenderingEnabled) {
            this.callbacks.onLinkRenderingEnabled();
        }
    }
}