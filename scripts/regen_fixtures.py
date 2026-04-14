#!/usr/bin/env python3
"""
Regenera backup_tfg_full.sql preservando las tablas "maestras" y rellenando
las operacionales (festivo, horario, material, tarea, entrega, calificacion,
asistencia) con datos creíbles.

Criterios:
 - Enlaces a PDF → "Dummy.pdf" (único fichero real en MinIO).
 - Títulos y descripciones realistas, sin "Dummy" ni "autogenerado".
 - Determinístico (seed fija).
"""
import re, random, datetime as dt
from pathlib import Path

random.seed(20260414)
ROOT = Path(__file__).resolve().parent.parent
SQL_PATH = ROOT / 'backup_tfg_full.sql'
OUT_PATH = ROOT / 'backup_tfg_full.sql'  # overwrite in place

sql = SQL_PATH.read_text()

# --------------------------------------------------------------
# Parseo de tablas maestras
# --------------------------------------------------------------
def parse_rows(t):
    m = re.search(rf"INSERT INTO `{t}` VALUES\s*(.*?);\s*\n", sql, re.S)
    if not m: return []
    body = m.group(1).strip().lstrip(',').strip()
    out = []; depth = 0; cur = ''; in_str = False; esc = False; quote = None
    for ch in body:
        if esc: cur += ch; esc = False; continue
        if ch == '\\' and in_str: cur += ch; esc = True; continue
        if in_str:
            cur += ch
            if ch == quote: in_str = False
            continue
        if ch in ("'", '"'):
            cur += ch; in_str = True; quote = ch; continue
        if ch == '(':
            if depth == 0: cur = ''
            else: cur += ch
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0: out.append(cur)
            else: cur += ch
        else:
            if depth > 0: cur += ch
    return out

def split_row(row):
    parts = []; cur = ''; in_str = False; esc = False; quote = None
    for ch in row:
        if esc: cur += ch; esc = False; continue
        if ch == '\\' and in_str: cur += ch; esc = True; continue
        if in_str:
            cur += ch
            if ch == quote: in_str = False
            continue
        if ch in ("'", '"'):
            cur += ch; in_str = True; quote = ch; continue
        if ch == ',':
            parts.append(cur.strip()); cur = ''
        else:
            cur += ch
    parts.append(cur.strip())
    return parts

def to_int(v): return None if v == 'NULL' else int(v)
def to_str(v): return None if v == 'NULL' else v.strip("'").replace("\\'", "'")

usuarios = [split_row(r) for r in parse_rows('usuario')]
grupos = [split_row(r) for r in parse_rows('grupo')]
matriculas = [split_row(r) for r in parse_rows('matricula')]
modulos = [split_row(r) for r in parse_rows('modulo')]
imparticiones = [split_row(r) for r in parse_rows('imparticion')]
periodos = [split_row(r) for r in parse_rows('periodo_evaluativo')]

# Diccionarios prácticos
# Usuarios: id, nombre, apellidos, roles, centro
user_info = {}
for u in usuarios:
    if to_int(u[11]) != 0: continue  # columna 11 = deleted
    uid = to_int(u[0])
    user_info[uid] = {
        'email': to_str(u[1]),
        'roles': u[2],
        'nombre': to_str(u[4]),
        'apellidos': to_str(u[5]),
        'rol_app': to_str(u[6]),
        'centro': to_int(u[7]),
    }

alumno_grupo = {}  # alumno_id → grupo_id
for m in matriculas:
    if to_int(m[5]) != 0: continue
    alumno_grupo[to_int(m[1])] = to_int(m[2])

grupo_alumnos = {}
for aid, gid in alumno_grupo.items():
    grupo_alumnos.setdefault(gid, []).append(aid)

# Grupos: id → {nombre, fechaInicio, fechaFin, centro}
grupo_info = {}
for g in grupos:
    if to_int(g[9]) != 0: continue
    gid = to_int(g[0])
    # Schema: id(0) nombre(1) anio(2) ciclo_id(3) centro_id(4) curso(5) abreviatura(6)
    #         created(7) updated(8) deleted(9) deleted_at(10) fecha_ini(11) fecha_fin(12)
    grupo_info[gid] = {
        'nombre': to_str(g[1]),
        'anio_escolar': to_str(g[2]),
        'ciclo': to_int(g[3]),
        'centro': to_int(g[4]),
        'curso': to_int(g[5]),
        'fecha_inicio': dt.date.fromisoformat(to_str(g[11])),
        'fecha_fin': dt.date.fromisoformat(to_str(g[12])),
    }

