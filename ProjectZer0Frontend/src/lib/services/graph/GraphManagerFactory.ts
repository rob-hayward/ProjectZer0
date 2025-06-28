// src/lib/services/graph/GraphManagerFactory.ts
// Factory for creating optimized graph managers based on view type

import type { ViewType } from '$lib/types/graph/enhanced';
import { GraphManager } from './GraphManager';
import { UniversalGraphManager } from './UniversalGraphManager';

/**
 * Interface that both managers must implement
 */
export interface IGraphManager {
    // Core data management
    setData(data: any, config?: any): void;
    
    // Node operations
    updateNodeMode(nodeId: string, mode: any): void;
    updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason?: 'community' | 'user'): void;
    applyVisibilityPreferences(preferences: Record<string, boolean>): void;
    
    // Simulation control
    stop(): void;
    forceTick(ticks?: number): void;
    
    // View management
    updateViewType?(viewType: ViewType): void;
    
    // Performance monitoring
    getPerformanceMetrics?(): any;
    
    // Store access
    renderableNodes: any;
    renderableLinks: any;
    viewType?: ViewType;
}

/**
 * Factory class for creating optimized graph managers
 */
export class GraphManagerFactory {
    /**
     * Create an optimized graph manager based on view type
     */
    static createManager(viewType: ViewType): IGraphManager {
        switch (viewType) {
            case 'universal':
                console.log('[GraphManagerFactory] Creating specialized UniversalGraphManager for optimal performance');
                return new UniversalGraphManager();
                
            default:
                console.log(`[GraphManagerFactory] Creating standard GraphManager for view: ${viewType}`);
                return new GraphManager(viewType);
        }
    }
    
    /**
     * Check if a view type has a specialized manager
     */
    static hasSpecializedManager(viewType: ViewType): boolean {
        return viewType === 'universal';
    }
    
    /**
     * Get performance characteristics for a view type
     */
    static getPerformanceInfo(viewType: ViewType): {
        managerType: 'standard' | 'specialized';
        optimizations: string[];
        expectedBenefits: string[];
    } {
        switch (viewType) {
            case 'universal':
                return {
                    managerType: 'specialized',
                    optimizations: [
                        'Consolidated relationship processing',
                        'Optimized D3 force simulation',
                        'Performance metrics tracking',
                        'Cached link path calculation',
                        'Batch visibility updates'
                    ],
                    expectedBenefits: [
                        '70% reduction in rendered links',
                        'Faster graph settling',
                        'Smoother interactions',
                        'Reduced memory usage',
                        'Real-time performance monitoring'
                    ]
                };
                
            default:
                return {
                    managerType: 'standard',
                    optimizations: [
                        'Multi-view support',
                        'Dynamic layout strategies',
                        'Comprehensive node type handling'
                    ],
                    expectedBenefits: [
                        'Supports all graph view types',
                        'Consistent behavior across views',
                        'Full feature compatibility'
                    ]
                };
        }
    }
}

/**
 * Helper function for backward compatibility
 * Can be used to replace direct GraphManager instantiation
 */
export function createGraphManager(viewType: ViewType): IGraphManager {
    return GraphManagerFactory.createManager(viewType);
}

/**
 * Type guard to check if manager is the specialized universal manager
 */
export function isUniversalGraphManager(manager: IGraphManager): manager is UniversalGraphManager {
    return manager instanceof UniversalGraphManager;
}