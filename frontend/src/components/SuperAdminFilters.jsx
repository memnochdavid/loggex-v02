import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Filtros en cascada Centro → Año escolar → Grupo → Módulo para SuperAdmin.
 * Renderiza selects sueltos (sin wrapper) para que el padre controle el layout.
 */
const SuperAdminFilters = ({ filters, selectClassName }) => {
    const { t } = useTranslation();
    const {
        centros, selectedCentro, setSelectedCentro,
        availableYears, selectedYear, setSelectedYear,
        grupos, selectedGrupo, setSelectedGrupo,
        modulos, selectedModulo, setSelectedModulo,
    } = filters;

    return (
        <>
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

            {availableYears?.length > 0 && (
                <select
                    className={selectClassName}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={!selectedCentro}
                    style={{ minWidth: '140px' }}
                >
                    <option value="">{t('grades.allYears')}</option>
                    {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            )}

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
        </>
    );
};

export default SuperAdminFilters;
