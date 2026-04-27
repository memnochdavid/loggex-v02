<?php

namespace App\Entity;

/**
 * Comunidades y ciudades autónomas de España.
 *
 * Códigos ISO 3166-2:ES. 17 CCAA + Ceuta + Melilla = 19 valores estables;
 * no cambian con el tiempo (las CCAA están fijadas constitucionalmente).
 *
 * Se usa como `enumType` de columnas Doctrine en:
 *   - `Centro.ccaa` (default para itinerarios del centro, D9)
 *   - `Itinerario.ccaa` (D5; NULL = currículo nacional puro)
 *   - `CatalogoItinerario.ccaa` (etiqueta del catálogo origen, opcional)
 *   - `CatalogoMateriaCcaa.ccaa`
 *   - `CatalogoItinerarioCcaa.ccaa`
 *
 * Doc de referencia: docs/hoja-de-ruta-curriculum-ccaa.md §3.1.
 */
enum Ccaa: string
{
    case AN = 'AN'; // Andalucía
    case AR = 'AR'; // Aragón
    case AS = 'AS'; // Asturias
    case CB = 'CB'; // Cantabria
    case CE = 'CE'; // Ceuta
    case CL = 'CL'; // Castilla y León
    case CM = 'CM'; // Castilla-La Mancha
    case CN = 'CN'; // Canarias
    case CT = 'CT'; // Cataluña
    case EX = 'EX'; // Extremadura
    case GA = 'GA'; // Galicia
    case IB = 'IB'; // Illes Balears
    case MC = 'MC'; // Murcia
    case MD = 'MD'; // Madrid
    case ML = 'ML'; // Melilla
    case NC = 'NC'; // Navarra
    case PV = 'PV'; // País Vasco
    case RI = 'RI'; // La Rioja
    case VC = 'VC'; // C. Valenciana

    /**
     * Nombre humano para UI/logs. La traducción real para i18n vive en el
     * frontend (claves `ccaa.AN`, `ccaa.CT`, ...).
     */
    public function nombre(): string
    {
        return match ($this) {
            self::AN => 'Andalucía',
            self::AR => 'Aragón',
            self::AS => 'Asturias',
            self::CB => 'Cantabria',
            self::CE => 'Ceuta',
            self::CL => 'Castilla y León',
            self::CM => 'Castilla-La Mancha',
            self::CN => 'Canarias',
            self::CT => 'Cataluña',
            self::EX => 'Extremadura',
            self::GA => 'Galicia',
            self::IB => 'Illes Balears',
            self::MC => 'Murcia',
            self::MD => 'Madrid',
            self::ML => 'Melilla',
            self::NC => 'Navarra',
            self::PV => 'País Vasco',
            self::RI => 'La Rioja',
            self::VC => 'C. Valenciana',
        };
    }
}
