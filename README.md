# Inicio de Technology to Learn SAS

Hay dos versiones completas de la aplicación:

- `public/index.html` es la versión recomendada para desarrollo y despliegue. Sus recursos están dentro de `public/` y sus rutas son relativas a esa carpeta.
- `index.html` es una variante alternativa situada en la raíz del proyecto. Usa `css/`, `js/` y `public/assets/`.

## Inicio recomendado desde la carpeta del proyecto

Abre en VS Code esta carpeta del proyecto e inicia Live Server. `.vscode/settings.json` configura la carpeta `public/` como raíz y el puerto 5501. Abre:

`http://127.0.0.1:5501/`

Esta dirección sirve directamente `public/index.html`; no se necesita una página de redirección.

## Si Live Server se inicia desde la carpeta contenedora

Si abres en VS Code la carpeta superior que contiene este proyecto, la raíz del servidor puede mostrar un listado de directorios. En el entorno comprobado, la aplicación se encuentra en:

`http://127.0.0.1:5500/ttl%20sas/public/`

## Abrir la variante alternativa de la raíz

Para ejecutar `index.html`, abre esta carpeta del proyecto en VS Code, cambia temporalmente `liveServer.settings.root` de `/public` a `/` en `.vscode/settings.json`, reinicia Live Server y abre `http://127.0.0.1:5501/`. Restablece `/public` para volver a la versión recomendada.
