# GUÍA i18n — Añadir idiomas autonómicos (Català, Galego, Euskera)

## RESUMEN DE LA TAREA

Añadir 3 idiomas nuevos al sistema i18n existente: **Català (ca)**, **Galego (gl)** y **Euskera (eu)**.

Hay que hacer exactamente 5 cosas:
1. Crear `ca.json` (traducción completa al catalán)
2. Crear `gl.json` (traducción completa al gallego)
3. Crear `eu.json` (traducción completa al euskera)
4. Actualizar `i18n.js` para registrar los 3 idiomas nuevos
5. Actualizar `LanguageSelector.jsx` para mostrar los 3 idiomas nuevos

**NADA MÁS. No toques ningún otro archivo.**

---

## REGLAS ABSOLUTAS

1. **NO modifiques `es.json` ni `en.json`** — ya están actualizados.
2. **NO modifiques ningún componente** salvo `LanguageSelector.jsx`.
3. **NO modifiques ningún archivo** salvo los 5 listados arriba.
4. **NO cambies la estructura de claves** — los 3 JSON nuevos deben tener EXACTAMENTE las mismas claves que `es.json`. Ni una más, ni una menos.
5. **NO inventes traducciones aproximadas** — si no estás seguro de un término, usa la traducción más estándar/formal del idioma. No uses castellanismos.
6. **Cada idioma debe ser lingüísticamente correcto** — no mezcles catalán con valenciano, ni gallego con portugués, ni batúa con dialectos del euskera.
7. **Los nombres propios NO se traducen**: "Loggex", "Loggex-Machina", "API Platform", "Doctrine", "React", "Symfony", "Vite", "MinIO", "Caddy", "Lucide", "Docker", "CSS Modules", "JWT", "MariaDB", URLs, emails de ejemplo.
8. **Los términos técnicos de UI se mantienen** en su forma original cuando no hay traducción natural establecida: "Scrollbar", "Hover", "Header", "Footer", "Widget", "Sidebar", "Lottie", "Draggable", "Badge", "Border Radius", "Thumb", "Track". Úsalos tal cual o adapta mínimamente si el idioma tiene forma propia consolidada.

---

## TAREA 1: Crear los 3 archivos JSON

### Ubicación

```
frontend/src/i18n/locales/ca.json   ← Català
frontend/src/i18n/locales/gl.json   ← Galego
frontend/src/i18n/locales/eu.json   ← Euskera
```

### Proceso

1. Abre `frontend/src/i18n/locales/es.json` como referencia.
2. Crea cada archivo nuevo copiando la estructura COMPLETA de `es.json`.
3. Traduce CADA valor (las cadenas de texto entre comillas) al idioma correspondiente.
4. Las claves (los nombres antes de los `:`) NO se tocan. Se quedan en inglés/original.

### Ejemplo de cómo se ve el resultado

**es.json (referencia):**
```json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "loading": "Cargando..."
  }
}
```

**ca.json:**
```json
{
  "common": {
    "save": "Desar",
    "cancel": "Cancel·lar",
    "delete": "Eliminar",
    "loading": "Carregant..."
  }
}
```

**gl.json:**
```json
{
  "common": {
    "save": "Gardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "loading": "Cargando..."
  }
}
```

**eu.json:**
```json
{
  "common": {
    "save": "Gorde",
    "cancel": "Utzi",
    "delete": "Ezabatu",
    "loading": "Kargatzen..."
  }
}
```

### Notas de traducción por idioma

#### Català (ca)
- Usa catalán estándar (normativa del IEC), no valenciano ni balear.
- Usa el punt volat (·) correctamente: "cancel·lar", "col·laborar", "instal·lació".
- Los artículos: el/la/els/les, l' delante de vocal.
- Acentuación: à, è, é, í, ò, ó, ú, ï, ü.
- "Contraseña" → "Contrasenya", "Buscar" → "Cercar", "Guardar" → "Desar".

#### Galego (gl)
- Usa gallego normativo (RAG), no reintegracionista.
- Muy similar al castellano pero con diferencias: "ñ" → "ñ" (existe en gallego), "ll" habitual.
- "Contraseña" → "Contrasinal", "Buscar" → "Buscar" o "Procurar", "Guardar" → "Gardar".
- "Configuración" → "Configuración", "Información" → "Información" (comparten muchos términos).

#### Euskera (eu)
- Usa euskera batúa (unificado/estándar).
- El euskera es una lengua aglutinante — las frases pueden ser muy diferentes en estructura.
- "Contraseña" → "Pasahitza", "Buscar" → "Bilatu", "Guardar" → "Gorde".
- "Cargando..." → "Kargatzen...", "Error" → "Errorea" (con artículo incorporado según contexto).
- Los verbos van al final en euskera: "Datos cargados" → "Datuak kargatuta".
- Atención a las declinaciones: ergativo (-k), dativo (-ri), etc. según contexto.
- Los roles: "Alumno" → "Ikaslea", "Profesor" → "Irakaslea", "Administrador" → "Administratzailea".

### Valores que NO se traducen (copiar tal cual de es.json)

