from .extensions import db
from .utils import hash_password, now_utc


class TimestampMixin:
    createdAt = db.Column("created_at", db.DateTime, default=now_utc, nullable=False)
    updatedAt = db.Column("updated_at", db.DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    @property
    def created_at(self):
        return self.createdAt

    @created_at.setter
    def created_at(self, value):
        self.createdAt = value

    @property
    def updated_at(self):
        return self.updatedAt

    @updated_at.setter
    def updated_at(self, value):
        self.updatedAt = value


class MongoIdMixin:
    mongoId = db.Column("mongo_id", db.String(24), unique=True)

    @property
    def mongo_id(self):
        return self.mongoId

    @mongo_id.setter
    def mongo_id(self, value):
        self.mongoId = value


class User(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    @staticmethod
    def hash_password(password):
        return hash_password(password)


class Volunteer(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "volunteers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    expenses = db.relationship("Expense", back_populates="volunteer", lazy="dynamic")
    fund_transactions = db.relationship("FundTransaction", back_populates="volunteer", lazy="dynamic")

    @staticmethod
    def hash_password(password):
        return hash_password(password)


class House(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "houses"

    id = db.Column(db.Integer, primary_key=True)
    houseNumber = db.Column("house_number", db.String(100), unique=True, nullable=False)
    ownerName = db.Column("owner_name", db.String(255))
    phone = db.Column(db.String(50))

    fund_transactions = db.relationship("FundTransaction", back_populates="house", lazy="dynamic")

    @property
    def house_number(self):
        return self.houseNumber

    @house_number.setter
    def house_number(self, value):
        self.houseNumber = value

    @property
    def owner_name(self):
        return self.ownerName

    @owner_name.setter
    def owner_name(self, value):
        self.ownerName = value


class Festival(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "festivals"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    date = db.Column("festival_date", db.Date)
    year = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text)

    expenses = db.relationship("Expense", back_populates="festival", lazy="dynamic")
    estimates = db.relationship("Estimate", back_populates="festival", lazy="dynamic")

    @property
    def festival_date(self):
        return self.date

    @festival_date.setter
    def festival_date(self, value):
        self.date = value


class Estimate(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "estimates"

    id = db.Column(db.Integer, primary_key=True)
    festivalId = db.Column("festival_id", db.Integer, db.ForeignKey("festivals.id"), nullable=False)
    festivalYear = db.Column("festival_year", db.Integer, nullable=False)
    category = db.Column(db.String(255))
    description = db.Column(db.Text)
    estimatedAmount = db.Column("estimated_amount", db.Numeric(12, 2), nullable=False)

    festival = db.relationship("Festival", back_populates="estimates")

    @property
    def festival_id(self):
        return self.festivalId

    @festival_id.setter
    def festival_id(self, value):
        self.festivalId = value

    @property
    def festival_year(self):
        return self.festivalYear

    @festival_year.setter
    def festival_year(self, value):
        self.festivalYear = value

    @property
    def estimated_amount(self):
        return self.estimatedAmount

    @estimated_amount.setter
    def estimated_amount(self, value):
        self.estimatedAmount = value


class Expense(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    festivalId = db.Column("festival_id", db.Integer, db.ForeignKey("festivals.id"), nullable=False)
    volunteerId = db.Column("volunteer_id", db.Integer, db.ForeignKey("volunteers.id"))
    category = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    paymentMethod = db.Column("payment_method", db.String(20))
    description = db.Column(db.Text)
    note = db.Column(db.Text)
    date = db.Column("expense_date", db.DateTime, default=now_utc)
    isSettled = db.Column("is_settled", db.Boolean, default=False, nullable=False)
    settledOn = db.Column("settled_on", db.DateTime)
    festivalYear = db.Column("festival_year", db.Integer, nullable=False)

    festival = db.relationship("Festival", back_populates="expenses")
    volunteer = db.relationship("Volunteer", back_populates="expenses")

    @property
    def festival_id(self):
        return self.festivalId

    @festival_id.setter
    def festival_id(self, value):
        self.festivalId = value

    @property
    def volunteer_id(self):
        return self.volunteerId

    @volunteer_id.setter
    def volunteer_id(self, value):
        self.volunteerId = value

    @property
    def payment_method(self):
        return self.paymentMethod

    @payment_method.setter
    def payment_method(self, value):
        self.paymentMethod = value

    @property
    def expense_date(self):
        return self.date

    @expense_date.setter
    def expense_date(self, value):
        self.date = value

    @property
    def is_settled(self):
        return self.isSettled

    @is_settled.setter
    def is_settled(self, value):
        self.isSettled = value

    @property
    def settled_on(self):
        return self.settledOn

    @settled_on.setter
    def settled_on(self, value):
        self.settledOn = value

    @property
    def festival_year(self):
        return self.festivalYear

    @festival_year.setter
    def festival_year(self, value):
        self.festivalYear = value


class FundTransaction(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "fund_transactions"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)
    houseId = db.Column("house_id", db.Integer, db.ForeignKey("houses.id"))
    volunteerId = db.Column("volunteer_id", db.Integer, db.ForeignKey("volunteers.id"))
    name = db.Column(db.String(255))
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    paymentMethod = db.Column("payment_method", db.String(20))
    reference = db.Column("reference_no", db.String(255))
    date = db.Column("transaction_date", db.DateTime, default=now_utc)
    festivalYear = db.Column("festival_year", db.Integer, nullable=False)
    alternativePhone = db.Column("alternative_phone", db.String(50))

    house = db.relationship("House", back_populates="fund_transactions")
    volunteer = db.relationship("Volunteer", back_populates="fund_transactions")

    @property
    def house_id(self):
        return self.houseId

    @house_id.setter
    def house_id(self, value):
        self.houseId = value

    @property
    def volunteer_id(self):
        return self.volunteerId

    @volunteer_id.setter
    def volunteer_id(self, value):
        self.volunteerId = value

    @property
    def payment_method(self):
        return self.paymentMethod

    @payment_method.setter
    def payment_method(self, value):
        self.paymentMethod = value

    @property
    def reference_no(self):
        return self.reference

    @reference_no.setter
    def reference_no(self, value):
        self.reference = value

    @property
    def transaction_date(self):
        return self.date

    @transaction_date.setter
    def transaction_date(self, value):
        self.date = value

    @property
    def festival_year(self):
        return self.festivalYear

    @festival_year.setter
    def festival_year(self, value):
        self.festivalYear = value

    @property
    def alternative_phone(self):
        return self.alternativePhone

    @alternative_phone.setter
    def alternative_phone(self, value):
        self.alternativePhone = value


class Inventory(db.Model, TimestampMixin):
    __tablename__ = "inventory"

    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    count = db.Column(db.Integer, nullable=False)
    place = db.Column(db.String(150), nullable=False)
    note = db.Column(db.Text)


class InventoryItem(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "inventory_items"

    id = db.Column(db.Integer, primary_key=True)
    item = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    itemCount = db.Column("item_count", db.Integer, nullable=False)
    place = db.Column(db.String(255), nullable=False)
    note = db.Column(db.Text)

    @property
    def item_count(self):
        return self.itemCount

    @item_count.setter
    def item_count(self, value):
        self.itemCount = value


class Todo(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "todos"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    isDone = db.Column("is_done", db.Boolean, default=False, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    createdByMongoId = db.Column("created_by_mongo_id", db.String(24))

    @property
    def is_done(self):
        return self.isDone

    @is_done.setter
    def is_done(self, value):
        self.isDone = value

    @property
    def created_by_mongo_id(self):
        return self.createdByMongoId

    @created_by_mongo_id.setter
    def created_by_mongo_id(self, value):
        self.createdByMongoId = value


class ShortLink(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "short_links"

    id = db.Column(db.Integer, primary_key=True)
    shortCode = db.Column("short_code", db.String(255), unique=True, nullable=False)
    targetUrl = db.Column("target_url", db.Text, nullable=False)

    @property
    def short_code(self):
        return self.shortCode

    @short_code.setter
    def short_code(self, value):
        self.shortCode = value

    @property
    def target_url(self):
        return self.targetUrl

    @target_url.setter
    def target_url(self, value):
        self.targetUrl = value
