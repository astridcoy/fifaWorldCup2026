import os
from flask import Flask, request as _req
from flask_cors import CORS

from database import init_db
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.match_routes import match_bp
from routes.admin_routes import admin_bp

app = Flask(__name__)

_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "https://juega-fifa2026.netlify.app").split(",")]
CORS(app, resources={r"/*": {"origins": _origins}}, supports_credentials=False)

app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(match_bp)
app.register_blueprint(admin_bp)


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if _req.headers.get("X-Forwarded-Proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


with app.app_context():
    init_db()

from notifications import start_scheduler
start_scheduler()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1", port=5000)
