# Plan de migración segura a producción

## Estado de la fase actual

El modo demo explícito en loopback conserva cuentas y progreso manipulables en `localStorage`; no sirve para cuentas reales. El modo de servidor usa una cookie HttpOnly y progreso en memoria del cliente procedente de la API. El inicio GIS se envía al backend para verificación, pero no se ha validado con un inicio de sesión real. XP y resultados server-side dependen de una base PostgreSQL que todavía no se ha migrado ni probado.

Las fases 1 a 3.3 implementan autenticación Google server-side, sesiones opacas, el esquema y la conexión de actividades/progreso a las rutas de aprendizaje. Esa integración aún no está validada contra PostgreSQL real ni en un navegador con sesión real. `AUTH_MODE=disabled` es el valor predeterminado. El demo local solo carga su DB en loopback si se abre explícitamente con `?ttl-demo=1`; no es un mecanismo de cuentas reales.

Aunque una sesión server-side sea válida, la interfaz mantiene bloqueadas las actividades: el motor actual todavía calcula respuestas, notas, XP y desbloqueos en `public/js/app.js`. No se presenta progreso local como progreso autenticado ni se habilita el juego para cuentas reales.

## Arquitectura recomendada

- **Hosting:** Vercel; conserva la salida estática `public/` y ejecuta los endpoints Node en `api/`.
- **Base de datos recomendada:** Neon PostgreSQL con `@neondatabase/serverless`. El driver ofrece consultas HTTP para funciones serverless y transacciones de varias consultas; el esquema usa SQL versionado. No se creó una cuenta ni un recurso externo.
- **Identidad:** GIS entrega un ID token al backend. `google-auth-library` verifica el token y el servidor identifica la cuenta por `sub`, no por un `user_id` o correo enviado por el navegador.
- **Sesión:** token aleatorio de 256 bits en cookie `HttpOnly; SameSite=Lax`, `Secure` en Vercel/producción. La base conserva solo su SHA-256, caducidad y revocación. Los POST mutables exigen el `Origin` configurado exactamente; no hay CORS abierto.
- **Propiedad:** la sesión determina el usuario para cada endpoint privado. Nunca se toma un propietario desde la URL o el cuerpo. Roles y Premium comienzan con `student` y `false`; aún no hay endpoint público para elevarlos.
- **Transacciones e idempotencia:** intentos y reclamaciones tienen restricciones únicas por estudiante y clave de actividad/recompensa. Las operaciones que creen sesión y cuenta se ejecutan en una sola sentencia SQL atómica.

Neon publica actualmente un nivel Free de $0 con límites de cómputo/almacenamiento; esos límites, retención de recuperación, respaldos y cualquier costo de producción se deben confirmar antes de crear el recurso o elegir un plan. No existe en este repositorio una conexión ni se afirma que la base real haya sido probada.

## Fases y criterios de aceptación

| Fase | Trabajo | Archivos previstos/actuales | Criterio de salida |
|---|---|---|---|
| 1. Fundación de identidad (código probado) | Verificación server-side GIS, cuentas por `sub`, sesiones con hash, consulta/revocación, esquema inicial. | `api/auth/*.js`, `api/_lib/*.js`, `db/migrations/0001_auth_sessions.sql`, `package.json`, `.env.example` | Pruebas unitarias aprobadas. Falta validar la firma con credenciales reales y DB. |
| 2. Integración controlada de identidad (implementada parcialmente) | Cliente same-origin para GIS, consulta/cierre de sesión, configuración opt-in, demo local explícito, lectura de progreso por sesión. La UI no abre actividades de cuentas server-side. | `public/js/auth-client.js`, `public/js/app.js`, `public/index.html`, `api/auth/config.js`, `api/progress.js`, pruebas nuevas | 22 pruebas unitarias aprobadas. No hay login real ni DB de integración; tampoco se escriben intentos o resultados desde la UI. |
| 3. Persistencia autorizada y motor educativo (pendiente) | API para intentos verificables. Migrar generación de preguntas/retos al servidor o firmar retos; validar respuestas, calificaciones y recompensas atómicamente antes de habilitar actividades. | `api/`, `db/migrations/`, módulo de datos del cliente, pruebas | A/B aislados; A no accede a B; respuestas falsas y peticiones concurrentes no manipulan resultados ni duplican premios; cuatro unidades y evaluación conservan reglas verificadas. |
| 4. Importación voluntaria | Vista de revisión/consentimiento; valida y conserva local; importa solo historial señalado como no verificado. | interfaz, endpoint import, esquema y pruebas | Cancelar no cambia datos; reintento idempotente; importación no admite contraseñas, secretos, roles, Premium ni pagos como autoridad. |
| 5. Administración, Premium y pagos | Provisionamiento administrativo controlado; revisión de solicitudes; ningún pago habilita acceso sin confirmación de proveedor/operador autorizado. | `api/`, esquema y pruebas | Usuario normal no eleva rol/Premium ni aprueba pagos. Los flujos de demostración quedan etiquetados como tales. |
| 6. Vercel y publicación | Variables por ambiente, origen OAuth exacto, backups/restore, límites y observabilidad; validar despliegue de prueba. | `vercel.json` solo si hace falta, documentación, pruebas | Build y smoke tests en preview autorizada. Publicar requiere autorización expresa y dominio definitivo. |

