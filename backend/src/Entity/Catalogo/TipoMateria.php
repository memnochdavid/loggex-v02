<?php

namespace App\Entity\Catalogo;

/**
 * Tipo de materia dentro de un itinerario formativo.
 *
 * - MODULO se usa en FP.
 * - TRONCAL/ESPECIFICA/OPTATIVA/LIBRE_CONFIGURACION se usan en ESO/Bachillerato.
 * - ASIGNATURA es el contenedor genérico universitario.
 * - FCT (Formación en Centros de Trabajo) y PROYECTO son módulos especiales de FP.
 */
enum TipoMateria: string
{
    case MODULO              = 'materia';
    case TRONCAL             = 'troncal';
    case ESPECIFICA          = 'especifica';
    case OPTATIVA            = 'optativa';
    case LIBRE_CONFIGURACION = 'libre_configuracion';
    case ASIGNATURA          = 'asignatura';
    case FCT                 = 'fct';
    case PROYECTO            = 'proyecto';
}
