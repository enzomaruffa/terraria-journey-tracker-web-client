<script lang="ts">
	/**
	 * The item in context: what goes into it on the left, what it goes into on the right.
	 *
	 * Crafting is a graph, and a two-column node view shows an item's place in it far faster
	 * than two lists do. Nodes are clickable, so the graph doubles as a way to walk the tree.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { Catalogue } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		id: number;
		researched: Set<number>;
	}

	let { catalogue, id: itemId, researched }: Props = $props();

	const NODE_W = 154;
	const NODE_H = 32;
	const NODE_GAP = 10;
	/** Hard ceiling; the real limit is however many fit in the canvas without clipping. */
	const MAX_SIDE = 10;

	interface Node {
		id: number;
		label: string;
		x: number;
		y: number;
		side: -1 | 0 | 1;
		amount?: number;
	}

	let canvas: HTMLCanvasElement | null = $state(null);
	let hovered = $state<number | null>(null);
	let hiddenLeft = $state(0);
	let hiddenRight = $state(0);
	let nodes: Node[] = [];
	let frame = 0;

	/** Sprites are hotlinked, so every load has to suppress the referrer or wiki.gg 403s it. */
	const sprites = new SvelteMap<string, HTMLImageElement>();

	function sprite(url: string): HTMLImageElement | null {
		if (!url) return null;
		const cached = sprites.get(url);
		if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

		const image = new Image();
		image.referrerPolicy = 'no-referrer';
		image.src = url;
		sprites.set(url, image);
		return null;
	}

	let makes = $derived(catalogue.recipes.filter((r) => r.id === itemId));
	let usedIn = $derived(
		catalogue.recipes.filter((r) => r.ingredients.some((i) => i.ids.includes(itemId)))
	);

	/** Distinct ingredients across every recipe that produces this item. */
	let inputs = $derived.by(() => {
		const seen = new SvelteMap<number, number>();
		for (const recipe of makes) {
			for (const ingredient of recipe.ingredients) {
				const id = ingredient.ids[0];
				if (id !== undefined && !seen.has(id)) seen.set(id, ingredient.amount);
			}
		}
		return [...seen.entries()].slice(0, MAX_SIDE);
	});

	let outputs = $derived.by(() => {
		const seen = new SvelteSet<number>();
		for (const recipe of usedIn) seen.add(recipe.id);
		return [...seen].slice(0, MAX_SIDE);
	});

	function name(id: number): string {
		return catalogue.items.get(id)?.name ?? `#${id}`;
	}

	/** How many nodes fit in a column without running off the canvas. */
	function columnCapacity(height: number): number {
		return Math.max(1, Math.floor((height - 12) / (NODE_H + NODE_GAP)));
	}

	function layout(width: number, height: number) {
		nodes = [];
		const cx = width / 2;
		const cy = height / 2;
		const columnGap = Math.min(260, width / 2 - NODE_W / 2 - 12);
		const capacity = columnCapacity(height);

		nodes.push({ id: itemId, label: name(itemId), x: cx, y: cy, side: 0 });

		const place = (ids: number[], side: -1 | 1, amounts?: Map<number, number>) => {
			const shown = ids.slice(0, capacity);
			const pitch = NODE_H + NODE_GAP;
			const top = cy - ((shown.length - 1) * pitch) / 2;

			shown.forEach((id, index) => {
				nodes.push({
					id,
					label: name(id),
					x: cx + side * columnGap,
					y: top + index * pitch,
					side,
					amount: amounts?.get(id)
				});
			});
		};

		place(
			inputs.map(([id]) => id),
			-1,
			new Map(inputs)
		);
		place(outputs, 1);

		hiddenLeft = Math.max(0, inputs.length - capacity);
		hiddenRight = Math.max(0, outputs.length - capacity);
	}

	function roundRect(
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	) {
		context.beginPath();
		context.roundRect(x - w / 2, y - h / 2, w, h, r);
	}

	function styleFor(node: Node) {
		const css = getComputedStyle(document.documentElement);
		if (node.side === 0) return css.getPropertyValue('--cyan').trim() || '#22d3ee';
		if (researched.has(node.id)) return css.getPropertyValue('--green').trim() || '#34d399';
		return css.getPropertyValue('--text-faint').trim() || '#5a6980';
	}

	function draw(time: number) {
		const element = canvas;
		if (!element) return;
		const context = element.getContext('2d');
		if (!context) return;

		const ratio = window.devicePixelRatio || 1;
		const width = element.clientWidth;
		const height = element.clientHeight;

		if (element.width !== width * ratio || element.height !== height * ratio) {
			element.width = width * ratio;
			element.height = height * ratio;
			layout(width, height);
		}

		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, width, height);

		const centre = nodes[0];
		if (!centre) return;

		// Edges first, so nodes sit on top of them.
		for (const node of nodes) {
			if (node.side === 0) continue;

			const from = node.side === -1 ? node : centre;
			const to = node.side === -1 ? centre : node;
			const startX = from.x + NODE_W / 2;
			const endX = to.x - NODE_W / 2;
			const midX = (startX + endX) / 2;

			context.beginPath();
			context.moveTo(startX, from.y);
			context.bezierCurveTo(midX, from.y, midX, to.y, endX, to.y);

			const dim = hovered !== null && hovered !== node.id;
			context.strokeStyle = dim ? 'rgba(120, 150, 190, 0.10)' : 'rgba(34, 211, 238, 0.28)';
			context.lineWidth = hovered === node.id ? 1.8 : 1;
			context.stroke();

			// A packet travelling the edge, so direction of flow is obvious.
			const t = (((time / 2600 + node.id * 0.13) % 1) + 1) % 1;
			const px = bezierAt(startX, midX, midX, endX, t);
			const py = bezierAt(from.y, from.y, to.y, to.y, t);
			context.beginPath();
			context.arc(px, py, hovered === node.id ? 2.6 : 1.8, 0, Math.PI * 2);
			context.fillStyle = dim ? 'rgba(120, 150, 190, 0.25)' : 'rgba(232, 121, 249, 0.9)';
			context.fill();
		}

		for (const node of nodes) {
			const accent = styleFor(node);
			const dim = hovered !== null && hovered !== node.id && node.side !== 0;

			roundRect(context, node.x, node.y, NODE_W, NODE_H, 6);
			context.fillStyle = node.side === 0 ? 'rgba(34, 211, 238, 0.10)' : 'rgba(19, 25, 38, 0.92)';
			context.fill();
			context.strokeStyle = dim ? 'rgba(120, 150, 190, 0.18)' : accent;
			context.lineWidth = node.side === 0 ? 1.6 : 1;
			context.stroke();

			const item = catalogue.items.get(node.id);
			const icon = item ? sprite(item.imageUrl) : null;
			const textLeft = node.x - NODE_W / 2 + (icon ? 30 : 10);

			if (icon) {
				context.drawImage(icon, node.x - NODE_W / 2 + 6, node.y - 10, 20, 20);
			}

			context.fillStyle = dim ? 'rgba(150, 170, 195, 0.5)' : '#dbe4f0';
			context.font = `${node.side === 0 ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`;
			context.textAlign = 'left';
			context.textBaseline = 'middle';

			const full = node.amount ? `${node.amount}x ${node.label}` : node.label;
			const room = NODE_W - (icon ? 38 : 18);

			let label = full;
			if (context.measureText(label).width > room) {
				// Ellipsis matters here: several Terraria items share a long prefix, and a bare
				// truncation renders half a column as identical text.
				while (label.length > 1 && context.measureText(`${label}…`).width > room) {
					label = label.slice(0, -1);
				}
				label = `${label}…`;
			}
			context.fillText(label, textLeft, node.y);
		}

		frame = requestAnimationFrame(draw);
	}

	function bezierAt(p0: number, p1: number, p2: number, p3: number, t: number) {
		const u = 1 - t;
		return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
	}

	function nodeAt(x: number, y: number): Node | null {
		for (const node of nodes) {
			if (
				Math.abs(x - node.x) <= NODE_W / 2 &&
				Math.abs(y - node.y) <= NODE_H / 2 &&
				node.side !== 0
			) {
				return node;
			}
		}
		return null;
	}

	function onMove(event: PointerEvent) {
		const element = canvas;
		if (!element) return;
		const box = element.getBoundingClientRect();
		const found = nodeAt(event.clientX - box.left, event.clientY - box.top);
		hovered = found?.id ?? null;
		element.style.cursor = found ? 'pointer' : 'default';
	}

	function onClick(event: MouseEvent) {
		const element = canvas;
		if (!element) return;
		const box = element.getBoundingClientRect();
		const found = nodeAt(event.clientX - box.left, event.clientY - box.top);
		if (found) goto(resolve(`/item/${found.id}`));
	}

	$effect(() => {
		// Relayout when the item or its neighbours change.
		void [itemId, inputs, outputs];
		if (canvas) layout(canvas.clientWidth, canvas.clientHeight);

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="wrap panel">
	<div class="head">
		<span class="label side-l">
			{inputs.length} ingredient{inputs.length === 1 ? '' : 's'}
			{#if hiddenLeft}<span class="more">+{hiddenLeft} not shown</span>{/if}
		</span>
		<span class="label">crafting graph</span>
		<span class="label side-r">
			{#if hiddenRight}<span class="more">+{hiddenRight} not shown</span>{/if}
			used in {usedIn.length}
		</span>
	</div>

	<canvas
		bind:this={canvas}
		onpointermove={onMove}
		onpointerleave={() => (hovered = null)}
		onclick={onClick}
		aria-label="Crafting graph for {name(itemId)}"
	></canvas>

	{#if inputs.length === 0 && outputs.length === 0}
		<p class="empty label">nothing crafts this and nothing uses it</p>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.head {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid var(--border);
	}

	.side-l {
		text-align: left;
		color: var(--text-muted);
	}

	.side-r {
		text-align: right;
		color: var(--text-muted);
	}

	canvas {
		display: block;
		width: 100%;
		height: 440px;
		touch-action: none;
	}

	.more {
		margin: 0 0.4rem;
		color: var(--magenta);
	}

	.empty {
		padding: 0 0.85rem 0.7rem;
		text-align: center;
	}
</style>
