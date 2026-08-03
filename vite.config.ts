import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
