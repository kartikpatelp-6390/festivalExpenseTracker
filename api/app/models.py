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
    dinner_registrations = db.relationship("DinnerRegistration", back_populates="volunteer", lazy="dynamic")
    dinner_collection_handovers = db.relationship("DinnerCollectionHandover", back_populates="volunteer", lazy="dynamic")

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
    dinner_registrations = db.relationship("DinnerRegistration", back_populates="house", lazy="dynamic")

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
    dinner_events = db.relationship("DinnerEvent", back_populates="festival", lazy="dynamic")

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
    dinner_settlements = db.relationship("DinnerSettlement", back_populates="expense", lazy="dynamic")

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


class DinnerCaterer(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_caterers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    contactPerson = db.Column("contact_person", db.String(255), nullable=False)
    primaryMobile = db.Column("primary_mobile", db.String(50), nullable=False)
    alternateMobile = db.Column("alternate_mobile", db.String(50))
    email = db.Column(db.String(255))
    address = db.Column(db.Text)
    notes = db.Column(db.Text)

    events = db.relationship("DinnerEvent", back_populates="caterer", lazy="dynamic")


class DinnerEvent(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_events"

    id = db.Column(db.Integer, primary_key=True)
    festivalId = db.Column("festival_id", db.Integer, db.ForeignKey("festivals.id"), nullable=False)
    catererId = db.Column("caterer_id", db.Integer, db.ForeignKey("dinner_caterers.id"))
    name = db.Column(db.String(255), nullable=False)
    eventDate = db.Column("event_date", db.Date, nullable=False)
    eventTime = db.Column("event_time", db.String(20))
    venue = db.Column(db.String(255))
    dinnerType = db.Column("dinner_type", db.String(100))
    notes = db.Column(db.Text)
    status = db.Column(db.String(40), default="Draft", nullable=False)
    catererPricingType = db.Column("caterer_pricing_type", db.String(20), default="per_plate", nullable=False)
    catererRatePerPlate = db.Column("caterer_rate_per_plate", db.Numeric(12, 2), default=0, nullable=False)
    expectedPlates = db.Column("expected_plates", db.Integer, default=0, nullable=False)
    fixedContractAmount = db.Column("fixed_contract_amount", db.Numeric(12, 2), default=0, nullable=False)
    advancePaid = db.Column("advance_paid", db.Numeric(12, 2), default=0, nullable=False)
    collectionStartDate = db.Column("collection_start_date", db.Date)
    collectionDeadline = db.Column("collection_deadline", db.Date)
    couponDeadline = db.Column("coupon_deadline", db.Date)
    showCouponNote = db.Column("show_coupon_note", db.Boolean, default=True, nullable=False)
    couponImportantNote = db.Column("coupon_important_note", db.Text)
    finalPlateSubmissionAt = db.Column("final_plate_submission_at", db.DateTime)
    contributionType = db.Column("contribution_type", db.String(30), default="payee_full", nullable=False)
    memberContributionRate = db.Column("member_contribution_rate", db.Numeric(12, 2), default=0, nullable=False)
    payeePercent = db.Column("payee_percent", db.Numeric(5, 2), default=100, nullable=False)
    mandalPercent = db.Column("mandal_percent", db.Numeric(5, 2), default=0, nullable=False)
    finalPlateCount = db.Column("final_plate_count", db.Integer)
    plateSharedAt = db.Column("plate_shared_at", db.DateTime)
    catererConfirmedAt = db.Column("caterer_confirmed_at", db.DateTime)
    confirmedBy = db.Column("confirmed_by", db.String(255))
    closedAt = db.Column("closed_at", db.DateTime)

    festival = db.relationship("Festival", back_populates="dinner_events")
    caterer = db.relationship("DinnerCaterer", back_populates="events")
    registrations = db.relationship("DinnerRegistration", back_populates="event", lazy="dynamic", cascade="all, delete-orphan")
    settlement = db.relationship("DinnerSettlement", back_populates="event", uselist=False, cascade="all, delete-orphan")
    collection_handovers = db.relationship("DinnerCollectionHandover", back_populates="event", lazy="dynamic", cascade="all, delete-orphan")


class DinnerRegistration(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_registrations"
    __table_args__ = (db.UniqueConstraint("event_id", "house_id", name="uq_dinner_registration_event_house"),)

    id = db.Column(db.Integer, primary_key=True)
    eventId = db.Column("event_id", db.Integer, db.ForeignKey("dinner_events.id"), nullable=False)
    houseId = db.Column("house_id", db.Integer, db.ForeignKey("houses.id"), nullable=False)
    volunteerId = db.Column("volunteer_id", db.Integer, db.ForeignKey("volunteers.id"))
    existingMemberCount = db.Column("existing_member_count", db.Integer, default=0, nullable=False)
    adults = db.Column(db.Integer, default=0, nullable=False)
    childrenBelow7 = db.Column("children_below_7", db.Integer, default=0, nullable=False)
    contributionType = db.Column("contribution_type", db.String(30), nullable=False)
    memberContributionRate = db.Column("member_contribution_rate", db.Numeric(12, 2), default=0, nullable=False)
    payeePercent = db.Column("payee_percent", db.Numeric(5, 2), default=100, nullable=False)
    mandalPercent = db.Column("mandal_percent", db.Numeric(5, 2), default=0, nullable=False)
    payeeAmount = db.Column("payee_amount", db.Numeric(12, 2), default=0, nullable=False)
    mandalAmount = db.Column("mandal_amount", db.Numeric(12, 2), default=0, nullable=False)
    amountReceived = db.Column("amount_received", db.Numeric(12, 2), default=0, nullable=False)
    paymentMethod = db.Column("payment_method", db.String(30))
    transactionReference = db.Column("transaction_reference", db.String(255))
    paymentStatus = db.Column("payment_status", db.String(30), default="Pending", nullable=False)
    notes = db.Column(db.Text)

    event = db.relationship("DinnerEvent", back_populates="registrations")
    house = db.relationship("House", back_populates="dinner_registrations")
    volunteer = db.relationship("Volunteer", back_populates="dinner_registrations")
    coupon = db.relationship("DinnerCoupon", back_populates="registration", uselist=False, cascade="all, delete-orphan")
    checkins = db.relationship("DinnerCheckIn", back_populates="registration", lazy="dynamic", cascade="all, delete-orphan")


class DinnerCoupon(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_coupons"

    id = db.Column(db.Integer, primary_key=True)
    eventId = db.Column("event_id", db.Integer, db.ForeignKey("dinner_events.id"), nullable=False)
    registrationId = db.Column("registration_id", db.Integer, db.ForeignKey("dinner_registrations.id"), unique=True, nullable=False)
    token = db.Column(db.String(512), unique=True, nullable=False)
    status = db.Column(db.String(30), default="Generated", nullable=False)
    deliveryStatus = db.Column("delivery_status", db.String(30), default="Not Sent", nullable=False)
    deliveryChannel = db.Column("delivery_channel", db.String(30))
    sentTo = db.Column("sent_to", db.String(255))
    sentAt = db.Column("sent_at", db.DateTime)

    registration = db.relationship("DinnerRegistration", back_populates="coupon")


class DinnerCollectionHandover(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_collection_handovers"
    __table_args__ = (db.UniqueConstraint("event_id", "volunteer_id", name="uq_dinner_collection_event_volunteer"),)

    id = db.Column(db.Integer, primary_key=True)
    eventId = db.Column("event_id", db.Integer, db.ForeignKey("dinner_events.id"), nullable=False)
    volunteerId = db.Column("volunteer_id", db.Integer, db.ForeignKey("volunteers.id"), nullable=False)
    status = db.Column(db.String(30), default="Pending", nullable=False)
    collectedAt = db.Column("collected_at", db.DateTime)
    collectedBy = db.Column("collected_by", db.String(255))
    notes = db.Column(db.Text)

    event = db.relationship("DinnerEvent", back_populates="collection_handovers")
    volunteer = db.relationship("Volunteer", back_populates="dinner_collection_handovers")


class DinnerCheckIn(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_checkins"

    id = db.Column(db.Integer, primary_key=True)
    eventId = db.Column("event_id", db.Integer, db.ForeignKey("dinner_events.id"), nullable=False)
    registrationId = db.Column("registration_id", db.Integer, db.ForeignKey("dinner_registrations.id"), nullable=False)
    houseId = db.Column("house_id", db.Integer, db.ForeignKey("houses.id"), nullable=False)
    adultsEntered = db.Column("adults_entered", db.Integer, default=0, nullable=False)
    childrenEntered = db.Column("children_entered", db.Integer, default=0, nullable=False)
    platesConsumed = db.Column("plates_consumed", db.Integer, default=0, nullable=False)
    entryMethod = db.Column("entry_method", db.String(30), nullable=False)
    gateName = db.Column("gate_name", db.String(100))
    volunteerName = db.Column("volunteer_name", db.String(255))
    restrictedAttempt = db.Column("restricted_attempt", db.Boolean, default=False, nullable=False)
    overrideReason = db.Column("override_reason", db.Text)

    registration = db.relationship("DinnerRegistration", back_populates="checkins")


class DinnerSettlement(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_settlements"

    id = db.Column(db.Integer, primary_key=True)
    eventId = db.Column("event_id", db.Integer, db.ForeignKey("dinner_events.id"), unique=True, nullable=False)
    finalPlateCount = db.Column("final_plate_count", db.Integer, default=0, nullable=False)
    baseAmount = db.Column("base_amount", db.Numeric(12, 2), default=0, nullable=False)
    grossAmount = db.Column("gross_amount", db.Numeric(12, 2), default=0, nullable=False)
    advancePaid = db.Column("advance_paid", db.Numeric(12, 2), default=0, nullable=False)
    finalPayable = db.Column("final_payable", db.Numeric(12, 2), default=0, nullable=False)
    status = db.Column(db.String(30), default="Pending", nullable=False)
    paymentDate = db.Column("payment_date", db.Date)
    paymentMethod = db.Column("payment_method", db.String(30))
    referenceNumber = db.Column("reference_number", db.String(255))
    notes = db.Column(db.Text)
    expenseId = db.Column("expense_id", db.Integer, db.ForeignKey("expenses.id"))
    fundTransactionId = db.Column("fund_transaction_id", db.Integer, db.ForeignKey("fund_transactions.id"))

    event = db.relationship("DinnerEvent", back_populates="settlement")
    expense = db.relationship("Expense", back_populates="dinner_settlements")
    fund_transaction = db.relationship("FundTransaction")
    adjustments = db.relationship("DinnerSettlementAdjustment", back_populates="settlement", lazy="dynamic", cascade="all, delete-orphan")


class DinnerSettlementAdjustment(db.Model, MongoIdMixin, TimestampMixin):
    __tablename__ = "dinner_settlement_adjustments"

    id = db.Column(db.Integer, primary_key=True)
    settlementId = db.Column("settlement_id", db.Integer, db.ForeignKey("dinner_settlements.id"), nullable=False)
    adjustmentType = db.Column("adjustment_type", db.String(100), nullable=False)
    description = db.Column(db.Text)
    amount = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    direction = db.Column(db.String(20), default="increase", nullable=False)

    settlement = db.relationship("DinnerSettlement", back_populates="adjustments")
