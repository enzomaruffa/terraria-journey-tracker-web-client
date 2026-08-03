<script lang="ts">
	import { hideBrokenImage } from '$lib/images';
	import type { Item, ItemState } from '$lib/types';

	interface Props {
		item: Item;
		state: ItemState;
		sacrificed: number;
	}

	let { item, state, sacrificed }: Props = $props();
	let pct = $derived(Math.min(100, Math.round((sacrificed / item.research) * 100)));
</script>

<!-- Links out to terraria.wiki.gg, so there is no app route to resolve against. -->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a class="item {state}" href={item.wikiUrl} target="_blank" rel="noreferrer noopener">
	<!-- referrerpolicy is load-bearing: wiki.gg's hotlink protection returns a Cloudflare
	     403 for any image request carrying a Referer from another origin. -->
	<img
		src={item.imageUrl}
		alt=""
		loading="lazy"
		decoding="async"
		width="32"
		height="32"
		referrerpolicy="no-referrer"
		onerror={hideBrokenImage}
	/>

	<span class="name">{item.name}</span>

	<span class="count">
		{#if state === 'researched'}
			done
		{:else}
			{sacrificed}/{item.research}
		{/if}
	</span>

	{#if state === 'partial'}
		<span class="progress" style="width: {pct}%"></span>
	{/if}
</a>

<style>
	.item {
		position: relative;
		display: grid;
		grid-template-columns: 32px 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.65rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: inherit;
		text-decoration: none;
		overflow: hidden;
		transition:
			border-color 0.15s,
			transform 0.15s;
	}

	.item:hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	img {
		width: 32px;
		height: 32px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.name {
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}

	.progress {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 2px;
		background: var(--amber);
		box-shadow: 0 0 8px color-mix(in srgb, var(--amber) 60%, transparent);
	}

	.researched {
		border-color: color-mix(in srgb, var(--green) 35%, var(--border));
		background: color-mix(in srgb, var(--green) 7%, var(--surface));
	}

	.researched .name {
		color: var(--text-muted);
	}

	.researched .count {
		color: var(--green);
	}

	.craftable {
		border-color: color-mix(in srgb, var(--cyan) 45%, var(--border));
		background: color-mix(in srgb, var(--cyan) 8%, var(--surface));
	}

	.partial {
		border-color: color-mix(in srgb, var(--amber) 38%, var(--border));
	}
</style>