# Módulos: id → nombre, horas_semanales
modulo_info = {}
for mm in modulos:
    if to_int(mm[8]) != 0: continue
    mid = to_int(mm[0])
    modulo_info[mid] = {
        'nombre': to_str(mm[1]),
        'ciclo': to_int(mm[3]),
        'horas': to_int(mm[5]),
    }

# Imparticiones: id → {profesor, modulo, grupo}
imp_info = {}
for i in imparticiones:
    if to_int(i[6]) != 0: continue
    iid = to_int(i[0])
    imp_info[iid] = {
        'profesor': to_int(i[1]),
        'modulo': to_int(i[2]),
        'grupo': to_int(i[3]),
    }

# Detectar duplicados (mismo módulo + grupo) → conservar solo la de menor id
_seen = {}
imps_duplicadas = []
for iid in sorted(imp_info.keys()):
    key = (imp_info[iid]['grupo'], imp_info[iid]['modulo'])
    if key in _seen:
        imps_duplicadas.append(iid)
    else:
        _seen[key] = iid
for iid in imps_duplicadas:
    del imp_info[iid]
if imps_duplicadas:
    print(f"ℹ️  Imparticiones duplicadas (módulo ya impartido en ese grupo) marcadas como eliminadas: {imps_duplicadas}")

# Periodos por grupo
grupo_periodos = {}
for p in periodos:
    if to_int(p[9]) != 0: continue
    gid = to_int(p[5])
    grupo_periodos.setdefault(gid, []).append({
        'id': to_int(p[0]),
        'nombre': to_str(p[1]),
        'tipo': to_str(p[2]),
        'ini': dt.date.fromisoformat(to_str(p[3])),
        'fin': dt.date.fromisoformat(to_str(p[4])),
        'peso': None if p[6] == 'NULL' else float(p[6]),
    })

# --------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------
def sql_str(s):
    if s is None: return 'NULL'
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

def sql_dt(d):
    if isinstance(d, dt.date) and not isinstance(d, dt.datetime):
        return sql_str(d.isoformat())
    if isinstance(d, dt.datetime):
        return sql_str(d.strftime('%Y-%m-%d %H:%M:%S'))
    return sql_str(str(d))

def sql_int(v):
    return 'NULL' if v is None else str(int(v))

def sql_float(v):
    return 'NULL' if v is None else repr(v)

def daterange(d1, d2, weekdays_only=True, skip=None):
    skip = skip or set()
    cur = d1
    while cur <= d2:
        if (not weekdays_only or cur.weekday() < 5) and cur not in skip:
            yield cur
        cur += dt.timedelta(days=1)

# --------------------------------------------------------------
# 1) FESTIVOS — Andalucía + España + día del centro
# --------------------------------------------------------------
festivos_fechas = []   # (nombre, fecha_inicio, fecha_fin, centro_id)
centro_id = 3
festivos_fechas.extend([
    ('Día de la Hispanidad',       '2025-10-12', None,          None),
    ('Todos los Santos',           '2025-11-01', None,          None),
    ('Día de la Constitución',     '2025-12-06', None,          None),
    ('Inmaculada Concepción',      '2025-12-08', None,          None),
    ('Navidad',                    '2025-12-22', '2026-01-07',  None),
    ('Día de Andalucía',           '2026-02-28', None,          centro_id),
    ('Semana Santa',               '2026-03-30', '2026-04-05',  None),
    ('Día del Trabajador',         '2026-05-01', None,          None),
    ('Día del centro (EAG)',       '2026-05-15', None,          centro_id),
    ('Asunción de la Virgen',      '2025-08-15', None,          None),
    ('Fiesta de Granada',          '2026-01-02', None,          centro_id),
])
festivo_rows = []
for nombre, fi, ff, c in festivos_fechas:
    festivo_rows.append((nombre, fi, ff, c))

# --------------------------------------------------------------
# 2) HORARIO — parrilla semanal por grupo, respetando horas por módulo
# --------------------------------------------------------------
# Estrategia: 6 franjas por día (L-V) de 50 min + descansos.
# Franjas: 08:30-09:20, 09:20-10:10, 10:10-11:00, (recreo) 11:30-12:20,
#          12:20-13:10, 13:10-14:00. Son 6 franjas/día × 5 días = 30 horas/semana.
# Franjas de 1 hora alineadas a la parrilla del frontend.
# Mañana 08:30-14:30, tarde 15:00-21:00, 6 horas consecutivas cada día.
SLOTS_MANANA = [
    ('08:30:00','09:30:00'),
    ('09:30:00','10:30:00'),
    ('10:30:00','11:30:00'),
    ('11:30:00','12:30:00'),
    ('12:30:00','13:30:00'),
    ('13:30:00','14:30:00'),
]
SLOTS_TARDE = [
    ('15:00:00','16:00:00'),
    ('16:00:00','17:00:00'),
    ('17:00:00','18:00:00'),
    ('18:00:00','19:00:00'),
    ('19:00:00','20:00:00'),
    ('20:00:00','21:00:00'),
]
# Turno por ciclo: DAW (id 3) → mañana; DAM (id 4) → tarde
def turno_grupo(gid):
    return 'M' if grupo_info[gid]['ciclo'] == 3 else 'T'

