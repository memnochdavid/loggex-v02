import React, { useState } from 'react';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import styles from './Crud.module.css';
import calStyles from './Calificaciones.module.css';
import Festivos from './Festivos';
import Evaluaciones from './Evaluaciones';

const Fechas = () => {
  const [tab, setTab] = useState('festivos');

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader
          title="Fechas"
          logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        />

        <div className={calStyles.tabBar} style={{ marginBottom: 'var(--space-4)' }}>
          <button
            className={`${calStyles.tab} ${tab === 'festivos' ? calStyles.tabActive : ''}`}
            onClick={() => setTab('festivos')}
          >
            Festivos
          </button>
          <button
            className={`${calStyles.tab} ${tab === 'evaluaciones' ? calStyles.tabActive : ''}`}
            onClick={() => setTab('evaluaciones')}
          >
            Evaluaciones
          </button>
        </div>

        {tab === 'festivos' && <Festivos embedded />}
        {tab === 'evaluaciones' && <Evaluaciones embedded />}
      </div>
    </Layout>
  );
};

export default Fechas;
