CREATE TABLE public.account_groups (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    name character varying(255),
    type character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    organization_id bigint,
    actor_id bigint,
    action character varying(120) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.branches (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    code character varying(24) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.chart_of_accounts (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    code character varying(255),
    name character varying(255),
    type character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.custom_orders (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    customer_name character varying(255),
    description character varying(255),
    status character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.customers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    name character varying(255),
    mobile character varying(255),
    email character varying(255),
    address character varying(255),
    gstin character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.expenses (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    description character varying(255),
    category character varying(255),
    amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.gold_rates (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    metal character varying(255),
    purity character varying(255),
    rate_per_gram numeric(18,2) NOT NULL,
    effective_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.journal_entries (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    description character varying(255),
    source_type character varying(255),
    source_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.journal_lines (
    id bigint NOT NULL,
    entry_id bigint NOT NULL,
    account_code character varying(40) NOT NULL,
    debit numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    credit numeric(18,2) DEFAULT '0'::numeric NOT NULL
);

CREATE TABLE public.karigars (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    name character varying(255),
    mobile character varying(255),
    address character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.old_gold_purchases (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    customer_name character varying(255),
    metal character varying(255),
    purity character varying(255),
    amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name character varying(180) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.permissions (
    key character varying(120) NOT NULL,
    description character varying(200)
);

CREATE TABLE public.product_categories (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    name character varying(255),
    description character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.products (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    sku character varying(255),
    name character varying(255),
    category character varying(255),
    metal character varying(255),
    purity character varying(255),
    huid character varying(255),
    gross_weight numeric(18,4) DEFAULT '0'::numeric NOT NULL,
    net_weight numeric(18,4) DEFAULT '0'::numeric NOT NULL,
    cost_price numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    selling_price numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.purchase_invoices (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    supplier_name character varying(255),
    reference character varying(255),
    amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.repair_tickets (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    customer_name character varying(255),
    description character varying(255),
    status character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.role_permissions (
    role_id bigint NOT NULL,
    permission_key character varying(120) NOT NULL
);

CREATE TABLE public.roles (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(80) NOT NULL,
    is_system boolean DEFAULT false NOT NULL
);

CREATE TABLE public.sales_invoice_items (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    product_id bigint NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    line_total numeric(18,2) NOT NULL
);

CREATE TABLE public.sales_invoices (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint NOT NULL,
    customer_id bigint,
    invoice_number character varying(60) NOT NULL,
    subtotal numeric(18,2) NOT NULL,
    tax numeric(18,2) NOT NULL,
    total numeric(18,2) NOT NULL,
    paid numeric(18,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    user_id bigint NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    product_id bigint NOT NULL,
    quantity_delta integer NOT NULL,
    source_type character varying(40) NOT NULL,
    source_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.suppliers (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    branch_id bigint,
    name character varying(255),
    mobile character varying(255),
    email character varying(255),
    address character varying(255),
    gstin character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.user_branch_access (
    user_id bigint NOT NULL,
    branch_id bigint NOT NULL
);

CREATE TABLE public.user_roles (
    user_id bigint NOT NULL,
    role_id bigint NOT NULL
);

CREATE TABLE public.users (
    id bigint NOT NULL,
    organization_id bigint NOT NULL,
    name character varying(160) NOT NULL,
    email character varying(254) NOT NULL,
    password_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL
);

CREATE SEQUENCE public.account_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.branches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.chart_of_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.custom_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.gold_rates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.journal_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.journal_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.karigars_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.old_gold_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.product_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.purchase_invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.repair_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sales_invoice_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sales_invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.suppliers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.account_groups_id_seq OWNED BY public.account_groups.id;

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;

ALTER SEQUENCE public.chart_of_accounts_id_seq OWNED BY public.chart_of_accounts.id;

ALTER SEQUENCE public.custom_orders_id_seq OWNED BY public.custom_orders.id;

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;

ALTER SEQUENCE public.gold_rates_id_seq OWNED BY public.gold_rates.id;

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;

ALTER SEQUENCE public.journal_lines_id_seq OWNED BY public.journal_lines.id;

ALTER SEQUENCE public.karigars_id_seq OWNED BY public.karigars.id;

ALTER SEQUENCE public.old_gold_purchases_id_seq OWNED BY public.old_gold_purchases.id;

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;

ALTER SEQUENCE public.product_categories_id_seq OWNED BY public.product_categories.id;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

ALTER SEQUENCE public.purchase_invoices_id_seq OWNED BY public.purchase_invoices.id;

ALTER SEQUENCE public.repair_tickets_id_seq OWNED BY public.repair_tickets.id;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

ALTER SEQUENCE public.sales_invoice_items_id_seq OWNED BY public.sales_invoice_items.id;

ALTER SEQUENCE public.sales_invoices_id_seq OWNED BY public.sales_invoices.id;

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER TABLE ONLY public.account_groups ALTER COLUMN id SET DEFAULT nextval('public.account_groups_id_seq'::regclass);

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);

ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq'::regclass);

ALTER TABLE ONLY public.custom_orders ALTER COLUMN id SET DEFAULT nextval('public.custom_orders_id_seq'::regclass);

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);

ALTER TABLE ONLY public.gold_rates ALTER COLUMN id SET DEFAULT nextval('public.gold_rates_id_seq'::regclass);

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);

ALTER TABLE ONLY public.journal_lines ALTER COLUMN id SET DEFAULT nextval('public.journal_lines_id_seq'::regclass);

ALTER TABLE ONLY public.karigars ALTER COLUMN id SET DEFAULT nextval('public.karigars_id_seq'::regclass);

ALTER TABLE ONLY public.old_gold_purchases ALTER COLUMN id SET DEFAULT nextval('public.old_gold_purchases_id_seq'::regclass);

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);

ALTER TABLE ONLY public.product_categories ALTER COLUMN id SET DEFAULT nextval('public.product_categories_id_seq'::regclass);

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

ALTER TABLE ONLY public.purchase_invoices ALTER COLUMN id SET DEFAULT nextval('public.purchase_invoices_id_seq'::regclass);

ALTER TABLE ONLY public.repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.repair_tickets_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.sales_invoice_items ALTER COLUMN id SET DEFAULT nextval('public.sales_invoice_items_id_seq'::regclass);

ALTER TABLE ONLY public.sales_invoices ALTER COLUMN id SET DEFAULT nextval('public.sales_invoices_id_seq'::regclass);

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.account_groups
    ADD CONSTRAINT account_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_organization_id_code_unique UNIQUE (organization_id, code);

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_orders
    ADD CONSTRAINT custom_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gold_rates
    ADD CONSTRAINT gold_rates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.karigars
    ADD CONSTRAINT karigars_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.old_gold_purchases
    ADD CONSTRAINT old_gold_purchases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_sku_unique UNIQUE (organization_id, sku);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_key);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_name_unique UNIQUE (organization_id, name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_organization_id_branch_id_invoice_number_unique UNIQUE (organization_id, branch_id, invoice_number);

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_pkey PRIMARY KEY (user_id, branch_id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_email_unique UNIQUE (organization_id, email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.account_groups
    ADD CONSTRAINT account_groups_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.account_groups
    ADD CONSTRAINT account_groups_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_foreign FOREIGN KEY (actor_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.custom_orders
    ADD CONSTRAINT custom_orders_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.custom_orders
    ADD CONSTRAINT custom_orders_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.gold_rates
    ADD CONSTRAINT gold_rates_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.gold_rates
    ADD CONSTRAINT gold_rates_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_entry_id_foreign FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id);

ALTER TABLE ONLY public.karigars
    ADD CONSTRAINT karigars_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.karigars
    ADD CONSTRAINT karigars_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.old_gold_purchases
    ADD CONSTRAINT old_gold_purchases_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.old_gold_purchases
    ADD CONSTRAINT old_gold_purchases_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_key_foreign FOREIGN KEY (permission_key) REFERENCES public.permissions(key);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id);

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_id_foreign FOREIGN KEY (customer_id) REFERENCES public.customers(id);

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_branch_id_foreign FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

CREATE INDEX account_groups_organization_id_branch_id_index ON public.account_groups USING btree (organization_id, branch_id);

CREATE INDEX chart_of_accounts_organization_id_branch_id_index ON public.chart_of_accounts USING btree (organization_id, branch_id);

CREATE INDEX custom_orders_organization_id_branch_id_index ON public.custom_orders USING btree (organization_id, branch_id);

CREATE INDEX customers_organization_id_branch_id_index ON public.customers USING btree (organization_id, branch_id);

CREATE INDEX expenses_organization_id_branch_id_index ON public.expenses USING btree (organization_id, branch_id);

CREATE INDEX gold_rates_organization_id_branch_id_index ON public.gold_rates USING btree (organization_id, branch_id);

CREATE INDEX karigars_organization_id_branch_id_index ON public.karigars USING btree (organization_id, branch_id);

CREATE INDEX old_gold_purchases_organization_id_branch_id_index ON public.old_gold_purchases USING btree (organization_id, branch_id);

CREATE INDEX product_categories_organization_id_branch_id_index ON public.product_categories USING btree (organization_id, branch_id);

CREATE INDEX products_organization_id_branch_id_index ON public.products USING btree (organization_id, branch_id);

CREATE INDEX purchase_invoices_organization_id_branch_id_index ON public.purchase_invoices USING btree (organization_id, branch_id);

CREATE INDEX repair_tickets_organization_id_branch_id_index ON public.repair_tickets USING btree (organization_id, branch_id);

CREATE INDEX sessions_token_hash_index ON public.sessions USING btree (token_hash);

CREATE INDEX sessions_user_id_expires_at_index ON public.sessions USING btree (user_id, expires_at);

CREATE INDEX suppliers_organization_id_branch_id_index ON public.suppliers USING btree (organization_id, branch_id);
