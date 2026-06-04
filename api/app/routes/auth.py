from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from ..extensions import db
from ..models import User, Volunteer
from ..utils import public_id, verify_password

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    db.session.add(User(username=username, password_hash=User.hash_password(password)))
    db.session.commit()
    return jsonify({"message": "User registered"}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()
    if user and verify_password(user.password_hash, password):
        role = "admin" if username == "admin" else "non-admin"
        identity = str(public_id(user))
        token = create_access_token(identity=identity, additional_claims={"role": role})
        return jsonify({"token": token, "role": role, "user": {"id": identity, "name": user.username}})

    volunteer = Volunteer.query.filter_by(phone=username).first()
    if volunteer and verify_password(volunteer.password_hash, password):
        identity = str(public_id(volunteer))
        token = create_access_token(identity=identity, additional_claims={"role": "volunteer"})
        return jsonify({
            "token": token,
            "role": "volunteer",
            "user": {"id": identity, "name": volunteer.name, "phone": volunteer.phone},
        })

    return jsonify({"error": "Invalid credentials"}), 400


@auth_bp.post("/logout")
def logout():
    return jsonify({"message": "Logged out successfully"})
