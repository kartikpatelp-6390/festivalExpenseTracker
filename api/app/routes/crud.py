from flask import Blueprint, Response, abort, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import Estimate, Expense, Festival, FundTransaction, House, InventoryItem, Todo, Volunteer
from ..utils import (
    generate_fund_receipt_pdf,
    get_by_public_id,
    model_to_dict,
    normalize_payload,
    normalize_phone,
    resolve_public_id,
    serialize_with_relations,
    now_utc,
    query_helper,
)


def row_or_404(model, public_id):
    row = get_by_public_id(model, public_id)
    if not row:
        abort(404)
    return row


def prepare_relations(model, data):
    data = normalize_payload(model, data)
    if "festivalId" in data:
        data["festivalId"] = resolve_public_id(Festival, data["festivalId"])
    if "volunteerId" in data:
        data["volunteerId"] = resolve_public_id(Volunteer, data["volunteerId"])
    if "houseId" in data:
        data["houseId"] = resolve_public_id(House, data["houseId"])
    return data


def relation_query_args(args, relations):
    data = dict(args)
    for key, model in relations.items():
        for candidate in {key, key[0].lower() + key[1:], key.replace("Id", "_id")}:
            if candidate in data and data[candidate] not in {"", None}:
                data[key] = resolve_public_id(model, data[candidate])
                if candidate != key:
                    data.pop(candidate, None)
    return data


def commit_created(row, message, status=201):
    db.session.add(row)
    db.session.commit()
    return jsonify({"message": message, "data": model_to_dict(row)}), status


def update_row(row, data, message):
    data = prepare_relations(row.__class__, data)
    for key, value in data.items():
        if hasattr(row, key):
            setattr(row, key, value)
    db.session.commit()
    return jsonify({"message": message, "data": model_to_dict(row)})


festivals_bp = Blueprint("festivals", __name__)
houses_bp = Blueprint("houses", __name__)
volunteers_bp = Blueprint("volunteers", __name__)
funds_bp = Blueprint("funds", __name__)
expenses_bp = Blueprint("expenses", __name__)
estimates_bp = Blueprint("estimates", __name__)
inventory_bp = Blueprint("inventory", __name__)
todos_bp = Blueprint("todos", __name__)


@festivals_bp.post("/")
@jwt_required()
def create_festival():
    data = normalize_payload(Festival, request.get_json() or {})
    existing = Festival.query.filter_by(name=data.get("name"), year=data.get("year")).first()
    if existing:
        return jsonify({"error": "Festival already exists for this year"}), 400
    return commit_created(Festival(**data), "Festival created")


@festivals_bp.get("/")
@jwt_required()
def list_festivals():
    args = request.args.to_dict()
    args["sort"] = "-year"
    return jsonify({"success": True, **query_helper(Festival, args, ["name"])})


@festivals_bp.get("/<item_id>")
@jwt_required()
def get_festival(item_id):
    return jsonify({"message": "Festival detail", "data": model_to_dict(row_or_404(Festival, item_id))})


@festivals_bp.put("/<item_id>")
@jwt_required()
def update_festival(item_id):
    return update_row(row_or_404(Festival, item_id), request.get_json() or {}, "Festival updated")


@festivals_bp.delete("/<item_id>")
@jwt_required()
def delete_festival(item_id):
    db.session.delete(row_or_404(Festival, item_id))
    db.session.commit()
    return jsonify({"message": "Festival deleted"})


@houses_bp.post("/")
@jwt_required()
def create_house():
    data = normalize_payload(House, request.get_json() or {})
    house_number = (data.get("houseNumber") or "").strip().upper()
    if not house_number:
        return jsonify({"error": "houseNumber is required"}), 400
    house = House.query.filter_by(houseNumber=house_number).first()
    phone = normalize_phone(data.get("phone")) if data.get("phone") else None
    if house:
        house.ownerName = data.get("ownerName", house.ownerName)
        house.phone = phone or house.phone
        db.session.commit()
        return jsonify({"message": "House updated successfully", "data": model_to_dict(house)})
    return commit_created(House(houseNumber=house_number, ownerName=data.get("ownerName"), phone=phone), "House created successfully")


@houses_bp.get("/")
@jwt_required()
def list_houses():
    return jsonify({"success": True, **query_helper(House, request.args, ["ownerName", "houseNumber", "phone"])})


