import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import styles from './Crud.module.css';
import calStyles from './Calificaciones.module.css';
import Horarios from './Horarios';
import HorariosEditor from './HorariosEditor';

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
        </div>
    );

    return (
        <Layout>
            <div className={styles.container}>
                {tab === 'editor' && <HorariosEditor embedded tabs={tabs} />}
                {tab === 'lista'  && <Horarios       embedded tabs={tabs} />}
            </div>
        </Layout>
    );
};

export default HorariosAdmin;
