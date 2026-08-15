from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Expense, FundTransaction

dashboard_bp = Blueprint("dashboard", __name__)


def _totals_for_year(year):
    fund_total = db.session.query(func.sum(FundTransaction.amount)).filter(FundTransaction.festivalYear == year).scalar() or 0
    expense_total = db.session.query(func.sum(Expense.amount)).filter(Expense.festivalYear == year).scalar() or 0
    fund_total = float(fund_total)
    expense_total = float(expense_total)
    return {
        "fund": fund_total,
        "expense": expense_total,
        "balance": fund_total - expense_total,
    }


@dashboard_bp.get("/year-comparison")
@jwt_required()
def year_comparison():
    year = request.args.get("festivalYear")
    if not year:
        return jsonify({"error": "festivalYear is required"}), 400

    try:
        current_year = int(year)
    except ValueError:
        return jsonify({"error": "festivalYear must be a number"}), 400

    previous_year = current_year - 1
    return jsonify({
        "currentYear": current_year,
        "previousYear": previous_year,
        "current": _totals_for_year(current_year),
        "previous": _totals_for_year(previous_year),
    })


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
