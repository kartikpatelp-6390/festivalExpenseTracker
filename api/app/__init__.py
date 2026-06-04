from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .config import Config
from .extensions import db
from .routes import register_routes


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.url_map.strict_slashes = False

    CORS(app, resources={r"/*": {"origins": "*"}})
    db.init_app(app)
    JWTManager(app)

    register_routes(app)

    @app.cli.command("init-db")
    def init_db():
        from . import models  # noqa: F401

        db.create_all()
        print("Database tables created")

    @app.get("/")
    def index():
        return "Festival Expense API is running"

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found"}), 404

    return app
