<?php
$logFile = __DIR__ . '/var/log/dev.log';
if (file_exists($logFile)) {
    // Leer las últimas 50 líneas
    $lines = file($logFile);
    $lastLines = array_slice($lines, -50);
    foreach ($lastLines as $line) {
        echo $line;
    }
} else {
    echo "Log file not found at $logFile";
}
