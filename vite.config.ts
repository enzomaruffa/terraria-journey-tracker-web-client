import { readFileSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
// Stamped into the bundle so "did my re-run actually update?" is answerable from the UI.
const build = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__APP_BUILD__: JSON.stringify(build)
	},
	plugins: [sveltekit()],
	server: {
		// Talk to the Python tracker during development without CORS or hardcoded ports in
		// the client, so the same relative URLs work in the bundled build.
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:4777',
				ws: true
			}
		}
	}
});
