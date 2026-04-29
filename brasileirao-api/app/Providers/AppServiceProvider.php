<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if (class_exists(\Dedoc\Scramble\Scramble::class)) {
            \Dedoc\Scramble\Scramble::configure()
                ->withDocumentTransformers(function (\Dedoc\Scramble\Support\Generator\OpenApi $openApi) {
                    $openApi->secure(
                        \Dedoc\Scramble\Support\Generator\SecurityScheme::http('bearer')
                    );

                    $openApi->info->title = 'Brasileirão API';
                    $openApi->info->version = '1.0.0';
                    $openApi->info->description = 'Documentação da API do desafio Full Stack do Brasileirão.';
                });
        }
    }
}