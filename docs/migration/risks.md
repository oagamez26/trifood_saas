# Riesgos de la migración a SaaS multi-tenant

## Riesgos técnicos

### 1. Fuga de datos entre tenants

Si las consultas no filtran por `tenant_id`, un usuario podría ver registros de otro cliente.

Mitigación:
- validación centralizada en repositorios
- `tenant_id` obligatorio en contexto
- pruebas de aislamiento por tenant

### 2. Confianza incorrecta en el cliente

El frontend no debe influir en la selección de tenant ni de datos.

Mitigación:
- resolución del tenant desde token o sesión
- no aceptar `tenant_id` en payloads del cliente

### 3. Múltiples valores de tenant por usuario

Un usuario puede pertenecer a varios clientes o tener varios roles por tenant.

Mitigación:
- modelar `user_tenant_membership`
- evaluar permisos por usuario + tenant + rol

### 4. Cambios de esquema incompatibles

Cambios abruptos pueden romper la operación de restaurante.

Mitigación:
- migraciones versionadas
- validación de datos antes y después de la migración
- rollback planificado

## Riesgos operativos

### 1. Interrupción del servicio durante la transición

La operación del restaurante depende de disponibilidad diaria.

Mitigación:
- migraciones por lotes
- despliegue sin corte
- runbook y rollback

### 2. Inconsistencias financieras

Caja, pagos, facturas e inventario son puntos sensibles.

Mitigación:
- transacciones con aislamiento apropiado
- auditoría de inventario y movimientos
- validación de cierres de caja

## Riesgos de negocio

### 1. Cambio de modelo de negocio no aceptado por clientes

Los clientes actuales pueden depender del contexto monolítico actual.

Mitigación:
- mantener Potoquitos como primer tenant
- migrar sin cambiar comportamiento visible
- acompañar la transición con pruebas de operación

### 2. Complejidad de múltiples clientes con reglas distintas

Cada cliente puede requerir configuraciones, menús, roles y permisos específicos.

Mitigación:
- definiciones por tenant con defaults comunes
- configuración evolutiva
- etapa de personalización después del modelo base

## Riesgos de arquitectura

### 1. Migración a un stack nuevo sin base estable

Reescribir el sistema completo en Spring Boot 3 y Angular puede aumentar el riesgo si no se validan capas intermedias.

Mitigación:
- definir el modelo multi-tenant antes del backend nuevo
- mantener el diseño de negocio y la seguridad consistente
- hacer la nueva arquitectura complementaria a la actual

## Monitorización recomendada

- métricas de acceso por tenant
- alertas de errores de autorización
- auditoría de operaciones sensibles
- métricas de latencia y errores de base de datos
- trazas por tenant y sesión

## Conclusión

Los riesgos principales no son de infraestructura sino de aislamiento y continuidad operativa. Un diseño de tenant bien definido y una estrategia de migración incremental son los factores clave para minimizar esos riesgos.
