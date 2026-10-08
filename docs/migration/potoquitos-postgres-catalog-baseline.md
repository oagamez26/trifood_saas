# Línea base PostgreSQL y equivalencia funcional del catálogo Potoquitos

**Estado:** análisis de solo lectura; no es una autorización para modificar el POS ni para implementar el catálogo Trifood.

## Conclusión ejecutiva

La estructura física de referencia para el estado consultado es la exportación
schema-only hecha el 7 de octubre de 2026 directamente desde la base `potoquitos`
del contenedor `potoquitos_atg-db-1` (PostgreSQL 16.15). La revisión Alembic
observada en esa base fue `0005_complete_potoquitos_schema`.

La exportación antigua `schema.sql` no demuestra por sí sola de qué base,
contenedor o momento procede. Además, al volver a inspeccionar el archivo que
actualmente existe en el repositorio, **no se encuentra `tenant_id` en sus
definiciones de catálogo ni el token en el contenido del archivo**. Por tanto,
la afirmación previa de que ese archivo contiene `tenant_id` no se reproduce en
el artefacto actual y no se usa como premisa de este informe.

La evidencia actual confirma un catálogo legacy sin `tenant_id`. La separación
por tenant es una capacidad nueva de Trifood, no una columna preexistente que
pueda atribuirse al POS vivo. Para las reglas de comportamiento, la evidencia
principal es el código FastAPI y sus pruebas; el dump demuestra estructura y
restricciones, no el comportamiento completo de la aplicación.

Hay una discrepancia que requiere resolución antes de diseñar el modelo Spring:
el esquema vivo y el snapshot Alembic V4 requieren actores para auditoría e
historial de precios, pero el modelo SQLAlchemy activo permite que sean nulos y
declara `ON DELETE SET NULL`. Las migraciones observadas no explican una
convergencia de esas propiedades para objetos preexistentes. No se cambia aquí
ningún modelo ni migración.

La revisión `0005` tampoco demuestra por sí misma cómo se obtuvieron todas las
constraints actuales: V4 crea tablas ausentes y agrega columnas/objetos que
detecta como ausentes, pero no convierte en `NOT NULL` una columna ya existente.
Al buscar FKs existentes compara las columnas referenciadas, no reconcilia su
acción `ON DELETE`. V5 agrega tablas/columnas ausentes y no altera la definición
de columnas o FKs existentes. Así, la metadata V4 explica el diseño esperado
para objetos recién creados, pero no prueba cómo se llegó al estado observado
si los objetos ya existían.

## Procedencia y alcance de la evidencia

| Evidencia | Hecho observado | Límite |
|---|---|---|
| Contenedor | `potoquitos_atg-db-1`, imagen `postgres:16-alpine`, ID `ef63451bceb11c458ea9d4a6853ba497650ee0ad2b0bc00ee5f606bb74410517`; estaba `healthy`. | La identidad y estado son los observados durante esta inspección, no una garantía histórica. |
| Base y conexión | Base `potoquitos`, usuario PostgreSQL `potoquitos`; servidor PostgreSQL 16.15, iniciado `2026-10-07 15:27:28.605217+00`. | El usuario de conexión no demuestra quién creó originalmente el esquema. |
| Revisión Alembic | La tabla de versión de la base indicaba `0005_complete_potoquitos_schema`. | El valor de revisión no prueba que cada propiedad de cada objeto coincida con metadata. |
| Exportación nueva | `docs/database/potoquitos-live-schema-2026-10-07.sql`; `pg_dump --schema-only --no-owner --no-privileges --dbname=potoquitos`, ejecutado desde el contenedor. El encabezado reporta servidor y `pg_dump` 16.15. Tamaño: 54,016 bytes; 2,125 líneas; SHA-256 `D7A97A9B4D09045153CF99E1635F94DBFAA0B143457328E2A3B167DF42D49300`. | El nombre del archivo y la hora de modificación local son metadatos de exportación, no una prueba de la hora exacta de inicio del comando. El dump no contiene filas `COPY` ni `INSERT`. |
| `schema.sql` preexistente | El encabezado informa PostgreSQL/pg_dump 16.15. La fecha de modificación local no identifica por sí misma la base ni el contenedor fuente. El archivo presente no contiene `tenant_id` en las declaraciones de las tablas de catálogo. | Su procedencia exacta y vigencia anterior no están demostradas. No reemplaza la exportación directa. |
| Alcance de las operaciones | Se consultó estado/metadatos y se exportó DDL. No se ejecutó DDL/DML, Alembic, Flyway ni escritura sobre `potoquitos`. | No se ha probado aquí una restauración del dump ni una migración Spring/Flyway. |

