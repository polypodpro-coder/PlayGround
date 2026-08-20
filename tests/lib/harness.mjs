// Minimal zero-config test harness: collect tests, run them, print a summary.
const suites = [];
let current = null;

export function describe(name, fn) {
    current = { name, tests: [] };
    suites.push(current);
    fn();
    current = null;
}

export function it(name, fn) {
    if (!current) throw new Error('it() must be called inside describe()');
    current.tests.push({ name, fn });
}

export function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

export function equal(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || 'values differ'}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
    }
}

export function match(text, re, msg) {
    if (!re.test(text)) throw new Error(msg || `expected text to match ${re}`);
}

export function notMatch(text, re, msg) {
    if (re.test(text)) throw new Error(msg || `expected text NOT to match ${re}`);
}

export async function run() {
    let passed = 0;
    const failures = [];

    for (const suite of suites) {
        console.log(`\n  ${suite.name}`);
        for (const test of suite.tests) {
            try {
                await test.fn();
                passed++;
                console.log(`    \x1b[32m✓\x1b[0m ${test.name}`);
            } catch (err) {
                failures.push({ suite: suite.name, test: test.name, err });
                console.log(`    \x1b[31m✗\x1b[0m ${test.name}`);
            }
        }
    }

    console.log('');
    for (const f of failures) {
        console.log(`\x1b[31m  FAIL\x1b[0m ${f.suite} › ${f.test}`);
        console.log(`    ${f.err.message.split('\n').join('\n    ')}`);
    }
    console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
    return failures.length;
}
