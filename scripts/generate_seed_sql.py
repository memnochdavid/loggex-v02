#!/usr/bin/env python3
"""
Genera INSERT SQL para poblar tareas, entregas y calificaciones
del centro Escuela Arte Granada (id=3).
Lee los datos existentes del backup y genera datos complementarios.
"""
import random
from datetime import datetime, timedelta

random.seed(42)  # Reproducible

# === DATOS DEL CENTRO ESCUELA ARTE GRANADA ===

# Imparticion: (id, profesor_id, modulo_id, grupo_id)
IMPARTICIONES = {
    23: (50, 43, 6),  # Alberto - Despliegue Apps - 2ºDAW
    24: (51, 36, 5),  # Joaquín - Entornos desarrollo - 1ºDAW
    25: (52, 37, 5),  # José - Lenguajes marcas - 1ºDAW
    26: (53, 38, 5),  # Walter - Programación - 1ºDAW
    27: (54, 39, 5),  # Clara - Sist. informáticos - 1ºDAW
    28: (55, 40, 5),  # Sara - FOL - 1ºDAW
    29: (56, 41, 6),  # María - Desarrollo Cliente - 2ºDAW
    30: (50, 42, 6),  # Alberto - Desarrollo Servidor - 2ºDAW
    31: (51, 43, 6),  # Joaquín - Despliegue Apps - 2ºDAW
    32: (52, 44, 6),  # José - Diseño Interfaces - 2ºDAW
    33: (53, 45, 6),  # Walter - EIE - 2ºDAW
    34: (52, 23, 7),  # José - Bases datos - 1ºDAM
    35: (53, 24, 7),  # Walter - Entornos desarrollo - 1ºDAM
    36: (54, 25, 7),  # Clara - Lenguajes marcas - 1ºDAM
    37: (55, 26, 7),  # Sara - Programación - 1ºDAM
    38: (56, 27, 7),  # María - Sist. informáticos - 1ºDAM
    39: (50, 28, 7),  # Alberto - FOL - 1ºDAM
    40: (51, 29, 8),  # Joaquín - Acceso datos - 2ºDAM
    41: (52, 30, 8),  # José - Desarrollo interfaces - 2ºDAM
    42: (53, 31, 8),  # Walter - Prog. multimedia - 2ºDAM
    43: (54, 32, 8),  # Clara - Servicios procesos - 2ºDAM
    44: (56, 33, 8),  # María - Sist. gestión - 2ºDAM
    45: (56, 34, 8),  # María - EIE - 2ºDAM
    46: (50, 35, 5),  # Alberto - Bases datos - 1ºDAW
}

MODULO_NOMBRES = {
    23: "Bases de datos", 24: "Entornos de desarrollo", 25: "Lenguajes de marcas",
    26: "Programación", 27: "Sistemas informáticos", 28: "FOL",
    29: "Acceso a datos", 30: "Desarrollo de interfaces", 31: "Programación multimedia",
    32: "Servicios y procesos", 33: "Sistemas de gestión", 34: "EIE",
    35: "Bases de datos", 36: "Entornos de desarrollo", 37: "Lenguajes de marcas",
    38: "Programación", 39: "Sistemas informáticos", 40: "FOL",
    41: "Desarrollo Cliente", 42: "Desarrollo Servidor", 43: "Despliegue Apps",
    44: "Diseño de Interfaces", 45: "EIE",
}

GRUPO_ALUMNOS = {
    5: [57, 58, 59, 60, 61],
    6: [62, 63, 64, 65, 66],
    7: [67, 68, 69, 70, 71],
    8: [72, 73, 74, 75, 76],
}

# Grupos de 1er curso: sep 2025 - jun 2026
# Grupos de 2o curso: sep 2025 - mar 2026
GRUPO_FECHAS = {
    5: (datetime(2025, 9, 15), datetime(2026, 6, 1)),
    6: (datetime(2025, 9, 15), datetime(2026, 2, 28)),
    7: (datetime(2025, 9, 15), datetime(2026, 6, 1)),
    8: (datetime(2025, 9, 15), datetime(2026, 2, 28)),
}

