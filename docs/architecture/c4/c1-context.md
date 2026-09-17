# C1 — Diagrama de Contexto del Sistema POTOQUITOS

El diagrama de contexto C1 define los límites del sistema **POTOQUITOS** y sus interacciones con los usuarios y actores del negocio en función de los roles y permisos reales (**RBAC**).

---

## 1. Actores del Sistema

| Actor | Rol en el Sistema | Responsabilidades e Interacción Principal |
| :--- | :--- | :--- |
| **Administrador** | `ADMINISTRADOR` | Configuración general, gestión de usuarios/roles, catálogo de productos y precios, supervisión de inventario y Kardex, balances de caja, reportes financieros y auditoría. |
| **Mesero** | `MESERO` | Visualización del salón de mesas, apertura de mesas con asignación de comensales, toma de pedidos en comanda, confirmación a cocina, consulta de prefactura, solicitud de cuenta y entrega de platos. |
| **Personal de Cocina** | `COCINA` | Visualización de la cola KDS en tiempo real, inicio de preparación (descuento automático de inventario) y marcado de pedidos listos para servicio. |
| **Cajero** | `CAJERO` | Apertura de turno con base en efectivo, recepción de cuentas solicitadas, cobros parciales/abonos o totales, registro de propinas voluntarias, emisión de facturas y arqueo/cierre de caja con informe PDF. |
| **Comensal / Cliente** | *Público (Sin credenciales)* | Consulta del catálogo digital de platos y bebidas mediante menú público QR (`/menu`), sin capacidad de alterar estado del restaurante. |

---

## 2. Diagrama C1 (Mermaid)

```mermaid
C4Context
    title Diagrama de Contexto del Sistema POTOQUITOS (C1)

    Person(admin, "Administrador", "Gestiona colaboradores, catálogo, inventario, costos, reportes gerenciales y configuración.")
    Person(mesero, "Mesero", "Atiende mesas, crea comandas, despacha pedidos a cocina, consulta prefactura y entrega platos.")
    Person(cocina, "Personal de Cocina", "Opera la pantalla KDS, inicia preparación con descuento de stock y notifica platos listos.")
    Person(cajero, "Cajero", "Abre caja, procesa abonos y pagos mixtos, emite facturas y ejecuta arqueo de cierre de turno.")
    Person(cliente, "Comensal / Cliente", "Visualiza el menú público y precios actualizados del restaurante mediante código QR.")

    System(potoquitos, "Sistema POTOQUITOS", "Solución integral de POS, KDS, inventario con Kardex, caja, facturación y reportes gerenciales para restaurante.")

    Rel(admin, potoquitos, "Administra usuarios, catálogo, costos, Kardex, auditoría y balances", "HTTPS / UI Web")
    Rel(mesero, potoquitos, "Abre mesas, registra pedidos, solicita cuenta y confirma entrega", "HTTPS / UI Web")
    Rel(cocina, potoquitos, "Gestiona cola KDS, inicia preparación y marca listos", "HTTPS / UI Web")
    Rel(cajero, potoquitos, "Abre/cierra caja, registra pagos/abonos e imprime facturas", "HTTPS / UI Web")
    Rel(cliente, potoquitos, "Consulta catálogo digital público", "HTTPS / Web Móvil")
```

---

## 3. Delimitación de Responsabilidades y Fronteras

- **Dentro de la frontera del sistema:**
  - Autenticación centralizada JWT y control RBAC.
  - Registro de órdenes, estados de comanda y auditoría de cambios.
  - Motor de inventario con recetario y Kardex inmutable.
  - Gestión de sesiones de mesa y sesiones de caja.
  - Facturación con emisión de tickets y comprobantes en PDF.
  - Exportación contable en hojas de cálculo Excel (`.xlsx`).
- **Fuera de la frontera del sistema:**
  - Pasarelas de pago externas con datáfono (el cajero registra la transacción usando el código de referencia en el medio `TARJETA` o `TRANSFERENCIA`).
  - DIAN / Facturación electrónica externa (el sistema emite documentos equivalentes y prefacturas internas).
