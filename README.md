# Desafio Full Stack Brasileirão

Projeto Full Stack para gerenciamento e visualização de dados do Brasileirão, com backend em Laravel, frontend em Next.js e execução via Docker.

## Visão geral

O projeto foi desenvolvido com foco em entregar um MVP funcional, organizado e simples de testar, contendo:

- autenticação com controle por perfil
- painel administrativo para gerenciamento
- visualização pública da classificação
- backend documentado via Swagger/OpenAPI
- execução padronizada com Docker

## Tecnologias utilizadas

### Backend
- Laravel
- PHP 8.4
- MySQL
- Laravel Sanctum / autenticação por token
- Swagger / OpenAPI

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Infraestrutura
- Docker
- Docker Compose

---

## Estrutura do projeto

```bash
.
├── brasileirao-api/
├── brasileirao-front/
└── docker-compose.yml
```

- brasileirao-api: aplicação backend em Laravel

- brasileirao-front: aplicação frontend em Next.js

- docker-compose.yml: orquestração dos containers

## Funcionalidades implementadas

- refresh token

- logout

- consulta de usuário autenticado

- atualização de perfil

## Perfis

- admin

- user

## Admin

- criação de times

- criação de jogos

- lançamento de placar

- exclusão de jogos conforme regra de negócio

- acesso à classificação

## Usuário comum

- acesso à classificação

## Classificação

- tabela com posição dos times

- estatísticas principais

- visualização pública

## Regras de negócio implementadas

- controle de acesso por perfil

- rota /admin protegida

- redirecionamento por role após login

- exclusão permitida apenas para jogos finalizados nos últimos 3 dias

- classificação calculada a partir dos resultados cadastrados

## Como executar o projeto

Pré-requisitos

- Docker

- Docker Compose

## Subir os containers

Na raiz do projeto:

```bash
docker compose up --build
```

ou, dependendo da sua versão:

```bash
docker-compose up --build
```

## Endereços de aplicação

## Frontend

```bash
http://127.0.0.1:3000
```

## Backend API

```bash
http://127.0.0.1:8000/api
```

## Documentação Swagger / OpenAPI

```bash
http://127.0.0.1:8000/docs/api
```

## Credenciais de teste
## Admin

E-mail: 

```bash
admin@brasileirao.com
```

Senha: 

```bash
12345678
```

## Usuário comum

Caso exista no banco:

E-mail:

```bash
user@brasileirao.com
```

Senha: 

```bash
12345678
```
Observação: o fluxo de usuário comum depende de existir um usuário com role user cadastrado no backend.

## Fluxos principais
## Fluxo de login

- acesso em /login

- usuário admin é redirecionado para /admin

- usuário user é redirecionado para /standings

## Proteção da rota admin

- sem token: redireciona para /login

- com usuário comum: redireciona para /standings

- com admin: acesso liberado

## Principais rotas do frontend

/ → redireciona para /login

/login → autenticação

/admin → painel administrativo

/standings → classificação

## Principais endpoints da API
## Auth

POST /api/register

POST /api/login

POST /api/refresh

GET /api/me

POST /api/logout

PUT /api/profile

## Teams

CRUD de times

## Games

CRUD de jogos

PUT /api/games/{id}/score

## Standings

GET /api/standings

## Autor

Paulo Francisco Marsiglia
