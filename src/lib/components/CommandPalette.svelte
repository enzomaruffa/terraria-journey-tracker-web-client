<script lang="ts">
	/**
	 * Ctrl+K to jump to any of the 6,000-odd items.
	 *
	 * Scrolling a grid to reach one known item is the slowest thing in the interface, so this
	 * exists to skip it entirely.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { hideBrokenImage } from '$lib/images';
	import { tracker } from '$lib/tracker.svelte';
	import type { Item } from '$lib/types';

	const MAX_RESULTS = 20;

	let open = $state(false);
	let query = $state('');
	let selected = $state(0);
	let input = $state<HTMLInputElement | null>(null);

	let results = $derived.by<Item[]>(() => {
		const catalogue = tracker.catalogue;
		const needle = query.trim().toLowerCase();
		if (!catalogue || needle.length === 0) return [];

		const starts: Item[] = [];
		const contains: Item[] = [];

		for (const item of catalogue.items.values()) {
			const name = item.name.toLowerCase();
			// Prefix matches first: typing "cop" should reach Copper Ore before Ancient Copper.
			if (name.startsWith(needle)) starts.push(item);
			else if (name.includes(needle)) contains.push(item);

			if (starts.length >= MAX_RESULTS) break;
		}

		return [...starts, ...contains].slice(0, MAX_RESULTS);
	});

	function show() {
		open = true;
		query = '';
		selected = 0;
		// The input only exists once the dialog renders.
		queueMicrotask(() => input?.focus());
	}

	function hide() {
		open = false;
	}

	function choose(item: Item) {
		hide();
		goto(resolve(`/item/${item.id}`));
	}

	function onWindowKey(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			if (open) hide();
			else show();
			return;
		}
		if (event.key === 'Escape' && open) hide();
	}

	function onInputKey(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selected = Math.min(selected + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (event.key === 'Enter' && results[selected]) {
			event.preventDefault();
			choose(results[selected]);
		}
	}

	// Reset the highlight whenever the result set changes under it.
	$effect(() => {
		void query;
		selected = 0;
	});
</script>

<svelte:window onkeydown={onWindowKey} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={hide}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="palette panel" onclick={(event) => event.stopPropagation()}>
			<input
				bind:this={input}
				bind:value={query}
				onkeydown={onInputKey}
				type="text"
				placeholder="Search items…"
				aria-label="Search items"
				autocomplete="off"
			/>

			{#if results.length > 0}
				<ul>
					{#each results as item, index (item.id)}
						<li>
							<button class="row" class:on={index === selected} onclick={() => choose(item)}>
								<img
									src={item.imageUrl}
									alt=""
									loading="lazy"
									referrerpolicy="no-referrer"
									onerror={hideBrokenImage}
								/>
								<span class="name">{item.name}</span>
								<span class="meta label">{item.research}x</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<p class="empty label">nothing matches “{query}”</p>
			{:else}
				<p class="empty label">type to search · ↑↓ to move · enter to open · esc to close</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		justify-content: center;
		padding-top: 12vh;
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(3px);
	}

	.palette {
		width: min(38rem, calc(100vw - 2rem));
		max-height: 65vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.5);
	}

	input {
		padding: 0.75rem 0.9rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		font-family: var(--mono);
		font-size: 0.9rem;
	}

	input:focus {
		outline: none;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0.3rem;
		overflow-y: auto;
	}

	.row {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.35rem 0.5rem;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius);
		color: var(--text-muted);
		font: inherit;
		font-size: 0.82rem;
		text-align: left;
		cursor: pointer;
	}

	.row.on {
		color: var(--text);
		background: color-mix(in srgb, var(--cyan) 12%, transparent);
		border-color: color-mix(in srgb, var(--cyan) 45%, transparent);
	}

	img {
		width: 24px;
		height: 24px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty {
		margin: 0;
		padding: 1rem 0.9rem;
		text-align: center;
	}
</style>
