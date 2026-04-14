import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import styles from './Crud.module.css';
import calStyles from './Calificaciones.module.css';
import Festivos from './Festivos';
import Evaluaciones from './Evaluaciones';

const Fechas = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('festivos');

  const tabs = (
    <div className={calStyles.tabBar} style={{ margin: 0 }}>
      <button
        type="button"
        className={`${calStyles.tab} ${tab === 'festivos' ? calStyles.tabActive : ''}`}
        onClick={() => setTab('festivos')}
      >
        {t('dates.tabHolidays')}
      </button>
      <button
        type="button"
        className={`${calStyles.tab} ${tab === 'evaluaciones' ? calStyles.tabActive : ''}`}
        onClick={() => setTab('evaluaciones')}
      >
        {t('dates.tabEvaluations')}
      </button>
    </div>
  );

  return (
    <Layout>
      <div className={styles.container}>
        {tab === 'festivos'     && <Festivos     embedded tabs={tabs} />}
        {tab === 'evaluaciones' && <Evaluaciones embedded tabs={tabs} />}
      </div>
    </Layout>
  );
};

export default Fechas;
