from flask import Flask
from flask_cors import CORS

from database import init_db
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.match_routes import match_bp
from routes.admin_routes import admin_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(match_bp)
app.register_blueprint(admin_bp)

with app.app_context():
    init_db()

if __name__ == "__main__":
    app.run(debug=True)
