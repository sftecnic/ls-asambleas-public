# Estado de validación

Este documento se actualiza al preparar cada distribución. Distingue pruebas locales de autorizaciones y funcionamiento real de una instalación nueva.

## Comprobado durante el desarrollo

Entrega 0.4.0, 26 de octubre de 2026: botones de WhatsApp con teléfonos ficticios, enlaces interceptados sin solicitudes reales a WhatsApp. Pasan 194 pruebas unitarias del código mantenido, tres del instalador y cuatro pruebas nuevas de navegador: tarjetas/turnos/histórico, consulta de responsables y auxiliares, actualización de teléfono/cargo, cambio de usuario/evento, desconexión, impresión, teclado, texto ampliado y 320, 390, 820 y 1440 px. La revisión automática de accesibilidad no detecta incumplimientos en la pantalla probada. Se comprueban ambos Workers, autorización antes de consultar teléfonos y respuesta sin campos privados adicionales. No se cambian reglas, esquema, publicaciones ni Gmail. Las pruebas del emulador se omiten porque no se han cambiado reglas. La apertura con aplicaciones de WhatsApp instaladas en Android, iPhone y ordenador permanece pendiente de comprobación física; las pruebas de navegador no acreditan esa integración del sistema operativo.

Corrección 0.3.1, 26 de octubre de 2026: se reprodujo que el toque sobre una etiqueta de la panorámica no abría la foto. La selección usa ahora el evento del visor; el teclado y la tecnología de asistencia conservan la activación nativa. Las seis pruebas del visor comprueban toque emulado, ratón, Enter/Espacio, arrastre sin apertura accidental, retorno y foco, además de las funciones anteriores. Se mantienen 168 pruebas unitarias correctas y tres del instalador. No cambian datos, permisos, fotografías ni el Worker.

Entrega 0.3.0, 26 de octubre de 2026: 168 pruebas unitarias del código mantenido, tres del instalador, compilación y tipos del Worker correctos. Se añaden once pruebas de catálogo, geometría, permisos, rutas privadas y servicio separado de solo lectura. Pasan las ocho pruebas de navegador de Inicio y recorridos; se revisan 320, 360, 390, 820 y 1440 px, texto al 200 %, la alternativa sin WebGL y desconexión. Se realizó además una revisión local privada de las tres panorámicas reales y sus zonas en móvil vertical/horizontal y escritorio, sin errores de JavaScript. Las pruebas que requieren Firestore Emulator se omiten en esta entrega: no se han cambiado reglas ni datos.

Para 0.4.0 también pasan 22 pruebas de regresión de Inicio, equipo/directorio, histórico, asistencia, sustitución, identidad de puestos y recorridos 360°. Compilación y tipos del Worker correctos. Las cuatro consultas de cargos sobre los dos eventos de la instalación operativa funcionan con los índices existentes, sin modificaciones. La distribución pública excluye las nueve pruebas de operaciones privadas de esta instalación.

Las capturas públicas usan únicamente dibujos ficticios. La preparación de originales y fotografías permanece privada. Los resultados de publicación y lectura autenticada se anotan en las notas de versión, sin atribuir a las pruebas locales resultados de producción. Sigue pendiente la validación de comprensión con participantes y en teléfonos físicos.

La distribución pública 0.3.0 se instaló en una carpeta limpia: 159 pruebas unitarias, tres del instalador, tipos y compilación correctos, sin configuración de una organización. Las nueve pruebas adicionales del repositorio mantenido corresponden a operaciones privadas excluidas de la distribución. `npm audit` no detectó vulnerabilidades conocidas en esta instalación.

Entrega 0.2.0, 23 de octubre de 2026: 157 pruebas unitarias en el código mantenido; 148 en la distribución pública, que excluye las pruebas de migraciones privadas; tres pruebas del instalador; 28 pruebas reales contra Firestore Emulator; 28 pruebas de navegador sobre importación, asistencia, histórico, reuniones y diseño, más dos de consulta offline sobre una compilación. Compilación de aplicación y comprobación de tipos del Worker correctas. `npm audit` no detectó vulnerabilidades conocidas en las versiones fijadas en esa fecha.

Se verificó `npm ci`, pruebas y compilación desde una carpeta pública limpia sin configuración Firebase ni sesiones CLI locales. Se generó configuración separada y se comprobó que repetirla no sobrescribe valores. El ensayo cloud creó un proyecto aislado sin facturación y una base Standard; la sesión Cloudflare no dispone de Billing Read y el comprobador detuvo correctamente esa parte. La autorización Gmail y el recorrido cloud completo de esa instalación siguen pendientes. No se han reutilizado credenciales del remitente operativo ni enviado correos de ensayo a voluntarios.

- Importación: códigos, altas, actualizaciones, blancos y vaciado explícito, coincidencias, referencias, nuevas categorías, elegibilidad, solapes, borradores y reimportación.
- Lotes: comparación de versiones, dependencias, separación de turnos por persona/día y reanudación sin duplicar lo guardado.
- Fechas: cambio de horario, horas inexistentes y elección explícita de las ambiguas.
- Libros XLSX: ocho hojas de datos, guía y listas; lectura real de la plantilla/ejemplo, exportación y reimportación, formatos, desplegables y rechazo de fórmulas.
- Instalador: configuración para un proyecto ficticio independiente, coherencia de destinos, rechazo de secretos y conservación de archivos existentes.

Los resultados definitivos de compilación, pruebas, navegador y revisión de distribución se anotan en las notas de la versión publicada. No se certifica seguridad únicamente por un escaneo de dependencias.

## Requiere comprobación en cada organización

- Creación y autorización real de las cuentas Firebase/Cloudflare, políticas IAM y permisos de facturación.
- Publicación/verificación de OAuth, consentimiento del Gmail remitente y recuperación tras revocación.
- Entrega real del correo inicial y de ambos recordatorios con el navegador cerrado.
- Consumo con la carga prevista dentro de las cuotas gratuitas.
- Apertura y guardado en las versiones de Microsoft Excel y LibreOffice utilizadas.
- Prueba sin tutorial con personas sordas y con poca experiencia digital.

Estas comprobaciones no se dan por hechas por descargar el repositorio, compilar o pasar pruebas automáticas. Completa COMPROBACION.md antes del primer uso real. La instalación original operativa tampoco acredita automáticamente una instalación independiente.
