# Permisos: persona, ámbito y acciones · 0.10.0

En **Más → Permisos** se gestionan los accesos de la asamblea seleccionada. El nombre, fecha y localidad identifican el ámbito. Busca una persona o Gmail y filtra por departamento. La administración general aparece aparte, solo para administradores, porque abarca todas las asambleas y departamentos.

## Dar o cambiar un acceso

1. **Persona:** elige departamento y persona. Para dar o reactivar un acceso departamental deben constar comité aprobado, participación aceptada y Gmail válido. La aplicación diferencia un Gmail incompleto de un dato privado que no tienes permiso para consultar. Un acceso existente conserva su persona, Gmail y ámbito.
2. **Acciones:** elige **Consulta** o **Gestión**. Consulta muestra las publicaciones y convocatorias autorizadas. Gestión permite elegir cada acción; no activa todas automáticamente. Consultar queda incluido. El cargo de responsable o auxiliar se mantiene en Equipo, separado del acceso.
3. **Revisar:** comprueba persona, Gmail, asamblea, departamento y acciones añadidas o retiradas. Pulsa **Guardar permisos**. La persona deberá recargar la aplicación para aplicar el acceso actualizado.

Para retirar un acceso, desmarca **Puede entrar** y revisa antes de guardar. Sus otros accesos permanecen. Para la administración general, se revisa expresamente el alcance global y siempre debe quedar al menos una cuenta administradora activa.

| Acción | Alcance actual |
|---|---|
| Consultar | Información autorizada; las vistas de Consulta usan las publicaciones. Gestión también consulta borradores de su ámbito. |
| Editar equipo y reuniones | Propuestas, aprobación, disponibilidad y borradores de reuniones. En Plataforma, programa y planos. |
| Organizar turnos | Asignaciones, sustituciones y asistencia reversible. No publica por sí sola. |
| Publicar y convocar | Publicaciones y confirmación de reuniones/invitaciones; en Plataforma, programa y planos. Confirmar puede avisar a invitados. |
| Gestionar datos personales | Consulta y modificación de teléfonos, correos, Gmail, notas y Sorda/Oyente de fichas autorizadas. Nombramiento, precursorado y circuito de servicio requieren además edición para modificarlos. |
| Dar permisos | Solo las capacidades propias, en su asamblea y departamento. No permite conceder administración general. |

Cada acción tiene icono, nombre, explicación breve y **Qué incluye**. Selección azul, casilla marcada y texto; no depende exclusivamente del color. No hay perfiles predeterminados ni nuevas capacidades.

## Compatibilidad y recuperación

No cambia el esquema de Grant, reglas, API ni datos al actualizar. Consulta usa el valor existente `volunteer`; Gestión conserva `assistant` o `responsible` en accesos existentes y usa `assistant` en los nuevos. Los cargos de Equipo no cambian. Los seis identificadores técnicos permanecen.

Cerrar, Cancelar, Escape y navegación advierten de cambios sin guardar. Un fallo conserva el formulario y enfoca el mensaje. Una revisión concurrente impide sobrescribir la versión nueva: cierra, acepta descartar el borrador y vuelve a abrir **Cambiar permisos**. Al perder la conexión se oculta la pantalla privada y se conserva el borrador solo en la memoria de la sesión: se recupera al volver a Más con conexión. No se guarda en la copia offline ni se encolan cambios. Cerrar sesión borra esa memoria; recargar antes de guardar descarta el borrador.

Solo se despliega Hosting. Antes de desplegar, conservar el identificador de la versión activa para poder recuperarla desde Firebase Hosting. No se despliegan reglas, Worker, Calendar ni Gmail por este cambio. Las skills quedan fuera de los recursos servidos.

## Diseño y pruebas reproducibles

La jerarquía elegida es ámbito → persona → acciones → revisión. La lista separa personas mediante filas; los contornos azules de las acciones indican selección, no jerarquía. Source Sans 3, Lucide, controles de 48 px y dos columnas de acciones solo cuando existe espacio. En móvil, una columna y acciones al pie del diálogo.

La demostración local es el prototipo interactivo con datos ficticios. Las capturas de `qa/permissions/` documentan lista, acciones y revisión a 320, 390, 820 y 1440 px, y texto ampliado al 200 %. No contienen datos de la organización real.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:installation
npm.cmd run check:worker
npm.cmd run build
# En una terminal independiente, demostración sin Firebase:
npm.cmd run dev:demo
# Usar el puerto mostrado por la demostración:
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5174'
npx.cmd playwright test tests/permissions.e2e.spec.ts tests/account-migration.e2e.spec.ts
```

La prueba real de comprensión sigue pendiente. Pedir a seis participantes que identifiquen a quién y a qué asamblea afectan los permisos, permitan organizar turnos sin publicar, expliquen qué permite gestionar datos personales y retiren un acceso departamental sin tocar la administración. Una confusión repetida exige revisar el diseño. Las pruebas automáticas no sustituyen esta evaluación.

## Evidencia técnica · 28 de octubre de 2026

- Código mantenido: 249 pruebas unitarias, tres de instalación, siete de skills, integridad de sus 143 archivos, tipos del Worker y compilación correctos. Las 34 pruebas que requieren Firestore Emulator se omiten: no cambian las reglas.
- Distribución sin configuración ni sesiones heredadas: `npm ci`, 240 pruebas unitarias, tres de instalación, siete de skills, comprobación del Worker y compilación correctos. Auditoría de dependencias sin vulnerabilidades notificadas.
- Edge sobre la distribución compilada: 19 casos correctos de permisos, administración, recuperación, fichas, histórico y consulta offline. Una comparación histórica opcional de 0.7.1 queda omitida por no ser parte de esta entrega. Además, seis regresiones del equipo y su proceso de aprobación/acceso correctas en la demostración de desarrollo.
- Capturas finales a 320, 390, 820 y 1440 px, texto al 200 %, teclado y análisis de accesibilidad sin infracciones detectadas en los diálogos. Revisión de Impeccable sin hallazgos en los componentes nuevos y revisión de las guías de interfaz. Las dimensiones se emulan en navegador; no equivalen a una prueba física en todos los teléfonos.
- Se conservan reglas, índices, esquemas, Worker y datos existentes. No se conceden ni revocan permisos reales durante la validación. El tamaño del paquete principal mantiene el aviso de Vite ya existente; no se añaden dependencias.
