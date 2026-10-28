---
name: LS Asambleas
description: Sistema visual de coordinación con palabras, iconos y contexto estable.
colors:
  blue: "#1d4ed8"
  blue-hover: "#163da9"
  selected: "#eff6ff"
  pressed: "#eaf0ff"
  canvas: "#f4f6fa"
  surface: "#fff"
  ink: "#172b4d"
  muted: "#475569"
  line: "#cbd5e1"
  input-line: "#94a3b8"
  control-hover: "#edf2fa"
  green: "#166534"
  green-bg: "#edf8ef"
  amber: "#92400e"
  amber-bg: "#fff2db"
  red: "#b91c1c"
  red-bg: "#fff0f0"
  danger-line: "#e6a9a9"
  neutral-bg: "#eef2f6"
  director-ink: "#6D28D9"
  director-bg: "#F5F3FF"
  mesa-ink: "#0E7490"
  mesa-bg: "#ECFEFF"
  video-ink: "#A21CAF"
  video-bg: "#FDF4FF"
  camera-ink: "#4338CA"
  camera-bg: "#EEF2FF"
  post-neutral-bg: "#F1F5F9"
typography:
  headline:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-.025em"
  headline-mobile:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-.025em"
  title:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: ".89rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  status:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: ".89rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  control: "8px"
  panel: "12px"
  status: "6px"
  navigation: "9px"
  post: "10px"
  modal: "16px"
spacing:
  space-1: ".25rem"
  space-2: ".5rem"
  space-3: ".75rem"
  space-4: "1rem"
  space-6: "1.5rem"
  space-8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.red}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.navigation}"
    padding: "12px 16px"
  navigation-current:
    backgroundColor: "{colors.pressed}"
    textColor: "{colors.blue}"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: ".45rem .7rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  status-good:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
    typography: "{typography.status}"
    rounded: "{rounded.status}"
    padding: "4px 9px"
  brand-symbol:
    size: "52px"
---

# Design System: LS Asambleas

## Overview

**Creative North Star: "Personas en semicírculo"**

El símbolo propio de personas alrededor de una plataforma organiza la identidad: superficies claras, tinta azul oscuro y azul para actuar o seleccionar. La interfaz mantiene nombres, horas y acciones legibles, con iconos acompañados de palabras breves y una posición estable.

La densidad se adapta al espacio disponible. Los bordes y los fondos separan grupos; las sombras se reservan principalmente para diálogos y barras superpuestas.

**Key Characteristics:**

- Source Sans 3 local y etiquetas breves con iconos Lucide.
- Estados reconocibles por icono y palabra, además del color.
- Controles amplios, filtros plegables y plano ampliado al abrir.

Documento extraído del código el 23 de octubre de 2026. El frontmatter contiene los tokens normativos; `src/styles/visual-system.css` se carga después de `app.css` y aporta los ajustes finales. Las instrucciones versionadas y sus comprobaciones están en [docs/SKILLS.md](docs/SKILLS.md).

Las comprobaciones de la versión 0.8.0 se documentan en [docs/DISENO-080.md](docs/DISENO-080.md). El piloto de comprensión con participantes sigue pendiente.

## Colors

La selección azul contrasta con superficies blancas y grises fríos. Los nombres de tokens se conservan vinculados a su función.

### Primary

- **Azul de acción** (`blue`): acción principal, enlaces, selección y foco. `blue-hover` oscurece el botón principal; `selected` y `pressed` son fondos de selección distintos que ya usa la aplicación.

### Secondary

- **Estados**: `green`, `amber` y `red`, con sus fondos, comunican completado, pendiente y error. Borrador e información general usan `muted` sobre `neutral-bg`; no son estados de éxito.

### Tertiary

- **Distintivos de puesto**: las parejas `director-*`, `mesa-*`, `video-*` y `camera-*` proceden de `src/domain/shiftPosts.ts`. El resto usa tinta neutra y `post-neutral-bg`. El nombre del puesto permanece junto al icono.

