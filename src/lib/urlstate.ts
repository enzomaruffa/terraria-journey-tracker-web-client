/**
 * View state in the query string, so a reload or a shared link reproduces what you were
 * looking at.
 *
 * This reads and writes the address bar directly rather than going through SvelteKit's
 * shallow routing. `replaceState` from `$app/navigation` updates the URL but does not
 * reliably re-run a `$derived` reading `page.url`, which made the tabs change the address
 * without changing the view. Components therefore own their state and use this only to
 * mirror it.
 *
 * `replaceState` rather than `pushState`: typing in a search box should not bury the
 * previous page under a hundred history entries.
 */

/** Current value of a query parameter, or `fallback` when absent. */
export function readQuery(key: string, fallback = ''): string {
	if (typeof location === 'undefined') return fallback;
	return new URLSearchParams(location.search).get(key) ?? fallback;
}

/** Set or clear query parameters. A null or empty value removes the key entirely. */
export function replaceQuery(values: Record<string, string | null>) {
	if (typeof location === 'undefined') return;

	const url = new URL(location.href);
	for (const [key, value] of Object.entries(values)) {
		if (value === null || value === '') url.searchParams.delete(key);
		else url.searchParams.set(key, value);
	}

	if (url.href !== location.href) history.replaceState(history.state, '', url);
}
