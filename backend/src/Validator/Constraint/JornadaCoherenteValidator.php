<?php

namespace App\Validator\Constraint;

use App\Entity\JornadaTipo;
use App\Service\JornadaTramoValidator;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

class JornadaCoherenteValidator extends ConstraintValidator
{
    public function __construct(
        private readonly JornadaTramoValidator $tramoValidator,
    ) {}

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof JornadaCoherente) {
            throw new UnexpectedTypeException($constraint, JornadaCoherente::class);
        }

        if ($value === null) {
            return;
        }

        if (!$value instanceof JornadaTipo) {
            throw new UnexpectedValueException($value, JornadaTipo::class);
        }

        $errors = $this->tramoValidator->validate($value);
        foreach ($errors as $msg) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ error }}', $msg)
                ->addViolation();
        }
    }
}