### Neutral

- `canvas` en el fondo, `surface` en paneles, `ink` en texto principal y `muted` en apoyo.
- `line` separa grupos; `input-line` define campos y ciertos estados de interacción.

**The Estado explícito Rule.** El color acompaña a una palabra y un icono. Publicación, material y ensayo se muestran por separado.

**The Color de puesto Rule.** Los tonos de Director, Mesa, Vídeo y Cámara se limitan a su distintivo. Sorda, oyente y sin indicar mantienen el mismo tratamiento neutro.

## Typography

**Body Font:** Source Sans 3, con sans-serif como alternativa. Los pesos 400, 600 y 700 se sirven desde `@fontsource/source-sans-3`.

La raíz HTML usa (18 px); el cuerpo hereda esa base y el texto secundario usa `small` (aproximadamente 16 px). Títulos de página, títulos de sección, cuerpo y etiquetas corresponden a los roles del frontmatter; no hay una escala decorativa independiente. Los párrafos tienen un máximo de (75ch).

«Texto grande» cambia la raíz a (22 px), se guarda localmente en `ls-large-text` y amplía las medidas en rem. No sustituye al zoom del navegador ni convierte las medidas heredadas en px.

**The Texto del plano Rule.** Los tamaños del texto SVG pertenecen al sistema de coordenadas del viewBox; no son tamaños de interfaz HTML ni una excepción para reducir etiquetas o controles.

## Layout

El ritmo compartido usa los pasos `space-1` a `space-8`; el código conserva también separaciones locales en px. El contenido alcanza un máximo de (1680 px).

- **Móvil, hasta 760 px:** navegación inferior con icono y palabra, altura de reserva (76 px) ajustada en ejecución; una columna, márgenes estrechos y diálogos a pantalla completa. «Agenda» agrupa Programa y Reuniones conservando los enlaces existentes.
- **Tableta, 761–1099 px:** navegación horizontal superior; plano y propiedades ocupan todo el ancho disponible.
- **Ordenador, desde 1100 px:** navegación lateral de (224 px). Inicio puede distribuir pendientes y agenda en dos columnas; el editor distribuye catálogo, plano y propiedades.
- El plano conserva un ajuste local hasta (1120 px) para la leyenda numerada; no es un nuevo corte global.

La cabecera de evento permanece visible. Las alturas de cabecera, navegación y acciones del plano alimentan el espacio de desplazamiento para evitar que cubran el foco. En el plano ampliado, el contexto se traslada a su propia cabecera.

## Elevation & Depth

Paneles principalmente planos, separados por borde y tono. Las tarjetas de personas no tienen sombra en la cascada final. Los diálogos mantienen sombras amplias en ordenador; en móvil se vuelven superficies completas sin sombra. La barra móvil del plano lleva una sombra superior suave. Valores exactos en `extensions.shadows`; el contorno de foco y el borde de selección indican estado, no elevación.

No se prescribe animación decorativa. `prefers-reduced-motion: reduce` elimina animaciones y transiciones y conserva desplazamiento automático.

## Shapes

Controles y filtros usan `control`; paneles comunes, `panel`; estados, `status`. Navegación de ordenador, distintivos y diálogos tienen los radios específicos del frontmatter. El editor conserva paneles internos de (13 px) y envolvente de (20 px), reducida en móvil. Los círculos identifican avatares e indicadores; el semicírculo de personas queda reservado a la marca.

## Components

