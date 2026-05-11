import React, { forwardRef } from 'react';
import Lottie from 'lottie-react';
import fireAnimation from '../../public/fire.json';
import styles from './TourBeacon.module.css';

/**
 * Beacon custom para react-joyride — sustituye el punto negro por defecto
 * por una animación Lottie de fuego. Indica dónde arranca el tour; el
 * usuario pulsa y aparece el primer tooltip.
 *
 * IMPORTANTE: Joyride v3+ envuelve el `beaconComponent` en su propio
 * `<button class="react-joyride__beacon">` (con su `aria-label`, `onClick`
 * y `onMouseEnter` para arrancar el tour, además del `style` con el
 * `translate3d` de posición). Por eso aquí renderizamos un `<span>`:
 *   1) Evita el HTML inválido `<button>` dentro de `<button>`.
 *   2) Toda la interacción/posicionamiento ya está en el padre.
 *
 * Joyride pasa props internos al render: `continuous`, `index`,
 * `isLastStep`, `size`, `step`. Ninguno es atributo DOM válido; los
 * descartamos en el destructuring para que no salgan warnings tipo
 * "Received `true` for a non-boolean attribute `continuous`" ni
 * "React does not recognize the `isLastStep` prop on a DOM element".
 */
const TourBeacon = forwardRef((
    { className, continuous: _c, index: _i, isLastStep: _l, size: _s, step: _st, ...rest },
    ref,
) => (
    <span
        ref={ref}
        {...rest}
        className={[styles.beacon, className].filter(Boolean).join(' ')}
    >
        <Lottie animationData={fireAnimation} loop autoplay />
    </span>
));

TourBeacon.displayName = 'TourBeacon';

export default TourBeacon;
