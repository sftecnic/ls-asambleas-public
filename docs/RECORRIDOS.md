# Recorridos 360° y fotografías de zonas

En Inicio/Mis turnos y en las instrucciones de un turno, **Conocer departamento** abre los recorridos disponibles para la sede del evento y los departamentos autorizados. Esta primera fase requiere conexión. No tiene editor, vídeos ni referencias PDF; no aparecen botones vacíos.

## Uso

1. Abre el departamento. La vista inicial mira hacia su zona principal.
2. Desplaza la panorámica con el dedo o el ratón. Usa pellizco o los botones para ampliar. Con teclado, enfoca la panorámica y usa las flechas; también hay botones de dirección.
3. Toca una zona con nombre o abre **Zonas**, que muestra miniaturas del mismo contenido. En ordenador la lista aparece junto al visor.
4. Amplía su fotografía mediante pellizco o **Acercar**. Arrastra la foto ampliada para recorrerla.
5. **Volver al recorrido** conserva orientación y aumento. Escape vuelve de una foto al recorrido; otro Escape lo cierra. **Restablecer** recupera la vista inicial.

No hay giro automático ni acceso al movimiento físico del teléfono. Si WebGL 2 no está disponible, se mantiene la galería de zonas. Las fotografías llevan fecha y versión: permiten reconocer el lugar y el equipo, pero no sustituyen instrucciones revisadas ni garantizan que la instalación siga idéntica.

## Separación del código y las fotografías

El repositorio público contiene únicamente dibujos ficticios en `public/tour-demo/` y un catálogo vacío en `worker/tour-assets/__tour_catalog.json`. Nunca coloques fotos reales en `public/`, `src/`, capturas públicas ni en la carpeta de distribución. Tampoco publiques el manifiesto de preparación: contiene nombres de archivo y asociaciones propias de tu organización.

El código del visor se carga al abrirlo. El service worker excluye sus módulos de la precarga; las respuestas privadas del Worker y los blobs de imágenes nunca se guardan en la consulta offline. Al cerrar se destruye el visor, se liberan sus texturas, se retiran las entradas de su caché y se revocan las direcciones blob.

## Preparar fotografías de otra instalación

Necesitas Python 3 con **Pillow 12.3.0** (`py -m pip install Pillow==12.3.0`; macOS/Linux: `python3 -m pip install Pillow==12.3.0`, preferiblemente dentro de un entorno virtual). Conserva una copia de los originales fuera del repositorio público.

Prepara un manifiesto privado, por ejemplo `.tools/tours-source.json`:

```json
{
  "tours": [{
    "id": "sede-ejemplo-video-v1",
    "venueId": "CODIGO_SEDE_EXISTENTE",
    "departmentId": "CODIGO_DEPARTAMENTO_EXISTENTE",
    "title": "Audio y vídeo",
    "version": 1,
    "capturedAt": "2030-04-20",
    "panorama": {
      "file": "cabina.PHOTOSPHERE.jpg",
      "alt": "Cabina de Audio y vídeo",
      "redactions": []
    },
    "initialView": [0.5, 0.5],
    "zones": [{
      "id": "camera",
      "title": "Cámara",
      "icon": "camera",
      "at": [0.4, 0.6],
      "images": [{"file": "control-camara.jpg", "alt": "Control de las cámaras"}]
    }]
  }]
}
```

Los códigos de sede y departamento deben coincidir exactamente con los de la aplicación. La misma sede puede usarse en varios eventos, siempre con comprobación de sus permisos. Un evento en otra sede no hereda el recorrido.

`initialView`, `at`, `crop` y `redactions` usan coordenadas normalizadas entre 0 y 1 sobre la fotografía original, tras corregir EXIF. Las posiciones son `[x,y]`; los rectángulos, `[izquierda,arriba,derecha,abajo]`. Cada detalle admite `crop`, `rotate` en grados y `redactions`. Los detalles extraídos de la propia panorámica heredan sus difuminados si no tienen una lista propia. Revisa siempre el resultado; un difuminado no garantiza por sí solo anonimización.

Iconos permitidos: `camera`, `mixer`, `video`, `monitor`, `audio`, `platform`, `makeup`, `location`. Mantén estables los identificadores de zonas para poder añadir después vídeos, etiquetas y referencias revisadas sin perder vínculos.

La panorámica debe conservar sus campos GPano originales: FullPanoWidthPixels, FullPanoHeightPixels, CroppedAreaImageWidthPixels, CroppedAreaImageHeightPixels y desplazamientos de recorte. Una foto ancha normal no equivale a una panorámica equirectangular. El script no inventa la geometría.

```powershell
py scripts/prepare-tour-assets.py --manifest .tools/tours-source.json --source "C:\Fotos de mi sede" --out .tools/tour-assets-v1
```

En macOS/Linux sustituye `py` por `python3` y usa tu ruta de origen. La salida debe estar fuera de los originales. Genera WebP de hasta 4096 px para panorámicas, 2048 px para detalles y miniaturas. Las copias no incluyen EXIF, XMP ni GPS; la geometría necesaria queda en el catálogo. El recibo adyacente registra hashes de originales y tamaños para verificar que no han cambiado.

Revisa a tamaño completo **todas** las imágenes resultantes: personas, pantallas, documentos, nombres y teléfonos. Revisa además rotación, legibilidad y posiciones de puntos en el visor. Omite tomas accidentales o sin utilidad. La revisión humana de contenido precede a la publicación.

