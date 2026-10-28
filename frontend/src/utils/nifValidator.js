/**
 * Validador de NIF español (DNI / NIE / CIF).
 *
 * Cubre los tres formatos legales en España:
 *
 *  - **DNI persona física residente**: 8 dígitos + 1 letra de control.
 *    La letra se calcula por `mod 23` sobre el número (tabla "TRWAGMYFPDXBNJZSQVHLCKE").
 *  - **NIE persona física no residente**: prefijo X/Y/Z + 7 dígitos + 1 letra.
 *    Se transforma X→0, Y→1, Z→2 antes del mismo cálculo de letra que DNI.
 *  - **CIF persona jurídica (empresas)**: letra inicial (A-W exc. ÑIOTUL) +
 *    7 dígitos + 1 dígito o letra de control.
 *    Letra/dígito final calculado por algoritmo Luhn modificado mod 10
 *    (suma pares + suma de pares de impares modificados, todo mod 10).
 *
 * Reglas:
 *  - Espejo del validator backend `App\Validator\NifEspanol` —
 *    mantienes ambos sincronizados si el algoritmo cambia.
 *  - Acepta espacios y guiones que se eliminan al normalizar.
 *  - Comparación case-insensitive: `12345678a` válido como `12345678A`.
 *  - String vacío o null → `false` (la responsabilidad de "requerido vs
 *    opcional" la tiene el caller, no este validador).
 */

const DNI_REGEX = /^[0-9]{8}[A-Z]$/;
const NIE_REGEX = /^[XYZ][0-9]{7}[A-Z]$/;
const CIF_REGEX = /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/;
const DNI_CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI'; // posiciones 0..9 → letra de control para entidades que lo requieren

/**
 * Normaliza para validación: trim + upper + sin espacios/guiones.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeNif(raw) {
    if (typeof raw !== 'string') return '';
    return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Valida DNI (residente). 8 dígitos + letra mod 23.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidDni(value) {
    const v = normalizeNif(value);
    if (!DNI_REGEX.test(v)) return false;
    const num = parseInt(v.slice(0, 8), 10);
    const expected = DNI_CONTROL_LETTERS[num % 23];
    return v[8] === expected;
}

/**
 * Valida NIE (no residente). Prefijo X/Y/Z + 7 dígitos + letra mod 23.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidNie(value) {
    const v = normalizeNif(value);
    if (!NIE_REGEX.test(v)) return false;
    const prefix = { X: '0', Y: '1', Z: '2' }[v[0]];
    const num = parseInt(prefix + v.slice(1, 8), 10);
    const expected = DNI_CONTROL_LETTERS[num % 23];
    return v[8] === expected;
}

/**
 * Valida CIF (persona jurídica). Letra inicial + 7 dígitos + control (digit/letter).
 * Algoritmo: pares se suman tal cual, impares se duplican y suman dígitos
 * (Luhn modificado), 10 - (suma % 10) → si entidad obligada a letra, mapear
 * a CIF_CONTROL_LETTERS, si no, dígito directo. Aceptamos ambos finales si
 * coinciden (algunas entidades pueden usar dígito y otras letra).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidCif(value) {
    const v = normalizeNif(value);
    if (!CIF_REGEX.test(v)) return false;

    const digits = v.slice(1, 8);
    let sumEvens = 0;
    let sumOdds = 0;
    for (let i = 0; i < digits.length; i++) {
        const d = parseInt(digits[i], 10);
        if (i % 2 === 0) {
            // Posiciones 1,3,5,7 (índice 0,2,4,6 en 0-based) — duplicar y sumar dígitos.
            const doubled = d * 2;
            sumOdds += doubled > 9 ? doubled - 9 : doubled;
        } else {
            sumEvens += d;
        }
    }
    const total = (sumEvens + sumOdds) % 10;
    const controlDigit = total === 0 ? 0 : 10 - total;

    const last = v[8];
    const initial = v[0];
    // Entidades con letra de control obligatoria (P, Q, R, S, N, W) — cooperativas,
    // organismos públicos, etc.
    const lettersOnly = ['P', 'Q', 'R', 'S', 'N', 'W'];
    // Entidades con dígito obligatorio (A, B, E, H).
    const digitsOnly = ['A', 'B', 'E', 'H'];

    const expectedLetter = CIF_CONTROL_LETTERS[controlDigit];
    const expectedDigit = String(controlDigit);

    if (lettersOnly.includes(initial)) return last === expectedLetter;
    if (digitsOnly.includes(initial)) return last === expectedDigit;
    // Resto (C, D, F, G, J, U, V): cualquiera de las dos formas vale.
    return last === expectedLetter || last === expectedDigit;
}

/**
 * Conveniencia: true si es DNI, NIE o CIF válido.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidNif(value) {
    return isValidDni(value) || isValidNie(value) || isValidCif(value);
}

/**
 * Detecta el tipo: 'dni' | 'nie' | 'cif' | null si no es válido.
 * Útil para lógica de UI condicional (p.ej. mostrar campo "razón social"
 * cuando es CIF).
 * @param {string} value
 * @returns {('dni'|'nie'|'cif'|null)}
 */
export function detectNifType(value) {
    if (isValidDni(value)) return 'dni';
    if (isValidNie(value)) return 'nie';
    if (isValidCif(value)) return 'cif';
    return null;
}