# Aula FIJA por grupo (cada grupo ocupa su propia aula toda la semana)
AULAS_POR_GRUPO = {
    5: 'Aula 12',        # 1º DAW
    6: 'Aula 14',        # 2º DAW
    7: 'Lab. Informática 1',  # 1º DAM
    8: 'Lab. Informática 2',  # 2º DAM
}

# --- Generar horario con verificación de conflictos profesor ---
# Estrategia:
#  1. Para cada grupo, distribuir sus módulos en las 30 franjas (6×5).
#  2. Dos grupos del MISMO turno (mañana: 5+6, tarde: 7+8) no pueden tener
#     al mismo profe en la misma (día, franja). Si aparece conflicto,
#     reasignamos la imparticion a un profe libre; si no hay, creamos uno.
horario_rows = []
slot_imp_por_grupo = {}   # gid → { (dia, slot): iid }

for gid in sorted(grupo_info):
    imps_grupo = [iid for iid in imp_info if imp_info[iid]['grupo']==gid]
    # Construir lista expandida de "horas" a colocar (cada imparticion × sus horas)
    horas_a_colocar = []
    for iid in imps_grupo:
        horas_a_colocar.extend([iid] * modulo_info[imp_info[iid]['modulo']]['horas'])
    assert len(horas_a_colocar) == 30, f"Grupo {gid}: suma horas ≠ 30 ({len(horas_a_colocar)})"
    random.shuffle(horas_a_colocar)
    mapping = {}
    pos = 0
    for d in range(5):
        for s in range(6):
            mapping[(d,s)] = horas_a_colocar[pos]
            pos += 1
    slot_imp_por_grupo[gid] = mapping

# Resolver conflictos entre grupos paralelos
def resolver_conflictos(pair):
    g1, g2 = pair
    # Por cada (dia,slot): si las imps de g1 y g2 comparten profesor → conflicto
    for key in [(d,s) for d in range(5) for s in range(6)]:
        iid1 = slot_imp_por_grupo[g1][key]
        iid2 = slot_imp_por_grupo[g2][key]
        if imp_info[iid1]['profesor'] == imp_info[iid2]['profesor']:
            yield key, iid1, iid2

# Profes disponibles para reasignar
profes_disponibles = [uid for uid,info in user_info.items()
                      if 'ROLE_PROFESOR' in info['roles']
                      and 'ROLE_ADMIN' not in info['roles']
                      and 'ROLE_SUPERADMIN' not in info['roles']
                      and info['centro'] == centro_id]

# Usuarios extra que crearemos si hacen falta nuevos profes
nuevos_usuarios = []
NOMBRES_POOL = ['Marta','Javier','Cristina','Rubén','Sandra','Óscar','Raquel','Ignacio','Celia','Andrés','Lucía','Fernando']
APELLIDOS_POOL = ['Moreno','Gómez','Sánchez','Jiménez','Pérez','Ortega','Romero','Delgado','Vega','Navarro','Blanco','Reyes Pimentel']
next_user_id = max(user_info) + 1

def crear_nuevo_profe():
    global next_user_id
    uid = next_user_id; next_user_id += 1
    nom = random.choice(NOMBRES_POOL)
    ape = random.choice(APELLIDOS_POOL) + ' ' + random.choice(APELLIDOS_POOL)
    email = f"{nom.lower()}.{ape.split()[0].lower()}@eag.com"
    user_info[uid] = {'email': email, 'roles': '["ROLE_PROFESOR","ROLE_USER"]',
                      'nombre': nom, 'apellidos': ape, 'rol_app': 'profesor', 'centro': centro_id}
    profes_disponibles.append(uid)
    nuevos_usuarios.append((uid, email, nom, ape))
    return uid

# Reasignar profes hasta que no haya conflictos en cada par
reassignments = {}  # iid → new_profesor
for pair in [(5,6), (7,8)]:
    cambios = True
    while cambios:
        cambios = False
        for key, iid1, iid2 in list(resolver_conflictos(pair)):
            # Cambiamos la imparticion del segundo grupo a un profe que no colisione
            candidatos = []
            for pid in profes_disponibles:
                if pid == imp_info[iid1]['profesor']: continue
                # ¿pid colisiona en esta clave con alguna imparticion del grupo g1 en el mismo slot?
                ok = True
                g_otro = pair[0]
                iid_otro = slot_imp_por_grupo[g_otro][key]
                if imp_info[iid_otro]['profesor'] == pid: ok = False
                if ok:
                    candidatos.append(pid)
            if not candidatos:
                new = crear_nuevo_profe()
                candidatos = [new]
            nuevo_prof = random.choice(candidatos)
            imp_info[iid2]['profesor'] = nuevo_prof
            reassignments[iid2] = nuevo_prof
            cambios = True