El dump nuevo es la fuente directa de evidencia física para el instante de la
exportación. La línea base funcional se establece con ese dump **más** los
servicios/rutas FastAPI y pruebas existentes, no únicamente con un archivo SQL.

## Clasificación de discrepancias

- **A — Diferencia puramente técnica:** cambia representación o mecanismo, no el resultado funcional confirmado.
- **B — Regla de negocio confirmada:** comportamiento vigente evidenciado en rutas, servicio, validaciones o pruebas.
- **C — Código/migración desactualizado o no alineado:** el artefacto de aplicación/migración no expresa una propiedad física o funcional observada.
- **D — Esquema desactualizado:** un esquema no representa el estado PostgreSQL observado.
- **E — Información insuficiente:** las fuentes no permiten afirmar cuál comportamiento debe prevalecer o por qué surgió la diferencia.

Una misma fila puede tener más de una clase. La clase identifica el problema de
evidencia, no autoriza una corrección.

## Matriz de discrepancias

| Elemento | PostgreSQL actual | Alembic | SQLAlchemy | FastAPI | React | Regla funcional | Decisión |
|---|---|---|---|---|---|---|---|
| Procedencia de `schema.sql` | El dump directo nuevo refleja la base consultada; la antigua no está ligada a un origen verificable. | Revisión viva `0005_complete_potoquitos_schema`. | No determina la procedencia de un dump. | No determina la procedencia de un dump. | No determina la procedencia de un dump. | La fuente de verdad física debe ser un estado real observado, no la fecha o nombre del archivo. | **E**. Usar el dump directo nuevo para estructura. La afirmación anterior de que el `schema.sql` actual contiene `tenant_id` queda corregida: el contenido presente no lo muestra. |
| `tenant_id` en catálogo | No existe en `catalog_categories`, `catalog_products`, imágenes, historial ni auditoría del dump vivo. Tampoco aparece en el `schema.sql` actual. | Los snapshots históricos del POS no establecen un tenant legacy. | Los modelos legacy no declaran `tenant_id`. | Las rutas/repositorios actuales operan sin contexto tenant. | El flujo actual es de un solo restaurante y muestra marca Potoquitos. | El POS vigente es single-tenant en su esquema/código observable; tenant scoping es requisito nuevo SaaS. | **B** para ausencia actual; **E** para cualquier atribución histórica distinta. Diseñar `tenant_id` como extensión deliberada para Trifood, sin lógica especial por Potoquitos. |
| Categorías y unicidad | `name NOT NULL`; unicidad exacta y un índice único funcional `lower(trim(name))`; conserva descripción, `is_active`, `display_order` y timestamps. FK de producto a categoría, sin cascada declarada. | V4 incluye nombre único y la unicidad normalizada; V5 no reconcilia propiedades de columnas ya existentes. | `name` único e indexado; índice único normalizado definido en metadata. | Recorta nombres; requiere categoría activa para crear/cambiar categoría de producto; desactivar categoría es operación explícita. | Formulario administrativo crea/edita y ordena categorías; en selección de producto las inactivas no se eligen. | Los nombres no pueden diferir solo por mayúsculas o espacios exteriores; desactivar no equivale a borrar. | **B**. Preservar nombre normalizado único y desactivación. En SaaS el scope de unicidad deberá ser por tenant como cambio intencional. |
| Código de producto | `internal_code NOT NULL`; unicidad exacta y funcional `upper(trim(internal_code))`; hay índice para categoría y estados. | V4 normaliza los códigos a mayúsculas y protege colisiones normalizadas. | `unique=True`, indexado; no expresa por sí solo la misma unicidad funcional sin el índice adicional. | Recorta y convierte a mayúsculas; el schema de actualización acepta `internal_code`. | La pantalla lo presenta como no editable y no lo envía al guardar edición normal. | Los códigos son únicos sin distinguir mayúsculas/espacios exteriores; la inmutabilidad está en la UX habitual, no está impuesta por la API. | **B** para normalización/unicidad; **E/C** para inmutabilidad: no declararla contrato hasta resolver la diferencia API/UI. |
| Campos y estados | Categorías tienen `is_active`; productos tienen `is_active` y `is_available`, ambos `NOT NULL`. No hay campo alternativo `active`. | Los snapshots contienen esos campos y sus valores por defecto de aplicación; V5 solo agrega columnas ausentes. | Campos booleanos no nulos con defaults Python; índices para producto activo/disponible. | Mantiene estado activo distinto de disponibilidad. Pedido rechaza producto inactivo, no disponible o de categoría inactiva. | UI ofrece estados separados, pero en menú público muestra una insignia “Disponible” fija. La edición genérica envía `is_active`; el endpoint específico de baja exige permiso separado. | “Activo” significa habilitado en catálogo; “disponible” indica disponibilidad operativa. No son intercambiables. | **B**. Mantener ambos estados y las validaciones de pedidos. **E**: revisar la divergencia del badge y que el PATCH genérico puede modificar `is_active` con permiso de edición. |
| Precio y versionado | `current_price numeric(12,2) NOT NULL`, no negativo; COP y `price_version > 0`. Historial guarda precio anterior/nuevo, moneda, versión, actor y fecha; único `(product_id, price_version)`. | V4 incluye checks/índice único y reconstruye versiones ordenadas del historial y del producto. La revisión no altera datos en esta inspección. | Mapea precio e historial, pero permite que `changed_by` sea nulo (ver fila de actores); no contiene por sí solo el protocolo de concurrencia. | Precio se cambia por operación dedicada con `expected_price_version`; igualdad de precio no crea versión; versión obsoleta responde conflicto; primer registro usa precio anterior nulo y versión 1; cambio, historial y auditoría se guardan en la misma operación. | El formulario de producto separa precio del resto de edición; usa controles distintos para precio inicial e historial. | El precio es COP, no negativo, con dos decimales y cambios versionados/concurrencia optimista; no reemplazar con un PATCH genérico. | **B**. Preservar el protocolo y atomicidad. El control HTML no sustituye las validaciones API/DB. |
| Actores de auditoría e historial | `catalog_audit_events.actor_user_id NOT NULL` y `catalog_product_price_history.changed_by NOT NULL`; ambos FK a `users`, sin `ON DELETE SET NULL` (acción por defecto, no `SET NULL`). | Snapshot V4 `schema_v2.py` declara ambos no nulos y sin `SET NULL`. V4 no estrecha nulabilidad de columnas existentes ni reconcilia `ON DELETE` si ya encuentra FK por las mismas columnas; V5 tampoco modifica columnas/FKs existentes. | Ambos están `nullable=True` y usan `ForeignKey(..., ondelete="SET NULL")`. | Las operaciones de auditoría e historial reciben el usuario actor autenticado. | No gestiona actores directamente; las acciones se realizan desde una sesión autenticada. | La aplicación registra quién cambió precio y catálogo; la base viva impide registros sin actor y no permite poner la referencia a nulo al borrar el usuario. | **C** para metadata SQLAlchemy no alineada; **E** sobre el origen temporal de la divergencia en esta base. Mantener como hecho físico actual los dos campos obligatorios; no inferir política de borrado de usuarios más allá de la FK observada. |
| Imágenes | Tabla guarda producto, referencia de archivo, `is_current`, timestamps y `uploaded_by` nullable. Índice único parcial permite como máximo una imagen actual por producto. FK `product_id` y `uploaded_by` no declaran cascada; el producto tiene referencia opcional a imagen actual. | Snapshot V4 no declara cascada en FK de producto; V5 no reescribe FKs existentes. | `ProductImage.product_id` declara `ON DELETE CASCADE`; `uploaded_by` declara `ON DELETE SET NULL`; relación con producto sin regla de borrado equivalente configurada en el modelo. | Acepta JPEG/PNG/WebP, limita tamaño y dimensiones, rechaza animación; si falla la escritura SQL compensa/elimina el archivo cargado. | Selector limita los tipos de imagen y 5 MiB; flujo de edición/admin presenta imagen actual y reemplazo. | Máximo una imagen marcada actual; validación de archivo del servidor y compensación de almacenamiento son parte del flujo. | **C/E** en cascadas: modelo activo contradice la FK observada; no hay ruta funcional de borrado físico que resuelva la intención. Preservar el comportamiento de carga/reemplazo y decidir borrado al diseñar el modelo objetivo. |
| Auditoría del catálogo | `entity_type`, `entity_id`, `action` y fecha obligatorios; `details` JSON opcional; actor obligatorio. La relación entity es polimórfica, no FK a categoría/producto. | V4 define la tabla con actor no nulo; V5 no transforma la tabla si ya existe. | `actor_user_id` nullable y `SET NULL`; campos de entidad/action alineados en forma general. | Escribe actor, tipo, id y acción al mutar catálogo; consulta de auditoría está protegida y acotada en el servicio. | No permite editar eventos; solo representa el catálogo y sus operaciones. | La auditoría registra actor y objeto afectado; la DB no puede verificar la existencia del objeto por ser `entity_type/entity_id` polimórficos. | **C** para la divergencia del modelo del actor; **B** para auditoría de cambios; no inventar una FK polimórfica. |
| Menú público | No hay columnas de publicación/visibilidad adicionales en el catálogo; hay estados activo/disponible separados. | Sin migración de un estado “publicado” diferente en el catálogo. | Sin campo `is_published` en el modelo. | El menú filtra categorías activas y productos activos; no elimina del resultado los productos `is_available=false`. | Presenta distintivo de disponibilidad fijo, no derivado de `is_available`; branding muestra Potoquitos. | La visibilidad pública actual se basa en activo/categoría activa; disponibilidad no equivale a publicación. | **B** para criterio de inclusión de la API; **E** para el bug/decisión de presentación. En Trifood el branding debe venir de configuración del tenant, no de una rama Potoquitos. No agregar “publicado” sin requisito confirmado. |
| Recetas e inventario | `recipes.product_id` es único y FK al producto; ingredientes se conectan mediante `recipe_items`; `inventory_movements`/`kardex_entries` referencian ingredientes. El dump contiene cascadas de receta/ítems según sus FKs, no una regla de borrado general del catálogo. | V5 crea tablas faltantes desde `Base.metadata`; no actualiza propiedades preexistentes. | Producto tiene relación 1:1 con receta; recipe items enlazan receta e ingrediente. | La receta se modifica por endpoints de inventario; los servicios conectan componentes de receta con existencias. | El editor de producto puede guardar receta aparte; se ha observado que el flujo ignora errores de esa escritura secundaria. | La receta vincula producto vendible con insumos; movimientos y kardex son historial de inventario y no equivalen a una lista de ingredientes del catálogo. | **B** para relaciones de dominio; **E** para la UX que puede reportar éxito si falla la operación secundaria. No trasladar el fallo silencioso al nuevo flujo. |
| Pedidos y facturas | `order_lines.product_id` no tiene FK a producto; la línea guarda `product_name` y `unit_price` como snapshot. `invoice_lines` guarda también datos snapshot y `product_id` sin FK. | V4 y V5 reflejan `product_id` como entero sin FK en estas líneas. | `product_id` es entero sin FK; snapshots están mapeados. | Al crear pedido comprueba estado de producto/categoría y persiste nombre/precio/cantidad de la operación. | El flujo POS usa productos del menú y muestra precio; el historial operativo no depende de leer el nombre/precio vivo del producto. | El snapshot preserva el detalle histórico aunque cambie el catálogo. La integridad del `product_id` no queda garantizada por FK en esas tablas. | **B** para conservar snapshot; **E** para política de borrado/enlace histórico. No añadir una FK que cambie esa semántica sin decisión explícita. |
| Reglas de borrado/cascada | FK de catálogo sin cláusula explícita significa acción PostgreSQL por defecto, no `SET NULL`; imágenes e historial no tienen cascada de producto en el dump. Receta y sus ítems sí tienen cascadas observadas; líneas de pedido/factura conservan snapshots. | V4 snapshot generalmente se alinea con las FKs vivas para imágenes/historial; V5 no altera FKs ya existentes. | Modelo activo declara `CASCADE` hacia imágenes e historial, y `SET NULL` para los actores; discrepancia con DB. | No hay rutas de borrado físico para productos/categorías observadas; las operaciones son activar/desactivar. | La administración usa baja lógica y no presenta eliminación física del catálogo. | La baja ordinaria es lógica; el comportamiento de borrado físico no forma parte de un flujo API/UI confirmado. | **C/E**. No derivar una política de borrado objetivo desde el ORM. Mantener baja lógica y resolver explícitamente las FKs antes de migrar o habilitar borrado físico. |
| Límites de entrada/UI | Tipos y constraints de catálogo observados en DDL. | Metadata de V4 tiene longitudes base para nombres/códigos; V5 no normaliza validaciones de UI. | Tipos/longitudes SQLAlchemy no codifican todas las validaciones API. | Ej. API admite descripción de producto hasta 10.000 caracteres. | El formulario limita la descripción a 300 caracteres; controles HTML de precio/imagen son límites de UX. | La regla realmente impuesta por el backend no es siempre el límite que expone React. | **A/E**. Registrar y resolver límites al definir contrato objetivo; no tratar una restricción visual como regla de dominio sin corroboración. |

