/**
 * View state in the query string, so a reload or a shared link reproduces what you were
 * looking at.
 *
 * Updates use `replaceState` rather than pushing: typing in a search box should not bury the
 * previous page under a hundred history entries.
 */

import { replaceState } from '$app/navigation';
import { page } from '$app/state';

/** Set or clear query parameters. A null value removes the key entirely. */
export function replaceQuery(values: Record<string, string | null>) {
	if (typeof window === 'undefined') return;

	const url = new URL(page.url);
	for (const [key, value] of Object.entries(values)) {
		if (value === null || value === '') url.searchParams.delete(key);
		else url.searchParams.set(key, value);
	}

	// Same route, only the query changes, so there is no path to resolve here.
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	if (url.href !== page.url.href) replaceState(url, page.state);
}

export function readQuery(key: string, fallback = ''): string {
	if (typeof window === 'undefined') return fallback;
	return page.url.searchParams.get(key) ?? fallback;
}
