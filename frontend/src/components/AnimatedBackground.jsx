import React, { useState, useEffect } from 'react';
import styles from './AnimatedBackground.module.css';
import {
    GraduationCap, BookOpen, ClipboardList, Shield, Users,
    CalendarCheck, Clock, MessageSquare, Palette, FileText
} from 'lucide-react';

const AnimatedBackground = () => {
    const [enabled, setEnabled] = useState(() => {
        return window.themeConfig?.showAnimatedBackground || false;
    });

    useEffect(() => {
        const handleConfigChange = () => {
            setEnabled(window.themeConfig?.showAnimatedBackground || false);
        };

        window.addEventListener('themeConfigChanged', handleConfigChange);
        return () => window.removeEventListener('themeConfigChanged', handleConfigChange);
    }, []);

    if (!enabled) return null;

    return (
        <div className={styles.wrapper} aria-hidden="true">
            <div className={styles.gradient} />
            <div className={styles.glows} />
            <div className={styles.grid} />
            <div className={styles.bottomGlow} />

            <div className={styles.floatingIcons}>
                <div className={`${styles.floatingIcon} ${styles.fi1}`}><GraduationCap size={28} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi2}`}><BookOpen size={22} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi3}`}><ClipboardList size={24} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi4}`}><Shield size={20} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi5}`}><Users size={26} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi6}`}><CalendarCheck size={22} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi7}`}><Clock size={20} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi8}`}><MessageSquare size={24} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi9}`}><Palette size={22} /></div>
                <div className={`${styles.floatingIcon} ${styles.fi10}`}><FileText size={20} /></div>
            </div>
        </div>
    );
};

export default AnimatedBackground;
