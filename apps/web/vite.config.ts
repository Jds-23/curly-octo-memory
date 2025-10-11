import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), tanstackRouter({}), react(), cloudflare()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// Force all ethers imports to use ethers v5
			ethers: path.resolve(__dirname, "../../node_modules/.bun/ethers@5.8.0/node_modules/ethers"),
		},
	},
	optimizeDeps: {
		include: ["ethers"],
	},
});
