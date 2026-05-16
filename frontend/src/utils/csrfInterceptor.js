let csrfToken = null;
let tokenPromise = null;

async function fetchCsrfToken() {
    if (csrfToken) return csrfToken;
    if (tokenPromise) return tokenPromise;

    tokenPromise = (async () => {
        try {
            const res = await fetch('/api/csrf-token', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                csrfToken = data.csrfToken;
                return csrfToken;
            }
        } catch {
            // Silencioso — el backend rechazará con 419 si falta el token
        } finally {
            tokenPromise = null;
        }
        return null;
    })();

    return tokenPromise;
}

const originalFetch = window.fetch;

window.fetch = async function (...args) {
    const [input, init = {}] = args;
    const method = (init.method || 'GET').toUpperCase();

    // Solo añadir CSRF en peticiones stateful
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const token = await fetchCsrfToken();
        if (token) {
            init.headers = {
                ...(typeof init.headers === 'object' && !Array.isArray(init.headers) ? init.headers : {}),
                'X-CSRF-Token': token,
            };
        }
    }

    return originalFetch.apply(this, [input, init]);
};

export { fetchCsrfToken };
