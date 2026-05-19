export function assert(condition, message = 'assertion failed') {
    if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`${message}\n  expected: ${e}\n  actual:   ${a}`);
    }
}
