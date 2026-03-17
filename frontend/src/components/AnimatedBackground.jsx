import React, { useState, useEffect, Suspense } from 'react';
import styles from './AnimatedBackground.module.css';
import { BACKGROUNDS } from './backgrounds';

const DEFAULT_STYLE = {
    '--bg-anim-1': '#0c1222',
    '--bg-anim-2': '#162040',
    '--bg-anim-3': '#1a1a4e',
    '--color-primary-rgb': '99, 102, 241',
};

const AnimatedBackground = ({ forceDefault = false }) => {
    const [bgType, setBgType] = useState(() => {
        if (forceDefault) return 'grid';
        return window.themeConfig?.animatedBackground || null;
    });

    useEffect(() => {
        if (forceDefault) return;

        const handleConfigChange = () => {
            setBgType(window.themeConfig?.animatedBackground || null);
        };

        window.addEventListener('themeConfigChanged', handleConfigChange);
        return () => window.removeEventListener('themeConfigChanged', handleConfigChange);
    }, [forceDefault]);

    if (!bgType) return null;

    const bg = BACKGROUNDS[bgType];
    if (!bg) return null;

    const Component = bg.component;

    return (
        <div className={styles.wrapper} style={forceDefault ? DEFAULT_STYLE : undefined} aria-hidden="true">
            <Suspense fallback={null}>
                <Component />
            </Suspense>
        </div>
    );
};

export default AnimatedBackground;
