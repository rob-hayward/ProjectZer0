<!-- src/lib/components/graph/Graph.svelte -->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
    import type { BackgroundConfig } from '$lib/types/graph/background';
    import type { 
        GraphData, 
        ViewType, 
        NodeMode,
        RenderableNode
    } from '$lib/types/graph/enhanced';
    import { DEFAULT_BACKGROUND_CONFIG } from '$lib/types/graph/background';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import { createGraphStore, type GraphStore } from '$lib/stores/graphStore';
    import { COORDINATE_SPACE } from '$lib/constants/graph';
    import LinkRenderer from './links/LinkRenderer.svelte';
    import NodeRenderer from './nodes/NodeRenderer.svelte';
    import GraphDebugVisualizer from '../debug/GraphDebugVisualizer.svelte';
    import { coordinateSystem } from '$lib/services/graph/CoordinateSystem';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { userStore } from '$lib/stores/userStore';

    // Enable debug mode for statement network view
    const DEBUG_MODE = true; // Set to true to enable debugging
    const debugLog = DEBUG_MODE ? console.debug : () => {};

    // Initialize visibility store as early as possible
    visibilityStore.initialize();

    // Props
    export let data: GraphData;
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    
    // These props are kept but not directly used (for backward compatibility)
    // Convert to export const to avoid Svelte warnings
    export const isPreviewMode = false;
    export const width = COORDINATE_SPACE.WORLD.WIDTH;
    export const height = COORDINATE_SPACE.WORLD.HEIGHT;

    // Event dispatch for node mode changes
    const dispatch = createEventDispatcher<{
        modechange: { nodeId: string; mode: NodeMode };
        visibilitychange: { nodeId: string; isHidden: boolean };
    }>();

    // DOM references
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    
    // Component state
    let graphStore: GraphStore;
    let background: SvgBackground | null = null;
    let initialTransform: d3.ZoomTransform;
    let resetZoom: (() => void) | undefined;
    let containerDimensions = {
        width: 0,
        height: 0
    };
    let initialized = false;
    let showDebug = false;
    
    // Add debug info for the central node
    let centralNodePos = { x: 0, y: 0, transform: "", viewX: 0, viewY: 0 };
    let svgViewportInfo = { width: 0, height: 0, viewBox: "", preserveAspectRatio: "" };
    
    // ViewBox tracking
    let viewBoxObserver: MutationObserver | null = null;
    let initialViewBox = "";
    let viewBoxChangeCount = 0;
    let viewBoxEvents: {time: number, value: string, source: string}[] = [];
    
    // Add a flag to track if we've already applied preferences
    let preferencesApplied = false;

    // Constants - USING VALUES FROM COORDINATE_SPACE
    const worldDimensions = {
        width: COORDINATE_SPACE.WORLD.WIDTH,
        height: COORDINATE_SPACE.WORLD.HEIGHT,
        // Ensure viewBox is precisely centered at origin (0,0)
        viewBox: `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`
    };

    // Background configuration
    const mergedBackgroundConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };

    /**
     * Monitor viewBox changes
     */
    function monitorViewBox() {
        if (!svg) return null;
        
        // Log initial viewBox
        initialViewBox = svg.getAttribute('viewBox') || "";
        debugLog('[ViewBox Debug] Initial viewBox:', initialViewBox);
        
        // Add to event log
        viewBoxEvents.push({
            time: Date.now(),
            value: initialViewBox,
            source: 'initial'
        });
        
        // Set up mutation observer to detect viewBox changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'viewBox') {
                    const newViewBox = svg.getAttribute('viewBox');
                    viewBoxChangeCount++;
                    
                    // Log the change
                    console.warn('[ViewBox Debug] ViewBox changed:', {
                        count: viewBoxChangeCount,
                        from: initialViewBox,
                        to: newViewBox,
                        // Capture a simplified stack trace to find where the change is coming from
                        stack: new Error().stack?.split('\n').slice(1, 5).join('\n')
                    });
                    
                    // Add to event log
                    viewBoxEvents.push({
                        time: Date.now(),
                        value: newViewBox || "",
                        source: 'mutation'
                    });
                    
                    // Update viewport info
                    updateSvgViewportInfo();
                    
                    // EXPERIMENTAL: Force viewBox back to initial if it was changed
                    if (newViewBox !== initialViewBox) {
                        console.warn('[ViewBox Debug] Forcing viewBox back to initial value');
                        
                        // Use requestAnimationFrame to avoid potential mutation loops
                        requestAnimationFrame(() => {
                            svg.setAttribute('viewBox', initialViewBox);
                            
                            // Add to event log
                            viewBoxEvents.push({
                                time: Date.now(),
                                value: initialViewBox,
                                source: 'forced-reset'
                            });
                        });
                    }
                }
            });
        });
        
        // Start observing the SVG element
        observer.observe(svg, {
            attributes: true,
            attributeFilter: ['viewBox']
        });
        
        return observer;
    }

    /**
     * Update container dimensions when resized
     */
    function updateContainerDimensions() {
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        containerDimensions = {
            width: rect.width,
            height: rect.height
        };
        
        if (background) {
            background.resize(rect.width, rect.height);
        }
        
        // Update SVG viewport info for debugging
        if (svg && DEBUG_MODE) {
            updateSvgViewportInfo();
        }
    }
    
    /**
     * Update SVG viewport info for debugging
     */
    function updateSvgViewportInfo() {
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        svgViewportInfo = {
            width: rect.width,
            height: rect.height,
            viewBox: svg.getAttribute('viewBox') || '',
            preserveAspectRatio: svg.getAttribute('preserveAspectRatio') || ''
        };
        
        if (DEBUG_MODE) {
            console.log('[Graph] SVG Viewport Info:', svgViewportInfo);
            
            // Add to event log
            viewBoxEvents.push({
                time: Date.now(),
                value: svgViewportInfo.viewBox,
                source: 'viewport-update'
            });
        }
    }

    /**
     * Initialize the background visualization
     */
    function initializeBackground() {
        if (!backgroundGroup) return;
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                containerDimensions.width, 
                containerDimensions.height,
                mergedBackgroundConfig
            );
            background.start();
        } catch (error) {
            console.error('[Graph] Error initializing background:', error);
        }
    }

    function initializeZoom() {
    if (!svg || !contentGroup) return;

    // First, explicitly set transform-origin to center on both groups
    contentGroup.style.transformOrigin = "center";
    
    if (backgroundGroup) {
        backgroundGroup.style.transformOrigin = "center";
    }

    // Get initial zoom level from constants
    const initialZoomLevel = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
        
    // Create initial transform WITHOUT any translation to keep (0,0) at the center
    initialTransform = d3.zoomIdentity.scale(initialZoomLevel);
        
    // Initialize the coordinate system with the initial transform
    coordinateSystem.updateTransform(initialTransform);

    // Configure zoom behavior using values from constants
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([
            COORDINATE_SPACE.WORLD.VIEW.MIN_ZOOM,
            COORDINATE_SPACE.WORLD.VIEW.MAX_ZOOM
        ])
        .on('start', () => {
            // Dispatch zoom start event
            window.dispatchEvent(new CustomEvent('zoom-start'));
        })
        .on('zoom', (event) => {
            const transform = event.transform;
            
            // Apply transform to SVG content groups - DON'T modify CSS transform
            d3.select(contentGroup).attr('transform', transform.toString());
            d3.select(backgroundGroup).attr('transform', transform.toString());
            
            // Update the coordinate system with the current transform
            coordinateSystem.updateTransform(transform);
            
            if (DEBUG_MODE && showDebug) {
                debugLog('[Graph] Zoom updated:', {
                    scale: transform.k,
                    translate: [transform.x, transform.y]
                });
            }
            
            // For statement network view, enforce fixed positions during zoom
            if (viewType === 'statement-network' && graphStore) {
                graphStore.fixNodePositions();
                if (DEBUG_MODE) updateCentralNodeDebugPosition();
            }
        })
        .on('end', () => {
            // Dispatch zoom end event
            window.dispatchEvent(new CustomEvent('zoom-end'));
            
            // For statement network view, enforce fixed positions after zoom
            if (viewType === 'statement-network' && graphStore) {
                graphStore.fixNodePositions();
                graphStore.forceTick(2);
                if (DEBUG_MODE) updateCentralNodeDebugPosition();
            }
        });

    // Apply zoom behavior to SVG with initial transform
    d3.select(svg)
        .call(zoom)
        .call(zoom.transform, initialTransform)
        .on('contextmenu', (event) => event.preventDefault());

    // Function to reset zoom
    resetZoom = () => {
        d3.select(svg)
            .transition()
            .duration(750)
            .call(zoom.transform, initialTransform);
    };
    
    // Log the initialization for debugging
    if (DEBUG_MODE) {
        console.log('[Graph] Zoom initialized with transform:', initialTransform.toString());
    }
}
    
    /**
     * Update debug information for the central node's position
     */
    function updateCentralNodeDebugPosition() {
        if (!$graphStore || !$graphStore.nodes || !DEBUG_MODE) return;
        
        // Find the central node
        const centralNode = $graphStore.nodes.find(node => 
            node.group === 'central' || (node.data && 'sub' in node.data && node.data.sub === 'controls')
        );
        
        if (centralNode) {
            // Get logical coordinates
            const nodeX = centralNode.position.x;
            const nodeY = centralNode.position.y;
            
            // Get view coordinates
            const viewCoords = coordinateSystem.worldToView(nodeX, nodeY);
            
            centralNodePos = {
                x: nodeX,
                y: nodeY,
                transform: centralNode.position.svgTransform,
                viewX: viewCoords.x,
                viewY: viewCoords.y
            };
            
            if (DEBUG_MODE) {
                console.log('[Graph] Central node debug position:', centralNodePos);
            }
        } else if (DEBUG_MODE) {
            console.log('[Graph] Central node not found for debug info');
        }
    }

    /**
     * Handle node mode change events
     */
    function handleModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        // Notify the graph store
        if (graphStore) {
            graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
        }
        
        // Forward the event to parent
        dispatch('modechange', event.detail);
    }

    /**
     * Handle node visibility change events
     */
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        // Notify the graph store
        if (graphStore) {
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden, 'user');
        }
        
        // Forward the event to parent
        dispatch('visibilitychange', event.detail);
        
        // Save preference to store (true = visible, false = hidden)
        visibilityStore.setPreference(event.detail.nodeId, !event.detail.isHidden);
    }

    /**
     * Toggle debug mode
     */
    function toggleDebug() {
        showDebug = !showDebug;
        
        if (showDebug && DEBUG_MODE) {
            // Log current coordinate system info in debug mode
            const transform = coordinateSystem.getCurrentTransform();
            debugLog('[Graph] Current coordinate system:', {
                scale: transform.k,
                translate: [transform.x, transform.y],
                worldOriginInView: coordinateSystem.worldToView(0, 0)
            });
            
            // Update central node position
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
            
            // Inspect the transform hierarchy and styles
            inspectTransformHierarchy();
            debugSVGStyles();
        }
    }
    
    /**
     * Inspect all transforms in the SVG hierarchy
     */
    function inspectTransformHierarchy() {
        if (!svg || !contentGroup) return;
        
        console.log('[Transform Debug] Inspecting transform hierarchy:');
        
        // Start from the contentGroup
        let element: Element | null = contentGroup;
        let level = 0;
        
        // Create a path description to track hierarchy
        let path = "contentGroup";
        
        while (element && element !== (svg.parentElement as Element)) {
            // Check for transforms
            const transform = element.getAttribute('transform');
            const computedStyle = window.getComputedStyle(element);
            const cssTransform = computedStyle.transform;
            
            console.log(`[Level ${level}] ${element.tagName} (${path}):`, {
                id: element.id || 'no-id',
                svgTransform: transform || 'none',
                cssTransform: cssTransform === 'none' ? 'none' : cssTransform,
                classList: Array.from(element.classList),
                parentNode: element.parentNode instanceof Element ? element.parentNode.tagName : 'unknown'
            });
            
            // Move up the tree
            element = element.parentElement;
            level++;
            path = element ? `${element.tagName}.${path}` : path;
            
            // Avoid infinite loops, stop after a reasonable depth
            if (level > 10) break;
        }
        
        // Also check the backgroundGroup
        if (backgroundGroup) {
            const bgTransform = backgroundGroup.getAttribute('transform');
            const bgComputedStyle = window.getComputedStyle(backgroundGroup);
            const bgCssTransform = bgComputedStyle.transform;
            
            console.log('[Transform Debug] Background group:', {
                svgTransform: bgTransform || 'none',
                cssTransform: bgCssTransform === 'none' ? 'none' : bgCssTransform,
                classList: Array.from(backgroundGroup.classList)
            });
        }
    }

    /**
     * Reset all transforms in the SVG to initial values
     */
    function resetAllTransforms() {
        if (!contentGroup || !backgroundGroup) return;
        
        console.log('[Transform Debug] Resetting all transforms to initial state');
        
        // Initial transform from our configuration
        const initialScale = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
        const transformValue = `translate(0,0) scale(${initialScale})`;
        
        // Apply to content group
        contentGroup.setAttribute('transform', transformValue);
        
        // Apply to background group
        backgroundGroup.setAttribute('transform', transformValue);
        
        // Update coordinate system
        coordinateSystem.updateTransform(d3.zoomIdentity.scale(initialScale));
        
        // Force update
        setTimeout(() => {
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
            
            // Log the results
            inspectTransformHierarchy();
        }, 50);
    }

    /**
     * Fix transform completely by removing CSS transforms and enforcing attribute transforms
     */
    function fixTransformCompletely() {
        if (!contentGroup || !backgroundGroup) return;
        
        console.log('[Fix] Current state before complete fix:', {
            contentCSS: window.getComputedStyle(contentGroup).transform,
            contentOrigin: window.getComputedStyle(contentGroup).transformOrigin,
            contentAttr: contentGroup.getAttribute('transform'),
            bgCSS: window.getComputedStyle(backgroundGroup).transform,
            bgOrigin: window.getComputedStyle(backgroundGroup).transformOrigin,
            bgAttr: backgroundGroup.getAttribute('transform')
        });
        
        // Remove any CSS transforms
        contentGroup.style.transform = 'none';
        backgroundGroup.style.transform = 'none';
        
        // Set transform origin to center
        contentGroup.style.transformOrigin = 'center';
        backgroundGroup.style.transformOrigin = 'center';
        
        // Set SVG transform attributes explicitly
        const initialScale = COORDINATE_SPACE.WORLD.VIEW.INITIAL_ZOOM;
        contentGroup.setAttribute('transform', `translate(0,0) scale(${initialScale})`);
        backgroundGroup.setAttribute('transform', `translate(0,0) scale(${initialScale})`);
        
        // Update coordinate system
        coordinateSystem.updateTransform(d3.zoomIdentity.scale(initialScale));
        
        console.log('[Fix] Applied complete transform fix');
        
        // Force UI update
        setTimeout(() => {
            if (graphStore) {
                graphStore.forceTick(5);
                updateCentralNodeDebugPosition();
                
                // Log the result
                console.log('[Fix] State after complete fix:', {
                    contentCSS: window.getComputedStyle(contentGroup).transform,
                    contentOrigin: window.getComputedStyle(contentGroup).transformOrigin,
                    contentAttr: contentGroup.getAttribute('transform'),
                    bgCSS: window.getComputedStyle(backgroundGroup).transform,
                    bgOrigin: window.getComputedStyle(backgroundGroup).transformOrigin,
                    bgAttr: backgroundGroup.getAttribute('transform')
                });
            }
        }, 50);
        
        // Reset zoom to make sure it's in sync
        if (resetZoom) {
            setTimeout(resetZoom, 100);
        }
    }
    
    /**
     * Debug SVG and content styles that could affect positioning
     */
    function debugSVGStyles() {
        if (!svg || !contentGroup) return;
        
        // Check CSS properties that could affect positioning
        const svgStyle = window.getComputedStyle(svg);
        const contentStyle = window.getComputedStyle(contentGroup);
        
        console.log('[Style Debug] SVG styles:', {
            position: svgStyle.position,
            top: svgStyle.top,
            left: svgStyle.left,
            width: svgStyle.width,
            height: svgStyle.height,
            transform: svgStyle.transform,
            transformOrigin: svgStyle.transformOrigin
        });
        
        console.log('[Style Debug] Content group styles:', {
            position: contentStyle.position,
            transform: contentStyle.transform,
            transformOrigin: contentStyle.transformOrigin
        });
        
        // Additional check for any transforms on the main container
        if (container) {
            const containerStyle = window.getComputedStyle(container);
            console.log('[Style Debug] Container styles:', {
                position: containerStyle.position,
                transform: containerStyle.transform,
                transformOrigin: containerStyle.transformOrigin
            });
        }
    }
    
    /**
     * Fix transform origin issue that's causing offset
     */
    function fixTransformOrigin() {
        if (!contentGroup) return;
        
        console.log('[Fix] Current transform origin:', window.getComputedStyle(contentGroup).transformOrigin);
        
        // Set transform origin to the center
        contentGroup.style.transformOrigin = "center";
        
        // Remove the CSS transform completely - rely only on SVG attribute transform
        contentGroup.style.transform = "none";
        
        // Make sure the SVG transform attribute is correct
        const currentTransform = contentGroup.getAttribute('transform') || 'translate(0,0) scale(2.5)';
        contentGroup.setAttribute('transform', currentTransform);
        
        console.log('[Fix] Applied transform origin fix to content group');
        
        // If needed, also apply to background group
        if (backgroundGroup) {
            backgroundGroup.style.transformOrigin = "center";
            backgroundGroup.style.transform = "none";
            
            const bgTransform = backgroundGroup.getAttribute('transform') || 'translate(0,0) scale(2.5)';
            backgroundGroup.setAttribute('transform', bgTransform);
            
            console.log('[Fix] Applied transform origin fix to background group');
        }
        
        // Force a tick after the fix
        setTimeout(() => {
            if (graphStore) {
                graphStore.forceTick(3);
                updateCentralNodeDebugPosition();
            }
        }, 50);
    }

    /**
     * Apply view-specific behaviors
     * Handles special cases for statement network view
     */
    function applyViewSpecificBehavior() {
        if (!graphStore) return;
        
        // Special handling for statement-network view
        if (viewType === 'statement-network') {
            if (DEBUG_MODE) console.log('[Graph] Applying statement network specific behavior');
            
            // Fix positions more aggressively
            graphStore.fixNodePositions();
            graphStore.forceTick(3);
            
            // Update debug info if needed
            if (DEBUG_MODE) {
                updateCentralNodeDebugPosition();
                updateSvgViewportInfo();
            }
        }
    }

    /**
     * Reset viewport to default state
     */
    function resetViewport() {
        if (!svg || !resetZoom) return;
        
        // Reset zoom to initial state
        resetZoom();
        
        // Update debug info if needed
        if (DEBUG_MODE) {
            setTimeout(() => {
                updateCentralNodeDebugPosition();
                updateSvgViewportInfo();
            }, 100);
        }
    }
    
    /**
     * Lock the viewBox to ensure it doesn't change
     */
    function lockViewBox() {
        if (!svg) return;
        
        // Store current viewBox
        const currentViewBox = svg.getAttribute('viewBox');
        
        if (currentViewBox) {
            console.log('[ViewBox Debug] Locking viewBox to:', currentViewBox);
            initialViewBox = currentViewBox;
            
            // Add to event log
            viewBoxEvents.push({
                time: Date.now(),
                value: currentViewBox,
                source: 'lock'
            });
            
            // Force viewBox to stay at this value (bypassing MutationObserver)
            if (viewBoxObserver) {
                viewBoxObserver.disconnect();
            }
            
            // Set the attribute directly
            svg.setAttribute('viewBox', currentViewBox);
            
            // Reconnect observer
            if (viewBoxObserver) {
                viewBoxObserver.observe(svg, {
                    attributes: true,
                    attributeFilter: ['viewBox']
                });
            }
        }
    }
    
    /**
     * Force the viewBox to the initial centered state
     */
    function forceViewBoxReset() {
        if (!svg) return;
        
        // Calculate the centered viewBox
        const centeredViewBox = `${-COORDINATE_SPACE.WORLD.WIDTH/2} ${-COORDINATE_SPACE.WORLD.HEIGHT/2} ${COORDINATE_SPACE.WORLD.WIDTH} ${COORDINATE_SPACE.WORLD.HEIGHT}`;
        
        console.log('[ViewBox Debug] Forcing viewBox reset to:', centeredViewBox);
        
        // Set the viewBox directly
        svg.setAttribute('viewBox', centeredViewBox);
        initialViewBox = centeredViewBox;
        
        // Add to event log
        viewBoxEvents.push({
            time: Date.now(),
            value: centeredViewBox,
            source: 'manual-reset'
        });
        
        // Update viewport info
        updateSvgViewportInfo();
    }
    
    /**
     * Show viewBox changes log
     */
    function showViewBoxLog() {
        console.table(viewBoxEvents);
    }

    /**
     * Initialize the component
     */
    function initialize() {
        if (initialized) return;
        
        debugLog(`[Graph] Initializing graph component`, { viewType, dataNodes: data?.nodes?.length });
        
        // Create graph store for this view
        graphStore = createGraphStore(viewType);
        
        // Initialize zoom and background
        updateContainerDimensions();
        initializeZoom();
        initializeBackground();
        
        // Special handling for statement-network to ensure stability
        if (viewType === 'statement-network') {
            if (DEBUG_MODE) console.log('[Graph] Initializing with statement network view');
            
            // Initialize with data with explicit position enforcement
            if (data) {
                graphStore.setData(data, { skipAnimation: true });
                graphStore.fixNodePositions();
                graphStore.forceTick(5); // More ticks for statement network
                
                // Need a second round of fixes after the initial ticks
                setTimeout(() => {
                    if (graphStore) {
                        graphStore.fixNodePositions();
                        graphStore.forceTick(3);
                        if (DEBUG_MODE) {
                            updateCentralNodeDebugPosition();
                            updateSvgViewportInfo();
                        }
                    }
                }, 50);
            }
        } else {
            // Normal initialization for other views
            if (data) {
                graphStore.setData(data);
            }
        }
        
        initialized = true;
    }

    /**
     * Apply visibility preferences to current nodes
     */
    function applyVisibilityPreferences() {
        if (!graphStore) return;
        
        const preferences = visibilityStore.getAllPreferences();
        if (Object.keys(preferences).length > 0) {
            if (DEBUG_MODE) {
                debugLog('[Graph] Applying visibility preferences to graph nodes:', 
                    Object.keys(preferences).length);
            }
            
            // Use the new method to apply all preferences at once
            (graphStore as any).applyVisibilityPreferences(preferences);
        }
    }

    // Lifecycle hooks
    onMount(async () => {
        initialize();
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateContainerDimensions);
            
            // Load visibility preferences when component mounts
            if ($userStore) {
                // Apply any cached preferences immediately
                applyVisibilityPreferences();
                
                // Then load from backend and apply again
                await visibilityStore.loadPreferences();
                applyVisibilityPreferences();
            }
        }
        
        // Set up viewBox monitoring for debugging
        if (DEBUG_MODE) {
            viewBoxObserver = monitorViewBox();
            updateSvgViewportInfo();
        }
        
        // Force graph to center after a short delay
        if (viewType === 'statement-network') {
            setTimeout(() => {
                resetViewport();
                
                // For statement-network view, lock the viewBox after reset
                if (DEBUG_MODE) {
                    // Lock viewBox after a short delay to ensure it's fully settled
                    setTimeout(lockViewBox, 100);
                }
            }, 250);
        }
    });

    // When the graph data changes or we navigate to a new page,
    // make sure preferences are applied (but only once)
    afterUpdate(() => {
        if (data && graphStore && !preferencesApplied) {
            preferencesApplied = true; // Set the flag to prevent loops
            
            // Apply preferences immediately without timeout
            applyVisibilityPreferences();
        }
        
        // Apply view-specific behaviors after any update
        if (initialized && graphStore) {
            applyViewSpecificBehavior();
        }
        
        // Special debug logging for statement network view
        if (initialized && viewType === 'statement-network' && DEBUG_MODE) {
            updateCentralNodeDebugPosition();
            updateSvgViewportInfo();
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateContainerDimensions);
        }
        
        if (background) {
            background.destroy();
        }
        
        if (graphStore) {
            graphStore.dispose();
        }
        
        // Clean up viewBox observer
        if (viewBoxObserver) {
            viewBoxObserver.disconnect();
        }
    });

    // Reactive declarations
    
    // When data changes, reset the preferences flag
    $: if (data) {
        preferencesApplied = false;
    }
    
    // When viewType changes
    $: if (initialized && graphStore && viewType !== graphStore.getViewType()) {
        if (DEBUG_MODE) {
            debugLog('[Graph] View type changed:', { 
                from: graphStore.getViewType(), 
                to: viewType 
            });
        }
        graphStore.setViewType(viewType);
        
        // Special handling for statement network view
        if (viewType === 'statement-network') {
            // Wait for next tick to ensure view type is fully applied
            setTimeout(() => {
                if (graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(5);
                    if (DEBUG_MODE) {
                        updateCentralNodeDebugPosition();
                        updateSvgViewportInfo();
                    }
                    
                    // Reset viewport after a short delay
                    setTimeout(() => {
                        resetViewport();
                        
                        // Lock viewBox after reset for statement-network view
                        if (DEBUG_MODE) {
                            setTimeout(lockViewBox, 100);
                        }
                    }, 100);
                }
            }, 0);
        }
    }
    
    // When data changes
    $: if (initialized && graphStore && data) {
        // Use skipAnimation for statement network view
        if (viewType === 'statement-network') {
            // Check viewBox before data change
            if (DEBUG_MODE) {
                console.log('[ViewBox Debug] Before setData:', svg?.getAttribute('viewBox'));
                
                // Add to event log
                viewBoxEvents.push({
                    time: Date.now(),
                    value: svg?.getAttribute('viewBox') || "",
                    source: 'before-setData'
                });
            }
            
            graphStore.setData(data, { skipAnimation: true });
            
            // Ensure positions are fixed after data is set
            setTimeout(() => {
                if (graphStore) {
                    graphStore.fixNodePositions();
                    graphStore.forceTick(5);
                    
                    if (DEBUG_MODE) {
                        console.log('[ViewBox Debug] After setData:', svg?.getAttribute('viewBox'));
                        
                        // Add to event log
                        viewBoxEvents.push({
                            time: Date.now(),
                            value: svg?.getAttribute('viewBox') || "",
                            source: 'after-setData'
                        });
                        
                        updateCentralNodeDebugPosition();
                        updateSvgViewportInfo();
                    }
                    
                    // Reset viewport after a short delay
                    setTimeout(() => {
                        resetViewport();
                        
                        // Lock viewBox after reset
                        if (DEBUG_MODE) {
                            setTimeout(lockViewBox, 100);
                        }
                    }, 100);
                }
            }, 0);
        } else {
            graphStore.setData(data);
        }
    }
    
    // When container dimensions change
    $: if (initialized && containerDimensions.width && containerDimensions.height) {
        updateContainerDimensions();
    }