# Plantillas de tareas por tipo
TAREA_PLANTILLAS = [
    ("Examen Tema {n}", "examen", "<p>Examen teórico-práctico del Tema {n}. Incluye preguntas de desarrollo y ejercicios prácticos.</p>"),
    ("Examen Tema {n2}", "examen", "<p>Examen del Tema {n2}. Preguntas tipo test y desarrollo.</p>"),
    ("Ejercicios Tema {n}", "tarea", "<p>Realiza los ejercicios propuestos del Tema {n} del libro de texto.</p>"),
    ("Trabajo Tema {n2}", "tarea", "<p>Trabajo de investigación sobre los conceptos del Tema {n2}. Extensión mínima: 5 páginas.</p>"),
    ("Ejercicios repaso", "tarea", "<p>Ejercicios de repaso general. Entrega obligatoria.</p>"),
    ("Práctica de laboratorio {n}", "practica", "<p>Práctica guiada en el aula de informática. Seguir las instrucciones del enunciado adjunto.</p>"),
]

FEEDBACKS = [
    "Buen trabajo, sigue así.",
    "Correcto pero puedes mejorar la presentación.",
    "Excelente, muy bien estructurado.",
    "Necesitas repasar los conceptos básicos.",
    "Bien planteado pero con errores en la ejecución.",
    "Muy buen nivel de detalle.",
    "Falta profundizar en algunos apartados.",
    "Trabajo completo y bien documentado.",
    "Has mejorado respecto al anterior, ánimo.",
    "Revisa las conclusiones, están incompletas.",
    "Correcto.",
    "Bien.",
    "Notable trabajo.",
    "Flojo, hay que esforzarse más.",
    "Buen enfoque práctico.",
    None, None, None, None, None,  # ~25% sin feedback
    None, None, None, None, None,
]

COMENTARIOS_ALUMNO = [
    "Entregado.",
    "Aquí va mi entrega.",
    "He tenido dudas en el ejercicio 3 pero creo que está bien.",
    "Entrega completada.",
    "Lo he revisado dos veces.",
    None, None, None, None,  # ~45% sin comentario
]


def sql_str(val):
    """Escapa un string para SQL o devuelve NULL."""
    if val is None:
        return "NULL"
    val = val.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{val}'"


def sql_dt(dt):
    """Formatea datetime para SQL."""
    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"


def random_grade():
    """Genera nota con distribución realista (media ~6.5)."""
    nota = random.gauss(6.5, 1.8)
    nota = max(0.0, min(10.0, nota))
    return round(nota, 1)


def distribute_dates(start, end, count):
    """Distribuye N fechas uniformemente entre start y end."""
    total_days = (end - start).days
    if total_days <= 0 or count <= 0:
        return []
    step = total_days / (count + 1)
    dates = []
    for i in range(1, count + 1):
        d = start + timedelta(days=int(step * i))
        # Ajustar a día laborable (lun-vie)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        dates.append(d)
    return dates


def get_modulo_name(modulo_id):
    return MODULO_NOMBRES.get(modulo_id, f"Módulo {modulo_id}")


