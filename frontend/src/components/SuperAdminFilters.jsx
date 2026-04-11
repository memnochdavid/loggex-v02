import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Filtros en cascada Centro → Grupo → Módulo para SuperAdmin.
 * Renderiza los 3 selects que comparten Tareas y Entregas.
 */
const SuperAdminFilters = ({ filters, selectClassName }) => {
    const { t } = useTranslation();
    const {
        centros, selectedCentro, setSelectedCentro,
        grupos, selectedGrupo, setSelectedGrupo,
        modulos, selectedModulo, setSelectedModulo,
    } = filters;

    return (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
                className={selectClassName}
                value={selectedCentro}
                onChange={(e) => setSelectedCentro(e.target.value)}
                style={{ minWidth: '200px' }}
            >
                <option value="">{t('common.allCenters')}</option>
                {centros.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
            </select>

            <select
                className={selectClassName}
                value={selectedGrupo}
                onChange={(e) => setSelectedGrupo(e.target.value)}
                disabled={!selectedCentro}
                style={{ minWidth: '150px' }}
            >
                <option value="">{t('common.allGroups')}</option>
                {grupos.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
            </select>

            <select
                className={selectClassName}
                value={selectedModulo}
                onChange={(e) => setSelectedModulo(e.target.value)}
                disabled={!selectedGrupo}
                style={{ minWidth: '150px' }}
            >
                <option value="">{t('common.allModules')}</option>
                {modulos.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
            </select>
        </div>
    );
};

export default SuperAdminFilters;
