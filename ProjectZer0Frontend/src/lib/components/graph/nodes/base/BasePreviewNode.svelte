<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import BaseNode from './BaseNode.svelte';
	import ExpandCollapseButton from '../ui/ExpandCollapseButton.svelte';
	import ContentBox from '../ui/ContentBox.svelte';
	import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

	export let node: RenderableNode;
	export let nodeX: number | undefined = undefined;
	export let nodeY: number | undefined = undefined;
	
	// ContentBox debugging
	export let showContentBoxBorder: boolean = false;

	// NEW: Threshold-based expansion control
	// Node types should pass canExpand based on inclusion vote threshold
	// Default to true for backward compatibility with existing nodes
	export let canExpand: boolean = true;

	// NEW: Position override props for special cases (e.g., larger nodes like Quantity)
	// These are multipliers of radius for vertical positioning
	export let titleYOffset: number = 0.85; // Distance above ContentBox for title

	export let voteBasedStyles = {
		glow: { intensity: 8, opacity: 0.6 },
		ring: { width: 6, opacity: 0.5 }
	};

	const dispatch = createEventDispatcher<{
		modeChange: {
			mode: NodeMode;
			position?: { x: number; y: number };
		};
		click: void;
		visibilityChange: { isHidden: boolean };
	}>();

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		dispatch('visibilityChange', event.detail);
	}

	onMount(() => {
		if ((nodeX === undefined || nodeY === undefined) && node.position) {
			nodeX = node.position.x;
			nodeY = node.position.y;
		}
	});

	function handleButtonClick() {
		dispatch('click');
	}

	function handleModeChange(event: CustomEvent<{
		mode: NodeMode;
		position?: { x: number; y: number };
		nodeId?: string;
	}>) {
		const eventData = {
			mode: event.detail.mode,
			position:
				event.detail.position ??
				(nodeX !== undefined && nodeY !== undefined
					? { x: nodeX, y: nodeY }
					: node.position
					? { x: node.position.x, y: node.position.y }
					: undefined)
		};

		dispatch('modeChange', eventData);
	}

	// Calculate position for title (above ContentBox)
	$: radius = node.radius;
	$: titleY = -radius * titleYOffset;

	// Slot interface - standardized positions managed by BasePreviewNode
	interface $Slots {
		title: { radius: number }; // Positioned above ContentBox
		content: { x: number; y: number; width: number; height: number; layoutConfig: any };
		voting: { x: number; y: number; width: number; height: number; layoutConfig: any };
		stats: { x: number; y: number; width: number; height: number; layoutConfig: any };
	}
</script>

<g
	class="preview-node"
	data-node-id={node.id}
	data-node-type={node.type}
	data-node-mode={node.mode}
	data-node-radius={node.radius}
>
	<BaseNode {node} {voteBasedStyles}>
		<svelte:fragment slot="default" let:radius let:filterId let:gradientId>
			<!-- Title positioned above ContentBox -->
			<!-- This ensures consistent positioning across all preview nodes -->
			{#if $$slots.title}
				<g transform="translate(0, {titleY})">
					<slot name="title" {radius} />
				</g>
			{/if}
			
			<!-- ContentBox at center (0, 0) - handles all internal content layout -->
			<!-- ContentBox manages content, voting, and stats sections with configurable ratios -->
			<ContentBox nodeType={node.type} mode="preview" showBorder={showContentBoxBorder}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					{#if $$slots.content}
						<slot name="content" {x} {y} {width} {height} {layoutConfig} />
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="voting" let:x let:y let:width let:height let:layoutConfig>
					{#if $$slots.voting}
						<slot name="voting" {x} {y} {width} {height} {layoutConfig} />
					{/if}
				</svelte:fragment>

				<!-- Stats slot exists but typically unused in preview mode (layoutConfig sets height to 0) -->
				<svelte:fragment slot="stats" let:x let:y let:width let:height let:layoutConfig>
					{#if $$slots.stats}
						<slot name="stats" {x} {y} {width} {height} {layoutConfig} />
					{/if}
				</svelte:fragment>
			</ContentBox>

			<!-- Expand button (SE corner) - only shown if canExpand is true -->
			<!-- Hidden when inclusion votes don't meet threshold -->
			{#if canExpand}
				<ExpandCollapseButton
					mode="expand"
					y={radius * 0.7071}
					x={-radius * 0.7071}
					nodeX={nodeX}
					nodeY={nodeY}
					nodeId={node.id}
					on:click={handleButtonClick}
					on:modeChange={handleModeChange}
				/>
			{/if}
		</svelte:fragment>
	</BaseNode>
</g>

<style>
	.preview-node {
		will-change: transform;
		transition: transform 0.3s ease-out;
	}
</style>