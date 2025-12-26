import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = packageJson.version

// Get git commit hash
let commitHash = 'dev'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // Fallback if git is not available
}

// Get build number from environment (set by CI) or generate local build ID
const buildNumber = process.env.BUILD_NUMBER || `local-${Date.now()}`

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		// Sentry plugin for source maps upload (only in production with auth token)
		process.env.SENTRY_AUTH_TOKEN
			? sentryVitePlugin({
					org: process.env.SENTRY_ORG,
					project: process.env.SENTRY_PROJECT,
					authToken: process.env.SENTRY_AUTH_TOKEN,
					release: {
						name: `caw-caw@${version}`,
					},
					sourcemaps: {
						assets: ['./dist/**/*.js', './dist/**/*.ts'],
						ignore: ['**/node_modules/**'],
						filesToDeleteAfterUpload: ['./dist/**/*.map'],
					},
					disable: process.env.NODE_ENV !== 'production',
				})
			: null,
	].filter(Boolean),
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		sourcemap: 'hidden', // Generate source maps but don't expose them publicly
	},
	worker: {
		format: 'es', // Use ES module format for workers (required for code-splitting)
	},
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__BUILD_NUMBER__: JSON.stringify(buildNumber),
		__COMMIT_HASH__: JSON.stringify(commitHash),
	},
});
