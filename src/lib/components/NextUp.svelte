<script lang="ts">
	/**
	 * The shortlist that turns 5,000 missing items into something actionable: what to go and
	 * find, ranked by how much of the game it opens up.
	 */
	import { hideBrokenImage } from '$lib/images';
	import { sourceLabel } from '$lib/sources';
	import type { Leverage } from '$lib/analysis/leverage';
	import type { Catalogue, Progress } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		leverage: Leverage[];
		progress: Progress;
	}

	let { catalogue, leverage, progress }: Props = $props();

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

	let sources = $derived((id: number) => sourceLabel(catalogue, id));

	/**
	 * How far along this item already is.
	 *
	 * The bar used to show leverage relative to the top-ranked item, which read as research
	 * progress and so looked plainly wrong: an item you have never touched showed a
	 * half-filled bar next to "100x to research". A bar means progress; leverage is the
	 * number.
	 */
	function done(id: number): number {
		return progress.sacrificed[String(id)] ?? 0;
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

						{#if done(item.id) > 0}
							<div
								class="bar"
								title="{done(item.id)} of {item.research} sacrificed"
								role="progressbar"
								aria-valuenow={done(item.id)}
								aria-valuemin="0"
								aria-valuemax={item.research}
							>
								<span style="width: {Math.min(100, (done(item.id) / item.research) * 100)}%"></span>
							</div>
						{/if}

						<div class="stats">
							<span class="unlocks num">+{entry.impact}</span>
							<span class="cost num label">
								{#if done(item.id) > 0}
									{done(item.id)}/{item.research} sacrificed
								{:else}
									{item.research}x to research
								{/if}
							</span>
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

	/* Cards where there is room; rows on a phone, where density wins. */
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}

	li {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) auto;
		grid-template-areas:
			'icon who stats'
			'icon bar stats';
		align-items: center;
		gap: 0.3rem 0.65rem;
		padding: 0.6rem 0.7rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition:
			border-color 0.15s,
			transform 0.15s;
	}

	li:hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	img {
		grid-area: icon;
		width: 34px;
		height: 34px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.who {
		grid-area: who;
	}

	.bar {
		grid-area: bar;
	}

	.stats {
		grid-area: stats;
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
		background: var(--amber);
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

	@media (max-width: 640px) {
		ol {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		li {
			grid-template-columns: 26px minmax(0, 1fr) auto;
			grid-template-areas: 'icon who stats';
			padding: 0.4rem 0.5rem;
		}

		img {
			width: 26px;
			height: 26px;
		}

		.bar {
			display: none;
		}
	}
</style>
