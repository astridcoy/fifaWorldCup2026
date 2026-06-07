"""
app.py — Backend principal de la Polla FIFA 2026
Flask + PostgreSQL + JWT
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import bcrypt
import jwt
import os
import secrets
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from functools import wraps
from zoneinfo import ZoneInfo

SANTIAGO = ZoneInfo("America/Santiago")

def chile_now():
    """Hora actual en Santiago (naive, sin tzinfo), para comparar con fechas guardadas en la DB."""
    return datetime.now(SANTIAGO).replace(tzinfo=None)

def row_as_dict(row):
    """Convierte una fila de psycopg2 a dict serializando datetime como ISO string.
    Evita que Flask 3 convierta los datetime a 'Thu, 11 Jun 2026 15:00:00 GMT' (UTC).
    """
    result = {}
    for k, v in dict(row).items():
        if isinstance(v, datetime):
            result[k] = v.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            result[k] = v
    return result

app = Flask(__name__)

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

SECRET_KEY   = os.environ.get("SECRET_KEY", "mundial2026_clave_secreta_cambiar_en_produccion")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://usuario:contraseña@localhost:5432/polla_mundial")

SMTP_HOST    = os.environ.get("SMTP_HOST", "")
SMTP_PORT    = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER    = os.environ.get("SMTP_USER", "")
SMTP_PASS    = os.environ.get("SMTP_PASS", "")
SMTP_FROM    = os.environ.get("SMTP_FROM", "") or SMTP_USER
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://juega-fifa2026.netlify.app")


# ─────────────────────────────────────────────
# CONEXIÓN A BASE DE DATOS
# ─────────────────────────────────────────────
def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def init_db():
    """Migrations: add new columns if they don't exist yet."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT")
        cur.execute("ALTER TABLE apuestas ADD COLUMN IF NOT EXISTS intentos INT NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token TEXT")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP")
        cur.execute("ALTER TABLE partidos ADD COLUMN IF NOT EXISTS grupo TEXT")
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[init_db] warning: {e}")


def send_reset_email(to_email, token):
    link = f"{FRONTEND_URL}/reset-password.html?token={token}"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Recupera tu contraseña — Polla FIFA 2026"
    msg["From"]    = SMTP_FROM
    msg["To"]      = to_email

    text = (f"Hola,\n\nHaz clic en este enlace para restablecer tu contraseña:\n{link}\n\n"
            "El enlace expira en 1 hora.\n\nSi no solicitaste este cambio, ignora este mensaje.")
    html = f"""<div style="font-family:sans-serif;max-width:480px;margin:auto">
<h2 style="color:#E8192C">Polla FIFA 2026 🏆</h2>
<p>Haz clic en el botón para restablecer tu contraseña:</p>
<a href="{link}" style="display:inline-block;padding:12px 24px;background:#E8192C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Restablecer contraseña</a>
<p style="margin-top:16px;color:#666;font-size:.85rem">
  Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.
</p>
</div>"""

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())

init_db()


