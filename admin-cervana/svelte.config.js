import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// adapter-node: deploy sebagai standalone Node.js server
		// Cocok untuk Docker / VPS / bare-metal production.
		// Override di-development via .env dengan USE_ADAPTER_AUTO=true jika perlu.
		adapter: adapter({
			out: 'build',
			precompress: false,
			envPrefix: ''
		})
	}
};

export default config;