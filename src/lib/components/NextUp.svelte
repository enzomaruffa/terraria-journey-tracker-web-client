<script lang="ts">
	/**
	 * The shortlist that turns 5,000 missing items into something actionable: what to go and
	 * find, ranked by how much of the game it opens up.
	 */
	import { hideBrokenImage } from '$lib/images';
	import type { Leverage } from '$lib/analysis/leverage';
	import type { Catalogue } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		leverage: Leverage[];
	}

	let { catalogue, leverage }: Props = $props();

	type Sort = 'impact' | 'efficiency';
	let sort = $state<Sort>('impact');
	let limit = $state(12);

	let ranked = $derived.by(() => {
		const list = [...leverage];
		if (sort === 'efficiency') {
			list.sort((a, b) => b.impactPerSacrifice - a.impactPerSacrifice || b.impact - a.impact);
		}
		return list.slice(0, limit);
	});

	let top = $derived(leverage[0]?.impact ?? 1);

	let craftable = $derived(new Set(catalogue.recipes.map((r) => r.id)));

	function sources(id: number): string {
		const drops = catalogue.drops.get(id);
		if (!drops || drops.length === 0) {
			// The Drops table covers things that drop from something; ore you mine is simply
			// absent from it, so "no listed drop" is all we can honestly say.
			return craftable.has(id) ? 'crafted' : 'found in the world';
		}

		// The same enemy can appear more than once with different rates or difficulties.
		const unique = [...new Set(drops.map((d) => d.source))];
		const shown = unique.slice(0, 2).join(', ');
		return unique.length > 2 ? `${shown} +${unique.length - 2}` : shown;
	}
</script>

<section class="panel">
	<header>
		<div>
			<span class="label">next up</span>
			<p class="blurb">
				Research one of these and the rest cascades. Ranked by how many further items each unlocks.
			</p>
		</div>

		<div class="sorts">
			<button class="btn" class:on={sort === 'impact'} onclick={() => (sort = 'impact')}>
				most unlocked
			</button>
			<button class="btn" class:on={sort === 'efficiency'} onclick={() => (sort = 'efficiency')}>
				best per sacrifice
			</button>
		</div>
	</header>

	{#if ranked.length === 0}
		<p class="empty label">nothing left to unlock — everything reachable is already researched</p>
	{:else}
		<ol>
			{#each ranked as entry (entry.id)}
				{@const item = catalogue.items.get(entry.id)}
				{#if item}
					<li>
						<img
							src={item.imageUrl}
							alt=""
							loading="lazy"
							decoding="async"
							referrerpolicy="no-referrer"
							onerror={hideBrokenImage}
						/>

						<div class="who">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="name" href="/item/{item.id}">{item.name}</a>
							<span class="src">{sources(item.id)}</span>
						</div>

						<div class="bar" aria-hidden="true">
							<span style="width: {(entry.impact / top) * 100}%"></span>
						</div>

						<div class="stats">
							<span class="unlocks num">+{entry.impact}</span>
							<span class="cost num label">{item.research}x to research</span>
						</div>
					</li>
				{/if}
			{/each}
		</ol>

		{#if leverage.length > limit}
			<button class="btn more" onclick={() => (limit += 12)}>
				show more ({leverage.length - limit} left)
			</button>
		{/if}
	{/if}
</section>

<style>
	section {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.blurb {
		margin: 0.3rem 0 0;
		font-size: 0.78rem;
		color: var(--text-muted);
		max-width: 42ch;
	}

	.sorts {
		display: flex;
		gap: 0.35rem;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	li {
		display: grid;
		grid-template-columns: 30px minmax(8rem, 1.3fr) minmax(3rem, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0.5rem;
		background: var(--surface-2);
		border: 1px solid transparent;
		border-radius: var(--radius);
	}

	li:hover {
		border-color: var(--border-strong);
	}

	img {
		width: 30px;
		height: 30px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-size: 0.85rem;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name:hover {
		color: var(--cyan);
	}

	.src {
		font-size: 0.68rem;
		color: var(--text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar {
		height: 4px;
		background: color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: 999px;
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--cyan), var(--magenta));
		box-shadow: var(--glow);
	}

	.stats {
		display: flex;
		flex-direction: column;
		align-items: end;
	}

	.unlocks {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--cyan);
	}

	.cost {
		font-size: 0.62rem;
	}

	.more {
		align-self: center;
	}

	.empty {
		margin: 0;
		padding: 1rem 0;
		text-align: center;
	}

	@media (max-width: 620px) {
		li {
			grid-template-columns: 26px 1fr auto;
		}
		.bar {
			display: none;
		}
	}
</style>
