// src/lib/services/graph/universal/UniversalOpacityController.ts
// ENHANCED: Smooth progressive link reveal with configurable timing

import type { EnhancedNode, EnhancedLink, RenderableNode, RenderableLink } from '$lib/types/graph/enhanced';
import { ConsolidatedRelationshipUtils } from '$lib/types/graph/enhanced';

export type OpacityState = 'hidden' | 'revealing' | 'revealed';
export type RevealPattern = 'center-out' | 'vote-ranking' | 'spiral-sequence';
export type LinkRevealPattern = 'staggered' | 'wave' | 'radial' | 'strength-based';

interface OpacityConfig {
    revealDuration: number;
    revealPattern: RevealPattern;
    nodeRevealDelay: number;
    // NEW: Link reveal configuration
    linkRevealDuration: number;
    linkRevealPattern: LinkRevealPattern;
    linkRevealDelay: number; // Delay after nodes before links start
    linkStaggerDuration: number; // Total time to stagger all links
}

interface RevealSequenceCallbacks {
    onNodeOpacityUpdate: (nodes: EnhancedNode[]) => void;
    onLinkOpacityUpdate: (linkOpacities: Map<string, number>) => void;
    onRevealComplete: () => void;
    onLinkRenderingEnabled: () => void;
}

/**
 * ENHANCED: Smooth progressive link reveal with sophisticated timing
 */
export class UniversalOpacityController {
    private config: OpacityConfig;
    private callbacks: RevealSequenceCallbacks;
    
    // State management
    private nodeOpacityState: OpacityState = 'hidden';
    private linkOpacityState: OpacityState = 'hidden';
    private revealStartTime: number = 0;
    private linkRevealStartTime: number = 0;
    
    // Single source of truth for phantom links reveal state
    private linkRenderingEnabled = false;
    
    // Enhanced link opacity cache for sophisticated calculations
    private linkOpacityCache = new Map<string, number>();
    private visualOpacityCache = new Map<string, number>();
    private linkRevealProgress = new Map<string, number>(); // NEW: Track individual link progress
    private currentLinks: RenderableLink[] = [];
    
    // Animation frame management
    private animationFrameId: number | null = null;
    private linkAnimationFrameId: number | null = null;
    
    constructor(callbacks: RevealSequenceCallbacks) {
        this.callbacks = callbacks;
        
        console.log('[OpacityController] ENHANCED - Smooth progressive link reveal');
        
        // Enhanced default configuration with link timing
        this.config = {
            revealDuration: 2000,
            revealPattern: 'center-out',
            nodeRevealDelay: 0,
            // NEW: Link reveal settings
            linkRevealDuration: 4000, // 4 seconds for full link reveal
            linkRevealPattern: 'staggered',
            linkRevealDelay: 500, // Start links 500ms after nodes complete
            linkStaggerDuration: 3000 // Stagger links over 3 seconds
        };
    }
    
    /**
     * Register links and calculate sophisticated visual opacities
     */
    public registerLinks(links: RenderableLink[]): void {
        this.currentLinks = links;
        
        // Pre-calculate and cache sophisticated visual opacities
        this.precalculateVisualOpacities(links);
        
        // Initialize reveal progress for each link
        this.initializeLinkRevealProgress(links);
        
        // Calculate initial opacity for all links
        this.updateAllLinkOpacities();
        
        console.log(`[OpacityController] Registered ${links.length} links for smooth reveal`);
    }
    
    /**
     * NEW: Initialize reveal progress tracking for smooth transitions
     */
    private initializeLinkRevealProgress(links: RenderableLink[]): void {
        this.linkRevealProgress.clear();
        
        // Calculate reveal order based on pattern
        const sortedLinks = this.getSortedLinksForReveal(links);
        
        sortedLinks.forEach((link, index) => {
            // Each link gets a progress value that determines when it starts revealing
            const startProgress = index / links.length;
            this.linkRevealProgress.set(link.id, startProgress);
        });
    }
    
    /**
     * NEW: Sort links based on reveal pattern
     */
    private getSortedLinksForReveal(links: RenderableLink[]): RenderableLink[] {
        const linksWithMetrics = links.map(link => {
            let sortValue: number;
            
            switch (this.config.linkRevealPattern) {
                case 'radial':
                    // Sort by distance from center
                    const avgX = (link.sourcePosition.x + link.targetPosition.x) / 2;
                    const avgY = (link.sourcePosition.y + link.targetPosition.y) / 2;
                    sortValue = Math.sqrt(avgX * avgX + avgY * avgY);
                    break;
                    
                case 'strength-based':
                    // Stronger links reveal first
                    const effectiveStrength = ConsolidatedRelationshipUtils.getEffectiveStrength(link);
                    sortValue = -effectiveStrength; // Negative for descending order
                    break;
                    
                case 'wave':
                    // Left to right wave
                    sortValue = (link.sourcePosition.x + link.targetPosition.x) / 2;
                    break;
                    
                case 'staggered':
                default:
                    // Random stagger for organic feel
                    sortValue = Math.random();
                    break;
            }
            
            return { link, sortValue };
        });
        
        return linksWithMetrics
            .sort((a, b) => a.sortValue - b.sortValue)
            .map(item => item.link);
    }
    
