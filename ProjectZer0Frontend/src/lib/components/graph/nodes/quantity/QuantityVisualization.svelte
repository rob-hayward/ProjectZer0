<!-- src/lib/components/graph/nodes/quantity/QuantityVisualization.svelte -->
<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
    import * as d3 from 'd3';
    import { COLORS } from '$lib/constants/colors';

    // Visualization container ref
    let container: HTMLDivElement;
    
    // Define types for statistics and userResponse
    interface Response {
        value: number;
        unitId: string;
        unitSymbol?: string;
        normalizedValue?: number;
    }
    
    interface Statistics {
        mean?: number;
        median?: number;
        min?: number;
        max?: number;
        standardDeviation?: number;
        responseCount?: number;
        distributionCurve?: [number, number][];
        responses?: Response[];
        percentiles?: Record<string, number>;
    }
    
    interface UserResponse {
        value: number;
        unitId: string;
        unitSymbol?: string;
        normalizedValue?: number;
    }
    
    // Props with proper typing
    export let statistics: Statistics | null = null;
    export let userResponse: UserResponse | null = null;
    export let unitSymbol: string = '';
    
    // Dimensions
    const height = 280;
    const width = 1050;
    const margin = { top: 30, right: 40, bottom: 50, left: 40 };
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
        text: 'rgba(255, 255, 255, 0.9)',
        dots: {
            base: 'rgba(26, 188, 156, 0.7)',
            hover: 'rgba(26, 188, 156, 1.0)',
            stroke: 'rgba(255, 255, 255, 0.4)'
        },
        stdDev: {
            fill: 'rgba(26, 188, 156, 0.08)',
            stroke: 'rgba(26, 188, 156, 0.3)',
            line: 'rgba(26, 188, 156, 0.6)',
            text: 'rgba(26, 188, 156, 0.9)'
        }
    };
    
    // Format number with appropriate precision
    function formatNumber(value: number): string {
        if (value === undefined || value === null) return '-';
        return Math.abs(value) < 0.01 
            ? value.toExponential(2) 
            : Number.isInteger(value) 
                ? value.toString() 
                : value.toFixed(2);
    }
    
    // Calculate appropriate standard deviation if missing or zero
    function calculateStandardDeviation(responses: Response[], mean: number): number {
        if (!responses || responses.length < 2) return 0;
        
        // Calculate sum of squared differences from mean
        const sumSquaredDiff = responses.reduce((sum, response) => {
            const diff = response.value - mean;
            return sum + (diff * diff);
        }, 0);
        
        // Calculate standard deviation
        return Math.sqrt(sumSquaredDiff / responses.length);
    }
    
    // Render the visualization
    function renderVisualization() {
        if (!container || !statistics) {
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
            
        // If standard deviation is missing or zero but we have responses and mean,
        // calculate it ourselves
        if ((!statistics.standardDeviation || statistics.standardDeviation <= 0.001) && 
            statistics.responses && statistics.responses.length > 1 && 
            statistics.mean !== undefined) {
            statistics.standardDeviation = calculateStandardDeviation(
                statistics.responses, 
                statistics.mean
            );
            console.log('Calculated standard deviation:', statistics.standardDeviation);
        }
            
        // Extract data
        const distributionData = statistics.distributionCurve || [];
        const responses = statistics.responses || [];
        
        // Skip rendering if no distribution data and no responses
        if (distributionData.length === 0 && responses.length === 0) {
            svg.append('text')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.text)
                .text('Not enough data to create visualization');
            return;
        }
        
        // Set up domain for X axis
        let xMin = statistics.min !== undefined ? statistics.min : 0;
        let xMax = statistics.max !== undefined ? statistics.max : 100;
        
        // Ensure we have sensible fallbacks and a minimum domain width
        if (xMin === xMax) {
            xMin = xMin * 0.9;
            xMax = xMax * 1.1;
            // If value is 0, use a small range around it
            if (xMin === 0 && xMax === 0) {
                xMin = -1;
                xMax = 1;
            }
        }
        
        // Add padding to domain
        const xRange = xMax - xMin;
        const xPadding = xRange * 0.1;
        
        // Create x scale
        const x = d3.scaleLinear()
            .domain([xMin - xPadding, xMax + xPadding])
            .range([0, innerWidth]);
            
        // Set up scales for Y axis - different approaches based on available data
        let y: d3.ScaleLinear<number, number>;
        
        if (distributionData.length > 0) {
            // For distribution curve data
            const yMax = d3.max(distributionData, d => d[1]) || 0.1;
            y = d3.scaleLinear()
                .domain([0, yMax * 1.1]) // Add 10% padding at the top
                .range([innerHeight, 0]);
        } else {
            // For dot plot (when no distribution curve)
            // Count occurrences of each value to determine y-scale
            const valueCounts = new Map<number, number>();
            responses.forEach(r => {
                const val = Math.round(r.value * 100) / 100; // Round to 2 decimal places
                valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
            });
            const maxCount = Math.max(...Array.from(valueCounts.values()));
            
            y = d3.scaleLinear()
                .domain([0, maxCount * 1.2]) // Add 20% padding for dots
                .range([innerHeight, 0]);
        }
            
        // Create background
        svg.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', colors.background)
            .attr('rx', 6)  // Rounded corners
            .attr('ry', 6);
            
        // Create grid lines
        const xGrid = d3.axisBottom(x)
            .tickSize(-innerHeight)
            .tickFormat(() => '')
            .ticks(8); // More grid lines
            
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xGrid)
            .selectAll('line')
            .attr('stroke', 'rgba(255, 255, 255, 0.1)');
            
        // Add border around the visualization area
        svg.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255, 255, 255, 0.2)')
            .attr('stroke-width', 1)
            .attr('rx', 6)
            .attr('ry', 6);
            
        // If we have a distribution curve, render it
        if (distributionData.length > 0) {
            // Create curve line
            const curve = d3.line<[number, number]>()
                .x(d => x(d[0]))
                .y(d => y(d[1]))
                .curve(d3.curveBasis);
                
            // Create area under the curve
            const area = d3.area<[number, number]>()
                .x(d => x(d[0]))
                .y0(innerHeight)
                .y1(d => y(d[1]))
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
        }
        
        // Add dot plot of actual responses regardless of whether we have a curve
        if (responses.length > 0) {
            // For the dot plot, we need to "jitter" the y-position if values are the same
            const jitterMap = new Map<number, number[]>();
            
            // Group responses by their value to create the jitter effect
            responses.forEach(response => {
                const val = Math.round(response.value * 100) / 100; // Round to 2 decimal places
                if (!jitterMap.has(val)) {
                    jitterMap.set(val, []);
                }
                jitterMap.get(val)?.push(response.value);
            });
            
            // Now create dots with jitter
            jitterMap.forEach((values, key) => {
                const xPos = x(key);
                const count = values.length;
                const dotRadius = 4; // Increased dot size
                
                // Calculate positions for dots with the same value
                values.forEach((val, i) => {
                    // Vertical stacking if multiple dots at same x position
                    // Use different stacking strategy based on count
                    let yPos;
                    if (count <= 3) {
                        // Simple vertical stack for 3 or fewer dots
                        const stackHeight = innerHeight * 0.15; // 15% of height
                        yPos = innerHeight - (stackHeight * (i / Math.max(1, count - 1)));
                    } else {
                        // For more dots, use a more compact distribution
                        const yJitter = d3.scaleLinear()
                            .domain([0, count - 1])
                            .range([innerHeight - 8, innerHeight - Math.min(count * 8, innerHeight * 0.5)]);
                        yPos = yJitter(i);
                    }
                    
                    // Create the dot
                    svg.append('circle')
                        .attr('cx', xPos)
                        .attr('cy', yPos)
                        .attr('r', dotRadius)
                        .attr('fill', colors.dots.base)
                        .attr('stroke', colors.dots.stroke)
                        .attr('stroke-width', 1)
                        .attr('class', 'response-dot')
                        .on('mouseover', function() {
                            d3.select(this)
                                .attr('r', dotRadius * 1.5)
                                .attr('fill', colors.dots.hover);
                                
                            // Add tooltip for this dot
                            svg.append('text')
                                .attr('class', 'tooltip')
                                .attr('x', xPos)
                                .attr('y', yPos - 12)
                                .attr('text-anchor', 'middle')
                                .attr('fill', 'white')
                                .style('font-size', '10px')
                                .text(`${formatNumber(val)} ${unitSymbol}`);
                        })
                        .on('mouseout', function() {
                            d3.select(this)
                                .attr('r', dotRadius)
                                .attr('fill', colors.dots.base);
                                
                            // Remove tooltip
                            svg.selectAll('.tooltip').remove();
                        });
                });
            });
        }
        
        // Add standard deviation visualization if available and not zero
        if (statistics.standardDeviation !== undefined && 
            statistics.standardDeviation > 0.001 && 
            statistics.mean !== undefined) {
            
            // Add one standard deviation band (mean ± 1σ)
            const meanValue = statistics.mean;
            const stdDev = statistics.standardDeviation;
            
            // Calculate standard deviation range
            const minusSigma = meanValue - stdDev;
            const plusSigma = meanValue + stdDev;
            
            // Check if the sigma range is within our visible x domain
            if (x(minusSigma) >= 0 && x(plusSigma) <= innerWidth) {
                // Add semi-transparent rectangle for 1 sigma range
                svg.append('rect')
                    .attr('x', x(minusSigma))
                    .attr('y', 0)
                    .attr('width', x(plusSigma) - x(minusSigma))
                    .attr('height', innerHeight)
                    .attr('fill', colors.stdDev.fill)
                    .attr('stroke', colors.stdDev.stroke)
                    .attr('stroke-width', 1);
                
                // Add vertical lines at boundaries of standard deviation
                svg.append('line')
                    .attr('x1', x(minusSigma))
                    .attr('y1', 0)
                    .attr('x2', x(minusSigma))
                    .attr('y2', innerHeight)
                    .attr('stroke', colors.stdDev.line)
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '4,2');
                    
                svg.append('line')
                    .attr('x1', x(plusSigma))
                    .attr('y1', 0)
                    .attr('x2', x(plusSigma))
                    .attr('y2', innerHeight)
                    .attr('stroke', colors.stdDev.line)
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '4,2');
                
                // Add labels at edges of standard deviation band with better positioning
                svg.append('text')
                    .attr('x', x(minusSigma))
                    .attr('y', 12)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.stdDev.text)
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .text('−1σ');
                
                svg.append('text')
                    .attr('x', x(plusSigma))
                    .attr('y', 12)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.stdDev.text)
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .text('+1σ');
                    
                // Add annotation for standard deviation value at the top
                svg.append('text')
                    .attr('x', x(meanValue))
                    .attr('y', -10)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.stdDev.text)
                    .attr('font-size', '12px')
                    .text(`Standard Deviation: ${formatNumber(stdDev)} ${unitSymbol}`);
            }
        }
            
        // Add mean line
        if (statistics.mean !== undefined) {
            // Determine if mean and median are close to each other
            const isMeanMedianClose = statistics.median !== undefined && 
                Math.abs(x(statistics.mean) - x(statistics.median as number)) < 40;
            
            svg.append('line')
                .attr('x1', x(statistics.mean))
                .attr('y1', innerHeight)
                .attr('x2', x(statistics.mean))
                .attr('y2', 0)
                .attr('stroke', colors.mean)
                .attr('stroke-width', 2)    // Thicker line
                .attr('stroke-dasharray', '4,3');
            
            // Position text based on proximity to median    
            svg.append('text')
                .attr('x', x(statistics.mean))
                .attr('y', isMeanMedianClose ? 15 : 20)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.mean)
                .attr('font-size', '13px')  // Larger font
                .attr('font-weight', 'bold')
                .text(`Mean: ${formatNumber(statistics.mean)} ${unitSymbol}`);
        }
        
        // Add user response marker
        if (userResponse && typeof userResponse.value === 'number') {
            const userValue = userResponse.value;
            
            // Only show if it's within the domain
            if (userValue >= xMin - xPadding && userValue <= xMax + xPadding) {
                // Create diamond shape for user response to differentiate it
                const diamondSize = 10;
                
                // Calculate diamond points - explicitly define as [number, number][]
                const diamond: [number, number][] = [
                    [x(userValue), innerHeight - diamondSize], // top
                    [x(userValue) + diamondSize, innerHeight], // right
                    [x(userValue), innerHeight + diamondSize], // bottom
                    [x(userValue) - diamondSize, innerHeight]  // left
                ];
                
                // Create diamond path with explicit type
                svg.append('path')
                    .attr('d', d3.line<[number, number]>()(diamond))
                    .attr('fill', colors.userResponse)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1.5);
                    
                // Position label above x-axis to avoid overlap
                svg.append('text')
                    .attr('x', x(userValue))
                    .attr('y', innerHeight - 15) // Moved down to avoid overlap with x-axis
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.userResponse)
                    .attr('font-size', '13px')
                    .attr('font-weight', 'bold')
                    .text(`Your: ${formatNumber(userValue)} ${unitSymbol}`);
            }
        }
        
        // Add x-axis with tick values
        const xAxis = d3.axisBottom(x)
            .ticks(8)
            .tickFormat(d => formatNumber(d as number));
            
        svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxis)
            .call(g => g.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.5)'))
            .call(g => g.selectAll('.tick text')
                .attr('fill', colors.axis)
                .attr('font-size', '11px'));
                
        // Add summary statistics text at the bottom
        if (statistics.responseCount && statistics.responseCount > 0) {
            // If min and max are very close, don't show range
            const showRange = statistics.min !== undefined && 
                             statistics.max !== undefined && 
                             (statistics.max - statistics.min) > 0.01;
            
            let summaryText = `n=${statistics.responseCount}`;
            
            if (showRange) {
                summaryText += ` | Range: ${formatNumber(statistics.min as number)} - ${formatNumber(statistics.max as number)} ${unitSymbol}`;
            }
            
            if (statistics.standardDeviation !== undefined) {
                summaryText += ` | σ=${formatNumber(statistics.standardDeviation)} ${unitSymbol}`;
            }
            
            svg.append('text')
                .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 40})`)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.text)
                .attr('font-size', '12px')
                .text(summaryText);
        }
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
    
    :global(.visualization-container path) {
        vector-effect: non-scaling-stroke;
    }
    
    :global(.visualization-container .response-dot:hover) {
        cursor: pointer;
    }
</style>