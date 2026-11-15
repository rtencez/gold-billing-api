CREATE TABLE public.backup_jobs (
    id bigint NOT NULL,
    tenant_id bigint,
    db_name character varying(63) NOT NULL,
    status character varying(24) NOT NULL,
    file_path text,
    error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamp with time zone
);

CREATE TABLE public.platform_audit (
    id bigint NOT NULL,
    actor_id bigint,
    action character varying(100) NOT NULL,
    tenant_id bigint,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.platform_sessions (
    id uuid NOT NULL,
    user_id bigint NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.platform_users (
    id bigint NOT NULL,
    email character varying(254) NOT NULL,
    name character varying(160) NOT NULL,
    password_hash text NOT NULL,
    kind character varying(24) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public.tenants (
    id bigint NOT NULL,
    name character varying(180) NOT NULL,
    slug character varying(80) NOT NULL,
    db_name character varying(63) NOT NULL,
    status character varying(24) DEFAULT 'provisioning'::character varying NOT NULL,
    owner_user_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.backup_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.tenants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.backup_jobs_id_seq OWNED BY public.backup_jobs.id;

ALTER SEQUENCE public.platform_audit_id_seq OWNED BY public.platform_audit.id;

ALTER SEQUENCE public.platform_users_id_seq OWNED BY public.platform_users.id;

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;

ALTER TABLE ONLY public.backup_jobs ALTER COLUMN id SET DEFAULT nextval('public.backup_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.platform_audit ALTER COLUMN id SET DEFAULT nextval('public.platform_audit_id_seq'::regclass);

ALTER TABLE ONLY public.platform_users ALTER COLUMN id SET DEFAULT nextval('public.platform_users_id_seq'::regclass);

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);

ALTER TABLE ONLY public.backup_jobs
    ADD CONSTRAINT backup_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_audit
    ADD CONSTRAINT platform_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_sessions
    ADD CONSTRAINT platform_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_sessions
    ADD CONSTRAINT platform_sessions_token_hash_unique UNIQUE (token_hash);

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_email_unique UNIQUE (email);

ALTER TABLE ONLY public.platform_users
    ADD CONSTRAINT platform_users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_db_name_unique UNIQUE (db_name);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_unique UNIQUE (slug);

ALTER TABLE ONLY public.platform_sessions
    ADD CONSTRAINT platform_sessions_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.platform_users(id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_owner_user_id_foreign FOREIGN KEY (owner_user_id) REFERENCES public.platform_users(id);