def main():
    # IDs existentes - empezamos después de estos
    next_tarea_id = 17
    next_entrega_id = 10
    next_calif_id = 10

    tareas = []       # (id, titulo, desc, fechaLimite, visible, imparticion_id, fechaInicio, tipo, created_at, updated_at, deleted, deleted_at, archivo)
    entregas = []     # (id, fecha_entrega, comentario, tarea_id, alumno_id, enlace, created_at, updated_at, deleted, deleted_at, archivo)
    calificaciones = []  # (id, nota, feedback, entrega_id, created_at, updated_at, deleted, deleted_at)

    created_at = "2026-03-16 15:00:00"

    for imp_id, (prof_id, mod_id, grupo_id) in IMPARTICIONES.items():
        inicio, fin = GRUPO_FECHAS[grupo_id]
        modulo_name = get_modulo_name(mod_id)
        alumnos = GRUPO_ALUMNOS[grupo_id]

        # Distribuir 6 fechas límite a lo largo del curso
        fechas_limite = distribute_dates(inicio, fin, 6)

        for i, (plantilla_titulo, tipo, plantilla_desc) in enumerate(TAREA_PLANTILLAS):
            n = i // 2 + 1
            n2 = n + 2
            titulo = f"{modulo_name} - {plantilla_titulo.format(n=n, n2=n2)}"
            desc = plantilla_desc.format(n=n, n2=n2)
            fecha_limite = fechas_limite[i] if i < len(fechas_limite) else fin - timedelta(days=7)
            # fechaInicio = 2 semanas antes de la fecha límite
            fecha_inicio = fecha_limite - timedelta(days=14)

            tarea_id = next_tarea_id
            next_tarea_id += 1

            tareas.append((
                tarea_id,
                titulo,
                desc,
                fecha_limite.replace(hour=23, minute=59),
                1,  # visible
                imp_id,
                fecha_inicio.replace(hour=8, minute=30),
                tipo,
                created_at,
                None,  # updated_at
                0,     # deleted
                None,  # deleted_at
                None,  # archivo
            ))

            # Crear entregas para cada alumno
            for alumno_id in alumnos:
                entrega_id = next_entrega_id
                next_entrega_id += 1

                # Fecha de entrega: entre fecha_inicio y fecha_limite (+/- algo)
                dias_margen = (fecha_limite - fecha_inicio).days
                dias_offset = random.randint(0, max(1, dias_margen))
                fecha_entrega = fecha_inicio + timedelta(days=dias_offset,
                                                         hours=random.randint(8, 22),
                                                         minutes=random.randint(0, 59))
                comentario = random.choice(COMENTARIOS_ALUMNO)

                entregas.append((
                    entrega_id,
                    fecha_entrega,
                    comentario,
                    tarea_id,
                    alumno_id,
                    None,  # enlace
                    created_at,
                    None,
                    0,
                    None,
                    None,  # archivo
                ))

                # Calificación
                calif_id = next_calif_id
                next_calif_id += 1
                nota = random_grade()
                feedback = random.choice(FEEDBACKS)

                calificaciones.append((
                    calif_id,
                    nota,
                    feedback,
                    entrega_id,
                    created_at,
                    None,
                    0,
                    None,
                ))

    # === GENERAR SQL ===

    # Tareas existentes (mantener)
    print("-- =============================================")
    print("-- SEED: Tareas, Entregas y Calificaciones")
    print("-- Centro: Escuela Arte Granada (id=3)")
    print("-- Generado automáticamente")
    print("-- =============================================")
    print()

    # TAREAS
    print("-- Nuevas tareas (IDs 17+)")
    print("INSERT INTO `tarea` VALUES")
    lines = []
    for t in tareas:
        vals = (
            str(t[0]),                           # id
            sql_str(t[1]),                        # titulo
            sql_str(t[2]),                        # descripcion
            sql_dt(t[3]),                         # fecha_limite
            str(t[4]),                            # visible
            str(t[5]),                            # imparticion_id
            sql_dt(t[6]) if t[6] else "NULL",     # fecha_inicio
            sql_str(t[7]),                        # tipo
            f"'{t[8]}'",                          # created_at
            "NULL" if t[9] is None else sql_dt(t[9]),  # updated_at
            str(t[10]),                           # deleted
            "NULL",                               # deleted_at
            "NULL",                               # archivo
        )
        lines.append(f"({','.join(vals)})")
    print(",\n".join(lines) + ";")
    print()

    # ENTREGAS
    print("-- Nuevas entregas (IDs 10+)")
    print("INSERT INTO `entrega` VALUES")
    lines = []
    for e in entregas:
        vals = (
            str(e[0]),                            # id
            sql_dt(e[1]),                         # fecha_entrega
            sql_str(e[2]),                        # comentario_alumno
            str(e[3]),                            # tarea_id
            str(e[4]),                            # alumno_id
            sql_str(e[5]),                        # enlace
            f"'{e[6]}'",                          # created_at
            "NULL" if e[7] is None else sql_dt(e[7]),  # updated_at
            str(e[8]),                            # deleted
            "NULL",                               # deleted_at
            "NULL",                               # archivo
        )
        lines.append(f"({','.join(vals)})")
    print(",\n".join(lines) + ";")
    print()

    # CALIFICACIONES
    print("-- Nuevas calificaciones (IDs 10+)")
    print("INSERT INTO `calificacion` VALUES")
    lines = []
    for c in calificaciones:
        vals = (
            str(c[0]),                            # id
            str(c[1]),                            # nota
            sql_str(c[2]),                        # feedback_profesor
            str(c[3]),                            # entrega_id
            f"'{c[4]}'",                          # created_at
            "NULL" if c[5] is None else sql_dt(c[5]),  # updated_at
            str(c[6]),                            # deleted
            "NULL",                               # deleted_at
        )
        lines.append(f"({','.join(vals)})")
    print(",\n".join(lines) + ";")

    print()
    print(f"-- Resumen: {len(tareas)} tareas, {len(entregas)} entregas, {len(calificaciones)} calificaciones")


if __name__ == "__main__":
    main()