Estos valores se mantienen idénticos en los 3 idiomas:

```json
"lang": {
  "es": "Español",       ← siempre así en TODOS los idiomas
  "en": "English",        ← siempre así
  "ca": "Català",         ← siempre así
  "gl": "Galego",         ← siempre así
  "eu": "Euskera",        ← siempre así
  "label": "..."          ← este SÍ se traduce ("Idioma"/"Hizkuntza"/etc.)
}
```

Los nombres de idiomas se escriben siempre en su idioma nativo, en todos los JSON.

Otros valores que NO se traducen (copiar tal cual):
- `"footer.copyright"`: contiene "© {{year}} Loggex-Machina v0.2 - Propiedad de David Duque Díaz." — traducir solo "Propiedad de" (o equivalente). El nombre y la marca se mantienen.
- `"login.emailPlaceholder"`: mantener formato email ("ejemplo@correo.com" o adaptación local como "adibidea@posta.com" en euskera).
- `"login.passwordPlaceholder"`: "••••••••" — no traducir.
- Placeholders con formato técnico: "Q1234567A", "https://...", "0484", etc.
- Interpolaciones `{{variable}}` — copiar exactamente. Ejemplo: `"greeting": "Kaixo, {{name}}, egun on."` — las `{{name}}` son variables, NO texto.

### Variables de interpolación — MUY IMPORTANTE

Los JSON contienen variables entre dobles llaves: `{{name}}`, `{{year}}`, `{{message}}`, `{{count}}`, `{{days}}`, `{{grade}}`, `{{title}}`, `{{centerName}}`.

**NUNCA traduzcas lo que hay dentro de `{{ }}`**. Son nombres de variables JavaScript.

```json
// MAL ❌
"greeting": "Kaixo, {{izena}}, egun on."

// BIEN ✅
"greeting": "Kaixo, {{name}}, egun on."
```

---

## TAREA 2: Actualizar i18n.js

**Archivo**: `frontend/src/i18n/i18n.js`

**Estado actual:**
```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

const savedLang = localStorage.getItem('loggex-lang') || 'es';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('loggex-lang', lang);
};

export default i18n;
```

**Cambios a hacer (SOLO 2 cambios):**

1. Añadir los 3 imports nuevos después de `import en`:
```javascript
import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';
import gl from './locales/gl.json';
import eu from './locales/eu.json';
```

2. Añadir los 3 recursos en el objeto `resources`:
```javascript
    resources: {
      es: { translation: es },
      en: { translation: en },
      ca: { translation: ca },
      gl: { translation: gl },
      eu: { translation: eu },
    },
```

**NO cambies nada más**. No toques `fallbackLng`, `lng`, ni nada.

---

## TAREA 3: Actualizar LanguageSelector.jsx

**Archivo**: `frontend/src/components/LanguageSelector.jsx`

**Estado actual:**
```jsx
<select
  className={styles.selector}
  value={i18n.language}
  onChange={handleChange}
  aria-label="Language"
>
  <option value="es">ES</option>
  <option value="en">EN</option>
</select>
```

**Cambio a hacer — añadir 3 options:**
```jsx
<select
  className={styles.selector}
  value={i18n.language}
  onChange={handleChange}
  aria-label="Language"
>
  <option value="es">ES</option>
  <option value="en">EN</option>
  <option value="ca">CA</option>
  <option value="gl">GL</option>
  <option value="eu">EU</option>
</select>
```

**NO cambies nada más del componente**. No toques imports, no toques estilos, no toques la lógica.

---

## CHECKLIST DE VERIFICACIÓN

### Para cada JSON nuevo (ca, gl, eu):
- [ ] El archivo está en `frontend/src/i18n/locales/`
- [ ] El nombre es correcto: `ca.json`, `gl.json`, `eu.json`
- [ ] Es un JSON válido (sin comas finales, sin comillas sueltas)
- [ ] Tiene EXACTAMENTE la misma estructura de claves que `es.json`
- [ ] Tiene EXACTAMENTE el mismo número de claves que `es.json` (~952 líneas)
- [ ] Todas las variables `{{...}}` están intactas y sin traducir
- [ ] Los nombres de idiomas en `lang.*` son correctos en todos los archivos
- [ ] Los placeholders técnicos (URLs, emails, códigos) no se tradujeron
- [ ] El idioma es lingüísticamente correcto (catalán IEC, gallego RAG, euskera batúa)
- [ ] No se mezclaron idiomas (ej: castellanismo en un archivo catalán)

### Para i18n.js:
- [ ] Se añadieron los 3 imports
- [ ] Se añadieron los 3 recursos en `resources`
- [ ] No se tocó nada más

### Para LanguageSelector.jsx:
- [ ] Se añadieron las 3 options (CA, GL, EU)
- [ ] El orden es: ES, EN, CA, GL, EU
- [ ] No se tocó nada más

### Verificación final:
- [ ] `es.json` NO fue modificado
- [ ] `en.json` NO fue modificado
- [ ] Ningún otro archivo fue tocado (no .jsx, no .css, no .js aparte de i18n.js y LanguageSelector.jsx)

