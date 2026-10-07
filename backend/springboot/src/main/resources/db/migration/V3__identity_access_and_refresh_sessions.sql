ALTER TABLE public.tenant_memberships
    ADD COLUMN display_first_name character varying(100),
    ADD COLUMN display_last_name character varying(100);

CREATE TABLE public.refresh_sessions (
    id uuid NOT NULL,
    family_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    issued_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_session_id uuid,
    CONSTRAINT refresh_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT refresh_sessions_token_hash_key UNIQUE (token_hash),
    CONSTRAINT uq_refresh_sessions_tenant_user_family_id
        UNIQUE (tenant_id, user_id, family_id, id),
    CONSTRAINT ck_refresh_sessions_period CHECK (expires_at > issued_at),
    CONSTRAINT fk_refresh_sessions_membership
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES public.tenant_memberships(tenant_id, user_id),
    CONSTRAINT fk_refresh_sessions_replacement
        FOREIGN KEY (tenant_id, user_id, family_id, replaced_by_session_id)
        REFERENCES public.refresh_sessions(tenant_id, user_id, family_id, id)
);

CREATE INDEX ix_refresh_sessions_family
    ON public.refresh_sessions (family_id, expires_at);

CREATE INDEX ix_refresh_sessions_membership
    ON public.refresh_sessions (tenant_id, user_id, expires_at);

INSERT INTO public.permissions (codename, description, created_at)
VALUES
    ('catalog.categories.read', 'Consultar categorías del catálogo del tenant', CURRENT_TIMESTAMP),
    ('users.read', 'Consultar usuarios del tenant', CURRENT_TIMESTAMP),
    ('users.create', 'Crear usuarios y memberships del tenant', CURRENT_TIMESTAMP),
    ('users.update', 'Actualizar perfiles y memberships del tenant', CURRENT_TIMESTAMP),
    ('users.memberships.manage', 'Administrar memberships del tenant', CURRENT_TIMESTAMP),
    ('users.roles.assign', 'Asignar y revocar roles a usuarios del tenant', CURRENT_TIMESTAMP),
    ('roles.read', 'Consultar roles y permisos disponibles', CURRENT_TIMESTAMP),
    ('roles.manage', 'Crear roles y administrar sus permisos', CURRENT_TIMESTAMP)
ON CONFLICT (codename) DO NOTHING;
