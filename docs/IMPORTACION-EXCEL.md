# Importar y actualizar con Excel

Solo administración puede importar, con conexión. El archivo original se lee dentro de un Worker del navegador; no se sube a Firebase. Solo se guardan los registros revisados y confirmados. La importación JSON anterior sigue disponible.

## Preparar el archivo

Descarga **Más → Importar → Descargar plantilla**. Para datos existentes usa **Exportar para actualizar**, que conserva sus códigos. El ejemplo contiene únicamente datos ficticios y ningún Gmail de acceso. Los formatos aceptados son `.xlsx` sin macros, fórmulas ni protección; guarda los `.xls` antiguos como `.xlsx`.

No cambies nombres de hojas, cabeceras de la fila 4 ni el texto de versión de A1. Escribe desde la fila 5. Puedes dejar hojas vacías, pero no añadir hojas ajenas. Se admiten hasta **1.000 filas de datos entre todas las hojas** y **5 MB**. Hay límites adicionales de archivos internos, descompresión y tiempo de lectura; si un libro muy formateado se rechaza, copia solo los valores a una plantilla nueva.

## Códigos y relaciones

Cada fila lleva un código único y estable, también las participaciones de Equipo. Ejemplo: persona `P-001`, congregación `C-001`, evento `E-001`, participación `EQ-001`, turno `T-001`. Las columnas Evento, Persona, Departamento, Congregación y Sede contienen **el código**, no el nombre. En actualizaciones conserva los identificadores exportados.

Un nombre no prueba identidad. Si coincide nombre, alias o Gmail de una persona nueva, la revisión permite seleccionar una ficha existente y remapear sus referencias. También puedes confirmar expresamente que dos homónimos son personas diferentes; nunca pueden compartir Gmail. Si dudas, excluye la fila y compruébalo. No se fusionan personas automáticamente.

## Hojas y campos

| Hoja | Obligatorio para altas | Opcional |
|---|---|---|
| Personas | Código, Nombre completo | Alias separados por `;`, Congregación, Teléfono, Correo de contacto, Gmail de acceso, Correo para avisos, Sorda / Oyente, Observaciones privadas, Nombramiento, Precursor regular |
| Congregaciones | Código, Nombre | Correo del comité |
| Departamentos | Código, Nombre | Icono, Instrucciones, Enlace de formación |
| Sedes | Código, Nombre | Localidad, Dirección |
| Eventos | Código, Nombre, Fecha inicial, Fecha final, Sede | Tipo, Sección, Zona horaria |
| Equipo | Código, Evento, Persona, Departamento | Cargo, Reserva, Comité, Voluntario |
| Turnos | Código, Evento, Departamento, Persona, Puesto, Fecha, Inicio, Final | Encuentro, Suplentes como códigos separados por `;` |
| Programa | Código, Evento, Fecha, Hora, Duración en minutos, Título | Tipo, Discursante, Correo del discursante, Idioma, Intérprete, Enlace Drive, Material, Ensayo |

La hoja Listas documenta los valores de los desplegables. «Otro» permite cualquier departamento adicional. El puesto es texto libre; «Audio» y «Vídeo» siguen siendo distintos. Teléfonos y códigos se conservan como texto.

Para una persona nueva, el valor inicial es **Sin indicar**. Equipo parte de **Voluntario**, **No** reserva, comité **Propuesta** y voluntario **Sin respuesta**. Si indicas Aprobado/Aceptado, debes haber comprobado que esos estados son ciertos. El cargo no concede permisos. Las filas de turnos requieren aprobación y aceptación de titular y suplentes.

Turnos y programa nuevos o modificados quedan **en borrador**. La asistencia inicial es **sin marcar**. La zona horaria predeterminada es **Europe/Madrid**. No se importan asistencia histórica, publicaciones, permisos administrativos, claves, correos enviados, reuniones ni planos.

## Fechas, horas y solapes