@houses_bp.get("/<item_id>")
@jwt_required()
def get_house(item_id):
    return jsonify({"message": "House detail", "data": model_to_dict(row_or_404(House, item_id))})


@houses_bp.put("/<item_id>")
@jwt_required()
def update_house(item_id):
    data = normalize_payload(House, request.get_json() or {})
    if data.get("phone"):
        data["phone"] = normalize_phone(data["phone"])
    return update_row(row_or_404(House, item_id), data, "House updated")


@houses_bp.delete("/<item_id>")
@jwt_required()
def delete_house(item_id):
    db.session.delete(row_or_404(House, item_id))
    db.session.commit()
    return jsonify({"message": "House deleted"})


@volunteers_bp.post("/")
@jwt_required()
def create_volunteer():
    claims = get_jwt()
    if claims.get("role") == "volunteer":
        return jsonify({"error": "Access denied"}), 403
    data = normalize_payload(Volunteer, request.get_json() or {})
    data["phone"] = normalize_phone(data.get("phone"))
    data["password_hash"] = Volunteer.hash_password(data.pop("password"))
    return commit_created(Volunteer(**data), "Volunteer created")


@volunteers_bp.get("/")
@jwt_required()
def list_volunteers():
    return jsonify({"success": True, **query_helper(Volunteer, request.args, ["name"])})


@volunteers_bp.get("/<item_id>")
@jwt_required()
def get_volunteer(item_id):
    return jsonify({"message": "Volunteer detail", "data": model_to_dict(row_or_404(Volunteer, item_id))})


@volunteers_bp.put("/<item_id>")
@jwt_required()
def update_volunteer(item_id):
    claims = get_jwt()
    volunteer = row_or_404(Volunteer, item_id)
    if claims.get("role") == "volunteer" and get_jwt_identity() not in {str(item_id), str(volunteer.id), str(volunteer.mongoId)}:
        return jsonify({"error": "Access denied"}), 403
    data = normalize_payload(Volunteer, request.get_json() or {})
    if data.get("phone"):
        data["phone"] = normalize_phone(data["phone"])
    if data.get("password"):
        data["password_hash"] = Volunteer.hash_password(data.pop("password"))
    return update_row(volunteer, data, "Volunteer updated")


@volunteers_bp.delete("/<item_id>")
@jwt_required()
def delete_volunteer(item_id):
    db.session.delete(row_or_404(Volunteer, item_id))
    db.session.commit()
    return jsonify({"message": "Volunteer deleted"})


@funds_bp.post("/")
@jwt_required()
def create_fund():
    data = prepare_relations(FundTransaction, request.get_json() or {})
    if data.get("type") == "house" and not data.get("houseId"):
        return jsonify({"error": "houseId is required for type 'house'"}), 400
    if data.get("type") == "house" and data.get("alternativePhone"):
        data["alternativePhone"] = normalize_phone(data.get("alternativePhone"))
    elif "alternativePhone" in data:
        data.pop("alternativePhone")
    if data.get("volunteerId") == "":
        data["volunteerId"] = None
    return commit_created(FundTransaction(**data), "Fund saved")


@funds_bp.get("/unpaid")
@jwt_required()
def unpaid_houses():
    year = request.args.get("festivalYear")
    if not year:
        return jsonify({"error": "festivalYear is required"}), 400
    paid_ids = [row[0] for row in db.session.query(FundTransaction.houseId).filter_by(type="house", festivalYear=int(year)).distinct()]
    houses = House.query.filter(~House.id.in_(paid_ids or [0])).all()
    houses.sort(key=lambda h: h.houseNumber)
    return jsonify({"success": True, "sortedHouses": [model_to_dict(house) for house in houses]})


@funds_bp.get("/summary")
@jwt_required()
def funds_summary():
    year = request.args.get("festivalYear")
    query = db.session.query(FundTransaction.type.label("_id"), func.sum(FundTransaction.amount).label("totalAmount"), func.count(FundTransaction.id).label("count"))
    if year:
        query = query.filter(FundTransaction.festivalYear == int(year))
    rows = query.group_by(FundTransaction.type).all()
    return jsonify([{"_id": row._id, "totalAmount": float(row.totalAmount or 0), "count": row.count} for row in rows])


