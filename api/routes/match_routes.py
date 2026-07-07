from datetime import timedelta
from flask import Blueprint, request, jsonify
from database import get_db, row_as_dict, chile_now
from auth import token_requerido
from constants import BET_CLOSE_MINUTES, MAX_BET_ATTEMPTS, FASES_EXACTO

_MAX_GOLES = 10

match_bp = Blueprint("match", __name__)


@match_bp.route("/partidos", methods=["GET"])
@token_requerido
def listar_partidos():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT p.id, p.equipo_local, p.equipo_visita, p.bandera_local, p.bandera_visita,
                   p.fecha, p.goles_local, p.goles_visita, p.finalizado,
                   p.fase, p.grupo, p.nombre_estadio,
                   p.fue_penales, p.equipo_ganador_penales,
                   (p.imagen_estadio IS NOT NULL) AS tiene_imagen,
                   a.prediccion,
                   COALESCE(a.intentos, 0)      AS intentos,
                   COALESCE(a.puntos, 0)        AS puntos,
                   a.goles_local_apostado,
                   a.goles_visita_apostado,
                   a.predice_penales,
                   a.equipo_penales_pred
            FROM partidos p
            LEFT JOIN apuestas a ON a.id_partido = p.id AND a.id_usuario = %s
            ORDER BY NULLIF(p.grupo, '') ASC NULLS LAST, p.fecha ASC
        """, (request.usuario_id,))
        partidos = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([row_as_dict(p) for p in partidos])
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/partidos/<int:pid>/imagen", methods=["GET"])
@token_requerido
def get_partido_imagen(pid):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT imagen_estadio FROM partidos WHERE id = %s", (pid,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row or not row["imagen_estadio"]:
            return jsonify({"error": "Sin imagen"}), 404
        resp = jsonify({"imagen_estadio": row["imagen_estadio"]})
        resp.headers["Cache-Control"] = "private, max-age=86400"
        return resp
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/apostar", methods=["POST"])
@token_requerido
def apostar():
    datos      = request.get_json()
    id_partido = datos.get("id_partido")

    try:
        conn = get_db()
        cur  = conn.cursor()

        cur.execute(
            "SELECT finalizado, fecha, fase, equipo_local, equipo_visita FROM partidos WHERE id = %s",
            (id_partido,)
        )
        partido = cur.fetchone()
        if not partido:
            cur.close(); conn.close()
            return jsonify({"error": "Partido no encontrado"}), 404
        if partido["finalizado"]:
            cur.close(); conn.close()
            return jsonify({"error": "El partido ya finalizó, no puedes apostar"}), 400
        deadline = partido["fecha"] - timedelta(minutes=BET_CLOSE_MINUTES)
        if chile_now() >= deadline:
            cur.close(); conn.close()
            return jsonify({"error": f"Las apuestas cerraron {BET_CLOSE_MINUTES} minutos antes del partido"}), 400

        cur.execute(
            "SELECT intentos FROM apuestas WHERE id_usuario = %s AND id_partido = %s",
            (request.usuario_id, id_partido)
        )
        existente = cur.fetchone()
        if existente and existente["intentos"] >= MAX_BET_ATTEMPTS:
            cur.close(); conn.close()
            return jsonify({"error": f"Ya usaste los {MAX_BET_ATTEMPTS} intentos permitidos para este partido"}), 400

        fase = partido["fase"]

        if fase in FASES_EXACTO:
            # ── Apuesta con marcador exacto + predicción de penales ──────────
            try:
                gl = int(datos["goles_local"])
                gv = int(datos["goles_visita"])
            except (KeyError, TypeError, ValueError):
                cur.close(); conn.close()
                return jsonify({"error": "Se requieren goles_local y goles_visita como números"}), 400
            if gl < 0 or gv < 0:
                cur.close(); conn.close()
                return jsonify({"error": "Los goles no pueden ser negativos"}), 400

            predice_penales    = bool(datos.get("predice_penales", False))
            equipo_penales_pred = datos.get("equipo_penales_pred", "").strip() or None

            if predice_penales:
                equipos_validos = {partido["equipo_local"], partido["equipo_visita"]}
                if not equipo_penales_pred or equipo_penales_pred not in equipos_validos:
                    cur.close(); conn.close()
                    return jsonify({"error": "Indica qué equipo avanza en penales"}), 400

            # Derivar prediccion L/V para compatibilidad con votos_partido
            if gl > gv:
                prediccion = "L"
            elif gv > gl:
                prediccion = "V"
            else:
                prediccion = "L" if (predice_penales and equipo_penales_pred == partido["equipo_local"]) else "V"

            if existente:
                cur.execute("""
                    UPDATE apuestas
                       SET prediccion=%s, goles_local_apostado=%s, goles_visita_apostado=%s,
                           predice_penales=%s, equipo_penales_pred=%s, intentos=intentos+1
                     WHERE id_usuario=%s AND id_partido=%s
                """, (prediccion, gl, gv, predice_penales, equipo_penales_pred,
                      request.usuario_id, id_partido))
            else:
                cur.execute("""
                    INSERT INTO apuestas
                      (id_usuario, id_partido, prediccion, goles_local_apostado, goles_visita_apostado,
                       predice_penales, equipo_penales_pred, intentos)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,1)
                """, (request.usuario_id, id_partido, prediccion, gl, gv,
                      predice_penales, equipo_penales_pred))

        else:
            # ── Apuesta L/E/V clásica ────────────────────────────────────────
            prediccion = datos.get("prediccion")
            if prediccion not in ("L", "E", "V"):
                cur.close(); conn.close()
                return jsonify({"error": "Predicción inválida. Usa L, E o V"}), 400
            if prediccion == "E" and fase != "Grupos":
                cur.close(); conn.close()
                return jsonify({"error": "Este partido es de eliminación directa: no hay empate, elige Local o Visita"}), 400
            if existente:
                cur.execute("""
                    UPDATE apuestas SET prediccion=%s, intentos=intentos+1
                     WHERE id_usuario=%s AND id_partido=%s
                """, (prediccion, request.usuario_id, id_partido))
            else:
                cur.execute("""
                    INSERT INTO apuestas (id_usuario, id_partido, prediccion, intentos)
                    VALUES (%s,%s,%s,1)
                """, (request.usuario_id, id_partido, prediccion))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Apuesta registrada correctamente"})
    except Exception:
        import traceback; print("[apostar]", traceback.format_exc())
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/partidos/<int:pid>/votos", methods=["GET"])
@token_requerido
def votos_partido(pid):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT fecha, finalizado FROM partidos WHERE id = %s", (pid,))
        partido = cur.fetchone()
        if not partido:
            cur.close(); conn.close()
            return jsonify({"error": "Partido no encontrado"}), 404

        deadline = partido["fecha"] - timedelta(minutes=BET_CLOSE_MINUTES)
        if not partido["finalizado"] and chile_now() < deadline:
            cur.close(); conn.close()
            return jsonify({"error": "Las apuestas siguen abiertas. Los votos se revelan cuando cierren."}), 403

        cur.execute("""
            SELECT u.id AS id_usuario, u.nombre, u.foto_perfil, a.prediccion, a.puntos
            FROM apuestas a
            JOIN usuarios u ON u.id = a.id_usuario
            WHERE a.id_partido = %s
            ORDER BY u.nombre ASC
        """, (pid,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([row_as_dict(r) for r in rows])
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


_PODIO_CAMPOS   = ("campeon", "segundo_lugar", "tercer_lugar")
_PODIO_LABELS   = {"campeon": "campeón", "segundo_lugar": "2do lugar", "tercer_lugar": "3er lugar"}
_PODIO_INTENTOS = {"campeon": "intentos_campeon", "segundo_lugar": "intentos_segundo", "tercer_lugar": "intentos_tercero"}


def _apostar_podio(campo, equipo):
    """Apuesta a una posición del podio. Máximo MAX_BET_ATTEMPTS intentos por posición."""
    col_intentos = _PODIO_INTENTOS[campo]
    otros_campos = [c for c in _PODIO_CAMPOS if c != campo]
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM partidos
            WHERE fase = 'Final' AND fecha <= NOW() AT TIME ZONE 'America/Santiago'
        """)
        if cur.fetchone()["cnt"] > 0:
            return jsonify({"error": "La Final ya comenzó, no puedes apostar al podio"}), 400

        cols_check = ", ".join([col_intentos] + otros_campos)
        cur.execute(
            f"SELECT {cols_check} FROM apuesta_campeon WHERE id_usuario = %s",
            (request.usuario_id,)
        )
        fila = cur.fetchone()
        intentos_actual = fila[col_intentos] if fila else 0

        if intentos_actual >= MAX_BET_ATTEMPTS:
            return jsonify({"error": f"Ya usaste tus {MAX_BET_ATTEMPTS} intentos para {_PODIO_LABELS[campo]}"}), 400

        if fila and any(fila[c] and fila[c].lower() == equipo.lower() for c in otros_campos):
            return jsonify({"error": "Ya elegiste ese país para otra posición del podio"}), 400

        cur.execute(f"""
            INSERT INTO apuesta_campeon (id_usuario, {campo}, {col_intentos})
            VALUES (%s, %s, 1)
            ON CONFLICT (id_usuario) DO UPDATE
            SET {campo} = EXCLUDED.{campo},
                {col_intentos} = apuesta_campeon.{col_intentos} + 1
        """, (request.usuario_id, equipo))

        conn.commit()
        return jsonify({
            "mensaje":   f"{_PODIO_LABELS[campo].capitalize()} apostado correctamente",
            "intentos":  intentos_actual + 1
        })
    except Exception:
        conn.rollback()
        return jsonify({"error": "Error interno del servidor"}), 500
    finally:
        cur.close()
        conn.close()


