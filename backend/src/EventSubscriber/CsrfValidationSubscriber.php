<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

/**
 * Valida el header `X-CSRF-Token` en todas las peticiones stateful
 * (POST/PUT/PATCH/DELETE) a `/api/*`.
 *
 * El token se obtiene vía GET `/api/csrf-token` y se envía en cada
 * petición que modifique estado. Sin él, el backend responde 419.
 *
 * Excepciones: login, logout y el propio endpoint de csrf-token.
 */
class CsrfValidationSubscriber implements EventSubscriberInterface
{
    private const EXCLUDED_PATHS = [
        '/api/login',
        '/api/logout',
        '/api/csrf-token',
        '/api/me/mercure-subscribe',
    ];

    public function __construct(
        private readonly CsrfTokenManagerInterface $csrfTokenManager,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            RequestEvent::class => 'onKernelRequest',
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();

        // Solo peticiones stateful a la API
        if (!$request->isMethodCacheable(false) && str_starts_with($request->getPathInfo(), '/api/')) {
            // Excluir login, logout y el propio endpoint de token
            $path = $request->getPathInfo();
            foreach (self::EXCLUDED_PATHS as $excluded) {
                if (str_starts_with($path, $excluded)) {
                    return;
                }
            }

            $token = $request->headers->get('X-CSRF-Token');
            if (!$token) {
                throw new HttpException(419, 'CSRF token missing. Include the X-CSRF-Token header with a valid token from /api/csrf-token.');
            }

            $csrfToken = new CsrfToken('api_stateful', $token);
            if (!$this->csrfTokenManager->isTokenValid($csrfToken)) {
                throw new HttpException(419, 'CSRF token invalid.');
            }
        }
    }
}