@funds_bp.get("/summary-by-volunteers")
@jwt_required()
def funds_summary_by_volunteers():
    year = int(request.args.get("festivalYear", 0))
    volunteers = (
        db.session.query(FundTransaction.volunteerId.label("_id"), Volunteer.name.label("volunteerName"), func.sum(FundTransaction.amount).label("totalAmount"), func.count(FundTransaction.id).label("count"))
        .join(Volunteer, Volunteer.id == FundTransaction.volunteerId)
        .filter(FundTransaction.festivalYear == year, FundTransaction.volunteerId.isnot(None))
        .group_by(FundTransaction.volunteerId, Volunteer.name)
        .order_by(Volunteer.name)
        .all()
    )
    cash_total = (
        db.session.query(func.sum(FundTransaction.amount).label("totalAmount"), func.count(FundTransaction.id).label("count"))
        .filter(FundTransaction.festivalYear == year, FundTransaction.paymentMethod == "Cash", FundTransaction.volunteerId.is_(None))
        .one()
    )
    return jsonify({
        "volunteers": [{"_id": row._id, "volunteerName": row.volunteerName, "totalAmount": float(row.totalAmount or 0), "count": row.count} for row in volunteers],
        "cash": {"volunteerName": "Cash", "totalAmount": float(cash_total.totalAmount or 0), "count": cash_total.count or 0},
    })


@funds_bp.get("/")
@jwt_required()
def list_funds():
    args = relation_query_args(request.args, {"houseId": House, "volunteerId": Volunteer})
    result = query_helper(FundTransaction, args, ["name", "reference"])
    ids = [item["id"] for item in result["data"]]
    rows = FundTransaction.query.filter(FundTransaction.id.in_(ids or [0])).all()
    by_id = {row.id: row for row in rows}
    result["data"] = []
    for item_id in ids:
        row = by_id.get(item_id)
        if not row:
            continue
        data = serialize_with_relations(row, {"houseId": "house", "volunteerId": "volunteer"})
        if row.type == "house" and row.house and not row.name and row.house.ownerName:
            data["name"] = row.house.ownerName
        result["data"].append(data)
    return jsonify({"success": True, **result})


@funds_bp.get("/<item_id>")
@jwt_required()
def get_fund(item_id):
    fund = row_or_404(FundTransaction, item_id)
    return jsonify({"message": "Fund detail", "data": serialize_with_relations(fund, {"houseId": "house", "volunteerId": "volunteer"})})


@funds_bp.put("/<item_id>")
@jwt_required()
def update_fund(item_id):
    data = prepare_relations(FundTransaction, request.get_json() or {})
    if data.get("houseId") == "":
        data.pop("houseId")
    if data.get("type") == "house" and data.get("alternativePhone"):
        data["alternativePhone"] = normalize_phone(data.get("alternativePhone"))
    if data.get("volunteerId") == "":
        data["volunteerId"] = None
    return update_row(row_or_404(FundTransaction, item_id), data, "Fund updated")


@funds_bp.delete("/<item_id>")
@jwt_required()
def delete_fund(item_id):
    db.session.delete(row_or_404(FundTransaction, item_id))
    db.session.commit()
    return jsonify({"message": "Fund deleted"})


@funds_bp.get("/download/<item_id>")
@jwt_required()
def download_receipt(item_id):
    fund = row_or_404(FundTransaction, item_id)
    action = request.args.get("action", "download")
    if action == "send":
        public_value = fund.mongoId or fund.id
        return jsonify({"url": f"{request.url_root.rstrip('/')}/api/funds/download/{public_value}"})

    pdf = generate_fund_receipt_pdf(fund)
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=receipt_{fund.id}.pdf"},
    )


@expenses_bp.post("/")
@jwt_required()
def create_expense():
    data = prepare_relations(Expense, request.get_json() or {})
    festival = row_or_404(Festival, data.get("festivalId"))
    data["festivalYear"] = festival.year
    return commit_created(Expense(**data), "Expense recorded")


