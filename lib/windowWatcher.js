export function resolveAppId(window) {
    if (!window) return 'unknown';
    const candidates = [
        window.get_sandboxed_app_id?.(),
        window.get_gtk_application_id?.(),
        window.get_wm_class?.(),
    ];
    for (const c of candidates) {
        if (c && c.length > 0) return c;
    }
    return 'unknown';
}
