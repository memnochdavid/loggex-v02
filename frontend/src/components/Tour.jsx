import React, { useEffect, useMemo, useState } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useTour } from '../context/TourContext';
import TourTooltip from './TourTooltip';
import TourBeacon from './TourBeacon';

/**
 * Wrapper sobre react-joyride. Lee el tour activo del TourContext, traduce los
 * pasos vía i18n y notifica al context cuando el usuario lo termina o lo salta.
 *
 * Estilo: sigue las CSS variables del tema dinámico del centro
 * (`--color-primary-500`, `--bg-card`, `--text-main`) con fallbacks razonables.
 */
const Tour = () => {
    const { t } = useTranslation();
    const { currentTour, finishTour, tourRuntimeCtx, setTourStepIndex } = useTour();
    /* Esperamos a que el PRIMER target esté realmente en DOM y con
       dimensiones > 0 antes de arrancar Joyride. Es más fiable que un
       setTimeout fijo: las transiciones de Sidebar (72→260px) y
       AccordionView (0fr→1fr) duran lo que duran según el tema. Si
       arrancamos antes, Joyride mide 0x0, el tooltip sale fuera y el
       tour "no sucede" visualmente.

       Fallback de seguridad: si pasan 2.5s y el target no aparece,
       arrancamos igual (Joyride emitirá error:target_not_found y el
       callback lo cazará como "skipped" para no dejar al usuario
       colgado con un tour que nunca arranca). */
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (!currentTour) { setReady(false); return; }
        const selector = `[data-tour="${currentTour.steps[0].targetId}"]`;

        /* Samplemos por frame con requestAnimationFrame (más preciso que
           setInterval 80ms — capta cualquier sub-frame de animación CSS).
           Arrancamos Joyride solo cuando:
             1) El target existe y tiene width+height > 0.
             2) El rect del target permanece IDÉNTICO durante 3 frames
                seguidos (≈50ms). Eso garantiza que todas las animaciones
                que afectan su posición/tamaño (sidebar 72→260, acordeón
                0fr→1fr, cualquier transition cercana) han terminado. */
        const STABLE_FRAMES = 3;
        let lastRect = null;
        let stableFrames = 0;
        let rafId = null;
        let cancelled = false;

        const tick = () => {
            if (cancelled) return;
            const el = document.querySelector(selector);
            if (!el) {
                lastRect = null;
                stableFrames = 0;
            } else {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) {
                    lastRect = null;
                    stableFrames = 0;
                } else if (
                    lastRect
                    && lastRect.top === r.top
                    && lastRect.left === r.left
                    && lastRect.width === r.width
                    && lastRect.height === r.height
                ) {
                    stableFrames++;
                    if (stableFrames >= STABLE_FRAMES) {
                        setReady(true);
                        return;
                    }
                } else {
                    stableFrames = 0;
                }
                lastRect = { top: r.top, left: r.left, width: r.width, height: r.height };
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        /* Fallback de seguridad: si pasan 3s y el target sigue animando o
           no aparece, arrancamos igual. Si Joyride no encuentra el target
           emitirá status=ERROR y el callback cerrará como "skipped". */
        const safetyId = setTimeout(() => {
            if (!cancelled) setReady(true);
        }, 3000);

        return () => {
            cancelled = true;
            if (rafId != null) cancelAnimationFrame(rafId);
            clearTimeout(safetyId);
        };
    }, [currentTour]);

    /* Memoizar steps para evitar recálculos innecesarios en cada render.
       Los steps con `condition: (ctx) => bool` se evalúan contra el
       tourRuntimeCtx publicado por la página activa → se filtran antes
       de pasárselos a Joyride, así Joyride no ve steps que no aplican.

       Beacon: mostramos beacon SOLO en el primer step (indica "aquí arranca
       el tour"). En los siguientes pasos el flujo es continuous y saltamos
       directos al tooltip con Next/Back. El beacon usa la animación Lottie
       de `TourBeacon` en lugar del punto negro por defecto de Joyride. */
    const steps = useMemo(() => {
        if (!currentTour) return [];
        return currentTour.steps
            .filter(s => typeof s.condition !== 'function' || s.condition(tourRuntimeCtx))
            .map((s, i) => ({
                target: `[data-tour="${s.targetId}"]`,
                content: t(s.contentKey),
                title: s.titleKey ? t(s.titleKey) : undefined,
                placement: s.placement || 'auto',
                /* Siempre beacon en el primer step (es el indicador visual de
                   "aquí arranca el tour"). Los demás steps van directos al
                   tooltip con Next. El `disableBeacon` que hay en las
                   definiciones de tour es legado del flujo sin beacon y se
                   ignora aquí a propósito. */
                disableBeacon: i !== 0,
            }));
    }, [currentTour, tourRuntimeCtx, t]);

    /* Sin currentTour o sin ready NO montamos Joyride. Antes tenía run={ready}
       sobre una instancia ya montada, lo cual podía dejar state interno
       inconsistente (Joyride v3 cachea la posición del primer target al
       montar). Montar fresco cada tour con key único es más determinista. */
    if (!currentTour || !ready) return null;

    return (
        <Joyride
            key={currentTour.id}
            steps={steps}
            run={true}
            continuous
            showProgress
            showSkipButton
            disableOverlayClose
            scrollToFirstStep
            spotlightPadding={6}
            /* Tooltip 100% tematizado con nuestro componente + CSS Modules. */
            tooltipComponent={TourTooltip}
            /* Beacon custom: Lottie de fuego en lugar del punto negro. */
            beaconComponent={TourBeacon}
            locale={{
                back:  t('tour.back'),
                close: t('tour.close'),
                last:  t('tour.last'),
                next:  t('tour.next'),
                skip:  t('tour.skip'),
                open:  t('tour.open'),
            }}
            styles={{
                options: {
                    /* Aunque usamos tooltip custom, options.* se aplica a
                       spotlight/overlay/beacon, que siguen siendo del core. */
                    primaryColor:    'var(--color-primary-500, #6366f1)',
                    overlayColor:    'color-mix(in srgb, var(--color-gray-900, #0f172a) 55%, transparent)',
                    spotlightShadow: '0 0 24px color-mix(in srgb, var(--color-primary-500, #6366f1) 40%, transparent)',
                    width: 380,
                    zIndex: 10000,
                },
            }}
            onEvent={(data) => {
                const { status, action, type, index } = data;

                /* Publicamos el step index actual en el TourContext para
                   que el Sidebar pueda abrir el acordeón concreto que cada
                   paso necesita (no todos los pasos de un tour viven en la
                   misma sección, p. ej. profesor-editor-horarios pasa de
                   'general' a 'administracion'). */
                if (type === EVENTS.STEP_BEFORE || type === EVENTS.TOUR_START) {
                    setTourStepIndex(typeof index === 'number' ? index : 0);
                }

                /* El tour ha terminado si:
                   - Joyride emite EVENTS.TOUR_END (éxito o skip)
                   - status pasa a FINISHED/SKIPPED/ERROR
                   - el usuario pulsa la X del tooltip (action=CLOSE) */
                const ended =
                    type === EVENTS.TOUR_END
                    || status === STATUS.FINISHED
                    || status === STATUS.SKIPPED
                    || status === STATUS.ERROR
                    || action === ACTIONS.CLOSE;

                if (ended) {
                    const outcome = status === STATUS.FINISHED ? 'completed' : 'skipped';
                    finishTour(outcome);
                }
            }}
        />
    );
};

export default Tour;
