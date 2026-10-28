<?php

namespace App\Service;

use Dompdf\Dompdf;
use Dompdf\Options;
use Twig\Environment;

class PdfGenerator
{
    public function __construct(
        private readonly Environment $twig
    ) {
    }

    /**
     * Renderiza una plantilla Twig a PDF y devuelve el contenido binario.
     */
    public function generateFromTwig(string $template, array $context = [], string $paperSize = 'A4', string $orientation = 'portrait'): string
    {
        $html = $this->twig->render($template, $context);
        return $this->generateFromHtml($html, $paperSize, $orientation);
    }

    /**
     * Genera un PDF a partir de HTML crudo.
     */
    public function generateFromHtml(string $html, string $paperSize = 'A4', string $orientation = 'portrait'): string
    {
        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isPhpEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->setChroot(['/var/www/html/public', sys_get_temp_dir()]);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper($paperSize, $orientation);
        $dompdf->render();

        return $dompdf->output();
    }
}
