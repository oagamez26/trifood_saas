# Arquitectura multi-tenant propuesta

## Propósito

Documentar la transición de la arquitectura actual hacia un modelo SaaS multi-tenant, manteniendo la lógica de negocio, la seguridad y la operación actual del sistema.

## Estado de referencia

La arquitectura actual es un monolito modular bien estructurado, con dominio, servicios, routers y persistencia relacional. Eso permite introducir el concepto de tenant sin reescribir toda la capa de negocio desde cero.

## Modelo objetivo

- Tenant como entidad principal del negocio.
- Usuario vinculado a un tenant.
- Roles y permisos evaluados dentro del contexto del tenant.
- Entidades operativas con `tenant_id` obligatorio.
- Seguridad aplicada por backend, no por cliente.

## Diagrama conceptual

```text
+-----------------------+
|        Tenant         |
|  - id                 |
|  - name               |
|  - status             |
+----------+------------+
           |
           v
+-----------------------+
|     User / Session     |
|  - user_id            |
|  - tenant_id          |
|  - role / permissions |
+----------+------------+
           |
           v
+-----------------------+
|   Core Business       |
|  Orders, Inventory,   |
|  Cash, Catalog, etc.  |
|  tenant_id enforced    |
+-----------------------+
```

## Criterios de diseño

1. Cada consulta debe quedar acotada al tenant de la sesión autenticada.
2. La auditoría debe incluir el identificador del tenant.
3. El frontend solo recibe la información a la que el usuario tiene acceso.
4. Los datos globales deben compartirse solo cuando la operación lo permita.
5. Las reglas del negocio siguen siendo las mismas para cada tenant, con configuración específica del cliente como ajuste y no como excepción.

## Fase de implementación recomendada

1. Crear la entidad `Tenant` y las migraciones iniciales.
2. Asociar usuarios a tenants y a roles por tenant.
3. Agregar `tenant_id` a entidades críticas.
4. Resolver el tenant en el contexto HTTP / autenticación.
5. Reforzar los repositorios y servicios con filtros por tenant.
6. Validar la operación con pruebas de aislamiento.

## Conclusión

La arquitectura propuesta conserva la fortaleza del monolito actual y añade el tenant como eje central del diseño, sin invalidar la lógica operativa ni el comportamiento actual del sistema.
