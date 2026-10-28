<?php

namespace App\Service;

use App\Entity\Calificacion;
use App\Entity\Comunicado;
use App\Entity\Entrega;
use App\Entity\ExcepcionHorario;
use App\Entity\Matricula;
use App\Entity\Notificacion;
use App\Entity\Tarea;
use App\Entity\TipoExcepcion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Crea notificaciones del sistema cuando un evento del dominio las merece.
 *
 * Cada `notify*` cubre uno de los tipos del catálogo cerrado en
 * `docs/hoja-de-ruta-notificaciones.md` §3:
 *   - calificacion_publicada       → al alumno de la entrega
 *   - tarea_nueva                  → a los alumnos del grupo
 *   - comunicado_nuevo             → a los usuarios del centro (o globales)
 *   - entrega_recibida             → al profesor de la imparticion
 *
 * Patrón anti-loop: este servicio solo `persist()`-ea las entidades; el
 * `flush` lo hace `NotificationDispatchSubscriber::postFlush` para no
 * encadenar flushes durante el flush en curso.
 *
 * **Idempotencia**: cada `notify*` se llama una sola vez por evento (al
 * postPersist de la entidad disparadora). Si se llama dos veces, se
 * crearían dos notificaciones idénticas — los disparadores se aseguran de
 * llamar solo cuando hay un cambio relevante (postPersist, no postUpdate).
 */
class NotificationDispatcher
{
    /**
     * Memoria in-process de claves `tipo|usuario_id|intercambioGrupoId` ya
     * emitidas en este request. Necesaria porque el dedupe DQL no ve las
     * notificaciones encoladas en el UnitOfWork hasta el flush final del
     * subscriber: cuando se procesan N EH cascadeadas (clases gemelas /
     * multi-bloque) en el mismo `postFlush`, sus notifs se persistan sin
     * flush intermedio y la query LIKE no las encuentra.
     *
     * El array no se resetea entre batches: cada `intercambioGrupoId` es un
     * UUID v4 único, así que las claves no colisionan entre requests
     * distintos. Si un mismo request emite muchas notifs distintas, el
     * tamaño es despreciable (~decenas de entradas por request).
     *
     * @var array<string,true>
     */
    private array $emitidasEsteRequest = [];

    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Notifica al alumno de la entrega que su calificación está publicada
     * (creación inicial — `Calificacion::postPersist`).
     */
    public function notifyCalificacionPublicada(Calificacion $cal): void
    {
        $this->notifyCalificacion($cal, 'calificacion_publicada', 'Tu calificación está disponible');
    }

    /**
     * Notifica al alumno cuando el profe rectifica/edita una nota ya publicada
     * (`Calificacion::preUpdate` filtrado por cambio en el campo `nota`).
     * Tipo distinto al de creación para que el frontend pueda mostrar un copy
     * adecuado ("se ha actualizado") y eventualmente un icono diferenciado.
     */
    public function notifyCalificacionActualizada(Calificacion $cal): void
    {
        $this->notifyCalificacion($cal, 'calificacion_actualizada', 'Tu calificación se ha actualizado');
    }

    /**
     * Implementación común de los dos métodos `notifyCalificacion*` (publicada
     * y actualizada). Solo cambian `tipo` y `titulo`; el resto del payload y
     * el cuerpo dependen del mismo conjunto de campos.
     */
    private function notifyCalificacion(Calificacion $cal, string $tipo, string $titulo): void
    {
        $entrega = $cal->getEntrega();
        if ($entrega === null) {
            return;
        }
        $alumno = $entrega->getAlumno();
        $tarea = $entrega->getTarea();
        if ($alumno === null || $tarea === null) {
            return;
        }

        $tareaTitulo = $tarea->getTitulo() ?? '';
        $nota = $cal->getNota();

        // Mensaje en español como fallback. El frontend traduce vía clave
        // `notifications.types.{tipo}.body` interpolando `payload`.
        $mensaje = $tipo === 'calificacion_actualizada'
            ? sprintf('Tu nota de "%s" se ha actualizado a %s.', $tareaTitulo, $this->fmtNota($nota))
            : sprintf('Has obtenido %s en "%s".', $this->fmtNota($nota), $tareaTitulo);

        // El destinatario es el alumno → enlace a su vista personal de
        // calificaciones, NO a `/calificaciones` (vista de profe, bloqueada
        // para alumno por PrivateRoute con allowedRoles tras R2.5). El query
        // `?tarea=X` permite a `MisCalificaciones` auto-expandir el accordion
        // de la imparticion de esa tarea (ver R2.6 del doc pulido-ux).
        $this->createPersist($alumno, [
            'tipo'    => $tipo,
            'titulo'  => $titulo,
            'mensaje' => $mensaje,
            'enlace'  => sprintf('/mis-calificaciones?tarea=%d', $tarea->getId()),
            'payload' => [
                'entregaId'   => $entrega->getId(),
                'tareaId'     => $tarea->getId(),
                'tareaTitulo' => $tareaTitulo,
                'nota'        => $nota,
            ],
        ]);
    }

