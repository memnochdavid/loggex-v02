<?php

namespace App\Service;

use App\Entity\Calificacion;
use App\Entity\Comunicado;
use App\Entity\Entrega;
use App\Entity\Notificacion;
use App\Entity\Tarea;
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
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Notifica al alumno de la entrega que su calificación está publicada.
     */
    public function notifyCalificacionPublicada(Calificacion $cal): void
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

        $this->createPersist($alumno, [
            'tipo'    => 'calificacion_publicada',
            'titulo'  => 'Tu calificación está disponible',
            'mensaje' => sprintf('Has obtenido %s en "%s".', $this->fmtNota($nota), $tareaTitulo),
            'enlace'  => sprintf('/calificaciones?tarea=%d', $tarea->getId()),
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

        foreach ($grupo->getMatriculas() as $matricula) {
            if ($matricula->isDeleted()) {
                continue;
            }
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
                    $fechaLim ? ' (entrega hasta el ' . $fechaLim->format('d/m/Y') . ')' : ''
                ),
                'enlace'  => sprintf('/tareas/%d', $tarea->getId()),
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
}
