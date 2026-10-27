# Nombramiento y precursorado actuales

Desde 0.6.0 las fichas privadas pueden registrar **Nombramiento** y **Precursor regular**. Son datos actuales de la persona, compartidos entre eventos. No son el cargo de un departamento ni conceden permisos. No se deducen ni se completan fichas anteriores: la ausencia de un dato significa **Sin indicar**.

## Consultar y editar

En **Equipo → ficha → Editar ficha**, o **Equipo → Directorio → Ver ficha → Editar ficha**, abre **Servicio actual**. Las altas también incluyen estos campos.

| Nombramiento | Precursor regular compatible |
|---|---|
| Sin indicar, Ninguno, Siervo ministerial, Anciano | Sin indicar, Sí, No |
| Superintendente de circuito | No aplica |

Elegir Superintendente de circuito cambia ambos valores al guardar la ficha. El selector de precursorado queda deshabilitado en No aplica. Al cambiar desde SC a otro nombramiento vuelve a Sin indicar: elige la respuesta actual, sin recuperar una respuesta anterior por suposición.

Solo administración y quienes ya pueden consultar la ficha privada ven estos datos. Para cambiarlos hacen falta además contactos y edición en el mismo ámbito autorizado. Tener el cargo de responsable, auxiliar o SC no concede capacidades. Cada guardado conserva actor, fecha y revisión en la auditoría existente.

## Siglas junto al nombre

El grupo se presenta como **nombre → servicio actual → Sorda/Oyente → WhatsApp**. Solo aparece un distintivo neutro con las condiciones positivas registradas:

| Distintivo | Significado |
|---|---|
| SM · PR | Siervo ministerial y precursor regular |
| A · PR | Anciano y precursor regular |
| SM / A | Siervo ministerial / Anciano |
| PR | Precursor regular |
| SC | Superintendente de circuito, siempre solo |

Pasar el ratón, enfocar con teclado o tocar abre la leyenda con **ambos campos completos**. Se puede mover el puntero a la leyenda; Escape o tocar fuera la cierra. No se abre WhatsApp ni cambia la ficha. Los controles conservan al menos 48 × 48 px y pasan juntos de línea cuando falta espacio.

Sin condiciones positivas no aparece distintivo. Eso no permite deducir una respuesta negativa: la ficha distingue **Sin indicar**, **Ninguno** y **No**. En Histórico la leyenda dice **Condición actual**; no afirma qué nombramiento tenía la persona en una asamblea pasada.

## Filtros y Excel

Equipo y Directorio permiten combinar Nombramiento y Precursor regular con congregación, búsqueda y Sorda/Oyente. **Anciano excluye SC**. Limpiar retira también estos filtros.

La hoja Personas añade las columnas opcionales **Nombramiento** y **Precursor regular**, con sus desplegables. Se siguen aceptando libros anteriores sin esas columnas. En actualizaciones una celda vacía conserva el valor guardado; usa **Sin indicar** para retirar una respuesta sin borrar el campo. Si indicas SC en Excel debes indicar explícitamente **No aplica**. Cualquier combinación incompatible queda Por revisar; la importación no la corrige silenciosamente.

La exportación administrativa y las copias JSON conservan ambos datos. Una copia anterior que no los tenga conserva los valores actuales al restaurar. Las copias contienen datos privados; no deben adjuntarse al repositorio público.

## Privacidad y actualización

Los campos de código son `Person.appointment` y `Person.regularPioneer`. El repositorio combina la vista de la persona, pero los guarda exclusivamente en **personContacts**, nunca en el directorio operativo **persons**. Los validadores del cliente y las reglas de Firestore comprueban los valores y su combinación, tanto al crear como al actualizar.

Se excluyen de publicaciones, impresión, consulta offline y respuesta de contactos departamentales para voluntarios. No se amplía el Worker ni se modifica Gmail. No hay nuevas colecciones, índices ni migración de personas.

Para actualizar una instalación, conserva primero las versiones de Hosting y reglas y despliega **reglas antes de Hosting**. Las reglas nuevas aceptan las fichas antiguas sin estos campos. Una vez guardado un campo, una versión antigua no puede eliminarlo al sobrescribir la ficha: **debe recargarse para editarla**. Ante un error de permisos después de actualizar, recarga y vuelve a abrir la ficha; no relajes las reglas. El repositorio actual conserva los valores privados anteriores al editar otros datos y comprueba revisiones concurrentes.

Las pruebas automatizadas se describen en [Validación](VALIDACION.md). La comprensión de las siglas con participantes representativos queda pendiente hasta realizar la prueba humana.
