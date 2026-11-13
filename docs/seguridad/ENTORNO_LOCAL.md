# Entorno local de pruebas de seguridad

Permite levantar Governex completo en tu máquina, con una BD PostgreSQL desechable y datos de prueba, sin tocar Railway ni producción.

## Requisitos
- Node.js ≥ 22.12
- Docker Desktop en ejecución

## Primer uso

```bash
npm ci
npm run local:env      # crea .env con secretos aleatorios (no sobrescribe uno existente)
npm run local:db       # PostgreSQL 16 en 127.0.0.1:5433 (solo accesible desde tu equipo)
npm run local:reset    # construye la BD: schema.sql + migrations/ + datos de prueba
npm run dev            # API en :3001 y frontend en http://localhost:5173
```

En otra terminal, con la API corriendo:

```bash
npm run test:security
```

## Usuarios de prueba
| Correo | Rol | Empresa |
|---|---|---|
| `super.a@governex.test` / `super.b@…` | Superusuario | A / B |
| `gestion.a@governex.test` / `gestion.b@…` | Gestión | A / B |
| `operativo.a@governex.test` / `operativo.b@…` | Operativo | A / B |
| `limitado.a@governex.test` / `limitado.b@…` | Operativo con permisos personalizados (solo `riesgos:leer`) | A / B |
| `platform@governex.test` | platform_admin | n/a |

Contraseña de todos: el valor de `LOCAL_SEED_PASSWORD` en tu `.env`.

## Salvaguardas
- `setup-db.cjs` y `api-security-tests.cjs` **se niegan a ejecutarse** si `DATABASE_URL` / `API_URL` no apuntan a `localhost`.
- El contenedor solo publica el puerto en `127.0.0.1`.
- `.env` está en `.gitignore`; ningún secreto local se versiona.
- Gemini y R2 quedan vacíos en local: las funciones de IA y de archivos responden con un error controlado.

## Limpieza
```bash
docker compose down -v
```
