<?php

namespace App\Doctrine\Filter;

use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

class SoftDeleteFilter extends SQLFilter
{
    public function addFilterConstraint(ClassMetadata $targetEntity, $targetTableAlias): string
    {
        // Verificar si la entidad tiene el campo 'deleted'
        if (!$targetEntity->hasField('deleted')) {
            return '';
        }

        return sprintf('%s.deleted = false', $targetTableAlias);
    }
}
