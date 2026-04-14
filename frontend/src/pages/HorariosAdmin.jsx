import React, { useState } from 'react';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import Lottie from 'lottie-react';
import timeAnim from '../../public/time.json';
import styles from './Crud.module.css';
import calStyles from './Calificaciones.module.css';
import Horarios from './Horarios';
import HorariosEditor from './HorariosEditor';

const HorariosAdmin = () => {
    const [tab, setTab] = useState('lista');

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader
                    title="Horarios"
                    logo={<Lottie animationData={timeAnim} loop={true} style={{ width: 60, height: 60 }} />}
                />

                <div className={calStyles.tabBar} style={{ marginBottom: 'var(--space-4)' }}>
                    <button
                        className={`${calStyles.tab} ${tab === 'lista' ? calStyles.tabActive : ''}`}
                        onClick={() => setTab('lista')}
                    >
                        Lista
                    </button>
                    <button
                        className={`${calStyles.tab} ${tab === 'editor' ? calStyles.tabActive : ''}`}
                        onClick={() => setTab('editor')}
                    >
                        Editor gráfico
                    </button>
                </div>

                {tab === 'lista' && <Horarios embedded />}
                {tab === 'editor' && <HorariosEditor embedded />}
            </div>
        </Layout>
    );
};

export default HorariosAdmin;
