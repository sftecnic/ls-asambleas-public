# Reorganización visual 0.8.0

## Comportamiento

- Agenda reúne Programa y Reuniones y conserva los enlaces de pantalla, evento, departamento, día y reunión.
- Las fichas del equipo abren siempre con «Ver ficha». Datos, Equipo y Acceso están separados; los enlaces desde pendientes abren Equipo. Cambiar de apartado conserva el formulario, no guarda ni modifica datos.
- Publicar está junto a la acción de añadir en Turnos y Programa; su revisión conserva el ámbito real de publicación.
- El plano abre ampliado. Conserva contexto del evento, momento, público, alternativas al arrastre, Deshacer y Guardar. Puede reducirse.
- Calendar separa Invitación y Respuestas. Sin convocatoria no se muestran contadores vacíos que parezcan respuestas recibidas. Revisar no envía nada.
- El histórico conserva año, evento, departamento y persona; los eventos se pueden plegar y vuelven a mostrarse al imprimir.
- Los recorridos tienen miniaturas protegidas; las fotos se liberan al cambiar de usuario/evento o al desconectar. Sus metadatos se despliegan desde Fotos.
- El Excel conserva sus cuatro pasos; sus acciones de revisión permanecen accesibles en móvil.

Se mantienen los datos, cargos, permisos, reglas, APIs, plantillas de correo, históricos y publicaciones. El despliegue de esta versión afecta exclusivamente a Hosting.

## Desarrollo reproducible

```sh
npm ci
npm run skills:check
npm run test:skills
npm test
npm run test:installation
npm run check:worker
npm run build
npm run dev:demo
```

La demostración explícita usa `http://127.0.0.1:5174/` y no conecta a Firebase aunque haya configuración local. El [prototipo ficticio](../qa/visual-080/prototype.html) se abre en esa dirección seguida de `/qa/visual-080/prototype.html`.

En otra terminal, `npx playwright test`. Es necesario instalar previamente el navegador de pruebas (`npx playwright install chromium`) o definir `PLAYWRIGHT_CHANNEL=msedge` si Edge ya está instalado. En PowerShell usa `npm.cmd`/`npx.cmd`. Cada prueba crea un perfil ficticio aislado.

Las capturas comparativas se guardan en `qa/visual-080/before` y `after` en el repositorio de desarrollo. Las anteriores proceden de una copia aislada de 0.7.1. El test de referencia se habilita con `VISUAL_080_BASELINE=1` y `PLAYWRIGHT_BASE_URL` apuntando únicamente a esa copia. No usarlo con datos reales.

## Comprensión pendiente

Las comprobaciones automáticas de teclado, contraste, tamaños, privacidad y datos no demuestran que la interfaz se comprenda sin instrucciones. Quedan pendientes dos rondas con seis participantes representativos. Todos deben reconocer evento, turno y publicación; al menos cinco deben completar las restantes tareas. Una confusión compartida por dos participantes requiere rediseño y repetición.

Tareas: elegir entre eventos simultáneos; encontrar turno y encuentro; abrir una ficha y distinguir datos, aprobación y acceso; corregir asistencia; sustituir desde Editar; localizar reunión y respuesta; abrir una zona 360°; duplicar momento y deshacer; reconocer una consulta offline antigua. No explicar dónde pulsar. Recoger resultados sin datos personales en capturas públicas.

## Comprobaciones realizadas

- Código mantenido: 234 pruebas unitarias y tres de instalación correctas. Las 34 pruebas que necesitan Firestore Emulator quedaron omitidas: esta entrega no modifica reglas.
- Navegador: 81 pruebas correctas en la batería principal. Dos pruebas condicionales se ejecutan por separado: comparación con 0.7.1 y consulta offline de una compilación. La batería incluye teclado, contraste con axe, reajuste a 320 px, texto al 200 %, filtros, asistencia, sustituciones, reuniones, Calendar simulado, Excel, privacidad e impresión.
- También pasan las once pruebas de orden por puesto, horarios compartidos y plantillas de correo, y las dos pruebas offline sobre una compilación: recarga sin red, exclusión de borradores y retirada de la copia al salir. La prueba comparativa genera cinco pantallas de 0.7.1 a cinco anchuras. Las capturas actuales cubren igualmente 320, 360, 390, 820 y 1440 px. Total: 94 casos funcionales y visuales y una comparación de referencia.
- Copia pública limpia: instalación reproducible sin secretos, 225 pruebas unitarias, tres de instalación, comprobación de TypeScript del Worker y compilación correctas.
- Skills: 143 archivos verificados, siete pruebas de integridad y restauración correctas. Se comprobó la recuperación real de una licencia ausente en una copia; los archivos modificados no se sobrescriben.
- Las imágenes comparativas utilizan datos ficticios. No se enviaron correos ni invitaciones durante las pruebas. La autorización OAuth real y los servicios existentes no se modifican.

La compilación conserva un aviso por el tamaño del paquete principal (aproximadamente 342 kB comprimidos); Excel y el visor 360° siguen cargándose por separado. Las skills no forman parte de los archivos servidos a usuarios. Las comprobaciones automatizadas usan Edge de escritorio con tamaños de pantalla simulados; queda pendiente la comprobación en teléfonos físicos y con participantes.
