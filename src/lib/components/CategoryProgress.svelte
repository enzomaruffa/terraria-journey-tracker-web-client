<script lang="ts">
	/*
	 * Plain Map/Set on purpose: these are local working collections inside a pure
	 * computation, not shared state. Making them reactive re-triggers the very
	 * derivation that fills them.
	 */
	/* eslint-disable svelte/prefer-svelte-reactivity */
	/**
	 * Which parts of the catalogue are lagging.
	 *
	 * A single percentage hides the shape of the grind: someone can be 90% through weapons and
	 * 5% through furniture, and those want completely different play sessions.
	 */
	import type { ClosureResult } from '$lib/analysis/closure';
	import type { Catalogue, Progress } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		progress: Progress;
		closure: ClosureResult | null;
	}

	let { catalogue, progress, closure }: Props = $props();

	interface Row {
		name: string;
		total: number;
		researched: number;
		reachable: number;
		percent: number;
	}

	let rows = $derived.by<Row[]>(() => {
		const byName = new Map<string, Row>();

		for (const item of catalogue.items.values()) {
			const sacrificed = progress.sacrificed[String(item.id)] ?? 0;
			const done = sacrificed >= item.research;
			// "Reachable" counts what the cascade can already produce but you have not made yet.
			const reachable = !done && (closure?.available.has(item.id) ?? false);

			for (const name of item.categories) {
				let row = byName.get(name);
				if (!row) {
					row = { name, total: 0, researched: 0, reachable: 0, percent: 0 };
					byName.set(name, row);
				}
				row.total += 1;
				if (done) row.researched += 1;
				else if (reachable) row.reachable += 1;
			}
		}

		const list = [...byName.values()];
		for (const row of list) row.percent = row.total ? (100 * row.researched) / row.total : 0;

		// Biggest categories first: they dominate the overall number.
		return list.sort((a, b) => b.total - a.total);
	});
</script>

<section class="panel">
	<h2 class="label">by category</h2>

	<ul>
		{#each rows as row (row.name)}
			<li>
				<span class="name">{row.name}</span>

				<div class="bar" title="{row.researched} of {row.total} researched">
					<span class="done" style="width: {row.percent}%"></span>
					<span
						class="reach"
						style="width: {row.total
							? (100 * row.reachable) / row.total
							: 0}%; left: {row.percent}%"
					></span>
				</div>

				<span class="pct num">{row.percent.toFixed(0)}%</span>
				<span class="count num label">{row.researched}/{row.total}</span>
			</li>
		{/each}
	</ul>

	<p class="key label">
		<span class="swatch done"></span> researched
		<span class="swatch reach"></span> reachable without gathering
	</p>
</section>

<style>
	section {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	h2 {
		margin: 0;
		font-size: 0.68rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	li {
		display: grid;
		grid-template-columns: minmax(6rem, 10rem) 1fr auto auto;
		align-items: center;
		gap: 0.7rem;
		font-size: 0.78rem;
	}

	.name {
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar {
		position: relative;
		height: 6px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		overflow: hidden;
	}

	.bar span {
		position: absolute;
		top: 0;
		bottom: 0;
	}

	.bar .done {
		left: 0;
		background: var(--green);
	}

	.bar .reach {
		background: color-mix(in srgb, var(--cyan) 55%, transparent);
	}

	.pct {
		min-width: 2.4rem;
		text-align: right;
		font-size: 0.75rem;
		color: var(--text);
	}

	.count {
		min-width: 5rem;
		text-align: right;
		font-size: 0.66rem;
	}

	.key {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0.2rem 0 0;
	}

	.swatch {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
		display: inline-block;
	}

	.swatch:not(:first-child) {
		margin-left: 0.6rem;
	}

	.swatch.done {
		background: var(--green);
	}

	.swatch.reach {
		background: color-mix(in srgb, var(--cyan) 55%, transparent);
	}

	@media (max-width: 620px) {
		li {
			grid-template-columns: minmax(5rem, 8rem) 1fr auto;
		}
		.count {
			display: none;
		}
	}
</style>