## Reglas del catálogo que la migración debe conservar

Estas reglas se derivan de rutas/servicios, validaciones y pruebas existentes; el
dump por sí solo no las demuestra:

1. **Categorías:** crear/editar con nombre recortado; mantener orden visual,
   descripción opcional y activación/desactivación lógica. Una categoría
   inactiva no puede asignarse a un producto nuevo ni al cambiar su categoría.
   No se observó borrado físico por endpoint.
2. **Productos:** conservar código interno, nombre, descripción, precio COP,
   categoría, porciones recomendadas opcionales, `is_active`, `is_available`,
   imagen actual y timestamps. Código se normaliza con trim y mayúsculas; la
   unicidad también protege contra variantes de caja/espacios. La API permite
   cambiarlo aunque el flujo normal de React lo presenta como de solo lectura.
3. **Estados:** activo e indisponible son estados distintos. Un pedido rechaza
   productos inactivos, indisponibles o en categoría inactiva. El menú público
   actual incluye un producto activo aunque `is_available` sea falso; React no
   refleja correctamente esa disponibilidad.
4. **Precio:** el primer precio crea versión 1 con `previous_price` nulo.
   Cambiarlo exige la versión esperada; mismo valor no agrega entrada; conflicto
   de versión se informa como conflicto. Actualización, historial y auditoría
   forman una misma operación transaccional.
