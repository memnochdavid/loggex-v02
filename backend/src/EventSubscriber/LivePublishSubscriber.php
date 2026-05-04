<?php

namespace App\EventSubscriber;

use App\Attribute\LivePublish;
use App\Message\PublishMercureUpdate;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostRemoveEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\ExpressionLanguage\ExpressionLanguage;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Component\PropertyAccess\PropertyAccessorInterface;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Doctrine listener genérico: para cualquier entidad marcada con #[LivePublish],
 * publica un update Mercure tras cada postPersist/postUpdate/postRemove.
 *
 * Payload publicado:
 *   {
 *     "type":   "persist" | "update" | "remove",
 *     "entity": "Comunicado",       // class short name
 *     "id":     123,
 *     "data":   { ... } | null      // serialización con payloadGroups (null en remove)
 *   }
 *
 * El despacho va al bus async (Redis), así que no bloquea el flush HTTP.
 *
 * Cache estática del atributo por clase para no leer reflexión en cada flush.
 */
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::postUpdate)]
#[AsDoctrineListener(event: Events::postRemove)]
class LivePublishSubscriber
{
    /** @var array<class-string, LivePublish|false> false = clase sin atributo */
    private static array $attrCache = [];

    private PropertyAccessorInterface $accessor;
    private ?ExpressionLanguage $expressionLanguage = null;

    public function __construct(
        private readonly MessageBusInterface $bus,
        private readonly SerializerInterface $serializer,
    ) {
        $this->accessor = PropertyAccess::createPropertyAccessor();
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $this->dispatch($args->getObject(), 'persist');
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $this->dispatch($args->getObject(), 'update');
    }

    public function postRemove(PostRemoveEventArgs $args): void
    {
        $this->dispatch($args->getObject(), 'remove');
    }

    private function dispatch(object $entity, string $event): void
    {
        $attr = $this->resolveAttribute($entity::class);
        if (!$attr) {
            return;
        }

        $topicTemplates = match ($event) {
            'persist' => $attr->topicsForPersist(),
            'update'  => $attr->topicsForUpdate(),
            'remove'  => $attr->topicsForRemove(),
        };
        if (!$topicTemplates) {
            return;
        }

        $expanded = [];
        foreach ($topicTemplates as $tpl) {
            $t = $this->expand($tpl, $entity);
            if ($t !== null) {
                $expanded[] = $t;
            }
        }

        // Topics condicionales: evalúa cada expresión y, si es truthy,
        // añade los topics correspondientes (también con expansión de placeholders).
        foreach ($attr->topicsConditional as $expression => $conditionalTopics) {
            if (!$this->evaluateCondition($expression, $entity)) {
                continue;
            }
            foreach ($conditionalTopics as $tpl) {
                $t = $this->expand($tpl, $entity);
                if ($t !== null) {
                    $expanded[] = $t;
                }
            }
        }

        if (!$expanded) {
            return;
        }

        $id = method_exists($entity, 'getId') ? $entity->getId() : null;

        $data = null;
        if ($event !== 'remove' && $attr->payloadGroups) {
            try {
                $data = json_decode(
                    $this->serializer->serialize($entity, 'json', ['groups' => $attr->payloadGroups]),
                    true,
                );
            } catch (\Throwable) {
                // Falla de serialización (relación lazy fuera de scope, etc.) → enviamos sin data.
                $data = null;
            }
        }

        $payload = json_encode([
            'type'   => $event,
            'entity' => (new \ReflectionClass($entity))->getShortName(),
            'id'     => $id,
            'data'   => $data,
        ]);

        $this->bus->dispatch(new PublishMercureUpdate($expanded, $payload, $attr->private));
    }

    private function resolveAttribute(string $class): ?LivePublish
    {
        if (array_key_exists($class, self::$attrCache)) {
            return self::$attrCache[$class] ?: null;
        }
        $ref = new \ReflectionClass($class);
        $attrs = $ref->getAttributes(LivePublish::class);
        $attr = $attrs ? $attrs[0]->newInstance() : false;
        self::$attrCache[$class] = $attr;
        return $attr ?: null;
    }

    /**
     * Evalúa una expresión ExpressionLanguage con la variable `entity`.
     * Cualquier excepción durante la evaluación se trata como falso (fail-safe:
     * mejor no publicar que publicar con condición rota).
     */
    private function evaluateCondition(string $expression, object $entity): bool
    {
        $this->expressionLanguage ??= new ExpressionLanguage();
        try {
            return (bool) $this->expressionLanguage->evaluate($expression, ['entity' => $entity]);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Expande placeholders `{prop}` y `{prop.sub.subsub}` con valores de la entidad
     * vía PropertyAccess. Si algún placeholder no resuelve (excepción o null),
     * devuelve null y el topic se descarta.
     */
    private function expand(string $template, object $entity): ?string
    {
        if (!str_contains($template, '{')) {
            return $template;
        }

        $failed = false;
        $result = preg_replace_callback(
            '/\{([a-zA-Z0-9_.]+)\}/',
            function (array $m) use ($entity, &$failed) {
                try {
                    $value = $this->accessor->getValue($entity, $m[1]);
                } catch (\Throwable) {
                    $failed = true;
                    return '';
                }
                if ($value === null) {
                    $failed = true;
                    return '';
                }
                return (string) $value;
            },
            $template,
        );

        return $failed ? null : $result;
    }
}
