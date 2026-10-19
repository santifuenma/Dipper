# Guía de diseño de Dipper

Reglas para que todas las pantallas se vean como una sola app. Antes de añadir algo nuevo, se busca
aquí la pieza que ya existe y se reutiliza (en `public/style.css` y `public/js/components.js`).
Nada de controles con aspecto de iOS ni colores vivos de sistema.

## Colores

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F1EDF9` | Fondo de todas las pantallas |
| `--surface` | `#FFFFFF` | Tarjetas blancas, fichas, botones redondos, campos |
| `--surface-2` | `#FAF8FD` | Franja interior de una tarjeta blanca (categorías de Por revisar) |
| `--ink` | `#1B1B1F` | Texto, iconos, botón oscuro, tarjeta "Tinta" |
| `--muted` | `#5A5470` | Texto secundario: subtítulos, etiquetas de sección, fechas |
| `--faint` | `#8A83A3` | Texto terciario: placeholders, "Apple Pay: …" |
| `--lima` | `#CDF56B` | Acción principal (Confirmar, Guardar, +) e interruptor encendido |
| `--danger` | `#B3261E` | Borrar confirmado y errores. Nunca otro rojo |

Los pasteles (`#FFC93C`, `#FFA8D2`, `#98EBC6`, `#CDB6FF`, `#A9D8FF`, `#FFC2A1`) son solo para
categorías, tarjetas y decoración. Los colores de tarjeta son los seis de `CARD_COLORS`.

## Líneas

Todas de **1,5 px**. Solo tres intensidades:

| Token | Valor | Uso |
|---|---|---|
| `--line` | `rgba(27,27,31,.22)` | Borde normal: tarjetas, fichas, campos, botones redondos |
| `--line-soft` | `rgba(27,27,31,.1)` | Separadores dentro de una tarjeta y recuadros de categoría del Inicio |
| `--line-dash` | `1.5px dashed rgba(27,27,31,.4)` | Punteado: añadir algo, Ajustes, papelera, "Por revisar" |

Excepciones: los puntos de color de 8–10 px llevan `1px solid rgba(27,27,31,.3)`, y los dibujos de
dentro de las tarjetas (chip, círculos) usan `currentColor`. Las tarjetas negras llevan borde `#6A6A74`.

## Esquinas

| Radio | Uso |
|---|---|
| `50%` | Botones redondos, puntos, iconos de categoría |
| `99px` | Fichas, pastillas y botones anchos |
| `16px` | Piezas pequeñas: fichas de tarjeta, campos de una línea, teclado |
| `20px` | Tarjetas de pago y recuadros de categoría |
| `24px` | Tarjetas blancas de contenido (`.card-box`) y filas de Ajustes |
| `28px` | Tarjeta grande de cabecera (detalle de tarjeta o de pago) |

## Botones

- **Ancho** (`.btn`): 56 px de alto, radio 28, letra 18/800. Lima = acción principal, blanco = secundaria,
  oscuro = alternativa fuerte. Todos iguales: no se cambian tamaños con estilos en línea.
- **Redondo** (`.round-btn`): blanco, borde `--line`, icono de 20 px. Dos tamaños:
  - **44 px**: barra superior y acciones de una fila deslizada.
  - **30 px** (`.round-btn.sm`, icono 14 px): junto a un texto, p. ej. el lápiz del nombre del comercio.
- **Variantes del redondo**: `.dash` (borde punteado) para Ajustes y papelera; `.danger` (relleno
  `--danger`) cuando la papelera espera el segundo toque, que mantiene el punteado en rojo claro (`#E8928C`).
- **Excepción**: los botones − / + del Presupuesto (48 y 38 px, fondo `--bg`) son un contador, no acciones.

## Iconos

Un solo juego, en `ICON` (`public/js/dom.js`): trazo `currentColor`, extremos redondeados.
- 20 px con trazo 2,2 para iconos de acción y de lista.
- 22–24 px con trazo 2,6 para navegación: volver, cerrar, +.
- Un icono = un significado. Nunca dos dibujos para lo mismo ni el mismo dibujo para dos cosas.

Todos los iconos de la app están en `ICON`; ninguna pantalla dibuja los suyos. Para otro tamaño se
usa `iconSize(ICON.x, px)`, y el color lo pone el contenedor (`color:`), nunca el icono. Los iconos de
categoría son aparte: son datos que elige el usuario (`categoryIcon` en `public/js/icons.js`).

| Significado | Icono |
|---|---|
| Editar | lápiz con línea interior (`ICON.edit`) |
| Borrar | papelera (`ICON.trash`) |
| Añadir / quitar | + y − (`ICON.plus`, `ICON.minus`) |
| Hecho | check (`ICON.check`) |
| Información / aviso | círculo con i (`ICON.info`) / con ! (`ICON.alert`, pago sin categoría) |
| Volver, mes anterior / mes siguiente | `ICON.back` / `ICON.forward` |
| Ir a otra pantalla (final de fila) | `ICON.chevron` |
| Cerrar | `ICON.close` |
| Ajustes / Presupuesto | engranaje (`ICON.gear`) / reguladores (`ICON.sliders`) |
| Tarjetas / Categorías | tarjeta con banda (`ICON.card`) / cuatro cuadros (`ICON.categories`) |
| Apple Pay / Face ID | móvil con onda (`ICON.applePay`) / marco de cara (`ICON.faceId`) |
| Contraseña / correo / nombre | `ICON.lock` / `ICON.mail` / `ICON.user` |
| Comercio / fecha / días que quedan | tienda (`ICON.store`) / calendario (`ICON.calendar`) / reloj (`ICON.clock`) |
| Borrar una cifra (teclado) | `ICON.keyDelete` |

## Patrones

- **Editar**: en la barra superior de un detalle, botón redondo de 44 con `ICON.edit`. Junto a un texto,
  redondo de 30. En una lista, se desliza la fila a la izquierda (Editar + Borrar).
- **Borrar**: siempre la papelera en botón redondo punteado (`.round-btn.dash`). Primer toque → se rellena
  de `--danger` con el punteado en rojo claro (y, si hay sitio, un aviso "Toca otra vez la papelera para
  borrar…"); segundo toque → borra.
- **Listas** (Ajustes › Tarjetas y Categorías): tocar una fila la abre; deslizarla a la izquierda deja ver
  Editar y Borrar (botones redondos de 44). Las filas que llevan a otra pantalla terminan en `ICON.chevron`.
- **Añadir**: recuadro con borde punteado y `ICON.plus` + texto ("Añadir tarjeta").
- **Interruptor**: pista blanca con borde, encendido en lima.

## Texto

Bricolage Grotesque. Pesos: 800 títulos, importes y botones · 700 etiquetas y fichas · 600 datos
secundarios · 500 párrafos. Tamaños: 12 (notas) · 13 (etiquetas) · 14–15 (secundario) · 16–17 (texto y
nombres) · 18 (botones anchos) · 20 (título de pantalla) · 28 (titular) y los importes grandes de cada
pantalla, que vienen del diseño original.
