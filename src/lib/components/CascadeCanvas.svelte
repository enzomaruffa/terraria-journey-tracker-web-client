<script lang="ts">
	/*
	 * Plain Map/Set on purpose: these are local working collections inside a pure
	 * computation, not shared state. Making them reactive re-triggers the very
	 * derivation that fills them.
	 */
	/* eslint-disable svelte/prefer-svelte-reactivity */
	/**
	 * The research cascade, drawn as concentric rings.
	 *
	 * The centre is what you have researched. Each ring out is one crafting step further, so
	 * the picture answers "how far does my research actually reach" at a glance — which is the
	 * whole point of computing the closure rather than a single step.
	 */
	import type { ClosureResult } from '$lib/analysis/closure';
	import type { Catalogue } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		closure: ClosureResult;
		researched: Set<number>;
	}

	let { catalogue, closure, researched }: Props = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let hovered = $state<{ name: string; depth: number } | null>(null);

	interface Dot {
		x: number;
		y: number;
		r: number;
		depth: number;
		id: number;
	}

	let dots: Dot[] = [];
	let frame = 0;

	/** Items per ring, keyed by craft distance. */
	let rings = $derived.by(() => {
		const byDepth = new Map<number, number[]>();
		for (const [id, depth] of closure.depth) {
			// Depth 0 is what you already have; the rings show what it reaches.
			if (depth === 0) continue;
			const list = byDepth.get(depth);
			if (list) list.push(id);
			else byDepth.set(depth, [id]);
		}
		return [...byDepth.entries()].sort((a, b) => a[0] - b[0]);
	});

	function layout(width: number, height: number) {
		const cx = width / 2;
		const cy = height / 2;
		const maxRadius = Math.min(width, height) / 2 - 14;
		const count = Math.max(rings.length, 1);

		dots = [];
		rings.forEach(([depth, ids], index) => {
			const radius = maxRadius * ((index + 1) / count);
			// Sample rather than plot thousands of overlapping dots.
			const step = Math.max(1, Math.ceil(ids.length / 220));
			const sampled = ids.filter((_, i) => i % step === 0);

			sampled.forEach((id, i) => {
				// Golden-angle offset per ring keeps successive rings from lining up.
				const angle = (i / sampled.length) * Math.PI * 2 + depth * 2.399;
				dots.push({
					x: cx + Math.cos(angle) * radius,
					y: cy + Math.sin(angle) * radius,
					r: 1.7,
					depth,
					id
				});
			});
		});
	}

	function colourFor(depth: number, alpha: number) {
		// Cyan nearest the centre through magenta at the frontier.
		const t = rings.length > 1 ? (depth - 1) / (rings.length - 1) : 0;
		const hue = 187 + t * 100;
		return `hsl(${hue} 85% 62% / ${alpha})`;
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

		const cx = width / 2;
		const cy = height / 2;
		const maxRadius = Math.min(width, height) / 2 - 14;

		// Ring guides.
		context.lineWidth = 1;
		rings.forEach((_, index) => {
			context.beginPath();
			context.arc(cx, cy, maxRadius * ((index + 1) / rings.length), 0, Math.PI * 2);
			context.strokeStyle = 'rgba(120, 160, 200, 0.06)';
			context.stroke();
		});

		// A slow sweep, so a live page reads as live without being distracting.
		const sweep = (time / 4000) % 1;
		const sweepAngle = sweep * Math.PI * 2;
		const gradient = context.createConicGradient?.(sweepAngle, cx, cy);
		if (gradient) {
			gradient.addColorStop(0, 'rgba(34, 211, 238, 0.10)');
			gradient.addColorStop(0.08, 'rgba(34, 211, 238, 0)');
			gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
			context.fillStyle = gradient;
			context.beginPath();
			context.arc(cx, cy, maxRadius, 0, Math.PI * 2);
			context.fill();
		}

		for (const dot of dots) {
			const angle = Math.atan2(dot.y - cy, dot.x - cx);
			const normalised = (angle + Math.PI * 2) % (Math.PI * 2);
			// Dots brighten as the sweep passes over them.
			const delta = Math.abs(
				((normalised - sweepAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)
			);
			const pulse = delta < 0.06 ? 1 - delta / 0.06 : 0;

			context.beginPath();
			context.arc(dot.x, dot.y, dot.r + pulse * 1.6, 0, Math.PI * 2);
			context.fillStyle = colourFor(dot.depth, 0.5 + pulse * 0.5);
			context.fill();
		}

		// The researched core.
		context.beginPath();
		context.arc(cx, cy, 22, 0, Math.PI * 2);
		context.fillStyle = 'rgba(52, 211, 153, 0.12)';
		context.fill();
		context.strokeStyle = 'rgba(52, 211, 153, 0.55)';
		context.stroke();

		context.fillStyle = 'rgba(219, 228, 240, 0.9)';
		context.font = '600 13px ui-monospace, monospace';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(String(researched.size), cx, cy);

		frame = requestAnimationFrame(draw);
	}

	function onPointerMove(event: PointerEvent) {
		const element = canvas;
		if (!element) return;
		const box = element.getBoundingClientRect();
		const x = event.clientX - box.left;
		const y = event.clientY - box.top;

		let closest: Dot | null = null;
		let bestDistance = 10;
		for (const dot of dots) {
			const distance = Math.hypot(dot.x - x, dot.y - y);
			if (distance < bestDistance) {
				bestDistance = distance;
				closest = dot;
			}
		}

		hovered = closest
			? { name: catalogue.items.get(closest.id)?.name ?? `#${closest.id}`, depth: closest.depth }
			: null;
	}

	$effect(() => {
		// Re-read so a new closure relayouts rather than animating stale dots.
		void rings;
		if (canvas) layout(canvas.clientWidth, canvas.clientHeight);

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="wrap panel">
	<div class="head">
		<span class="label">research cascade</span>
		<span class="legend">
			<span class="dot core"></span> researched
			<span class="dot near"></span> 1 step
			<span class="dot far"></span>
			{closure.maxDepth} steps
		</span>
	</div>

	<canvas
		bind:this={canvas}
		onpointermove={onPointerMove}
		onpointerleave={() => (hovered = null)}
		aria-label="Research cascade: {closure.unlocked
			.length} items reachable across {closure.maxDepth} crafting steps"
	></canvas>

	<div class="foot">
		{#if hovered}
			<span class="mono hit">{hovered.name}</span>
			<span class="label">step {hovered.depth}</span>
		{:else}
			<span class="label">
				{closure.unlocked.length.toLocaleString()} reachable · {closure.maxDepth} steps deep
			</span>
		{/if}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.head,
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
	}

	.head {
		border-bottom: 1px solid var(--border);
	}

	.foot {
		border-top: 1px solid var(--border);
		min-height: 2.1rem;
	}

	.hit {
		font-size: 0.8rem;
		color: var(--cyan);
	}

	canvas {
		display: block;
		width: 100%;
		height: 280px;
		touch-action: none;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		display: inline-block;
	}

	.dot:not(:first-child) {
		margin-left: 0.5rem;
	}

	.core {
		background: var(--green);
	}
	.near {
		background: var(--cyan);
	}
	.far {
		background: var(--magenta);
	}
</style>
