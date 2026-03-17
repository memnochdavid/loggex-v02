import React from 'react';
import styles from './GridBackground.module.css';
import {
    GraduationCap, BookOpen, ClipboardList, Shield, Users,
    CalendarCheck, Clock, MessageSquare, Palette, FileText
} from 'lucide-react';

const GridBackground = () => {
    return (
        <>
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
        </>
    );
};

export default GridBackground;