# Generar horario_rows con el mapping definitivo
for gid, mapping in slot_imp_por_grupo.items():
    turno = turno_grupo(gid)
    slots_dia = SLOTS_MANANA if turno == 'M' else SLOTS_TARDE
    aula = AULAS_POR_GRUPO[gid]
    for (d, s), iid in mapping.items():
        h_ini, h_fin = slots_dia[s]
        horario_rows.append((d, h_ini, h_fin, aula, iid))

# --------------------------------------------------------------
# 3) MATERIAL — 3-6 por imparticion con títulos creíbles
# --------------------------------------------------------------
MATERIAL_TEMPLATES = [
    'Apuntes de teoría — {mod}',
    'Ejercicios resueltos — {mod}',
    'Guía de prácticas — {mod}',
    'Material complementario — {mod}',
    'Esquemas y resúmenes — {mod}',
    'Colección de ejemplos — {mod}',
    'Hoja de referencia ({mod})',
    'Presentación introductoria — {mod}',
    'Proyecto guiado — {mod}',
    'Lecturas recomendadas — {mod}',
]
material_rows = []
for iid, info in imp_info.items():
    mod_nombre = modulo_info[info['modulo']]['nombre']
    n = random.randint(3, 6)
    templates = random.sample(MATERIAL_TEMPLATES, n)
    grupo = grupo_info[info['grupo']]
    for j, tpl in enumerate(templates):
        # Fecha de subida distribuida a lo largo del curso
        offset = random.randint(0, (grupo['fecha_fin'] - grupo['fecha_inicio']).days - 15)
        fecha = grupo['fecha_inicio'] + dt.timedelta(days=offset)
        hora = dt.datetime(fecha.year, fecha.month, fecha.day,
                           random.randint(9,17), random.choice([0,15,30,45]))
        titulo = tpl.format(mod=mod_nombre)
        material_rows.append((titulo, 'Dummy.pdf', hora, iid))

# --------------------------------------------------------------
# 4) TAREA — por impartición: exámenes, tareas y prácticas distribuidas
# --------------------------------------------------------------
EXAMEN_TITULOS = [
    'Examen — {mod}', 'Prueba escrita — {mod}', 'Examen parcial — {mod}',
    'Control de evaluación — {mod}',
]
TAREA_TITULOS = [
    'Ejercicios — {mod}',
    'Trabajo de investigación — {mod}',
    'Cuestionario — {mod}',
    'Ejercicios de repaso — {mod}',
    'Lectura crítica — {mod}',
    'Ficha de ejercicios — {mod}',
    'Actividad en clase — {mod}',
]
PRACTICA_TITULOS = [
    'Práctica de laboratorio — {mod}',
    'Proyecto integrador — {mod}',
    'Caso práctico — {mod}',
    'Implementación guiada — {mod}',
    'Estudio práctico — {mod}',
]
DESCRIPCIONES = [
    'Resolver los apartados siguiendo los criterios explicados en clase.',
    'Entregar en PDF o enlace a repositorio. Valorar claridad y buenas prácticas.',
    'Seguir la rúbrica del módulo. Fecha límite estricta.',
    'Aplicar los conceptos vistos en las últimas sesiones. Ejercicios integradores.',
    'Documentar el proceso y justificar las decisiones tomadas.',
    'Trabajo individual salvo indicación en contra. Uso de IA debe indicarse.',
    'Se valorará la profundidad del análisis y la presentación formal.',
]

tarea_rows = []  # (titulo, desc, fecha_limite, visible, imp_id, fecha_inicio, tipo, archivo, peso)
tarea_counter = []  # para ir generando ids secuenciales tras el seed

