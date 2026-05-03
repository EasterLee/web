import { defineConfig } from "vite";

export default defineConfig({
	root: ".", // tell Vite to look here for HTML files
	build: {
		outDir: "dist", // output folder
		emptyOutDir: true, // clear dist before each build
		rollupOptions: {
			input: {
				main: "index.html",
				about: "yuu-prefill/index.html",
			},
		},
	},
});
