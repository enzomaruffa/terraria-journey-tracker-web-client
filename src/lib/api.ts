import type {
	Catalogue,
	Drop,
	FoundPlayer,
	Item,
	Progress,
	Recipe,
	ServerStatus,
	SocketMessage,
	Station
} from './types';

/**
 * Relative URLs throughout: in development Vite proxies /api to the Python tracker, and in
 * the bundled build the tracker serves this page itself, so there is never a port to
 * configure. The previous client hardcoded http://localhost:4777 in the component.
 */
const API = '/api';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(path, { signal });
	if (!response.ok) {
		throw new Error(`${path} responded ${response.status}`);
	}
	return response.json() as Promise<T>;
}

export async function fetchStatus(signal?: AbortSignal): Promise<ServerStatus> {
	return getJson<ServerStatus>(`${API}/status`, signal);
}

export async function fetchProgress(signal?: AbortSignal): Promise<Progress> {
	return getJson<Progress>(`${API}/progress`, signal);
}

export async function fetchPlayers(
	signal?: AbortSignal
): Promise<{ active: string | null; players: FoundPlayer[] }> {
	return getJson(`${API}/players`, signal);
}

export async function selectPlayer(path: string): Promise<Progress> {
	const response = await fetch(`${API}/players/select`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ path })
	});
	if (!response.ok) {
		const detail = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(detail.detail ?? 'could not switch character');
	}
	return response.json() as Promise<Progress>;
}

interface RawCatalogue {
	items: { meta: Catalogue['meta']; items: Record<string, Item> };
	recipes: { recipes: Recipe[] };
	stations: { stations: Record<string, Station> };
	drops: { drops: Record<string, Drop[]> };
}

function toCatalogue(raw: RawCatalogue): Catalogue {
	return {
		meta: raw.items.meta ?? {},
		items: new Map(Object.entries(raw.items.items).map(([id, item]) => [Number(id), item])),
		recipes: raw.recipes.recipes,
		stations: new Map(
			Object.entries(raw.stations.stations).map(([id, station]) => [Number(id), station])
		),
		drops: new Map(Object.entries(raw.drops?.drops ?? {}).map(([id, list]) => [Number(id), list]))
	};
}

/**
 * Load the item/recipe/station catalogue.
 *
 * Tries the tracker first, then falls back to the copies shipped in the static build. That
 * fallback is what lets the drag-and-drop mode work with no server at all.
 */
export async function fetchCatalogue(signal?: AbortSignal): Promise<Catalogue> {
	const sources = [
		[`${API}/items`, `${API}/recipes`, `${API}/stations`, `${API}/drops`],
		['data/items.json', 'data/recipes.json', 'data/stations.json', 'data/drops.json']
	];

	let lastError: unknown;
	for (const [items, recipes, stations, drops] of sources) {
		try {
			const [i, r, s, d] = await Promise.all([
				getJson<RawCatalogue['items']>(items, signal),
				getJson<RawCatalogue['recipes']>(recipes, signal),
				getJson<RawCatalogue['stations']>(stations, signal),
				getJson<RawCatalogue['drops']>(drops, signal)
			]);
			return toCatalogue({ items: i, recipes: r, stations: s, drops: d });
		} catch (error) {
			if (signal?.aborted) throw error;
			lastError = error;
		}
	}

	throw new Error(
		`Could not load the item data from the tracker or from this site (${String(lastError)})`
	);
}

export interface SocketHandlers {
	onMessage: (message: SocketMessage) => void;
	onOpen?: () => void;
	onClose?: () => void;
}

/**
 * WebSocket with reconnect. Terraria sessions outlive laptop sleeps and server restarts, so
 * a socket that gives up on the first drop is not much use.
 */
export function connectSocket(handlers: SocketHandlers): () => void {
	let socket: WebSocket | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let attempt = 0;
	let closed = false;

	function open() {
		if (closed) return;

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		socket = new WebSocket(`${protocol}//${location.host}${API}/ws`);

		socket.onopen = () => {
			attempt = 0;
			handlers.onOpen?.();
		};

		socket.onmessage = (event) => {
			try {
				handlers.onMessage(JSON.parse(event.data) as SocketMessage);
			} catch {
				// A message we cannot parse is not worth tearing the connection down for.
			}
		};

		socket.onclose = () => {
			handlers.onClose?.();
			if (closed) return;
			const delay = Math.min(1000 * 2 ** attempt++, 15_000);
			timer = setTimeout(open, delay);
		};

		socket.onerror = () => socket?.close();
	}

	open();

	return () => {
		closed = true;
		if (timer) clearTimeout(timer);
		socket?.close();
	};
}
