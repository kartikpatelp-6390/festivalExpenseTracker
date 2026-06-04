from flask import Blueprint, redirect

from ..models import ShortLink

shortlinks_bp = Blueprint("shortlinks", __name__)


@shortlinks_bp.get("/<key>")
def resolve_shortlink(key):
    record = ShortLink.query.filter(
        (ShortLink.shortCode == key) | (ShortLink.mongoId == key)
    ).first()
    if not record:
        return "Invalid or expired link", 404
    return redirect(record.targetUrl)