    /**
     * Pre-calculate sophisticated visual opacities for all links
     */
    private precalculateVisualOpacities(links: RenderableLink[]): void {
        this.visualOpacityCache.clear();
        
        links.forEach(link => {
            const visualOpacity = this.calculateSophisticatedVisualOpacity(link);
            this.visualOpacityCache.set(link.id, visualOpacity);
        });
        
        console.log(`[OpacityController] Pre-calculated visual opacities for ${links.length} links`);
    }
    
    /**
     * Calculate sophisticated visual opacity (preserves all existing logic)
     */
    private calculateSophisticatedVisualOpacity(link: RenderableLink): number {
        // Use existing ConsolidatedRelationshipUtils for all sophisticated calculations
        const isConsolidated = ConsolidatedRelationshipUtils.isConsolidated(link);
        const relationshipCount = ConsolidatedRelationshipUtils.getRelationshipCount(link);
        const effectiveStrength = ConsolidatedRelationshipUtils.getEffectiveStrength(link);
        const visualProps = ConsolidatedRelationshipUtils.getVisualProperties(link);
        
        // Start with base visual properties opacity
        let baseOpacity = visualProps.opacity;
        
        // All sophisticated opacity logic from original LinkRenderer
        if (link.type === 'shared_keyword') {
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
            baseOpacity = Math.min(0.9, 0.5 + (relationshipCount - 1) * 0.1);
        }
        
        // Consolidation boost for multi-relationship links
        if (isConsolidated && relationshipCount >= 3) {
            const consolidationBonus = Math.min(0.2, (relationshipCount - 1) * 0.02);
            baseOpacity = Math.min(0.95, baseOpacity + consolidationBonus);
        }
        
        // Strength-based adjustments for consolidated relationships
        if (isConsolidated) {
            const strengthMultiplier = 0.8 + (effectiveStrength * 0.2);
            baseOpacity = baseOpacity * strengthMultiplier;
        }
        
        return Math.max(0.1, Math.min(1.0, baseOpacity));
    }
    
    /**
     * ENHANCED: Calculate final opacity with smooth progressive reveal
     */
    public calculateFinalLinkOpacity(link: RenderableLink): number {
        // Get sophisticated visual opacity from cache
        let visualOpacity = this.visualOpacityCache.get(link.id);
        
        if (visualOpacity === undefined) {
            visualOpacity = this.calculateSophisticatedVisualOpacity(link);
            this.visualOpacityCache.set(link.id, visualOpacity);
        }
        
        // ENHANCED: Apply smooth reveal factor based on individual link progress
        const revealFactor = this.getLinkRevealFactorForLink(link.id);
        const finalOpacity = revealFactor * visualOpacity;
        
        // Cache the result
        this.linkOpacityCache.set(link.id, finalOpacity);
        
        return finalOpacity;
    }
    
    /**
     * NEW: Get reveal factor for individual link with smooth easing
     */
    private getLinkRevealFactorForLink(linkId: string): number {
        if (!this.linkRenderingEnabled) return 0;
        
        if (this.linkOpacityState === 'hidden') return 0;
        if (this.linkOpacityState === 'revealed') return 1;
        
        // During reveal phase, calculate smooth progress
        const now = Date.now();
        const elapsed = now - this.linkRevealStartTime;
        const totalRevealTime = this.config.linkRevealDuration;
        
        // Global progress (0-1)
        const globalProgress = Math.min(1, elapsed / totalRevealTime);
        
        // Get this link's start time in the sequence
        const linkStartProgress = this.linkRevealProgress.get(linkId) || 0;
        
        // Calculate when this link should start and end revealing
        const staggerRatio = this.config.linkStaggerDuration / totalRevealTime;
        const linkRevealDuration = 1 - staggerRatio; // Time for individual link to reveal
        
        // This link's progress window
        const linkStart = linkStartProgress * staggerRatio;
        const linkEnd = linkStart + linkRevealDuration;
        
        // Calculate this link's individual progress
        let linkProgress = 0;
        if (globalProgress >= linkEnd) {
            linkProgress = 1;
        } else if (globalProgress > linkStart) {
            linkProgress = (globalProgress - linkStart) / linkRevealDuration;
        }
        
        // Apply smooth easing for organic feel
        return this.easeInOutCubic(linkProgress);
    }
    
