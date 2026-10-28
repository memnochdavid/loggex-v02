<?php

namespace App\Service;

use App\Entity\Centro;
use League\Flysystem\FilesystemOperator;

/**
 * Branding compartido para PDFs (logos del centro + nameTitleConfig).
 *
 * Centraliza la lógica de:
 *  - Descargar el logo desde MinIO a un fichero temporal local apto para Dompdf.
 *  - Resolver la configuración de título coloreado del centro (`nameTitleConfig`).
 */
class PdfBranding
{
    public function __construct(
        private readonly FilesystemOperator $storage
    ) {
    }

    /**
     * Devuelve la ruta local de un fichero temporal con el logo del centro,
     * o null si no hay logo o falla la descarga.
     */
    public function getLogoTmpPath(Centro $centro, string $cachePrefix = 'pdf_logo'): ?string
    {
        if (!$centro->getLogo()) {
            return null;
        }

        $minioPath = 'logo-centro/' . $centro->getLogo();
        try {
            if (!$this->storage->has($minioPath)) {
                return null;
            }
            $ext = pathinfo($centro->getLogo(), PATHINFO_EXTENSION) ?: 'png';
            $tmpFile = sys_get_temp_dir() . '/' . $cachePrefix . '_' . $centro->getId() . '.' . $ext;
            file_put_contents($tmpFile, $this->storage->read($minioPath));
            return $tmpFile;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Devuelve la configuración del título coloreado del centro o null si no existe.
     * Estructura típica: { words: [{text, color}], spacing, casing }.
     */
    public function getNameTitleConfig(Centro $centro): ?array
    {
        $personalizacion = $centro->getPersonalizacion();
        if (!$personalizacion) {
            return null;
        }
        return $personalizacion->getNameTitleConfig();
    }
}