5. **Imágenes:** validar en servidor tipo, tamaño, dimensiones y animación;
   reemplazar imagen actual sin permitir dos actuales; compensar el archivo si
   falla la persistencia SQL. `file_reference` no es un blob de imagen.
6. **Auditoría:** mutaciones guardan actor, tipo/id de entidad, acción y fecha.
   El actor es obligatorio físicamente en la base consultada. La referencia a
   entidad es polimórfica, por lo que no existe FK directa a la tabla afectada.
7. **Menú público:** filtra productos activos y categorías activas; no hay una
   bandera persistida de publicación independiente. La identidad/branding
   Potoquitos que aparece en React debe ser configuración del tenant en Trifood.
8. **Pedidos:** al crear la línea se guarda snapshot de nombre/precio. No borrar
   esa semántica al diseñar FK hacia producto; hoy la línea no tiene FK y el API
   no ofrece borrado físico de producto.
9. **Recetas/inventario:** una receta se asocia a un producto y a ingredientes;
   movimientos/kardex son registros de inventario vinculados a ingredientes.
   El guardado secundario de receta en la UI puede ocultar errores y requiere
   tratamiento explícito en el nuevo flujo.
10. **Aislamiento SaaS:** no existe en el POS actual a nivel de estas tablas.
    Agregar `tenant_id`, membresías y unicidad por tenant es un cambio de
    arquitectura deliberado; los datos/configuración del tenant deben sustituir
    cualquier marca fija, no bifurcar reglas de negocio por nombre.