@expenses_bp.put("/settle")
@jwt_required()
def settle_expenses():
    data = request.get_json() or {}
    if not isinstance(data.get("isSettled"), bool):
        return jsonify({"error": "Missing or invalid 'isSettled' boolean"}), 400
    query = Expense.query.filter(Expense.volunteerId.isnot(None))
    if data.get("expenseId"):
        expense = row_or_404(Expense, data["expenseId"])
        query = query.filter(Expense.id == expense.id)
        scope = "single expense"
    elif data.get("volunteerId"):
        volunteer_id = resolve_public_id(Volunteer, data["volunteerId"])
        query = query.filter(Expense.volunteerId == volunteer_id, Expense.isSettled != data["isSettled"])
        scope = "volunteer + festival" if data.get("festivalId") else "volunteer (all festivals)"
        if data.get("festivalId"):
            festival_id = resolve_public_id(Festival, data["festivalId"])
            query = query.filter(Expense.festivalId == festival_id)
    else:
        return jsonify({"error": "Pass either 'expenseId' or 'volunteerId'"}), 400
    count = query.update({"isSettled": data["isSettled"], "settledOn": now_utc() if data["isSettled"] else None})
    db.session.commit()
    return jsonify({"message": f"Updated {count} expense(s) for {scope}", "modifiedCount": count})


@expenses_bp.get("/categories")
@jwt_required()
def expense_categories():
    return jsonify({"success": True, "data": [row[0] for row in db.session.query(Expense.category).distinct().all()]})


@expenses_bp.get("/summary")
@jwt_required()
def expense_summary():
    festival_id = resolve_public_id(Festival, request.args.get("festivalId") or request.args.get("festival_id"))
    rows = db.session.query(Expense.category.label("_id"), func.sum(Expense.amount).label("totalAmount"), func.count(Expense.id).label("count")).filter_by(festivalId=festival_id).group_by(Expense.category).all()
    return jsonify([{"_id": row._id, "totalAmount": float(row.totalAmount or 0), "count": row.count} for row in rows])


@expenses_bp.get("/volunteer/<item_id>")
@jwt_required()
def expense_by_volunteer(item_id):
    volunteer_id = resolve_public_id(Volunteer, item_id)
    rows = Expense.query.filter_by(volunteerId=volunteer_id).all()
    return jsonify({"success": True, "data": [serialize_with_relations(row, {"festivalId": "festival", "volunteerId": "volunteer"}) for row in rows]})


@expenses_bp.get("/")
@jwt_required()
def list_expenses():
    args = relation_query_args(request.args, {"festivalId": Festival, "volunteerId": Volunteer})
    result = query_helper(Expense, args, ["category", "description"])
    ids = [item["id"] for item in result["data"]]
    rows = Expense.query.filter(Expense.id.in_(ids or [0])).all()
    by_id = {row.id: row for row in rows}
    result["data"] = [
        serialize_with_relations(by_id[item_id], {"festivalId": "festival", "volunteerId": "volunteer"})
        for item_id in ids
        if item_id in by_id
    ]
    return jsonify({"success": True, **result})


@expenses_bp.get("/<item_id>")
@jwt_required()
def get_expense(item_id):
    expense = row_or_404(Expense, item_id)
    return jsonify({"message": "Expense detail", "data": serialize_with_relations(expense, {"festivalId": "festival", "volunteerId": "volunteer"})})


@expenses_bp.put("/<item_id>")
@jwt_required()
def update_expense(item_id):
    data = prepare_relations(Expense, request.get_json() or {})
    if data.get("festivalId"):
        data["festivalYear"] = row_or_404(Festival, data["festivalId"]).year
    return update_row(row_or_404(Expense, item_id), data, "Expense updated")


@expenses_bp.delete("/<item_id>")
@jwt_required()
def delete_expense(item_id):
    db.session.delete(row_or_404(Expense, item_id))
    db.session.commit()
    return jsonify({"message": "Expense deleted"})


@estimates_bp.post("/")
@jwt_required()
def create_estimate():
    data = prepare_relations(Estimate, request.get_json() or {})
    festival = row_or_404(Festival, data.get("festivalId"))
    data["festivalYear"] = festival.year
    return commit_created(Estimate(**data), "Estimate recorded")


@estimates_bp.get("/categories")
@jwt_required()
def estimate_categories():
    return jsonify({"success": True, "data": [row[0] for row in db.session.query(Estimate.category).distinct().all()]})


