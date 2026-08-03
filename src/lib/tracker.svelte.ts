import { SvelteSet } from 'svelte/reactivity';
import { connectSocket, fetchCatalogue, fetchProgress, fetchStatus } from './api';
import { parsePlayerFile } from './plr/parse';
import { buildProgress } from './progress';
import type { Catalogue, ConnectionState, Progress, ServerStatus, Source } from './types';

/** How often a picked file is re-read while watching it in serverless mode. */
const LOCAL_POLL_MS = 1500;

class Tracker {
	catalogue = $state<Catalogue | null>(null);
	progress = $state<Progress | null>(null);
	status = $state<ServerStatus | null>(null);
	connection = $state<ConnectionState>('connecting');
	source = $state<Source>('server');
	error = $state<string | null>(null);
	loading = $state(true);
	/** Name of the file being read locally, when in serverless mode. */
	localFileName = $state<string | null>(null);
	watchingLocalFile = $state(false);

	#disconnect: (() => void) | null = null;
	#fileHandle: FileSystemFileHandle | null = null;
	#pollTimer: ReturnType<typeof setInterval> | null = null;
	#lastModified = 0;

	get knownNames(): Set<string> {
		const names = new SvelteSet<string>();
		for (const item of this.catalogue?.items.values() ?? []) names.add(item.internalName);
		return names;
	}

	async start() {
		this.loading = true;
		try {
			this.catalogue = await fetchCatalogue();
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.loading = false;
			return;
		}

		try {
			this.status = await fetchStatus();
			this.progress = await fetchProgress();
			this.source = 'server';
			this.#listen();
		} catch {
			// No tracker running. The page still works — drop a .plr on it.
			this.connection = 'offline';
		}

		this.loading = false;
	}

	#listen() {
		this.#disconnect?.();
		this.connection = 'connecting';

		this.#disconnect = connectSocket({
			onOpen: () => {
				if (this.source === 'server') this.connection = 'live';
			},
			onClose: () => {
				if (this.source === 'server') this.connection = 'offline';
			},
			onMessage: (message) => {
				// A local file takes precedence: the user chose it explicitly.
				if (this.source === 'file') return;

				if (message.type === 'progress') {
					this.progress = message.data;
					this.error = null;
					this.connection = 'live';
				} else if (message.type === 'status') {
					this.status = message.data;
				} else if (message.type === 'error') {
					this.error = message.message;
				}
			}
		});
	}

	// ------------------------------------------------------------ serverless mode

	async loadFile(file: File) {
		if (!this.catalogue) return;

		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const save = await parsePlayerFile(bytes, this.knownNames);

			this.progress = buildProgress(save, this.catalogue);
			this.source = 'file';
			this.connection = 'local';
			this.localFileName = file.name;
			this.#lastModified = file.lastModified;
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
		}
	}

	/**
	 * Keep re-reading a picked file so progress updates while you play.
	 *
	 * Needs a FileSystemFileHandle, which only Chromium browsers hand out. A plain drop on
	 * other browsers still parses once; it just cannot refresh itself.
	 */
	async watchFile(handle: FileSystemFileHandle) {
		this.#fileHandle = handle;
		await this.loadFile(await handle.getFile());

		this.stopWatching();
		this.watchingLocalFile = true;
		this.#pollTimer = setInterval(async () => {
			if (!this.#fileHandle) return;
			try {
				const file = await this.#fileHandle.getFile();
				if (file.lastModified !== this.#lastModified) await this.loadFile(file);
			} catch {
				// The file was moved or permission lapsed; stop rather than spin.
				this.stopWatching();
			}
		}, LOCAL_POLL_MS);
	}

	stopWatching() {
		if (this.#pollTimer) clearInterval(this.#pollTimer);
		this.#pollTimer = null;
		this.watchingLocalFile = false;
	}

	/** Drop the local file and go back to whatever the tracker reports. */
	async backToServer() {
		this.stopWatching();
		this.#fileHandle = null;
		this.localFileName = null;
		this.source = 'server';
		this.error = null;

		try {
			this.progress = await fetchProgress();
			this.connection = 'live';
		} catch {
			this.progress = null;
			this.connection = 'offline';
		}
	}

	destroy() {
		this.stopWatching();
		this.#disconnect?.();
		this.#disconnect = null;
	}
}

export const tracker = new Tracker();
