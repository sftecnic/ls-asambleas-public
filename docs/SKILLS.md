# Skills de diseño del proyecto

La fuente de trabajo es `.agents/skills/`, incluida en Git y en el ZIP público. No depende del equipo del autor. Lee primero [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md) y [AGENTS.md](../AGENTS.md).

| Paquete | Fuente | Versión fijada | Licencia |
|---|---|---|---|
| frontend-design | anthropics/skills | dbd4588f9e1033efb41dad4bef2f7947c8993d44 | Apache-2.0 |
| Impeccable | pbakaus/impeccable | 4.7.0 · 5cb95eea9c96479f57afe0732a45470d30183326 | Apache-2.0 |
| UI UX Pro Max | nextlevelbuilder/ui-ux-pro-max-skill | 28b3b8dee8c976df4fa3e94aed4e092ad43fcb03 | MIT |
| web-design-guidelines | vercel-labs/agent-skills | 063bee94c3f4df8453406c830b0a7df0f2860278 | MIT |

La guía técnica de Vercel procede de `vercel-labs/web-interface-guidelines`, fijada por separado en el manifiesto. El README del repositorio de skills documenta su licencia MIT. Cada paquete conserva su texto de licencia; no se le aplica la licencia no comercial de la aplicación.

## Verificar y recuperar

Con Node.js 24, desde la carpeta que contiene `package.json`:

```powershell
npm.cmd run skills:check
npm.cmd run skills:restore
```

En macOS/Linux usa `npm` en lugar de `npm.cmd`. La comprobación es local y no necesita instalar dependencias. Debe indicar que las cuatro skills están completas. El manifiesto `.agents/skills-lock.json` contiene origen, commit, SHA-256 de cada archivo, licencias, ejecutables y adaptaciones. Se normalizan los finales de línea para permitir clones de Windows y Linux.

`restore` descarga exclusivamente archivos ausentes desde URLs oficiales fijadas por commit. Verifica su integridad antes de escribir. Si algún archivo presente difiere del manifiesto, se detiene sin sobrescribirlo. Revisa el cambio, consérvalo en Git o restaura expresamente la versión deseada antes de repetir. Una interrupción deja los archivos ya recuperados; repetir continúa con los que faltan. No hay actualizaciones automáticas durante `npm install`, build ni despliegue.

## Qué leer para cada tarea

1. Define qué necesita reconocer o hacer la persona en esa pantalla.
2. Lee `impeccable/SKILL.md` y solo el apartado pertinente: organización (`reference/operate.md`), claridad (`reference/clarify.md`) o adaptación (`reference/adapt.md`). Antes de editar, lee `reference/craft-floor.md`.
3. Usa `frontend-design/SKILL.md` para composición y jerarquía; conserva el sistema visual aprobado.
4. Para una duda concreta de formularios, foco o navegación, lee `ui-ux-pro-max/SKILL.md` y busca solo ese patrón en sus datos.
5. Revisa con `web-design-guidelines/SKILL.md` y su copia fijada `references/guidelines.md`.

No cargues todos los manuales para cada cambio. Ninguna recomendación estética debe esconder nombres, fechas, estados o acciones esenciales. Los requisitos de producto y las instrucciones de la persona usuaria prevalecen. No representes LSE con gestos inventados.

Los asistentes que no descubren skills automáticamente deben abrir explícitamente los archivos anteriores. La demostración y los ejemplos usan datos ficticios. No hacen falta Codex, plugins ni conexiones de cuentas para revisar el diseño.

## Herramientas auxiliares opcionales

UI UX Pro Max incluye scripts y CSV; requiere Python 3, sin paquetes adicionales:

```powershell
python .agents/skills/ui-ux-pro-max/scripts/search.py "focus not obscured" --domain ux --max-results 3
```

Impeccable incluye el lanzador de la versión 4.7.0. Su primera ejecución descarga el motor oficial y comprueba el checksum publicado por el proveedor. Los binarios y cachés no se versionan. Para mantenerlos fuera del paquete de skills:

```powershell
$env:IMPECCABLE_HOME = Join-Path $PWD '.tools/impeccable-engine'
& ./.agents/skills/impeccable/scripts/impeccable.cmd context
& ./.agents/skills/impeccable/scripts/impeccable.cmd detect --json src/components
```

En macOS/Linux:

```sh
export IMPECCABLE_HOME="$PWD/.tools/impeccable-engine"
sh .agents/skills/impeccable/scripts/impeccable context
sh .agents/skills/impeccable/scripts/impeccable detect --json src/components
```

Si no puedes descargar o ejecutar el motor, lee PRODUCT/DESIGN y las referencias y documenta la revisión manual. No presentes un detector sin ejecutar como aprobado. Las herramientas no sustituyen a las pruebas con personas.

## Copia personal y actualizaciones

La copia personal es opcional. Tras verificar el repositorio:

```powershell
node scripts/skills.mjs sync-user --dest "$env:USERPROFILE/.codex/skills"
```

En macOS/Linux: `node scripts/skills.mjs sync-user --dest "$HOME/.codex/skills"`. Solo añade archivos ausentes y verifica los presentes. Si una skill personal difiere, informa del conflicto y no la reemplaza. Reinicia la sesión del asistente para descubrir nuevas skills. En este proyecto usa siempre las rutas del repositorio; las copias del mismo nombre no se fusionan.

Actualizar es una decisión explícita: revisar cambios y licencias del origen, fijar el commit, actualizar archivos y manifiesto incluyendo las adaptaciones, ejecutar `skills:check` y `test:skills`, probar la herramienta afectada y revisar el diff. Después sincronizar la copia personal. Las adaptaciones actuales hacen portables las rutas de UI UX Pro Max y permiten revisar Vercel desde su referencia local fijada.

Las antiguas copias parciales de `.design-skills` se sustituyen por esta instalación. No agregues una segunda fuente. La distribución pública copia los paquetes y el manifiesto; Vite y Hosting solo publican `dist/`, donde no se incluyen skills ni documentación de desarrollo.
