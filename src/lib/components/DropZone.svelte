<script lang="ts">
	import { tracker } from '$lib/tracker.svelte';

	let dragging = $state(false);

	// Only Chromium hands out a file handle, which is what lets us re-read the file as you
	// play. Elsewhere the drop still works, it just parses once.
	const canWatch = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;

		const item = event.dataTransfer?.items?.[0];
		if (item && 'getAsFileSystemHandle' in item) {
			const handle = (await (
				item as DataTransferItem & {
					getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
				}
			).getAsFileSystemHandle()) as FileSystemFileHandle | null;

			if (handle?.kind === 'file') {
				await tracker.watchFile(handle);
				return;
			}
		}

		const file = event.dataTransfer?.files?.[0];
		if (file) await tracker.loadFile(file);
	}

	async function pickFile() {
		const [handle] = await window.showOpenFilePicker({
			types: [
				{ description: 'Terraria character', accept: { 'application/octet-stream': ['.plr'] } }
			]
		});
		if (handle) await tracker.watchFile(handle);
	}

	async function onInputChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) await tracker.loadFile(file);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="drop"
	class:dragging
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={handleDrop}
>
	<p class="headline">Drop a <code>.plr</code> character file here</p>
	<p class="hint">It is decrypted in your browser and never uploaded anywhere.</p>

	{#if canWatch}
		<button type="button" onclick={pickFile}>Choose a file and keep watching it</button>
		<p class="hint small">Progress then updates by itself while you play.</p>
	{:else}
		<label class="button">
			Choose a file
			<input type="file" accept=".plr" onchange={onInputChange} />
		</label>
		<p class="hint small">
			Your browser cannot re-read a file automatically — drop it again after saving, or use Chrome
			or Edge for live updates.
		</p>
	{/if}
</div>

<style>
	.drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2.5rem 1.5rem;
		border: 2px dashed var(--border);
		border-radius: 14px;
		background: var(--surface);
		text-align: center;
	}

	.dragging {
		border-color: var(--blue);
		background: color-mix(in srgb, var(--blue) 12%, var(--surface));
	}

	.headline {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.small {
		font-size: 0.78rem;
		color: var(--text-faint);
	}

	button,
	.button {
		margin-top: 0.4rem;
		padding: 0.5rem 1.1rem;
		background: var(--blue);
		border: none;
		border-radius: 8px;
		color: #06121f;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.button input {
		display: none;
	}

	code {
		padding: 0.1rem 0.3rem;
		background: var(--bg);
		border-radius: 4px;
		font-size: 0.9em;
	}
</style>
