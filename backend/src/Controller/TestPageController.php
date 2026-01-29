<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class TestPageController extends AbstractController
{
    #[Route('/test', name: 'app_test_page')]
    public function index(): Response
    {
        return $this->render('test/index.html.twig');
    }
}
