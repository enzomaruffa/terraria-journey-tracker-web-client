<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import ItemGrid from '$lib/components/ItemGrid.svelte';
	import Overview from '$lib/components/Overview.svelte';
	import StationBrowser from '$lib/components/StationBrowser.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import { tracker } from '$lib/tracker.svelte';

	type Tab = 'items' | 'stations';
	let tab = $state<Tab>('items');

	onMount(() => tracker.start());
	onDestroy(() => tracker.destroy());
</script>

<svelte:head>
	<title>Terraria Journey Tracker</title>
	<meta name="description" content="Track Terraria Journey mode research progress as you play." />
</svelte:head>

<div class="page">
	<StatusBar />

	{#if tracker.error}
		<p class="error">{tracker.error}</p>
	{/if}

	{#if tracker.loading}
		<p class="muted">Loading item data…</p>
	{:else if !tracker.catalogue}
		<p class="error">No item data available. Is the tracker running?</p>
	{:else if !tracker.progress}
		<DropZone />
	{:else}
		{#if tracker.progress.player.isJourney === false}
			<p class="warn">
				<strong>{tracker.progress.player.name}</strong> is a
				{tracker.progress.player.difficulty} character, not a Journey one, so there is no research to
				track.
			</p>
		{/if}

		{#if tracker.progress.unknownInternalNames.length > 0}
			<p class="warn">
				{tracker.progress.unknownInternalNames.length} researched item(s) are missing from the bundled
				data — your Terraria is probably newer than this snapshot. Re-run
				<code>terraria-tracker-refresh</code> on the server.
			</p>
		{/if}

		<Overview progress={tracker.progress} />

		<nav class="tabs">
			<button type="button" class:on={tab === 'items'} onclick={() => (tab = 'items')}>
				Items
			</button>
			<button type="button" class:on={tab === 'stations'} onclick={() => (tab = 'stations')}>
				Crafting stations
			</button>
		</nav>

		{#if tab === 'items'}
			<ItemGrid catalogue={tracker.catalogue} progress={tracker.progress} />
		{:else}
			<StationBrowser catalogue={tracker.catalogue} progress={tracker.progress} />
		{/if}

		{#if tracker.source === 'server' && tracker.connection === 'offline'}
			<DropZone />
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.error,
	.warn {
		margin: 0;
		padding: 0.7rem 0.9rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.error {
		background: color-mix(in srgb, var(--red) 15%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--red) 45%, var(--border));
	}

	.warn {
		background: color-mix(in srgb, var(--amber) 12%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--amber) 40%, var(--border));
	}

	.tabs {
		display: flex;
		gap: 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.tabs button {
		padding: 0.5rem 0.9rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.tabs button.on {
		color: var(--text);
		border-bottom-color: var(--blue);
	}

	code {
		padding: 0.1rem 0.3rem;
		background: var(--bg);
		border-radius: 4px;
	}
</style>