---

## ERRORES COMUNES QUE NO DEBES COMETER

### ERROR 1: Traducir las claves JSON
```json
// MAL ❌
{ "comú": { "desar": "Desar" } }

// BIEN ✅
{ "common": { "save": "Desar" } }
```

### ERROR 2: Traducir las variables de interpolación
```json
// MAL ❌
"greeting": "Hola, {{nom}}, que tinguis un bon dia."

// BIEN ✅
"greeting": "Hola, {{name}}, que tinguis un bon dia."
```

### ERROR 3: Cambiar la estructura del JSON
```json
// MAL ❌ (añadir claves extras)
"common": {
  "save": "Desar",
  "saveAll": "Desar tot"   ← ESTA CLAVE NO EXISTE EN es.json
}

// BIEN ✅ (mismas claves exactas)
"common": {
  "save": "Desar"
}
```

### ERROR 4: Dejar texto en español sin traducir
```json
// MAL ❌
"users": {
  "title": "Gestión de Usuarios"   ← esto es español, no catalán
}

// BIEN ✅
"users": {
  "title": "Gestió d'Usuaris"
}
```

### ERROR 5: JSON inválido
```json
// MAL ❌ (coma final)
{
  "common": {
    "save": "Desar",
  }
}

// BIEN ✅
{
  "common": {
    "save": "Desar"
  }
}
```

### ERROR 6: Usar castellanismos innecesarios
```json
// MAL ❌ (catalán con castellanismo)
"cancel": "Cancelar"

// BIEN ✅
"cancel": "Cancel·lar"
```

### ERROR 7: Traducir nombres propios
```json
// MAL ❌
"copyright": "© {{year}} Loggex-Makina v0.2"

// BIEN ✅
"copyright": "© {{year}} Loggex-Machina v0.2 - David Duque Díaz-en jabetza."
```
(En euskera "Propiedad de" → "...-(r)en jabetza". El nombre "Loggex-Machina" y "David Duque Díaz" no se tocan.)

### ERROR 8: Modificar archivos que no toca
```
// MAL ❌ — "voy a mejorar el LanguageSelector con banderas..."
// MAL ❌ — "voy a actualizar es.json con las nuevas claves..."
// MAL ❌ — "voy a crear un componente nuevo para..."

// BIEN ✅ — Solo creo ca.json, gl.json, eu.json, y edito i18n.js y LanguageSelector.jsx
```

---

## REFERENCIA RÁPIDA DE TÉRMINOS CLAVE

| Español | Català | Galego | Euskera |
|---------|--------|--------|---------|
| Guardar | Desar | Gardar | Gorde |
| Cancelar | Cancel·lar | Cancelar | Utzi |
| Eliminar | Eliminar | Eliminar | Ezabatu |
| Editar | Editar | Editar | Editatu |
| Buscar | Cercar | Buscar | Bilatu |
| Cargando | Carregant | Cargando | Kargatzen |
| Nombre | Nom | Nome | Izena |
| Apellidos | Cognoms | Apelidos | Abizenak |
| Contraseña | Contrasenya | Contrasinal | Pasahitza |
| Usuario | Usuari | Usuario | Erabiltzailea |
| Alumno | Alumne | Alumno | Ikaslea |
| Profesor | Professor | Profesor | Irakaslea |
| Centro | Centre | Centro | Ikastetxea |
| Grupo | Grup | Grupo | Taldea |
| Curso | Curs | Curso | Ikasturtea |
| Horario | Horari | Horario | Ordutegia |
| Festivo | Festiu | Festivo | Jaieguna |
| Tarea | Tasca | Tarefa | Zeregina |
| Entrega | Lliurament | Entrega | Bidalketa |
| Mensaje | Missatge | Mensaxe | Mezua |
| Perfil | Perfil | Perfil | Profila |
| Configuración | Configuració | Configuración | Konfigurazioa |
| Inicio | Inici | Inicio | Hasiera |
| Cerrar sesión | Tancar sessió | Pechar sesión | Saioa itxi |
| Matrículas | Matrícules | Matrículas | Matrikulak |
| Módulo | Mòdul | Módulo | Modulua |
| Ciclo Formativo | Cicle Formatiu | Ciclo Formativo | Heziketa Zikloa |
| Asistencia | Assistència | Asistencia | Bertaratzea |
| Falta | Falta | Falta | Hutsa |
| Retraso | Retard | Atraso | Atzerapena |
| Justificada | Justificada | Xustificada | Justifikatua |
| Nota | Nota | Nota | Nota |
| Apuntes | Apunts | Apuntamentos | Apunteak |
| Temario | Temari | Temario | Gai-zerrenda |
| Tablón | Tauler | Taboleiro | Iragarki-taula |
| Anuncio | Anunci | Anuncio | Iragarkia |
| Página no encontrada | Pàgina no trobada | Páxina non atopada | Orria ez da aurkitu |
| Acceso Denegado | Accés Denegat | Acceso Denegado | Sarbidea Ukatua |

Esta tabla es orientativa. Consulta el contexto completo de cada frase en `es.json` antes de traducir.
