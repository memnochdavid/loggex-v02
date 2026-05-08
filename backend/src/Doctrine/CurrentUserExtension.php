<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Extension\QueryItemExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\Calificacion;
use App\Entity\ExcepcionHorario;
use App\Entity\Itinerario;
use App\Entity\Comunicado;
use App\Entity\Entrega;
use App\Entity\Festivo;
use App\Entity\Mensaje;
use App\Entity\Materia;
use App\Entity\Notificacion;
use App\Entity\Tarea;
use App\Entity\User;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\RequestStack;

final class CurrentUserExtension implements QueryCollectionExtensionInterface, QueryItemExtensionInterface
{
    public function __construct(
        private readonly Security $security,
        private readonly RequestStack $requestStack
    ) {
    }

    public function applyToCollection(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass, true);
    }

    public function applyToItem(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, array $identifiers, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass, false);
    }

    private function addWhere(QueryBuilder $queryBuilder, string $resourceClass, bool $isCollection): void
    {
        $supportedClasses = [
            User::class,
            Itinerario::class,
            Materia::class,
            Festivo::class,
            Mensaje::class,
            Tarea::class,
            Entrega::class,
            Calificacion::class,
            Comunicado::class,
            Notificacion::class,
            ExcepcionHorario::class,
        ];

        if (!in_array($resourceClass, $supportedClasses)) {
            return;
        }

        $user = $this->security->getUser();

        if (!$user instanceof User || in_array('ROLE_SUPER_ADMIN', $user->getRoles()) || in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];

        // Lógica específica para Mensajes
        if ($resourceClass === Mensaje::class) {
            $queryBuilder->andWhere(sprintf('%s.remitente = :current_user_id OR %s.destinatario = :current_user_id', $rootAlias, $rootAlias))
                ->setParameter('current_user_id', $user->getId());
            return;
        }

        // Notificaciones — cada usuario solo ve las suyas. SuperAdmin queda
        // exento del filtro por el early return de arriba.
        if ($resourceClass === Notificacion::class) {
            $queryBuilder->andWhere(sprintf('%s.usuario = :current_user_id', $rootAlias))
                ->setParameter('current_user_id', $user->getId());
            return;
        }

        // Lógica específica para Tareas
        if ($resourceClass === Tarea::class) {
            $this->addWhereTarea($queryBuilder, $user, $rootAlias);
            return;
        }

        // Lógica específica para Entregas
        if ($resourceClass === Entrega::class) {
            $this->addWhereEntrega($queryBuilder, $user, $rootAlias);
            return;
        }

        // Lógica específica para Calificaciones
        if ($resourceClass === Calificacion::class) {
            $this->addWhereCalificacion($queryBuilder, $user, $rootAlias);
            return;
        }

        // Lógica específica para Excepciones de horario.
        // Admin del centro: cascada vía horarioBase.imparticion.grupo.centro.
        // Profe puro: las que le tocan (solicitante / sustituto / titular del placement).
        if ($resourceClass === ExcepcionHorario::class) {
            $this->addWhereExcepcionHorario($queryBuilder, $user, $rootAlias);
            return;
        }

        // Lógica específica para Comunicados
        if ($resourceClass === Comunicado::class) {
            if ($user->getCentro()) {
                $queryBuilder->andWhere(sprintf('%s.global = :is_global OR %s.centro = :current_centro', $rootAlias, $rootAlias))
                    ->setParameter('current_centro', $user->getCentro())
                    ->setParameter('is_global', true);
            } else {
                $queryBuilder->andWhere(sprintf('%s.global = :is_global', $rootAlias))
                    ->setParameter('is_global', true);
            }
            return;
        }

        // Si es Admin de centro (o cualquier usuario de centro), filtrar por su centro
        if (method_exists($user, 'getCentro') && $user->getCentro()) {
            if ($resourceClass === Materia::class) {
                // Materia ↔ Itinerario es M:N tras 2026-05-08. Una materia visible
                // si AL MENOS UNO de sus itinerarios pertenece al centro del user.
                // Subquery EXISTS para evitar duplicar filas (un join + groupBy
                // también valdría pero rompería paginación de API Platform).
                $queryBuilder->andWhere(sprintf(
                    'EXISTS (SELECT 1 FROM %s _mi'
                        . ' JOIN _mi.itinerarios _i'
                        . ' WHERE _mi = %s AND _i.centro = :current_centro)',
                    Materia::class,
                    $rootAlias,
                ))
                    ->setParameter('current_centro', $user->getCentro());
            } else {
                if ($resourceClass === Festivo::class) {
                    // Cascada de aplicabilidad por configuración del centro:
                    //   NACIONAL                                   → siempre.
                    //   AUTONOMICO ccaa = centro.ccaa              → solo si la CCAA coincide.
                    //   PROVINCIAL provincia = centro.provincia    → solo si la provincia coincide.
                    //   LOCAL centro = centro_actual               → solo del propio centro.
                    // Sin esto, un admin de Andalucía vería los 118 autonómicos
                    // de las 19 CCAAs y todos los provinciales sueltos del país.
                    $centro = $user->getCentro();
                    $queryBuilder->andWhere(
                        sprintf(
                            "(%s.ambito = 'nacional')"
                            . " OR (%s.ambito = 'autonomico' AND %s.ccaa = :current_ccaa)"
                            . " OR (%s.ambito = 'provincial' AND %s.provincia = :current_provincia)"
                            . " OR (%s.ambito = 'local' AND %s.centro = :current_centro)",
                            $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias
                        )
                    );
                    $queryBuilder->setParameter('current_centro', $centro);
                    $queryBuilder->setParameter('current_ccaa', $centro->getCcaa()?->value);
                    $queryBuilder->setParameter('current_provincia', $centro->getProvincia());
                } elseif ($resourceClass === User::class && in_array('ROLE_ADMIN', $user->getRoles())) {
                    // Admin de centro ve usuarios de su centro
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro OR %s.centro IS NULL', $rootAlias, $rootAlias))
                                 ->setParameter('current_centro', $user->getCentro());

                    // EXCLUIR SuperAdmins SOLO si es una colección Y no se está buscando explícitamente por ese rol
                    if ($isCollection) {
                        $request = $this->requestStack->getCurrentRequest();
                        $rolesFilter = $request ? $request->query->get('roles') : null;

                        // Si no se está filtrando por rol SUPERADMIN, excluirlos
                        if (!$rolesFilter || !str_contains($rolesFilter, 'SUPERADMIN')) {
                            $queryBuilder->andWhere(sprintf('%s.roles NOT LIKE :superadmin_role', $rootAlias))
                                         ->setParameter('superadmin_role', '%ROLE_SUPERADMIN%');
                        }
                    }
                } else {
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro', $rootAlias));
                    $queryBuilder->setParameter('current_centro', $user->getCentro());
                }
            }
        } else {
            if ($resourceClass === User::class) {
                $queryBuilder->andWhere(sprintf('%s.id = :current_user', $rootAlias));
                $queryBuilder->setParameter('current_user', $user->getId());
            } else {
                $queryBuilder->andWhere('1 = 0');
            }
        }
    }

    private function addWhereEntrega(QueryBuilder $qb, User $user, string $rootAlias): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            $qb->join(sprintf('%s.tarea', $rootAlias), 'et')
               ->join('et.imparticion', 'ei')
               ->join('ei.grupo', 'eg')
               ->join('eg.itinerario', 'ec')
               ->andWhere('ec.centro = :centro')
               ->setParameter('centro', $user->getCentro());
            return;
        }

        if (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb->join(sprintf('%s.tarea', $rootAlias), 'et')
               ->join('et.imparticion', 'ei')
               ->andWhere('ei.profesor = :user')
               ->setParameter('user', $user);
            return;
        }

        if (in_array('ROLE_ALUMNO', $user->getRoles())) {
            $qb->andWhere(sprintf('%s.alumno = :user', $rootAlias))
               ->setParameter('user', $user);
            return;
        }

        $qb->andWhere('1 = 0');
    }

    private function addWhereCalificacion(QueryBuilder $qb, User $user, string $rootAlias): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            $qb->join(sprintf('%s.entrega', $rootAlias), 'ce')
               ->join('ce.tarea', 'ct')
               ->join('ct.imparticion', 'ci')
               ->join('ci.grupo', 'cg')
               ->join('cg.itinerario', 'cc')
               ->andWhere('cc.centro = :centro')
               ->setParameter('centro', $user->getCentro());
            return;
        }

        if (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb->join(sprintf('%s.entrega', $rootAlias), 'ce')
               ->join('ce.tarea', 'ct')
               ->join('ct.imparticion', 'ci')
               ->andWhere('ci.profesor = :user')
               ->setParameter('user', $user);
            return;
        }

        if (in_array('ROLE_ALUMNO', $user->getRoles())) {
            $qb->join(sprintf('%s.entrega', $rootAlias), 'ce')
               ->andWhere('ce.alumno = :user')
               ->setParameter('user', $user);
            return;
        }

        $qb->andWhere('1 = 0');
    }

    /**
     * Filtro Excepciones de horario por rol (D-C 2026-05-07):
     *   - Admin de centro: todas las del centro vía cadena
     *     horarioBase.imparticion.grupo.centro = miCentro.
     *   - Profe puro: solo las que le tocan: solicitadaPor=self OR
     *     profeOverride=self OR horarioBase.imparticion.profesor=self.
     *   - Alumno: ninguna por API directa (Fase A); las verá vía notificaciones
     *     y composición de su propio horario.
     */
    private function addWhereExcepcionHorario(QueryBuilder $qb, User $user, string $rootAlias): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            $qb->join(sprintf('%s.horarioBase', $rootAlias), 'eh_h')
               ->join('eh_h.imparticion', 'eh_i')
               ->join('eh_i.grupo', 'eh_g')
               ->andWhere('eh_g.centro = :centro')
               ->setParameter('centro', $user->getCentro());
            return;
        }

        if (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb->join(sprintf('%s.horarioBase', $rootAlias), 'eh_h')
               ->join('eh_h.imparticion', 'eh_i')
               ->andWhere(sprintf(
                   '%s.solicitadaPor = :user OR %s.profeOverride = :user OR eh_i.profesor = :user',
                   $rootAlias, $rootAlias
               ))
               ->setParameter('user', $user);
            return;
        }

        $qb->andWhere('1 = 0');
    }

    private function addWhereTarea(QueryBuilder $qb, User $user, string $rootAlias): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->join('i.grupo', 'g')
               ->join('g.itinerario', 'c')
               ->andWhere('c.centro = :centro')
               ->setParameter('centro', $user->getCentro());
            return;
        }

        if (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->andWhere('i.profesor = :user')
               ->setParameter('user', $user);
            return;
        }

        if (in_array('ROLE_ALUMNO', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->join('i.grupo', 'g')
               ->join('g.matriculas', 'm')
               ->andWhere('m.alumno = :user')
               ->setParameter('user', $user)
               ->andWhere(sprintf('%s.visible = true', $rootAlias));
            return;
        }
    }
}
