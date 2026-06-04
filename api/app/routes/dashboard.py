from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Expense, FundTransaction

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/paymentMethodBifurcation")
@jwt_required()
def payment_method_bifurcation():
    year = request.args.get("festivalYear")

    fund_query = db.session.query(
        FundTransaction.paymentMethod.label("_id"),
        func.sum(FundTransaction.amount).label("total"),
    )
    expense_query = db.session.query(
        Expense.paymentMethod.label("_id"),
        func.sum(Expense.amount).label("total"),
    )

    if year:
        fund_query = fund_query.filter(FundTransaction.festivalYear == int(year))
        expense_query = expense_query.filter(Expense.festivalYear == int(year))

    return jsonify({
        "fund": [{"_id": row._id, "total": float(row.total or 0)} for row in fund_query.group_by(FundTransaction.paymentMethod).all()],
        "expense": [{"_id": row._id, "total": float(row.total or 0)} for row in expense_query.group_by(Expense.paymentMethod).all()],
    })
