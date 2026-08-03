<script lang="ts">
	import { tracker } from '$lib/tracker.svelte';

	let label = $derived.by(() => {
		switch (tracker.connection) {
			case 'live':
				return 'Live — watching your character file';
			case 'connecting':
				return 'Connecting to the tracker…';
			case 'local':
				return tracker.watchingLocalFile
					? `Watching ${tracker.localFileName} in this browser`
					: `Reading ${tracker.localFileName} (drop it again to refresh)`;
			default:
				return 'Tracker not running';
		}
	});
</script>

<div class="bar">
	<span class="dot {tracker.connection}"></span>
	<span class="label">{label}</span>

	{#if tracker.progress}
		<span class="player">
			{tracker.progress.player.name}
			<span class="difficulty">{tracker.progress.player.difficulty}</span>
		</span>
	{/if}

	{#if tracker.source === 'file'}
		<button type="button" onclick={() => tracker.backToServer()}>Back to the tracker</button>
	{/if}

	{#if tracker.catalogue?.meta.gameVersion}
		<span class="version">Terraria {tracker.catalogue.meta.gameVersion} data</span>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 0.8rem;
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--text-faint);
		flex: none;
	}

	.dot.live {
		background: var(--green);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent);
	}

	.dot.local {
		background: var(--cyan);
	}

	.dot.connecting {
		background: var(--amber);
	}

	.label {
		color: var(--text-muted);
	}

	.player {
		margin-left: auto;
		font-weight: 600;
	}

	.difficulty {
		margin-left: 0.35rem;
		padding: 0.1rem 0.4rem;
		background: var(--bg);
		border-radius: 4px;
		color: var(--text-faint);
		font-weight: 400;
		font-size: 0.72rem;
	}

	.version {
		color: var(--text-faint);
		font-size: 0.72rem;
	}

	button {
		padding: 0.25rem 0.7rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--text-faint);
	}
</style>
