import re
from io import BytesIO
from pathlib import Path
from datetime import date
from decimal import Decimal
from datetime import datetime, timezone

import bcrypt
from flask import current_app
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from sqlalchemy import asc, desc, inspect, or_
from werkzeug.security import check_password_hash


_FONT_REGISTERED = False
_REPORT_BOLD_FONT_REGISTERED = False


def normalize_phone(phone):
    digits = re.sub(r"\D", "", str(phone or ""))
    if len(digits) == 10:
        return f"91{digits}"
    if digits.startswith("91") and len(digits) == 12:
        return digits
    raise ValueError("Invalid phone number")


def parse_bool(value):
    if value == "true":
        return True
    if value == "false":
        return False
    return value


def now_utc():
    return datetime.now(timezone.utc)


def hash_password(password):
    return bcrypt.hashpw(str(password).encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password_hash, password):
    if not password_hash or password is None:
        return False

    password_hash = str(password_hash)
    password_bytes = str(password).encode("utf-8")

    if password_hash.startswith(("$2a$", "$2b$", "$2y$")):
        return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))

    try:
        return check_password_hash(password_hash, password)
    except ValueError:
        return False


def simple_pdf(title, lines):
    text = [title, "", *[str(line) for line in lines]]
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in text]
    stream_lines = ["BT", "/F1 14 Tf", "50 790 Td"]
    for index, line in enumerate(escaped):
        if index:
            stream_lines.append("0 -22 Td")
        stream_lines.append(f"({line}) Tj")
    stream_lines.append("ET")
    stream = "\n".join(stream_lines).encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(pdf)


def _asset_path(filename):
    return Path(__file__).resolve().parents[2] / "ui" / "public" / "assets" / filename


def _format_report_amount(value):
    amount = Decimal(str(value or 0)).quantize(Decimal("1"))
    return f"₹{int(amount):,}"


def _scaled_pdf_image(path, height):
    with Image.open(path) as image:
        width = height * (image.width / image.height)
    return width, height


