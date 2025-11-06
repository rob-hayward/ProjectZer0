<!-- src/lib/components/graph/effects/GlowFilter.svelte -->
<script lang="ts">
    /**
     * Reusable SVG glow filter component
     * Creates a multi-layer glow effect for hover states on icons and buttons
     * 
     * Usage:
     * <GlowFilter filterId="my-glow" color="#00ff00" />
     * Then apply with: style:filter="url(#my-glow)"
     */
    
    export let filterId: string;
    export let color: string = '#ffffff';
    export let opacity1: number = 0.6;
    export let opacity2: number = 0.8;
    export let opacity3: number = 1.0;
    export let blur1: number = 12;
    export let blur2: number = 8;
    export let blur3: number = 4;
</script>

<defs>
    <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
        <!-- Outer glow layer (largest, most diffuse) -->
        <feGaussianBlur in="SourceAlpha" stdDeviation={blur1} result="blur1"/>
        <feFlood flood-color={color} flood-opacity={opacity1} result="color1"/>
        <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
        
        <!-- Middle glow layer -->
        <feGaussianBlur in="SourceAlpha" stdDeviation={blur2} result="blur2"/>
        <feFlood flood-color={color} flood-opacity={opacity2} result="color2"/>
        <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
        
        <!-- Inner glow layer (smallest, most intense) -->
        <feGaussianBlur in="SourceAlpha" stdDeviation={blur3} result="blur3"/>
        <feFlood flood-color={color} flood-opacity={opacity3} result="color3"/>
        <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
        
        <!-- Merge all layers with the original graphic -->
        <feMerge>
            <feMergeNode in="shadow1"/>
            <feMergeNode in="shadow2"/>
            <feMergeNode in="shadow3"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    </filter>
</defs>