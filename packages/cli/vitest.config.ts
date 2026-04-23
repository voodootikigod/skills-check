import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts"],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 60,
				statements: 70,
			},
		},
	},
});
