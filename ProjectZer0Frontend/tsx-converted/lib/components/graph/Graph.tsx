/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/Graph.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { onMount, onDestroy } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphData, GraphNode, ViewType } from '$lib/types/graph/core';
    import type { BackgroundConfig } from './backgrounds/backgroundConfig';
    import { DEFAULT_BACKGROUND_CONFIG } from './backgrounds/backgroundConfig';
    import { SvgBackground } from './backgrounds/SvgBackground';
    import GraphLayout from './layouts/GraphLayout.svelte';

    // Props
    export let data: GraphData;
    export let width = 6000;  // Default value
    export let height = 4800;  // Default value
    export let viewType: ViewType;
    export let backgroundConfig: Partial<BackgroundConfig> = {};
    export let isPreviewMode = false;

    let mounted = false;
    let container: HTMLDivElement;
    let svg: SVGSVGElement;
    let backgroundGroup: SVGGElement;
    let contentGroup: SVGGElement;
    let background: SvgBackground | null = null;
    let transform = d3.zoomIdentity;
    let viewBox = '0 0 3000 2400'; // Initial viewBox matching default dimensions

    const mergedConfig = { ...DEFAULT_BACKGROUND_CONFIG, ...backgroundConfig };
    
    function updateDimensions() {
        if (!container) return;
        
        // Get container dimensions
        const rect = container.getBoundingClientRect();
        
        // Update dimensions based on container size
        const containerWidth = Math.max(rect.width, 1000); // Minimum width
        const containerHeight = Math.max(rect.height, 800); // Minimum height
        
        // Set dimensions while maintaining aspect ratio
        width = containerWidth;
        height = containerHeight;
        
        if (background) {
            background.resize(width, height);
        }

        console.log('Dimensions updated:', { width, height });
        updateViewBox();
    }

    function initializeBackground() {
        if (!backgroundGroup) {
            console.log('No background group found');
            return;
        }
        
        console.log('Creating background with config:', mergedConfig);
        
        if (background) {
            background.destroy();
        }

        try {
            background = new SvgBackground(
                backgroundGroup, 
                width, 
                height,
                mergedConfig
            );
            console.log('Background created:', background);
            background.start();
        } catch (error) {
            console.error('Error initializing background:', error);
        }
    }

    function initializeZoom() {
        if (!svg || !contentGroup) return;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                transform = event.transform;
                d3.select(contentGroup)
                    .attr('transform', transform.toString());
            });

        d3.select(svg)
            .call(zoom)
            .call(zoom.transform, d3.zoomIdentity)
            .on('contextmenu', (event) => event.preventDefault());
    }

    function updateViewBox() {
        if (!width || !height) {
            console.log('Skipping viewBox update - no dimensions');
            return;
        }
        
        // Calculate centered viewBox
        const originX = -Math.round(width / 2);
        const originY = -Math.round(height / 2);
        const scaledWidth = Math.round(width);
        const scaledHeight = Math.round(height);
        
        viewBox = `${originX} ${originY} ${scaledWidth} ${scaledHeight}`;
        console.log('ViewBox updated:', { originX, originY, scaledWidth, scaledHeight, viewBox });
    }

    onMount(() => {
        console.log('Graph mounting with data:', data);
        mounted = true;
        
        // Initialize dimensions and viewBox
        updateDimensions();
        
        // Set up event listeners and initialize components
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateDimensions);
            
            if (width && height) {
                console.log('Initializing graph with dimensions:', { width, height });
                initializeBackground();
                initializeZoom();
            }
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', updateDimensions);
        }
        if (background) {
            background.destroy();
        }
    });

    // Reactive statements
    useEffect(() => { {
        if (data) {
            console.log('Graph data updated:', data); });
        }
    }

    useEffect(() => { {
        if (mounted && width && height) {
            updateDimensions(); });
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/Graph.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/Graph.svelte -->
  );
}