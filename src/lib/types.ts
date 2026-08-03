export interface Item {
	id: number;
	name: string;
	internalName: string;
	research: number;
	imageUrl: string;
	wikiUrl: string;
	categories: string[];
	rarity: number;
}

export interface Ingredient {
	name: string;
	ids: number[];
	amount: number;
}

export interface Recipe {
	id: number;
	name: string;
	stationIds: number[];
	ingredients: Ingredient[];
}

export interface Station {
	id: number;
	name: string;
	imageUrls: string[];
	craftableIds: number[];
}

export interface DataMeta {
	source?: string;
	generatedAt?: string;
	gameVersion?: string;
	itemCount?: number;
	recipeCount?: number;
	stationCount?: number;
}

export interface Catalogue {
	meta: DataMeta;
	items: Map<number, Item>;
	recipes: Recipe[];
	stations: Map<number, Station>;
}

export interface Overview {
	itemsTotal: number;
	itemsResearched: number;
	itemsPartial: number;
	itemsUntouched: number;
	percentItems: number;
	sacrificesDone: number;
	sacrificesTotal: number;
	percentSacrifices: number;
	craftableNow: number;
}

export interface PlayerInfo {
	name: string;
	difficulty: string;
	isJourney: boolean;
	fileVersion: number;
}

export interface Progress {
	player: PlayerInfo;
	overview: Overview;
	/** item id -> units sacrificed. Only non-zero entries are sent. */
	sacrificed: Record<string, number>;
	craftable: number[];
	researchFound: boolean;
	researchVerified: boolean;
	unknownInternalNames: string[];
	updatedAt: string;
}

export interface ServerStatus {
	playerFile: string | null;
	playerFileName: string | null;
	gameVersion: string;
	dataGeneratedAt: string | null;
	itemCount: number;
	recipeCount: number;
	stationCount: number;
	error: string | null;
	hasProgress: boolean;
}

export interface FoundPlayer {
	name: string;
	path: string;
	modified: number;
}

export type SocketMessage =
	| { type: 'status'; data: ServerStatus }
	| { type: 'progress'; data: Progress }
	| { type: 'error'; message: string };

export type ItemState = 'researched' | 'partial' | 'craftable' | 'locked';

/** Where the progress currently on screen came from. */
export type Source = 'server' | 'file';

export type ConnectionState = 'connecting' | 'live' | 'offline' | 'local';
