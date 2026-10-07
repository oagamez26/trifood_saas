const fs = require("fs");
const path = require("path");

const dump = fs.readFileSync(path.join(__dirname, "..", "..", "schema.sql"), "utf16le");
const statements = dump
    .replace(/^--.*$/gm, "")
    .split(/;\r?\n/)
    .map(statement => statement.trim())
    .filter(Boolean)
    .map(statement => `${statement};`);

const scoped = new Set([
    "audit_events", "cash_registers", "cash_sessions", "catalog_audit_events",
    "catalog_categories", "catalog_product_images", "catalog_product_price_history",
    "catalog_products", "dining_tables", "expense_categories", "expenses",
    "ingredients", "inventory_movements", "invoice_lines", "invoices",
    "kardex_entries", "order_cancellations", "order_lines", "orders",
    "payment_details", "payments", "recipe_items", "recipes",
    "restaurant_settings", "role_permissions", "roles", "table_sessions", "user_roles"
]);

const tableDefinitions = statements.filter(statement =>
    /^CREATE TABLE public\./.test(statement)
    && !/^CREATE TABLE public\.alembic_version/.test(statement)
);
if (tableDefinitions.length !== 30) {
    throw new Error(`Expected 30 application tables, found ${tableDefinitions.length}`);
}

const constraints = statements
    .map(statement => {
        const match = statement.match(
            /^ALTER TABLE ONLY public\.([a-z_]+)\s+ADD CONSTRAINT ([a-z_]+) ([\s\S]*);$/
        );
        return match
            ? { table: match[1], name: match[2], body: match[3].replace(/\s+/g, " ").trim() }
            : null;
    })
    .filter(constraint => constraint && constraint.table !== "alembic_version");

const tenantForeignKeys = [];
const tenantUniqueConstraints = new Set([
    "cash_registers_name_key",
    "dining_tables_number_key",
    "expense_categories_name_key",
    "roles_name_key",
    "recipes_product_id_key",
    "uq_price_history_version"
]);
const bridgePrimaryKeys = new Set(["role_permissions_pkey", "user_roles_pkey"]);

const preservedConstraints = constraints.filter(constraint => {
    if (!constraint.body.startsWith("FOREIGN KEY")) {
        return true;
    }
    const match = constraint.body.match(
        /^FOREIGN KEY \(([^)]+)\) REFERENCES public\.([a-z_]+)\(([^)]+)\)(.*)$/
    );
    if (!match) {
        throw new Error(`Unparsed FK ${constraint.name}: ${constraint.body}`);
    }
    const [, columns, target, targetColumns, action] = match;
    if (!scoped.has(constraint.table)) {
        return true;
    }
    if (target === "users") {
        tenantForeignKeys.push({
            ...constraint, columns, target: "tenant_memberships",
            targetColumns: "user_id", action
        });
        return false;
    }
    if (scoped.has(target)) {
        tenantForeignKeys.push({
            ...constraint, columns, target, targetColumns, action
        });
        return false;
    }
    return true;
});

const output = [
    "-- Tenant-scoped business schema rebuilt from the PostgreSQL 16 schema-only baseline.",
    "-- No development rows are copied. Alembic metadata and the legacy database are excluded.",
    ""
];

