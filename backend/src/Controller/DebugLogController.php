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

        // Leer las últimas 100 líneas
        $lines = file($logFile);
        $lastLines = array_slice($lines, -100);

        // Filtrar solo nuestros logs personalizados
        $filteredLogs = array_filter($lastLines, function($line) {
            return str_contains($line, 'SAVED THEMES') ||
                   str_contains($line, 'VERIFICACIÓN BD') ||
                   str_contains($line, 'API/ME') ||
                   str_contains($line, 'DATOS RECIBIDOS');
        });

        return $this->json([
            'file' => $logFile,
            'logs' => array_values($filteredLogs),
            'all_logs_tail' => $lastLines // Por si acaso
        ]);
    }
}
