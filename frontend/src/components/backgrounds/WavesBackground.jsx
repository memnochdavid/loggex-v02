import React from 'react';
import styles from './WavesBackground.module.css';

const WavesBackground = () => {
    return (
        <>
            <div className={styles.gradient} />

            {/* Cáusticas de luz bajo el agua */}
            <div className={styles.caustics} />
            <div className={styles.caustics2} />

            {/* Ondas SVG horizontales — cada una es una ola real */}
            <svg className={`${styles.waveSvg} ${styles.wave1}`} viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path d="M0,192 C120,230 240,140 360,180 C480,220 600,130 720,170 C840,210 960,120 1080,160 C1200,200 1320,110 1440,150 L1440,320 L0,320 Z" />
            </svg>
            <svg className={`${styles.waveSvg} ${styles.wave2}`} viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path d="M0,224 C160,260 280,170 420,210 C560,250 640,160 800,200 C960,240 1080,150 1200,190 C1320,230 1400,170 1440,180 L1440,320 L0,320 Z" />
            </svg>
            <svg className={`${styles.waveSvg} ${styles.wave3}`} viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path d="M0,256 C200,290 320,200 480,240 C640,280 720,190 900,230 C1080,270 1160,180 1300,220 C1380,240 1420,210 1440,215 L1440,320 L0,320 Z" />
            </svg>
            <svg className={`${styles.waveSvg} ${styles.wave4}`} viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path d="M0,280 C180,300 300,250 440,270 C580,290 700,240 860,260 C1020,280 1140,230 1280,255 C1360,265 1420,250 1440,252 L1440,320 L0,320 Z" />
            </svg>

            {/* Reflejo de luz en la superficie */}
            <div className={styles.surfaceLight} />
        </>
    );
};

export default WavesBackground;
