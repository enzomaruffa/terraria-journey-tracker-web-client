<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { hideBrokenImage } from '$lib/images';
	import type { Catalogue, Progress } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		progress: Progress;
	}

	let { catalogue, progress }: Props = $props();

	let craftableSet = $derived(new SvelteSet(progress.craftable));

	let rows = $derived.by(() => {
		return [...catalogue.stations.values()]
			.map((station) => {
				let craftable = 0;
				let researched = 0;

				for (const id of station.craftableIds) {
					const item = catalogue.items.get(id);
					if (!item) continue;
					if ((progress.sacrificed[String(id)] ?? 0) >= item.research) researched++;
					else if (craftableSet.has(id)) craftable++;
				}

				return { station, craftable, researched, total: station.craftableIds.length };
			})
			.sort((a, b) => b.craftable - a.craftable || a.station.name.localeCompare(b.station.name));
	});
</script>

<section>
	<p class="intro">
		What each crafting station can make, ranked by how much of it you could research right now.
	</p>

	<div class="grid">
		{#each rows as row (row.station.id)}
			<div class="station" class:idle={row.craftable === 0}>
				<!-- See ItemCard: without no-referrer, wiki.gg returns a 403 for these. -->
				<img
					src={row.station.imageUrls[0]}
					alt=""
					loading="lazy"
					decoding="async"
					referrerpolicy="no-referrer"
					onerror={hideBrokenImage}
				/>
				<div class="text">
					<span class="name">{row.station.name}</span>
					<span class="meta">
						{row.researched}/{row.total} researched
					</span>
				</div>
				<span class="badge" class:zero={row.craftable === 0}>{row.craftable}</span>
			</div>
		{/each}
	</div>
</section>

<style>
	.intro {
		margin: 0 0 0.9rem;
		font-size: 0.8rem;
		color: var(--text-faint);
	}

	.grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}

	.station {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.idle {
		opacity: 0.55;
	}

	img {
		width: 34px;
		height: 34px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 0.72rem;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}

	.badge {
		padding: 0.2rem 0.5rem;
		background: color-mix(in srgb, var(--cyan) 20%, var(--surface));
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.badge.zero {
		background: var(--bg);
		color: var(--text-faint);
	}
</style>
