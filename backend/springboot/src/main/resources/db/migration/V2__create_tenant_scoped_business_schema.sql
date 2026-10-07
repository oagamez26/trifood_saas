-- Tenant-scoped business schema rebuilt from the PostgreSQL 16 schema-only baseline.

-- No development rows are copied. Alembic metadata and the legacy database are excluded.



CREATE TABLE public.audit_events (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    actor_user_id integer,
    target_user_id integer,
    action character varying(120) NOT NULL,
    details json,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.cash_registers (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.cash_sessions (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    cash_register_id integer NOT NULL,
    cashier_id integer NOT NULL,
    state character varying(20) NOT NULL,
    initial_cash numeric(12,2) NOT NULL,
    expected_cash numeric(12,2),
    reported_cash numeric(12,2),
    difference numeric(12,2),
    closure_status character varying(20),
    notes text,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    sales_amount numeric(12,2),
    tips_amount numeric(12,2),
    total_collected numeric(12,2),
    cash_collected numeric(12,2),
    card_collected numeric(12,2),
    transfer_collected numeric(12,2),
    cash_expenses numeric(12,2),
    CONSTRAINT ck_cash_initial_nonnegative CHECK ((initial_cash >= (0)::numeric))
);

CREATE TABLE public.catalog_audit_events (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    actor_user_id integer NOT NULL,
    entity_type character varying(40) NOT NULL,
    entity_id integer NOT NULL,
    action character varying(80) NOT NULL,
    details json,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.catalog_categories (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.catalog_product_images (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    product_id integer NOT NULL,
    file_reference character varying(500) NOT NULL,
    is_current boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    replaced_at timestamp with time zone,
    uploaded_by integer
);

CREATE TABLE public.catalog_product_price_history (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    product_id integer NOT NULL,
    previous_price numeric(12,2),
    new_price numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'COP'::character varying NOT NULL,
    price_version integer NOT NULL,
    changed_by integer NOT NULL,
    changed_at timestamp with time zone NOT NULL
);

CREATE TABLE public.catalog_products (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    internal_code character varying(80) NOT NULL,
    name character varying(160) NOT NULL,
    description text NOT NULL,
    current_price numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'COP'::character varying NOT NULL,
    price_version integer DEFAULT 1 NOT NULL,
    category_id integer NOT NULL,
    recommended_people integer,
    is_active boolean NOT NULL,
    is_available boolean NOT NULL,
    current_image_id integer,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_product_currency CHECK (((currency)::text = 'COP'::text)),
    CONSTRAINT ck_product_people CHECK (((recommended_people IS NULL) OR (recommended_people > 0))),
    CONSTRAINT ck_product_price_nonnegative CHECK ((current_price >= (0)::numeric)),
    CONSTRAINT ck_product_price_version CHECK ((price_version > 0))
);

CREATE TABLE public.dining_tables (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    number character varying(30) NOT NULL,
    capacity integer DEFAULT 4 NOT NULL,
    is_active boolean NOT NULL,
    state character varying(30) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(255)
);

CREATE TABLE public.expenses (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    category_id integer NOT NULL,
    concept character varying(200) NOT NULL,
    amount numeric(12,2) NOT NULL,
    expense_date date NOT NULL,
    responsible_user_id integer NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_expense_amount_positive CHECK ((amount > (0)::numeric))
);

CREATE TABLE public.ingredients (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    base_unit character varying(20) NOT NULL,
    stock numeric(12,4) NOT NULL,
    min_stock numeric(12,4) NOT NULL,
    reference_cost numeric(12,2) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_ingredient_cost_nonnegative CHECK ((reference_cost >= (0)::numeric)),
    CONSTRAINT ck_ingredient_min_stock_nonnegative CHECK ((min_stock >= (0)::numeric)),
    CONSTRAINT ck_ingredient_stock_nonnegative CHECK ((stock >= (0)::numeric))
);

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    ingredient_id integer NOT NULL,
    movement_type character varying(30) NOT NULL,
    quantity numeric(12,4) NOT NULL,
    previous_stock numeric(12,4) NOT NULL,
    new_stock numeric(12,4) NOT NULL,
    reference character varying(120),
    responsible_user_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.invoice_lines (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id integer NOT NULL,
    order_line_id integer,
    product_id integer NOT NULL,
    product_name character varying(160) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);

CREATE TABLE public.invoices (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_number character varying(40) NOT NULL,
    payment_id integer NOT NULL,
    table_session_id integer NOT NULL,
    cashier_id integer NOT NULL,
    waiter_id integer,
    table_number character varying(30) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tip numeric(12,2) NOT NULL,
    tax numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    payment_method_summary character varying(120) NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.kardex_entries (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    ingredient_id integer NOT NULL,
    movement_type character varying(30) NOT NULL,
    entry_quantity numeric(12,4) NOT NULL,
    exit_quantity numeric(12,4) NOT NULL,
    previous_balance numeric(12,4) NOT NULL,
    new_balance numeric(12,4) NOT NULL,
    reference character varying(120),
    responsible_user_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.order_cancellations (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    order_id integer NOT NULL,
    reason text NOT NULL,
    cancelled_by integer NOT NULL,
    cancelled_at timestamp with time zone NOT NULL
);

CREATE TABLE public.order_lines (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name character varying(160) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    quantity integer NOT NULL,
    notes text
);

CREATE TABLE public.orders (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    table_session_id integer NOT NULL,
    waiter_id integer NOT NULL,
    state character varying(30) NOT NULL,
    account_requested boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    confirmed_at timestamp with time zone,
    delivered_at timestamp with time zone,
    closed_at timestamp with time zone,
    inventory_deducted boolean DEFAULT false NOT NULL,
    notes text,
    in_kitchen_at timestamp with time zone,
    ready_at timestamp with time zone
);

CREATE TABLE public.payment_details (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    payment_id integer NOT NULL,
    payment_method character varying(30) NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference_code character varying(100)
);

CREATE TABLE public.payments (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    table_session_id integer NOT NULL,
    cash_session_id integer NOT NULL,
    cashier_id integer NOT NULL,
    consumption_amount numeric(12,2) NOT NULL,
    tip_amount numeric(12,2) NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    cash_received numeric(12,2),
    cash_change numeric(12,2),
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_payment_total_nonnegative CHECK ((total_amount >= (0)::numeric))
);

CREATE TABLE public.permissions (
    id integer NOT NULL,
    codename character varying(120) NOT NULL,
    description character varying(255),
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.recipe_items (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    recipe_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    quantity numeric(12,4) NOT NULL,
    unit character varying(20) NOT NULL
);

CREATE TABLE public.recipes (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    product_id integer NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.restaurant_settings (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    key character varying(80) NOT NULL,
    value text NOT NULL,
    description character varying(255),
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.role_permissions (
    tenant_id uuid NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.roles (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.table_sessions (
    id integer NOT NULL,
    tenant_id uuid NOT NULL,
    table_id integer NOT NULL,
    waiter_id integer NOT NULL,
    people_count integer NOT NULL,
    state character varying(30) NOT NULL,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone
);

CREATE TABLE public.user_roles (
    tenant_id uuid NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(80) NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_active boolean NOT NULL,
    must_change_password boolean NOT NULL,
    token_version integer NOT NULL,
    reset_token_hash character varying(128),
    reset_token_expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.tenant_memberships (
    tenant_id uuid NOT NULL,
    user_id integer NOT NULL,
    status character varying(24) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tenant_memberships_pkey PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT tenant_memberships_status_check CHECK ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'REVOKED'::character varying])::text[]))
);

CREATE SEQUENCE public.audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.cash_registers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.cash_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.catalog_audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.catalog_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.catalog_product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.catalog_product_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.catalog_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dining_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.invoice_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.kardex_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.order_cancellations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.order_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.payment_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.recipe_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.restaurant_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.table_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.audit_events ALTER COLUMN id SET DEFAULT nextval('public.audit_events_id_seq'::regclass);

ALTER TABLE ONLY public.cash_registers ALTER COLUMN id SET DEFAULT nextval('public.cash_registers_id_seq'::regclass);

ALTER TABLE ONLY public.cash_sessions ALTER COLUMN id SET DEFAULT nextval('public.cash_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.catalog_audit_events ALTER COLUMN id SET DEFAULT nextval('public.catalog_audit_events_id_seq'::regclass);

ALTER TABLE ONLY public.catalog_categories ALTER COLUMN id SET DEFAULT nextval('public.catalog_categories_id_seq'::regclass);

ALTER TABLE ONLY public.catalog_product_images ALTER COLUMN id SET DEFAULT nextval('public.catalog_product_images_id_seq'::regclass);

ALTER TABLE ONLY public.catalog_product_price_history ALTER COLUMN id SET DEFAULT nextval('public.catalog_product_price_history_id_seq'::regclass);

ALTER TABLE ONLY public.catalog_products ALTER COLUMN id SET DEFAULT nextval('public.catalog_products_id_seq'::regclass);

ALTER TABLE ONLY public.dining_tables ALTER COLUMN id SET DEFAULT nextval('public.dining_tables_id_seq'::regclass);

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);

ALTER TABLE ONLY public.ingredients ALTER COLUMN id SET DEFAULT nextval('public.ingredients_id_seq'::regclass);

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);

ALTER TABLE ONLY public.invoice_lines ALTER COLUMN id SET DEFAULT nextval('public.invoice_lines_id_seq'::regclass);

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);

ALTER TABLE ONLY public.kardex_entries ALTER COLUMN id SET DEFAULT nextval('public.kardex_entries_id_seq'::regclass);

ALTER TABLE ONLY public.order_cancellations ALTER COLUMN id SET DEFAULT nextval('public.order_cancellations_id_seq'::regclass);

ALTER TABLE ONLY public.order_lines ALTER COLUMN id SET DEFAULT nextval('public.order_lines_id_seq'::regclass);

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

ALTER TABLE ONLY public.payment_details ALTER COLUMN id SET DEFAULT nextval('public.payment_details_id_seq'::regclass);

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);

ALTER TABLE ONLY public.recipe_items ALTER COLUMN id SET DEFAULT nextval('public.recipe_items_id_seq'::regclass);

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);

ALTER TABLE ONLY public.restaurant_settings ALTER COLUMN id SET DEFAULT nextval('public.restaurant_settings_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.table_sessions ALTER COLUMN id SET DEFAULT nextval('public.table_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER SEQUENCE public.audit_events_id_seq OWNED BY public.audit_events.id;

ALTER SEQUENCE public.cash_registers_id_seq OWNED BY public.cash_registers.id;

ALTER SEQUENCE public.cash_sessions_id_seq OWNED BY public.cash_sessions.id;

ALTER SEQUENCE public.catalog_audit_events_id_seq OWNED BY public.catalog_audit_events.id;

ALTER SEQUENCE public.catalog_categories_id_seq OWNED BY public.catalog_categories.id;

ALTER SEQUENCE public.catalog_product_images_id_seq OWNED BY public.catalog_product_images.id;

ALTER SEQUENCE public.catalog_product_price_history_id_seq OWNED BY public.catalog_product_price_history.id;

ALTER SEQUENCE public.catalog_products_id_seq OWNED BY public.catalog_products.id;

ALTER SEQUENCE public.dining_tables_id_seq OWNED BY public.dining_tables.id;

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;

ALTER SEQUENCE public.ingredients_id_seq OWNED BY public.ingredients.id;

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;

ALTER SEQUENCE public.invoice_lines_id_seq OWNED BY public.invoice_lines.id;

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;

ALTER SEQUENCE public.kardex_entries_id_seq OWNED BY public.kardex_entries.id;

ALTER SEQUENCE public.order_cancellations_id_seq OWNED BY public.order_cancellations.id;

ALTER SEQUENCE public.order_lines_id_seq OWNED BY public.order_lines.id;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

ALTER SEQUENCE public.payment_details_id_seq OWNED BY public.payment_details.id;

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;

ALTER SEQUENCE public.recipe_items_id_seq OWNED BY public.recipe_items.id;

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;

ALTER SEQUENCE public.restaurant_settings_id_seq OWNED BY public.restaurant_settings.id;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

ALTER SEQUENCE public.table_sessions_id_seq OWNED BY public.table_sessions.id;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_name_key UNIQUE (tenant_id, name);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_audit_events
    ADD CONSTRAINT catalog_audit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_product_images
    ADD CONSTRAINT catalog_product_images_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT catalog_product_price_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_products
    ADD CONSTRAINT catalog_products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_number_key UNIQUE (tenant_id, number);

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_name_key UNIQUE (tenant_id, name);

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_id_key UNIQUE (payment_id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kardex_entries
    ADD CONSTRAINT kardex_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_order_id_key UNIQUE (order_id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_details
    ADD CONSTRAINT payment_details_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_key UNIQUE (tenant_id, product_id);

ALTER TABLE ONLY public.restaurant_settings
    ADD CONSTRAINT restaurant_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (tenant_id, role_id, permission_id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (tenant_id, name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT uq_price_history_version UNIQUE (tenant_id, product_id, price_version);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (tenant_id, user_id, role_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT uq_audit_events_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT uq_cash_registers_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT fk_cash_registers_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT uq_cash_sessions_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT fk_cash_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.catalog_audit_events
    ADD CONSTRAINT uq_catalog_audit_events_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.catalog_audit_events
    ADD CONSTRAINT fk_catalog_audit_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT uq_catalog_categories_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT fk_catalog_categories_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.catalog_product_images
    ADD CONSTRAINT uq_catalog_product_images_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.catalog_product_images
    ADD CONSTRAINT fk_catalog_product_images_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT uq_catalog_product_price_history_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT fk_catalog_product_price_history_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.catalog_products
    ADD CONSTRAINT uq_catalog_products_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.catalog_products
    ADD CONSTRAINT fk_catalog_products_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT uq_dining_tables_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT fk_dining_tables_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT uq_expense_categories_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT fk_expense_categories_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT uq_expenses_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT uq_ingredients_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT fk_ingredients_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT uq_inventory_movements_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movements_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT uq_invoice_lines_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT fk_invoice_lines_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT uq_invoices_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.kardex_entries
    ADD CONSTRAINT uq_kardex_entries_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.kardex_entries
    ADD CONSTRAINT fk_kardex_entries_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT uq_order_cancellations_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT fk_order_cancellations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT uq_order_lines_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT fk_order_lines_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT uq_orders_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.payment_details
    ADD CONSTRAINT uq_payment_details_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.payment_details
    ADD CONSTRAINT fk_payment_details_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT uq_payments_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT uq_recipe_items_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT fk_recipe_items_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT uq_recipes_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT fk_recipes_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.restaurant_settings
    ADD CONSTRAINT uq_restaurant_settings_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.restaurant_settings
    ADD CONSTRAINT fk_restaurant_settings_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT uq_roles_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT uq_table_sessions_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT fk_table_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_user_id_fkey FOREIGN KEY (tenant_id, actor_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_target_user_id_fkey FOREIGN KEY (tenant_id, target_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_cash_register_id_fkey FOREIGN KEY (tenant_id, cash_register_id) REFERENCES public.cash_registers(tenant_id, id);

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_cashier_id_fkey FOREIGN KEY (tenant_id, cashier_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.catalog_audit_events
    ADD CONSTRAINT catalog_audit_events_actor_user_id_fkey FOREIGN KEY (tenant_id, actor_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.catalog_product_images
    ADD CONSTRAINT catalog_product_images_product_id_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES public.catalog_products(tenant_id, id);

ALTER TABLE ONLY public.catalog_product_images
    ADD CONSTRAINT catalog_product_images_uploaded_by_fkey FOREIGN KEY (tenant_id, uploaded_by) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT catalog_product_price_history_changed_by_fkey FOREIGN KEY (tenant_id, changed_by) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.catalog_product_price_history
    ADD CONSTRAINT catalog_product_price_history_product_id_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES public.catalog_products(tenant_id, id);

ALTER TABLE ONLY public.catalog_products
    ADD CONSTRAINT catalog_products_category_id_fkey FOREIGN KEY (tenant_id, category_id) REFERENCES public.catalog_categories(tenant_id, id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (tenant_id, category_id) REFERENCES public.expense_categories(tenant_id, id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_responsible_user_id_fkey FOREIGN KEY (tenant_id, responsible_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.catalog_products
    ADD CONSTRAINT fk_product_current_image FOREIGN KEY (tenant_id, current_image_id) REFERENCES public.catalog_product_images(tenant_id, id);

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_ingredient_id_fkey FOREIGN KEY (tenant_id, ingredient_id) REFERENCES public.ingredients(tenant_id, id);

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_responsible_user_id_fkey FOREIGN KEY (tenant_id, responsible_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (tenant_id, invoice_id) REFERENCES public.invoices(tenant_id, id)  ON DELETE CASCADE;

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_order_line_id_fkey FOREIGN KEY (tenant_id, order_line_id) REFERENCES public.order_lines(tenant_id, id) ON DELETE SET NULL (order_line_id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_cashier_id_fkey FOREIGN KEY (tenant_id, cashier_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_id_fkey FOREIGN KEY (tenant_id, payment_id) REFERENCES public.payments(tenant_id, id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_table_session_id_fkey FOREIGN KEY (tenant_id, table_session_id) REFERENCES public.table_sessions(tenant_id, id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_waiter_id_fkey FOREIGN KEY (tenant_id, waiter_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.kardex_entries
    ADD CONSTRAINT kardex_entries_ingredient_id_fkey FOREIGN KEY (tenant_id, ingredient_id) REFERENCES public.ingredients(tenant_id, id);

ALTER TABLE ONLY public.kardex_entries
    ADD CONSTRAINT kardex_entries_responsible_user_id_fkey FOREIGN KEY (tenant_id, responsible_user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_cancelled_by_fkey FOREIGN KEY (tenant_id, cancelled_by) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_order_id_fkey FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders(tenant_id, id);

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_order_id_fkey FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders(tenant_id, id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_session_id_fkey FOREIGN KEY (tenant_id, table_session_id) REFERENCES public.table_sessions(tenant_id, id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_waiter_id_fkey FOREIGN KEY (tenant_id, waiter_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.payment_details
    ADD CONSTRAINT payment_details_payment_id_fkey FOREIGN KEY (tenant_id, payment_id) REFERENCES public.payments(tenant_id, id)  ON DELETE CASCADE;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cash_session_id_fkey FOREIGN KEY (tenant_id, cash_session_id) REFERENCES public.cash_sessions(tenant_id, id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cashier_id_fkey FOREIGN KEY (tenant_id, cashier_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_table_session_id_fkey FOREIGN KEY (tenant_id, table_session_id) REFERENCES public.table_sessions(tenant_id, id);

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_ingredient_id_fkey FOREIGN KEY (tenant_id, ingredient_id) REFERENCES public.ingredients(tenant_id, id);

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_recipe_id_fkey FOREIGN KEY (tenant_id, recipe_id) REFERENCES public.recipes(tenant_id, id)  ON DELETE CASCADE;

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (tenant_id, product_id) REFERENCES public.catalog_products(tenant_id, id)  ON DELETE CASCADE;

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles(tenant_id, id);

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_table_id_fkey FOREIGN KEY (tenant_id, table_id) REFERENCES public.dining_tables(tenant_id, id);

ALTER TABLE ONLY public.table_sessions
    ADD CONSTRAINT table_sessions_waiter_id_fkey FOREIGN KEY (tenant_id, waiter_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (tenant_id, role_id) REFERENCES public.roles(tenant_id, id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.tenant_memberships(tenant_id, user_id);

CREATE INDEX ix_cash_sessions_cash_register_id ON public.cash_sessions USING btree (tenant_id, cash_register_id);

CREATE UNIQUE INDEX ix_catalog_categories_name ON public.catalog_categories USING btree (tenant_id, name);

CREATE INDEX ix_catalog_product_images_product_id ON public.catalog_product_images USING btree (tenant_id, product_id);

CREATE INDEX ix_catalog_product_price_history_product_id ON public.catalog_product_price_history USING btree (tenant_id, product_id);

CREATE INDEX ix_catalog_products_category_id ON public.catalog_products USING btree (tenant_id, category_id);

CREATE UNIQUE INDEX ix_catalog_products_internal_code ON public.catalog_products USING btree (tenant_id, internal_code);

CREATE INDEX ix_catalog_products_is_active ON public.catalog_products USING btree (tenant_id, is_active);

CREATE INDEX ix_catalog_products_is_available ON public.catalog_products USING btree (tenant_id, is_available);

CREATE INDEX ix_catalog_products_name ON public.catalog_products USING btree (tenant_id, name);

CREATE INDEX ix_expenses_category_id ON public.expenses USING btree (tenant_id, category_id);

CREATE UNIQUE INDEX ix_ingredients_name ON public.ingredients USING btree (tenant_id, name);

CREATE INDEX ix_inventory_movements_ingredient_id ON public.inventory_movements USING btree (tenant_id, ingredient_id);

CREATE UNIQUE INDEX ix_invoices_invoice_number ON public.invoices USING btree (tenant_id, invoice_number);

CREATE INDEX ix_kardex_entries_ingredient_id ON public.kardex_entries USING btree (tenant_id, ingredient_id);

CREATE INDEX ix_orders_state ON public.orders USING btree (tenant_id, state);

CREATE INDEX ix_orders_table_session_id ON public.orders USING btree (tenant_id, table_session_id);

CREATE INDEX ix_payments_cash_session_id ON public.payments USING btree (tenant_id, cash_session_id);

CREATE INDEX ix_payments_table_session_id ON public.payments USING btree (tenant_id, table_session_id);

CREATE UNIQUE INDEX ix_permissions_codename ON public.permissions USING btree (codename);

CREATE UNIQUE INDEX ix_restaurant_settings_key ON public.restaurant_settings USING btree (tenant_id, key);

CREATE INDEX ix_table_sessions_table_id ON public.table_sessions USING btree (tenant_id, table_id);

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);

CREATE UNIQUE INDEX uq_category_normalized_name ON public.catalog_categories USING btree (tenant_id, lower(TRIM(BOTH FROM name)));

CREATE UNIQUE INDEX uq_current_product_image ON public.catalog_product_images USING btree (tenant_id, product_id) WHERE (is_current IS TRUE);

CREATE UNIQUE INDEX uq_history_product_version ON public.catalog_product_price_history USING btree (tenant_id, product_id, price_version);

CREATE UNIQUE INDEX uq_ingredient_normalized_name ON public.ingredients USING btree (tenant_id, lower(TRIM(BOTH FROM name)));

CREATE UNIQUE INDEX uq_open_cash_session ON public.cash_sessions USING btree (tenant_id, cash_register_id) WHERE ((state)::text = 'OPEN'::text);

CREATE UNIQUE INDEX uq_open_table_session ON public.table_sessions USING btree (tenant_id, table_id) WHERE ((state)::text = 'OPEN'::text);

CREATE UNIQUE INDEX uq_product_normalized_code ON public.catalog_products USING btree (tenant_id, upper(TRIM(BOTH FROM internal_code)));

CREATE INDEX ix_audit_events_tenant_actor_user_id ON public.audit_events USING btree (tenant_id, actor_user_id);

CREATE INDEX ix_audit_events_tenant_target_user_id ON public.audit_events USING btree (tenant_id, target_user_id);

CREATE INDEX ix_cash_sessions_tenant_cash_register_id ON public.cash_sessions USING btree (tenant_id, cash_register_id);

CREATE INDEX ix_cash_sessions_tenant_cashier_id ON public.cash_sessions USING btree (tenant_id, cashier_id);

CREATE INDEX ix_catalog_audit_events_tenant_actor_user_id ON public.catalog_audit_events USING btree (tenant_id, actor_user_id);

CREATE INDEX ix_catalog_product_images_tenant_product_id ON public.catalog_product_images USING btree (tenant_id, product_id);

CREATE INDEX ix_catalog_product_images_tenant_uploaded_by ON public.catalog_product_images USING btree (tenant_id, uploaded_by);

CREATE INDEX ix_catalog_product_price_history_tenant_changed_by ON public.catalog_product_price_history USING btree (tenant_id, changed_by);

CREATE INDEX ix_catalog_product_price_history_tenant_product_id ON public.catalog_product_price_history USING btree (tenant_id, product_id);

CREATE INDEX ix_catalog_products_tenant_category_id ON public.catalog_products USING btree (tenant_id, category_id);

CREATE INDEX ix_expenses_tenant_category_id ON public.expenses USING btree (tenant_id, category_id);

CREATE INDEX ix_expenses_tenant_responsible_user_id ON public.expenses USING btree (tenant_id, responsible_user_id);

CREATE INDEX ix_catalog_products_tenant_current_image_id ON public.catalog_products USING btree (tenant_id, current_image_id);

CREATE INDEX ix_inventory_movements_tenant_ingredient_id ON public.inventory_movements USING btree (tenant_id, ingredient_id);

CREATE INDEX ix_inventory_movements_tenant_responsible_user_id ON public.inventory_movements USING btree (tenant_id, responsible_user_id);

CREATE INDEX ix_invoice_lines_tenant_invoice_id ON public.invoice_lines USING btree (tenant_id, invoice_id);

CREATE INDEX ix_invoice_lines_tenant_order_line_id ON public.invoice_lines USING btree (tenant_id, order_line_id);

CREATE INDEX ix_invoices_tenant_cashier_id ON public.invoices USING btree (tenant_id, cashier_id);

CREATE INDEX ix_invoices_tenant_payment_id ON public.invoices USING btree (tenant_id, payment_id);

CREATE INDEX ix_invoices_tenant_table_session_id ON public.invoices USING btree (tenant_id, table_session_id);

CREATE INDEX ix_invoices_tenant_waiter_id ON public.invoices USING btree (tenant_id, waiter_id);

CREATE INDEX ix_kardex_entries_tenant_ingredient_id ON public.kardex_entries USING btree (tenant_id, ingredient_id);

CREATE INDEX ix_kardex_entries_tenant_responsible_user_id ON public.kardex_entries USING btree (tenant_id, responsible_user_id);

CREATE INDEX ix_order_cancellations_tenant_cancelled_by ON public.order_cancellations USING btree (tenant_id, cancelled_by);

CREATE INDEX ix_order_cancellations_tenant_order_id ON public.order_cancellations USING btree (tenant_id, order_id);

CREATE INDEX ix_order_lines_tenant_order_id ON public.order_lines USING btree (tenant_id, order_id);

CREATE INDEX ix_orders_tenant_table_session_id ON public.orders USING btree (tenant_id, table_session_id);

CREATE INDEX ix_orders_tenant_waiter_id ON public.orders USING btree (tenant_id, waiter_id);

CREATE INDEX ix_payment_details_tenant_payment_id ON public.payment_details USING btree (tenant_id, payment_id);

CREATE INDEX ix_payments_tenant_cash_session_id ON public.payments USING btree (tenant_id, cash_session_id);

CREATE INDEX ix_payments_tenant_cashier_id ON public.payments USING btree (tenant_id, cashier_id);

CREATE INDEX ix_payments_tenant_table_session_id ON public.payments USING btree (tenant_id, table_session_id);

CREATE INDEX ix_recipe_items_tenant_ingredient_id ON public.recipe_items USING btree (tenant_id, ingredient_id);

CREATE INDEX ix_recipe_items_tenant_recipe_id ON public.recipe_items USING btree (tenant_id, recipe_id);

CREATE INDEX ix_recipes_tenant_product_id ON public.recipes USING btree (tenant_id, product_id);

CREATE INDEX ix_role_permissions_tenant_role_id ON public.role_permissions USING btree (tenant_id, role_id);

CREATE INDEX ix_table_sessions_tenant_table_id ON public.table_sessions USING btree (tenant_id, table_id);

CREATE INDEX ix_table_sessions_tenant_waiter_id ON public.table_sessions USING btree (tenant_id, waiter_id);

CREATE INDEX ix_user_roles_tenant_role_id ON public.user_roles USING btree (tenant_id, role_id);

CREATE INDEX ix_user_roles_tenant_user_id ON public.user_roles USING btree (tenant_id, user_id);