    /**
     * Update all link opacities with smooth progressive reveal
     */
    private updateAllLinkOpacities(): void {
        if (this.currentLinks.length === 0) return;
        
        // Clear final opacity cache to force recalculation
        this.linkOpacityCache.clear();
        
        // Calculate new final opacities
        const linkOpacities = new Map<string, number>();
        
        this.currentLinks.forEach(link => {
            const finalOpacity = this.calculateFinalLinkOpacity(link);
            linkOpacities.set(link.id, finalOpacity);
        });
        
        // Notify subscribers
        this.callbacks.onLinkOpacityUpdate(linkOpacities);
        
        // Update CSS custom properties
        this.updateCSSCustomProperties(linkOpacities);
    }
    
    /**
     * ENHANCED: Smoother CSS updates without staggering (handled by reveal logic)
     */
    private updateCSSCustomProperties(linkOpacities: Map<string, number>): void {
        if (typeof document === 'undefined') return;
        
        const root = document.documentElement;
        
        // Update all CSS properties immediately - smoothness comes from the values
        linkOpacities.forEach((opacity, linkId) => {
            root.style.setProperty(`--link-${linkId}-opacity`, opacity.toString());
        });
    }
    
    /**
     * Get whether links should be rendered
     */
    public getShouldRenderLinks(): boolean {
        return this.linkRenderingEnabled;
    }
    
    /**
     * Get reveal factor for LinkRenderer compatibility
     */
    public getLinkRevealFactor(): number {
        return this.linkRenderingEnabled ? 1 : 0;
    }
    
    /**
     * ENHANCED: Settlement complete with smooth progressive reveal
     */
    public onSettlementComplete(): void {
        console.log('[OpacityController] Settlement complete, starting smooth link reveal');
        
        this.linkRenderingEnabled = true;
        this.linkOpacityState = 'revealing';
        this.linkRevealStartTime = Date.now() + this.config.linkRevealDelay;
        
        // Start the smooth reveal sequence
        this.startLinkRevealAnimation();
        
        // Update container state
        this.triggerContainerStateChange();
        
        // Notify callbacks
        if (this.callbacks.onLinkRenderingEnabled) {
            this.callbacks.onLinkRenderingEnabled();
        }
    }
    
    /**
     * NEW: Start smooth link reveal animation
     */
    private startLinkRevealAnimation(): void {
        const animate = () => {
            const now = Date.now();

            // Check if already revealed to prevent excessive updates
        if (this.linkOpacityState === 'revealed') {
            return;
        }
            
            // Wait for delay before starting
            if (now < this.linkRevealStartTime) {
                this.linkAnimationFrameId = requestAnimationFrame(animate);
                return;
            }
            
            // Update all link opacities
            this.updateAllLinkOpacities();
            
            // Check if reveal is complete
            const elapsed = now - this.linkRevealStartTime;
            if (elapsed >= this.config.linkRevealDuration) {
                this.linkOpacityState = 'revealed';
                this.linkAnimationFrameId = null;
                console.log('[OpacityController] Link reveal animation complete');
                
                // Final update to ensure all links are at full opacity
                this.updateAllLinkOpacities();
                return;
            }
            
            // Continue animation
            this.linkAnimationFrameId = requestAnimationFrame(animate);
        };
        
        // Start the animation
        this.linkAnimationFrameId = requestAnimationFrame(animate);
    }
    