# ─────────────────────────────────────────────
# MIDDLEWARE JWT
# ─────────────────────────────────────────────
def token_requerido(f):
    @wraps(f)
    def decorada(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        if not token:
            return jsonify({"error": "Token requerido"}), 401
        try:
            datos = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.usuario_id = datos["id"]
            request.usuario_rol = datos.get("rol", "usuario")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorada


def solo_admin(f):
    @wraps(f)
    @token_requerido
    def decorada(*args, **kwargs):
        if request.usuario_rol != "admin":
            return jsonify({"error": "Acceso restringido a administradores"}), 403
        return f(*args, **kwargs)
    return decorada


# ─────────────────────────────────────────────
# RUTAS DE AUTENTICACIÓN
# ─────────────────────────────────────────────
@app.route("/registro", methods=["POST"])
def registro():
    datos = request.get_json()
    nombre = datos.get("nombre", "").strip()
    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")

    if not nombre or not email or not password:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400

    hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, 'usuario') RETURNING id",
            (nombre, email, hash_pw)
        )
        usuario_id = cur.fetchone()["id"]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Usuario registrado correctamente", "id": usuario_id}), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está registrado"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    datos = request.get_json()
    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE email = %s", (email,))
        usuario = cur.fetchone()
        cur.close()
        conn.close()

        if not usuario or not bcrypt.checkpw(password.encode(), usuario["password"].encode()):
            return jsonify({"error": "Credenciales incorrectas"}), 401

        token = jwt.encode(
            {
                "id": usuario["id"],
                "nombre": usuario["nombre"],
                "rol": usuario["rol"],
                "exp": datetime.utcnow() + timedelta(hours=24)
            },
            SECRET_KEY,
            algorithm="HS256"
        )
        return jsonify({
            "token": token,
            "nombre": usuario["nombre"],
            "rol": usuario["rol"],
            "id": usuario["id"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# RECUPERACIÓN DE CONTRASEÑA
# ─────────────────────────────────────────────
@app.route("/recuperar-password", methods=["POST"])
def recuperar_password():
    datos = request.get_json()
    email = datos.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "El email es obligatorio"}), 400
    if not SMTP_HOST or not SMTP_USER:
        return jsonify({"error": "El servicio de email no está configurado en el servidor"}), 503
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        usuario = cur.fetchone()
        if usuario:
            token  = secrets.token_urlsafe(32)
            expiry = datetime.utcnow() + timedelta(hours=1)
            cur.execute(
                "UPDATE usuarios SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
                (token, expiry, usuario["id"])
            )
            conn.commit()
            send_reset_email(email, token)
        cur.close()
        conn.close()
        # Siempre responder igual para no revelar si el email existe
        return jsonify({"mensaje": "Si el correo está registrado, recibirás un enlace en breve."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/reset-password", methods=["POST"])
def reset_password():
    datos    = request.get_json()
    token    = datos.get("token", "").strip()
    password = datos.get("password", "")
    if not token or not password:
        return jsonify({"error": "Token y contraseña son obligatorios"}), 400
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, reset_token_expiry FROM usuarios WHERE reset_token = %s",
            (token,)
        )
        usuario = cur.fetchone()
        if not usuario:
            cur.close(); conn.close()
            return jsonify({"error": "El enlace es inválido o ya fue usado"}), 400
        if datetime.utcnow() > usuario["reset_token_expiry"]:
            cur.close(); conn.close()
            return jsonify({"error": "El enlace ha expirado. Solicita uno nuevo."}), 400
        hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            "UPDATE usuarios SET password = %s, reset_token = NULL, reset_token_expiry = NULL WHERE id = %s",
            (hash_pw, usuario["id"])
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Contraseña actualizada correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# RUTAS DE PERFIL
# ─────────────────────────────────────────────
@app.route("/perfil", methods=["GET"])
@token_requerido
def obtener_perfil():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, nombre, email, foto_perfil FROM usuarios WHERE id = %s",
            (request.usuario_id,)
        )
        usuario = cur.fetchone()
        cur.close()
        conn.close()
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify(dict(usuario))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/perfil", methods=["PUT"])
@token_requerido
def actualizar_perfil():
    datos  = request.get_json()
    nombre = datos.get("nombre", "").strip()
    email  = datos.get("email",  "").strip().lower()
    password = datos.get("password", "")

    if not nombre or not email:
        return jsonify({"error": "Nombre y email son obligatorios"}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()

        sets   = ["nombre = %s", "email = %s"]
        values = [nombre, email]

        if password:
            hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            sets.append("password = %s")
            values.append(hash_pw)

        # "foto_perfil" presente en el JSON (aunque sea null) → actualizar columna
        if "foto_perfil" in datos:
            sets.append("foto_perfil = %s")
            values.append(datos["foto_perfil"])  # puede ser null → borra la foto

        values.append(request.usuario_id)
        cur.execute(
            f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s",
            values
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Perfil actualizado correctamente"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está en uso por otro usuario"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# RUTAS DE PARTIDOS
# ─────────────────────────────────────────────
@app.route("/partidos", methods=["GET"])
@token_requerido
def listar_partidos():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.*,
                   a.goles_local_apostado,
                   a.goles_visita_apostado,
                   COALESCE(a.intentos, 0) AS intentos
            FROM partidos p
            LEFT JOIN apuestas a ON a.id_partido = p.id AND a.id_usuario = %s
            ORDER BY p.fecha ASC
        """, (request.usuario_id,))
        partidos = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([row_as_dict(p) for p in partidos])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/partido", methods=["POST"])
def crear_partido():
    datos = request.get_json()
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO partidos (equipo_local, equipo_visita, fecha, fase, bandera_local, bandera_visita, grupo)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            datos["equipo_local"], datos["equipo_visita"],
            datos["fecha"], datos.get("fase", "Grupos"),
            datos.get("bandera_local", ""), datos.get("bandera_visita", ""),
            datos.get("grupo", "")
        ))
        partido_id = cur.fetchone()["id"]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Partido creado", "id": partido_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/partido/<int:partido_id>", methods=["PUT"])
def editar_partido(partido_id):
    datos = request.get_json()
    equipo_local   = datos.get("equipo_local", "").strip()
    equipo_visita  = datos.get("equipo_visita", "").strip()
    fecha          = datos.get("fecha")
    fase           = datos.get("fase", "Grupos")
    bandera_local  = datos.get("bandera_local", "")
    bandera_visita = datos.get("bandera_visita", "")
    grupo          = datos.get("grupo", "")
    finalizado     = bool(datos.get("finalizado", False))
    goles_local    = datos.get("goles_local", 0)
    goles_visita   = datos.get("goles_visita", 0)

    if not equipo_local or not equipo_visita or not fecha:
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE partidos
            SET equipo_local = %s, equipo_visita = %s,
                bandera_local = %s, bandera_visita = %s,
                fecha = %s, fase = %s, grupo = %s,
                finalizado = %s, goles_local = %s, goles_visita = %s
            WHERE id = %s
        """, (equipo_local, equipo_visita, bandera_local, bandera_visita,
              fecha, fase, grupo, finalizado, goles_local, goles_visita, partido_id))
        if cur.rowcount == 0:
            return jsonify({"error": "Partido no encontrado"}), 404

        # Recalcular puntos si el partido quedó finalizado
        if finalizado:
            cur.execute("SELECT * FROM apuestas WHERE id_partido = %s", (partido_id,))
            apuestas = cur.fetchall()
            ganador_real = "local" if goles_local > goles_visita else ("visita" if goles_visita > goles_local else "empate")
            for apuesta in apuestas:
                gl_ap = apuesta["goles_local_apostado"]
                gv_ap = apuesta["goles_visita_apostado"]
                ganador_ap = "local" if gl_ap > gv_ap else ("visita" if gv_ap > gl_ap else "empate")
                if gl_ap == goles_local and gv_ap == goles_visita:
                    puntos = 3
                elif ganador_ap == ganador_real:
                    puntos = 1
                else:
                    puntos = 0
                cur.execute("UPDATE apuestas SET puntos = %s WHERE id = %s", (puntos, apuesta["id"]))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Partido actualizado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/partido/<int:partido_id>", methods=["DELETE"])
def eliminar_partido(partido_id):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM partidos WHERE id = %s", (partido_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Partido no encontrado"}), 404
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Partido eliminado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/resultado/<int:partido_id>", methods=["PUT"])
def ingresar_resultado(partido_id):
    datos = request.get_json()
    goles_local = datos["goles_local"]
    goles_visita = datos["goles_visita"]

    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE partidos
            SET goles_local = %s, goles_visita = %s, finalizado = TRUE
            WHERE id = %s
        """, (goles_local, goles_visita, partido_id))

        cur.execute("SELECT * FROM apuestas WHERE id_partido = %s", (partido_id,))
        apuestas = cur.fetchall()

        if goles_local > goles_visita:
            ganador_real = "local"
        elif goles_visita > goles_local:
            ganador_real = "visita"
        else:
            ganador_real = "empate"

        for apuesta in apuestas:
            puntos = 0
            gl_ap = apuesta["goles_local_apostado"]
            gv_ap = apuesta["goles_visita_apostado"]
            if gl_ap > gv_ap:
                ganador_ap = "local"
            elif gv_ap > gl_ap:
                ganador_ap = "visita"
            else:
                ganador_ap = "empate"

            if gl_ap == goles_local and gv_ap == goles_visita:
                puntos = 3
            elif ganador_ap == ganador_real:
                puntos = 1

            cur.execute(
                "UPDATE apuestas SET puntos = %s WHERE id = %s",
                (puntos, apuesta["id"])
            )

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Resultado ingresado y puntos calculados"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# RUTAS DE APUESTAS
# ─────────────────────────────────────────────
@app.route("/apostar", methods=["POST"])
@token_requerido
def apostar():
    datos = request.get_json()
    id_partido = datos.get("id_partido")
    goles_local = datos.get("goles_local_apostado")
    goles_visita = datos.get("goles_visita_apostado")
    try:
        conn = get_db()
        cur = conn.cursor()

        # Verificar que el partido no esté finalizado ni cerrado
        cur.execute("SELECT finalizado, fecha FROM partidos WHERE id = %s", (id_partido,))
        partido = cur.fetchone()
        if not partido:
            return jsonify({"error": "Partido no encontrado"}), 404
        if partido["finalizado"]:
            return jsonify({"error": "El partido ya finalizó, no puedes apostar"}), 400
        if chile_now() >= partido["fecha"]:
            return jsonify({"error": "El partido ya comenzó, no puedes apostar"}), 400

        # Verificar intentos previos
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
            # Actualizar apuesta e incrementar intentos
            cur.execute("""
                UPDATE apuestas
                SET goles_local_apostado = %s,
                    goles_visita_apostado = %s,
                    intentos = intentos + 1
                WHERE id_usuario = %s AND id_partido = %s
            """, (goles_local, goles_visita, request.usuario_id, id_partido))
        else:
            # Primera apuesta: intentos = 1
            cur.execute("""
                INSERT INTO apuestas (id_usuario, id_partido, goles_local_apostado, goles_visita_apostado, intentos)
                VALUES (%s, %s, %s, %s, 1)
            """, (request.usuario_id, id_partido, goles_local, goles_visita))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Apuesta registrada correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/campeon", methods=["POST"])
@token_requerido
def apostar_campeon():
    datos = request.get_json()
    campeon = datos.get("campeon")
    if not campeon:
        return jsonify({"error": "Debes indicar un campeón"}), 400
    try:
        conn = get_db()
        cur = conn.cursor()

        # Bloquear modificación si la Final ya comenzó
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM partidos
            WHERE fase = 'Final' AND fecha <= NOW() AT TIME ZONE 'America/Santiago'
        """)
        resultado = cur.fetchone()
        if resultado["cnt"] > 0:
            cur.close()
            conn.close()
            return jsonify({"error": "La Final ya comenzó, no puedes cambiar tu apuesta al campeón"}), 400

        cur.execute("""
            INSERT INTO apuesta_campeon (id_usuario, campeon)
            VALUES (%s, %s)
            ON CONFLICT (id_usuario)
            DO UPDATE SET campeon = EXCLUDED.campeon
        """, (request.usuario_id, campeon))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Campeón apostado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# RUTA DE RANKING