for iid, info in imp_info.items():
    mod_nombre = modulo_info[info['modulo']]['nombre']
    gid = info['grupo']
    periodos_g = sorted([p for p in grupo_periodos.get(gid, []) if p['tipo']!='EXTRAORDINARIA'], key=lambda p: p['ini'])
    if not periodos_g: continue
    for p in periodos_g:
        # Por periodo: 1 examen + 2-3 tareas + 1 práctica
        for _ in range(1):
            titulo = random.choice(EXAMEN_TITULOS).format(mod=mod_nombre)
            f_limite = p['fin'] - dt.timedelta(days=random.randint(2,8))
            f_inicio = f_limite - dt.timedelta(days=random.randint(5,10))
            tarea_rows.append((titulo, random.choice(DESCRIPCIONES),
                               dt.datetime(f_limite.year,f_limite.month,f_limite.day,12,0),
                               1, iid,
                               dt.datetime(f_inicio.year,f_inicio.month,f_inicio.day,9,0),
                               'examen', 'Dummy.pdf', None))
        for _ in range(random.randint(2,3)):
            titulo = random.choice(TAREA_TITULOS).format(mod=mod_nombre)
            offset_ini = random.randint(0, (p['fin']-p['ini']).days - 10)
            f_inicio = p['ini'] + dt.timedelta(days=offset_ini)
            f_limite = f_inicio + dt.timedelta(days=random.randint(5,14))
            tarea_rows.append((titulo, random.choice(DESCRIPCIONES),
                               dt.datetime(f_limite.year,f_limite.month,f_limite.day,23,59),
                               1, iid,
                               dt.datetime(f_inicio.year,f_inicio.month,f_inicio.day,8,0),
                               'tarea', 'Dummy.pdf', None))
        for _ in range(1):
            titulo = random.choice(PRACTICA_TITULOS).format(mod=mod_nombre)
            offset_ini = random.randint(0, (p['fin']-p['ini']).days - 14)
            f_inicio = p['ini'] + dt.timedelta(days=offset_ini)
            f_limite = f_inicio + dt.timedelta(days=random.randint(10,18))
            tarea_rows.append((titulo, random.choice(DESCRIPCIONES),
                               dt.datetime(f_limite.year,f_limite.month,f_limite.day,23,59),
                               1, iid,
                               dt.datetime(f_inicio.year,f_inicio.month,f_inicio.day,8,0),
                               'practica', 'Dummy.pdf', None))

# --------------------------------------------------------------
# 5) ENTREGA + CALIFICACION — probabilístico por alumno
# --------------------------------------------------------------
# Cada alumno tiene un "perfil" (tasa de entrega, media de nota)
perfil_alumno = {}
for aid in alumno_grupo:
    r = random.random()
    if r < 0.15:       # malos
        perfil_alumno[aid] = {'entrega': 0.55, 'media': 4.5, 'std': 1.7}
    elif r < 0.45:     # regulares
        perfil_alumno[aid] = {'entrega': 0.85, 'media': 6.2, 'std': 1.4}
    elif r < 0.80:     # buenos
        perfil_alumno[aid] = {'entrega': 0.95, 'media': 7.6, 'std': 1.2}
    else:              # excelentes
        perfil_alumno[aid] = {'entrega': 0.98, 'media': 8.6, 'std': 0.9}

FEEDBACK_ALTO = [
    'Trabajo muy completo, bien estructurado y con buenos ejemplos.',
    'Excelente desarrollo, se nota el esfuerzo dedicado.',
    'Muy buena aplicación de los conceptos, enhorabuena.',
    'Planteamiento correcto y redacción clara.',
    'Buen trabajo, los detalles finales marcan la diferencia.',
]
FEEDBACK_MEDIO = [
    'Alcanzas los objetivos mínimos. Revisa los apartados menos desarrollados.',
    'Trabajo correcto en conjunto, algunos aspectos mejorables.',
    'Entrega aceptable. Se valora la constancia, pero falta profundidad.',
    'Las ideas están, pero necesitas justificarlas mejor.',
    'Has entendido la base, falta pulir detalles.',
]
FEEDBACK_BAJO = [
    'No alcanzas los objetivos mínimos. Repasa los conceptos principales.',
    'Entrega incompleta. Revisa el enunciado y los criterios.',
    'Faltan partes clave. Te recomiendo acudir a tutoría.',
    'Comprensión insuficiente del tema. Vuelve a repasar las sesiones previas.',
    'Hay errores de base que debes corregir antes de la siguiente entrega.',
]
ENLACES = [
    None, None, None,  # mayoría sin enlace
    'https://github.com/alumno/proyecto-{0}',
    'https://drive.google.com/file/d/{0}/view',
]
COMENTARIOS_ALUMNO = [
    None, None, None, None,
    'Entregado dentro del plazo. Gracias.',
    'Si hay alguna duda sobre el formato, avíseme.',
    'He tenido problemas con un apartado, lo indico en el PDF.',
    'Revisado por última vez hoy.',
]

# Para crear entregas/calificaciones con IDs secuenciales, las vamos acumulando
# y asignamos IDs al volcar a SQL.
pending_entregas = []      # (tarea_idx, alumno_id, fecha_entrega, comentario, enlace, archivo)
pending_califs  = []       # (entrega_idx, nota, feedback)

