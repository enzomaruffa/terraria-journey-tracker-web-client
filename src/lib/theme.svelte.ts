/**
 * Theme selection.
 *
 * Dark is the default rather than "whatever the OS says" — the interface is built around a
 * dark instrument panel, and a light desktop should not silently opt you out of it. Light
 * remains available for anyone who wants it.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tracker-theme';

class ThemeStore {
	current = $state<Theme>('dark');

	init() {
		if (typeof localStorage === 'undefined') return;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'light' || saved === 'dark') this.current = saved;
		this.apply();
	}

	toggle() {
		this.current = this.current === 'dark' ? 'light' : 'dark';
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, this.current);
		this.apply();
	}

	apply() {
		if (typeof document !== 'undefined') {
			document.documentElement.dataset.theme = this.current;
		}
	}
}

export const theme = new ThemeStore();
