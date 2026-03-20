<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@brasileirao.com'],
            [
                'name' => 'Administrador',
                'email' => 'admin@brasileirao.com',
                'password' => Hash::make('12345678'),
                'role' => 'admin',
            ]
        );
    }
}