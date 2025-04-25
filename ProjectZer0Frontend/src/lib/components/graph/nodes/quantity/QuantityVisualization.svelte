<!-- src/lib/components/graph/nodes/quantity/QuantityVisualization.svelte -->
<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
    import * as d3 from 'd3';
    import { COLORS } from '$lib/constants/colors';

    // Visualization container ref
    let container: HTMLDivElement;
    
    // Define types for statistics and userResponse
    interface DistributionPoint {
        bin_min: number;
        bin_max: number;
        percentage: number;
    }
    
    interface Statistics {
        mean?: number;
        median?: number;
        min?: number;
        max?: number;
        standardDeviation?: number;
        responseCount?: number;
        distributionCurve?: DistributionPoint[];
    }
    
    interface UserResponse {
        value: number;
        unitId: string;
        unitSymbol?: string;
    }
    
    // Props with proper typing
    export let statistics: Statistics | null = null;
    export let userResponse: UserResponse | null = null;
    export let unitSymbol: string = '';
    
    // Dimensions
    const height = 200;
    const width = 900;
    const margin = { top: 20, right: 40, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Theme colors - using the TURQUOISE color theme
    const colors = {
        background: 'rgba(0, 0, 0, 0.2)',
        line: COLORS.PRIMARY.TURQUOISE,
        area: `${COLORS.PRIMARY.TURQUOISE}33`,
        mean: '#FFFFFF',
        median: '#FFCC00',
        userResponse: '#FF6600',
        axis: 'rgba(255, 255, 255, 0.7)',
        text: 'rgba(255, 255, 255, 0.9)'
    };
    
    // Render the visualization
    function renderVisualization() {
        if (!container || !statistics || !statistics.distributionCurve || statistics.distributionCurve.length === 0) {
            return;
        }
        
        // Clear previous visualization
        d3.select(container).selectAll('*').remove();
        
        // Create SVG element
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
            
        // Extract distribution curve data
        const distributionData = statistics.distributionCurve;
        
        // Set up scales
        const xMin = d3.min(distributionData, d => d.bin_min);
        const xMax = d3.max(distributionData, d => d.bin_max);
        
        // Add a small padding to the domain (with null checks)
        const xPadding = xMin !== undefined && xMax !== undefined ? (xMax - xMin) * 0.05 : 0;
        
        const x = d3.scaleLinear()
            .domain([
                xMin !== undefined ? xMin - xPadding : 0, 
                xMax !== undefined ? xMax + xPadding : 100
            ])
            .range([0, innerWidth]);
            
        const yMax = d3.max(distributionData, d => d.percentage);
        const y = d3.scaleLinear()
            .domain([0, yMax !== undefined ? yMax * 1.1 : 100]) // Add 10% padding at the top
            .range([innerHeight, 0]);
            
        // Create background
        svg.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', colors.background)
            .attr('rx', 4)
            .attr('ry', 4);
            
        // Create density curve
        const curve = d3.line<DistributionPoint>()
            .x(d => x((d.bin_min + d.bin_max) / 2))
            .y(d => y(d.percentage))
            .curve(d3.curveBasis);
            
        // Create area under the curve
        const area = d3.area<DistributionPoint>()
            .x(d => x((d.bin_min + d.bin_max) / 2))
            .y0(innerHeight)
            .y1(d => y(d.percentage))
            .curve(d3.curveBasis);
            
        // Add area under the curve
        svg.append('path')
            .datum(distributionData)
            .attr('fill', colors.area)
            .attr('d', area);
            
        // Add the curve
        svg.append('path')
            .datum(distributionData)
            .attr('fill', 'none')
            .attr('stroke', colors.line)
            .attr('stroke-width', 2)
            .attr('d', curve);
            
        // Add mean line
        if (statistics.mean !== undefined) {
            svg.append('line')
                .attr('x1', x(statistics.mean))
                .attr('y1', innerHeight)
                .attr('x2', x(statistics.mean))
                .attr('y2', 0)
                .attr('stroke', colors.mean)
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '3,3');
                
            svg.append('text')
                .attr('x', x(statistics.mean))
                .attr('y', -5)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.mean)
                .attr('font-size', '12px')
                .text(`Mean: ${statistics.mean.toFixed(2)} ${unitSymbol}`);
        }
        
        // Add median line
        if (statistics.median !== undefined) {
            svg.append('line')
                .attr('x1', x(statistics.median))
                .attr('y1', innerHeight)
                .attr('x2', x(statistics.median))
                .attr('y2', 0)
                .attr('stroke', colors.median)
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '3,3');
                
            svg.append('text')
                .attr('x', x(statistics.median))
                .attr('y', 10)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.median)
                .attr('font-size', '12px')
                .text(`Median: ${statistics.median.toFixed(2)} ${unitSymbol}`);
        }
        
        // Add user response marker
        if (userResponse && typeof userResponse.value === 'number') {
            const userValue = userResponse.value;
            const userRadius = 5;
            
            // Only show if it's within the domain
            if (xMin !== undefined && xMax !== undefined && userValue >= xMin && userValue <= xMax) {
                svg.append('circle')
                    .attr('cx', x(userValue))
                    .attr('cy', innerHeight)
                    .attr('r', userRadius)
                    .attr('fill', colors.userResponse);
                    
                svg.append('text')
                    .attr('x', x(userValue))
                    .attr('y', innerHeight + 15)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.userResponse)
                    .attr('font-size', '12px')
                    .text(`Your Response: ${userValue} ${unitSymbol}`);
            }
        }
        
        // Add x-axis with tick values
        const xAxis = d3.axisBottom(x)
            .ticks(5)
            .tickSize(-innerHeight)
            .tickFormat(d => `${d}`);
            
        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke', 'rgba(255, 255, 255, 0.1)'))
            .call(g => g.selectAll('.tick text')
                .attr('fill', colors.axis)
                .attr('font-size', '10px'));
                
        // Add statistics summary at the bottom
        const summary = svg.append('g')
            .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 35})`);
            
        summary.append('text')
            .attr('text-anchor', 'middle')
            .attr('fill', colors.text)
            .attr('font-size', '12px')
            .text(`Responses: ${statistics.responseCount || 0} | Min: ${statistics.min?.toFixed(2) || 'N/A'} | Max: ${statistics.max?.toFixed(2) || 'N/A'} | StdDev: ${statistics.standardDeviation?.toFixed(2) || 'N/A'} ${unitSymbol}`);
    }
    
    // Initialize visualization on mount
    onMount(() => {
        renderVisualization();
    });
    
    // Re-render when statistics or user response changes
    afterUpdate(() => {
        renderVisualization();
    });
    
    $: if (statistics && container) {
        renderVisualization();
    }
</script>

<div bind:this={container} class="visualization-container"></div>

<style>
    .visualization-container {
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    
    :global(.visualization-container text) {
        font-family: 'Orbitron', sans-serif;
    }
    
    :global(.visualization-container .tick text) {
        font-family: 'Orbitron', sans-serif;
    }
</style>