# ─────────────────────────────────────────────
@app.route("/ranking", methods=["GET"])
@token_requerido
def ranking():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                u.id,
                u.nombre,
                u.foto_perfil,
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
        cur.close()
        conn.close()

        resultado = []
        for i, fila in enumerate(ranking_data):
            row = dict(fila)
            row["posicion"] = i + 1
            resultado.append(row)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/campeon-real", methods=["PUT"])
def definir_campeon_real():
    datos = request.get_json()
    campeon_real = datos.get("campeon")
    if not campeon_real:
        return jsonify({"error": "Debes indicar el campeón"}), 400
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE apuesta_campeon SET puntos_campeon = 5
            WHERE LOWER(campeon) = LOWER(%s)
        """, (campeon_real,))
        cur.execute("""
            UPDATE apuesta_campeon SET puntos_campeon = 0
            WHERE LOWER(campeon) != LOWER(%s)
        """, (campeon_real,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": f"Campeón {campeon_real} registrado. Puntos asignados."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/mi-campeon", methods=["GET"])
@token_requerido
def mi_campeon():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT campeon FROM apuesta_campeon WHERE id_usuario = %s", (request.usuario_id,))
        fila = cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({"campeon": fila["campeon"] if fila else ""})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# ADMIN: GESTIÓN DE USUARIOS
# ─────────────────────────────────────────────
@app.route("/admin/usuarios", methods=["GET"])
@solo_admin
def admin_listar_usuarios():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, nombre, email, rol, foto_perfil FROM usuarios ORDER BY id ASC")
        usuarios = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(u) for u in usuarios])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/usuario", methods=["POST"])
@solo_admin
def admin_crear_usuario():
    datos = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email", "").strip().lower()
    password = datos.get("password", "")
    rol      = datos.get("rol", "usuario")
    if not nombre or not email or not password:
        return jsonify({"error": "Nombre, email y contraseña son obligatorios"}), 400
    if rol not in ("usuario", "admin"):
        return jsonify({"error": "Rol inválido"}), 400
    hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, %s) RETURNING id",
            (nombre, email, hash_pw, rol)
        )
        uid = cur.fetchone()["id"]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Usuario creado correctamente", "id": uid}), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está registrado"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/usuario/<int:uid>", methods=["PUT"])
@solo_admin
def admin_editar_usuario(uid):
    datos    = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email", "").strip().lower()
    rol      = datos.get("rol", "usuario")
    password = datos.get("password", "")
    if not nombre or not email:
        return jsonify({"error": "Nombre y email son obligatorios"}), 400
    if rol not in ("usuario", "admin"):
        return jsonify({"error": "Rol inválido"}), 400
    try:
        conn = get_db()
        cur = conn.cursor()
        sets   = ["nombre = %s", "email = %s", "rol = %s"]
        values = [nombre, email, rol]
        if password:
            hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            sets.append("password = %s")
            values.append(hash_pw)
        values.append(uid)
        cur.execute(f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s", values)
        if cur.rowcount == 0:
            return jsonify({"error": "Usuario no encontrado"}), 404
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Usuario actualizado correctamente"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está en uso por otro usuario"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/admin/usuario/<int:uid>", methods=["DELETE"])
@solo_admin
def admin_eliminar_usuario(uid):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id = %s", (uid,))
        usuario = cur.fetchone()
        if not usuario:
            cur.close(); conn.close()
            return jsonify({"error": "Usuario no encontrado"}), 404
        if usuario["rol"] == "admin":
            cur.execute("SELECT COUNT(*) AS cnt FROM usuarios WHERE rol = 'admin'")
            if cur.fetchone()["cnt"] <= 1:
                cur.close(); conn.close()
                return jsonify({"error": "No puedes eliminar el único administrador"}), 400
        cur.execute("DELETE FROM usuarios WHERE id = %s", (uid,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Usuario eliminado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
