// src/lib/services/graph/universal/UniversalOpacityController.ts
// FIXED: Preserve sophisticated opacity calculations while managing reveal timing

import type { EnhancedNode, EnhancedLink, RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';
import { ConsolidatedRelationshipUtils } from '$lib/types/graph/enhanced';

export type OpacityState = 'hidden' | 'revealing' | 'revealed';
export type RevealPattern = 'center-out' | 'vote-ranking' | 'spiral-sequence';

interface OpacityConfig {
    revealDuration: number;
    revealPattern: RevealPattern;
    nodeRevealDelay: number;
}

interface RevealSequenceCallbacks {
    onNodeOpacityUpdate: (nodes: EnhancedNode[]) => void;
    onLinkOpacityUpdate: (linkOpacities: Map<string, number>) => void;
    onRevealComplete: () => void;
    onLinkRenderingEnabled: () => void;
}

/**
 * FIXED: Preserve sophisticated opacity calculations while managing reveal timing
 */
export class UniversalOpacityController {
    private config: OpacityConfig;
    private callbacks: RevealSequenceCallbacks;
    
    // State management
    private nodeOpacityState: OpacityState = 'hidden';
    private revealStartTime: number = 0;
    
    // FIXED: Single source of truth for phantom links reveal state
    private linkRenderingEnabled = false;
    
    // FIXED: Enhanced link opacity cache for sophisticated calculations
    private linkOpacityCache = new Map<string, number>();
    private visualOpacityCache = new Map<string, number>(); // NEW: Cache visual calculations
    private currentLinks: RenderableLink[] = [];
    
    // Animation frame management
    private animationFrameId: number | null = null;
    
    constructor(callbacks: RevealSequenceCallbacks) {
        this.callbacks = callbacks;
        
        console.log('[OpacityController] FIXED - Sophisticated opacity + reveal timing');
        
        // Default configuration
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0
        };
    }
    
    /**
     * FIXED: Register links and calculate sophisticated visual opacities
     */
    public registerLinks(links: RenderableLink[]): void {
        this.currentLinks = links;
        
        // FIXED: Pre-calculate and cache sophisticated visual opacities
        this.precalculateVisualOpacities(links);
        
        // Calculate initial opacity for all links
        this.updateAllLinkOpacities();
        
        console.log(`[OpacityController] FIXED - Registered ${links.length} links with sophisticated opacity`);
    }
    
    /**
     * FIXED: Pre-calculate sophisticated visual opacities for all links
     */
    private precalculateVisualOpacities(links: RenderableLink[]): void {
        this.visualOpacityCache.clear();
        
        links.forEach(link => {
            const visualOpacity = this.calculateSophisticatedVisualOpacity(link);
            this.visualOpacityCache.set(link.id, visualOpacity);
            
            // DEBUG: Log first few links to verify sophisticated calculations
            if (this.visualOpacityCache.size <= 3) {
                const isConsolidated = ConsolidatedRelationshipUtils.isConsolidated(link);
                const relationshipCount = ConsolidatedRelationshipUtils.getRelationshipCount(link);
                const effectiveStrength = ConsolidatedRelationshipUtils.getEffectiveStrength(link);
                
                console.log(`[OpacityController] FIXED - Link ${link.id.substring(0, 8)}:`, {
                    type: link.type,
                    visualOpacity: visualOpacity.toFixed(3),
                    isConsolidated,
                    relationshipCount,
                    effectiveStrength: effectiveStrength.toFixed(2)
                });
            }
        });
        
        console.log(`[OpacityController] FIXED - Pre-calculated visual opacities for ${links.length} links`);
    }
    
    /**
     * FIXED: Calculate sophisticated visual opacity (preserves all existing logic)
     */
    private calculateSophisticatedVisualOpacity(link: RenderableLink): number {
        // Use existing ConsolidatedRelationshipUtils for all sophisticated calculations
        const isConsolidated = ConsolidatedRelationshipUtils.isConsolidated(link);
        const relationshipCount = ConsolidatedRelationshipUtils.getRelationshipCount(link);
        const effectiveStrength = ConsolidatedRelationshipUtils.getEffectiveStrength(link);
        const visualProps = ConsolidatedRelationshipUtils.getVisualProperties(link);
        
        // Start with base visual properties opacity
        let baseOpacity = visualProps.opacity;
        
        // PRESERVED: All sophisticated opacity logic from original LinkRenderer
        if (link.type === 'shared_keyword') {
            // Shared keyword links - opacity based on strength and consolidation
            const strengthBonus = effectiveStrength * 0.3;
            const consolidationBonus = isConsolidated ? 0.1 : 0;
            baseOpacity = Math.min(0.9, 0.6 + strengthBonus + consolidationBonus);
        } else if (link.type === 'answers') {
            baseOpacity = 0.9;
        } else if (link.type === 'responds_to' || link.type === 'related_to') {
            baseOpacity = 0.8;
        } else if (link.type === 'comment' || link.type === 'reply') {
            baseOpacity = 0.9;
        } else if (link.type === 'comment-form' || link.type === 'reply-form') {
            baseOpacity = 0.7;
        } else if (link.type === 'related') {
            // Statement relation opacity based on relationship count
            baseOpacity = Math.min(0.9, 0.5 + (relationshipCount - 1) * 0.1);
        }
        
        // PRESERVED: Consolidation boost for multi-relationship links
        if (isConsolidated && relationshipCount >= 3) {
            const consolidationBonus = Math.min(0.2, (relationshipCount - 1) * 0.02);
            baseOpacity = Math.min(0.95, baseOpacity + consolidationBonus);
        }
        
        // PRESERVED: Strength-based adjustments for consolidated relationships
        if (isConsolidated) {
            const strengthMultiplier = 0.8 + (effectiveStrength * 0.2); // Range: 0.8 to 1.0
            baseOpacity = baseOpacity * strengthMultiplier;
        }
        
        return Math.max(0.1, Math.min(1.0, baseOpacity)); // Clamp to valid range
    }
    
    /**
     * FIXED: Calculate final opacity preserving sophisticated calculations
     */
    public calculateFinalLinkOpacity(link: RenderableLink): number {
        // Check cache first for performance
        const cached = this.linkOpacityCache.get(link.id);
        if (cached !== undefined) {
            return cached;
        }
        
        // FIXED: Get sophisticated visual opacity from cache
        let visualOpacity = this.visualOpacityCache.get(link.id);
        
        // Fallback: calculate if not cached
        if (visualOpacity === undefined) {
            visualOpacity = this.calculateSophisticatedVisualOpacity(link);
            this.visualOpacityCache.set(link.id, visualOpacity);
        }
        
        // FIXED: Apply reveal factor to sophisticated opacity (not override it)
        const revealFactor = this.getLinkRevealFactor();
        const finalOpacity = revealFactor * visualOpacity;
        
        // Cache the result
        this.linkOpacityCache.set(link.id, finalOpacity);
        
        return finalOpacity;
    }
    
    /**
     * FIXED: Update all link opacities preserving sophisticated calculations
     */
    private updateAllLinkOpacities(): void {
        if (this.currentLinks.length === 0) return;
        
        // Clear final opacity cache to force recalculation with current reveal state
        this.linkOpacityCache.clear();
        
        // Calculate new final opacities (sophisticated visual × reveal factor)
        const linkOpacities = new Map<string, number>();
        
        this.currentLinks.forEach(link => {
            const finalOpacity = this.calculateFinalLinkOpacity(link);
            linkOpacities.set(link.id, finalOpacity);
        });
        
        // DEBUG: Log sample final opacities to verify sophisticated calculations are preserved
        let sampleCount = 0;
        linkOpacities.forEach((opacity, linkId) => {
            if (sampleCount < 3) {
                const visualOpacity = this.visualOpacityCache.get(linkId) || 1;
                const revealFactor = this.getLinkRevealFactor();
                console.log(`[OpacityController] FIXED - Final opacity for ${linkId.substring(0, 8)}:`, {
                    visual: visualOpacity.toFixed(3),
                    reveal: revealFactor.toFixed(3),
                    final: opacity.toFixed(3)
                });
                sampleCount++;
            }
        });
        
        // Notify subscribers (UniversalGraphManager)
        this.callbacks.onLinkOpacityUpdate(linkOpacities);
        
        // Update CSS custom properties for immediate visual effect
        this.updateCSSCustomProperties(linkOpacities);
    }
    
    /**
     * FIXED: Update CSS custom properties with staggered timing for smooth reveal
     */
    private updateCSSCustomProperties(linkOpacities: Map<string, number>): void {
        if (typeof document === 'undefined') return;
        
        const root = document.documentElement;
        
        if (this.linkRenderingEnabled) {
            // FIXED: Staggered reveal for smooth transition
            let delay = 0;
            const staggerDelay = 20; // 20ms between each link
            
            linkOpacities.forEach((opacity, linkId) => {
                setTimeout(() => {
                    root.style.setProperty(`--link-${linkId}-opacity`, opacity.toString());
                }, delay);
                delay += staggerDelay;
            });
            
            console.log(`[OpacityController] FIXED - Staggered CSS update for ${linkOpacities.size} links over ${delay}ms`);
        } else {
            // Immediate update when hiding
            linkOpacities.forEach((opacity, linkId) => {
                root.style.setProperty(`--link-${linkId}-opacity`, opacity.toString());
            });
        }
    }
    
    /**
     * CLEAN: getShouldRenderLinks - single source of truth for phantom links
     */
    public getShouldRenderLinks(): boolean {
        return this.linkRenderingEnabled;
    }
    
    /**
     * FIXED: Get reveal factor for LinkRenderer compatibility
     */
    public getLinkRevealFactor(): number {
        return this.linkRenderingEnabled ? 1 : 0;
    }
    
    /**
     * FIXED: Settlement complete with smooth reveal timing
     */
    public onSettlementComplete(): void {
        console.log('[OpacityController] FIXED - Settlement complete, enabling sophisticated phantom links');
        
        this.linkRenderingEnabled = true;
        
        // FIXED: Smooth reveal sequence instead of immediate update
        this.triggerSmoothReveal();
    }
    
    /**
     * FIXED: Trigger smooth reveal sequence with proper timing
     */
    private triggerSmoothReveal(): void {
        // Step 1: Update container state first
        this.triggerContainerStateChange();
        
        // Step 2: Update all link opacities with staggering after slight delay
        setTimeout(() => {
            this.updateAllLinkOpacities();
        }, 100); // Small delay allows CSS transition to initialize
        
        // Step 3: Notify callbacks after reveal starts
        setTimeout(() => {
            if (this.callbacks.onLinkRenderingEnabled) {
                this.callbacks.onLinkRenderingEnabled();
            }
        }, 200);
    }
    
    /**
     * FIXED: Trigger container-level CSS state change with better timing
     */
    private triggerContainerStateChange(): void {
        if (typeof window === 'undefined') return;
        
        console.log('[OpacityController] FIXED - Triggering smooth container state change');
        
        // Find universal graph container and update class
        const container = document.querySelector('.universal-graph');
        if (container) {
            // Add a slight delay to ensure smooth transition
            container.classList.remove('revealing');
            
            // Use requestAnimationFrame for smooth CSS transition
            requestAnimationFrame(() => {
                container.classList.add('revealed');
            });
        }
        
        // Dispatch events for compatibility
        const event = new CustomEvent('phantom-links-reveal', {
            detail: {
                revealFactor: this.getLinkRevealFactor(),
                linkRenderingEnabled: this.linkRenderingEnabled,
                timestamp: Date.now()
            }
        });
        
        window.dispatchEvent(event);
        
        // Legacy compatibility event
        const legacyEvent = new CustomEvent('phantom-links-state-change', {
            detail: {
                enabled: this.linkRenderingEnabled,
                revealState: 'revealed',
                linksCount: this.currentLinks.length
            }
        });
        
        window.dispatchEvent(legacyEvent);
    }
    
    // ... (Keep all existing node opacity methods unchanged)
    
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
     * FIXED: Set initial state for links - preserves sophisticated calculations
     */
    public setInitialLinkOpacity(link: EnhancedLink): void {
        // Ensure metadata exists
        if (!link.metadata) {
            link.metadata = {};
        }
        
        // Note: Sophisticated opacity calculation happens in calculateFinalLinkOpacity
        // This method is kept for interface compatibility
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
     * FIXED: Calculate link opacity - now preserves sophisticated calculations
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        return this.calculateFinalLinkOpacity(link);
    }
    
    // ... (Keep all existing node reveal methods unchanged)
    
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
     * FIXED: Force reveal all nodes and links immediately (for debugging)
     */
    public forceRevealAll(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] FIXED - Force revealing all nodes and links with sophisticated opacity');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Set states
        this.nodeOpacityState = 'revealed';
        this.linkRenderingEnabled = true;
        
        // Set full opacity for nodes
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update all link opacities with sophisticated calculations
        this.updateAllLinkOpacities();
        
        // Trigger callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
        
        // Trigger settlement completion
        this.triggerSmoothReveal();
    }
    
    /**
     * FIXED: Reset with phantom links control and sophisticated opacity cache clearing
     */
    public reset(): void {
        console.log('[OpacityController] FIXED - RESET, clearing all opacity state and caches');
        
        // Stop any ongoing animation
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Reset states
        this.nodeOpacityState = 'hidden';
        this.revealStartTime = 0;
        
        // FIXED: Disable phantom links and clear all caches
        this.linkRenderingEnabled = false;
        this.linkOpacityCache.clear();
        this.visualOpacityCache.clear(); // FIXED: Clear sophisticated opacity cache
        
        // Update all link opacities to reflect reset state
        if (this.currentLinks.length > 0) {
            this.updateAllLinkOpacities();
        }
        
        // Reset container CSS class
        if (typeof document !== 'undefined') {
            const container = document.querySelector('.universal-graph');
            if (container) {
                container.classList.remove('revealed');
                container.classList.add('revealing');
            }
        }
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
        linkCount: number;
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
            linkRevealFactor: this.getLinkRevealFactor(),
            linkCount: this.currentLinks.length
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
        
        // FIXED: Clear all caches
        this.linkOpacityCache.clear();
        this.visualOpacityCache.clear();
        this.currentLinks = [];
    }

    /**
     * DEBUG: Force enable method for testing
     */
    public debugForceEnable(): void {
        console.log('[OpacityController] FIXED - Debug force enable with sophisticated opacity');
        
        this.linkRenderingEnabled = true;
        
        // Update all link opacities with sophisticated calculations
        this.updateAllLinkOpacities();
        
        // Trigger smooth reveal
        this.triggerSmoothReveal();
    }
}