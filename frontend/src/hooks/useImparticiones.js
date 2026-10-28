import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { formatGrupoAbrev } from '../utils/grupo';

/**
 * Hook compartido para cargar imparticiones con filtros de SuperAdmin.
 * Cascada: Centro → Año escolar → Grupo → Módulo
 */
const useImparticiones = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    const [asignaturas, setAsignaturas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [allGrupos, setAllGrupos] = useState([]); // todos los del centro (para extraer años)
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [modulos, setMaterias] = useState([]);
    const [selectedMateria, setSelectedModulo] = useState('');

    // Años escolares disponibles (extraídos de los grupos del centro)
    const availableYears = useMemo(() => {
        const years = [...new Set(allGrupos.map(g => g.anioEscolar || g.anio_escolar).filter(Boolean))];
        return years.sort().reverse();
    }, [allGrupos]);

    // Grupos filtrados por año escolar
    const grupos = useMemo(() => {
        if (!selectedYear) return allGrupos;
        return allGrupos.filter(g => (g.anioEscolar || g.anio_escolar) === selectedYear);
    }, [allGrupos, selectedYear]);

    // Cargar centros para SuperAdmin
    useEffect(() => {
        if (isSuperAdmin) {
            fetch(getApiUrl('/api/centros?pagination=false'), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => setCentros(data['hydra:member'] || data.member || []))
            .catch(err => console.error('Error cargando centros:', err));
        }
    }, [isSuperAdmin]);

    // Cargar TODOS los grupos del centro (para extraer años)
    useEffect(() => {
        if (isSuperAdmin && selectedCentro) {
            fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                setAllGrupos(data['hydra:member'] || data.member || []);
                setSelectedYear('');
                setSelectedGrupo('');
                setMaterias([]);
                setSelectedModulo('');
            })
            .catch(err => console.error('Error cargando grupos:', err));
        } else {
            setAllGrupos([]);
            setSelectedYear('');
            setSelectedGrupo('');
            setMaterias([]);
            setSelectedModulo('');
        }
    }, [selectedCentro, isSuperAdmin]);

    // Reset grupo al cambiar año
    useEffect(() => {
        setSelectedGrupo('');
        setMaterias([]);
        setSelectedModulo('');
    }, [selectedYear]);

    // Cargar módulos cuando cambia el grupo
    useEffect(() => {
        if (isSuperAdmin && selectedGrupo) {
            fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                const map = new Map();
                items.forEach(item => {
                    if (item.materia && !map.has(item.materia.id)) {
                        map.set(item.materia.id, item.materia);
                    }
                });
                setMaterias([...map.values()]);
                setSelectedModulo('');
            })
            .catch(err => console.error('Error cargando materias:', err));
        } else {
            setMaterias([]);
            setSelectedModulo('');
        }
    }, [selectedGrupo, isSuperAdmin]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            let endpoint = '';

            if (isProfesor) {
                endpoint = getApiUrl(`/api/imparticions?profesor=${user.id}&pagination=false`);
            } else if (isAlumno) {
                const resMatriculas = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
                });
                const dataMatriculas = await resMatriculas.json();
                const matriculas = dataMatriculas['hydra:member'] || dataMatriculas.member || [];
                const grupoIds = matriculas.map(m => typeof m.grupo === 'string' ? m.grupo.split('/').pop() : m.grupo.id);

                if (grupoIds.length > 0) {
                    const gruposQuery = grupoIds.map(id => `grupo[]=${id}`).join('&');
                    endpoint = getApiUrl(`/api/imparticions?${gruposQuery}&pagination=false`);
                } else {
                    setAsignaturas([]);
                    setLoading(false);
                    return [];
                }
            } else if (isSuperAdmin) {
                let query = 'pagination=false';
                if (selectedMateria) {
                    query += `&materia=${selectedMateria}`;
                    if (selectedGrupo) query += `&grupo=${selectedGrupo}`;
                } else if (selectedGrupo) {
                    query += `&grupo=${selectedGrupo}`;
                } else if (selectedCentro) {
                    query += `&grupo.centro=${selectedCentro}`;
                }
                endpoint = getApiUrl(`/api/imparticions?${query}`);
            } else if (isAdmin) {
                endpoint = getApiUrl(`/api/imparticions?pagination=false`);
            }

            if (endpoint) {
                const response = await fetch(endpoint, {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (!response.ok) throw new Error(`Error ${response.status}`);
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];

                const mapped = items.map(imp => {
                    const nombreModulo = imp.materia?.nombre || t('common.unknownModule');
                    const abrevModulo = imp.materia?.abreviatura || nombreModulo;
                    const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';

                    // Formato consistente con `/admin/horarios` columna Grupo
                    // (pulido-ux Ronda 1 #2 + R2.4): `[curso]º [abreviatura]`.
                    // `formatGrupoAbrev` ya hace fallback limpio a abreviatura/
                    // nombre y omite el `º` si curso es null. Si grupo viene
                    // como IRI sin populate, devuelve '' → caemos a unknown.
                    const grupoLabel = formatGrupoAbrev(imp.grupo) || t('common.unknownGroup');

                    let title = `${nombreModulo} - ${grupoLabel}`;
                    let titleShort = `${abrevModulo} - ${grupoLabel}`;
                    if ((isAlumno || isSuperAdmin) && nombreProfesor) {
                        title += ` (${nombreProfesor})`;
                        // El short NO añade el profesor: el header debe ser
                        // compacto. El full sigue disponible para tooltips.
                    }

                    return {
                        ...imp,
                        id: imp.id || imp['@id'].split('/').pop(),
                        title,
                        titleShort,
                        tareas: imp.tareas || []
                    };
                });

                setAsignaturas(mapped);
                setError(null);
                return mapped;
            }
            return [];
        } catch (err) {
            console.error('Error cargando imparticiones:', err);
            setError(t('common.errorLoading'));
            return [];
        } finally {
            setLoading(false);
        }
    }, [user, isProfesor, isAlumno, isAdmin, isSuperAdmin, selectedCentro, selectedGrupo, selectedMateria, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        asignaturas,
        loading,
        error,
        fetchData,
        isProfesor, isAlumno, isAdmin, isSuperAdmin,
        filters: {
            centros, selectedCentro, setSelectedCentro,
            availableYears, selectedYear, setSelectedYear,
            grupos, selectedGrupo, setSelectedGrupo,
            modulos, selectedMateria, setSelectedModulo,
        },
    };
};

export default useImparticiones;