</script>

<div bind:this={container} class="graph-container">
    <svg 
        bind:this={svg}
        width="100%"
        height="100%"
        viewBox={worldDimensions.viewBox}
        preserveAspectRatio="xMidYMid meet"
        class="graph-svg"
    >
        <defs>
            <!-- Global filters and patterns could be added here -->
            <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feComposite in="blur" in2="SourceGraphic" operator="atop" />
            </filter>
        </defs>

        <!-- Background layer with no pointer events -->
        <g class="background-layer">
            <svg 
                width="100%"
                height="100%"
                overflow="visible"
            >
                <g bind:this={backgroundGroup} />
            </svg>
        </g>

        <!-- Content layer with graph elements -->
        <g 
            bind:this={contentGroup} 
            class="content-layer"
        >
            {#if initialized && graphStore}
                {#key graphStore.getViewType()}
                    <!-- Small center marker for visual reference -->
                    <g class="center-marker">
                        <circle cx="0" cy="0" r="3" fill="red" fill-opacity="0.5" />
                    </g>

                    <!-- Links layer -->
                    <g class="links-layer">
                        {#each $graphStore.links as link (link.id)}
                            <LinkRenderer {link} />
                            {#if showDebug}
                                <GraphDebugVisualizer {link} active={showDebug} />
                            {/if}
                        {/each}
                    </g>

                    <!-- Nodes layer -->
                    <g class="nodes-layer">
                        {#each $graphStore.nodes as node (node.id)}
                            <NodeRenderer 
                                {node}
                                on:modeChange={handleModeChange}
                                on:visibilityChange={handleVisibilityChange}
                            >
                                <svelte:fragment 
                                    slot="default" 
                                    let:node 
                                    let:handleModeChange
                                >
                                    <slot 
                                        {node} 
                                        {handleModeChange} 
                                    />
                                    {#if showDebug}
                                        <GraphDebugVisualizer {node} active={showDebug} />
                                    {/if}
                                </svelte:fragment>
                            </NodeRenderer>
                        {/each}
                    </g>

                    <!-- Debug overlay with expanded viewBox indicators -->
                    {#if showDebug}
                        <g class="debug-overlay">
                            <!-- Central axes -->
                            <line x1="-500" y1="0" x2="500" y2="0" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            <line x1="0" y1="-500" x2="0" y2="500" stroke="rgba(255,0,0,0.3)" stroke-width="1" />
                            
                            <!-- Origin marker -->
                            <circle cx="0" cy="0" r="5" fill="red" />
                            <text x="10" y="10" fill="white" font-size="12">Origin (0,0)</text>
                            
                            <!-- Zoom info -->
                            <text x="10" y="30" fill="white" font-size="12">
                                Zoom: {coordinateSystem.getCurrentTransform().k.toFixed(2)}
                            </text>
                            
                            <!-- Central node position -->
                            <text x="10" y="50" fill="white" font-size="12">
                                Central: ({centralNodePos.x.toFixed(1)}, {centralNodePos.y.toFixed(1)})
                            </text>
                            
                            <!-- ViewBox boundary markers -->
                            <g class="viewbox-debug">
                                <!-- Top-left corner -->
                                <circle cx={-1000} cy={-1000} r="5" fill="red" />
                                <text x={-990} y={-990} fill="white" font-size="10">Top-Left</text>
                                
                                <!-- Top-right corner -->
                                <circle cx={1000} cy={-1000} r="5" fill="blue" />
                                <text x={990} y={-990} fill="white" font-size="10" text-anchor="end">Top-Right</text>
                                
                                <!-- Bottom-left corner -->
                                <circle cx={-1000} cy={1000} r="5" fill="green" />
                                <text x={-990} y={990} fill="white" font-size="10">Bottom-Left</text>
                                
                                <!-- Bottom-right corner -->
                                <circle cx={1000} cy={1000} r="5" fill="yellow" />
                                <text x={990} y={990} fill="white" font-size="10" text-anchor="end">Bottom-Right</text>
                                
                                <!-- ViewBox info -->
                                <text x="10" y="70" fill="white" font-size="12">
                                    ViewBox: {svgViewportInfo.viewBox}
                                </text>
                                <text x="10" y="90" fill="white" font-size="12">
                                    Changes: {viewBoxChangeCount}
                                </text>
                            </g>
                        </g>
                    {/if}
                {/key}
            {/if}
        </g>
    </svg>

    <!-- Control buttons -->
    <div class="controls">
        <!-- Reset zoom button -->
        {#if resetZoom}
            <button
                class="control-button reset-button"
                on:click={resetViewport}
                aria-label="Reset view"
                title="Reset view"
            >
                <span class="material-symbols-outlined">restart_alt</span>
            </button>
        {/if}
        
        <!-- Debug toggle button -->
        {#if DEBUG_MODE}
            <button
                class="control-button debug-button"
                on:click={toggleDebug}
                aria-label="Toggle debug mode"
                title="Toggle debug mode"
            >
                <span class="material-symbols-outlined">{showDebug ? 'bug_off' : 'bug_on'}</span>
            </button>
            
            <!-- Force viewBox reset button -->
            <button
                class="control-button viewbox-reset-button"
                on:click={forceViewBoxReset}
                aria-label="Force viewBox reset"
                title="Force viewBox reset"
            >
                <span class="material-symbols-outlined">center_focus_strong</span>
            </button>
            
            <!-- Show ViewBox log button -->
            <button
                class="control-button viewbox-log-button"
                on:click={showViewBoxLog}
                aria-label="Show ViewBox log"
                title="Show ViewBox log"
            >
                <span class="material-symbols-outlined">list</span>
            </button>
            
            <!-- Fix transform origin button -->
            <button
                class="control-button transform-origin-button"
                on:click={fixTransformOrigin}
                aria-label="Fix transform origin"
                title="Fix transform origin"
            >
                <span class="material-symbols-outlined">center_focus_weak</span>
            </button>
            
            <!-- Complete transform fix button -->
            <button
                class="control-button complete-fix-button"
                on:click={fixTransformCompletely}
                aria-label="Complete transform fix"
                title="Complete transform fix"
            >
                <span class="material-symbols-outlined">emergency</span>
            </button>
        {/if}
    </div>
    
    <!-- SVG coordinate debug overlay - only shown in development and statement-network view -->
    {#if DEBUG_MODE && viewType === 'statement-network'}
        <div class="coordinate-debug">
            <div>SVG Origin: (0,0)</div>
            <div>Control Node:</div>
            <div>World: ({centralNodePos.x.toFixed(2)}, {centralNodePos.y.toFixed(2)})</div>
            <div>View: ({centralNodePos.viewX.toFixed(2)}, {centralNodePos.viewY.toFixed(2)})</div>
            <div>Transform: {centralNodePos.transform}</div>
            <div>SVG Size: {svgViewportInfo.width}x{svgViewportInfo.height}</div>
            <div>SVG ViewBox: {svgViewportInfo.viewBox}</div>
            <div>ViewBox Changes: {viewBoxChangeCount}</div>
            <button on:click={resetViewport}>Reset View</button>
            <button on:click={forceViewBoxReset}>Force ViewBox</button>
            <button on:click={lockViewBox}>Lock ViewBox</button>
            <button on:click={resetAllTransforms} class="reset-transforms">Reset Transforms</button>
            <button on:click={inspectTransformHierarchy} class="inspect-button">Inspect Transforms</button>
            <button on:click={debugSVGStyles} class="debug-styles-button">Debug Styles</button>
            <button on:click={fixTransformOrigin} class="fix-origin-button">Fix Transform Origin</button>
            <button on:click={fixTransformCompletely} class="complete-fix-button">Complete Transform Fix</button>
        </div>
    {/if}
</div>

<style>
    .graph-container {
        width: 100%;
        height: 100vh;
        background: black;
        overflow: hidden;
        position: relative;
    }

    .graph-svg {
        width: 100%;
        height: 100%;
        cursor: grab;
        touch-action: none;
        position: absolute;
    }

    .graph-svg:active {
        cursor: grabbing;
    }

    .background-layer {
        pointer-events: none;
    }

    .content-layer {
        pointer-events: all;
    }

    .links-layer {
        pointer-events: none;
    }

    .nodes-layer {
        pointer-events: all;
    }
    
    .center-marker {
        pointer-events: none;
    }

    :global(.graph-svg *) {
        transform-box: fill-box;
        transform-origin: 50% 50%;
    }

    .controls {
        position: absolute;
        bottom: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 50;
    }

    .control-button {
        background-color: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .control-button:hover {
        transform: translateY(-1px);
        background-color: rgba(0, 0, 0, 0.7);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .control-button:active {
        transform: translateY(0);
    }

    .control-button :global(.material-symbols-outlined) {
        color: white;
        font-size: 1.5rem;
    }

    .debug-overlay {
        pointer-events: none;
    }
    
    .coordinate-debug {
        position: absolute;
        bottom: 1rem;
        left: 1rem;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px;
        font-family: monospace;
        border-radius: 5px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 12px;
        z-index: 50;
    }
    
    .coordinate-debug button {
        margin-top: 8px;
        background: #4338ca;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        width: 100%;
        margin-bottom: 5px;
    }
    
    .viewbox-reset-button {
        background-color: rgba(231, 76, 60, 0.5) !important;
    }
    
    .viewbox-log-button {
        background-color: rgba(52, 152, 219, 0.5) !important;
    }
    
    .reset-transforms {
        background-color: rgba(155, 89, 182, 0.7) !important;
    }
    
    .inspect-button {
        background-color: rgba(241, 196, 15, 0.7) !important;
    }
    
    .debug-styles-button {
        background-color: rgba(26, 188, 156, 0.7) !important;
    }
    
    .transform-origin-button {
        background-color: rgba(230, 126, 34, 0.7) !important;
    }
    
    .fix-origin-button {
        background-color: rgba(230, 126, 34, 0.7) !important;
    }
    
    .complete-fix-button {
        background-color: rgba(192, 57, 43, 0.7) !important;
    }
</style>