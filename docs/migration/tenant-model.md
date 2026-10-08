# Modelo de tenant y aislamiento de datos

## Objetivo

Definir una estructura de multi-tenancy que permita operar la misma base funcional para múltiples restaurantes o clientes, manteniendo el sistema de Potoquitos como el primer tenant operativo.

## Modelo recomendado

Se propone un modelo inicial de tipo:

- Shared database
- Shared schema
- Multi-tenancy por `tenant_id` en tablas del negocio

Esto minimiza el cambio de infraestructura y respeta el monolito actual, y permite evolucionar después hacia una estrategia más aislada si el crecimiento lo exige.

## Entidades clave

### Tenant

Tabla global de clientes/empresas.

Campos sugeridos:
- `id`
- `slug`
- `name`
- `status`
- `created_at`
- `updated_at`
- `owner_user_id`
- `settings_json`

### User

Los usuarios deben pertenecer a un tenant y tener una relación de pertenencia explícita.

Campos sugeridos:
- `user_id`
- `tenant_id`
- `role_id`
- `email`
- `username`
- `status`

### Role / Permission

Los roles pueden mantenerse dentro del tenant o ser globales con permisos por tenant.

Recomendación:
- `role` y `permission` como catalogo base compartido
- `user_role` o `tenant_role_assignment` ligado a tenant y usuario

---

## Reglas de aislamiento

### 1. Toda entidad operativa debe incluir `tenant_id`

Deben incluir `tenant_id`:
- productos
- categorías
- mesas
- sesiones de mesa
- órdenes
- factura y pagos
- caja
- inventario y kardex
- gastos
- reportes y auditoría operativa

### 2. La capa de seguridad debe resolver el tenant

El backend debe obtener el tenant desde:
- el JWT
- la sesión autenticada
- la relación usuario -> tenant

Nunca desde el cliente.

### 3. Las consultas deben filtrar por tenant

Ejemplo conceptual:

```sql
SELECT *
FROM products
WHERE tenant_id = :tenant_id;
```

Esto debe aplicarse en repositorios y servicios, no solo en la capa HTTP.

### 4. Auditoría de tenant

Todos los eventos de auditoría deben registrar:
- `tenant_id`
- `user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`

### 5. Restricción de acceso cruzado

Si un usuario intenta acceder a recursos de otro tenant, la operación debe devolver:
- `403 Forbidden`
- o `404` para ocultar la existencia del recurso en un tenant ajeno

---

## Tipos de datos por alcance

### Globales

Elementos compartidos entre todos los tenants y sin datos específicos del cliente:
- configuración de plataforma
- catálogo de roles base
- permisos base
- metadatos de la aplicación
- definiciones globales de auditoría técnica

### Tenant-scoped

Elementos concretos de operación de cada cliente:
- dinero
- inventario
- comensales
- mesas
- catálogo de productos
- empleados y accesos
- turnos de caja
- reportes

---

## Evolución recomendada del modelo de datos

### Fase 1: compatibilidad segura

- crear tabla `tenants`
- agregar `tenant_id` a tablas críticas
- migrar el tenant actual `Potoquitos` como primer registro
- migrar el usuario principal y el conjunto de datos asociado al tenant inicial

### Fase 2: seguridad por defecto

- implementar middleware o interceptor que resuelva el contexto del tenant
- forzar `tenant_id` explícito en transacciones y repositorios
- bloquear consultas sin tenant

### Fase 3: aislamiento funcional

- separar configuraciones por tenant
- usar un pipeline de permisos por tenant
- aislar desarrollos y despliegues por cliente si se requiere más escala

---

## Conclusión

El enfoque de tenant por `tenant_id` en un esquema compartido es el camino más seguro y menos disruptivo para este proyecto. Permite mantener el monolito actual, preservar la operación y preparar la arquitectura para la migración a una plataforma SaaS con múltiples clientes.