## Documentación preexistente

- `docs/database/tenant-schema-rebuild.md` y
  `docs/database/tenant-migration-plan.md` identifican `schema.sql` como fuente
  del diseño y reportan PostgreSQL 16.15/revisión Alembic 0005. El archivo
  presente sí muestra esa versión, pero no demuestra la base/contenedor fuente
  ni la fecha de extracción. La nueva exportación directa debe ser la referencia
  estructural del análisis actual. **Clase E** para la procedencia histórica.
- `docs/architecture/tenant-isolation.md` aclara que `tenant_id requerido` es
  parte del modelo SaaS objetivo, no de la base actual; esto es consistente con
  el dump vivo.
- `docs/architecture/database/erd.md` declara derivarse de SQLAlchemy y Alembic,
  no del PostgreSQL vivo. Es una vista de metadata útil, pero no prueba la
  nulabilidad ni las acciones de borrado efectivas en la base consultada.
- `docs/migration/phase-0-audit.md` aporta contexto arquitectónico (POS
  single-tenant), no evidencia de constraints físicas.

## Fuentes contrastadas

- PostgreSQL: `docs/database/potoquitos-live-schema-2026-10-07.sql`.
- Dump sin procedencia demostrada: `schema.sql`.
- Metadata ORM activa: `backend/fastapi_app/infrastructure/models.py`.
- Snapshot utilizado por Alembic V4: `backend/migrations/schema_v2.py`.
- Reconciliación V4: `backend/migrations/versions/0004_fastapi_clean.py`.
- Reconciliación V5: `backend/migrations/versions/0005_complete_potoquitos_schema.py`.
- Servicios, repositorios, DTOs y endpoints: `backend/fastapi_app/modules/catalog/`,
  `backend/fastapi_app/infrastructure/repositories.py`,
  `backend/fastapi_app/presentation/catalog_routes.py` y
  `backend/fastapi_app/presentation/schemas.py`.
