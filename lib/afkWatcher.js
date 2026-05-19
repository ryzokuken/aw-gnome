export function nextAfkState(current, event) {
    if (event === 'idle' && current === 'not-afk') {
        return { state: 'afk', emit: true };
    }
    if (event === 'active' && current === 'afk') {
        return { state: 'not-afk', emit: true };
    }
    return { state: current, emit: false };
}
