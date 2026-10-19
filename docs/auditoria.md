# Auditoría para la migración a Swift

Revisión del código (19-10-2026) de lo que conviene ordenar para que pasar a Swift sea seguir el
plano. Cada punto dice **qué**, **por qué importa** y **cuándo** hacerlo:

- **Antes**: en la PWA, porque también beneficia a la app nativa (normalmente, en el servidor).
- **Al migrar**: no merece la pena tocarlo en la PWA; se resuelve directamente en Swift.
- **Decidir**: hace falta una decisión del usuario.

Al resolver un punto, se marca ✅ con la fecha.

## 1. Lógica que vive en la pantalla ✅ 19-10-2026

Hecho: `GET /api/month` devuelve el total, lo que queda, los días que faltan, el gasto y el reparto
por tarjeta y por categoría y "lo que toca al día", y filtra por tarjeta o categoría (ver
[`flujos.md`](flujos.md#mes-y-presupuesto)). Las pantallas solo ponen esas cifras en su texto.

| Qué queda | Dónde | Cuándo |
|---|---|---|
| Fuerza de la contraseña | `registro.js` | Al migrar (es solo una ayuda visual) |
| Cuántos segmentos se encienden y la altura del líquido (proporciones para dibujar) | Inicio, Presupuesto, recuadros | Al migrar: es dibujo, no regla |

**Por qué importa:** cada cálculo que se queda en la pantalla habría que reescribirlo en Swift y
mantener los dos iguales. En el servidor se escribe una vez.

## 2. Iconos fuera del juego único ✅ 19-10-2026

Hecho: los 24 iconos de la app están en `ICON` (`public/js/dom.js`) con trazo `currentColor`, y la
tabla de [`DISENO.md`](../DISENO.md#iconos) es la lista completa para Swift. Los que estaban sueltos eran:

| Icono | Dónde |
|---|---|
| Engranaje, reguladores (Presupuesto) y flechas del mes | `inicio.js` |
| Reloj | `ver-categoria.js` |
| Borrar tecla, calendario, tienda, check grande | `nuevo-gasto.js` |
| Check del paso hecho | `applepay.js` |
| Categorías, candado (repetido) y Face ID de las filas | `ajustes.js` |

**Cuándo: Antes.** Pasarlos a `ICON` deja la lista completa de iconos que hay que dibujar (o elegir
como SF Symbols) en Swift.

## 3. Colores fuera de la guía

| Color | Dónde | Cuándo |
|---|---|---|
| `#FF6B4A` (tomate) para "te pasas" en la barra de Presupuesto y en la fuerza de contraseña | `presupuesto.js`, `registro.js` | **Decidir**: ¿pasa a ser un token de aviso, o se usa `--danger`? |
| `#FFC2A1` como texto de la pastilla "+X €" sobre tinta | `inicio.js` | Antes: darle nombre en `DISENO.md` |
| Colores escritos a mano (`#5A5470`, `#1B1B1F`, `#F1EDF9`) en lugar de su token | Casi todas las pantallas | Al migrar: en Swift solo existirán los tokens |

## 4. Estilos repetidos ✅ 19-10-2026

Hecho: los patrones de la tabla son ahora clases (`.title`, `.label`, `.pill`, `.ic-circle`, `.input`)
y un componente (`dots()`). Se comprobó que el estilo calculado de cada elemento de 15 pantallas es
idéntico antes y después. Quedan estilos escritos en línea que son propios de una sola pantalla;
no se repiten, así que no hace falta sacarlos antes de migrar. Los patrones eran:

| Patrón | Veces | Propuesta |
|---|---|---|
| Título de la barra (20/800, interletra −0,3) | En cada pantalla | Clase `.title` |
| Etiqueta de sección (13/700 `--muted`) | Más de 10, con tres formas distintas | Clase `.label` |
| Pastilla del mes | Movimientos y Presupuesto | Componente |
| Tres bolitas de color | 5 sitios con el mismo HTML | Componente |
| Campo con etiqueta de los formularios | 4 campos copiados | Componente |
| Círculo de color con icono (40/38) | Ajustes, Categorías, Presupuesto, movimientos | Componente |

**Cuándo: Antes**, por partes y sin cambiar el aspecto. Así cada pieza aparece una vez en
[`componentes.md`](componentes.md) con su equivalente en SwiftUI.

## 5. Nombres de archivo ✅ 19-10-2026

Hecho: cada archivo de `public/js/views/` se llama como su pantalla, y la ruta del Pago pasa a
`#/pago`. Las piezas comunes de las dos listas de Ajustes (`listScreen`, `swipeList`) están en
`components.js`. Era así:

| Archivo | Contiene | Propuesta |
|---|---|---|
| `views/listas-provisionales.js` | Ajustes › Tarjetas y Categorías (ya no son provisionales) | `views/tarjetas.js` y `views/categorias.js` |
| `views/home.js` | Ajustes | `views/ajustes.js` |
| `views/movimiento.js` | Pago | `views/pago.js` |
| `views/pendientes.js` | Por revisar | `views/por-revisar.js` |

**Cuándo: Antes** (cambio pequeño): que el nombre de cada archivo sea el de la pantalla en
[`pantallas.md`](pantallas.md).

## 6. Textos desfasados

| Qué | Dónde | Cuándo |
|---|---|---|
| El paso 3 de Conectar Apple Pay explica "Obtener contenido de URL…", pero la configuración real usa la cola en iCloud y el atajo DIPPER SEND | `applepay.js` | **Decidir**: corregirlo ya o esperar a la app nativa, donde la pantalla cambia entera |
| `npm run icons` genera el icono antiguo con el lila `#F0EAFF` | `scripts/make-icons.mjs` | Cuando se elija el icono nuevo (en pausa) |
| "Acepto los términos y la privacidad" no enlaza a ningún texto | `registro.js` | Antes de publicar: hace falta la política de privacidad |

## 7. Lo que exige el App Store

| Qué | Estado | Cuándo |
|---|---|---|
| Varias cuentas (registro abierto) | ✅ 19-10-2026: con `REGISTRO_ABIERTO = "si"`; abierto en pruebas, cerrado en la app real | **Decidir** cuándo abrirlo en la real |
| Borrar la cuenta desde la app | ✅ 19-10-2026: en el servidor y en Ajustes | — |
| Sesión por token (además de cookie) | ✅ 19-10-2026 | — |
| Política de privacidad | No existe | Antes de publicar |
| Face ID nativo | Passkeys web | Al migrar: `LocalAuthentication` sobre el token guardado |
| Acción de Atajos (App Intent) | ✅ 19-10-2026: `POST /api/pagos` con sesión listo en el servidor | La acción en sí, al migrar |
| Icono de la app | En pausa | **Decidir** |

## 8. Pruebas ✅ 19-10-2026

Hecho: `npm test` con 33 pruebas (ver [README](../README.md#pruebas)). Antes no había pruebas automáticas. Las reglas de [`flujos.md`](flujos.md) que viven en el servidor
(importes, huella de repetidos, normalización de comercios, tarjetas iguales, recordar y deshacer)
son las que más conviene cubrir **antes** de migrar: así, al cambiar la API para la app nativa se
sabe que nada se ha roto.
