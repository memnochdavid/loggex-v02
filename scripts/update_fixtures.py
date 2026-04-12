import re

sql_path = '/home/david/Documentos/CLASE/loggex-v02/backup_tfg_full.sql'
with open(sql_path, 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Rellenar huecos (NULLs) en archivos de entregas y tareas existentes
def replace_null_archivo(match):
    table_name = match.group(1)
    values = match.group(2)
    values = values.replace(',0,NULL,NULL)', ",0,NULL,'Dummy.pdf')")
    values = values.replace(',0,NULL,NULL);', ",0,NULL,'Dummy.pdf');")
    return f"INSERT INTO `{table_name}` VALUES\n{values}"

sql = re.sub(r"INSERT INTO `(entrega|tarea)` VALUES\n(.*?)(?=\n/\*!40000)", replace_null_archivo, sql, flags=re.DOTALL)

# Reemplazar todos los PDFs existentes por Dummy.pdf
sql = re.sub(r"'[^']*?\.pdf'", "'Dummy.pdf'", sql)

# 2. Parsear relaciones para rellenar huecos masivamente
tarea_imparticion = {}
for match in re.finditer(r"INSERT INTO `tarea` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),.*,'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',\d+,(\d+),", line.strip())
        if m:
            tarea_imparticion[int(m.group(1))] = int(m.group(2))

alumno_grupos = {}
for match in re.finditer(r"INSERT INTO `matricula` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),(\d+),(\d+),", line.strip())
        if m:
            a_id = int(m.group(2))
            g_id = int(m.group(3))
            alumno_grupos.setdefault(a_id, set()).add(g_id)

imparticion_grupo = {}
for match in re.finditer(r"INSERT INTO `imparticion` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),(\d+),(\d+),(\d+),", line.strip())
        if m:
            i_id = int(m.group(1))
            g_id = int(m.group(4))
            imparticion_grupo[i_id] = g_id

existing_entregas = set()
max_ent_id = 0
for match in re.finditer(r"INSERT INTO `entrega` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',.*?,(\d+),(\d+),", line.strip())
        if m:
            e_id = int(m.group(1))
            t_id = int(m.group(2))
            a_id = int(m.group(3))
            existing_entregas.add((t_id, a_id))
            max_ent_id = max(max_ent_id, e_id)

max_cal_id = 0
for match in re.finditer(r"INSERT INTO `calificacion` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),", line.strip())
        if m:
            max_cal_id = max(max_cal_id, int(m.group(1)))

new_entregas = []
new_calificaciones = []

ent_id = max_ent_id + 1
cal_id = max_cal_id + 1

for t_id, i_id in tarea_imparticion.items():
    g_id = imparticion_grupo.get(i_id)
    if not g_id: continue

    for a_id, grupos in alumno_grupos.items():
        if g_id in grupos:
            if (t_id, a_id) not in existing_entregas:
                new_entregas.append(f"({ent_id},'2026-03-22 10:00:00','Entrega autogenerada',{t_id},{a_id},NULL,'2026-03-22 10:00:00',NULL,0,NULL,'Dummy.pdf')")
                new_calificaciones.append(f"({cal_id},7.5,'Buen trabajo (autogenerado)',{ent_id},'2026-03-22 10:00:00',NULL,0,NULL)")
                ent_id += 1
                cal_id += 1

if new_entregas:
    new_entregas_str = ",\n".join(new_entregas)
    def add_entregas(match):
        values = match.group(1).rstrip()
        if values.endswith(';'):
            values = values[:-1] + ",\n" + new_entregas_str + ";"
        else:
            values = values + ",\n" + new_entregas_str
        return f"INSERT INTO `entrega` VALUES\n{values}"
    sql = re.sub(r"INSERT INTO `entrega` VALUES\n(.*?)(?=\n/\*!40000)", add_entregas, sql, flags=re.DOTALL)

if new_calificaciones:
    new_calificaciones_str = ",\n".join(new_calificaciones)
    def add_calif(match):
        values = match.group(1).rstrip()
        if values.endswith(';'):
            values = values[:-1] + ",\n" + new_calificaciones_str + ";"
        else:
            values = values + ",\n" + new_calificaciones_str
        return f"INSERT INTO `calificacion` VALUES\n{values}"
    sql = re.sub(r"INSERT INTO `calificacion` VALUES\n(.*?)(?=\n/\*!40000)", add_calif, sql, flags=re.DOTALL)

max_mat_id = 0
for match in re.finditer(r"INSERT INTO `material` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),", line.strip())
        if m:
            max_mat_id = max(max_mat_id, int(m.group(1)))

new_materials = []
m_id = max_mat_id + 1
for i_id in imparticion_grupo.keys():
    new_materials.append(f"({m_id},'Temario Completo - Dummy','Dummy.pdf','2026-03-22 10:00:00',{i_id},'2026-03-22 10:00:00',NULL,0,NULL)")
    m_id += 1
    new_materials.append(f"({m_id},'Ejercicios Extra - Dummy','Dummy.pdf','2026-03-22 10:00:00',{i_id},'2026-03-22 10:00:00',NULL,0,NULL)")
    m_id += 1

if new_materials:
    new_materials_str = ",\n".join(new_materials)
    def add_materials(match):
        values = match.group(1).rstrip()
        if values.endswith(';'):
            values = values[:-1] + ",\n" + new_materials_str + ";"
        else:
            values = values + ",\n" + new_materials_str
        return f"INSERT INTO `material` VALUES\n{values}"
    sql = re.sub(r"INSERT INTO `material` VALUES\n(.*?)(?=\n/\*!40000)", add_materials, sql, flags=re.DOTALL)

max_ast_id = 0
existing_asistencias = set()
for match in re.finditer(r"INSERT INTO `asistencia` VALUES\n(.*?)(?=\n/\*!40000)", sql, flags=re.DOTALL):
    for line in match.group(1).split('\n'):
        m = re.search(r"^\((\d+),'([^']+)','[^']+',(\d+),(\d+),", line.strip())
        if m:
            max_ast_id = max(max_ast_id, int(m.group(1)))
            existing_asistencias.add((m.group(2), int(m.group(3)), int(m.group(4))))

new_asistencias = []
ast_id = max_ast_id + 1
for i_id, g_id in imparticion_grupo.items():
    for a_id, grupos in alumno_grupos.items():
        if g_id in grupos:
            for date in ['2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25']:
                if (date, i_id, a_id) not in existing_asistencias:
                    new_asistencias.append(f"({ast_id},'{date}','P',{i_id},{a_id},'08:30:00','Autogenerado','2026-03-22 10:00:00','2026-03-22 10:00:00',0,NULL)")
                    ast_id += 1

if new_asistencias:
    new_asistencias_str = ",\n".join(new_asistencias)
    def add_asistencias(match):
        values = match.group(1).rstrip()
        if values.endswith(';'):
            values = values[:-1] + ",\n" + new_asistencias_str + ";"
        else:
            values = values + ",\n" + new_asistencias_str
        return f"INSERT INTO `asistencia` VALUES\n{values}"
    sql = re.sub(r"INSERT INTO `asistencia` VALUES\n(.*?)(?=\n/\*!40000)", add_asistencias, sql, flags=re.DOTALL)

with open(sql_path, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"✅ ¡Archivo backup_tfg_full.sql actualizado con los nuevos fixtures! Se han añadido {len(new_entregas)} entregas, {len(new_calificaciones)} calificaciones, {len(new_materials)} materiales y {len(new_asistencias)} asistencias.")