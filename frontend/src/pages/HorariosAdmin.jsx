import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import styles from './Crud.module.css';
import calStyles from './Calificaciones.module.css';
import Horarios from './Horarios';
import HorariosEditor from './HorariosEditor';
import HorariosConsumicion from './HorariosConsumicion';

const HorariosAdmin = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('editor');

    const tabs = (
        <div className={calStyles.tabBar} style={{ margin: 0 }}>
            <button
                type="button"
                className={`${calStyles.tab} ${tab === 'editor' ? calStyles.tabActive : ''}`}
                onClick={() => setTab('editor')}
            >
                {t('scheduleEditor.tabEditor')}
            </button>
            <button
                type="button"
                className={`${calStyles.tab} ${tab === 'lista' ? calStyles.tabActive : ''}`}
                onClick={() => setTab('lista')}
            >
                {t('scheduleEditor.tabList')}
            </button>
            <button
                type="button"
                className={`${calStyles.tab} ${tab === 'consumicion' ? calStyles.tabActive : ''}`}
                onClick={() => setTab('consumicion')}
            >
                {t('scheduleEditor.tabConsumption')}
            </button>
        </div>
    );

    return (
        <Layout>
            <div className={styles.container}>
                <div key={tab} className={calStyles.tabContent}>
                    {tab === 'editor'      && <HorariosEditor      embedded tabs={tabs} />}
                    {tab === 'lista'       && <Horarios            embedded tabs={tabs} />}
                    {tab === 'consumicion' && <HorariosConsumicion embedded tabs={tabs} />}
                </div>
            </div>
        </Layout>
    );
};

export default HorariosAdmin;
