from flask import Blueprint, Response, jsonify, request
from sqlalchemy import func

from ..extensions import db
from ..models import Expense, FundTransaction, House
from ..utils import generate_income_expense_report_pdf

public_bp = Blueprint("public", __name__)


def _year_arg(name="year"):
    value = request.args.get(name)
    return int(value) if value else None


def _income_expense_report(year):
    income_query = db.session.query(func.sum(FundTransaction.amount))
    expense_query = Expense.query
    income_group_query = db.session.query(FundTransaction.type, func.sum(FundTransaction.amount).label("total"))

    if year:
        income_query = income_query.filter(FundTransaction.festivalYear == year)
        expense_query = expense_query.filter(Expense.festivalYear == year)
        income_group_query = income_group_query.filter(FundTransaction.festivalYear == year)

    total_income = float(income_query.scalar() or 0)
    income_rows = income_group_query.group_by(FundTransaction.type).all()
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

    return {
        "income": total_income,
        "incomeGroup": income_group,
        "expenses": grouped_expenses,
        "totalExpense": total_expense,
        "balance": total_income - total_expense,
    }


@public_bp.get("/dashboard-summary")
def dashboard_summary():
    year = _year_arg("festivalYear")

    fund_query = db.session.query(FundTransaction.paymentMethod, func.sum(FundTransaction.amount).label("total"))
    expense_query = db.session.query(Expense.paymentMethod, func.sum(Expense.amount).label("total"))
    if year:
        fund_query = fund_query.filter(FundTransaction.festivalYear == year)
        expense_query = expense_query.filter(Expense.festivalYear == year)

    fund_rows = fund_query.group_by(FundTransaction.paymentMethod).all()
    expense_rows = expense_query.group_by(Expense.paymentMethod).all()
    fund_by_payment = {row.paymentMethod or "Unknown": float(row.total or 0) for row in fund_rows}
    expense_by_payment = {row.paymentMethod or "Unknown": float(row.total or 0) for row in expense_rows}
    total_fund = sum(fund_by_payment.values())
    total_expense = sum(expense_by_payment.values())

    return jsonify({
        "year": year,
        "totalFunds": total_fund,
        "totalExpenses": total_expense,
        "balance": total_fund - total_expense,
        "houseCount": House.query.count(),
        "fundByPayment": fund_by_payment,
        "expenseByPayment": expense_by_payment,
    })


@public_bp.get("/reports/yearly-report")
def yearly_report():
    return jsonify({"success": True, "data": _income_expense_report(_year_arg())})


@public_bp.get("/reports/download-report")
def download_report():
    year = request.args.get("year") or "all"
    report_data = _income_expense_report(int(year) if year != "all" else None)
    pdf = generate_income_expense_report_pdf(year, report_data)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=income_expense_report_{year}.pdf"},
    )
