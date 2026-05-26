import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
	root: resolve(import.meta.dirname, "src"), // tell Vite to look here for HTML files
	build: {
		outDir: "../dist", // output folder
		emptyOutDir: true, // clear dist before each build
		rolldownOptions: {
			input: {
				main: resolve(import.meta.dirname, "src/index.html"),
				"yuu-prefill": resolve(
					import.meta.dirname,
					"src/yuu-prefill/index.html",
				),
				gol: resolve(import.meta.dirname, "src/gol/index.html"),
				projects: resolve(import.meta.dirname, "src/projects/index.html"),
				particle: resolve(import.meta.dirname, "src/particle/index.html"),
			},
		},
	},
	// Optional: Silence Sass deprecation warnings. See note below.
	css: {
		preprocessorOptions: {
			scss: {
				silenceDeprecations: [
					"import",
					"color-functions",
					"global-builtin",
					"if-function",
				],
			},
		},
	},
	plugins: [basicSsl()],
	server: { host: true },
});
