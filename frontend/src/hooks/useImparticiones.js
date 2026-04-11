import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

/**
 * Hook compartido para cargar imparticiones con filtros de SuperAdmin.
 * Usado por Tareas y Entregas para evitar duplicar ~120 líneas de lógica.
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
    const [grupos, setGrupos] = useState([]);
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [modulos, setModulos] = useState([]);
    const [selectedModulo, setSelectedModulo] = useState('');

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

    // Cargar grupos cuando cambia el centro
    useEffect(() => {
        if (isSuperAdmin && selectedCentro) {
            fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                setGrupos(data['hydra:member'] || data.member || []);
                setSelectedGrupo('');
                setModulos([]);
                setSelectedModulo('');
            })
            .catch(err => console.error('Error cargando grupos:', err));
        } else {
            setGrupos([]);
            setSelectedGrupo('');
            setModulos([]);
            setSelectedModulo('');
        }
    }, [selectedCentro, isSuperAdmin]);

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
                    if (item.modulo && !map.has(item.modulo.id)) {
                        map.set(item.modulo.id, item.modulo);
                    }
                });
                setModulos([...map.values()]);
                setSelectedModulo('');
            })
            .catch(err => console.error('Error cargando módulos:', err));
        } else {
            setModulos([]);
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
                if (selectedModulo) {
                    query += `&modulo=${selectedModulo}`;
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
                    const nombreModulo = imp.modulo?.nombre || t('common.unknownModule');
                    const nombreGrupo = imp.grupo?.abreviatura || imp.grupo?.nombre || t('common.unknownGroup');
                    const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';

                    let title = `${nombreModulo} - ${nombreGrupo}`;
                    if ((isAlumno || isSuperAdmin) && nombreProfesor) {
                        title += ` (${nombreProfesor})`;
                    }

                    return {
                        ...imp,
                        id: imp.id || imp['@id'].split('/').pop(),
                        title,
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
    }, [user, isProfesor, isAlumno, isAdmin, isSuperAdmin, selectedCentro, selectedGrupo, selectedModulo, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        asignaturas,
        loading,
        error,
        fetchData,
        // Roles
        isProfesor,
        isAlumno,
        isAdmin,
        isSuperAdmin,
        // Filtros SuperAdmin
        filters: {
            centros, selectedCentro, setSelectedCentro,
            grupos, selectedGrupo, setSelectedGrupo,
            modulos, selectedModulo, setSelectedModulo,
        },
    };
};

export default useImparticiones;
