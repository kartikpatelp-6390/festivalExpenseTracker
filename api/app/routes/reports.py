from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Expense, Festival, FundTransaction
from ..utils import generate_income_expense_report_pdf

reports_bp = Blueprint("reports", __name__)


@reports_bp.get("/")
@jwt_required()
def yearly_report():
    year = request.args.get("year")
    if not year:
        return jsonify({"error": "year is required"}), 400
    numeric_year = int(year)

    fund_rows = (
        db.session.query(FundTransaction.type.label("_id"), func.sum(FundTransaction.amount).label("totalAmount"))
        .filter(FundTransaction.festivalYear == numeric_year)
        .group_by(FundTransaction.type)
        .all()
    )
    total_income = sum(float(row.totalAmount or 0) for row in fund_rows)
    total_expenses = float(
        db.session.query(func.sum(Expense.amount))
        .filter(Expense.festivalYear == numeric_year)
        .scalar()
        or 0
    )
    return jsonify({
        "year": numeric_year,
        "funds": {row._id: float(row.totalAmount or 0) for row in fund_rows},
        "totalIncome": total_income,
        "totalExpenses": total_expenses,
        "balance": total_income - total_expenses,
    })


@reports_bp.get("/festival-breakdown")
@jwt_required()
def festival_breakdown_report():
    year = int(request.args.get("year") or 0)
    festivals = Festival.query.filter_by(year=year).all() if year else Festival.query.all()
    result = []
    for festival in festivals:
        rows = (
            db.session.query(Expense.category, func.sum(Expense.amount).label("total"))
            .filter_by(festivalId=festival.id)
            .group_by(Expense.category)
            .all()
        )
        expenses = {row.category: float(row.total or 0) for row in rows}
        result.append({
            "festivalId": festival.id,
            "name": festival.name,
            "date": festival.date.isoformat() if festival.date else None,
            "totalExpense": sum(expenses.values()),
            "expensesByCategory": expenses,
        })
    return jsonify(result)


@reports_bp.get("/yearly-report")
@jwt_required()
def income_expense_report():
    year = request.args.get("year")
    income_query = db.session.query(func.sum(FundTransaction.amount))
    expense_query = Expense.query
    if year:
        income_query = income_query.filter(FundTransaction.festivalYear == int(year))
        expense_query = expense_query.filter(Expense.festivalYear == int(year))

    total_income = float(income_query.scalar() or 0)
    income_rows = (
        db.session.query(FundTransaction.type, func.sum(FundTransaction.amount).label("total"))
        .filter(FundTransaction.festivalYear == int(year)) if year else
        db.session.query(FundTransaction.type, func.sum(FundTransaction.amount).label("total"))
    ).group_by(FundTransaction.type).all()

    income_group = {
        ("Previous Balance" if row.type == "balance" else (row.type or "Unknown").title()): {"total": float(row.total or 0)}
        for row in income_rows
    }

    grouped_expenses = {}
    total_expense = 0
    for expense in expense_query.all():
        festival_name = expense.festival.name if expense.festival else "Unknown"
        grouped_expenses.setdefault(festival_name, {})
        grouped_expenses[festival_name].setdefault(expense.category, {"total": 0, "items": []})
        amount = float(expense.amount or 0)
        grouped_expenses[festival_name][expense.category]["items"].append({
            "title": expense.description,
            "amount": amount,
        })
        grouped_expenses[festival_name][expense.category]["total"] += amount
        total_expense += amount

    return jsonify({
        "success": True,
        "data": {
            "income": total_income,
            "incomeGroup": income_group,
            "expenses": grouped_expenses,
            "totalExpense": total_expense,
            "balance": total_income - total_expense,
        },
    })


@reports_bp.get("/download-report")
@jwt_required()
def download_report():
    year = request.args.get("year") or "all"
    report_response = income_expense_report().get_json()
    report_data = report_response.get("data", {}) if isinstance(report_response, dict) else {}
    pdf = generate_income_expense_report_pdf(year, report_data)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=income_expense_report_{year}.pdf"},
    )