@estimates_bp.get("/summary")
@jwt_required()
def estimate_summary():
    festival_id = resolve_public_id(Festival, request.args.get("festivalId") or request.args.get("festival_id"))
    rows = db.session.query(Estimate.category.label("_id"), func.sum(Estimate.estimatedAmount).label("totalAmount"), func.count(Estimate.id).label("count")).filter_by(festivalId=festival_id).group_by(Estimate.category).all()
    return jsonify([{"_id": row._id, "totalAmount": float(row.totalAmount or 0), "count": row.count} for row in rows])


@estimates_bp.get("/")
@jwt_required()
def list_estimates():
    args = relation_query_args(request.args, {"festivalId": Festival})
    result = query_helper(Estimate, args, ["category", "description"])
    ids = [item["id"] for item in result["data"]]
    rows = Estimate.query.filter(Estimate.id.in_(ids or [0])).all()
    by_id = {row.id: row for row in rows}
    result["data"] = [
        serialize_with_relations(by_id[item_id], {"festivalId": "festival"})
        for item_id in ids
        if item_id in by_id
    ]
    return jsonify({"success": True, **result})


@estimates_bp.get("/<item_id>")
@jwt_required()
def get_estimate(item_id):
    estimate = row_or_404(Estimate, item_id)
    return jsonify({"message": "Estimate detail", "data": serialize_with_relations(estimate, {"festivalId": "festival"})})


@estimates_bp.put("/<item_id>")
@jwt_required()
def update_estimate(item_id):
    data = prepare_relations(Estimate, request.get_json() or {})
    if data.get("festivalId"):
        data["festivalYear"] = row_or_404(Festival, data["festivalId"]).year
    return update_row(row_or_404(Estimate, item_id), data, "Estimate updated")


@estimates_bp.delete("/<item_id>")
@jwt_required()
def delete_estimate(item_id):
    db.session.delete(row_or_404(Estimate, item_id))
    db.session.commit()
    return jsonify({"message": "Estimate deleted"})


@inventory_bp.post("/")
@jwt_required()
def create_inventory():
    return commit_created(InventoryItem(**normalize_payload(InventoryItem, request.get_json() or {})), "Inventory created")


@inventory_bp.get("/category")
@jwt_required()
def inventory_categories():
    return jsonify({"success": True, "data": [row[0] for row in db.session.query(InventoryItem.category).distinct().all()]})


@inventory_bp.get("/")
@jwt_required()
def list_inventory():
    return jsonify({"success": True, **query_helper(InventoryItem, request.args, ["item", "category", "place"])})


@inventory_bp.get("/<item_id>")
@jwt_required()
def get_inventory(item_id):
    return jsonify({"message": "Inventory detail", "data": model_to_dict(row_or_404(InventoryItem, item_id))})


@inventory_bp.put("/<item_id>")
@jwt_required()
def update_inventory(item_id):
    return update_row(row_or_404(InventoryItem, item_id), request.get_json() or {}, "Inventory updated")


@inventory_bp.delete("/<item_id>")
@jwt_required()
def delete_inventory(item_id):
    db.session.delete(row_or_404(InventoryItem, item_id))
    db.session.commit()
    return jsonify({"message": "Inventory Deleted"})


@todos_bp.post("/")
@jwt_required()
def create_todo():
    claims = get_jwt()
    row = Todo(title=(request.get_json() or {}).get("title"), role=claims.get("role", "admin"), createdByMongoId=get_jwt_identity())
    return commit_created(row, "Todo created")


@todos_bp.get("/")
@jwt_required()
def list_todos():
    return jsonify({"success": True, **query_helper(Todo, request.args, ["title"])})


@todos_bp.put("/<item_id>")
@jwt_required()
def update_todo(item_id):
    row = row_or_404(Todo, item_id)
    if row.createdByMongoId and row.createdByMongoId != get_jwt_identity():
        return jsonify({"data": None})
    data = normalize_payload(Todo, request.get_json() or {})
    for key, value in data.items():
        if hasattr(row, key):
            setattr(row, key, value)
    db.session.commit()
    return jsonify({"data": model_to_dict(row)})


@todos_bp.delete("/<item_id>")
@jwt_required()
def delete_todo(item_id):
    row = row_or_404(Todo, item_id)
    if row.createdByMongoId and row.createdByMongoId != get_jwt_identity():
        return jsonify({"message": "Deleted"})
    db.session.delete(row)
    db.session.commit()
    return jsonify({"message": "Deleted"})
