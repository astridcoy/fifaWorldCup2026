# 🏆 Polla FIFA 2026 — Guía de Deploy

## Estructura del proyecto

```
polla-mundial/
├── api/
│   ├── app.py              ← Backend Flask
│   ├── schema.sql          ← Tablas PostgreSQL (con datos de ejemplo)
│   └── requirements.txt    ← Dependencias Python
└── frontend/
    ├── index.html          ← Página principal (apuestas)
    ├── login.html          ← Login
    ├── registro.html       ← Registro
    ├── ranking.html        ← Tabla de posiciones
    ├── admin.html          ← Panel de administrador
    └── styles.css          ← Estilos
```

---

## PARTE 1 — Base de datos en Railway (PostgreSQL)

1. Ve a https://railway.app y crea una cuenta
2. Crea un **New Project** → **Provision PostgreSQL**
3. Haz clic en la base de datos → pestaña **Connect**
4. Copia la variable `DATABASE_URL` (formato: `postgresql://usuario:pass@host:port/railway`)
5. En la pestaña **Query**, ejecuta TODO el contenido de `schema.sql`

---

## PARTE 2 — Backend en Railway (Flask)

1. En el mismo proyecto de Railway → **New Service** → **GitHub Repo** (o sube los archivos directamente)
2. Sube solo la carpeta `api/` a un repositorio GitHub
3. Conecta ese repo en Railway

### Variables de entorno a configurar en Railway:

| Variable       | Valor                                      |
|----------------|--------------------------------------------|
| DATABASE_URL   | (la que copiaste en el paso anterior)      |
| SECRET_KEY     | una_cadena_secreta_larga_aleatoria_2026    |
| PORT           | 5000                                       |

4. En **Settings → Build**, Railway detecta automáticamente Python y usa `requirements.txt`
5. Agrega en **Settings → Deploy** el Start Command:
   ```
   gunicorn app:app --bind 0.0.0.0:$PORT
   ```
6. Una vez deployado, copia la URL pública del servicio (ej: `https://polla-api-production.up.railway.app`)

---

## PARTE 3 — Frontend en Netlify

1. Ve a https://netlify.com y crea una cuenta
2. **Add new site** → **Deploy manually** (arrastra la carpeta `frontend/`)
3. Netlify te da una URL pública inmediatamente

### ⚠️ IMPORTANTE: Actualizar la URL de la API

Antes de subir el frontend, en los archivos `index.html`, `login.html`, `registro.html`, `ranking.html` y `admin.html`, cambia la línea:

```javascript
const API = `${window.location.protocol}//${window.location.hostname}:5000`;
```

Por la URL real de tu backend en Railway:

```javascript
const API = "https://polla-api-production.up.railway.app";
```

(Reemplaza con tu URL real de Railway)

---

## PARTE 4 — Crear el usuario admin

Después de registrarte normalmente, ve a Railway → PostgreSQL → Query y ejecuta:

```sql
UPDATE usuarios SET rol = 'admin' WHERE email = 'tu@correo.com';
```

Eso te da acceso al panel de administración (`admin.html`).

---

## Sistema de puntos

| Situación                    | Puntos |
|------------------------------|--------|
| Acertaste el marcador exacto | 3 pts  |
| Acertaste solo el ganador    | 1 pt   |
| Acertaste el campeón         | 5 pts  |
| No acertaste nada            | 0 pts  |

---

## Flujo del sistema

1. Los usuarios se registran con nombre, email y contraseña
2. Cada usuario apuesta el marcador de cada partido (antes de que empiece)
3. El admin ingresa el resultado real al terminar el partido
4. El sistema calcula los puntos automáticamente
5. El ranking se actualiza en tiempo real

---

## Para pruebas locales

```bash
# Instalar dependencias
cd api
pip install -r requirements.txt

# Variables de entorno (en tu terminal)
set DATABASE_URL=postgresql://usuario:pass@localhost:5432/polla_mundial
set SECRET_KEY=clave_local_pruebas

# Correr backend
python app.py

# Abrir frontend con Live Server en VS Code
# o con Python:
cd ../frontend
python -m http.server 5500
# Abre: http://localhost:5500/login.html
```
