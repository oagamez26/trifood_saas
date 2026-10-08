# ADR-001: Multi-tenancy con base compartida y aislamiento por tenant

- Estado: Aceptado
- Fecha: 2025-10-05

## Contexto

El sistema actual de POTOQUITOS está diseñado para una operación única y no posee un concepto explícito de tenant. La necesidad del negocio es operar múltiples clientes/restaurantes bajo una misma plataforma, conservando el sistema como un monolito modular que hoy funciona para Potoquitos.

## Decisión

Implementar una estrategia inicial de multi-tenancy con:

- base de datos compartida
- esquema compartido
- `tenant_id` en todas las entidades de negocio relevantes
- identidad y permisos por usuario + tenant
- resolución del tenant exclusivamente desde la capa de seguridad/backend

## Justificación

- Minimiza cambios de infraestructura y despliegue.
- Permite reciclar gran parte de la lógica y del modelo de negocio.
- Mantiene el monolito actual operativo durante la transición.
- Facilita una evolución posterior hacia aislamiento más fuerte si la escala lo exige.

## Consecuencias

### Positivas

- Bajo costo inicial de migración.
- Menor complejidad operativa inicial.
- Alineación con el diseño actual del monolito.
- Licitud para expandir a varios clientes sin cambiar toda la estructura del sistema.

### Negativas

- Requiere control estricto de consultas y esquemas.
- El riesgo de fuga de datos aumenta si no se centraliza la validación del tenant.
- Cada tabla operativa debe ser diseñada con disciplina para mantener el aislamiento.

## Reglas de cumplimiento

- No se acepta `tenant_id` desde el cliente.
- Todo acceso debe ser evaluado con el contexto de la sesión autenticada.
- El primer tenant será Potoquitos, sin excepciones de negocio.
- Las pruebas de aislamiento por tenant forman parte del criterio de aceptación.

## Alternativas consideradas

1. Multi-tenancy por base de datos separada por tenant:
   - Aislamiento fuerte, pero más costoso y menos práctico para un primer paso.
2. Multi-tenancy por esquema separado:
   - Tiene ventajas, pero introduce mayor complejidad de despliegue y gestión.
3. No migrar y mantener sistema mono-tenant:
   - No cumple el objetivo de SaaS.

## Resultado

Se acepta el enfoque shared database / shared schema con `tenant_id` como punto de partida seguro y incremental para la transformación del sistema a SaaS multi-tenant.
