<?php

namespace App\Validator\Constraint;

use Symfony\Component\Validator\Constraint;

/**
 * Constraint a nivel de propiedad para validar NIF español (DNI / NIE / CIF).
 *
 * Espejo del helper frontend `frontend/src/utils/nifValidator.js`. Si cambias
 * el algoritmo aquí, sincronízalo allí.
 *
 * Uso típico en una entidad:
 *   #[NifEspanol(allowEmpty: true)]
 *   private ?string $nif = null;
 *
 * - `allowEmpty=true` permite null/string vacío (campo opcional).
 * - `allowCif=true` (default) acepta también CIF de empresa.
 *   Si la propiedad solo debe ser DNI/NIE de persona física, ponerlo a false.
 */
#[\Attribute(\Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD | \Attribute::IS_REPEATABLE)]
class NifEspanol extends Constraint
{
    // Mensaje en inglés siguiendo el patrón de los Asserts de Symfony
    // (defaults sin custom). El frontend valida primero con
    // `useFormValidation` y la clave i18n `validation.nif`; este mensaje
    // solo se ve si alguien llama al API directo sin pasar por la UI.
    public string $message = 'The NIF "{{ value }}" is not a valid Spanish DNI, NIE or CIF.';
    public bool $allowEmpty = true;
    public bool $allowCif = true;

    /**
     * Constructor explícito para que los named arguments del attribute
     * (`#[NifEspanol(allowEmpty: true)]`) lleguen correctamente. Sin este
     * constructor, Symfony lanza "Unknown named parameter $allowEmpty"
     * porque las propiedades públicas no se cablean automáticamente al
     * pasar argumentos nombrados — patrón estándar Symfony 6.x+.
     */
    public function __construct(
        ?array $options = null,
        ?string $message = null,
        ?bool $allowEmpty = null,
        ?bool $allowCif = null,
        ?array $groups = null,
        mixed $payload = null,
    ) {
        parent::__construct($options ?? [], $groups, $payload);
        $this->message = $message ?? $this->message;
        $this->allowEmpty = $allowEmpty ?? $this->allowEmpty;
        $this->allowCif = $allowCif ?? $this->allowCif;
    }

    public function getTargets(): string
    {
        return self::PROPERTY_CONSTRAINT;
    }
}
