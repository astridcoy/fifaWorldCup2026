@echo off
set DATABASE_URL=postgresql://usuario:contraseña@host:puerto/railway
set SECRET_KEY=cambia_esta_clave
cd /d "%~dp0api"
python app.py