    /**
     * Trigger container-level CSS state change
     */
    private triggerContainerStateChange(): void {
        if (typeof window === 'undefined') return;
        
        console.log('[OpacityController] Triggering container state change for smooth reveal');
        
        const container = document.querySelector('.universal-graph');
        if (container) {
            container.classList.remove('revealing');
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
        
        const legacyEvent = new CustomEvent('phantom-links-state-change', {
            detail: {
                enabled: this.linkRenderingEnabled,
                revealState: 'revealing',
                linksCount: this.currentLinks.length
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
     * Configure link reveal timing specifically
     */
    public configureLinkReveal(duration: number, pattern: LinkRevealPattern, staggerDuration: number, delay: number = 500): void {
        this.config.linkRevealDuration = Math.max(1000, Math.min(10000, duration));
        this.config.linkRevealPattern = pattern;
        this.config.linkStaggerDuration = Math.max(500, Math.min(5000, staggerDuration));
        this.config.linkRevealDelay = Math.max(0, Math.min(2000, delay));
        
        console.log('[OpacityController] Link reveal configured:', {
            duration: this.config.linkRevealDuration,
            pattern: this.config.linkRevealPattern,
            stagger: this.config.linkStaggerDuration,
            delay: this.config.linkRevealDelay
        });
    }
    
    // ... (Keep all existing node opacity methods unchanged)
    
    /**
     * Set initial opacity for nodes during creation
     */
    public setInitialNodeOpacity(node: EnhancedNode): void {
        if (node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence') {
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
     * Set initial state for links
     */
    public setInitialLinkOpacity(link: EnhancedLink): void {
        if (!link.metadata) {
            link.metadata = {};
        }
    }
    
    /**
     * Calculate opacity for renderable nodes
     */
    public calculateNodeOpacity(node: RenderableNode): number {
        if ((node as any).opacity !== undefined && (node as any).opacity !== null) {
            return (node as any).opacity;
        }
        
        if (node.isHidden) {
            return 1;
        }
        
        return 1;
    }
    
    /**
     * Calculate link opacity
     */
    public calculateLinkOpacity(link: RenderableLink): number {
        return this.calculateFinalLinkOpacity(link);
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
            if (node.type !== 'statement' && node.type !== 'openquestion' &&
                node.type !== 'answer' && node.type !== 'quantity' && node.type !== 'evidence') {
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
     * Smooth easing functions
     */
    private easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }
    
    private easeInOutCubic(t: number): number {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * Force reveal all nodes and links immediately (for debugging)
     */
    public forceRevealAll(nodes: EnhancedNode[]): void {
        console.log('[OpacityController] Force revealing all nodes and links');
        
        // Stop any ongoing animations
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.linkAnimationFrameId) {
            cancelAnimationFrame(this.linkAnimationFrameId);
            this.linkAnimationFrameId = null;
        }
        
        // Set states
        this.nodeOpacityState = 'revealed';
        this.linkOpacityState = 'revealed';
        this.linkRenderingEnabled = true;
        
        // Set full opacity for nodes
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update all link opacities
        this.updateAllLinkOpacities();
        
        // Trigger callbacks
        this.callbacks.onNodeOpacityUpdate(nodes);
        this.callbacks.onRevealComplete();
        
        // Trigger container state change
        this.triggerContainerStateChange();
    }
    
    /**
     * Reset with phantom links control
     */
    public reset(): void {
        console.log('[OpacityController] RESET - clearing all opacity state');
        
        // Stop any ongoing animations
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.linkAnimationFrameId) {
            cancelAnimationFrame(this.linkAnimationFrameId);
            this.linkAnimationFrameId = null;
        }
        
        // Reset states
        this.nodeOpacityState = 'hidden';
        this.linkOpacityState = 'hidden';
        this.revealStartTime = 0;
        this.linkRevealStartTime = 0;
        
        // Disable phantom links and clear caches
        this.linkRenderingEnabled = false;
        this.linkOpacityCache.clear();
        this.visualOpacityCache.clear();
        this.linkRevealProgress.clear();
        
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
        linkState: OpacityState;
        linkProgress: number;
    } {
        const now = Date.now();
        
        const nodeProgress = this.nodeOpacityState === 'revealing' && this.revealStartTime > 0
            ? Math.min(1, (now - this.revealStartTime) / this.config.revealDuration)
            : (this.nodeOpacityState === 'revealed' ? 1 : 0);
            
        const linkProgress = this.linkOpacityState === 'revealing' && this.linkRevealStartTime > 0
            ? Math.min(1, Math.max(0, (now - this.linkRevealStartTime)) / this.config.linkRevealDuration)
            : (this.linkOpacityState === 'revealed' ? 1 : 0);
            
        return {
            nodeState: this.nodeOpacityState,
            nodeProgress,
            pattern: this.config.revealPattern,
            duration: this.config.revealDuration,
            linkRenderingEnabled: this.linkRenderingEnabled,
            linkRevealFactor: this.getLinkRevealFactor(),
            linkCount: this.currentLinks.length,
            linkState: this.linkOpacityState,
            linkProgress
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
        if (this.linkAnimationFrameId) {
            cancelAnimationFrame(this.linkAnimationFrameId);
            this.linkAnimationFrameId = null;
        }
        
        // Clear all caches
        this.linkOpacityCache.clear();
        this.visualOpacityCache.clear();
        this.linkRevealProgress.clear();
        this.currentLinks = [];
    }

    /**
     * DEBUG: Force enable method for testing
     */
    public debugForceEnable(): void {
        console.log('[OpacityController] Debug force enable');
        
        this.linkRenderingEnabled = true;
        this.linkOpacityState = 'revealed';
        
        // Update all link opacities
        this.updateAllLinkOpacities();
        
        // Trigger container state change
        this.triggerContainerStateChange();
    }
}