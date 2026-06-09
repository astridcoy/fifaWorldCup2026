from datetime import timedelta
from flask import Blueprint, request, jsonify
from database import get_db, row_as_dict, chile_now
from auth import token_requerido

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
                   (p.imagen_estadio IS NOT NULL) AS tiene_imagen,
                   a.prediccion,
                   COALESCE(a.intentos, 0) AS intentos
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
    prediccion = datos.get("prediccion")

    if prediccion not in ("L", "E", "V"):
        return jsonify({"error": "Predicción inválida. Usa L (local gana), E (empate) o V (visita gana)"}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()

        cur.execute("SELECT finalizado, fecha FROM partidos WHERE id = %s", (id_partido,))
        partido = cur.fetchone()
        if not partido:
            return jsonify({"error": "Partido no encontrado"}), 404
        if partido["finalizado"]:
            return jsonify({"error": "El partido ya finalizó, no puedes apostar"}), 400
        deadline = partido["fecha"] - timedelta(hours=1)
        if chile_now() >= deadline:
            return jsonify({"error": "Las apuestas cerraron 1 hora antes del partido"}), 400

        cur.execute(
            "SELECT intentos FROM apuestas WHERE id_usuario = %s AND id_partido = %s",
            (request.usuario_id, id_partido)
        )
        existente = cur.fetchone()

        if existente:
            if existente["intentos"] >= 2:
                cur.close()
                conn.close()
                return jsonify({"error": "Ya usaste los 2 intentos permitidos para este partido"}), 400
            cur.execute("""
                UPDATE apuestas SET prediccion = %s, intentos = intentos + 1
                WHERE id_usuario = %s AND id_partido = %s
            """, (prediccion, request.usuario_id, id_partido))
        else:
            cur.execute("""
                INSERT INTO apuestas (id_usuario, id_partido, prediccion, intentos)
                VALUES (%s, %s, %s, 1)
            """, (request.usuario_id, id_partido, prediccion))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Apuesta registrada correctamente"})
    except Exception:
        import traceback; print("[apostar]", traceback.format_exc())
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/campeon", methods=["POST"])
@token_requerido
def apostar_campeon():
    datos   = request.get_json()
    campeon = datos.get("campeon")
    if not campeon:
        return jsonify({"error": "Debes indicar un campeón"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM partidos
            WHERE fase = 'Final' AND fecha <= NOW() AT TIME ZONE 'America/Santiago'
        """)
        if cur.fetchone()["cnt"] > 0:
            cur.close()
            conn.close()
            return jsonify({"error": "La Final ya comenzó, no puedes cambiar tu apuesta al campeón"}), 400
        cur.execute("""
            INSERT INTO apuesta_campeon (id_usuario, campeon) VALUES (%s, %s)
            ON CONFLICT (id_usuario) DO UPDATE SET campeon = EXCLUDED.campeon
        """, (request.usuario_id, campeon))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Campeón apostado correctamente"})
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/ranking", methods=["GET"])
@token_requerido
def ranking():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.id, u.nombre, u.foto_perfil,
                   COALESCE(SUM(a.puntos), 0) + COALESCE(ac.puntos_campeon, 0) AS total_puntos,
                   COUNT(CASE WHEN a.puntos > 0 THEN 1 END) AS aciertos,
                   COALESCE(ac.campeon, '') AS campeon_apostado
            FROM usuarios u
            LEFT JOIN apuestas a ON a.id_usuario = u.id
            LEFT JOIN apuesta_campeon ac ON ac.id_usuario = u.id
            GROUP BY u.id, u.nombre, u.foto_perfil, ac.puntos_campeon, ac.campeon
            ORDER BY total_puntos DESC
        """)
        ranking_data = cur.fetchall()
        cur.close()
        conn.close()
        resp = jsonify([{**dict(f), "posicion": i + 1} for i, f in enumerate(ranking_data)])
        resp.headers["Cache-Control"] = "public, max-age=15"
        return resp
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500
