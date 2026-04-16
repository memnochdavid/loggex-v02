// Tracking global de la última posición conocida del puntero.
// Se inicializa una única vez (lazy) al primer import y suscribe un listener
// pasivo. Sirve para que los componentes puedan preguntar "¿está el cursor
// sobre este elemento?" en el momento de su mount — útil para evitar flashes
// cuando el árbol se remonta (p. ej. Sidebar al cambiar de ruta).

let lastX = -1;
let lastY = -1;
let initialized = false;

const ensureInit = () => {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    const handler = (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
    };
    window.addEventListener('pointermove', handler, { passive: true });
    window.addEventListener('pointerdown', handler, { passive: true });
};

ensureInit();

export const getLastPointer = () => ({ x: lastX, y: lastY });

export const isPointerOver = (el) => {
    if (!el || lastX < 0) return false;
    const rect = el.getBoundingClientRect();
    return (
        lastX >= rect.left &&
        lastX <= rect.right &&
        lastY >= rect.top &&
        lastY <= rect.bottom
    );
};
