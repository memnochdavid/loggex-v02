import React from 'react';
import { useTranslation } from 'react-i18next';
import ThemedSelect from './ThemedSelect';
import { formatGrupoNombre } from '../utils/grupo';

/**
 * Filtros en cascada Centro → Año escolar → Grupo → Módulo para SuperAdmin.
 * Usa ThemedSelect (trigger idéntico al <select> nativo del CRUD, dropdown custom).
 * La prop `selectClassName` queda por compatibilidad con llamadas antiguas pero se ignora.
 */
const SuperAdminFilters = ({ filters }) => {
    const { t } = useTranslation();
    const {
        centros, selectedCentro, setSelectedCentro,
        availableYears, selectedYear, setSelectedYear,
        grupos, selectedGrupo, setSelectedGrupo,
        modulos, selectedMateria, setSelectedModulo,
    } = filters;

    return (
        <>
            <ThemedSelect
                value={selectedCentro}
                onChange={setSelectedCentro}
                minWidth={200}
                ariaLabel={t('common.allCenters')}
                placeholder={t('common.allCenters')}
                options={[
                    { value: '', label: t('common.allCenters') },
                    ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                ]}
            />

            {availableYears?.length > 0 && (
                <ThemedSelect
                    value={selectedYear}
                    onChange={setSelectedYear}
                    disabled={!selectedCentro}
                    minWidth={140}
                    ariaLabel={t('grades.allYears')}
                    placeholder={t('grades.allYears')}
                    options={[
                        { value: '', label: t('grades.allYears') },
                        ...availableYears.map(y => ({ value: y, label: y })),
                    ]}
                />
            )}

            <ThemedSelect
                value={selectedGrupo}
                onChange={setSelectedGrupo}
                disabled={!selectedCentro}
                minWidth={150}
                ariaLabel={t('common.allGroups')}
                placeholder={t('common.allGroups')}
                options={[
                    { value: '', label: t('common.allGroups') },
                    ...grupos.map(g => ({ value: String(g.id), label: formatGrupoNombre(g) })),
                ]}
            />

            <ThemedSelect
                value={selectedMateria}
                onChange={setSelectedModulo}
                disabled={!selectedGrupo}
                minWidth={150}
                ariaLabel={t('common.allModules')}
                placeholder={t('common.allModules')}
                options={[
                    { value: '', label: t('common.allModules') },
                    ...modulos.map(m => ({ value: String(m.id), label: m.nombre })),
                ]}
            />
        </>
    );
};

export default SuperAdminFilters;
