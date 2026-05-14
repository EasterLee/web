import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	root: ".", // tell Vite to look here for HTML files
	build: {
		outDir: "dist", // output folder
		emptyOutDir: true, // clear dist before each build
		rolldownOptions: {
			input: {
				main: resolve(import.meta.dirname, "index.html"),
				"yuu-prefill": resolve(import.meta.dirname, "yuu-prefill/index.html"),
				gol: resolve(import.meta.dirname, "gol/index.html"),
			},
		},
	},
});