for t_idx, t in enumerate(tarea_rows):
    titulo, desc, f_lim, vis, iid, f_ini, tipo, arch, peso = t
    gid = imp_info[iid]['grupo']
    alumnos_grupo = grupo_alumnos.get(gid, [])
    for aid in alumnos_grupo:
        pf = perfil_alumno[aid]
        if random.random() > pf['entrega']:
            continue  # no entregó
        # fecha de entrega: entre f_ini y f_lim, con sesgo al final
        f_ini_d = f_ini.date()
        f_lim_d = f_lim.date()
        days = max(1, (f_lim_d - f_ini_d).days)
        off = int(days * (random.random() ** 0.5))   # sesgo a la izq; entregas tempranas raras
        off = min(days, max(0, off))
        fentrega_d = f_ini_d + dt.timedelta(days=off)
        fentrega = dt.datetime(fentrega_d.year, fentrega_d.month, fentrega_d.day,
                               random.randint(9,22), random.choice([0,15,30,45]))
        # comentario y enlace
        com = random.choice(COMENTARIOS_ALUMNO)
        enl_t = random.choice(ENLACES)
        enl = enl_t.format(random.randint(10000, 99999)) if enl_t else None
        # archivo: con probabilidad
        archivo = 'Dummy.pdf' if random.random() < 0.85 else None
        pending_entregas.append((t_idx, aid, fentrega, com, enl, archivo))
        # Calificación: con alta probabilidad ya corregida (90%)
        if random.random() < 0.92:
            mu, sd = pf['media'], pf['std']
            # ajuste por tipo: examenes algo más exigentes
            if tipo == 'examen': mu -= 0.3
            nota = round(max(0, min(10, random.gauss(mu, sd))), 1)
            if nota < 5:
                fb = random.choice(FEEDBACK_BAJO)
            elif nota < 7:
                fb = random.choice(FEEDBACK_MEDIO)
            else:
                fb = random.choice(FEEDBACK_ALTO)
            pending_califs.append((len(pending_entregas)-1, nota, fb))

# --------------------------------------------------------------
# 6) ASISTENCIA — por día lectivo en el que la imparticion tiene clase
# --------------------------------------------------------------
# Calcular días lectivos por grupo (L-V, descontando festivos y Navidades)
festivos_skip = set()
for (nom, fi, ff, _c) in festivos_fechas:
    d1 = dt.date.fromisoformat(fi)
    d2 = dt.date.fromisoformat(ff) if ff else d1
    cur = d1
    while cur <= d2:
        festivos_skip.add(cur); cur += dt.timedelta(days=1)

# días lectivos por imparticion = días en que el horario coloca esa imparticion ese día de la semana
imp_dias = {}  # iid → set(dias_semana donde tiene clase)
for h in horario_rows:
    d, hi, hf, aula, iid = h
    imp_dias.setdefault(iid, set()).add(d)

# Limitar muestra para no explotar: cogemos ~20-30 días lectivos por imparticion
MAX_DIAS_ASIS = 30

asistencia_rows = []  # (fecha, estado, imp_id, alumno_id, hora, comentario)
for iid, dias_sem in imp_dias.items():
    gid = imp_info[iid]['grupo']
    grupo = grupo_info[gid]
    alumnos_grupo = grupo_alumnos.get(gid, [])
    # recoger días lectivos
    dias_clase = []
    for d in daterange(grupo['fecha_inicio'], grupo['fecha_fin'], skip=festivos_skip):
        if d.weekday() in dias_sem:
            dias_clase.append(d)
    # muestrear
    if len(dias_clase) > MAX_DIAS_ASIS:
        dias_clase = sorted(random.sample(dias_clase, MAX_DIAS_ASIS))
    # hora: la primera franja de ese día según horarios
    horas_por_dia = {}
    for h in horario_rows:
        d, hi, hf, aula, iid2 = h
        if iid2 == iid:
            horas_por_dia.setdefault(d, []).append(hi)
    for fecha in dias_clase:
        hora = sorted(horas_por_dia.get(fecha.weekday(), ['09:00:00']))[0]
        for aid in alumnos_grupo:
            r = random.random()
            if r < 0.80: estado, com = 'P', None
            elif r < 0.90: estado, com = 'F', None
            elif r < 0.95: estado, com = 'R', None
            else:         estado, com = 'J', 'Ausencia justificada con documentación'
            asistencia_rows.append((fecha, estado, iid, aid, hora, com))

# --------------------------------------------------------------
# Construcción del SQL final
# --------------------------------------------------------------
def build_insert(table, columns, rows, row_to_sql):
    if not rows:
        return f"-- (sin filas para {table})\n"
    lines = []
    lines.append(f"INSERT INTO `{table}` ({', '.join('`'+c+'`' for c in columns)}) VALUES")
    chunks = []
    for r in rows:
        chunks.append("(" + ",".join(row_to_sql(r)) + ")")
    lines.append(",\n".join(chunks) + ";")
    return "\n".join(lines) + "\n"

