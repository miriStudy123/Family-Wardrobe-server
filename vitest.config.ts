import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// הבדיקות רצות מול מסד נתונים ייעודי שמוגדר ב-.env.test
const testEnv = config({ path: '.env.test' }).parsed ?? {};

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: { ...testEnv, NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.ts'],
    // כל הבדיקות חולקות מסד נתונים אחד, לכן הן רצות ברצף
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
