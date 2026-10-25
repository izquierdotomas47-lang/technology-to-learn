# Informe de cierre de QA — Technology to Learn SAS

Fecha: 25 de octubre de 2026.

Alcance: pruebas interactivas y responsive pendientes de la auditoría anterior.

Aplicación: `public/`, servida en `http://127.0.0.1:5501/`.

Navegador: Chrome 155.0.8059.85, perfil temporal aislado.

## Entorno y aislamiento

El disco C: tenía 5.991.444.480 bytes libres (5,58 GiB) y `%TEMP%` ocupaba 20.790.629 bytes (19,8 MiB). El entorno no estaba sin espacio. La primera ejecución de Chrome interpretó incorrectamente el argumento del perfil cuya ruta contenía espacios; el registro mostró `Multiple targets are not supported in headless mode`. Al corregir el argumento, `--headless=new` terminó por un fallo del proceso GPU (`GPU process isn't usable`). Chrome se mantuvo ejecutando con el perfil aislado usando `--headless=old`, `--no-sandbox` y `--disable-gpu`, limitado a la URL local. No se instalaron dependencias.

La prueba usó el estudiante de demostración que la aplicación siembra al abrir un almacenamiento vacío. Se habilitó Premium solo en el `localStorage` del perfil temporal para probar las cuatro unidades; no se modificó ningún perfil habitual. El perfil de prueba se eliminó al terminar.

## Resultados

| Criterio | Estado | Evidencia | Pendiente |
|---|---|---|---|
| Apertura y acceso local | APROBADO | `/` respondió HTTP 200. El formulario de acceso mostró `auth`; al enviar las credenciales de demostración prellenadas abrió `home` con `¡Hola, Estrellita!`. | — |
| Centro de Mando y ruta gratuita | APROBADO | Se abrió Centro de Mando, se desplegó Matemáticas y la ruta de Suma mostró sus cuatro etapas. | — |
| Ruta Premium: suma, resta, multiplicación y división | APROBADO | En cada unidad se contestaron 5 preguntas (4 correctas, 1 incorrecta). Cada resultado fue 4/5, 80 %, nota 4,2/5,0; cada unidad quedó aprobada y desbloqueó la siguiente. Tras las cuatro, la evaluación final quedó habilitada. | — |
| Evaluación final | APROBADO | 12/12 aciertos, 100 %, nota 5,0/5,0; desglose de 3/3 en cada operación; `assessment.completed=true`. | — |
| Respuesta correcta e incorrecta, retroalimentación y resultados | APROBADO | En las unidades, los estados de retroalimentación fueron `feedback good` y `feedback bad`; las opciones quedaron deshabilitadas y el flujo mostró la pantalla de resultados correspondiente. | — |
| Prevención de doble respuesta | APROBADO | Después de una respuesta real se intentó una segunda llamada a `checkAnswer` con otro valor. Aciertos de vida, XP, estrellas, actividades procesadas y reclamaciones permanecieron iguales; los botones de respuesta estaban deshabilitados. | — |
| Reclamación duplicada de XP | APROBADO | Con un usuario sintético en memoria, la primera reclamación `qa-duplicate-claim` sumó 7 XP; la segunda devolvió una lista vacía y el XP siguió en 7. No se persistió esa prueba. | — |
| Consistencia de XP, nivel, estrellas y resultados | APROBADO | Las cuatro unidades sumaron 16 respuestas correctas, 16 estrellas y 280 XP; nivel calculado 3. Los resultados mostraron las ganancias por sesión (+165, +30, +30 y +55 XP). La evaluación final no alteró XP ni estrellas. Dos sesiones móviles adicionales cerraron con 23 aciertos, 23 estrellas y 360 XP; el nivel mostrado siguió en 3. | — |
| Persistencia | APROBADO | Tras recargar, sesión, XP (360), estrellas (23), aciertos (23), totales, notas/unidades aprobadas, evaluación y nivel coincidieron exactamente con el estado anterior a la recarga; la interfaz mostró nivel 3. | — |
| Sin desbordamiento horizontal en 390 × 844 | APROBADO | `document.documentElement.scrollWidth` fue 390 en Centro de Mando, ruta, operación, pregunta, retroalimentación y resultados; `window.innerWidth` fue 390 en todos los casos. | — |
| Sin desbordamiento horizontal en 360 × 800 | APROBADO | `scrollWidth` fue 360 en Centro de Mando, ruta, operación, pregunta, retroalimentación y resultados; `window.innerWidth` fue 360 en todos los casos. | — |
| Escritorio 1366 × 768 | APROBADO | En la pantalla de operación, `innerWidth=1366`, `scrollWidth=1351`; no hubo desbordamiento. | — |
| Consola JavaScript durante navegación | APROBADO | No se registraron errores, excepciones ni advertencias de consola en las sesiones instrumentadas. | — |
| Solicitudes HTTP de la aplicación | APROBADO | No hubo respuestas HTTP 4xx/5xx durante la navegación instrumentada ni eventos `Network.loadingFailed` en las sesiones registradas. Imágenes rotas: ninguna. El video de Suma cargó desde `public/assets/videos/suma.mp4` con `readyState=4`. Al detener el servidor temporal, este registró `ConnectionResetError` en transferencias interrumpidas durante el cierre; no fueron respuestas HTTP de error ni fallos reproducidos durante el recorrido. | — |
| Google Identity Services | BLOQUEADO | En el navegador aislado, la carga de `https://accounts.google.com/gsi/client` falló con `net::ERR_NETWORK_ACCESS_DENIED`. En esta revisión, un GET directo desde PowerShell sin User-Agent de navegador devolvió 403; el mismo recurso con User-Agent de Chrome devolvió HTTP 200 (`application/javascript`, 280.610 bytes). Esto solo comprueba la descarga del script, no la configuración OAuth ni un inicio de sesión real. El Client ID está configurado en el HTML, pero su valor no se incluye aquí y no se pudo consultar su proyecto de Google Cloud. | Probar el botón desde un navegador y red autorizados. En el cliente Web de OAuth, confirmar el origen exacto `http://127.0.0.1:5501` para desarrollo y el origen HTTPS exacto del despliegue; ambos deben figurar como JavaScript origins. Confirmar el consentimiento de la aplicación y completar un inicio de sesión real sin 403. |

