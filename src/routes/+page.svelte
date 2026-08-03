<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CascadeCanvas from '$lib/components/CascadeCanvas.svelte';
	import CategoryProgress from '$lib/components/CategoryProgress.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import GoFind from '$lib/components/GoFind.svelte';
	import ItemGrid from '$lib/components/ItemGrid.svelte';
	import NextUp from '$lib/components/NextUp.svelte';
	import Overview from '$lib/components/Overview.svelte';
	import StationBrowser from '$lib/components/StationBrowser.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import { readQuery, replaceQuery } from '$lib/urlstate';
	import { tracker } from '$lib/tracker.svelte';

	type Tab = 'next' | 'find' | 'items' | 'categories' | 'stations';

	const TABS: { key: Tab; label: string }[] = [
		{ key: 'next', label: 'next up' },
		{ key: 'find', label: 'go find' },
		{ key: 'items', label: 'items' },
		{ key: 'categories', label: 'categories' },
		{ key: 'stations', label: 'stations' }
	];

	const KEYS = TABS.map((entry) => entry.key);

	function initialTab(): Tab {
		const value = readQuery('tab');
		return KEYS.includes(value as Tab) ? (value as Tab) : 'next';
	}

	// Local state drives the view and the URL mirrors it, rather than the other way round:
	// reading the tab back out of the URL did not re-run when the address changed.
	let tab = $state<Tab>(initialTab());

	function select(next: Tab) {
		tab = next;
		replaceQuery({ tab: next === 'next' ? null : next });
	}

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

		<div class="split">
			<Overview progress={tracker.progress} closure={tracker.closure} />
			{#if tracker.closure && tracker.closure.unlocked.length > 0}
				<CascadeCanvas
					catalogue={tracker.catalogue}
					closure={tracker.closure}
					researched={tracker.researched}
				/>
			{/if}
		</div>

		<nav class="tabs">
			{#each TABS as entry (entry.key)}
				<button type="button" class:on={tab === entry.key} onclick={() => select(entry.key)}>
					{entry.label}
				</button>
			{/each}
		</nav>

		{#if tab === 'next'}
			<NextUp
				catalogue={tracker.catalogue}
				leverage={tracker.leverage}
				progress={tracker.progress}
			/>
		{:else if tab === 'find'}
			<GoFind catalogue={tracker.catalogue} closure={tracker.closure} leverage={tracker.leverage} />
		{:else if tab === 'items'}
			<ItemGrid catalogue={tracker.catalogue} progress={tracker.progress} />
		{:else if tab === 'categories'}
			<CategoryProgress
				catalogue={tracker.catalogue}
				progress={tracker.progress}
				closure={tracker.closure}
			/>
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
		border-radius: var(--radius);
		font-size: 0.85rem;
	}

	.error {
		background: color-mix(in srgb, var(--red) 12%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--red) 45%, var(--border));
		border-left-width: 3px;
	}

	.warn {
		background: color-mix(in srgb, var(--amber) 10%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--amber) 40%, var(--border));
		border-left-width: 3px;
	}

	.split {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
		align-items: start;
	}

	@media (max-width: 900px) {
		.split {
			grid-template-columns: 1fr;
		}
	}

	.tabs {
		display: flex;
		gap: 0.15rem;
		border-bottom: 1px solid var(--border);
		/* Five tabs do not fit on a phone; scrolling beats wrapping or clipping. */
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tabs button {
		flex: none;
		padding: 0.5rem 0.9rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-faint);
		font-family: var(--mono);
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: color 0.15s;
	}

	.tabs button:hover {
		color: var(--text-muted);
	}

	.tabs button.on {
		color: var(--cyan);
		border-bottom-color: var(--cyan);
		text-shadow: var(--glow);
	}

	code {
		padding: 0.1rem 0.3rem;
		background: var(--bg);
		border-radius: 4px;
	}
</style>
