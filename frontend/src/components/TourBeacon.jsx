import React, { forwardRef } from 'react';
import Lottie from 'lottie-react';
import fireAnimation from '../../public/fire.json';
import styles from './TourBeacon.module.css';

/**
 * Beacon custom para react-joyride — sustituye el punto negro por defecto
 * por una animación Lottie de fuego. Indica dónde arranca el tour; el
 * usuario pulsa y aparece el primer tooltip.
 *
 * Joyride llama al componente con `ref` para posicionarlo encima del
 * target, además de pasarle `continuous`, `locale` y `styles` (que aquí
 * no usamos porque el aspecto lo controlamos con CSS Modules).
 */
/* Extraemos className del resto de props (Joyride puede enviar el suyo) y lo
   mergeamos con el nuestro, en vez de dejar que ninguno sobreescriba al otro.
   El resto de props (style con el translate3d de posición, onClick interno
   de Joyride para avanzar al tooltip, etc.) se propagan tal cual. */
const TourBeacon = forwardRef(({ className, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        aria-label="Iniciar tutorial"
        {...props}
        className={[styles.beacon, className].filter(Boolean).join(' ')}
    >
        <Lottie animationData={fireAnimation} loop autoplay />
    </button>
));

TourBeacon.displayName = 'TourBeacon';

export default TourBeacon;
