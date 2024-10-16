<!-- src/lib/components/navigation/NavGraph.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
  
    export let options: { id: string; label: string; icon: string }[];
    export let currentView: string;
  
    const dispatch = createEventDispatcher();
    let svg: SVGElement;
  
    onMount(() => {
      const width = svg.clientWidth;
      const height = svg.clientHeight;
      const radius = Math.min(width, height) / 2 - 10;
  
      const svgElement = d3.select(svg)
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
  
      const g = svgElement.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
  
      // Create central node
      g.append('circle')
        .attr('r', radius * 0.2)
        .attr('fill', 'steelblue')
        .attr('cursor', 'pointer');
  
      // Create option nodes
      const angleStep = (2 * Math.PI) / options.length;
      options.forEach((option, i) => {
        const angle = i * angleStep;
        const x = radius * 0.7 * Math.cos(angle);
        const y = radius * 0.7 * Math.sin(angle);
  
        const optionGroup = g.append('g')
          .attr('transform', `translate(${x},${y})`)
          .attr('cursor', 'pointer')
          .on('click', () => dispatch('navigate', option.id));
  
        optionGroup.append('circle')
          .attr('r', radius * 0.15)
          .attr('fill', option.id === currentView ? 'orange' : 'lightgray');
  
        optionGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .text(option.icon)
          .attr('font-family', 'FontAwesome')
          .attr('font-size', `${radius * 0.1}px`)
          .attr('fill', 'white');
  
        optionGroup.append('text')
          .attr('y', radius * 0.25)
          .attr('text-anchor', 'middle')
          .text(option.label)
          .attr('font-size', `${radius * 0.06}px`)
          .attr('fill', 'white');
      });
  
      // Add hover effect
      g.select('circle')
        .on('mouseover', showConnections)
        .on('mouseout', hideConnections);
  
      function showConnections() {
        g.selectAll('line').remove();
        options.forEach((option, i) => {
          const angle = i * angleStep;
          const x = radius * 0.7 * Math.cos(angle);
          const y = radius * 0.7 * Math.sin(angle);
  
          g.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', x)
            .attr('y2', y)
            .attr('stroke', 'gray')
            .attr('stroke-width', 2);
        });
      }
  
      function hideConnections() {
        g.selectAll('line').remove();
      }
    });
  </script>
  
  <div class="nav-graph">
    <svg bind:this={svg}></svg>
  </div>
  
  <style>
    .nav-graph {
      width: 100%;
      height: 100%;
    }
  
    svg {
      width: 100%;
      height: 100%;
    }
  </style>