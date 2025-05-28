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
	export let useContentBox: boolean = false;
	export let showContentBoxBorder: boolean = false;

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
		console.log('[NODE_CENTRE_DEBUG] BasePreviewNode mounted with position:', {
			nodeId: node.id,
			nodeX,
			nodeY,
			nodePosition: node.position,
			useContentBox,
			showContentBoxBorder
		});

		if ((nodeX === undefined || nodeY === undefined) && node.position) {
			nodeX = node.position.x;
			nodeY = node.position.y;
			console.log('[NODE_CENTRE_DEBUG] BasePreviewNode using node.position instead:', {
				x: nodeX,
				y: nodeY
			});
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

	// Slot shape types
	type LegacySlot = { radius: number; style: typeof NODE_CONSTANTS };
	type ContentBoxSlot = { x: number; y: number; width: number; height: number; layoutConfig: any };

	interface $Slots {
		title?: LegacySlot;
		button?: LegacySlot;
		score?: LegacySlot;
		content?: ContentBoxSlot; // When useContentBox=true, content slot always gets ContentBoxSlot props
		voting?: ContentBoxSlot;
		stats?: ContentBoxSlot;
		default?: { radius: number; filterId: string; gradientId: string };
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
			{#if useContentBox}
				<!-- Title stays outside ContentBox -->
				{#if $$slots.title}
					<slot name="title" {radius} style={NODE_CONSTANTS} />
				{/if}
				
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

					<svelte:fragment slot="stats" let:x let:y let:width let:height let:layoutConfig>
						{#if $$slots.stats}
							<slot name="stats" {x} {y} {width} {height} {layoutConfig} />
						{/if}
					</svelte:fragment>
				</ContentBox>
			{:else}
				<!-- Legacy mode without ContentBox -->
				{#if $$slots.title}
					<slot name="title" {radius} style={NODE_CONSTANTS} />
				{/if}
				{#if $$slots.content}
					<slot name="content" {radius} style={NODE_CONSTANTS} />
				{/if}
				{#if $$slots.score}
					<slot name="score" {radius} style={NODE_CONSTANTS} />
				{/if}
				{#if $$slots.button}
					<slot name="button" {radius} style={NODE_CONSTANTS} />
				{/if}
			{/if}

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
		</svelte:fragment>
	</BaseNode>
</g>

<style>
	.preview-node {
		will-change: transform;
		transition: transform 0.3s ease-out;
	}
</style>