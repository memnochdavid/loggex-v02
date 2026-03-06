#!/bin/bash

# Configuración
OLD_BRANCH="feature/mariadb-migration"
NEW_BRANCH="develop"
REMOTE="origin"

echo "🔄 Obteniendo últimos cambios del remoto..."
git fetch $REMOTE

# 1. Verificar si tienen la rama antigua localmente
if git show-ref --verify --quiet refs/heads/$OLD_BRANCH; then
    echo "⚠️  Detectada rama antigua local: $OLD_BRANCH"

    # 2. Verificar si ya existe la nueva rama localmente (para evitar conflictos)
    if git show-ref --verify --quiet refs/heads/$NEW_BRANCH; then
        echo "❌ Error: La rama '$NEW_BRANCH' ya existe localmente."
        echo "   Por favor, revisa tus ramas manualmente para decidir cuál conservar."
        exit 1
    fi

    # 3. Renombrar la rama local
    echo "🚚 Renombrando '$OLD_BRANCH' a '$NEW_BRANCH'..."
    git branch -m $OLD_BRANCH $NEW_BRANCH
    
    # 4. Vincular con la nueva rama remota
    echo "🔗 Vinculando '$NEW_BRANCH' local con '$REMOTE/$NEW_BRANCH'..."
    git branch -u $REMOTE/$NEW_BRANCH $NEW_BRANCH
    
    echo "✅ Rama migrada correctamente."

else
    echo "ℹ️  No se encontró la rama '$OLD_BRANCH' localmente."
    
    # Verificar si ya tienen la nueva
    if git show-ref --verify --quiet refs/heads/$NEW_BRANCH; then
        echo "✅ Ya tienes la rama '$NEW_BRANCH' correctamente."
    else
        echo "⬇️  Creando rama '$NEW_BRANCH' desde el remoto..."
        git checkout -b $NEW_BRANCH $REMOTE/$NEW_BRANCH
    fi
fi

# 5. Limpiar referencias a ramas borradas en el remoto
echo "✂️  Limpiando referencias remotas obsoletas..."
git remote prune $REMOTE

echo "🎉 ¡Proceso finalizado! Ahora estás sincronizado con '$NEW_BRANCH'."
