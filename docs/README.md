# Especificación de Dipper

Plano de la app por piezas, sacado del código actual (la PWA de `public/`). Sirve para dos cosas:

1. **Mantener el orden** mientras la PWA sigue creciendo: cada pantalla o comportamiento nuevo se
   añade aquí en el mismo cambio.
2. **Pasar a Swift/SwiftUI** construyendo a partir de este plano, sin tener que leer el JavaScript.

| Documento | Qué contiene |
|---|---|
| [`../DISENO.md`](../DISENO.md) | Guía visual: colores, líneas, esquinas, botones, iconos, texto |
| [`componentes.md`](componentes.md) | Cada pieza reutilizable con sus medidas, estados y dónde se usa |
| [`pantallas.md`](pantallas.md) | Las 17 pantallas: contenido, estados, acciones y llamadas a la API |
| [`flujos.md`](flujos.md) | Los recorridos completos y las reglas de negocio que los gobiernan |
| [`auditoria.md`](auditoria.md) | Lo que hay que ordenar o decidir antes y durante la migración |
| [`../README.md#api`](../README.md#api) | Rutas de la API del servidor |

## Qué se conserva y qué se rehace

| Parte | Al pasar a Swift |
|---|---|
| Servidor (`src/`, Cloudflare Worker) | **Se conserva.** La app nativa llama a la misma API |
| Base de datos (`migrations/`, D1) | **Se conserva** |
| Reglas de negocio del servidor (recordar comercio, tarjetas iguales, huella de pagos…) | **Se conservan** |
| Diseño (`DISENO.md`) | **Se traslada** a un tema de SwiftUI |
| Pantallas y componentes (`public/`) | **Se rehacen** en SwiftUI siguiendo estos documentos |

## Equivalencias con SwiftUI

| En la PWA | En SwiftUI |
|---|---|
| Tokens de `style.css` (`--bg`, `--ink`, `--line`…) | `extension Color` y `extension ShapeStyle` en un archivo `Theme.swift` |
| `.btn` (lima, blanco, oscuro) | `ButtonStyle` propio: `WideButtonStyle(.lima / .white / .dark)` |
| `.round-btn` (`.sm`, `.dash`, `.danger`) | `RoundButton(size:, dashed:, danger:)` |
| `.chip`, `.chips-fill` | Vista `Chip` y `LazyVGrid` de 2 columnas |
| `ICON` (`public/js/dom.js`) | Un `enum Icon` con un `Shape` o SF Symbol por significado |
| Pantalla + `.topbar` | `NavigationStack` con barra propia (título centrado, botones de 44) |
| Transiciones de `nav.js` y gesto de volver desde el borde | Las de `NavigationStack` (iOS ya las hace así) |
| Pantalla *sheet* (Nuevo gasto) y `.sheet` (Face ID) | `.fullScreenCover` / `.sheet` con `presentationDetents` |
| `swipeRow` | `.swipeActions` de `List` con botones dibujados como los de la guía |
| Animaciones (`stick`, `plop`, `wob`, `fill`…) | `withAnimation(.spring(...))` y `TimelineView` para las olas |
| `api()` con cookie | `URLSession` con token en el llavero (Keychain) |
| Passkeys para Face ID | `LocalAuthentication` para desbloquear el token guardado |
| Automatización de Atajos con cola en iCloud | **App Intent** "Registrar pago en Dipper" (ver `flujos.md`) |

## Cómo mantener estos documentos

- Una pantalla nueva → entrada nueva en `pantallas.md` (misma plantilla que las demás).
- Una pieza que se usa en más de un sitio → `componentes.md`, y reutilizarla en vez de copiarla.
- Una regla nueva (qué pasa cuando…) → `flujos.md`, y preferiblemente programada en el servidor.
- Algo que queda a medias o desordenado → `auditoria.md`.
