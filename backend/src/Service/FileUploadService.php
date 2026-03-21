<?php

namespace App\Service;

use League\Flysystem\FilesystemOperator;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\String\Slugger\SluggerInterface;

class FileUploadService
{
    public function __construct(
        private readonly FilesystemOperator $storage,
        private readonly SluggerInterface $slugger,
        private readonly string $projectDir
    ) {
    }

    /**
     * Sube un archivo a MinIO (Flysystem) y devuelve el nombre generado.
     * Opcionalmente borra el archivo antiguo.
     */
    public function uploadToStorage(UploadedFile $file, string $directory, ?string $oldFilename = null): string
    {
        $newFilename = $this->generateFilename($file);

        $stream = fopen($file->getRealPath(), 'r+');
        $this->storage->writeStream($directory . '/' . $newFilename, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        if ($oldFilename) {
            $this->deleteFromStorage($directory . '/' . $oldFilename);
        }

        return $newFilename;
    }

    /**
     * Sube un archivo a disco local y devuelve el nombre generado.
     */
    public function uploadToLocal(UploadedFile $file, string $subdirectory): string
    {
        $destination = $this->projectDir . '/public/uploads/' . $subdirectory;

        if (!file_exists($destination)) {
            if (!@mkdir($destination, 0755, true) && !is_dir($destination)) {
                throw new \RuntimeException('No se pudo crear el directorio de destino');
            }
        }

        $newFilename = $this->generateFilename($file);
        $file->move($destination, $newFilename);

        return $newFilename;
    }

    /**
     * Borra un archivo de MinIO si existe.
     */
    public function deleteFromStorage(string $path): void
    {
        try {
            if ($this->storage->has($path)) {
                $this->storage->delete($path);
            }
        } catch (\Exception) {
            // Silenciar errores de borrado para no interrumpir el flujo principal
        }
    }

    private function generateFilename(UploadedFile $file): string
    {
        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $this->slugger->slug($originalFilename);

        return $safeFilename . '-' . uniqid() . '.' . $file->guessExtension();
    }
}
