# Componentes

Piezas reutilizables de Dipper. Medidas en puntos (px CSS = pt de iOS). Colores y líneas por su
token de [`DISENO.md`](../DISENO.md). La columna **Código** dice dónde vive hoy en la PWA.

## Índice

- [Estructura de pantalla](#estructura-de-pantalla)
- [Botones](#botones)
- [Campos de texto](#campos-de-texto)
- [Fichas](#fichas)
- [Pastillas](#pastillas)
- [Tarjeta de pago](#tarjeta-de-pago)
- [Recuadro con líquido](#recuadro-con-líquido)
- [Cajas y filas](#cajas-y-filas)
- [Listas](#listas)
- [Editor de nombre de comercio](#editor-de-nombre-de-comercio)
- [Indicadores](#indicadores)
- [Hojas y avisos](#hojas-y-avisos)
- [Entrada de datos](#entrada-de-datos)
- [Decoración](#decoración)
- [Animaciones](#animaciones)

---

Etiquetas de sección (13/700 `--muted`): clase `.label`.

## Estructura de pantalla

| Pieza | Especificación | Código |
|---|---|---|
| **Pantalla** | Fondo `--bg`. Márgenes laterales 20. Arriba: zona segura. Abajo: `max(16, zona segura)`. Columna flexible. **Sin scroll** salvo Por revisar, Movimientos y la lista de Presupuesto: lo que no cabe se recorta (ver *Lista de movimientos*). Ancho máximo 480. **Solo vertical**: `orientation: portrait` en el manifiesto y, en horizontal en un móvil (alto ≤ 500), un aviso a pantalla completa "Gira el móvil. Dipper se usa en vertical." (`#rotate`). En Swift: bloquear la orientación a vertical en el proyecto. | `.screen` |
| **Barra superior** | Alto 44. Tres huecos: izquierda (volver/cerrar), título **centrado en la pantalla** (20/800, interletra −0,3) y derecha (botón redondo de 44, pastilla o hueco vacío de 44). | `.topbar`, título `.title` |
| **Botón volver / cerrar** | 44×44 sin fondo, desplazado −12 a la izquierda para alinear el icono. `ICON.back` (22, trazo 2,6) o `ICON.close` (24) en pantallas que suben desde abajo. Vuelve a la pantalla anterior; si no hay, a la indicada. | `.icon-btn` + `data-back` |
| **Navegación** | Avanzar: la nueva entra desde la derecha y la de debajo se desplaza −30 % y se oscurece al 92 %. Volver: al revés. Pantallas *sheet*: suben desde abajo y la de debajo se encoge al 94 %. Entrar o salir de la cuenta: fundido. 420 ms, curva `cubic-bezier(.32,.72,0,1)`. Gesto de volver desde el borde izquierdo (24 px): se completa al pasar el 35 % o con velocidad. | `nav.js` |

## Botones

| Pieza | Especificación | Código |
|---|---|---|
| **Botón ancho** | Ancho completo, alto 56, radio 28, borde `--line`, letra 18/800. Variantes: **lima** (acción principal), **blanco** (secundaria), **oscuro** (`--ink`, texto blanco; "Entrar con Face ID"). Desactivado: fondo `rgba(27,27,31,.08)`, texto al 40 %. Ocupado: opacidad 0,6 y no se puede tocar. Nunca se cambian sus medidas. | `.btn`, `.btn-lima/-white/-dark` |
| **Botón redondo** | 44×44, blanco, borde `--line`, icono 20. **Pequeño** 30×30 con icono 14 (junto a un texto). **Punteado** con borde `--line-dash` (Ajustes y papelera). | `.round-btn`, `.sm`, `.dash` |
| **Papelera con confirmación** | Botón redondo punteado con `ICON.trash`. Primer toque: relleno `--danger`, icono blanco y punteado `#E8928C`, y si hay sitio un aviso en `--danger` ("Toca otra vez la papelera para borrar…"). Segundo toque: borra. | `.round-btn.dash.danger` + `.hint-danger` |
| **Enlace subrayado** | Texto 14–16/800 subrayado, sin fondo ("Olvidé mi contraseña", "Saltar", "Deshacer", "Crear cuenta"). | `.link-u` |
| **Al pulsar** | Todo lo tocable se encoge a 0,96 al pulsar y rebota al soltar (`cubic-bezier(.3,1.6,.5,1)`, 400 ms). | `[data-press]`, `.btn`, `.round-btn` |
| **Botón + flotante** | Círculo lima de 64 (o 7,6 % del alto de pantalla si es menor), borde `--line`, `ICON.plus` a 28. Abre Nuevo gasto. | Inicio |

## Campos de texto

| Pieza | Especificación | Código |
|---|---|---|
| **Campo con icono** | Alto 54, radio 16, blanco, borde `--line`. Icono de 20 en `--muted` a la izquierda, texto 17/600, placeholder en `--faint`. Con el foco: contorno de 2 en `--ink`. Variante con botón "Mostrar/Ocultar" a la derecha para contraseñas. | `.field`, `.field.has-btn` |
| **Campo con etiqueta** | Etiqueta 13/700 `--muted` encima (margen 6), campo de 48 de alto, radio 16, y opcionalmente una ayuda debajo (13/500 `--muted`). Usado en los formularios de tarjeta y categoría. | `.label` + `.input` |

## Fichas

| Pieza | Especificación | Código |
|---|---|---|
| **Ficha** | Pastilla de 38 de alto, radio 99, padding 0 14, letra 14/700, blanca con borde `--line`. **Elegida**: borde `--ink`, sube 2 y se rellena del color que toque (categoría o lima). **Sugerida**: borde punteado `--line-dash`. | `.chip`, `.on`, `.sug` |
| **Rejilla de fichas** | Dos columnas iguales con hueco 8; el texto que no cabe se corta con "…". Para elegir categoría en Por revisar y Pago. | `.chips-fill` |
| **Ficha de comercio** | Ficha con un punto de 8 del color de la categoría del comercio a la izquierda. Elegida: fondo del color de la categoría y punto en `--ink`. | `merchantEditor` |
| **Ficha de categoría con icono** | 44 de alto, padding 0 14 0 12, icono de categoría 20 + nombre 15/700. En una fila que se desliza en horizontal. Elegida: fondo del color de la categoría, borde `--ink`, sube 2. | Nuevo gasto |
| **Ficha de tarjeta** | 128×56, radio 16, borde `--line` (o `#6A6A74` si es negra), fondo del color de la tarjeta. Nombre 15/800 y "···· 1234" 12/600 con interletra 1,2. No elegida: opacidad 0,55. Elegida: anillo de 2 en `--bg` + 2 en `--ink` y sube 2. Opcionalmente termina con **Efectivo / Otros** (blanca). Fila con deslizamiento horizontal. En Pago, la tarjeta usada va la primera. | `cardChips()` |

## Pastillas

Etiquetas redondeadas (radio 99) que informan o cambian de estado. No son fichas para elegir.

| Uso | Especificación |
|---|---|
| Mes (Movimientos, Presupuesto) | 13/700, padding 7 12, blanca con borde `--line` (`.pill`) |
| Gasto de la tarjeta (abanico del Inicio) | 15/800, padding 4 10, blanca; en el abanico plegado solo la de delante |
| Pasado de presupuesto (recuadro de categoría) | 12/800, fondo `--ink`, texto `#FFC2A1`: "+23 €" |
| "quedan X €" (detalle de categoría) | 14/700, fondo `--ink`, texto blanco |
| Activar / Activado (Face ID en Ajustes) | 13/800, padding 5 11, borde `--line`; blanca o lima |
| Sin asignar / Todo asignado / Te pasas (Presupuesto) | 15/800, padding 5 14; blanca, lima o `#FFC2A1` |
| Apple Pay activo (detalle de tarjeta) | 13/700, blanca, con `ICON.check` 14 |
| Fecha: Hoy / Ayer / Otra fecha (Nuevo gasto) | Alto 40, 14/700. Elegida: fondo `--ink` y texto blanco. "Otra fecha" abre el selector de fecha del sistema y muestra la elegida |

## Tarjeta de pago

Dibujo común: fondo del color de la tarjeta (uno de los 6 de `CARD_COLORS`), texto en su color de
contraste, borde `--line` (negra: `#6A6A74`). Arriba: nombre + dos círculos solapados (uno hueco y
otro relleno, en el color del texto). Abajo: un chip (rectángulo hueco) y "···· 1234".

| Tamaño | Especificación | Código |
|---|---|---|
| **Abanico (Inicio)** | 204 de ancho, alto `min(120, 14 % de pantalla)`, radio 20, padding 14. Nombre 17/800, círculos 18, chip 26×19, dígitos 14/600. Pastilla de gasto abajo a la derecha. | `inicio.js` |
| **Grande (detalle y formulario)** | Ancho completo, alto 164 (`min(164, 16 %)` en el formulario), radio 28, padding 16 18. Dos círculos decorativos de luz (blanco al 22–28 %) y sombra (tinta al 7–8 %). Nombre 24–26/800, círculos 24, chip 36×26, dígitos 24/700 con interletra 3. Al abrir el detalle entra con rebote y un giro de −3°. | `ver-tarjeta.js`, `tarjeta-form.js` |

**Comportamiento del abanico:** plegadas, la de más gasto del mes va a la izquierda y delante y las
demás asoman por la derecha repartidas hasta el borde (mínimo 26 cada una), con sombra
`6px 0 12px rgba(27,27,31,.14)`. El primer toque las despliega en una fila deslizable (hueco 12, se
encajan de una en una); desplegadas, tocar una abre su detalle; tocar fuera las pliega. La animación
es escalonada (35 ms por tarjeta, 600 ms, curva con rebote). Sin tarjetas: hueco punteado "Añadir tu
primera tarjeta".

## Recuadro con líquido

Recuadro blanco que se **llena desde abajo con el color de la categoría** según lo gastado frente al
presupuesto (tope 100 %), con una ola en el borde superior del líquido que se mueve en horizontal.
El líquido sube al aparecer (900 ms).

| Uso | Especificación | Código |
|---|---|---|
| **Categoría del Inicio** | Rejilla de 2 columnas, hueco 8, padding 8 10, filas de mínimo 84 que reparten el alto libre. Radio 20, borde `--line-soft`. Arriba a la izquierda el icono de categoría (18, tinta) dentro de un círculo de 32 de su color (así tiene color aunque esté vacía) y a la derecha la pastilla "+X €" si se pasa; abajo, nombre 15/700, importe 25/800 y "de 380" 13/600 en `--muted`. Si se pasa: pastilla "+X €" y el recuadro tiembla cada 7 s. El líquido marca exactamente lo gastado. Sin gasto, la ola queda en la franja de debajo del importe. | `inicio.js` |
| **Cabecera de categoría** | Ancho completo, alto 164, radio 28. Icono 34, importe 64/800 + "€" 30/700, "de 380 € este mes" 16/700, pastilla "quedan X €". | `ver-categoria.js` |
| **Vista previa de categoría** | Como la cabecera, alto `min(164, 16 %)`, líquido al 62 % fijo; nombre 30/800 (o "Nombre" al 45 % si está vacío). | `categoria-form.js` |
| **Su parte de cada categoría** | 112×96, radio 20, en fila deslizable. Nombre 13/700 e importe 22/800. Líquido = gasto con esa tarjeta frente al presupuesto. | `ver-tarjeta.js` |

## Cajas y filas

| Pieza | Especificación | Código |
|---|---|---|
| **Caja** | Blanca, borde `--line`, radio 24. Base de filas, tarjetas de contenido y paneles. | `.card-box` |
| **Fila de Ajustes** | Caja con padding 10 12: círculo de 40 del color del apartado con icono de 20, título 16/700, subtítulo 13/500 `--muted`, y al final `ICON.chevron` o una pastilla. | `ajustes.js`, círculo `.ic-circle` |
| **Caja de cuenta** | Caja con radio 28: tres bolitas de color + nombre 22/800 y correo 14/500. | `ajustes.js` |
| **Fila de categoría (Ajustes)** | Caja: círculo de 40 con el icono de la categoría, nombre 16/700, `ICON.chevron`. | `categorias.js` |
| **Fila de categoría (Presupuesto)** | Caja con padding 8 10 8 12: círculo de 38 con icono, nombre 16/700, "gastado X €" 13/500 (en `--danger` y 700 si se pasa), contador − importe + (ver *Contador*). | `presupuesto.js` |
| **Hoja de importe** | Hoja con título (y círculo de la categoría), *Importe grande* "al mes" vacío, *Teclado numérico* sin decimales (máx. 6 cifras) y **Listo**. Lo escrito sustituye al importe; sin escribir no cambia nada. | `askAmount()` |
| **Fila de presupuesto** | La *Fila de categoría (Presupuesto)*; sin `spent` (bienvenida) no enseña "gastado". | `budgetRow()` |
| **Guía de globos** | Capa que oscurece la pantalla salvo el elemento señalado (anillo blanco) y un globo (caja de radio 20) con título 19/800, texto 14/500, puntos de progreso, **Saltar** y pastilla lima **Siguiente / Entendido**. El globo va debajo del elemento si está en la mitad de arriba, si no encima. | `guidedTour()` |
| **Pasos del atajo** | Los 3 *pasos numerados* de Conectar Apple Pay (copiar enlace con el enlace enmascarado `dpr_xxxx••••••xxx`, abrir Atajos, hecho); lo hecho se recuerda en el dispositivo. Lo usan la pantalla Conectar Apple Pay y la Bienvenida. | `applePaySteps()` |
| **Paso numerado** | Caja: círculo de 34 con el número sobre un pastel (hecho: `--ink` con `ICON.check`), título 17/800, texto 14/500, y debajo un botón-pastilla de 38 (blanco; hecho: lima). Opcionalmente un recuadro punteado con el enlace enmascarado. | `applepay.js` |

## Listas

| Pieza | Especificación | Código |
|---|---|---|
| **Lista de movimientos** | Agrupada por día: título del grupo 13/700 `--muted` ("Hoy", "Ayer", "Lun 12 oct") y una caja de radio 20 con las filas separadas por una línea de 1 px al 8 %. Fila: padding 10 14. Modo **categoría**: círculo de 40 del color de la categoría con su icono (sin categoría: círculo punteado con `ICON.alert`) y "Categoría · 18:42". Modo **tarjeta**: punto de 10 del color de la tarjeta y "18:42 · ···· 1234". Comercio 16/700 cortado con "…", importe 17/800. Si el pago tiene concepto, va bajo el comercio (13/600 `--ink`). Modo **historial**: como categoría, agrupado por el día de registro, con "Categoría · tarjeta · hora" y, si el pago es de otro día, "Pago del …". Tocar → Pago. | `movementGroups()` |
| **Recorte sin scroll** | En pantallas sin scroll, se quitan filas del final hasta que todo cabe (mínimo una) y se ofrece "Ver todos los movimientos" (botón ancho blanco). | `fitMovements()`, `seeAllLink()` |
| **Fila deslizable** | Deslizar a la izquierda aparta la fila 110 y deja ver dos botones redondos de 44: Editar (`ICON.edit`) y Borrar (papelera con confirmación). Se queda abierta si se pasa de la mitad; más allá tira con resistencia (÷3). Abrir una fila cierra las demás; tocar la fila abierta o fuera la cierra. Al borrar, la fila se va a la izquierda y la lista se cierra hacia arriba (350 ms). El gesto vertical sigue siendo scroll. | `swipeRow()` |
| **Cuadrícula ordenable** | Mantener pulsada una pieza 350 ms (sin moverla más de 8) la levanta: escala 1,05 y sombra `0 14px 30px rgba(27,27,31,.18)`. Al arrastrarla, la pieza va al hueco más cercano y las demás se deslizan a su sitio nuevo con rebote (420 ms, `cubic-bezier(.3,1.35,.5,1)`), como los iconos del iPhone. Al soltar encaja con el mismo rebote y se guarda el orden. Un toque normal abre la pieza; soltar tras arrastrar no. Sin menú de enlace al mantener pulsado. | `makeReorderable()` |

## Editor de nombre de comercio

| Pieza | Especificación | Código |
|---|---|---|
| **Lápiz del comercio** | Botón redondo pequeño (30) con `ICON.edit` junto al nombre. | `penButton()` |
| **Línea de Apple Pay** | "Apple Pay: CONSUM SDAD COOP 1234" en 12/600 `--faint`, debajo del nombre, siempre que el pago venga de Apple Pay. | `rawLine()` |
| **Editor** | Campo con "Listo" (alto 50), la línea de Apple Pay, una nota opcional ("Se cambia en todos los pagos de este comercio.") y la etiqueta "Tus comercios" con fichas de comercio. Hasta escribir se ven las más usadas; al escribir, las que contienen el texto (sin distinguir acentos ni mayúsculas). Tocar una ficha pone su nombre y propone su categoría. En pantallas sin scroll se quitan fichas hasta que cabe. Al abrir, el texto queda seleccionado. | `merchantEditor()` |

## Indicadores

| Pieza | Especificación | Código |
|---|---|---|
| **Barra de 20 segmentos** | 20 segmentos iguales de alto 14, hueco 3, radio 4. Encendidos en `--ink` (o `#FF6B4A` si se supera, en Presupuesto), apagados al 14 %. Encendidos = gastado (o asignado) ÷ presupuesto × 20. | Inicio, Presupuesto |
| **Fuerza de contraseña** | 4 segmentos de alto 8 y un texto 13/600 `--muted`. Puntos: ≥ 8 caracteres, un número, una mayúscula, ≥ 12 caracteres. Colores por nivel: `#FF6B4A`, `#FFC93C`, `#98EBC6`, `#CDF56B`. | `registro.js` |
| **Interruptor** | Pista de 44×26 con borde `--line`, bolita de 18 en `--ink` que salta con rebote. Encendido: pista lima. Texto 14/700 a la derecha. | Por revisar |
| **Contador ± (Presupuesto)** | Botones redondos con fondo `--bg`: 48 para el total (paso 50 €) y 38 para cada categoría (paso 10 €), con − y + de trazo 2,6. Importe en el centro. Nunca baja de 0. **Tocar el importe** abre la *hoja de importe*: título (con el icono de la categoría si es una), importe grande "al mes" vacío, teclado sin decimales y **Listo**; lo escrito sustituye al importe y sin escribir nada no cambia. | `presupuesto.js` |

## Hojas y avisos

| Pieza | Especificación | Código |
|---|---|---|
| **Hoja inferior** | Fondo oscurecido al 35 %. Hoja blanca con margen 8 a los lados y abajo, radio 30 arriba y 48 abajo (concéntrico con la pantalla del iPhone), padding 26 22. Sube con curva (500 ms). Título 28/800, texto 16/500 `--muted`, botones anchos. Tocar fuera la cierra cuando la hoja es informativa. | `.sheet-bg`, `.sheet` |
| **Recuadro de aviso** | Borde punteado `--line-dash`, radio 16–20, padding 12 14, icono de 20–22 a la izquierda y texto 14–16/600. | Apple Pay, detalle de categoría |
| **Nota vacía** | Recuadro punteado, radio 20, padding 16, texto 15/600 `--muted` centrado ("Todavía no hay pagos…"). | `emptyNote()` |
| **Error** | Texto 14/700 en `--danger`; ocupa sitio solo si hay mensaje. | `.error` |
| **Tarjeta resuelta** | Tras confirmar un pago: franja del color de la categoría, radio 24, círculo `--ink` de 34 con check blanco, "Comercio → Categoría · recordado" 16/700 y "Deshacer". Entra con rebote. | Por revisar |
| **Todo al día** | Caja de 120 con radio 40 y tres bolitas que se mueven, "Todo al día" 28/800, texto y botón "Volver al inicio". | Por revisar |

## Entrada de datos

| Pieza | Especificación | Código |
|---|---|---|
| **Importe grande** | "importe" 14/600 `--muted`, número `min(72, 8,6 %)`/800 con interletra −3 (gris al 28 % si está vacío), cursor parpadeante de 4 de ancho y "€" 34/700. | `bigAmount(etiqueta)`: Nuevo gasto y hoja de Presupuesto |
| **Teclado numérico** | Rejilla 3×4 con hueco 8 que ocupa el alto libre (mínimo 150): 1–9, coma, 0 y borrar. Teclas blancas, radio 16, borde `--line`, 22/700. Máximo 7 caracteres y 2 decimales; un solo separador. **Sin decimales** (Presupuesto): sin coma, el hueco queda vacío, y máximo 6 cifras. | `keypad({ decimals, maxLength })`: Nuevo gasto y hoja de Presupuesto |
| **Selectores de icono y color** | Círculos de 44 en fila con salto de línea, hueco 10. Elegido: escala 1,1 y anillo de 3 en `--bg` + 2 en `--ink`. Los colores de tarjeta son los 6 de `CARD_COLORS`; los de categoría, los 6 de `CATEGORY_COLORS`. | Formularios |

## Decoración

| Pieza | Especificación |
|---|---|
| **Bolitas** | Tres círculos solapados (−8) amarillo `#FFC93C`, rosa `#FFA8D2` y menta `#98EBC6` (en el Inicio, lila `#CDB6FF` en el centro), con anillo del color de fondo, que suben y bajan 3 de forma desfasada (1,6 s). Señal de "Dipper" en la cuenta, el registro y las pantallas de éxito. Componente `dots(tamaño)`. |
| **Olas de Entrar** | Cuatro capas de color (lila, rosa, menta, lima) que ocupan la mitad inferior, cada una con borde de semicírculos, que se mecen y se desplazan a distinto ritmo. |
| **Borde ondulado** | Semicírculos de radio 9 cada 22, el mismo patrón en las olas, el líquido de las categorías y el icono de la app. |

## Animaciones

| Nombre | Qué hace | Dónde |
|---|---|---|
| Pulsar | Escala 0,96 y rebote al soltar | Todo lo tocable |
| `stick` | Entra desde 0,9 y −10 con rebote (600 ms) | Tarjeta resuelta, Todo al día |
| `plop` / `pop` | Aparece desde 0,4 con rebote | Check de Nuevo gasto, check de un paso |
| `card-in` | Sube 40 y gira −3° al entrar (700 ms) | Tarjeta grande del detalle |
| `wob` | Tiembla ±1,2° cada 7 s | Categoría pasada de presupuesto |
| `rise` + `drift` | El líquido sube y su ola se desplaza | Recuadros con líquido |
| `wig` | Las bolitas suben y bajan | Decoración |
| `blink` | Parpadeo del cursor | Importe de Nuevo gasto |

Con "Reducir movimiento" activado en iOS, no hay animaciones.
