// src/lib/services/graph/universal/UniversalOpacityController.ts
// Dedicated opacity control system for Universal Graph - Enhanced with Link Rendering Control

import type { EnhancedNode, EnhancedLink, RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';
import { UniversalPositioning } from './UniversalPositioning';

export type OpacityState = 'hidden' | 'revealing' | 'revealed';
export type RevealPattern = 'center-out' | 'vote-ranking' | 'spiral-sequence';

interface OpacityConfig {
    revealDuration: number;
    revealPattern: RevealPattern;
    nodeRevealDelay: number;
    linkRevealDelay: number;
    linkRevealOffset: number; // How long after nodes start revealing should links start
}

interface RevealSequenceCallbacks {
    onNodeOpacityUpdate: (nodes: EnhancedNode[]) => void;
    onLinkOpacityUpdate: (links: EnhancedLink[]) => void;
    onRevealComplete: () => void;
    onLinkRevealEnabled?: () => void; // NEW - optional for backward compatibility
}

/**
 * Manages opacity control for both nodes and links in the Universal Graph
 * Handles three-phase system: hidden → revealing → revealed
 * Enhanced with phantom links control for post-settlement link rendering
 */
export class UniversalOpacityController {
    private positioning: UniversalPositioning;
    private config: OpacityConfig;
    private callbacks: RevealSequenceCallbacks;
    
    // State management
    private nodeOpacityState: OpacityState = 'hidden';
    private linkOpacityState: OpacityState = 'hidden';
    private revealStartTime: number = 0;
    private nodeRevealStartTime: number = 0;
    private linkRevealStartTime: number = 0;
    
    // NEW: Phantom links state management
    private linkRenderingEnabled = false;
    
    // Animation frame management
    private animationFrameId: number | null = null;
    
    constructor(callbacks: RevealSequenceCallbacks) {
        this.positioning = new UniversalPositioning();
        this.callbacks = callbacks;
        
        // DEBUG: Check which callbacks are available
        console.log('[OpacityController] Constructor - Available callbacks:', {
            onNodeOpacityUpdate: !!callbacks.onNodeOpacityUpdate,
            onLinkOpacityUpdate: !!callbacks.onLinkOpacityUpdate,
            onRevealComplete: !!callbacks.onRevealComplete,
            onLinkRevealEnabled: !!callbacks.onLinkRevealEnabled
        });
        
        // Default configuration
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0,
            linkRevealDelay: 300, // Links start revealing 300ms after nodes
            linkRevealOffset: 300
        };
    }
    
    /**
     * Configure opacity behavior
     */
    public configure(config: Partial<OpacityConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * NEW: Check if links should be rendered to DOM (phantom links control)
     */
    public shouldRenderLinks(): boolean {
        return this.linkRenderingEnabled;
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
     * Set initial opacity for links during creation
     */
    public setInitialLinkOpacity(link: EnhancedLink): void {
        // Hide all links initially during construction
        if (this.linkOpacityState === 'hidden') {
            (link as any).opacity = 0;
        } else {
            (link as any).opacity = 1;
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
     * Calculate opacity for renderable links
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        // Check if link has D3-controlled opacity
        if ((link as any).opacity !== undefined && (link as any).opacity !== null) {
            return (link as any).opacity;
        }
        
        // Default to fully visible
        return 1;
    }
    
    /**
     * Start the reveal sequence for both nodes and links
     */
    public startRevealSequence(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        console.log(`[OpacityController] Starting ${this.config.revealPattern} reveal sequence`);
        
        this.nodeOpacityState = 'revealing';
        this.linkOpacityState = 'hidden'; // Links start hidden
        
        this.revealStartTime = Date.now();
        this.nodeRevealStartTime = this.revealStartTime + this.config.nodeRevealDelay;
        this.linkRevealStartTime = this.revealStartTime + this.config.linkRevealDelay;
        
        // Start animation loop
        this.startAnimationLoop(nodes, links);
    }
    
    /**
     * Animation loop for smooth opacity transitions
     */
    private startAnimationLoop(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        const animate = () => {
            const now = Date.now();
            let nodeAnimationComplete = false;
            let linkAnimationComplete = false;
            
            // Update node opacity
            if (this.nodeOpacityState === 'revealing') {
                nodeAnimationComplete = this.updateNodeOpacity(nodes, now);
            }
            
            // Update link opacity (starts after node delay)
            if (now >= this.linkRevealStartTime) {
                if (this.linkOpacityState === 'hidden') {
                    this.linkOpacityState = 'revealing';
                    console.log('[OpacityController] Starting link reveal sequence');
                }
                if (this.linkOpacityState === 'revealing') {
                    linkAnimationComplete = this.updateLinkOpacity(links, now);
                }
            }
            
            // Check if both animations are complete
            if (nodeAnimationComplete && linkAnimationComplete) {
                this.completeRevealSequence(nodes, links);
                return;
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
        const elapsed = now - this.nodeRevealStartTime;
        const progress = Math.min(1, elapsed / this.config.revealDuration);
        
        // Get content nodes and sort by reveal pattern
        const contentNodes = this.getSortedContentNodes(nodes);
        
        contentNodes.forEach(({ node }, index) => {
            const totalNodes = contentNodes.length;
            const nodeRevealStart = (index / totalNodes) * 0.8; // 80% of duration for staggering
            const nodeRevealDuration = 0.2; // 20% of duration for each node
            
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
     * Update link opacity during reveal phase
     */
    private updateLinkOpacity(links: EnhancedLink[], now: number): boolean {
        const elapsed = now - this.linkRevealStartTime;
        const progress = Math.min(1, elapsed / this.config.revealDuration);
        
        // Apply uniform fade-in for all links
        const opacity = this.easeOutCubic(progress);
        
        links.forEach(link => {
            (link as any).opacity = opacity;
        });
        
        // Trigger callback for link updates
        this.callbacks.onLinkOpacityUpdate(links);
        
        // Check if link animation is complete
        if (progress >= 1) {
            this.linkOpacityState = 'revealed';
            console.log('[OpacityController] Link reveal sequence complete');
            return true;
        }
        
        return false;
    }
    
    /**
     * ENHANCED: Complete the reveal sequence with phantom links control
     */
    private completeRevealSequence(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        console.log('[OpacityController] Full reveal sequence complete');
        
        // Ensure all nodes and links are fully visible
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        links.forEach(link => {
            (link as any).opacity = 1;
        });
        
        // Update states
        this.nodeOpacityState = 'revealed';
        this.linkOpacityState = 'revealed';
        
        // NEW: Enable phantom links rendering
        this.linkRenderingEnabled = true;
        console.log('[OpacityController] 🔗 Phantom links enabled for DOM rendering');
        
        // Final callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onLinkOpacityUpdate(links);
        this.callbacks.onRevealComplete();
        
        // NEW: Trigger phantom links callback
        if (this.callbacks.onLinkRevealEnabled) {
            console.log('[OpacityController] 🔗 Calling onLinkRevealEnabled callback');
            this.callbacks.onLinkRevealEnabled();
        } else {
            console.warn('[OpacityController] 🔗 onLinkRevealEnabled callback not available');
        }
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
                        const netVotes = (node as any).netVotes || this.positioning.getNodeVotes({
                            id: node.id, type: node.type, data: node.data,
                            group: node.group, metadata: node.metadata
                        });
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
     * Force reveal all nodes and links immediately
     */
    public forceRevealAll(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        console.log('[OpacityController] Force revealing all nodes and links');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Set states
        this.nodeOpacityState = 'revealed';
        this.linkOpacityState = 'revealed';
        
        // NEW: Enable phantom links
        this.linkRenderingEnabled = true;
        console.log('[OpacityController] 🔗 Force enabling phantom links');
        
        // Set full opacity
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        links.forEach(link => {
            (link as any).opacity = 1;
        });
        
        // Trigger callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onLinkOpacityUpdate(links);
        this.callbacks.onRevealComplete();
        
        // NEW: Trigger phantom links callback - DEBUG VERSION
        console.log('[OpacityController] 🔗 About to call onLinkRevealEnabled callback');
        console.log('[OpacityController] 🔗 Callback available:', !!this.callbacks.onLinkRevealEnabled);
        
        if (this.callbacks.onLinkRevealEnabled) {
            console.log('[OpacityController] 🔗 Force calling onLinkRevealEnabled callback');
            this.callbacks.onLinkRevealEnabled();
        } else {
            console.error('[OpacityController] 🔗 onLinkRevealEnabled callback not available for force reveal!');
        }
    }
    
    /**
     * ENHANCED: Reset to hidden state with phantom links reset
     */
    public reset(): void {
        console.log('[OpacityController] Resetting to hidden state');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Reset states
        this.nodeOpacityState = 'hidden';
        this.linkOpacityState = 'hidden';
        this.revealStartTime = 0;
        this.nodeRevealStartTime = 0;
        this.linkRevealStartTime = 0;
        
        // NEW: Reset phantom links
        this.linkRenderingEnabled = false;
        console.log('[OpacityController] 🔗 Phantom links disabled');
    }
    
    /**
     * ENHANCED: Get current reveal status including phantom links
     */
    public getRevealStatus(): {
        nodeState: OpacityState;
        linkState: OpacityState;
        nodeProgress: number;
        linkProgress: number;
        pattern: RevealPattern;
        duration: number;
        linkRenderingEnabled: boolean; // NEW
    } {
        const now = Date.now();
        
        const nodeProgress = this.nodeOpacityState === 'revealing' && this.nodeRevealStartTime > 0
            ? Math.min(1, (now - this.nodeRevealStartTime) / this.config.revealDuration)
            : (this.nodeOpacityState === 'revealed' ? 1 : 0);
            
        const linkProgress = this.linkOpacityState === 'revealing' && this.linkRevealStartTime > 0
            ? Math.min(1, (now - this.linkRevealStartTime) / this.config.revealDuration)
            : (this.linkOpacityState === 'revealed' ? 1 : 0);
            
        return {
            nodeState: this.nodeOpacityState,
            linkState: this.linkOpacityState,
            nodeProgress,
            linkProgress,
            pattern: this.config.revealPattern,
            duration: this.config.revealDuration,
            linkRenderingEnabled: this.linkRenderingEnabled // NEW
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
    public configureRevealTiming(duration: number, linkOffset: number = 300): void {
        this.config.revealDuration = Math.max(1000, Math.min(5000, duration));
        this.config.linkRevealOffset = linkOffset;
        this.config.linkRevealDelay = linkOffset;
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
     * DEBUG: Manual force enable for testing
     */
    public debugForceEnable(): void {
        console.log('[OpacityController] 🐛 DEBUG: Force enabling phantom links');
        this.linkRenderingEnabled = true;
        
        if (this.callbacks.onLinkRevealEnabled) {
            console.log('[OpacityController] 🐛 DEBUG: Calling onLinkRevealEnabled callback');
            this.callbacks.onLinkRevealEnabled();
        } else {
            console.error('[OpacityController] 🐛 DEBUG: onLinkRevealEnabled callback not available!');
        }
    }
}