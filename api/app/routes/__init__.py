from .auth import auth_bp
from .dashboard import dashboard_bp
from .crud import (
    estimates_bp,
    expenses_bp,
    festivals_bp,
    funds_bp,
    houses_bp,
    inventory_bp,
    todos_bp,
    volunteers_bp,
)
from .reports import reports_bp
from .shortlinks import shortlinks_bp


def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(festivals_bp, url_prefix="/api/festivals")
    app.register_blueprint(houses_bp, url_prefix="/api/house")
    app.register_blueprint(volunteers_bp, url_prefix="/api/volunteers")
    app.register_blueprint(funds_bp, url_prefix="/api/funds")
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
    app.register_blueprint(estimates_bp, url_prefix="/api/estimates")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(todos_bp, url_prefix="/api/todos")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(shortlinks_bp, url_prefix="/api/short-links")
