<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import CraftPlan from '$lib/components/CraftPlan.svelte';
	import ItemGraph from '$lib/components/ItemGraph.svelte';
	import { hideBrokenImage } from '$lib/images';
	import { tracker } from '$lib/tracker.svelte';

	let id = $derived(Number(page.params.id));
	let item = $derived(tracker.catalogue?.items.get(id) ?? null);

	let sacrificed = $derived(tracker.progress?.sacrificed[String(id)] ?? 0);
	let researched = $derived(item ? sacrificed >= item.research : false);

	let makes = $derived(tracker.catalogue?.recipes.filter((r) => r.id === id) ?? []);
	let usedIn = $derived(
		tracker.catalogue?.recipes.filter((r) => r.ingredients.some((i) => i.ids.includes(id))) ?? []
	);
	let drops = $derived(tracker.catalogue?.drops.get(id) ?? []);
	let leverage = $derived(tracker.leverage.find((l) => l.id === id) ?? null);

	function itemName(itemId: number): string {
		return tracker.catalogue?.items.get(itemId)?.name ?? `#${itemId}`;
	}

	function stationName(stationId: number): string {
		return tracker.catalogue?.stations.get(stationId)?.name ?? 'By Hand';
	}

	/** Coin values are stored in copper. */
	function coins(value: number | null): string {
		if (!value) return '—';
		const parts: string[] = [];
		const gold = Math.floor(value / 10000);
		const silver = Math.floor((value % 10000) / 100);
		const copper = value % 100;
		if (gold) parts.push(`${gold}g`);
		if (silver) parts.push(`${silver}s`);
		if (copper || parts.length === 0) parts.push(`${copper}c`);
		return parts.join(' ');
	}

	onMount(() => {
		// The page is reachable directly, so make sure the catalogue is loaded.
		if (!tracker.catalogue) tracker.start();
	});
</script>

<svelte:head>
	<title>{item ? `${item.name} — Terraria Journey Tracker` : 'Item'}</title>
</svelte:head>

<div class="page">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="back label" href="/">&larr; back to the tracker</a>

	{#if tracker.loading}
		<p class="label">loading item data…</p>
	{:else if !item}
		<p class="label">no item with id {id}</p>
	{:else}
		<header class="panel">
			<img
				src={item.imageUrl}
				alt=""
				referrerpolicy="no-referrer"
				onerror={hideBrokenImage}
				width="48"
				height="48"
			/>

			<div class="title">
				<h1>{item.name}</h1>
				<span class="label">
					id {item.id} · {item.internalName}{item.categories.length
						? ` · ${item.categories.join(', ')}`
						: ''}
				</span>
			</div>

			<div class="state" class:done={researched}>
				<span class="num big">{sacrificed}/{item.research}</span>
				<span class="label">{researched ? 'researched' : 'sacrificed'}</span>
			</div>
		</header>

		{#if item.tooltip.length > 0}
			<p class="tooltip panel">
				{#each item.tooltip as line (line)}<span>{line}</span>{/each}
			</p>
		{/if}

		<div class="facts">
			{#if item.damage}<div class="fact panel">
					<span class="label">damage</span><span class="num">{item.damage}</span>
				</div>{/if}
			{#if item.defense}<div class="fact panel">
					<span class="label">defense</span><span class="num">{item.defense}</span>
				</div>{/if}
			<div class="fact panel">
				<span class="label">sells for</span><span class="num">{coins(item.sell)}</span>
			</div>
			{#if item.maxStack}<div class="fact panel">
					<span class="label">max stack</span><span class="num">{item.maxStack}</span>
				</div>{/if}
			{#if leverage}
				<div class="fact panel accent">
					<span class="label">unlocks</span><span class="num">+{leverage.impact}</span>
				</div>
			{/if}
		</div>

		{#if tracker.catalogue}
			<ItemGraph catalogue={tracker.catalogue} {id} researched={tracker.researched} />
		{/if}

		{#if tracker.catalogue && tracker.progress}
			<CraftPlan catalogue={tracker.catalogue} researched={tracker.researched} target={id} />
		{/if}

		<div class="cols">
			<section class="panel">
				<h2 class="label">made with</h2>
				{#if makes.length === 0}
					<p class="empty label">no recipe — found in the world</p>
				{:else}
					<ul>
						{#each makes as r, i (i)}
							<li>
								<span class="station label">{r.stationIds.map(stationName).join(' / ')}</span>
								<span class="ing">
									{#each r.ingredients as ing (ing.name)}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href="/item/{ing.ids[0] ?? 0}" class="chip">
											{ing.amount}x {ing.name}
										</a>
									{/each}
								</span>
								{#if r.yield > 1}<span class="label yield">yields {r.yield}</span>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel">
				<h2 class="label">dropped by</h2>
				{#if drops.length === 0}
					<p class="empty label">no listed drop source</p>
				{:else}
					<ul class="drops">
						{#each drops as d, i (i)}
							<li>
								<span>{d.source}</span>
								<span class="label num">{d.quantity} · {d.rate}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<section class="panel">
			<h2 class="label">used in {usedIn.length} recipe{usedIn.length === 1 ? '' : 's'}</h2>
			{#if usedIn.length === 0}
				<p class="empty label">nothing uses this</p>
			{:else}
				<div class="uses">
					{#each usedIn.slice(0, 60) as r, i (i)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href="/item/{r.id}" class="chip">{itemName(r.id)}</a>
					{/each}
					{#if usedIn.length > 60}
						<span class="label">+{usedIn.length - 60} more</span>
					{/if}
				</div>
			{/if}
		</section>

		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="wiki label" href={item.wikiUrl} target="_blank" rel="noreferrer noopener">
			open on terraria.wiki.gg &rarr;
		</a>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.back,
	.wiki {
		align-self: start;
		text-decoration: none;
	}

	.back:hover,
	.wiki:hover {
		color: var(--cyan);
	}

	header {
		display: grid;
		grid-template-columns: 48px 1fr auto;
		align-items: center;
		gap: 0.9rem;
		padding: 0.9rem 1rem;
	}

	img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		letter-spacing: -0.015em;
	}

	.title {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.state {
		display: flex;
		flex-direction: column;
		align-items: end;
	}

	.big {
		font-size: 1.15rem;
		font-weight: 650;
	}

	.done .big {
		color: var(--green);
	}

	.tooltip {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0.7rem 0.9rem;
		font-size: 0.85rem;
		color: var(--text-muted);
		border-left: 3px solid var(--cyan);
	}

	.facts {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
	}

	.fact {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.55rem 0.7rem;
	}

	.fact .num {
		font-size: 1rem;
		font-weight: 600;
	}

	.accent .num {
		color: var(--cyan);
	}

	.cols {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		align-items: start;
	}

	section {
		padding: 0.8rem 0.9rem;
	}

	h2 {
		margin: 0 0 0.6rem;
		font-size: 0.68rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.drops li {
		justify-content: space-between;
		font-size: 0.82rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--border);
	}

	.station {
		color: var(--magenta);
	}

	.ing,
	.uses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.chip {
		padding: 0.15rem 0.45rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
		font-family: var(--mono);
		font-size: 0.7rem;
		text-decoration: none;
	}

	.chip:hover {
		color: var(--cyan);
		border-color: var(--border-strong);
	}

	.yield {
		color: var(--green);
	}

	.empty {
		margin: 0;
	}
</style>
