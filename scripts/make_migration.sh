#!/bin/bash
cd "$(dirname "$0")/.."

# Genera una nueva migración a partir del diff entre las entidades Doctrine y el esquema actual de la BD.
# Úsalo tras modificar entidades (añadir/cambiar campos, nuevas entidades, relaciones, etc.).
# No aplica nada: solo crea el archivo en backend/migrations/. Después revísalo y aplícalo con ./migrate.sh.

echo "🧬 Generando nueva migración Doctrine (diff contra la BD)..."
docker compose exec backend php bin/console doctrine:migrations:diff --no-interaction

echo ""
echo "✅ Archivo creado en backend/migrations/. Revísalo antes de aplicarlo."
echo "💡 Si el diff está vacío, significa que el esquema ya está sincronizado."
echo "💡 Para aplicar las migraciones pendientes: ./scripts/migrate.sh"