@match_bp.route("/campeon", methods=["POST"])
@token_requerido
def apostar_campeon():
    equipo = (request.get_json(silent=True) or {}).get("campeon")
    if not equipo:
        return jsonify({"error": "Debes indicar un campeón"}), 400
    return _apostar_podio("campeon", equipo)


@match_bp.route("/segundo-lugar", methods=["POST"])
@token_requerido
def apostar_segundo():
    equipo = (request.get_json(silent=True) or {}).get("equipo")
    if not equipo:
        return jsonify({"error": "Debes indicar un equipo"}), 400
    return _apostar_podio("segundo_lugar", equipo)


@match_bp.route("/tercer-lugar", methods=["POST"])
@token_requerido
def apostar_tercero():
    equipo = (request.get_json(silent=True) or {}).get("equipo")
    if not equipo:
        return jsonify({"error": "Debes indicar un equipo"}), 400
    return _apostar_podio("tercer_lugar", equipo)


@match_bp.route("/ranking", methods=["GET"])
@token_requerido
def ranking():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.id, u.nombre, u.foto_perfil,
                   COALESCE(SUM(a.puntos), 0) + COALESCE(ac.puntos_campeon, 0)
                     + COALESCE(ac.puntos_segundo, 0) + COALESCE(ac.puntos_tercero, 0) AS total_puntos,
                   COUNT(CASE WHEN a.puntos > 0 THEN 1 END) AS aciertos,
                   COUNT(CASE WHEN a.puntos = 0 AND p.finalizado = TRUE THEN 1 END) AS errados,
                   (SELECT COUNT(*) FROM partidos WHERE finalizado = TRUE)
                     - COUNT(CASE WHEN p.finalizado = TRUE THEN 1 END) AS no_votados,
                   COALESCE(ac.campeon, '') AS campeon_apostado,
                   COALESCE(ac.segundo_lugar, '') AS segundo_apostado,
                   COALESCE(ac.tercer_lugar, '') AS tercer_apostado
            FROM usuarios u
            LEFT JOIN apuestas a ON a.id_usuario = u.id
            LEFT JOIN partidos p ON p.id = a.id_partido
            LEFT JOIN apuesta_campeon ac ON ac.id_usuario = u.id
            GROUP BY u.id, u.nombre, u.foto_perfil, ac.puntos_campeon, ac.campeon,
                     ac.puntos_segundo, ac.segundo_lugar, ac.puntos_tercero, ac.tercer_lugar
            ORDER BY total_puntos DESC, no_votados ASC, aciertos DESC, u.id ASC
        """)
        ranking_data = cur.fetchall()
        cur.close()
        conn.close()
        resp = jsonify([{**dict(f), "posicion": i + 1} for i, f in enumerate(ranking_data)])
        resp.headers["Cache-Control"] = "public, max-age=15"
        return resp
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500
