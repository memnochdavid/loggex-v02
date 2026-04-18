import React, { useMemo } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useTour } from '../context/TourContext';

/**
 * Wrapper sobre react-joyride. Lee el tour activo del TourContext, traduce los
 * pasos vía i18n y notifica al context cuando el usuario lo termina o lo salta.
 *
 * Estilo: sigue las CSS variables del tema dinámico del centro
 * (`--color-primary-500`, `--bg-card`, `--text-main`) con fallbacks razonables.
 */
const Tour = () => {
    const { t } = useTranslation();
    const { currentTour, finishTour } = useTour();

    const { tourRuntimeCtx } = useTour();

    /* Memoizar steps para evitar recálculos innecesarios en cada render.
       Los steps con `condition: (ctx) => bool` se evalúan contra el
       tourRuntimeCtx publicado por la página activa → se filtran antes
       de pasárselos a Joyride, así Joyride no ve steps que no aplican. */
    const steps = useMemo(() => {
        if (!currentTour) return [];
        return currentTour.steps
            .filter(s => typeof s.condition !== 'function' || s.condition(tourRuntimeCtx))
            .map(s => ({
                target: `[data-tour="${s.targetId}"]`,
                content: t(s.contentKey),
                title: s.titleKey ? t(s.titleKey) : undefined,
                placement: s.placement || 'auto',
                disableBeacon: s.disableBeacon ?? false,
            }));
    }, [currentTour, tourRuntimeCtx, t]);

    if (!currentTour) return null;

    return (
        <Joyride
            steps={steps}
            run
            continuous
            showProgress
            showSkipButton
            disableOverlayClose
            scrollToFirstStep
            spotlightPadding={6}
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
                    /* Acento principal del tooltip (botón Next, progress bar) */
                    primaryColor:    'var(--color-primary-500, #6366f1)',
                    textColor:       'var(--text-main, #1e293b)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    arrowColor:      'var(--bg-card, #ffffff)',
                    overlayColor:    'rgba(15, 23, 42, 0.55)',
                    width: 360,
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: 12,
                    padding: 18,
                    fontSize: 14,
                    boxShadow: '0 24px 60px -16px rgba(15, 23, 42, 0.45)',
                },
                tooltipTitle: {
                    fontSize: 15,
                    fontWeight: 700,
                    margin: '0 0 8px 0',
                    letterSpacing: '-0.01em',
                },
                tooltipContent: {
                    padding: 0,
                    lineHeight: 1.55,
                },
                buttonNext: {
                    borderRadius: 8,
                    fontWeight: 600,
                    padding: '8px 16px',
                },
                buttonBack: {
                    color: 'var(--text-soft, #64748b)',
                    fontWeight: 500,
                },
                buttonSkip: {
                    color: 'var(--text-soft, #64748b)',
                    fontSize: 13,
                },
            }}
            callback={(data) => {
                const { status } = data;
                /* status puede ser: ready / running / paused / skipped / finished / error */
                if (status === STATUS.FINISHED) {
                    finishTour('completed');
                } else if (status === STATUS.SKIPPED) {
                    finishTour('skipped');
                }
            }}
        />
    );
};

export default Tour;