- UI: `frontend/src/features/catalog/products/CatalogProductsPage.tsx` y
  `frontend/src/features/catalog/public-menu/PublicMenuPage.tsx`.
- Pruebas: `backend/tests/test_fastapi_flows.py` y
  `backend/tests/test_postgres.py`.
- Documentación previa: `docs/architecture/database/erd.md`,
  `docs/database/tenant-schema-rebuild.md`, `docs/migration/phase-0-audit.md`.
  Los documentos de diseño SaaS describen propuestas; no reemplazan la evidencia
  de la base viva.

## Decisiones que quedan para revisión

1. Confirmar si la API debe hacer inmutable `internal_code`, alineándose con la
   UX actual, o si su edición es un comportamiento soportado.
2. Resolver si React debe mostrar como no disponible un producto que el endpoint
   público sí devuelve.
3. Corregir la discrepancia entre metadata SQLAlchemy y las restricciones vivas
   de los actores, sin cambiar la base actual en esta fase.
4. Definir política de borrado físico futura para producto, imágenes e historial;
   el comportamiento vigente observado es baja lógica.
5. Definir el límite funcional de descripción y hacer coherentes UI/API en el
   contrato migrado.
6. Tratar la escritura de receta como parte observable del flujo y no descartar
   errores de esa operación en el nuevo frontend/backend.

**Cierre:** esta matriz establece el estado observado de PostgreSQL y el
comportamiento que debe preservarse según el POS actual. No se modificaron
Alembic, SQLAlchemy, FastAPI, React ni la base `potoquitos`; no se implementó el
módulo Spring catálogo. Se detiene el trabajo aquí para revisión.
