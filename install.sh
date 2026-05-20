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
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  LOGGEX v02 — Instalación post-clone"
echo "=============================================="
echo ""

command -v docker >/dev/null 2>&1 || fail "docker no está instalado"
command -v docker compose >/dev/null 2>&1 || fail "docker compose no está disponible"

# Verificar que estamos en la raíz del repo
[ -f docker-compose.yml ] || fail "docker-compose.yml no encontrado — ejecuta desde la raíz del repo"
[ -d backend ]            || fail "directorio backend/ no encontrado"
[ -d frontend ]           || fail "directorio frontend/ no encontrado"

ok "Pre-flight OK"

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

# ── 4. Restaurar BD desde backup (idempotente sobre entrypoint-initdb) ────────
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
