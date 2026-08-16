from datetime import datetime
from decimal import Decimal

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import func, or_

from ..extensions import db
from ..models import (
    DinnerCaterer,
    DinnerCheckIn,
    DinnerCollectionHandover,
    DinnerCoupon,
    DinnerEvent,
    DinnerRegistration,
    DinnerSettlement,
    DinnerSettlementAdjustment,
    Expense,
    Festival,
    FundTransaction,
    House,
    Volunteer,
)
from ..utils import model_to_dict, normalize_payload, normalize_phone, now_utc, query_helper, resolve_public_id, serialize_with_relations, simple_pdf
from .crud import row_or_404


dinner_bp = Blueprint("dinner", __name__)


def money_decimal(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def to_int(value):
    return max(0, int(value or 0))


def parse_date(value):
    if not value:
        return None
    if hasattr(value, "year"):
        return value
    return datetime.fromisoformat(str(value)[:10]).date()


def parse_datetime(value):
    if not value:
        return None
    if hasattr(value, "year"):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def token_serializer():
    return URLSafeSerializer(current_app.config["JWT_SECRET_KEY"], salt="dinner-coupon")


def dinner_token(registration):
    return token_serializer().dumps({
        "event": registration.eventId,
        "registration": registration.id,
        "house": registration.houseId,
        "plates": registration.adults,
    })


def dinner_coupon_code(registration):
    event_name = registration.event.name if registration.event else "Dinner Event"
    initials = "".join(part[0] for part in event_name.split() if part).upper()[:4] or "DIN"
    house_number = registration.house.houseNumber if registration.house else "HOUSE"
    house_code = "".join(ch for ch in str(house_number).upper() if ch.isalnum()) or "HOUSE"
    event_date = registration.event.eventDate if registration.event else None
    date_code = event_date.strftime("%y%m%d") if event_date else "DATE"
    token = registration.coupon.token if registration.coupon else dinner_token(registration)
    token_code = "".join(ch for ch in str(token).upper() if ch.isalnum())[-4:] or "QR"
    return f"{initials}-{house_code}-{date_code}-{token_code}"


def dinner_account_label(event, suffix, max_length=50):
    event_name = str(event.name or "Dinner Event").strip()
    suffix = str(suffix or "").strip()
    label = f"{event_name} {suffix}".strip()
    if len(label) <= max_length:
        return label
    event_max = max(1, max_length - len(suffix) - 1)
    return f"{event_name[:event_max].rstrip()} {suffix}".strip()


def ensure_coupon(registration):
    coupon = registration.coupon
    if not coupon:
        coupon = DinnerCoupon(eventId=registration.eventId, registrationId=registration.id, token=dinner_token(registration))
        db.session.add(coupon)
    elif coupon.status == "Revoked":
        coupon.status = "Generated"
    return coupon


def public_id(model, value):
    return resolve_public_id(model, value) if value not in {"", None} else None


def event_payload(data):
    payload = normalize_payload(DinnerEvent, data)
    for key in ["festivalId", "catererId"]:
        if key in payload:
            payload[key] = public_id(Festival if key == "festivalId" else DinnerCaterer, payload[key])
    for key in ["eventDate", "collectionStartDate", "collectionDeadline", "couponDeadline"]:
        if key in payload:
            payload[key] = parse_date(payload[key])
    if "finalPlateSubmissionAt" in payload:
        payload["finalPlateSubmissionAt"] = parse_datetime(payload["finalPlateSubmissionAt"])
    for key in [
        "catererRatePerPlate",
        "fixedContractAmount",
        "advancePaid",
        "memberContributionRate",
        "payeePercent",
        "mandalPercent",
    ]:
        if key in payload:
            payload[key] = money_decimal(payload[key])
    for key in ["expectedPlates", "finalPlateCount"]:
        if key in payload and payload[key] not in {"", None}:
            payload[key] = to_int(payload[key])
        elif key in payload:
            payload[key] = None if key == "finalPlateCount" else 0
    if payload.get("catererPricingType") == "per_plate":
        payload["fixedContractAmount"] = Decimal("0.00")
    if payload.get("catererPricingType") == "fixed":
        payload["catererRatePerPlate"] = Decimal("0.00")
        payload["expectedPlates"] = 0
    return payload


def registration_amounts(event, data):
    adults = to_int(data.get("adults"))
    children = to_int(data.get("childrenBelow7"))
    contribution_type = data.get("contributionType") or event.contributionType
    rate = money_decimal(data.get("memberContributionRate", event.memberContributionRate))
    payee_percent = money_decimal(data.get("payeePercent", event.payeePercent))
    mandal_percent = money_decimal(data.get("mandalPercent", event.mandalPercent))
    base = money_decimal(adults) * rate
    if contribution_type == "complimentary":
        payee_amount = Decimal("0.00")
        mandal_amount = base
        payment_status = "Complimentary"
    else:
        if contribution_type == "split" and payee_percent + mandal_percent != Decimal("100.00"):
            raise ValueError("Payee and Yuvak Mandal split must total 100%.")
        if contribution_type == "payee_full":
            payee_percent = Decimal("100.00")
            mandal_percent = Decimal("0.00")
        payee_amount = (base * payee_percent / Decimal("100")).quantize(Decimal("0.01"))
        mandal_amount = (base - payee_amount).quantize(Decimal("0.01"))
        received = Decimal("0.00") if not data.get("paymentMethod") else money_decimal(data.get("amountReceived"))
        payment_status = "Paid" if received >= payee_amount else "Partial" if received > 0 else "Pending"
    return {
        "adults": adults,
        "childrenBelow7": children,
        "contributionType": contribution_type,
        "memberContributionRate": rate,
        "payeePercent": payee_percent,
        "mandalPercent": mandal_percent,
        "payeeAmount": payee_amount,
        "mandalAmount": mandal_amount,
        "paymentStatus": payment_status,
    }


def checkin_totals(registration):
    rows = registration.checkins.filter_by(restrictedAttempt=False).all()
    return {
        "adultsCheckedIn": sum(row.adultsEntered for row in rows),
        "childrenCheckedIn": sum(row.childrenEntered for row in rows),
        "platesUsed": sum(row.platesConsumed for row in rows),
    }


def registration_dict(registration):
    data = serialize_with_relations(registration, {"eventId": "event", "houseId": "house", "volunteerId": "volunteer"})
    data["totalAttending"] = registration.adults + registration.childrenBelow7
    data["plateEntitlement"] = registration.adults
    data["balanceDue"] = float(money_decimal(registration.payeeAmount) - money_decimal(registration.amountReceived))
    data["couponStatus"] = registration.coupon.status if registration.coupon else "Not Generated"
    data["deliveryStatus"] = registration.coupon.deliveryStatus if registration.coupon else "Not Sent"
    data["coupon"] = model_to_dict(registration.coupon) if registration.coupon else None
    if data["coupon"]:
        data["coupon"]["qrPayload"] = registration.coupon.token
        data["coupon"]["couponCode"] = dinner_coupon_code(registration)
    data.update(checkin_totals(registration))
    data["remainingAdults"] = max(0, registration.adults - data["adultsCheckedIn"])
    data["remainingChildren"] = max(0, registration.childrenBelow7 - data["childrenCheckedIn"])
    data["remainingPlates"] = max(0, registration.adults - data["platesUsed"])
    return data


def event_summary(event):
    registrations = event.registrations.all()
    checkins = DinnerCheckIn.query.filter_by(eventId=event.id, restrictedAttempt=False).all()
    coupons = DinnerCoupon.query.filter_by(eventId=event.id).all()
    return {
        "registeredHouses": len(registrations),
        "collectionsMade": len([row for row in registrations if row.paymentStatus in {"Paid", "Partial", "Complimentary"}]),
        "couponsGenerated": len([coupon for coupon in coupons if coupon.status != "Revoked"]),
        "couponsSent": len([coupon for coupon in coupons if coupon.deliveryStatus == "Sent"]),
        "adultsRegistered": sum(row.adults for row in registrations),
        "childrenBelow7": sum(row.childrenBelow7 for row in registrations),
        "totalAttending": sum(row.adults + row.childrenBelow7 for row in registrations),
        "platesEntitled": sum(row.adults for row in registrations),
        "paidPlates": sum(row.adults for row in registrations if row.paymentStatus in {"Paid", "Complimentary"}),
        "unpaidPlates": sum(row.adults for row in registrations if row.paymentStatus not in {"Paid", "Complimentary"}),
        "adultsCheckedIn": sum(row.adultsEntered for row in checkins),
        "childrenCheckedIn": sum(row.childrenEntered for row in checkins),
        "platesUsed": sum(row.platesConsumed for row in checkins),
        "payeeCollection": float(sum(money_decimal(row.amountReceived) for row in registrations)),
        "yuvakMandalContribution": float(sum(money_decimal(row.mandalAmount) for row in registrations)),
        "restrictedAttempts": DinnerCheckIn.query.filter_by(eventId=event.id, restrictedAttempt=True).count(),
        "houseSearchCheckins": DinnerCheckIn.query.filter_by(eventId=event.id, entryMethod="House Search", restrictedAttempt=False).count(),
        "qrCheckins": DinnerCheckIn.query.filter_by(eventId=event.id, entryMethod="QR", restrictedAttempt=False).count(),
        "complimentaryRegistrations": len([row for row in registrations if row.paymentStatus == "Complimentary"]),
    }


def event_dict(event):
    data = serialize_with_relations(event, {"festivalId": "festival", "catererId": "caterer"})
    data["summary"] = event_summary(event)
    return data


@dinner_bp.get("/caterers")
@jwt_required()
def list_caterers():
    return jsonify({"success": True, **query_helper(DinnerCaterer, request.args, ["name", "contactPerson", "primaryMobile", "email"])})


@dinner_bp.post("/caterers")
@jwt_required()
def create_caterer():
    data = normalize_payload(DinnerCaterer, request.get_json() or {})
    required = ["name", "contactPerson", "primaryMobile"]
    missing = [key for key in required if not str(data.get(key) or "").strip()]
    if missing:
        return jsonify({"error": f"{missing[0]} is required"}), 400
    try:
        data["primaryMobile"] = normalize_phone(data["primaryMobile"])
        if data.get("alternateMobile"):
            data["alternateMobile"] = normalize_phone(data["alternateMobile"])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if data.get("email") and "@" not in data["email"]:
        return jsonify({"error": "Valid email is required"}), 400
    caterer = DinnerCaterer(**data)
    db.session.add(caterer)
    db.session.commit()
    return jsonify({"message": "Caterer created", "data": model_to_dict(caterer)}), 201


@dinner_bp.get("/events")
@jwt_required()
def list_events():
    result = query_helper(DinnerEvent, request.args, ["name", "venue", "status"])
    ids = [item["id"] for item in result["data"]]
    rows = DinnerEvent.query.filter(DinnerEvent.id.in_(ids or [0])).all()
    by_id = {row.id: row for row in rows}
    result["data"] = [event_dict(by_id[item_id]) for item_id in ids if item_id in by_id]
    return jsonify({"success": True, **result})


@dinner_bp.post("/events")
@jwt_required()
def create_event():
    try:
        data = event_payload(request.get_json() or {})
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400
    if not data.get("festivalId") or not data.get("name") or not data.get("eventDate"):
        return jsonify({"error": "Festival, event name, and event date are required"}), 400
    if data.get("contributionType") == "split" and money_decimal(data.get("payeePercent")) + money_decimal(data.get("mandalPercent")) != Decimal("100.00"):
        return jsonify({"error": "Payee and Yuvak Mandal split must total 100%."}), 400
    event = DinnerEvent(**data)
    db.session.add(event)
    db.session.commit()
    return jsonify({"message": "Dinner event created", "data": event_dict(event)}), 201


@dinner_bp.get("/events/<event_id>")
@jwt_required()
def get_event(event_id):
    return jsonify({"message": "Dinner event detail", "data": event_dict(row_or_404(DinnerEvent, event_id))})


@dinner_bp.put("/events/<event_id>")
@jwt_required()
def update_event(event_id):
    event = row_or_404(DinnerEvent, event_id)
    try:
        data = event_payload(request.get_json() or {})
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400
    if data.get("contributionType") == "split" and money_decimal(data.get("payeePercent")) + money_decimal(data.get("mandalPercent")) != Decimal("100.00"):
        return jsonify({"error": "Payee and Yuvak Mandal split must total 100%."}), 400
    for key, value in data.items():
        if hasattr(event, key):
            setattr(event, key, value)
    db.session.commit()
    return jsonify({"message": "Dinner event updated", "data": event_dict(event)})


@dinner_bp.post("/events/<event_id>/duplicate")
@jwt_required()
def duplicate_event(event_id):
    source = row_or_404(DinnerEvent, event_id)
    duplicate = DinnerEvent(
        festivalId=source.festivalId,
        catererId=source.catererId,
        name=f"{source.name} Copy",
        eventDate=source.eventDate,
        eventTime=source.eventTime,
        venue=source.venue,
        dinnerType=source.dinnerType,
        notes=source.notes,
        showCouponNote=source.showCouponNote,
        couponImportantNote=source.couponImportantNote,
        status="Draft",
        catererPricingType=source.catererPricingType,
        catererRatePerPlate=source.catererRatePerPlate,
        expectedPlates=source.expectedPlates,
        fixedContractAmount=source.fixedContractAmount,
        advancePaid=source.advancePaid,
        contributionType=source.contributionType,
        memberContributionRate=source.memberContributionRate,
        payeePercent=source.payeePercent,
        mandalPercent=source.mandalPercent,
    )
    db.session.add(duplicate)
    db.session.commit()
    return jsonify({"message": "Dinner event duplicated", "data": event_dict(duplicate)}), 201


@dinner_bp.post("/events/<event_id>/status")
@jwt_required()
def update_event_status(event_id):
    event = row_or_404(DinnerEvent, event_id)
    status = (request.get_json() or {}).get("status")
    if not status:
        return jsonify({"error": "status is required"}), 400
    event.status = status
    if status in {"Completed", "Settled"} and not event.closedAt:
        event.closedAt = now_utc()
    db.session.commit()
    return jsonify({"message": "Status updated", "data": event_dict(event)})


@dinner_bp.get("/events/<event_id>/registrations")
@jwt_required()
def list_registrations(event_id):
    event = row_or_404(DinnerEvent, event_id)
    search = (request.args.get("search") or "").strip()
    query = DinnerRegistration.query.join(House).filter(DinnerRegistration.eventId == event.id)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(House.houseNumber.ilike(like), House.ownerName.ilike(like), House.phone.ilike(like)))
    rows = query.order_by(House.houseNumber).all()
    return jsonify({"success": True, "data": [registration_dict(row) for row in rows]})


