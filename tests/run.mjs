// Test entry point: static checks first (fast), then the browser suite.
import { run } from './lib/harness.mjs';
import './static.test.mjs';
import { setup, teardown } from './browser.test.mjs';

let failures = 1;
try {
    await setup();
    failures = await run();
} finally {
    await teardown();
}
process.exit(failures === 0 ? 0 : 1);
