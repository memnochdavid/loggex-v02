#!/bin/bash
cd "$(dirname "$0")"

# =============================================================================
# Loggex v02 — Install Script (post-clone, one-shot)
#
# Uso: tras `git clone`, ejecutar desde la raíz del repo:
#   sudo bash install.sh
#
# Deja el proyecto listo para funcionar en la rama develop.
# Un solo `sudo docker compose up -d` tras el clone NO basta porque hay
# dependencias que instalar (composer, npm), migraciones que aplicar,
# JWT que generar y MinIO que configurar.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ── Banner + Requisitos del sistema ──────────────────────────────────────────
echo ""
echo "=============================================="
echo "  LOGGEX v02 — Instalación post-clone"
echo "=============================================="
echo ""

echo -e "${BOLD}Requisitos del sistema:${NC}"
echo "  Docker (Engine o Desktop) ............ requerido"
echo "  Docker Compose (plugin v2) ........... requerido"
echo ""
echo "  NO se requiere en el host: PHP, Composer, Node.js, npm, MariaDB"
echo "  (todo se ejecuta dentro de contenedores Docker)"
echo ""

# Verificar dependencias
MISSING=0

if command -v docker >/dev/null 2>&1; then
    DOCKER_VER=$(docker --version 2>/dev/null | sed 's/Docker version //;s/,.*//')
    ok "Docker $DOCKER_VER"
else
    warn "Docker NO encontrado — instálalo: https://docs.docker.com/engine/install/"
    MISSING=1
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_VER=$(docker compose version 2>/dev/null | sed 's/Docker Compose version //')
    ok "Docker Compose $COMPOSE_VER"
else
    warn "Docker Compose NO encontrado — viene con Docker Desktop o instala el plugin"
    MISSING=1
fi

# Verificar estructura del repo
echo ""
if [ -f docker-compose.yml ] && [ -d backend ] && [ -d frontend ]; then
    ok "Estructura del repo OK (docker-compose.yml, backend/, frontend/)"
else
    fail "Estructura del repo incompleta — ejecuta desde la raíz del proyecto"
fi

# Si falta algo crítico, abortar
if [ "$MISSING" -eq 1 ]; then
    echo ""
    echo -e "${RED}Faltan dependencias del sistema. Instálalas y vuelve a ejecutar este script.${NC}"
    exit 1
fi

# Confirmación
echo ""
echo -e "${BOLD}El script realizará las siguientes acciones:${NC}"
echo "  1. Levantar contenedores (build + up)"
echo "  2. Restaurar BD desde backup_tfg_full.sql (si existe)"
echo "  3. Restaurar storage desde minio_backup/ (si existe)"
echo "  4. Instalar dependencias backend (composer install)"
echo "  5. Generar claves JWT"
echo "  6. Aplicar migraciones Doctrine"
echo "  7. Instalar dependencias frontend (npm install)"
echo "  8. Reiniciar backend"
echo ""
read -p "¿Continuar? (s/N): " confirm
if [[ "$confirm" != [sS] && "$confirm" != [sS][iI] ]]; then
    echo "Cancelado."
    exit 0
fi

# ── 1. Levantar contenedores ─────────────────────────────────────────────────
echo ""
info "Levantando contenedores Docker (build + up)..."
docker compose up -d --build --remove-orphans
ok "Contenedores en marcha"

# ── 2. Esperar a que los servicios estén listos ──────────────────────────────
echo ""
info "Esperando a que MariaDB esté lista..."
for i in $(seq 1 30); do
    if docker compose exec -T database mariadb -u app_user -papp_password app_db -e "SELECT 1" >/dev/null 2>&1; then
        ok "MariaDB lista ($i intentos)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        fail "MariaDB no respondió tras 30 intentos"
    fi
    sleep 2
done

info "Esperando a que MinIO esté listo..."
for i in $(seq 1 15); do
    if docker compose exec -T minio mc alias set myminio http://localhost:9000 minio_admin minio_password >/dev/null 2>&1; then
        ok "MinIO listo ($i intentos)"
        break
    fi
    if [ "$i" -eq 15 ]; then
        fail "MinIO no respondió tras 15 intentos"
    fi
    sleep 2
done

# ── 3. Configurar MinIO + restaurar storage ──────────────────────────────────
echo ""
info "Configurando bucket MinIO 'loggex-data'..."
NETWORK=$(docker network ls -q --filter name=loggex-v02_default | head -n 1)
if [ -z "$NETWORK" ]; then
    NETWORK="loggex-v02_default"
fi
docker run --rm --network "$NETWORK" \
    minio/mc alias set myminio http://minio:9000 minio_admin minio_password >/dev/null 2>&1
docker run --rm --network "$NETWORK" \
    minio/mc mb --ignore-existing myminio/loggex-data >/dev/null 2>&1
ok "Bucket 'loggex-data' creado"

if [ -d minio_backup ]; then
    info "Restaurando archivos desde minio_backup/..."
    bash scripts/restore_storage.sh
    ok "Storage restaurado"
else
    warn "minio_backup/ no encontrado — bucket vacío (avatares, logos, entregas no estarán disponibles)"
fi

# ── 4. Restaurar BD desde backup ─────────────────────────────────────────────
echo ""
if [ -f backup_tfg_full.sql ]; then
    info "Restaurando base de datos desde backup_tfg_full.sql..."
    bash scripts/restore_db.sh
    ok "Base de datos restaurada"
else
    warn "backup_tfg_full.sql no encontrado — BD vacía (solo schema de migraciones)"
fi

# ── 5. Instalar dependencias Backend (Composer) ──────────────────────────────
echo ""
info "Instalando dependencias de Symfony (composer install)..."
docker compose exec -T backend composer install --no-interaction --optimize-autoloader
ok "Composer install completado"

# ── 6. Generar claves JWT ────────────────────────────────────────────────────
echo ""
info "Generando claves JWT..."
docker compose exec -T backend php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction
ok "Claves JWT generadas"

# ── 7. Aplicar migraciones Doctrine ──────────────────────────────────────────
echo ""
info "Aplicando migraciones Doctrine..."
docker compose exec -T backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
ok "Migraciones aplicadas"

# ── 8. Limpiar caché + permisos ──────────────────────────────────────────────
echo ""
info "Limpiando caché y ajustando permisos..."
docker compose exec -T backend rm -rf var/cache/dev var/cache/prod
docker compose exec -T backend php bin/console cache:clear
docker compose exec -T backend chown -R www-data:www-data var/
ok "Caché limpio y permisos ajustados"

# ── 9. Instalar dependencias Frontend (NPM) ──────────────────────────────────
echo ""
info "Instalando dependencias de React (npm install)..."
docker compose exec -T frontend npm install
ok "npm install completado"

# ── 10. Reiniciar backend (OPcache) ──────────────────────────────────────────
echo ""
info "Reiniciando backend para aplicar OPcache..."
docker compose restart backend
ok "Backend reiniciado"

# ── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  ✅ Loggex v02 instalado y listo"
echo "=============================================="
echo ""
echo "  Frontend:    https://localhost:8443"
echo "  Backend API: https://localhost:9443/api"
echo "  MinIO:       http://localhost:9001  (admin / minio_password)"
echo ""
echo "  Credenciales por defecto (backup):"
echo "    superadmin@loggex.com / 1234"
echo ""
