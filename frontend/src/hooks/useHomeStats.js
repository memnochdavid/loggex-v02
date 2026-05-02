import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

/**
 * Agrega las métricas que se muestran en el stat ribbon de la Home.
 * Devuelve números absolutos, listos para renderizar, con polling ligero cada 60s.
 *
 * - pendingTasks:        tareas con fechaLimite en el futuro asociadas al alumno (solo rol alumno).
 * - pendingDeliveries:   entregas sin calificar en imparticiones donde el user es profesor.
 * - nextClass:           próxima clase del día actual (null si no hay).
 * - weekEvents:          tareas cuyo deadline cae en los próximos 7 días.
 */
export default function useHomeStats(intervalMs = 60000) {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        pendingTasks: 0,
        pendingDeliveries: 0,
        nextClass: null,
        weekEvents: 0,
    });

    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
    // El widget "Por corregir" debe contar SOLO las entregas de imparticiones
    // del usuario como profesor. Antes incluíamos ROLE_ADMIN/SUPERADMIN aquí,
    // pero el `CurrentUserExtension` filtra por centro, no por user.id, así que
    // un admin que también es profesor recibía TODAS las entregas sin calificar
    // del centro entero (caso real: +600). Mantenemos `isProfesor` estricto y
    // además filtramos server-side por `tarea.imparticion.profesor=user.id`.
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const parseList = (data) => data?.['hydra:member'] || data?.member || [];

        const fetchAll = async () => {
            const now = new Date();
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);

            // Tareas / eventos de la semana
            const tareasPromise = fetch(
                getApiUrl('/api/tareas?pagination=false'),
                { headers: { Accept: 'application/ld+json' }, credentials: 'include' }
            )
                .then(r => (r.ok ? r.json() : null))
                .then(parseList)
                .catch(() => []);

            // Horario
            const schedulePromise = fetch(getApiUrl('/api/my-schedule'), {
                headers: { Accept: 'application/json' },
                credentials: 'include',
            })
                .then(r => (r.ok ? r.json() : []))
                .catch(() => []);

            // Entregas por corregir (solo profe). Filtros server-side:
            //  · `exists[calificacion]=false`: entregas aún sin calificar.
            //  · `tarea.imparticion.profesor=<user.id>`: SOLO de imparticiones
            //    donde el user es el profesor. Imprescindible para que el admin
            //    que también es profesor no cuente las entregas del centro entero.
            const entregasPromise = (isProfesor && user?.id)
                ? fetch(
                      getApiUrl(`/api/entregas?exists[calificacion]=false&tarea.imparticion.profesor=${user.id}&pagination=false`),
                      { headers: { Accept: 'application/ld+json' }, credentials: 'include' }
                  )
                      .then(r => (r.ok ? r.json() : null))
                      .then(parseList)
                      .catch(() => [])
                : Promise.resolve([]);

            const [tareas, schedule, entregas] = await Promise.all([
                tareasPromise,
                schedulePromise,
                entregasPromise,
            ]);
            if (cancelled) return;

            // weekEvents: tareas con fechaLimite en [now, now+7d]
            const weekEventsCount = tareas.filter(t => {
                if (!t.fechaLimite) return false;
                const d = new Date(t.fechaLimite);
                return d >= now && d <= weekEnd;
            }).length;

            // pendingTasks: tareas futuras (fechaLimite >= now) — solo alumno
            const pendingTasksCount = isAlumno
                ? tareas.filter(t => {
                      if (!t.fechaLimite) return false;
                      return new Date(t.fechaLimite) >= now;
                  }).length
                : 0;

            // nextClass: próxima clase de hoy según hora actual
            const hoyNum = now.getDay() === 0 ? 7 : now.getDay();
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const todays = Array.isArray(schedule)
                ? schedule.filter(e => e.diaSemana === hoyNum && e.horaInicio > hhmm)
                : [];
            todays.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
            const nextClass = todays[0] || null;

            setStats({
                pendingTasks: pendingTasksCount,
                pendingDeliveries: isProfesor ? entregas.length : 0,
                nextClass,
                weekEvents: weekEventsCount,
            });
        };

        fetchAll();
        const id = setInterval(fetchAll, intervalMs);
        return () => { cancelled = true; clearInterval(id); };
    }, [user?.id, isAlumno, isProfesor, intervalMs]);

    return stats;
}
