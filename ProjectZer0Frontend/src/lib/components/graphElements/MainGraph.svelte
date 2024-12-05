<!-- ProjectZer0Frontend/src/lib/components/graphElements/MainGraph.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import * as d3 from 'd3';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
  
    export let nodes: GraphNode[];
    export let edges: GraphEdge[];
  
    const dispatch = createEventDispatcher();
    let svg: SVGElement;
  
    onMount(() => {
      renderGraph();
    });
  
    function renderGraph() {
      const width = svg.clientWidth;
      const height = svg.clientHeight;
  
      const simulation = d3.forceSimulation<GraphNode>(nodes)
        .force("link", d3.forceLink<GraphNode, GraphEdge>(edges).id(d => d.id))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2));
  
      const svgElement = d3.select(svg);
      svgElement.selectAll("*").remove(); // Clear previous content
  
      const edge = svgElement.append("g")
        .selectAll<SVGLineElement, GraphEdge>("line")
        .data(edges)
        .join("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6);
  
      const node = svgElement.append("g")
        .selectAll<SVGGElement, GraphNode>("g")
        .data(nodes)
        .join("g")
        .call(drag(simulation) as any)
        .on("click", (event: MouseEvent, d: GraphNode) => dispatch('nodeSelected', d));
  
      node.append("circle")
        .attr("r", 5)
        .attr("fill", d => getNodeColor(d.type));
  
      node.append("text")
        .text(d => d.label)
        .attr("x", 8)
        .attr("y", "0.31em")
        .attr("font-size", "10px")
        .attr("fill", "white");
  
      simulation.on("tick", () => {
        edge
          .attr("x1", d => (typeof d.source === 'object' ? d.source.x || 0 : 0))
          .attr("y1", d => (typeof d.source === 'object' ? d.source.y || 0 : 0))
          .attr("x2", d => (typeof d.target === 'object' ? d.target.x || 0 : 0))
          .attr("y2", d => (typeof d.target === 'object' ? d.target.y || 0 : 0));
  
        node.attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
      });
    }
  
    function drag(simulation: d3.Simulation<GraphNode, GraphEdge>) {
      function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      
      return d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  
    function getNodeColor(type: string): string {
      const colors: {[key: string]: string} = {
        user: "#1f77b4",
        belief: "#2ca02c",
        word: "#d62728",
      };
      return colors[type] || "#7f7f7f";
    }
  </script>
  
  <div class="main-graph">
    <svg bind:this={svg}></svg>
  </div>
  
  <style>
    .main-graph {
      width: 100%;
      height: 100%;
    }
  
    svg {
      width: 100%;
      height: 100%;
      background-color: #000000;
    }
  </style>