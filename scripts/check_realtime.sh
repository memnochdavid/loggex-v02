#!/bin/bash
# Script de verificación del stack de tiempo real (Redis + Mercure + Workers).
# Corre desde el host. No requiere credenciales: usa comandos CLI del backend
# y curl anónimo contra el hub Mercure (topics públicos).
#
# Códigos de salida:
#   0  todos los checks OK
#   >0 número de checks fallados

cd "$(dirname "$0")/.."

# Colores (solo si stdout es tty)
if [ -t 1 ]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; CYAN=''; BOLD=''; NC=''
fi

FAILED=0

check() {
    local label="$1"; shift
    printf "  %-55s" "$label"
    if "$@" > /tmp/check_realtime.out 2>&1; then
        printf "${GREEN}OK${NC}\n"
    else
        printf "${RED}FAIL${NC}\n"
        sed 's/^/      /' /tmp/check_realtime.out
        FAILED=$((FAILED + 1))
    fi
}

info() {
    printf "  ${CYAN}%-55s${NC}%s\n" "$1" "$2"
}

section() {
    printf "\n${BOLD}== %s ==${NC}\n" "$1"
}

# ---------- 1. Contenedores ----------
section "Contenedores"
for svc in redis mercure backend; do
    check "$svc arriba" bash -c "docker compose ps --format '{{.Name}} {{.State}}' | grep -E '$svc\s+running' > /dev/null"
done
WORKERS=$(docker compose ps --format '{{.Name}} {{.State}}' 2>/dev/null | grep -cE 'worker.*running')
if [ "$WORKERS" -gt 0 ]; then
    info "workers activos:" "$WORKERS"
else
    printf "  %-55s${RED}FAIL${NC}\n" "al menos un worker arriba"
    FAILED=$((FAILED + 1))
fi

# ---------- 2. Redis ----------
section "Redis"
check "redis-cli PING" bash -c "docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG"

DBSIZE=$(docker compose exec -T redis redis-cli DBSIZE 2>/dev/null | tr -d '\r')
info "claves totales en Redis:" "${DBSIZE:-?}"

CACHE_KEYS=$(docker compose exec -T redis redis-cli --scan --pattern '*schedule_*' 2>/dev/null | grep -c . || true)
info "claves de cache schedule_*:" "$CACHE_KEYS"

QUEUE_LEN=$(docker compose exec -T redis redis-cli XLEN loggex_jobs 2>/dev/null | tr -d '\r')
info "jobs pendientes en cola async:" "${QUEUE_LEN:-0}"
if [ "${QUEUE_LEN:-0}" -gt 50 ] 2>/dev/null; then
    printf "  ${YELLOW}WARN${NC} cola con más de 50 jobs pendientes — revisa logs del worker\n"
fi

# ---------- 3. Hub Mercure ----------
section "Hub Mercure"
check "hub responde en red Docker" bash -c '
    CODE=$(docker compose exec -T backend curl -sS -o /dev/null -w "%{http_code}" --max-time 2 "http://mercure/.well-known/mercure?topic=/ping" 2>/dev/null)
    [ "$CODE" = "200" ]
'
check "hub via Caddy HTTPS (mismo origen que el frontend)" bash -c '
    CODE=$(curl -sS -k -o /dev/null -w "%{http_code}" --max-time 2 "https://localhost:8443/.well-known/mercure?topic=/ping" 2>/dev/null)
    [ "$CODE" = "200" ]
'

# ---------- 4. Messenger / Workers ----------
section "Messenger / Workers"
check "messenger:stats responde" bash -c "docker compose exec -T backend php bin/console messenger:stats 2>/dev/null | grep -q async"
check "worker-1 arrancó y está consumiendo" bash -c "docker logs loggex-v02-worker-1 2>&1 | grep -q 'Consuming messages'"

# ---------- 5. Round-trip async ----------
section "Round-trip async end-to-end"
SSE_OUT=$(mktemp)
TOPIC="/test/healthcheck-$$"
TS=$(date +%s)
PAYLOAD="{\"healthcheck\":true,\"ts\":$TS}"

# Subscriber SSE en background (topic público, anónimo).
# --max-time 12 = tiempo máximo que el curl mantiene la conexión abierta.
curl -sS -k --max-time 12 -N "https://localhost:8443/.well-known/mercure?topic=${TOPIC}" > "$SSE_OUT" 2>&1 &
CURL_PID=$!

# Dar tiempo a que el SSE se establezca completamente antes de disparar.
# Mercure escribe un `:` inicial como keep-alive en cuanto abre la conexión.
for i in 1 2 3 4 5; do
    sleep 1
    if [ -s "$SSE_OUT" ]; then break; fi
done

# Dispatch del job (irá a Redis stream -> worker -> hub).
# Usamos bash -c para que el contenedor reciba topic y payload como tokens
# estables, independientemente de cómo los expanda el shell del host.
docker compose exec -T backend bash -c "php bin/console app:mercure:test-async '$TOPIC' '$PAYLOAD'" > /dev/null 2>&1

# Esperar a que el worker consuma + hub empuje. El worker procesa en ~20ms,
# pero damos hasta 5s por lentitudes esporádicas.
for i in 1 2 3 4 5; do
    sleep 1
    if grep -q "\"ts\":$TS" "$SSE_OUT"; then break; fi
done

kill $CURL_PID 2>/dev/null
wait $CURL_PID 2>/dev/null

if grep -q "\"ts\":$TS" "$SSE_OUT"; then
    printf "  %-55s${GREEN}OK${NC}\n" "dispatch -> worker -> hub -> SSE entregado"
    MSG=$(grep -o '{"healthcheck"[^}]*}' "$SSE_OUT" | head -1)
    info "payload recibido:" "$MSG"
else
    printf "  %-55s${RED}FAIL${NC}\n" "dispatch -> worker -> hub -> SSE entregado"
    echo "      SSE output recibido:"
    sed 's/^/        /' "$SSE_OUT" | head -10
    echo "      (revisa \`docker logs loggex-v02-worker-1\`)"
    FAILED=$((FAILED + 1))
fi
rm -f "$SSE_OUT" /tmp/check_realtime.out

# ---------- Resumen ----------
echo
if [ "$FAILED" -eq 0 ]; then
    printf "${GREEN}${BOLD}Todos los checks OK.${NC}\n"
    exit 0
else
    printf "${RED}${BOLD}$FAILED check(s) fallaron.${NC}\n"
    exit "$FAILED"
fi