    /**
     * Notifica a todos los alumnos matriculados en el grupo de la imparticion
     * que hay una tarea nueva visible para ellos.
     */
    public function notifyTareaNueva(Tarea $tarea): void
    {
        if (!$tarea->isVisible()) {
            return;  // Tarea oculta: no se notifica hasta que se haga visible.
        }

        $imp = $tarea->getImparticion();
        if ($imp === null) {
            return;
        }
        $grupo = $imp->getGrupo();
        if ($grupo === null) {
            return;
        }

        $titulo = $tarea->getTitulo() ?? '';
        $fechaLim = $tarea->getFechaLimite();

        // Query directa al repo en vez de `$grupo->getMatriculas()` (Grupo no
        // expone el getter; además evitamos lazy loading durante postFlush).
        $matriculas = $this->em->getRepository(Matricula::class)->createQueryBuilder('m')
            ->andWhere('m.grupo = :grupo')
            ->andWhere('m.deleted = :false')
            ->setParameter('grupo', $grupo)
            ->setParameter('false', false)
            ->getQuery()->getResult();

        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();
            if ($alumno === null) {
                continue;
            }

            $this->createPersist($alumno, [
                'tipo'    => 'tarea_nueva',
                'titulo'  => 'Nueva tarea disponible',
                'mensaje' => sprintf(
                    'Tienes una nueva tarea: "%s"%s.',
                    $titulo,
                    $fechaLim ? ' (entrega hasta el ' . $this->fmtFechaEs($fechaLim) . ')' : ''
                ),
                // `/tareas/{id}` no existe como ruta del frontend (404).
                // El alumno entrega tareas desde `/entregas` con
                // `?tarea=X` para auto-abrir su accordion (R2.6).
                'enlace'  => sprintf('/entregas?tarea=%d', $tarea->getId()),
                'payload' => [
                    'tareaId'     => $tarea->getId(),
                    'titulo'      => $titulo,
                    'fechaLimite' => $fechaLim?->format(\DateTime::ATOM),
                ],
            ]);
        }
    }

    /**
     * Notifica un comunicado nuevo a todos los usuarios afectados:
     *   - Si `global=true`: todos los usuarios activos del sistema.
     *   - Si `global=false`: usuarios cuyo `centro` coincide con el del comunicado.
     *
     * El autor NO se notifica a sí mismo.
     */
    public function notifyComunicadoNuevo(Comunicado $com): void
    {
        $titulo = $com->getTitulo() ?? '';
        $autorId = $com->getAutor()?->getId();

        $userRepo = $this->em->getRepository(User::class);

        if ($com->isGlobal()) {
            $destinatarios = $userRepo->createQueryBuilder('u')
                ->andWhere('u.deleted = :false')
                ->setParameter('false', false)
                ->getQuery()->getResult();
        } else {
            $centro = $com->getCentro();
            if ($centro === null) {
                return;
            }
            $destinatarios = $userRepo->createQueryBuilder('u')
                ->andWhere('u.centro = :centro')
                ->andWhere('u.deleted = :false')
                ->setParameter('centro', $centro)
                ->setParameter('false', false)
                ->getQuery()->getResult();
        }

        foreach ($destinatarios as $user) {
            if ($autorId !== null && $user->getId() === $autorId) {
                continue;
            }
            $this->createPersist($user, [
                'tipo'    => 'comunicado_nuevo',
                'titulo'  => 'Nuevo comunicado',
                'mensaje' => sprintf('Se ha publicado: "%s".', $titulo),
                'enlace'  => sprintf('/comunicados/%d', $com->getId()),
                'payload' => [
                    'comunicadoId' => $com->getId(),
                    'titulo'       => $titulo,
                    'global'       => $com->isGlobal(),
                ],
            ]);
        }
    }

    /**
     * Notifica al profesor de la imparticion que ha llegado una entrega
     * nueva del alumno.
     */
    public function notifyEntregaRecibida(Entrega $entrega): void
    {
        $tarea = $entrega->getTarea();
        if ($tarea === null) {
            return;
        }
        $imp = $tarea->getImparticion();
        if ($imp === null) {
            return;
        }
        $profe = $imp->getProfesor();
        if ($profe === null) {
            return;
        }

        $alumno = $entrega->getAlumno();
        $alumnoNombre = $alumno
            ? trim(($alumno->getNombre() ?? '') . ' ' . ($alumno->getApellidos() ?? ''))
            : 'Un alumno';

        $tareaTitulo = $tarea->getTitulo() ?? '';

        $this->createPersist($profe, [
            'tipo'    => 'entrega_recibida',
            'titulo'  => 'Nueva entrega recibida',
            'mensaje' => sprintf('%s ha entregado "%s".', $alumnoNombre, $tareaTitulo),
            'enlace'  => sprintf('/entregas?tarea=%d', $tarea->getId()),
            'payload' => [
                'entregaId'    => $entrega->getId(),
                'tareaId'      => $tarea->getId(),
                'alumnoId'     => $alumno?->getId(),
                'alumnoNombre' => $alumnoNombre,
                'tareaTitulo'  => $tareaTitulo,
            ],
        ]);
    }

    // ─── ExcepcionHorario / Incidencias (Fase D 2026-05-07) ──────────────────
    //
    // Catálogo de tipos cubierto:
    //   excepcion_pendiente   → admin(s) del centro al crear PENDIENTE
    //   excepcion_aprobada    → solicitante al pasar a APROBADA
    //   excepcion_rechazada   → solicitante al pasar a RECHAZADA
    //   sustitucion_asignada  → profeOverride al pasar a APROBADA (si lo hay)
    //   clase_cancelada       → alumnos del grupo (tipo=CANCELADO al APROBAR)
    //   clase_trasladada      → alumnos del grupo (resto de tipos al APROBAR)

    /**
     * Notifica a los admin del centro cuando un profe crea una incidencia
     * en estado PENDIENTE_APROBACION. La cola la verán al abrir
     * `/admin/excepciones`.
     */
    public function notifyExcepcionPendiente(ExcepcionHorario $eh): void
    {
        $centro = $eh->getHorarioBase()?->getImparticion()?->getGrupo()?->getCentro();
        if ($centro === null) return;

        $solicitante = $eh->getSolicitadaPor();
        $solicitanteId = $solicitante?->getId();
        $solicitanteNombre = $solicitante
            ? trim(($solicitante->getNombre() ?? '') . ' ' . ($solicitante->getApellidos() ?? ''))
            : 'Un profesor';

        $tipo = $eh->getTipo()?->value ?? '?';
        $fecha = $this->fmtFechaEs($eh->getFechaConcreta());
        $grupoId = $eh->getIntercambioGrupoId();

        // Admins/SuperAdmins del centro. SuperAdmin global (sin centro) recibe
        // también para todos los centros.
        $admins = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('u.deleted = :false')
            ->andWhere("(u.roles LIKE :ra OR u.roles LIKE :rsa)")
            ->andWhere('u.centro = :centro OR u.centro IS NULL')
            ->setParameter('false', false)
            ->setParameter('ra', '%ROLE_ADMIN%')
            ->setParameter('rsa', '%ROLE_SUPERADMIN%')
            ->setParameter('centro', $centro)
            ->getQuery()->getResult();

        foreach ($admins as $admin) {
            // Evita auto-notificación si el solicitante también es admin
            // (caso sara, admin+profe). Si el admin solicita, ya sabe.
            if ($solicitanteId !== null && $admin->getId() === $solicitanteId) continue;
            // Dedupe por intercambioGrupoId: el solicitante puede generar
            // varias EH PENDIENTE en un mismo batch (cara A + N caras B en
            // multi-bloque, + duplicación por clases gemelas). Sin esto
            // cada admin recibe N notifs idénticas (caso real reportado).
            if ($this->yaNotificadoPorIntercambioGrupoId($admin, 'excepcion_pendiente', $grupoId)) continue;
            $this->createPersist($admin, [
                'tipo'    => 'excepcion_pendiente',
                'titulo'  => 'Nueva incidencia pendiente',
                'mensaje' => sprintf(
                    '%s ha solicitado una %s para el %s.',
                    $solicitanteNombre, $this->labelTipoExcepcion($tipo), $fecha
                ),
                'enlace'  => '/admin/incidencias',
                'payload' => [
                    'excepcionId'        => $eh->getId(),
                    'tipo'               => $tipo,
                    'fecha'              => $eh->getFechaConcreta()?->format('Y-m-d'),
                    'solicitanteId'      => $solicitanteId,
                    'solicitanteNombre'  => $solicitanteNombre,
                    'intercambioGrupoId' => $grupoId,
                ],
            ]);
        }
    }

    /**
     * Notifica al solicitante el resultado de su petición (APROBADA o
     * RECHAZADA). Se llama desde el subscriber al detectar transición de
     * estado en preUpdate.
     */
    public function notifyExcepcionResuelta(ExcepcionHorario $eh, bool $aprobada): void
    {
        $solicitante = $eh->getSolicitadaPor();
        if ($solicitante === null) return;

        $tipo = $eh->getTipo()?->value ?? '?';
        $fecha = $this->fmtFechaEs($eh->getFechaConcreta());
        $aprobador = $eh->getAprobadaPor();
        // Admin atajo: si solicitante = aprobador (admin creó aprobada directa
        // o admin aprobó su propia solicitud), no auto-notificar. Sería spam.
        if ($aprobador !== null && $solicitante->getId() === $aprobador->getId()) {
            return;
        }
        $aprobadorNombre = $aprobador
            ? trim(($aprobador->getNombre() ?? '') . ' ' . ($aprobador->getApellidos() ?? ''))
            : 'Administración';

        $tipoNoti = $aprobada ? 'excepcion_aprobada' : 'excepcion_rechazada';
        $titulo   = $aprobada ? 'Tu incidencia ha sido aprobada' : 'Tu incidencia ha sido rechazada';
        $verbo    = $aprobada ? 'aprobado' : 'rechazado';

        // Dedupe por intercambioGrupoId: cuando la EH se cascadea a clases
        // gemelas o multi-bloque, cada hermana resuelta dispararía otra notif
        // al mismo solicitante con el mismo grupoId — return.
        if ($this->yaNotificadoPorIntercambioGrupoId($solicitante, $tipoNoti, $eh->getIntercambioGrupoId())) {
            return;
        }

        $this->createPersist($solicitante, [
            'tipo'    => $tipoNoti,
            'titulo'  => $titulo,
            'mensaje' => sprintf(
                '%s ha %s tu solicitud de %s para el %s.',
                $aprobadorNombre, $verbo, $this->labelTipoExcepcion($tipo), $fecha
            ),
            'enlace'  => '/horarios',
            'payload' => [
                'excepcionId'        => $eh->getId(),
                'tipo'               => $tipo,
                'fecha'              => $eh->getFechaConcreta()?->format('Y-m-d'),
                'aprobadorId'        => $aprobador?->getId(),
                'aprobadorNombre'    => $aprobadorNombre,
                'respuestaAdmin'     => $eh->getRespuestaAdmin(),
                'intercambioGrupoId' => $eh->getIntercambioGrupoId(),
            ],
        ]);
    }

    /**
     * Notifica al destinatario semántico cuando se crea una incidencia
     * pendiente que le involucra (Topic 1 2026-05-07). El destinatario
     * puede aceptar implícitamente (no hacer nada) o rechazar desde el
     * placement de su /horarios. El enlace lleva directamente a la fecha
     * concreta + el id de la excepción para auto-abrir el modal.
     *
     * Quién recibe:
     *   - SUSTITUCION / EVENTO_ESPECIAL → profeOverride.
     *   - INTERCAMBIO → imparticionEfectiva.profesor.
     *   - CANCELADO → nadie (no hay destinatario semántico).
     */
    public function notifyIncidenciaPropuesta(ExcepcionHorario $eh): void
    {
        $tipo = $eh->getTipo();
        $destinatario = match (true) {
            $tipo === TipoExcepcion::SUSTITUCION,
            $tipo === TipoExcepcion::EVENTO_ESPECIAL => $eh->getProfeOverride(),
            $tipo === TipoExcepcion::INTERCAMBIO     => $eh->getImparticionEfectiva()?->getProfesor(),
            default => null,
        };
        if ($destinatario === null) {
            return;
        }
        // Evita notificar al solicitante si por alguna razón coincide
        // (caso edge, p.ej. admin se asigna a sí mismo como sustituto).
        $solicitanteId = $eh->getSolicitadaPor()?->getId();
        if ($solicitanteId !== null && $solicitanteId === $destinatario->getId()) {
            return;
        }
        // Dedupe por intercambioGrupoId: clases gemelas + multi-bloque crean
        // varias EH con el mismo grupoId apuntando al mismo destinatario
        // semántico. Sin este guard el profe recibiría N notifs idénticas.
        if ($this->yaNotificadoPorIntercambioGrupoId($destinatario, 'incidencia_propuesta', $eh->getIntercambioGrupoId())) {
            return;
        }

        $solicitante = $eh->getSolicitadaPor();
        $solicitanteNombre = $solicitante
            ? trim(($solicitante->getNombre() ?? '') . ' ' . ($solicitante->getApellidos() ?? ''))
            : 'Un profesor';

        $hb = $eh->getHorarioBase();
        $imp = $eh->getImparticionEfectiva() ?? $hb?->getImparticion();
        $materia = $imp?->getMateria()?->getNombre() ?? '?';
        $grupo = $imp?->getGrupo();
        $grupoLabel = $grupo
            ? trim(($grupo->getCurso() ? $grupo->getCurso() . 'º ' : '') . ($grupo->getAbreviatura() ?? $grupo->getNombre() ?? ''))
            : '?';
        $fechaIso = $eh->getFechaConcreta()?->format('Y-m-d');
        $fechaEs  = $this->fmtFechaEs($eh->getFechaConcreta());
        $hora = $hb
            ? trim(sprintf('%s-%s', $hb->getHoraInicio()?->format('H:i') ?? '', $hb->getHoraFin()?->format('H:i') ?? ''))
            : '';

        $this->createPersist($destinatario, [
            'tipo'    => 'incidencia_propuesta',
            'titulo'  => 'Te han propuesto un cambio de horario',
            'mensaje' => sprintf(
                '%s te propone una %s para el %s (%s · %s, %s).',
                $solicitanteNombre, $this->labelTipoExcepcion($tipo?->value ?? '?'), $fechaEs, $materia, $grupoLabel, $hora
            ),
            'enlace'  => sprintf('/horarios?fecha=%s&excepcion=%d', $fechaIso ?? '', $eh->getId() ?? 0),
            'payload' => [
                'excepcionId'        => $eh->getId(),
                'tipo'               => $tipo?->value,
                'fecha'              => $fechaIso,
                'hora'               => $hora,
                'materia'            => $materia,
                'grupo'              => $grupoLabel,
                'solicitanteId'      => $solicitanteId,
                'solicitanteNombre'  => $solicitanteNombre,
                'intercambioGrupoId' => $eh->getIntercambioGrupoId(),
            ],
        ]);
    }

    /**
     * Notifica al profe sustituto que tiene una clase asignada por una
     * incidencia aprobada. Solo aplica si `profeOverride` está definido.
     */
    public function notifySustitucionAsignada(ExcepcionHorario $eh): void
    {
        $sustituto = $eh->getProfeOverride();
        if ($sustituto === null) return;

        // Dedupe por intercambioGrupoId: clases gemelas / multi-bloque
        // cascadean varias EH con el mismo grupoId apuntando al mismo
        // sustituto — return tras la primera notif.
        if ($this->yaNotificadoPorIntercambioGrupoId($sustituto, 'sustitucion_asignada', $eh->getIntercambioGrupoId())) {
            return;
        }

        $hb = $eh->getHorarioBase();
        $imp = $hb?->getImparticion();
        $materia = $imp?->getMateria()?->getNombre() ?? '?';
        $grupo = $imp?->getGrupo();
        $grupoLabel = $grupo
            ? trim(($grupo->getCurso() ? $grupo->getCurso() . 'º ' : '') . ($grupo->getAbreviatura() ?? $grupo->getNombre() ?? ''))
            : '?';
        $fecha = $this->fmtFechaEs($eh->getFechaConcreta());
        $hora = $hb
            ? trim(sprintf('%s-%s', $hb->getHoraInicio()?->format('H:i') ?? '', $hb->getHoraFin()?->format('H:i') ?? ''))
            : '';

        $this->createPersist($sustituto, [
            'tipo'    => 'sustitucion_asignada',
            'titulo'  => 'Te han asignado una sustitución',
            'mensaje' => sprintf(
                'El %s a las %s tienes que cubrir %s en %s.',
                $fecha, $hora, $materia, $grupoLabel
            ),
            'enlace'  => '/horarios',
            'payload' => [
                'excepcionId'        => $eh->getId(),
                'fecha'              => $eh->getFechaConcreta()?->format('Y-m-d'),
                'hora'               => $hora,
                'materia'            => $materia,
                'grupo'              => $grupoLabel,
                'motivo'             => $eh->getMotivo(),
                'intercambioGrupoId' => $eh->getIntercambioGrupoId(),
            ],
        ]);
    }

    /**
     * Notifica a los alumnos del grupo afectado por una incidencia aprobada.
     * Tipo `clase_cancelada` si CANCELADO; `clase_trasladada` para el resto.
     */
    public function notifyAlumnosCambioClase(ExcepcionHorario $eh): void
    {
        $hb = $eh->getHorarioBase();
        $imp = $hb?->getImparticion();
        $grupo = $imp?->getGrupo();
        if ($grupo === null) return;

        $tipoEh = $eh->getTipo();
        $isCancel = $tipoEh === TipoExcepcion::CANCELADO;
        $tipoNoti = $isCancel ? 'clase_cancelada' : 'clase_trasladada';
        $titulo   = $isCancel ? 'Una clase ha sido cancelada' : 'Una clase ha cambiado';

        $materia = $imp?->getMateria()?->getNombre() ?? '?';
        $fecha = $this->fmtFechaEs($eh->getFechaConcreta());
        $hora = $hb
            ? trim(sprintf('%s-%s', $hb->getHoraInicio()?->format('H:i') ?? '', $hb->getHoraFin()?->format('H:i') ?? ''))
            : '';

        $detalle = $isCancel
            ? sprintf('La clase de %s del %s a las %s no se impartirá.', $materia, $fecha, $hora)
            : ($tipoEh === TipoExcepcion::EVENTO_ESPECIAL
                ? sprintf('La clase de %s del %s a las %s se sustituye por: %s.', $materia, $fecha, $hora, $eh->getMotivo() ?: 'evento especial')
                : sprintf('La clase de %s del %s a las %s tendrá un cambio puntual.', $materia, $fecha, $hora)
            );

        $matriculas = $this->em->getRepository(Matricula::class)->createQueryBuilder('m')
            ->andWhere('m.grupo = :grupo')
            ->andWhere('m.deleted = :false')
            ->setParameter('grupo', $grupo)
            ->setParameter('false', false)
            ->getQuery()->getResult();

        foreach ($matriculas as $matricula) {
            $alumno = $matricula->getAlumno();
            if ($alumno === null) continue;
            $this->createPersist($alumno, [
                'tipo'    => $tipoNoti,
                'titulo'  => $titulo,
                'mensaje' => $detalle,
                'enlace'  => '/horarios',
                'payload' => [
                    'excepcionId' => $eh->getId(),
                    'tipo'        => $tipoEh?->value,
                    'fecha'       => $eh->getFechaConcreta()?->format('Y-m-d'),
                    'hora'        => $hora,
                    'materia'     => $materia,
                    'motivo'      => $eh->getMotivo(),
                ],
            ]);
        }
    }

    /**
     * Notifica a los admins/superadmins del centro cuando otro admin crea
     * una incidencia APROBADA directa desde /admin/horarios. Complementa
     * `notifyExcepcionPendiente` (que cubre el flow del profe puro). Sin
     * esto los otros admins del centro no se enteran porque la rejilla
     * `/admin/horarios` no avisa de cambios hechos por terceros.
     *
     * Dedupe por intercambioGrupoId: clases gemelas cascadean varias EH
     * con el mismo grupoId; cada admin debe recibir 1 sola notif por
     * intercambio.
     */
    public function notifyExcepcionAprobadaDirecta(ExcepcionHorario $eh): void
    {
        $centro = $eh->getHorarioBase()?->getImparticion()?->getGrupo()?->getCentro();
        if ($centro === null) return;

        $solicitante = $eh->getSolicitadaPor();
        $solicitanteId = $solicitante?->getId();
        $solicitanteNombre = $solicitante
            ? trim(($solicitante->getNombre() ?? '') . ' ' . ($solicitante->getApellidos() ?? ''))
            : 'Un administrador';

        $tipo = $eh->getTipo()?->value ?? '?';
        $fecha = $this->fmtFechaEs($eh->getFechaConcreta());
        $grupoId = $eh->getIntercambioGrupoId();

        // Misma cascada que notifyExcepcionPendiente: admins del centro +
        // SuperAdmins globales (u.centro IS NULL).
        $admins = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('u.deleted = :false')
            ->andWhere("(u.roles LIKE :ra OR u.roles LIKE :rsa)")
            ->andWhere('u.centro = :centro OR u.centro IS NULL')
            ->setParameter('false', false)
            ->setParameter('ra', '%ROLE_ADMIN%')
            ->setParameter('rsa', '%ROLE_SUPERADMIN%')
            ->setParameter('centro', $centro)
            ->getQuery()->getResult();

        foreach ($admins as $admin) {
            if ($solicitanteId !== null && $admin->getId() === $solicitanteId) continue;
            if ($this->yaNotificadoPorIntercambioGrupoId($admin, 'excepcion_aprobada_directa', $grupoId)) continue;
            $this->createPersist($admin, [
                'tipo'    => 'excepcion_aprobada_directa',
                'titulo'  => 'Incidencia aprobada en tu centro',
                'mensaje' => sprintf(
                    '%s ha creado una %s aprobada para el %s.',
                    $solicitanteNombre, $this->labelTipoExcepcion($tipo), $fecha
                ),
                'enlace'  => '/admin/incidencias',
                'payload' => [
                    'excepcionId'        => $eh->getId(),
                    'tipo'               => $tipo,
                    'fecha'              => $eh->getFechaConcreta()?->format('Y-m-d'),
                    'solicitanteId'      => $solicitanteId,
                    'solicitanteNombre'  => $solicitanteNombre,
                    'intercambioGrupoId' => $grupoId,
                ],
            ]);
        }
    }

    /**
     * Dedupe por `intercambioGrupoId` para notificaciones cascadeables.
     * `HorarioGemeloSyncSubscriber` duplica `ExcepcionHorario` para cada
     * hermano de un placement gemelo, y `IntercambioController` crea N
     * caras (A + N caras B) en multi-bloque; todas comparten
     * `intercambioGrupoId`. Sin este guard el destinatario recibiría N
     * notifs idénticas.
     *
     * Doble nivel:
     *  1. Memoria in-process (`$emitidasEsteRequest`): captura las notifs
     *     emitidas en este batch que aún no se han flushed. Necesario para
     *     que la segunda EH de un mismo grupoId no vuelva a emitir.
     *  2. DQL LIKE sobre `payload` (columna Doctrine `json`, `json_encode`
     *     sin espacios; UUID v4 único): captura emisiones de batches
     *     anteriores (raro pero posible si un cron reprocesa). Si se
     *     encuentra, cachea la clave en la memoria in-process.
     */
    private function yaNotificadoPorIntercambioGrupoId(User $destinatario, string $tipo, ?string $grupoId): bool
    {
        if ($grupoId === null || $grupoId === '') {
            return false;
        }
        $key = $this->dedupeKey($destinatario, $tipo, $grupoId);
        if (isset($this->emitidasEsteRequest[$key])) {
            return true;
        }
        $existing = $this->em->getRepository(Notificacion::class)->createQueryBuilder('n')
            ->andWhere('n.usuario = :usuario')
            ->andWhere('n.tipo = :tipo')
            ->andWhere('n.payload LIKE :pattern')
            ->setParameter('usuario', $destinatario)
            ->setParameter('tipo', $tipo)
            ->setParameter('pattern', '%"intercambioGrupoId":"' . $grupoId . '"%')
            ->setMaxResults(1)
            ->getQuery()->getOneOrNullResult();
        if ($existing !== null) {
            $this->emitidasEsteRequest[$key] = true;
            return true;
        }
        return false;
    }

    private function dedupeKey(User $destinatario, string $tipo, string $grupoId): string
    {
        return sprintf('%s|%d|%s', $tipo, $destinatario->getId() ?? 0, $grupoId);
    }

    private function labelTipoExcepcion(string $tipo): string
    {
        return match ($tipo) {
            'sustitucion'     => 'sustitución',
            'cancelado'       => 'cancelación',
            'evento_especial' => 'evento especial',
            'intercambio'     => 'intercambio',
            default           => 'incidencia',
        };
    }

    /**
     * Persiste sin flush. El flush lo hace el subscriber en `postFlush` para
     * evitar flush-dentro-de-flush durante un postPersist en cadena.
     *
     * @param array{tipo:string, titulo:string, mensaje?:string, enlace?:string, payload?:array} $data
     */
    private function createPersist(User $usuario, array $data): void
    {
        $n = (new Notificacion())
            ->setUsuario($usuario)
            ->setTipo($data['tipo'])
            ->setTitulo($data['titulo'])
            ->setMensaje($data['mensaje'] ?? null)
            ->setEnlace($data['enlace'] ?? null)
            ->setPayload($data['payload'] ?? null);
        $this->em->persist($n);

        // Registro in-process para que `yaNotificadoPorIntercambioGrupoId`
        // vea esta emisión en la siguiente llamada del mismo batch (antes
        // del flush). Sólo aplica a notifs cascadeables (con grupoId).
        $grupoId = $data['payload']['intercambioGrupoId'] ?? null;
        if (is_string($grupoId) && $grupoId !== '') {
            $this->emitidasEsteRequest[$this->dedupeKey($usuario, $data['tipo'], $grupoId)] = true;
        }
    }

    private function fmtNota(?float $nota): string
    {
        if ($nota === null) {
            return '–';
        }
        $rounded = round($nota, 2);
        // Sin decimales si es entero, hasta 2 decimales si no.
        return $rounded == (int) $rounded ? (string) (int) $rounded : rtrim(rtrim((string) $rounded, '0'), '.');
    }

    /**
     * Formatea una fecha como "Lun 04/05/2026" para textos USER-FACING de
     * notificaciones (titulo/mensaje). Día de la semana abreviado en
     * español + dd/mm/yyyy. Espejo del helper frontend
     * `useFormattedNotifTime` en `SystemNotificationsList.jsx` — alinea el
     * formato dentro del cuerpo de las notificaciones con el que se
     * muestra junto a cada item en la lista.
     *
     * Para fechas que van al `payload` (claves ISO `Y-m-d` o ATOM) seguir
     * usando los `format()` directos: el payload es para procesamiento del
     * cliente, no display. Solo el texto humano debe pasar por aquí.
     */
    private const DIAS_ES_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    private function fmtFechaEs(?\DateTimeInterface $d): string
    {
        if ($d === null) {
            return '?';
        }
        return sprintf('%s %s', self::DIAS_ES_ABREV[(int) $d->format('w')], $d->format('d/m/Y'));
    }
}
