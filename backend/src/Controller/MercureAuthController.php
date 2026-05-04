<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\ImparticionRepository;
use App\Repository\MatriculaRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\Jwt\TokenFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Firma un JWT con los topics a los que el usuario puede suscribirse y lo
 * guarda en la cookie `mercureAuthorization`. El hub Mercure la valida al abrir
 * la conexión SSE.
 *
 * No usamos Authorization::setCookie del bundle porque exige que el dominio
 * del request coincida con el SLD de MERCURE_PUBLIC_URL (configurado a
 * localhost). Eso rompe cuando la app se accede vía túnel (ngrok) o cualquier
 * otro dominio. Aquí componemos cookie + URL del hub con el host actual del
 * request, así funciona para cualquier origen.
 *
 * Convenciones de topics:
 *   /users/{id}/messages           -> nuevos mensajes y cambios de leído
 *   /users/{id}/notifications      -> notificaciones agregadas
 *   /users/{id}/stats              -> contadores del Home
 *   /grupos/{gid}/schedule         -> cambios de horario del grupo (alumnos + profe del grupo)
 *   /centros/{id}/comunicados      -> comunicados del centro (broadcast)
 *   /global/comunicados            -> comunicados globales (todos los usuarios)
 *   /admin/centros/{cid}/{rec}     -> live updates de vistas admin del centro
 *   /imparticiones/{id}/entregas   -> entregas de una imparticion (solo su profesor)
 */
class MercureAuthController extends AbstractController
{
    // El bundle expone la factory sólo bajo alias con nombre ($defaultFactory).
    public function __construct(
        private readonly TokenFactoryInterface $defaultFactory,
        private readonly ImparticionRepository $imparticionRepo,
        private readonly MatriculaRepository $matriculaRepo,
    ) {
    }

    #[Route('/api/me/mercure-subscribe', name: 'api_me_mercure_subscribe', methods: ['POST'])]
    public function subscribe(Request $request, #[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $userId = $user->getId();
        $topics = [
            "/users/{$userId}/messages",
            "/users/{$userId}/notifications",
            "/users/{$userId}/stats",
            // Comunicados globales: cualquier usuario autenticado los recibe.
            '/global/comunicados',
        ];

        $centro = $user->getCentro();
        if ($centro) {
            $topics[] = "/centros/{$centro->getId()}/comunicados";
        }

        $roles = $user->getRoles();
        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $roles, true);
        $isAdmin = $isSuperAdmin || in_array('ROLE_ADMIN', $roles, true);

        // Topics admin: URI templates RFC 6570. `{rec}` matchea cualquier
        // segmento (imparticiones, matriculas, grupos, itinerarios, …).
        if ($isSuperAdmin) {
            // Superadmin: cualquier centro, cualquier recurso.
            $topics[] = '/admin/centros/{cid}/{rec}';
            // Top-level admin (p.ej. /admin/centros, /admin/festivos, /admin/usuarios…).
            $topics[] = '/admin/{rec}';
            // Cualquier grupo schedule (p.ej. HorariosConsumicion ve cualquier grupo).
            $topics[] = '/grupos/{gid}/schedule';
        } elseif ($isAdmin && $centro) {
            // Admin de centro: solo SU centro.
            $topics[] = "/admin/centros/{$centro->getId()}/{rec}";
            // Topics admin globales (no por centro): festivos NACIONALES/AUTO/PROV
            // que aplican al centro vía cascada en backend, comunicados globales, …
            $topics[] = '/admin/{rec}';
            // Schedule de cualquier grupo: el admin puede abrir HorariosConsumicion
            // para grupos donde no imparte. Nota: el subscriber-side (frontend) solo
            // se suscribe al grupo viewing; los datos están protegidos en GET por
            // CurrentUserExtension.
            $topics[] = '/grupos/{gid}/schedule';
        }

        // Topics por imparticion del profesor: vista Entregas.jsx por imparticion.
        // Listamos los IDs porque firmar `/imparticiones/{id}/entregas` (URI template)
        // dejaría a CUALQUIER user suscribirse a CUALQUIER imparticion — fuga de datos.
        // Tradeoff: para profes con muchas imparticiones (>20) el JWT crece notablemente
        // (~30B por id). Aceptable; si se vuelve problemático, mover a sub-cookie o
        // endpoint dedicado por imparticion.
        $impIds = $this->imparticionRepo->createQueryBuilder('i')
            ->select('i.id, IDENTITY(i.grupo) AS gid')
            ->where('i.profesor = :user')
            ->andWhere('i.deleted = false')
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();

        $grupoIds = [];
        foreach ($impIds as $row) {
            $topics[] = "/imparticiones/{$row['id']}/entregas";
            if ($row['gid']) {
                $grupoIds[$row['gid']] = true;
            }
        }

        // Topics por grupo del usuario: cambios de horario (Horario entity publica a
        // /grupos/{gid}/schedule). Los alumnos los reciben vía sus matrículas.
        $alumnoGrupoIds = $this->matriculaRepo->createQueryBuilder('m')
            ->select('IDENTITY(m.grupo) AS gid')
            ->where('m.alumno = :user')
            ->andWhere('m.deleted = false')
            ->setParameter('user', $user)
            ->getQuery()
            ->getSingleColumnResult();
        foreach ($alumnoGrupoIds as $gid) {
            if ($gid) {
                $grupoIds[$gid] = true;
            }
        }
        foreach (array_keys($grupoIds) as $gid) {
            $topics[] = "/grupos/{$gid}/schedule";
        }

        // URL pública del hub relativa al host actual del request. Así Caddy
        // enruta la conexión SSE a través del mismo origen que la app.
        $hubPublicUrl = sprintf(
            '%s://%s/.well-known/mercure',
            $request->getScheme(),
            $request->getHttpHost(),
        );

        // JWT con el claim mercure.subscribe firmado con MERCURE_JWT_SECRET.
        $jwt = $this->defaultFactory->create($topics);

        // Cookie: HttpOnly, SameSite=Strict (misma-origen), Secure si HTTPS.
        // Path acotado al hub para no exponerla a otros endpoints.
        $cookie = Cookie::create('mercureAuthorization')
            ->withValue($jwt)
            ->withPath('/.well-known/mercure')
            ->withHttpOnly(true)
            ->withSameSite(Cookie::SAMESITE_STRICT)
            ->withSecure($request->isSecure())
            ->withExpires(new \DateTimeImmutable('+1 hour'));

        $response = $this->json([
            'topics' => $topics,
            'hubPublicUrl' => $hubPublicUrl,
        ]);
        $response->headers->setCookie($cookie);

        return $response;
    }
}