Escribe una fecha completa `27/10/2030` o `2030-10-27`, y hora `09:40`. La fecha/hora se interpreta en la zona del evento. No se inventa el año ni se deduce por el nombre del evento. La duración del programa son minutos positivos.

Una hora inexistente por cambio de horario se rechaza. Si la hora se repite, indica expresamente el desplazamiento UTC, por ejemplo `02:30+02:00` o `02:30+01:00`. La exportación incorpora el desplazamiento para conservar el instante exacto.

Se revisan solapes entre eventos y la elegibilidad del equipo. No se permite cambiar directamente al titular de un turno existente: usa **Turnos → Editar → Sustituir**, para conservar histórico. Tampoco se actualiza mediante Excel un turno cuya asistencia ya se haya registrado.

## Archivo → Revisar → Importar → Accesos

1. Elige el archivo. La aplicación compara con los datos actuales.
2. Filtra **Nuevos, Cambiados, Sin cambios o Por revisar**. Abre Ver datos para comparar. Corrige las incidencias en Excel o excluye filas. Descarga el informe de errores si lo necesitas.
3. En una actualización, **una celda vacía conserva el dato actual**. Para borrar un campo opcional permitido, marca «Vaciar …» en su revisión. No se eliminan fichas ni accesos por Excel.
4. Pulsa **Importar N registros**. Se valida toda la selección antes de escribir y se guarda por dependencias en lotes pequeños. La pantalla muestra cuántos se han guardado.
5. Si falla un lote, los anteriores permanecen guardados. Pulsa **Volver a revisar y continuar**. Se compara de nuevo con el servidor; lo incorporado aparece sin cambios y no se duplica. Si alguien cambió datos relacionados, revisa la incidencia antes de continuar.
6. Al acabar, selecciona por separado los accesos. Solo aparecen personas aprobadas, aceptadas y con Gmail válido sin un acceso existente para ese ámbito. Se concede únicamente **consulta como voluntario**. Los permisos existentes, incluidos los desactivados, no se sustituyen.

Los cambios quedan auditados con actor, fecha, hoja y filas de procedencia. Importar no envía correos ni publica contenido. Revisa el evento y publica después desde Turnos/Programa. Para permutas complejas que requieren cambiar varios horarios a la vez, usa la gestión de turnos: si un paso intermedio solapa, la importación se detiene sin saltarse la reserva de horarios.

## Privacidad y compatibilidad

La exportación administrativa contiene contactos y observaciones privadas. Conserva el archivo en un lugar protegido. No lo adjuntes a una incidencia pública. La publicación operativa y las copias offline no incorporan estos contactos.

Desde 0.6.0 se añaden **Nombramiento** y **Precursor regular**, ambos privados y actuales. Se admiten libros anteriores sin esas dos columnas. Sus celdas vacías conservan valores; para retirar una respuesta elige **Sin indicar**. SC requiere indicar **No aplica** expresamente; otras combinaciones con No aplica se rechazan. No se convierten silenciosamente valores incompatibles. Consulta [opciones, siglas y privacidad](SERVICIO-PERSONAS.md). Exportaciones y respaldos administrativos conservan los campos; publicaciones, impresión y consulta offline los excluyen.

Los libros usan controles estándar XLSX. Las pruebas de lectura y estructura no sustituyen abrirlos en la versión concreta de Excel o LibreOffice de tu organización; comprueba desplegables, fechas, filtros y guardado antes de una carga grande. La validación de la aplicación es la comprobación final, incluso si el editor de hojas permite escribir un valor inválido.

Desde 0.7.0, Congregaciones incorpora **Circuito** y Personas incorpora **Circuito de servicio**. Son columnas opcionales: se admiten libros anteriores y los blancos conservan valores. El circuito de servicio es privado y exclusivo de SC, que exige congregación vacía y precursorado No aplica. Una combinación incompatible queda Por revisar. Importar no confirma convocatorias de Calendar ni envía invitaciones.