- **Botones y campos:** mínimo de interacción (48 px); los botones de solo icono también tienen ancho mínimo. Primario azul, secundario blanco, discreto transparente y destructivo con tinta roja. Foco general de (3 px) separado (4 px); el editor usa separación (3 px). Deshabilitado reduce opacidad. La casilla visible mide (22 px), dentro de una etiqueta activable amplia.
- **Filtros:** `Filters.tsx` empieza plegado, anuncia apertura con `aria-expanded` y conserva recuento, chips para quitar cada selección y «Limpiar». Búsqueda y departamento permanecen accesibles.
- **Tarjetas y estados:** borde fino y fondo claro; filas o grupos mantienen la relación entre etiqueta y valor. Programa expone publicación, material y ensayo con icono y texto; sus detalles se despliegan desde una acción etiquetada.
- **Navegación:** icono y nombre visibles, selección mediante `aria-current`; inferior en móvil, superior en tableta y lateral en ordenador.
- **Plano:** ampliar conserva evento, fecha y sede; mantiene estados «Borrador», «Sin guardar» y «Publicado». Deshacer, Rehacer y Guardar permanecen disponibles en la barra móvil. Objetos SVG, leyenda y propiedades describen la misma selección.
- **Iconos:** Lucide, normalmente entre (18–24 px), con etiqueta; el director con batuta es el SVG propio de `ConductorIcon.tsx`, con el mismo trazo. Los iconos decorativos no duplican el nombre accesible.

Marca de interfaz: `Brand.tsx` muestra `public/brand/symbol.svg` decorativo junto al nombre HTML. Tamaño normal definido por `brand-symbol`; variante compacta (36 px). Recursos: `public/brand/horizontal.svg`, `monochrome.svg`, `public/favicon.svg`, `public/icon.svg` y PNG de instalación, máscara, Apple y favicon en `public/brand/`. La marca usa geometría SVG propia, sin imágenes generadas ni material de stock. Los recursos finales están incluidos en la distribución.

## Do's and Don'ts

### Do:

- **Do** conservar palabras visibles, foco perceptible y objetivos de interacción amplios.
- **Do** mantener las selecciones de filtros visibles aunque sus campos estén plegados.
- **Do** conservar evento, fecha y sede al ampliar el plano, junto con Deshacer, Rehacer y Guardar.
- **Do** reutilizar los recursos de marca y los componentes existentes.

### Don't:

- **Don't** usar solo sonido o color para transmitir información.
- **Don't** colorear a las personas según su condición sorda u oyente.
- **Don't** sustituir los estados separados por un único indicador genérico.
- **Don't** presentar el símbolo como un signo en LSE ni como un emblema oficial.


## Organización de las pantallas

Ficha: Datos, Equipo y Acceso, conservando formularios al cambiar de pestaña. Las tarjetas abren siempre «Ver ficha». Un enlace desde pendientes abre Equipo. Agenda contiene Programa y Reuniones; el plano abre ampliado. Publicar se sitúa junto a Añadir turno/intervención y conserva la revisión de alcance. Calendar separa Invitación de Respuestas; una invitación sin enviar no presenta recuentos como si se hubiera convocado. Histórico permite plegar eventos sin ocultarlos al imprimir. Los recorridos usan miniaturas protegidas y no persisten imágenes en offline.

Reuniones alterna Mes y Lista, con ámbito por asamblea o conjunto autorizado. Mes usa lunes a domingo y acciones táctiles de 48 px; cuando no caben siete, la cuadrícula es informativa y la lista mantiene las acciones. Las fechas confirmadas prevalecen sobre borradores. La consulta conjunta identifica asamblea, localidad y zona horaria; para gestionar se abre la asamblea. Impresión siempre por días y solo publicaciones.

Permisos usa filas de acceso de la asamblea y un bloque separado de Administración general. El formulario sigue Persona → Acciones → Revisar; Consulta y Gestión describen acceso, mientras los cargos permanecen en Equipo. Cada capacidad combina icono, casilla, nombre y explicación breve con detalle desplegable. Antes de guardar se muestran altas y retiradas. Se conserva la identidad al cambiar de modo, el formulario ante errores y la revisión de cambios sin guardar. [Alcance y pruebas](docs/PERMISOS.md).
