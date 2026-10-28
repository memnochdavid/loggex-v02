<?php

namespace App\Validator;

use App\Validator\Constraint\NifEspanol;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;

/**
 * Validador de NIF español (DNI / NIE / CIF).
 *
 * Lógica espejo del frontend `frontend/src/utils/nifValidator.js` (mismas
 * tablas de control, mismo Luhn modificado para CIF). Si cambias el
 * algoritmo aquí, hazlo también allí.
 */
class NifEspanolValidator extends ConstraintValidator
{
    private const DNI_REGEX = '/^[0-9]{8}[A-Z]$/';
    private const NIE_REGEX = '/^[XYZ][0-9]{7}[A-Z]$/';
    private const CIF_REGEX = '/^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/';
    private const DNI_CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
    private const CIF_CONTROL_LETTERS = 'JABCDEFGHI';

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof NifEspanol) {
            throw new UnexpectedTypeException($constraint, NifEspanol::class);
        }

        if ($value === null || $value === '') {
            if ($constraint->allowEmpty) {
                return;
            }
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ value }}', '')
                ->addViolation();
            return;
        }

        if (!is_string($value)) {
            throw new UnexpectedTypeException($value, 'string');
        }

        $normalized = strtoupper(preg_replace('/[\s-]/', '', trim($value)));

        $valid = self::isValidDni($normalized) || self::isValidNie($normalized);
        if (!$valid && $constraint->allowCif) {
            $valid = self::isValidCif($normalized);
        }

        if (!$valid) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ value }}', $value)
                ->addViolation();
        }
    }

    private static function isValidDni(string $v): bool
    {
        if (!preg_match(self::DNI_REGEX, $v)) {
            return false;
        }
        $num = (int) substr($v, 0, 8);
        $expected = self::DNI_CONTROL_LETTERS[$num % 23];
        return $v[8] === $expected;
    }

    private static function isValidNie(string $v): bool
    {
        if (!preg_match(self::NIE_REGEX, $v)) {
            return false;
        }
        $prefix = ['X' => '0', 'Y' => '1', 'Z' => '2'][$v[0]];
        $num = (int) ($prefix . substr($v, 1, 7));
        $expected = self::DNI_CONTROL_LETTERS[$num % 23];
        return $v[8] === $expected;
    }

    private static function isValidCif(string $v): bool
    {
        if (!preg_match(self::CIF_REGEX, $v)) {
            return false;
        }
        $digits = substr($v, 1, 7);
        $sumEvens = 0;
        $sumOdds = 0;
        for ($i = 0; $i < strlen($digits); $i++) {
            $d = (int) $digits[$i];
            if ($i % 2 === 0) {
                $doubled = $d * 2;
                $sumOdds += $doubled > 9 ? $doubled - 9 : $doubled;
            } else {
                $sumEvens += $d;
            }
        }
        $total = ($sumEvens + $sumOdds) % 10;
        $controlDigit = $total === 0 ? 0 : 10 - $total;

        $last = $v[8];
        $initial = $v[0];
        $lettersOnly = ['P', 'Q', 'R', 'S', 'N', 'W'];
        $digitsOnly = ['A', 'B', 'E', 'H'];

        $expectedLetter = self::CIF_CONTROL_LETTERS[$controlDigit];
        $expectedDigit = (string) $controlDigit;

        if (in_array($initial, $lettersOnly, true)) {
            return $last === $expectedLetter;
        }
        if (in_array($initial, $digitsOnly, true)) {
            return $last === $expectedDigit;
        }
        return $last === $expectedLetter || $last === $expectedDigit;
    }
}
