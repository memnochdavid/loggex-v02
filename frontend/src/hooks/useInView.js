import { useEffect, useRef, useState } from 'react';

/**
 * Devuelve [ref, inView] — true cuando el elemento referenciado entra en viewport.
 * Por defecto dispara una sola vez (`once: true`). Soporta `threshold` y `rootMargin`.
 */
export default function useInView({ threshold = 0.2, rootMargin = '0px 0px -60px 0px', once = true } = {}) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    if (once) observer.disconnect();
                } else if (!once) {
                    setInView(false);
                }
            },
            { threshold, rootMargin }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [threshold, rootMargin, once]);

    return [ref, inView];
}
