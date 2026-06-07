import os, sys
os.environ["DATABASE_URL"] = "postgresql://usuario:contraseña@host:puerto/railway"
os.environ["SECRET_KEY"] = "cambia_esta_clave"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
os.chdir(os.path.join(os.path.dirname(__file__), "api"))
from app import app
app.run(host="0.0.0.0", port=5000, debug=False)