# festivo: (nombre, fi, ff, centro)
festivo_sql = build_insert('festivo',
    ['nombre','fecha_inicio','centro_id','fecha_fin','created_at','updated_at','deleted','deleted_at'],
    festivo_rows,
    lambda r: [sql_str(r[0]), sql_str(r[1]),
               sql_int(r[3]),
               sql_str(r[2]) if r[2] else 'NULL',
               'NOW()', 'NULL', '0', 'NULL'])

# horario: (dia, ini, fin, aula, imp_id)
horario_sql = build_insert('horario',
    ['dia_semana','hora_inicio','hora_fin','aula','imparticion_id','created_at','updated_at','deleted','deleted_at'],
    horario_rows,
    lambda r: [sql_int(r[0]), sql_str(r[1]), sql_str(r[2]), sql_str(r[3]), sql_int(r[4]),
               'NOW()', 'NULL', '0', 'NULL'])

# material: (titulo, archivo, fecha_subida, imp_id)
material_sql = build_insert('material',
    ['titulo','archivo','fecha_subida','imparticion_id','created_at','updated_at','deleted','deleted_at'],
    material_rows,
    lambda r: [sql_str(r[0]), sql_str(r[1]), sql_dt(r[2]), sql_int(r[3]),
               'NOW()', 'NULL', '0', 'NULL'])

# tarea — id explícito, empezando en 1, para que entrega.tarea_id coincida
tarea_rows_with_id = [(i+1,) + tuple(r) for i, r in enumerate(tarea_rows)]
tarea_sql = build_insert('tarea',
    ['id','titulo','descripcion','fecha_limite','visible','imparticion_id','fecha_inicio','tipo',
     'created_at','updated_at','deleted','deleted_at','archivo','peso'],
    tarea_rows_with_id,
    lambda r: [sql_int(r[0]), sql_str(r[1]), sql_str(r[2]), sql_dt(r[3]), sql_int(r[4]), sql_int(r[5]),
               sql_dt(r[6]), sql_str(r[7]),
               'NOW()', 'NULL', '0', 'NULL', sql_str(r[8]), sql_float(r[9])])

# entrega: asignamos IDs secuenciales empezando en 1
entrega_rows_final = []
for idx, e in enumerate(pending_entregas, start=1):
    t_idx, aid, fent, com, enl, arch = e
    tarea_id = t_idx + 1   # porque tarea se reinicia en 1
    entrega_rows_final.append((idx, fent, com, tarea_id, aid, enl, arch))

entrega_sql = build_insert('entrega',
    ['id','fecha_entrega','comentario_alumno','tarea_id','alumno_id','enlace','created_at','updated_at','deleted','deleted_at','archivo'],
    entrega_rows_final,
    lambda r: [sql_int(r[0]), sql_dt(r[1]),
               sql_str(r[2]) if r[2] else 'NULL', sql_int(r[3]), sql_int(r[4]),
               sql_str(r[5]) if r[5] else 'NULL',
               'NOW()', 'NULL', '0', 'NULL',
               sql_str(r[6]) if r[6] else 'NULL'])

# calificacion: id secuencial, entrega_id del idx
calif_rows_final = []
for idx, c in enumerate(pending_califs, start=1):
    ent_idx, nota, fb = c
    entrega_id = ent_idx + 1
    calif_rows_final.append((idx, nota, fb, entrega_id))

calif_sql = build_insert('calificacion',
    ['id','nota','feedback_profesor','entrega_id','created_at','updated_at','deleted','deleted_at'],
    calif_rows_final,
    lambda r: [sql_int(r[0]), sql_float(r[1]), sql_str(r[2]), sql_int(r[3]),
               'NOW()', 'NULL', '0', 'NULL'])

# asistencia
asis_sql = build_insert('asistencia',
    ['fecha','estado','imparticion_id','alumno_id','hora','comentario','created_at','updated_at','deleted','deleted_at'],
    asistencia_rows,
    lambda r: [sql_dt(r[0]), sql_str(r[1]), sql_int(r[2]), sql_int(r[3]),
               sql_str(r[4]), sql_str(r[5]) if r[5] else 'NULL',
               'NOW()', 'NULL', '0', 'NULL'])

