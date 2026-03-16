import { lazy } from 'react';

const GridBackground = lazy(() => import('./GridBackground'));
const ParticlesBackground = lazy(() => import('./ParticlesBackground'));
const WavesBackground = lazy(() => import('./WavesBackground'));

export const BACKGROUNDS = {
    grid: {
        component: GridBackground,
        labelKey: 'config.general.bgGrid',
    },
    particles: {
        component: ParticlesBackground,
        labelKey: 'config.general.bgParticles',
    },
    waves: {
        component: WavesBackground,
        labelKey: 'config.general.bgWaves',
    },
};

export const BACKGROUND_KEYS = Object.keys(BACKGROUNDS);
