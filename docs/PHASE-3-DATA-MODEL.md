# Fase 3: decisión de catálogo y persistencia

## Hechos observados

- `baseQuestion()` elige operandos, opciones y respuesta correcta dentro de `public/js/app.js`. `checkAnswer()` compara la respuesta en el navegador.
- La evaluación final contiene 12 preguntas, tres por operación. Una práctica contiene entre 1 y 50 preguntas de una operación; nivel 1, 2 o 3 cambia los rangos.
- La escala de aprobación es `gradeFromPercentage()` con `PASS_GRADE`; la práctica concede 5 XP por respuesta correcta, 1 estrella por acierto al finalizar y 10 XP al completar la sesión. La evaluación final no concede esas recompensas de práctica.
- Los bancos gratuitos de rompecabezas y problemas cotidianos también residen en el frontend y excluyen IDs ya respondidos usando progreso local.
- El esquema existente no persiste preguntas/respuestas ni un intento compuesto. `activity_attempts` representa una actividad única y no basta para idempotencia por respuesta y finalización concurrente.
- La sesión determina identidad en los endpoints actuales. `AUTH_MODE` permanece desactivado por defecto.

## Cambio necesario antes de habilitar actividades autenticadas

La solución segura debe establecer un catálogo/motor versionado server-side como única autoridad de preguntas y respuestas. El motor reproducirá las reglas actuales (operaciones, rangos por nivel, tipos, número de preguntas y evaluación de 12 preguntas) para no cambiar la dificultad ni la nota. El servidor guardará el conjunto de preguntas emitido para cada intento; el cliente solo recibirá enunciados/opciones y enviará una respuesta por índice. Rompecabezas y problemas tendrán sus bancos versionados en servidor y el historial de IDs respondidos será por usuario.

Se requiere un esquema aditivo con intentos, preguntas emitidas/respuestas y estado agregado. Restricciones únicas por (usuario, clave idempotente), (intento, índice de pregunta) y reclamación de recompensa impedirán duplicados. La respuesta, su registro y la recompensa asociada deben persistirse atómicamente. Repetir la misma clave y respuesta devolverá el resultado almacenado; reutilizarla con otro contenido se rechazará. La finalización calculará nota, aprobación, XP y estrellas exclusivamente desde respuestas persistidas.

La política de recompensas se conserva: 5 XP por respuesta correcta de práctica, 1 estrella por acierto al finalizar una práctica y 10 XP por completar una práctica; la evaluación no concede recompensas de práctica. No se conceden recompensas por importación. Las reglas de rachas, misiones, insignias y niveles requieren portarse y verificarse antes de mostrarse como autoridad server-side; hasta entonces el servidor no las aceptará del cliente ni habilitará esas afirmaciones.

## Criterio de activación

No habilitar actividades de cuenta hasta que estén integrados el cliente y el servidor, la migración haya sido aplicada a una base de prueba aislada y pasen pruebas de integración para transacciones, aislamiento entre usuarios, duplicados y persistencia tras nueva sesión. Las pruebas unitarias por sí solas no prueban la persistencia PostgreSQL real. No aplicar esta migración a una base real sin autorización separada.

## Avance de implementación

`api/_lib/question-catalog.js` ahora contiene el generador matemático y los bancos existentes de rompecabezas/problemas cotidianos. `POST /api/attempts` acepta `action: start`, `answer` o `finish`; `GET /api/progress` devuelve los contadores e historial del propietario de la sesión. `api/_lib/learning-repository.js` hace cada mutación crítica en una sentencia PostgreSQL atómica con restricciones únicas e idempotencia. La regla de evaluación sigue siendo 12 respuestas (3 por operación), aprueba con nota 3.5; práctica da 5 XP por acierto, 10 XP al completar y una estrella por acierto. Los bancos gratuitos conservan sus IDs y se agotan según respuestas persistidas. La evaluación no da recompensas de práctica. Las reglas adicionales de insignias, misiones y rachas no se traspasaron.

La fase 3.3 conectó el cliente a este ciclo; las operaciones server-side permanecen sin activación hasta validar una base PostgreSQL aislada y una sesión real en navegador. `npm run test:integration` requiere `TTL_TEST_DATABASE_URL`, `TTL_TEST_DATABASE_EXPECTED_NAME`, `TTL_TEST_DATABASE_EXPECTED_ROLE`, `TTL_TEST_DATABASE_ACK=disposable-test-database` y el marcador `ttl_test_safety` descrito en `tests/POSTGRES-INTEGRATION.md`. Verifica la identidad real de la base y del rol antes de escribir; sin URL omite la prueba. La prueba crea y elimina usuarios temporales; no aplica migraciones. La configuración predeterminada continúa con `AUTH_MODE=disabled`.

### Migración de prueba

En una base PostgreSQL desechable creada expresamente, aplicar primero `db/migrations/0001_auth_sessions.sql` y luego `db/migrations/0002_learning_attempts.sql`, usando el mecanismo autorizado del proveedor. Antes del rollback, exportar lo que se quiera conservar. `db/migrations/0002_learning_attempts_down.sql` elimina intentos, respuestas, recompensas y contadores agregados; solo utilizarlo en esa base aislada sin datos que deban conservarse. Ninguna de estas migraciones se ejecutó en este trabajo.