def generate_income_expense_report_pdf(year, report_data):
    buffer = BytesIO()
    report_logo = _asset_path("report_logo.png")
    yuvak_logo = _asset_path("yuvak_logo.png")
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=47 * mm,
        bottomMargin=28 * mm,
        title="Income & Expense Report",
    )
    font_name = _register_receipt_font()
    report_bold_font = _register_report_bold_font()
    bold_font = "Helvetica-Bold"
    page_width, page_height = A4
    usable_width = page_width - pdf.leftMargin - pdf.rightMargin

    story = []

    rows = [["Title", "Income", "Expense"]]
    row_types = ["header"]
    total_income = float(report_data.get("income") or 0)
    total_expense = float(report_data.get("totalExpense") or 0)
    balance = float(report_data.get("balance") or 0)

    rows.append(["Total Income", _format_report_amount(total_income), ""])
    row_types.append("income-total")
    for title, info in (report_data.get("incomeGroup") or {}).items():
        rows.append([title, _format_report_amount((info or {}).get("total")), ""])
        row_types.append("income-item")

    for festival_name, categories in (report_data.get("expenses") or {}).items():
        rows.append([festival_name, "", ""])
        row_types.append("festival")
        for category, category_data in (categories or {}).items():
            rows.append([category, "", _format_report_amount((category_data or {}).get("total"))])
            row_types.append("category")
            for item in (category_data or {}).get("items", []):
                rows.append([item.get("title") or "", "", _format_report_amount(item.get("amount"))])
                row_types.append("expense-item")

    rows.append(["Total", _format_report_amount(total_income), _format_report_amount(total_expense)])
    row_types.append("total")
    rows.append(["Balance", "", _format_report_amount(balance)])
    row_types.append("balance")

    table = Table(rows, colWidths=[usable_width * 0.665, usable_width * 0.16, usable_width * 0.175], repeatRows=1)
    style = TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 8.7),
        ("LEADING", (0, 0), (-1, -1), 10.5),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#d9d9d9")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 1), (0, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
        ("FONTNAME", (0, 1), (0, 1), bold_font),
    ])

    for index, row_type in enumerate(row_types):
        if row_type == "festival":
            style.add("SPAN", (0, index), (-1, index))
            style.add("ALIGN", (0, index), (0, index), "LEFT")
            style.add("FONTNAME", (0, index), (0, index), bold_font)
            style.add("BACKGROUND", (0, index), (-1, index), colors.HexColor("#f7f7f7"))
            style.add("TOPPADDING", (0, index), (-1, index), 4)
        elif row_type == "income-total":
            style.add("ALIGN", (0, index), (0, index), "LEFT")
            style.add("FONTNAME", (1, index), (1, index), report_bold_font)
        elif row_type == "category":
            style.add("BACKGROUND", (0, index), (-1, index), colors.HexColor("#eeeeee"))
            style.add("FONTNAME", (0, index), (0, index), "Helvetica-BoldOblique")
            style.add("FONTNAME", (2, index), (2, index), report_bold_font)
        elif row_type == "income-item":
            style.add("FONTNAME", (0, index), (0, index), "Helvetica-Oblique")
        elif row_type in {"total", "balance"}:
            style.add("FONTNAME", (0, index), (0, index), bold_font)
            style.add("FONTNAME", (1, index), (-1, index), report_bold_font)
        if row_type == "balance":
            style.add("TEXTCOLOR", (2, index), (2, index), colors.HexColor("#0a8a1f"))

    table.setStyle(style)
    story.append(table)

    class ReportCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            page_count = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_page_chrome(page_count)
                super().showPage()
            super().save()

        def _draw_page_chrome(self, page_count):
            self.saveState()
            self.setFillColor(colors.black)

            header_y = page_height - 8 * mm
            header_images = []
            if report_logo.exists():
                header_images.append((str(report_logo), *_scaled_pdf_image(report_logo, 27 * mm)))
            if yuvak_logo.exists():
                header_images.append((str(yuvak_logo), *_scaled_pdf_image(yuvak_logo, 26 * mm)))
            if header_images:
                gap = 4 * mm
                group_width = sum(width for _, width, _ in header_images) + gap * (len(header_images) - 1)
                x = (page_width - group_width) / 2
                for image_path, image_width, image_height in header_images:
                    self.drawImage(
                        image_path,
                        x,
                        header_y - image_height,
                        width=image_width,
                        height=image_height,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                    x += image_width + gap

            self.setFont("Helvetica-Bold", 14)
            self.drawCentredString(page_width / 2, page_height - 40 * mm, f"Festival Income & Expense Report - {year}")

            self.setFillColor(colors.HexColor("#333333"))
            self.setFont("Helvetica-Oblique", 12)
            self.drawCentredString(
                page_width / 2,
                20 * mm,
                "Thank you for your generous contribution and valuable support towards our festival",
            )
            self.setFont("Helvetica-Oblique", 8)
            self.drawRightString(page_width - 12 * mm, 8 * mm, f"Page {self._pageNumber} of {page_count}")
            self.restoreState()

    pdf.build(story, canvasmaker=ReportCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def _register_report_bold_font():
    global _REPORT_BOLD_FONT_REGISTERED
    if _REPORT_BOLD_FONT_REGISTERED:
        return "ReportSansBold"

    candidates = [
        ("/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc", 1),
        ("/System/Library/Fonts/Supplemental/DevanagariMT.ttc", 1),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
        ("/System/Library/Fonts/Supplemental/Verdana Bold.ttf", 0),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
    ]
    for font_path, subfont_index in candidates:
        if Path(font_path).exists():
            pdfmetrics.registerFont(TTFont("ReportSansBold", font_path, subfontIndex=subfont_index))
            _REPORT_BOLD_FONT_REGISTERED = True
            return "ReportSansBold"
    return "Helvetica-Bold"


def _register_receipt_font():
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return "ReceiptSans"

    candidates = [
        "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for font_path in candidates:
        if Path(font_path).exists():
            pdfmetrics.registerFont(TTFont("ReceiptSans", font_path))
            _FONT_REGISTERED = True
            return "ReceiptSans"
    return "Helvetica"


def _format_receipt_date(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if not value:
        value = now_utc()
    return value.strftime("%B %d, %Y").replace(" 0", " ")


def _amount_to_words(value):
    number = int(Decimal(value or 0).quantize(Decimal("1")))
    if number == 0:
        return "Zero"

    ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def below_thousand(n):
        parts = []
        if n >= 100:
            parts.append(f"{ones[n // 100]} Hundred")
            n %= 100
        if n >= 20:
            parts.append(tens[n // 10])
            n %= 10
        if n:
            parts.append(ones[n])
        return " ".join(parts)

    groups = [(10000000, "Crore"), (100000, "Lakh"), (1000, "Thousand")]
    words = []
    for divisor, label in groups:
        if number >= divisor:
            words.append(f"{below_thousand(number // divisor)} {label}")
            number %= divisor
    if number:
        words.append(below_thousand(number))
    return " ".join(words)


def generate_fund_receipt_pdf(fund):
    buffer = BytesIO()
    width, height = 175 * mm, 105 * mm
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    font_name = _register_receipt_font()
    bold_font = "Helvetica-Bold"
    italic_font = "Helvetica-Oblique"

    pdf.setFillColor(colors.whitesmoke)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(colors.HexColor("#d8d8d8"))
    pdf.setLineWidth(0.8)
    pdf.rect(6 * mm, 6 * mm, width - 12 * mm, height - 12 * mm, fill=1, stroke=1)

    content_left = 11 * mm
    content_right = width - 11 * mm
    watermark_path = Path(__file__).resolve().parents[2] / "ui" / "public" / "assets" / "shivam-yuvak-mandal.png"
    if watermark_path.exists():
        with Image.open(watermark_path) as image:
            watermark = image.convert("RGBA")
            watermark.thumbnail((320, 480), Image.Resampling.LANCZOS)
            watermark_height = 58 * mm
            watermark_width = watermark_height * (watermark.width / watermark.height)
            pdf.saveState()
            pdf.setFillAlpha(0.08)
            pdf.setStrokeAlpha(0.08)
            pdf.drawImage(
                ImageReader(watermark),
                (width - watermark_width) / 2,
                21 * mm,
                width=watermark_width,
                height=watermark_height,
                preserveAspectRatio=True,
                mask="auto",
            )
            pdf.restoreState()

    top = height - 16 * mm
    logo_path = Path(__file__).resolve().parents[2] / "ui" / "public" / "assets" / "receipt_logo.png"
    logo_y = top - 7 * mm
    logo_height = 11.2 * mm
    if logo_path.exists():
        pdf.drawImage(str(logo_path), 30 * mm, logo_y, width=28 * mm, height=logo_height, preserveAspectRatio=True, mask="auto")

    pdf.setFillColor(colors.HexColor("#8b4513"))
    pdf.setFont("Helvetica-Bold", 26)
    title_y = logo_y + (logo_height / 2) - (26 * 0.35)
    pdf.drawCentredString(width / 2 + 20 * mm, title_y, "Shivam Yuvak Mandal")

    pdf.setFillColor(colors.black)
    pdf.setFont(italic_font, 12)
    pdf.drawCentredString(
        width / 2,
        height - 35 * mm,
        "Shivam Duplex, Behind L&T Knowledge City, Waghodia Road, Ankhol, Vadodara",
    )
    pdf.setFont(bold_font, 12)
    pdf.drawCentredString(width / 2, height - 43 * mm, f"Festival Collection Receipt {fund.festivalYear or ''}".strip())

    amount = Decimal(fund.amount or 0)
    amount_text = f"{int(amount) if amount == amount.to_integral_value() else amount:.0f}"
    donor_name = fund.name or (fund.house.ownerName if getattr(fund, "house", None) else "") or ""
    house_number = fund.house.houseNumber if getattr(fund, "house", None) else ""
    label = "House Number"
    label_value = house_number or ""
    receipt_date = _format_receipt_date(getattr(fund, "date", None))
    payment_method = fund.paymentMethod or ""

    y = height - 55 * mm
    pdf.setFont(bold_font, 11)
    pdf.drawString(content_left, y, f"{label}:")
    pdf.setFont(font_name, 11)
    pdf.drawString(content_left + 29 * mm, y, str(label_value))
    pdf.setFont(bold_font, 11)
    date_label = "Date:"
    pdf.drawString(content_right - 39 * mm, y, date_label)
    pdf.setFont(font_name, 11)
    pdf.drawString(content_right - 27 * mm, y, receipt_date)

    lines = [
        ("Name:", donor_name),
        ("Amount:", f"₹{amount_text}/-"),
        ("Amount in words:", f"Rupees {_amount_to_words(amount)} Only"),
        ("Payment Type:", payment_method),
    ]
    y -= 7 * mm
    for label_text, value_text in lines:
        pdf.setFont(bold_font, 11)
        pdf.drawString(content_left, y, label_text)
        pdf.setFont(font_name, 11)
        pdf.drawString(content_left + pdf.stringWidth(label_text, bold_font, 11) + 1.6 * mm, y, str(value_text))
        y -= 7 * mm

    pdf.setFont(font_name, 10)
    pdf.drawCentredString(width / 2, 17 * mm, "Thank you for contribution")
    pdf.setFont(font_name, 8)
    footer_prefix = "Design & Developed by "
    footer_link = "kplab.dev"
    prefix_width = pdf.stringWidth(footer_prefix, font_name, 8)
    link_width = pdf.stringWidth(footer_link, font_name, 8)
    footer_x = (width - prefix_width - link_width) / 2
    pdf.setFillColor(colors.black)
    pdf.drawString(footer_x, 11 * mm, footer_prefix)
    pdf.setFillColor(colors.blue)
    pdf.drawString(footer_x + prefix_width, 11 * mm, footer_link)
    pdf.line(footer_x + prefix_width, 10.5 * mm, footer_x + prefix_width + link_width, 10.5 * mm)
    pdf.linkURL(
        "https://kplab.dev/",
        (footer_x + prefix_width, 10.3 * mm, footer_x + prefix_width + link_width, 13.8 * mm),
        relative=0,
        thickness=0,
    )

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def upload_receipt_to_s3(pdf_buffer, filename):
    import boto3

    bucket = current_app.config["AWS_S3_BUCKET_NAME"]
    region = current_app.config["AWS_REGION"]
    key = f"receipts/{filename}"
    client_kwargs = {"region_name": region}
    if current_app.config.get("AWS_ACCESS_KEY_ID") and current_app.config.get("AWS_SECRET_ACCESS_KEY"):
        client_kwargs.update(
            aws_access_key_id=current_app.config["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=current_app.config["AWS_SECRET_ACCESS_KEY"],
        )
    client = boto3.client("s3", **client_kwargs)
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=pdf_buffer,
        ContentType="application/pdf",
    )
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def model_to_dict(row, include=None):
    if row is None:
        return None
    data = {}
    state = inspect(row)
    for attr in state.mapper.column_attrs:
        column = attr.columns[0]
        value = state.attrs[attr.key].value
        data[column.name] = value
        if attr.key != column.name:
            data[attr.key] = value
    for key, value in list(data.items()):
        if isinstance(value, (datetime, date)):
            data[key] = value.isoformat()
        elif isinstance(value, Decimal):
            data[key] = float(value)
    if include:
        for name in include:
            value = getattr(row, name, None)
            if value is not None:
                data[name] = model_to_dict(value)
    data["_id"] = data.get("mongo_id") or data.get("id")
    return data


def public_id(row):
    return getattr(row, "mongoId", None) or getattr(row, "id", None)


def get_by_public_id(model, value):
    if value is None:
        return None
    value = str(value)
    if value.isdigit():
        row = model.query.get(int(value))
        if row:
            return row
    if hasattr(model, "mongoId"):
        return model.query.filter_by(mongoId=value).first()
    return None


def resolve_public_id(model, value):
    if value in {"", None}:
        return None
    row = get_by_public_id(model, value)
    return row.id if row else value


FIELD_ALIASES = {
    "mongo_id": "mongoId",
    "created_at": "createdAt",
    "updated_at": "updatedAt",
    "house_number": "houseNumber",
    "owner_name": "ownerName",
    "festival_date": "date",
    "festival_id": "festivalId",
    "festival_year": "festivalYear",
    "volunteer_id": "volunteerId",
    "house_id": "houseId",
    "payment_method": "paymentMethod",
    "reference_no": "reference",
    "transaction_date": "date",
    "alternative_phone": "alternativePhone",
    "expense_date": "date",
    "estimated_amount": "estimatedAmount",
    "is_settled": "isSettled",
    "settled_on": "settledOn",
    "item_count": "itemCount",
    "is_done": "isDone",
    "created_by_mongo_id": "createdByMongoId",
    "short_code": "shortCode",
    "target_url": "targetUrl",
}

REVERSE_FIELD_ALIASES = {value: key for key, value in FIELD_ALIASES.items()}


def normalize_payload(model, payload):
    normalized = {}
    for key, value in (payload or {}).items():
        candidates = [key]
        if key in REVERSE_FIELD_ALIASES:
            candidates.append(REVERSE_FIELD_ALIASES[key])
        if key in FIELD_ALIASES:
            candidates.append(FIELD_ALIASES[key])
        for candidate in candidates:
            if hasattr(model, candidate):
                normalized[candidate] = value
                break
    return normalized


def model_attr_name(model, key):
    candidates = [key]
    if key in REVERSE_FIELD_ALIASES:
        candidates.append(REVERSE_FIELD_ALIASES[key])
    if key in FIELD_ALIASES:
        candidates.append(FIELD_ALIASES[key])
    for candidate in candidates:
        if hasattr(model, candidate):
            return candidate
    return None


def serialize_with_relations(row, relations=None):
    data = model_to_dict(row)
    relations = relations or {}
    for response_key, attr_name in relations.items():
        related = getattr(row, attr_name, None)
        if related is not None:
            data[response_key] = model_to_dict(related)
    return data


def query_helper(model, query_args, search_fields=None, exact_fields=None):
    search_fields = search_fields or []
    exact_fields = exact_fields or []
    query = model.query

    filters = {
        key: parse_bool(value)
        for key, value in query_args.items()
        if key not in {"page", "limit", "sort", "search", "startDate", "endDate"}
        and value not in {"", None}
    }

    for key, value in filters.items():
        attr_name = model_attr_name(model, key)
        if attr_name:
            column = getattr(model, attr_name)
            query = query.filter(column == value)

    search = query_args.get("search")
    if search and search_fields:
        clauses = [
            getattr(model, field).ilike(f"%{search}%")
            for field in search_fields
            if hasattr(model, field)
        ]
        if clauses:
            query = query.filter(or_(*clauses))

    if hasattr(model, "date"):
        start_date = query_args.get("startDate")
        end_date = query_args.get("endDate")
        if start_date:
            query = query.filter(model.date >= start_date)
        if end_date:
            query = query.filter(model.date <= f"{end_date} 23:59:59")

    total = query.count()
    sort = query_args.get("sort", "-createdAt")
    sort_desc = sort.startswith("-")
    sort_name = sort[1:] if sort_desc else sort
    sort_name = model_attr_name(model, sort_name) or sort_name
    if hasattr(model, sort_name):
        column = getattr(model, sort_name)
        query = query.order_by(desc(column) if sort_desc else asc(column))

    has_pagination = "page" in query_args and "limit" in query_args
    page = int(query_args.get("page", 1) or 1)
    limit = int(query_args.get("limit", 10) or 10)
    if has_pagination:
        query = query.offset((page - 1) * limit).limit(limit)

    response = {"data": [model_to_dict(row) for row in query.all()]}
    if has_pagination:
        response["pagination"] = {
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit,
        }
    return response
