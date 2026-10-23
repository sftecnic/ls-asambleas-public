import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'], exclude: ['node_modules/**', 'dist/**', '.tools/**', 'tests/**/*.e2e.spec.ts'] } });
