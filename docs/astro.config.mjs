import { defineConfig } from "astro/config";

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
	srcDir: "./src",
	publicDir: "./public",
	outDir: "../public/docs",
	base: process.env.DOCS_BASE ?? "/docs",
	build: {
		assets: "_assets"
	},
	markdown: {
		shikiConfig: {
			theme: "github-dark-default"
		}
	}
});
