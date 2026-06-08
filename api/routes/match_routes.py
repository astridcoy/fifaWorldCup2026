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
            SELECT p.*,
                   a.goles_local_apostado,
                   a.goles_visita_apostado,
                   COALESCE(a.intentos, 0) AS intentos
            FROM partidos p
            LEFT JOIN apuestas a ON a.id_partido = p.id AND a.id_usuario = %s
            ORDER BY NULLIF(p.grupo, '') ASC NULLS LAST, p.fecha ASC
        """, (request.usuario_id,))
        partidos = cur.fetchall()
        cur.close(); conn.close()
        return jsonify([row_as_dict(p) for p in partidos])
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@match_bp.route("/apostar", methods=["POST"])
@token_requerido
def apostar():
    datos        = request.get_json()
    id_partido   = datos.get("id_partido")
    goles_local  = datos.get("goles_local_apostado")
    goles_visita = datos.get("goles_visita_apostado")

    if goles_local is None or goles_visita is None:
        return jsonify({"error": "Debes ingresar ambos marcadores"}), 400
    try:
        goles_local  = int(goles_local)
        goles_visita = int(goles_visita)
    except (ValueError, TypeError):
        return jsonify({"error": "Los goles deben ser números enteros"}), 400
    if goles_local < 0 or goles_visita < 0:
        return jsonify({"error": "Los goles no pueden ser negativos"}), 400
    if goles_local > _MAX_GOLES or goles_visita > _MAX_GOLES:
        return jsonify({"error": f"El máximo permitido es {_MAX_GOLES} goles por equipo"}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()

        cur.execute("SELECT finalizado, fecha FROM partidos WHERE id = %s", (id_partido,))
        partido = cur.fetchone()
        if not partido:
            return jsonify({"error": "Partido no encontrado"}), 404
        if partido["finalizado"]:
            return jsonify({"error": "El partido ya finalizó, no puedes apostar"}), 400
        deadline = partido["fecha"] - timedelta(hours=24)
        if chile_now() >= deadline:
            return jsonify({"error": "Las apuestas cerraron 24 horas antes del partido"}), 400

        cur.execute(
            "SELECT intentos FROM apuestas WHERE id_usuario = %s AND id_partido = %s",
            (request.usuario_id, id_partido)
        )
        existente = cur.fetchone()

        if existente:
            if existente["intentos"] >= 2:
                cur.close(); conn.close()
                return jsonify({"error": "Ya usaste los 2 intentos permitidos para este partido"}), 400
            cur.execute("""
                UPDATE apuestas
                SET goles_local_apostado = %s, goles_visita_apostado = %s, intentos = intentos + 1
                WHERE id_usuario = %s AND id_partido = %s
            """, (goles_local, goles_visita, request.usuario_id, id_partido))
        else:
            cur.execute("""
                INSERT INTO apuestas (id_usuario, id_partido, goles_local_apostado, goles_visita_apostado, intentos)
                VALUES (%s, %s, %s, %s, 1)
            """, (request.usuario_id, id_partido, goles_local, goles_visita))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Apuesta registrada correctamente"})
    except Exception as e:
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
            cur.close(); conn.close()
            return jsonify({"error": "La Final ya comenzó, no puedes cambiar tu apuesta al campeón"}), 400
        cur.execute("""
            INSERT INTO apuesta_campeon (id_usuario, campeon) VALUES (%s, %s)
            ON CONFLICT (id_usuario) DO UPDATE SET campeon = EXCLUDED.campeon
        """, (request.usuario_id, campeon))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Campeón apostado correctamente"})
    except Exception as e:
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
                   COUNT(CASE WHEN a.puntos = 3 THEN 1 END) AS marcadores_exactos,
                   COUNT(CASE WHEN a.puntos = 1 THEN 1 END) AS ganadores_acertados,
                   COALESCE(ac.campeon, '') AS campeon_apostado
            FROM usuarios u
            LEFT JOIN apuestas a ON a.id_usuario = u.id
            LEFT JOIN apuesta_campeon ac ON ac.id_usuario = u.id
            GROUP BY u.id, u.nombre, u.foto_perfil, ac.puntos_campeon, ac.campeon
            ORDER BY total_puntos DESC
        """)
        ranking_data = cur.fetchall()
        cur.close(); conn.close()
        return jsonify([{**dict(f), "posicion": i + 1} for i, f in enumerate(ranking_data)])
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500
