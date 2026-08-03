<script lang="ts">
	/**
	 * The item in context: what goes into it on the left, what it goes into on the right.
	 *
	 * Crafting is a graph, and a column view shows an item's place in it far faster than two
	 * lists do. Depth is adjustable because one layer answers "what is this made of" while
	 * three answers "where does this sit in the tree" — different questions, same picture.
	 * Nodes are clickable, so the graph doubles as a way to walk the tree.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Catalogue } from '$lib/types';

	/*
	 * The collections below are deliberately plain Map/Set, not the Svelte reactive ones.
	 * They are local working data built inside layout(), which runs from an $effect — a
	 * reactive collection there re-triggers the very effect that fills it, which is an
	 * infinite loop (effect_update_depth_exceeded) rather than a lint nicety.
	 */
	/* eslint-disable svelte/prefer-svelte-reactivity */

	interface Props {
		catalogue: Catalogue;
		id: number;
		researched: Set<number>;
	}

	let { catalogue, id: itemId, researched }: Props = $props();

	const NODE_H = 30;
	const NODE_GAP = 8;
	const MAX_DEPTH = 3;
	/** Fixed rather than measured, so the layout cannot feed back into what is drawn. */
	const MAX_PER_COLUMN = 11;

	let depth = $state(1);

	interface Node {
		id: number;
		label: string;
		x: number;
		y: number;
		/** Signed layer: negative is towards ingredients, positive towards products. */
		layer: number;
		amount?: number;
		parent: number | null;
	}

	let canvas: HTMLCanvasElement | null = $state(null);
	let hovered = $state<number | null>(null);
	let nodes: Node[] = [];
	let nodeWidth = 150;
	let frame = 0;

	/** Sprites are hotlinked, so every load has to suppress the referrer or wiki.gg 403s it. */
	const sprites = new Map<string, HTMLImageElement>();

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

	function name(id: number): string {
		return catalogue.items.get(id)?.name ?? `#${id}`;
	}

	/** Distinct ingredients of everything that crafts `id`. */
	function ingredientsOf(id: number): Map<number, number> {
		const found = new Map<number, number>();
		for (const recipe of catalogue.recipes) {
			if (recipe.id !== id) continue;
			for (const ingredient of recipe.ingredients) {
				const first = ingredient.ids[0];
				if (first !== undefined && !found.has(first)) found.set(first, ingredient.amount);
			}
		}
		return found;
	}

	/** Everything that lists `id` as an ingredient. */
	function productsOf(id: number): number[] {
		const found: number[] = [];
		for (const recipe of catalogue.recipes) {
			if (recipe.ingredients.some((i) => i.ids.includes(id)) && !found.includes(recipe.id)) {
				found.push(recipe.id);
			}
		}
		return found;
	}

	interface Column {
		entries: { id: number; parent: number; amount?: number }[];
		dropped: number;
	}

	/**
	 * Walk outwards one layer at a time.
	 *
	 * `seen` spans every layer so an item that appears twice is drawn at its shallowest
	 * position rather than repeated across columns.
	 */
	function expand(side: -1 | 1, maxDepth: number, capacity: number): Column[] {
		const columns: Column[] = [];
		const seen = new Set<number>([itemId]);
		let frontier = [itemId];

		for (let step = 0; step < maxDepth; step++) {
			const entries: Column['entries'] = [];

			for (const parent of frontier) {
				if (side === -1) {
					for (const [id, amount] of ingredientsOf(parent)) {
						if (seen.has(id)) continue;
						seen.add(id);
						entries.push({ id, parent, amount });
					}
				} else {
					for (const id of productsOf(parent)) {
						if (seen.has(id)) continue;
						seen.add(id);
						entries.push({ id, parent });
					}
				}
			}

			if (entries.length === 0) break;

			const kept = entries.slice(0, capacity);
			columns.push({ entries: kept, dropped: entries.length - kept.length });
			frontier = kept.map((entry) => entry.id);
		}

		return columns;
	}

	/*
	 * Columns are derived from the item and the depth only — never from the canvas size.
	 *
	 * Deriving them from the measured height fed back on itself: the "N more" note is part of
	 * the layout, so showing it changed the height, which changed how many nodes fit, which
	 * changed the note. That loop is what crashed items with many recipes.
	 */
	let graph = $derived.by(() => {
		const left = expand(-1, depth, MAX_PER_COLUMN);
		const right = expand(1, depth, MAX_PER_COLUMN);
		const dropped = [...left, ...right].reduce((sum, column) => sum + column.dropped, 0);
		return { left, right, dropped };
	});

	let truncated = $derived(graph.dropped);

	function layout(width: number, height: number) {
		nodes = [];

		const cx = width / 2;
		const cy = height / 2;

		const { left, right } = graph;
		const columns = Math.max(left.length, right.length);

		// Columns have to share the width, so nodes shrink as depth grows.
		const slots = columns * 2 + 1;
		const slotWidth = width / slots;
		nodeWidth = Math.max(72, Math.min(150, slotWidth - 14));

		const indexById = new Map<number, number>();
		nodes.push({ id: itemId, label: name(itemId), x: cx, y: cy, layer: 0, parent: null });
		indexById.set(itemId, 0);

		const place = (side: -1 | 1, list: Column[]) => {
			list.forEach((column, step) => {
				const pitch = NODE_H + NODE_GAP;
				const top = cy - ((column.entries.length - 1) * pitch) / 2;

				column.entries.forEach((entry, index) => {
					const parentIndex = indexById.get(entry.parent) ?? 0;
					nodes.push({
						id: entry.id,
						label: name(entry.id),
						x: cx + side * slotWidth * (step + 1),
						y: top + index * pitch,
						layer: side * (step + 1),
						amount: entry.amount,
						parent: parentIndex
					});
					// First position wins, matching the dedupe in expand().
					if (!indexById.has(entry.id)) indexById.set(entry.id, nodes.length - 1);
				});
			});
		};

		place(-1, left);
		place(1, right);
	}

	function accentFor(node: Node): string {
		const css = getComputedStyle(document.documentElement);
		if (node.layer === 0) return css.getPropertyValue('--cyan').trim() || '#22d3ee';
		if (researched.has(node.id)) return css.getPropertyValue('--green').trim() || '#34d399';
		return css.getPropertyValue('--text-faint').trim() || '#5a6980';
	}

	function bezierAt(p0: number, p1: number, p2: number, p3: number, t: number) {
		const u = 1 - t;
		return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
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

		for (const node of nodes) {
			if (node.parent === null) continue;
			const parent = nodes[node.parent];

			// Edges always run left to right, whichever side the node is on.
			const from = node.layer < 0 ? node : parent;
			const to = node.layer < 0 ? parent : node;
			const startX = from.x + nodeWidth / 2;
			const endX = to.x - nodeWidth / 2;
			const midX = (startX + endX) / 2;

			const dim = hovered !== null && hovered !== node.id && hovered !== parent.id;

			context.beginPath();
			context.moveTo(startX, from.y);
			context.bezierCurveTo(midX, from.y, midX, to.y, endX, to.y);
			context.strokeStyle = dim ? 'rgba(120, 150, 190, 0.08)' : 'rgba(34, 211, 238, 0.26)';
			context.lineWidth = hovered === node.id ? 1.8 : 1;
			context.stroke();

			const t = (((time / 2600 + node.id * 0.13) % 1) + 1) % 1;
			context.beginPath();
			context.arc(
				bezierAt(startX, midX, midX, endX, t),
				bezierAt(from.y, from.y, to.y, to.y, t),
				hovered === node.id ? 2.6 : 1.7,
				0,
				Math.PI * 2
			);
			context.fillStyle = dim ? 'rgba(120, 150, 190, 0.2)' : 'rgba(232, 121, 249, 0.85)';
			context.fill();
		}

		for (const node of nodes) {
			const accent = accentFor(node);
			const dim = hovered !== null && hovered !== node.id && node.layer !== 0;
			const showIcon = nodeWidth >= 104;

			context.beginPath();
			context.roundRect(node.x - nodeWidth / 2, node.y - NODE_H / 2, nodeWidth, NODE_H, 6);
			context.fillStyle = node.layer === 0 ? 'rgba(34, 211, 238, 0.10)' : 'rgba(19, 25, 38, 0.92)';
			context.fill();
			context.strokeStyle = dim ? 'rgba(120, 150, 190, 0.16)' : accent;
			context.lineWidth = node.layer === 0 ? 1.6 : 1;
			context.stroke();

			const item = catalogue.items.get(node.id);
			const icon = showIcon && item ? sprite(item.imageUrl) : null;

			if (icon) context.drawImage(icon, node.x - nodeWidth / 2 + 5, node.y - 9, 18, 18);

			context.fillStyle = dim ? 'rgba(150, 170, 195, 0.5)' : '#dbe4f0';
			context.font = `${node.layer === 0 ? '600 ' : ''}11px ui-sans-serif, system-ui, sans-serif`;
			context.textAlign = 'left';
			context.textBaseline = 'middle';

			const full = node.amount ? `${node.amount}x ${node.label}` : node.label;
			const room = nodeWidth - (icon ? 34 : 16);

			let label = full;
			if (context.measureText(label).width > room) {
				// Ellipsis matters: several Terraria items share a long prefix, and a bare
				// truncation renders half a column as identical text.
				while (label.length > 1 && context.measureText(`${label}…`).width > room) {
					label = label.slice(0, -1);
				}
				label = `${label}…`;
			}
			context.fillText(label, node.x - nodeWidth / 2 + (icon ? 27 : 8), node.y);
		}

		frame = requestAnimationFrame(draw);
	}

	function nodeAt(x: number, y: number): Node | null {
		for (const node of nodes) {
			if (
				node.layer !== 0 &&
				Math.abs(x - node.x) <= nodeWidth / 2 &&
				Math.abs(y - node.y) <= NODE_H / 2
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
		// Relayout when the graph contents change.
		void graph;
		if (canvas) layout(canvas.clientWidth, canvas.clientHeight);

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="wrap panel">
	<div class="head">
		<span class="label side-l">ingredients</span>

		<div class="depth">
			<span class="label">layers</span>
			{#each Array.from({ length: MAX_DEPTH }, (_, i) => i + 1) as level (level)}
				<button class="btn" class:on={depth === level} onclick={() => (depth = level)}>
					{level}
				</button>
			{/each}
		</div>

		<span class="label side-r">used in</span>
	</div>

	<canvas
		bind:this={canvas}
		onpointermove={onMove}
		onpointerleave={() => (hovered = null)}
		onclick={onClick}
		aria-label="Crafting graph for {name(itemId)}, {depth} layer(s) deep"
	></canvas>

	{#if truncated > 0}
		<p class="note label">{truncated} more would not fit — open an item to keep walking</p>
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
		gap: 0.5rem;
		padding: 0.55rem 0.85rem;
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

	.depth {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.depth .btn {
		padding: 0.2rem 0.5rem;
	}

	canvas {
		display: block;
		width: 100%;
		height: 460px;
		touch-action: none;
	}

	.note {
		margin: 0;
		padding: 0 0.85rem 0.6rem;
		text-align: center;
	}
</style>
