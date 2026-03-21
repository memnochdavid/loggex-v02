<?php

namespace App\EventListener;

use App\Entity\Mensaje;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Events;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsEntityListener(event: Events::prePersist, entity: Mensaje::class)]
#[AsEntityListener(event: Events::preUpdate, entity: Mensaje::class)]
#[AsEntityListener(event: Events::postLoad, entity: Mensaje::class)]
class MensajeEncryptionListener
{
    private const CIPHER_METHOD = 'AES-256-CBC';

    public function __construct(
        #[Autowire(param: 'app.encryption_key')]
        private readonly string $encryptionKey
    ) {
    }

    public function prePersist(Mensaje $mensaje): void
    {
        $this->encrypt($mensaje);
    }

    public function preUpdate(Mensaje $mensaje): void
    {
        $this->encrypt($mensaje);
    }

    public function postLoad(Mensaje $mensaje): void
    {
        $this->decrypt($mensaje);
    }

    private function encrypt(Mensaje $mensaje): void
    {
        $texto = $mensaje->getTexto();
        if ($texto) {
            $ivLength = openssl_cipher_iv_length(self::CIPHER_METHOD);
            $iv = openssl_random_pseudo_bytes($ivLength);
            $encrypted = openssl_encrypt($texto, self::CIPHER_METHOD, $this->encryptionKey, 0, $iv);
            $mensaje->setContenido(base64_encode($iv . $encrypted));
        }
    }

    private function decrypt(Mensaje $mensaje): void
    {
        $contenido = $mensaje->getContenido();
        if ($contenido) {
            try {
                $data = base64_decode($contenido, true);
                if ($data === false) {
                    throw new \Exception("No es base64 válido");
                }

                $ivLength = openssl_cipher_iv_length(self::CIPHER_METHOD);
                if (strlen($data) < $ivLength) {
                    throw new \Exception("Datos demasiado cortos");
                }

                $iv = substr($data, 0, $ivLength);
                $encrypted = substr($data, $ivLength);
                $decrypted = openssl_decrypt($encrypted, self::CIPHER_METHOD, $this->encryptionKey, 0, $iv);

                if ($decrypted === false) {
                    $mensaje->setTexto($contenido);
                } else {
                    $mensaje->setTexto($decrypted);
                }
            } catch (\Exception $e) {
                $mensaje->setTexto($contenido);
            }
        }
    }
}
