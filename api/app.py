import os
from flask import Flask, jsonify, request as _req
from flask_cors import CORS
from flask_compress import Compress

from database import init_db, init_pool
from config import GOOGLE_CLIENT_ID
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.match_routes import match_bp
from routes.admin_routes import admin_bp
from routes.chat_routes import chat_bp

app = Flask(__name__)
Compress(app)

_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "https://juega-fifa2026.netlify.app").split(",")]
CORS(app, resources={r"/*": {"origins": _origins}}, supports_credentials=False)

app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(match_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(chat_bp)


@app.route("/config")
def public_config():
    return jsonify({"google_client_id": GOOGLE_CLIENT_ID or None})


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if _req.headers.get("X-Forwarded-Proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


init_pool()

with app.app_context():
    init_db()

from notifications import start_scheduler
start_scheduler()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5000)