## Cambios y cierre

No se modificó HTML, CSS ni JavaScript de la aplicación: las pruebas no demostraron un defecto de producto que requiriera corrección. El único archivo creado por esta tarea es `docs/QA-REPORT.md`.

No se regeneraron las capturas existentes. Su existencia, dimensiones y contenido visual ya habían sido comprobados en la auditoría previa; no se vuelven a certificar aquí como capturas nuevas.

Las comprobaciones estáticas `node --check public/js/app.js` y `git diff --check` no se repitieron porque ya constaban aprobadas y no se cambió código de aplicación.

## Revisión final de publicación — 25 de octubre de 2026

La configuración de GIS carga la biblioteca oficial desde `accounts.google.com/gsi/client`, pasa un Client ID configurado a `google.accounts.id.initialize` y comprueba en el cliente la audiencia, el emisor y `email_verified` del perfil obtenido por `tokeninfo`. No se imprimió ni alteró el Client ID ni se modificaron orígenes externos. La configuración de orígenes autorizados de Google Cloud no está en el repositorio y no fue accesible en esta revisión. La guía oficial indica configurar el origen JavaScript exacto y registrar los orígenes de desarrollo y producción en el cliente Web: [configurar un Client ID de Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

La prueba del botón de Google sigue pendiente: el HTTP 200 posterior verifica solo que se pudo descargar la biblioteca con una petición de lectura, no que el proveedor acepte el origen, emita la credencial ni que el callback complete el acceso. No se debe marcar el acceso Google como aprobado hasta completar ese flujo en el origen autorizado.

Riesgo de publicación independiente de GIS: el código contiene cuentas de demostración y compara credenciales en JavaScript; la base local, incluidas las cuentas y su progreso, se guarda en `localStorage`. La identidad Google también se procesa en el cliente y no se encontró un endpoint de autenticación del servidor. Esto no constituye autenticación segura ni almacenamiento de cuentas para producción. Antes de usar el sitio con cuentas o datos reales se necesita autenticación y persistencia del lado servidor, verificación de ID tokens en el backend y retirar las credenciales de demostración del cliente. Google recomienda validar las credenciales en el backend con una biblioteca de verificación: [autenticar con un servidor backend](https://developers.google.com/identity/sign-in/web/backend-auth).
