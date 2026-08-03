import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// A single-page build with no server behind it: the Python tracker serves these
		// files from its own port, and the same output works as a plain static site for
		// the drag-and-drop mode.
		adapter: adapter({ fallback: 'index.html' }),
		prerender: { entries: [] }
	}
};

export default config;
