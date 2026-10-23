# Estado de validación

Este documento se actualiza al preparar cada distribución. Distingue pruebas locales de autorizaciones y funcionamiento real de una instalación nueva.

## Comprobado durante el desarrollo

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
