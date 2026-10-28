/**
 * Descarga un fichero binario desde la API.
 *
 * Usa fetch con cookies de sesión (`credentials: 'include'`), convierte la
 * respuesta a Blob y dispara la descarga creando un <a> efímero.
 *
 * @param {string} url URL absoluta del recurso a descargar.
 * @param {string} filename Nombre con el que se guardará el fichero.
 * @returns {Promise<void>} Resuelve al completar la descarga; rechaza con Error.
 */
export async function downloadFileFromApi(url, filename) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? ` — ${text.slice(0, 120)}` : ''}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}