for (const source of tableDefinitions) {
    const name = source.match(/^CREATE TABLE public\.([a-z_]+)/)[1];
    let definition = source;
    if (scoped.has(name)) {
        if (/\bid integer NOT NULL,/.test(definition)) {
            definition = definition.replace(
                /\bid integer NOT NULL,/,
                "id integer NOT NULL,\n    tenant_id uuid NOT NULL,"
            );
        } else {
            definition = definition.replace(
                /^(CREATE TABLE public\.[a-z_]+ \()\r?\n/,
                "$1\n    tenant_id uuid NOT NULL,\n"
            );
        }
    }
    output.push(definition);
}

output.push(`CREATE TABLE public.tenant_memberships (
    tenant_id uuid NOT NULL,
    user_id integer NOT NULL,
    status character varying(24) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tenant_memberships_pkey PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT tenant_memberships_status_check CHECK ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'REVOKED'::character varying])::text[])),
    CONSTRAINT tenant_memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
    CONSTRAINT tenant_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);`);

for (const statement of statements.filter(statement =>
    /^CREATE SEQUENCE public\./.test(statement)
    && !/^CREATE SEQUENCE public\.alembic_version/.test(statement)
)) {
    output.push(statement);
}
for (const statement of statements.filter(statement =>
    /^ALTER TABLE ONLY public\.[a-z_]+ ALTER COLUMN [a-z_]+ SET DEFAULT /.test(statement)
    && !/^ALTER TABLE ONLY public\.alembic_version/.test(statement)
)) {
    output.push(statement);
}
for (const statement of statements.filter(statement =>
    /^ALTER SEQUENCE public\./.test(statement)
    && !/^ALTER SEQUENCE public\.alembic_version/.test(statement)
)) {
    output.push(statement);
}

for (const constraint of preservedConstraints) {
    let body = constraint.body;
    if (bridgePrimaryKeys.has(constraint.name)) {
        body = body.replace(/^PRIMARY KEY \(([^)]+)\)/, "PRIMARY KEY (tenant_id, $1)");
    }
    if (tenantUniqueConstraints.has(constraint.name)) {
        body = body.replace(/^UNIQUE \(([^)]+)\)/, "UNIQUE (tenant_id, $1)");
    }
    output.push(
        `ALTER TABLE ONLY public.${constraint.table}\n    ADD CONSTRAINT ${constraint.name} ${body};`
    );
}

for (const table of scoped) {
    if (table !== "role_permissions" && table !== "user_roles") {
        output.push(
            `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT uq_${table}_tenant_id_id UNIQUE (tenant_id, id);`
        );
    }
    output.push(
        `ALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT fk_${table}_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);`
    );
}

for (const foreignKey of tenantForeignKeys) {
    const columns = foreignKey.columns.split(",").map(column => column.trim());
    const referenceColumns = foreignKey.targetColumns.split(",").map(column => column.trim());
    let action = foreignKey.action || "";
    if (/ON DELETE SET NULL$/i.test(action) && columns.includes("order_line_id")) {
        action = "ON DELETE SET NULL (order_line_id)";
    }
    output.push(
        `ALTER TABLE ONLY public.${foreignKey.table}\n`
        + `    ADD CONSTRAINT ${foreignKey.name} FOREIGN KEY (tenant_id, ${columns.join(", ")}) `
        + `REFERENCES public.${foreignKey.target}(tenant_id, ${referenceColumns.join(", ")})`
        + `${action ? ` ${action}` : ""};`
    );
}

for (const statement of statements.filter(statement =>
    /^CREATE (?:UNIQUE )?INDEX /.test(statement)
)) {
    let index = statement;
    const match = index.match(/ ON public\.([a-z_]+) USING /);
    if (match && scoped.has(match[1])) {
        index = index.replace(" USING btree (", " USING btree (tenant_id, ");
    }
    output.push(index);
}

const indexNames = new Set();
for (const foreignKey of tenantForeignKeys) {
    for (const column of foreignKey.columns.split(",").map(value => value.trim())) {
        const name = `ix_${foreignKey.table}_tenant_${column}`;
        if (name.length > 63) {
            throw new Error(`Index name exceeds PostgreSQL limit: ${name}`);
        }
        if (!indexNames.has(name)) {
            indexNames.add(name);
            output.push(
                `CREATE INDEX ${name} ON public.${foreignKey.table} USING btree (tenant_id, ${column});`
            );
        }
    }
}

const destination = path.join(
    __dirname,
    "src",
    "main",
    "resources",
    "db",
    "migration",
    "V2__create_tenant_scoped_business_schema.sql"
);
fs.writeFileSync(destination, `${output.join("\n\n")}\n`, "utf8");
console.log(
    `Generated ${destination}: ${tableDefinitions.length} tables, `
    + `${constraints.length} constraints, ${tenantForeignKeys.length} tenant-aware FKs.`
);
