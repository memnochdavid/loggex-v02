<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpKernel\KernelInterface;

class DebugLogController extends AbstractController
{
    #[Route('/api/debug/logs', name: 'api_debug_logs', methods: ['GET'])]
    public function index(KernelInterface $kernel): JsonResponse
    {
        $logDir = $kernel->getLogDir();
        $env = $kernel->getEnvironment();
        $logFile = $logDir . '/' . $env . '.log';

        if (!file_exists($logFile)) {
            return $this->json(['error' => 'Log file not found: ' . $logFile]);
        }

        // Leer las últimas 200 líneas
        $lines = file($logFile);
        $lastLines = array_slice($lines, -200);

        // Filtrar errores críticos y excepciones
        $errorLogs = array_filter($lastLines, function($line) {
            return str_contains($line, 'CRITICAL') ||
                   str_contains($line, 'ERROR') ||
                   str_contains($line, 'Exception') ||
                   str_contains($line, '500 Internal Server Error');
        });

        return $this->json([
            'file' => $logFile,
            'errors' => array_values($errorLogs),
            'tail' => array_slice($lines, -50) // Últimas 50 líneas sin filtrar
        ]);
    }
}