## Variables de entorno

`.env.example` lista los nombres, sin valores secretos:

- `DATABASE_URL`: cadena PostgreSQL privada de Neon.
- `GOOGLE_CLIENT_ID`: el mismo Client ID web que ya está configurado públicamente; no se cambió ni se muestra aquí.
- `APP_ORIGIN`: origen exacto de este ambiente. El valor de desarrollo conocido es `http://127.0.0.1:5501`. No se ha supuesto un dominio de producción.
- `AUTH_MODE`: mantener `disabled`. `server` solo habilita los endpoints de identidad cuando `GOOGLE_CLIENT_ID`, `DATABASE_URL` y `APP_ORIGIN` también son válidos; eso aún no habilita actividades educativas.
- Variables previas del tutor: `GEMINI_API_KEY`, `GEMINI_MODEL`, `MATH_TUTOR_ALLOWED_ORIGINS`.

Vercel Preview requiere un `APP_ORIGIN` HTTPS que coincida con el hostname de ese preview. Producción requiere el origen HTTPS definitivo y el mismo origen registrado como JavaScript origin en el cliente OAuth de Google. La autorización del proyecto de Google Cloud y los orígenes no se modifican desde este repositorio.

## Migración de datos locales

No se importa automáticamente ni se borra `ttl_ultimate_db_v1`. El contenido local no demuestra propiedad ni integridad: contiene contraseñas legibles, respuestas de recuperación, roles, Premium, pagos y progreso manipulables. El flujo futuro debe pedir consentimiento, mostrar el resumen, asociar todo a la cuenta autenticada en servidor y conservar únicamente historia educativa marcada como importada/no verificada. No concede rol, permisos, Premium, pagos aprobados, calificaciones oficiales ni recompensas históricas.

La vista previa futura debe resumir únicamente intentos, aciertos, fechas, unidades y preferencias educativas. Antes del envío, mostrar consentimiento explícito y campos que se descartan: cuentas locales, contraseñas, palabras secretas, roles, Premium, pagos y reclamaciones no verificadas. El endpoint futuro debe validar el tamaño/esquema, asignar el propietario desde la cookie y exigir una clave de importación única; un reintento idéntico devuelve el resultado previo. Si ya existe progreso server-side, ofrecer conservarlo o cancelar; nunca reemplazarlo automáticamente. Mantener `ttl_ultimate_db_v1` intacto hasta la confirmación del usuario. Esta vista previa y endpoint aún no están implementados ni activos.

La base inicial no contiene cuentas demo ni contraseñas. La futura autenticación local por correo debe usar hash de contraseña en servidor y recuperación con tokens de un solo uso; no se debe trasladar el secreto de recuperación actual.

## Desarrollo y operaciones

1. Para el demo local existente, usar un hostname loopback y añadir `?ttl-demo=1`; de otro modo el frontend falla cerrado y no lee ni escribe el DB local.
2. Configurar variables localmente fuera del repositorio. No usar Live Server para probar las funciones API: es un servidor de archivos estáticos y no ejecuta `api/`.
3. Ejecutar las funciones con Vercel CLI en un entorno local autorizado y el origen exacto indicado en `APP_ORIGIN`.
4. Aplicar la migración solo a una base creada explícitamente por el propietario. No ejecutar migraciones destructivas ni automáticas en producción.
5. Configurar respaldos y probar restauración antes de alojar progreso real. Los límites de restauración dependen del plan contratado.
6. No guardar tokens, ID tokens, cookies ni cadenas de conexión en logs.

## Bloqueos de producción

- No hay credenciales de base ni base Neon creada; conexión SQL real y migración no están verificadas.
- No se ha realizado un inicio de sesión GIS real en el origen autorizado. La auditoría previa documenta el bloqueo de red de Google Identity Services.
- `AUTH_MODE` sigue deshabilitado. Los endpoints no se han conectado a una DB real y las pruebas de token son unitarias, no una aceptación OAuth.
- Las rutas server-side de actividades y progreso ya están conectadas al cliente, pero todavía no se han validado con una base PostgreSQL real ni en navegador. `AUTH_MODE` permanece deshabilitado; no se deben habilitar cuentas reales hasta completar esas verificaciones y revisar los controles operativos pendientes.
- El demo local conserva contraseñas, roles y progreso manipulables; solo está permitido explícitamente en loopback con `?ttl-demo=1`. No lo uses para datos reales.
- No existe importación voluntaria, recuperación segura, autorización administrativa ni verificación de pago.
- La API de autenticación todavía requiere limitación de intentos compartida/administrada y observabilidad antes de exponerse a tráfico real. El tutor actual limita con memoria de proceso; ese mecanismo no sustituye un límite global en funciones serverless.
- No se conoce el dominio final ni se ha probado la configuración OAuth/HTTPS de producción.
- `api/math-tutor.js` delega en la función de Netlify. Se conserva; su uso y límites deben revisarse antes de publicar en Vercel.

La aplicación no está lista para cuentas reales ni publicación hasta cerrar estas fases y aprobar las pruebas de seguridad y regresión.