## Publicar de forma protegida

1. Confirma la cuenta Cloudflare elegida, su plan Workers/Queues Free, el proyecto Firebase Spark sin facturación y la URL canónica. Conserva los identificadores de la versión anterior del Worker y Hosting. No cambies de cuenta por tener otra sesión disponible.
2. En una copia **privada** de la configuración del Worker configura:

```json
"assets": {
  "directory": "../.tools/tour-assets-v1",
  "binding": "TOUR_ASSETS",
  "run_worker_first": true
}
```

La ruta se resuelve desde el fichero Wrangler; el ejemplo corresponde a una configuración dentro de `worker/`. El instalador nuevo ya genera el binding con un catálogo vacío. Al actualizar una instalación existente respalda su configuración y añade solo este bloque, sin sobrescribir cuenta, secretos, colas, cron ni variables.

3. Ejecuta las pruebas y `wrangler deploy --dry-run --config TU_CONFIG_PRIVADA`. Publica con el procedimiento gratuito y autenticado de [Instalación](INSTALACION.md). El catálogo y las fotos se despliegan juntos como assets del Worker, **nunca** como assets de Hosting.
4. Comprueba primero el Worker. Solo después publica Hosting con el código del visor. Si el servicio de fotos es diferente al de reuniones, configura `VITE_TOUR_SERVICE_URL` con su URL exacta y recompila; si está vacío se utiliza `VITE_MEETING_SERVICE_URL`. No muevas el remitente o su OAuth como efecto secundario de instalar fotos.
5. Prueba sesión autorizada, otro departamento, otra sede, cierre de sesión y acceso directo sin sesión. Comprueba también `/media/ID.webp` y `/__tour_catalog.json`: nunca deben devolver contenido privado.

Para alojar fotografías en un servicio separado puedes desplegar `worker/tour-entry.ts` con los mismos tres datos públicos (`FIREBASE_PROJECT_ID`, `APP_ORIGIN` y binding `TOUR_ASSETS`) y una credencial `FIREBASE_SERVICE_ACCOUNT` con `roles/datastore.viewer`. Esta entrada solo admite consultas: fotografías y [contactos departamentales](WHATSAPP.md), sin correo, cron, cola ni operaciones de escritura. Parte de `config/wrangler.tours.example.json`, guarda una copia privada excluida de Git y reemplaza todos los valores `TU_*` y la carpeta de fotos; respeta las rutas relativas desde esa copia.

Crea una cuenta de servicio propia de lectura desde Google Cloud → IAM y administración → Cuentas de servicio. Asígnale **Cloud Datastore Viewer** en tu proyecto exacto y crea su clave JSON solo cuando vayas a conectarla. En Cloudflare configura ese JSON como secreto `FIREBASE_SERVICE_ACCOUNT` del Worker, mediante `wrangler secret put FIREBASE_SERVICE_ACCOUNT --config TU_CONFIG_PRIVADA` o la sección de secretos del servicio. No lo copies a Git, al chat ni a `VITE_*`; no compartas claves con otras instalaciones. Verifica primero `/health`, y después el catálogo con una cuenta autorizada y las rutas bloqueadas sin sesión. Usa `VITE_TOUR_SERVICE_URL` para ese destino y conserva la URL de reuniones. No reutilices ni rotes las claves de Gmail para desplegar las fotos.

Todas las peticiones pasan primero por el Worker. Este verifica el ID token de Firebase, correo verificado y permisos activos, consulta la sede del evento y autoriza cada archivo mediante el catálogo. No se conceden permisos por el cargo ni por conocer una URL. Las respuestas tienen `Cache-Control: private, no-store`; los tokens solo se envían en Authorization, nunca en URLs. CORS se limita al origen de la aplicación.

**Nunca desactives `run_worker_first` ni uses rutas de recursos que puedan saltarse el Worker.** Al agotar la cuota gratuita debe fallar la entrega, sin servir directamente los archivos. Las peticiones de imágenes protegidas consumen ejecución del Worker y lecturas de Firestore; mide el uso real antes de ampliar la audiencia. Conserva los planes gratuitos y acepta interrupciones por cuota, sin contratar capacidad adicional.

Referencias oficiales: [panorámicas recortadas](https://photo-sphere-viewer.js.org/guide/adapters/equirectangular.html), [autorización antes de assets](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [límites de Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## Comprobación y recuperación

- Prueba las tres orientaciones del visor: móvil vertical y horizontal, tableta y ordenador. Verifica ampliación al 200 %, teclado, foco, lista alternativa y errores de red.
- Abre una zona, amplía y vuelve: conserva la dirección y aumento de la panorámica. Cierra y cambia de usuario: no conserva fotos de la sesión anterior.
- Prueba un dispositivo sin WebGL: la lista sigue permitiendo abrir detalles.
- Comprueba tamaño de descarga, memoria del navegador y lecturas de Firestore con las imágenes propias; los dibujos ficticios no representan el consumo de las fotos reales.
- Pide a participantes representativos encontrar una zona y ampliar su foto sin tutorial. Documenta confusiones y corrígelas; los tests automáticos no validan comprensión.

Para recuperar, vuelve a la versión anterior del Worker con sus assets y después a la de Hosting, siguiendo [Mantenimiento](MANTENIMIENTO.md). Conserva cada catálogo y recibo privados para poder reproducir su versión. Esta fase no escribe ni migra los datos de Firestore, publicaciones o histórico.