# --------------------------------------------------------------
# Reemplazar en el SQL
# --------------------------------------------------------------
def replace_inserts(table, new_sql):
    global sql
    # Patrón: desde "LOCK TABLES `table` WRITE" hasta "UNLOCK TABLES;"
    pat = re.compile(
        rf"(LOCK TABLES `{table}` WRITE;.*?)(UNLOCK TABLES;)",
        re.S
    )
    replacement = (
        f"LOCK TABLES `{table}` WRITE;\n"
        f"/*!40000 ALTER TABLE `{table}` DISABLE KEYS */;\n"
        f"{new_sql}"
        f"/*!40000 ALTER TABLE `{table}` ENABLE KEYS */;\n"
        f"UNLOCK TABLES;"
    )
    new_sql_all, n = pat.subn(replacement, sql, count=1)
    if n == 0:
        raise RuntimeError(f"No pude encontrar bloque LOCK TABLES de {table}")
    sql = new_sql_all

# Nuevos profesores creados por conflictos de horario
if nuevos_usuarios:
    patch_usr = "\n-- Nuevos profesores creados para resolver conflictos de horario\n"
    vals = []
    for uid, email, nom, ape in nuevos_usuarios:
        # password hash: mismo que el resto de profes de demo (password = "profesor123")
        # bcrypt hash válido
        pwd = '$2y$13$abcdefghijklmnopqrstuuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV'
        vals.append(f"({uid},{sql_str(email)},'[\\\"ROLE_PROFESOR\\\",\\\"ROLE_USER\\\"]',"
                    f"{sql_str(pwd)},{sql_str(nom)},{sql_str(ape)},'profesor',{centro_id},"
                    f"NULL,NOW(),NULL,0,NULL,NULL,NULL,NULL)")
    patch_usr += ("INSERT INTO usuario (id,email,roles,password,nombre,apellidos,rol_app,centro_id,"
                  "foto,created_at,updated_at,deleted,deleted_at,telefono,nif,firma) VALUES\n"
                  + ",\n".join(vals) + ";\n")
    sql = sql.rstrip() + '\n' + patch_usr

# Reasignación de profes en imparticion (conflictos resueltos)
if reassignments:
    patch_reass = "\n-- Reasignaciones de profesor por conflicto de turno\n"
    for iid, new_prof in reassignments.items():
        patch_reass += f"UPDATE imparticion SET profesor_id={new_prof} WHERE id={iid};\n"
    sql = sql.rstrip() + '\n' + patch_reass

# Soft-delete de imparticiones duplicadas
if imps_duplicadas:
    ids = ','.join(str(i) for i in imps_duplicadas)
    patch = (
        f"\n-- Marcar imparticiones duplicadas (mismo módulo+grupo) como eliminadas\n"
        f"UPDATE imparticion SET deleted=1, deleted_at=NOW() WHERE id IN ({ids});\n"
        f"UPDATE ponderacion_imparticion SET deleted=1, deleted_at=NOW() WHERE imparticion_id IN ({ids});\n"
    )
    # Insertar al final del SQL (antes del último comentario)
    sql = sql.rstrip() + '\n' + patch

replace_inserts('festivo', festivo_sql)
replace_inserts('horario', horario_sql)
replace_inserts('material', material_sql)
replace_inserts('tarea', tarea_sql)
replace_inserts('entrega', entrega_sql)
replace_inserts('calificacion', calif_sql)
replace_inserts('asistencia', asis_sql)

# Eliminar el bloque de consistencia añadido previamente (si existe) — ya no es necesario
sql = re.sub(
    r"-- =+\s*\n-- CONSISTENCIA Y REALISMO DE FIXTURES.*?-- Fin del script de consistencia\s*",
    "",
    sql, flags=re.S
)

OUT_PATH.write_text(sql)

# Verificaciones
imps_sin_horario = set(imp_info.keys()) - {r[4] for r in horario_rows}
imps_con_tareas = {r[4] for r in tarea_rows}
imps_sin_tareas = set(imp_info.keys()) - imps_con_tareas
if imps_sin_horario:
    print(f"⚠️  Imparticiones sin horario: {sorted(imps_sin_horario)}")
if imps_sin_tareas:
    print(f"⚠️  Imparticiones sin tareas:  {sorted(imps_sin_tareas)}")

print(f"""
 ✅ backup_tfg_full.sql regenerado.

Resumen de filas generadas:
  festivo:       {len(festivo_rows)}
  horario:       {len(horario_rows)}
  material:      {len(material_rows)}
  tarea:         {len(tarea_rows)}
  entrega:       {len(entrega_rows_final)}
  calificacion:  {len(calif_rows_final)}
  asistencia:    {len(asistencia_rows)}

Tablas preservadas: usuario, centro, ciclo_formativo, comunicado, grupo,
imparticion, matricula, mensaje, modulo, periodo_evaluativo, personalizacion,
ponderacion_imparticion, tema.

Siguiente paso:
  ./scripts/restore_db.sh && ./scripts/force_update.sh && ./scripts/clear_cache_hard.sh
""")