@dinner_bp.get("/events/<event_id>/house-search")
@jwt_required()
def house_search(event_id):
    row_or_404(DinnerEvent, event_id)
    search = (request.args.get("search") or "").strip()
    query = House.query
    if search:
        like = f"%{search}%"
        query = query.filter(or_(House.houseNumber.ilike(like), House.ownerName.ilike(like), House.phone.ilike(like)))
    rows = query.order_by(House.houseNumber).limit(30).all()
    return jsonify({"success": True, "data": [model_to_dict(row) for row in rows]})


@dinner_bp.post("/events/<event_id>/registrations")
@jwt_required()
def upsert_registration(event_id):
    event = row_or_404(DinnerEvent, event_id)
    data = request.get_json() or {}
    house_id = public_id(House, data.get("houseId"))
    if not house_id:
        return jsonify({"error": "House is required"}), 400
    house = row_or_404(House, house_id)
    registration = DinnerRegistration.query.filter_by(eventId=event.id, houseId=house.id).first()
    if not registration:
        registration = DinnerRegistration(eventId=event.id, houseId=house.id, contributionType=event.contributionType)
        db.session.add(registration)
    try:
        amounts = registration_amounts(event, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    registration.existingMemberCount = to_int(data.get("existingMemberCount"))
    for key, value in amounts.items():
        setattr(registration, key, value)
    payment_method = data.get("paymentMethod") or None
    registration.amountReceived = Decimal("0.00") if not payment_method and registration.contributionType != "complimentary" else money_decimal(data.get("amountReceived"))
    if registration.amountReceived > 0 and payment_method not in {"Cash", "GPay"}:
        return jsonify({"error": "Payment method must be Cash or GPay"}), 400
    registration.paymentMethod = payment_method
    registration.transactionReference = data.get("transactionReference") if payment_method else None
    claims = get_jwt()
    collector_id = public_id(Volunteer, get_jwt_identity()) if claims.get("role") == "volunteer" else public_id(Volunteer, data.get("volunteerId"))
    if payment_method and not collector_id:
        return jsonify({"error": "Collected By is required when payment method is selected"}), 400
    registration.volunteerId = collector_id if payment_method else None
    registration.notes = data.get("notes") or None
    db.session.flush()
    if registration.paymentStatus in {"Paid", "Complimentary"}:
        ensure_coupon(registration)
    elif registration.coupon:
        db.session.delete(registration.coupon)
    db.session.commit()
    return jsonify({"message": "Dinner registration saved", "data": registration_dict(registration)})


@dinner_bp.get("/events/<event_id>/collections")
@jwt_required()
def collection_summary(event_id):
    event = row_or_404(DinnerEvent, event_id)
    rows = DinnerRegistration.query.outerjoin(Volunteer).filter(DinnerRegistration.eventId == event.id).all()
    handovers = {row.volunteerId: row for row in DinnerCollectionHandover.query.filter_by(eventId=event.id).all()}
    summary = {}
    for row in rows:
        amount = money_decimal(row.amountReceived)
        if amount <= 0:
            continue
        volunteer_id = row.volunteerId or 0
        key = str(volunteer_id)
        if key not in summary:
            summary[key] = {
                "volunteerId": model_to_dict(row.volunteer) if row.volunteer else None,
                "volunteerName": row.volunteer.name if row.volunteer else "Unassigned",
                "cashAmount": Decimal("0.00"),
                "gpayAmount": Decimal("0.00"),
                "totalAmount": Decimal("0.00"),
                "houseCount": 0,
            }
        method = row.paymentMethod
        if method == "Cash":
            summary[key]["cashAmount"] += amount
        else:
            summary[key]["gpayAmount"] += amount
        summary[key]["totalAmount"] += amount
        summary[key]["houseCount"] += 1
    data = []
    for item in summary.values():
        volunteer_id = item["volunteerId"]["id"] if item["volunteerId"] else None
        handover = handovers.get(resolve_public_id(Volunteer, volunteer_id)) if volunteer_id else None
        item["handoverStatus"] = handover.status if handover else "Pending"
        item["handoverCollectedAt"] = handover.collectedAt.isoformat() if handover and handover.collectedAt else None
        item["handoverCollectedBy"] = handover.collectedBy if handover else None
        item["cashAmount"] = float(item["cashAmount"])
        item["gpayAmount"] = float(item["gpayAmount"])
        item["totalAmount"] = float(item["totalAmount"])
        data.append(item)
    data.sort(key=lambda item: (item["handoverStatus"] == "Collected", item["volunteerName"]))
    totals = {
        "cashAmount": float(sum(money_decimal(item["cashAmount"]) for item in data)),
        "gpayAmount": float(sum(money_decimal(item["gpayAmount"]) for item in data)),
        "totalAmount": float(sum(money_decimal(item["totalAmount"]) for item in data)),
        "houseCount": sum(item["houseCount"] for item in data),
    }
    return jsonify({"success": True, "data": {"event": event_dict(event), "rows": data, "totals": totals}})


@dinner_bp.post("/events/<event_id>/collections/<volunteer_id>/handover")
@jwt_required()
def update_collection_handover(event_id, volunteer_id):
    event = row_or_404(DinnerEvent, event_id)
    volunteer_pk = public_id(Volunteer, volunteer_id)
    if not volunteer_pk:
        return jsonify({"error": "Volunteer is required"}), 400
    row_or_404(Volunteer, volunteer_pk)
    data = request.get_json() or {}
    status = data.get("status") or "Collected"
    if status not in {"Pending", "Collected"}:
        return jsonify({"error": "Status must be Pending or Collected"}), 400
    handover = DinnerCollectionHandover.query.filter_by(eventId=event.id, volunteerId=volunteer_pk).first()
    if not handover:
        handover = DinnerCollectionHandover(eventId=event.id, volunteerId=volunteer_pk)
        db.session.add(handover)
    handover.status = status
    handover.collectedAt = now_utc() if status == "Collected" else None
    handover.collectedBy = str(get_jwt_identity() or "") if status == "Collected" else None
    handover.notes = data.get("notes") or None
    db.session.commit()
    return collection_summary(event_id)


@dinner_bp.delete("/registrations/<registration_id>")
@jwt_required()
def delete_registration(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    if registration.checkins.count():
        return jsonify({"error": "This house has check-in history. Delete is blocked to preserve the gate audit trail."}), 400
    db.session.delete(registration)
    db.session.commit()
    return jsonify({"message": "Dinner registration, collection, and QR coupon deleted"})


@dinner_bp.post("/registrations/<registration_id>/payment/unpaid")
@jwt_required()
def mark_registration_unpaid(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    if registration.checkins.filter_by(restrictedAttempt=False).count():
        return jsonify({"error": "This house has check-in history. Mark unpaid is blocked to preserve the gate audit trail."}), 400
    if registration.contributionType == "complimentary":
        return jsonify({"error": "Complimentary registrations do not have a payee collection to mark unpaid."}), 400
    registration.amountReceived = Decimal("0.00")
    registration.paymentMethod = None
    registration.transactionReference = None
    registration.volunteerId = None
    registration.paymentStatus = "Pending"
    if registration.coupon:
        db.session.delete(registration.coupon)
    db.session.commit()
    return jsonify({"message": "Registration marked unpaid and QR coupon removed", "data": registration_dict(registration)})


@dinner_bp.post("/registrations/<registration_id>/coupon")
@jwt_required()
def generate_coupon(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    if registration.paymentStatus not in {"Paid", "Complimentary"}:
        return jsonify({"error": "Payment must be completed before generating coupon"}), 400
    coupon = ensure_coupon(registration)
    db.session.commit()
    return jsonify({"message": "Coupon generated", "data": coupon_dict(coupon)})


def coupon_dict(coupon):
    data = model_to_dict(coupon)
    data["qrPayload"] = coupon.token
    data["couponCode"] = dinner_coupon_code(coupon.registration)
    data["registration"] = registration_dict(coupon.registration)
    return data


@dinner_bp.post("/registrations/<registration_id>/coupon/send")
@jwt_required()
def mark_coupon_sent(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    coupon = registration.coupon
    if not coupon:
        return jsonify({"error": "Generate coupon before sending"}), 400
    data = request.get_json() or {}
    coupon.deliveryChannel = data.get("deliveryChannel") or "WhatsApp"
    coupon.sentTo = data.get("sentTo") or registration.house.phone
    coupon.deliveryStatus = "Sent"
    coupon.status = "Sent"
    coupon.sentAt = now_utc()
    db.session.commit()
    return jsonify({"message": "Coupon delivery recorded", "data": coupon_dict(coupon)})


@dinner_bp.get("/coupons/validate")
@jwt_required()
def validate_coupon():
    token = request.args.get("token")
    if not token:
        return jsonify({"error": "token is required"}), 400
    try:
        payload = token_serializer().loads(token)
        registration = DinnerRegistration.query.get(payload.get("registration"))
    except BadSignature:
        normalized = "".join(ch for ch in token.upper() if ch.isalnum())
        registration = None
        for coupon in DinnerCoupon.query.filter(DinnerCoupon.status != "Revoked").all():
            if "".join(ch for ch in dinner_coupon_code(coupon.registration).upper() if ch.isalnum()) == normalized:
                registration = coupon.registration
                break
    if not registration or not registration.coupon or registration.coupon.status == "Revoked":
        return jsonify({"error": "Coupon is not valid"}), 400
    return jsonify({"success": True, "data": registration_dict(registration)})


@dinner_bp.post("/registrations/<registration_id>/checkins")
@jwt_required()
def create_checkin(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    event = registration.event
    data = request.get_json() or {}
    adults = to_int(data.get("adultsEntered"))
    children = to_int(data.get("childrenEntered"))
    plates = to_int(data.get("platesConsumed"))
    totals = checkin_totals(registration)
    errors = []
    if event.closedAt or event.status in {"Completed", "Settled", "Cancelled"}:
        errors.append("Event is closed for check-in.")
    if registration.paymentStatus not in {"Paid", "Complimentary"}:
        errors.append(f"Payment pending. Amount due: {registration.payeeAmount - registration.amountReceived}")
    if adults > registration.adults - totals["adultsCheckedIn"]:
        errors.append(f"Only {max(0, registration.adults - totals['adultsCheckedIn'])} registered adult remains for this house.")
    if children > registration.childrenBelow7 - totals["childrenCheckedIn"]:
        errors.append(f"Only {max(0, registration.childrenBelow7 - totals['childrenCheckedIn'])} child below 7 remains for this house.")
    if plates > registration.adults - totals["platesUsed"]:
        errors.append(f"Only {max(0, registration.adults - totals['platesUsed'])} plate remains for this house.")
    if errors:
        db.session.add(DinnerCheckIn(
            eventId=registration.eventId,
            registrationId=registration.id,
            houseId=registration.houseId,
            adultsEntered=0,
            childrenEntered=0,
            platesConsumed=0,
            entryMethod=data.get("entryMethod") or "House Search",
            gateName=data.get("gateName"),
            volunteerName=data.get("volunteerName"),
            restrictedAttempt=True,
            overrideReason=" ".join(errors),
        ))
        db.session.commit()
        return jsonify({"error": errors[0], "errors": errors, "data": registration_dict(registration)}), 400
    checkin = DinnerCheckIn(
        eventId=registration.eventId,
        registrationId=registration.id,
        houseId=registration.houseId,
        adultsEntered=adults,
        childrenEntered=children,
        platesConsumed=plates,
        entryMethod=data.get("entryMethod") or "House Search",
        gateName=data.get("gateName"),
        volunteerName=data.get("volunteerName") or str(get_jwt_identity() or ""),
    )
    db.session.add(checkin)
    db.session.commit()
    return jsonify({"message": "Check-in recorded", "data": registration_dict(registration)})


@dinner_bp.delete("/registrations/<registration_id>/checkins")
@jwt_required()
def revert_checkins(registration_id):
    registration = row_or_404(DinnerRegistration, registration_id)
    count = registration.checkins.filter_by(restrictedAttempt=False).count()
    if not count:
        return jsonify({"error": "No successful check-in found for this house."}), 400
    registration.checkins.filter_by(restrictedAttempt=False).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"message": "Check-in reverted", "data": registration_dict(registration)})


@dinner_bp.get("/events/<event_id>/report")
@jwt_required()
def event_report(event_id):
    event = row_or_404(DinnerEvent, event_id)
    rows = DinnerRegistration.query.filter_by(eventId=event.id).all()
    return jsonify({"success": True, "data": {"event": event_dict(event), "metrics": event_summary(event), "rows": [registration_dict(row) for row in rows]}})


@dinner_bp.post("/events/<event_id>/plate-confirmation")
@jwt_required()
def plate_confirmation(event_id):
    event = row_or_404(DinnerEvent, event_id)
    data = request.get_json() or {}
    final_count = to_int(data.get("finalPlateCount", event_summary(event)["platesEntitled"]))
    event.finalPlateCount = final_count
    if data.get("shared"):
        event.plateSharedAt = now_utc()
    if data.get("confirmed"):
        event.catererConfirmedAt = now_utc()
        event.confirmedBy = str(get_jwt_identity() or "")
        event.status = "Plate Count Finalized"
    db.session.commit()
    return jsonify({"message": "Plate confirmation updated", "data": event_dict(event)})


def recalc_settlement(settlement, event=None):
    event = event or settlement.event or DinnerEvent.query.get(settlement.eventId)
    if not event:
        raise ValueError("Dinner event is required for settlement calculation")
    summary = event_summary(event)
    final_plates = event.finalPlateCount or summary["platesEntitled"]
    settlement.finalPlateCount = final_plates
    if event.catererPricingType == "fixed":
        base = money_decimal(event.fixedContractAmount)
    else:
        base = money_decimal(final_plates) * money_decimal(event.catererRatePerPlate)
    adjustments = settlement.adjustments.all() if settlement.id else []
    adjustment_total = sum((money_decimal(item.amount) * (Decimal("-1") if item.direction == "deduction" else Decimal("1"))) for item in adjustments)
    settlement.baseAmount = base
    settlement.advancePaid = money_decimal(event.advancePaid)
    settlement.grossAmount = base + adjustment_total
    settlement.finalPayable = settlement.grossAmount - settlement.advancePaid


@dinner_bp.get("/events/<event_id>/settlement")
@jwt_required()
def get_settlement(event_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement
    if not settlement:
        settlement = DinnerSettlement(eventId=event.id, event=event)
        recalc_settlement(settlement, event)
        db.session.add(settlement)
        db.session.commit()
    recalc_settlement(settlement, event)
    db.session.commit()
    return jsonify({"success": True, "data": settlement_dict(settlement)})


def settlement_dict(settlement):
    data = model_to_dict(settlement)
    data["event"] = event_dict(settlement.event)
    data["adjustments"] = [model_to_dict(row) for row in settlement.adjustments.all()]
    collection_total = money_decimal(sum(money_decimal(row.amountReceived) for row in settlement.event.registrations.all()))
    final_payable = money_decimal(settlement.finalPayable)
    data["collectionTotal"] = float(collection_total)
    data["festivalFundSurplus"] = float(max(Decimal("0.00"), collection_total - final_payable))
    data["festivalFundShortfall"] = float(max(Decimal("0.00"), final_payable - collection_total))
    return data


@dinner_bp.post("/events/<event_id>/settlement/adjustments")
@jwt_required()
def add_adjustment(event_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement or DinnerSettlement(eventId=event.id, event=event)
    if not settlement.id:
        db.session.add(settlement)
        db.session.flush()
    data = request.get_json() or {}
    adjustment = DinnerSettlementAdjustment(
        settlementId=settlement.id,
        adjustmentType=data.get("adjustmentType") or "Other",
        description=data.get("description"),
        amount=money_decimal(data.get("amount")),
        direction=data.get("direction") or "increase",
    )
    db.session.add(adjustment)
    db.session.flush()
    recalc_settlement(settlement, event)
    db.session.commit()
    return jsonify({"message": "Adjustment added", "data": settlement_dict(settlement)})


@dinner_bp.put("/events/<event_id>/settlement/adjustments/<adjustment_id>")
@jwt_required()
def update_adjustment(event_id, adjustment_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement
    if not settlement:
        return jsonify({"error": "Settlement not found"}), 404
    adjustment = row_or_404(DinnerSettlementAdjustment, adjustment_id)
    if adjustment.settlementId != settlement.id:
        return jsonify({"error": "Adjustment does not belong to this event settlement"}), 400
    data = request.get_json() or {}
    adjustment.adjustmentType = data.get("adjustmentType") or "Other"
    adjustment.description = data.get("description")
    adjustment.amount = money_decimal(data.get("amount"))
    adjustment.direction = data.get("direction") or "increase"
    recalc_settlement(settlement, event)
    db.session.commit()
    return jsonify({"message": "Adjustment updated", "data": settlement_dict(settlement)})


@dinner_bp.post("/events/<event_id>/settlement/paid")
@jwt_required()
def mark_settlement_paid(event_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement or DinnerSettlement(eventId=event.id, event=event)
    if not settlement.id:
        db.session.add(settlement)
        db.session.flush()
    data = request.get_json() or {}
    payment_method = data.get("paymentMethod") or "Cash"
    if payment_method not in {"Cash", "GPay", "Both"}:
        return jsonify({"error": "Payment method must be Cash, GPay, or Both"}), 400
    recalc_settlement(settlement, event)
    settlement.status = "Paid"
    settlement.paymentDate = parse_date(data.get("paymentDate")) or now_utc().date()
    settlement.paymentMethod = payment_method
    settlement.referenceNumber = data.get("referenceNumber")
    settlement.notes = data.get("notes")
    collection_total = money_decimal(sum(money_decimal(row.amountReceived) for row in event.registrations.all()))
    final_payable = money_decimal(settlement.finalPayable)
    shortfall = max(Decimal("0.00"), final_payable - collection_total)
    surplus = max(Decimal("0.00"), collection_total - final_payable)
    surplus_label = dinner_account_label(event, "Surplus")
    mandal_pay_label = dinner_account_label(event, "Pay from Mandal", 255)
    if shortfall <= 0 and settlement.expenseId:
        linked_expense = Expense.query.get(settlement.expenseId)
        settlement.expenseId = None
        if linked_expense:
            db.session.delete(linked_expense)
    if surplus <= 0 and settlement.fundTransactionId:
        linked_fund = FundTransaction.query.get(settlement.fundTransactionId)
        settlement.fundTransactionId = None
        if linked_fund:
            db.session.delete(linked_fund)
    if shortfall > 0 and settlement.expenseId:
        expense = Expense.query.get(settlement.expenseId)
        if expense:
            expense.category = mandal_pay_label
            expense.amount = shortfall
            expense.paymentMethod = settlement.paymentMethod
            expense.description = mandal_pay_label
            expense.note = f"Collections: {collection_total}; Final payable: {final_payable}. {settlement.notes or ''}".strip()
            expense.date = now_utc()
            expense.isSettled = True
            expense.settledOn = now_utc()
    if shortfall > 0 and not settlement.expenseId:
        expense = Expense(
            festivalId=event.festivalId,
            category=mandal_pay_label,
            amount=shortfall,
            paymentMethod=settlement.paymentMethod,
            description=mandal_pay_label,
            note=f"Collections: {collection_total}; Final payable: {final_payable}. {settlement.notes or ''}".strip(),
            date=now_utc(),
            isSettled=True,
            settledOn=now_utc(),
            festivalYear=event.festival.year,
        )
        db.session.add(expense)
        db.session.flush()
        settlement.expenseId = expense.id
    if surplus > 0 and settlement.expenseId:
        linked_expense = Expense.query.get(settlement.expenseId)
        settlement.expenseId = None
        if linked_expense:
            db.session.delete(linked_expense)
    if surplus > 0 and not settlement.fundTransactionId:
        fund = FundTransaction(
            type=surplus_label,
            name=surplus_label,
            amount=surplus,
            paymentMethod=settlement.paymentMethod,
            reference=settlement.referenceNumber,
            date=now_utc(),
            festivalYear=event.festival.year,
        )
        db.session.add(fund)
        db.session.flush()
        settlement.fundTransactionId = fund.id
    if surplus > 0 and settlement.fundTransactionId:
        fund = FundTransaction.query.get(settlement.fundTransactionId)
        if fund:
            fund.type = surplus_label
            fund.name = surplus_label
            fund.amount = surplus
            fund.paymentMethod = settlement.paymentMethod
            fund.reference = settlement.referenceNumber
            fund.date = now_utc()
    if shortfall > 0 and settlement.fundTransactionId:
        linked_fund = FundTransaction.query.get(settlement.fundTransactionId)
        settlement.fundTransactionId = None
        if linked_fund:
            db.session.delete(linked_fund)
    event.status = "Settled"
    db.session.commit()
    return jsonify({"message": "Settlement marked paid", "data": settlement_dict(settlement)})


@dinner_bp.post("/events/<event_id>/settlement/unpaid")
@jwt_required()
def mark_settlement_unpaid(event_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement or DinnerSettlement(eventId=event.id, event=event)
    if not settlement.id:
        db.session.add(settlement)
        db.session.flush()
    linked_expense = Expense.query.get(settlement.expenseId) if settlement.expenseId else None
    linked_fund = FundTransaction.query.get(settlement.fundTransactionId) if settlement.fundTransactionId else None
    settlement.expenseId = None
    settlement.fundTransactionId = None
    recalc_settlement(settlement, event)
    settlement.status = "Pending"
    settlement.paymentDate = None
    settlement.paymentMethod = None
    settlement.referenceNumber = None
    settlement.notes = None
    if event.status == "Settled":
        event.status = "Completed"
    if linked_expense:
        db.session.delete(linked_expense)
    if linked_fund:
        db.session.delete(linked_fund)
    db.session.commit()
    return jsonify({"message": "Settlement marked unpaid", "data": settlement_dict(settlement)})


@dinner_bp.get("/events/<event_id>/settlement/download")
@jwt_required()
def download_settlement(event_id):
    event = row_or_404(DinnerEvent, event_id)
    settlement = event.settlement or DinnerSettlement(eventId=event.id, event=event)
    recalc_settlement(settlement, event)
    lines = [
        f"Event: {event.name}",
        f"Caterer: {event.caterer.name if event.caterer else ''}",
        f"Pricing: {event.catererPricingType}",
        f"Final plates: {settlement.finalPlateCount}",
        f"Base amount: {settlement.baseAmount}",
        f"Gross amount: {settlement.grossAmount}",
        f"Advance paid: {settlement.advancePaid}",
        f"Final payable: {settlement.finalPayable}",
        f"Status: {settlement.status}",
    ]
    pdf = simple_pdf("Dinner Caterer Settlement", lines)
    return Response(pdf, mimetype="application/pdf", headers={"Content-Disposition": f"attachment; filename=dinner_settlement_{event.id}.pdf"})
