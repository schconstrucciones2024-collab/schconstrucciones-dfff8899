# SCH Construcciones · versión Premium

Mismo proyecto de Lovable (TanStack Start + React 19 + Tailwind 4), con identidad visual rediseñada y **todas las fotos incluidas dentro del proyecto**: al cargar este código en Lovable ya no hace falta volver a subir imágenes.

## Cómo correrlo

Requisitos: Node 20 o superior y [Bun](https://bun.sh) (el proyecto trae `bun.lock`). Con npm también funciona, pero ignora `bun.lock` y resuelve las versiones de nuevo.

```sh
bun install          # instala según bun.lock
bun run dev          # desarrollo
bun run build        # build de producción
bun run test         # tests (vitest)
```

## Qué cambió

- **Identidad**: paleta carbón `#171817`, grafito `#292C2B` (ajustado apenas, `#262A29`, para que el texto bronce sobre él cumpla contraste AA), piedra `#777A76`, cemento `#D9D8D2`, blanco cálido `#F7F6F2`, madera `#967653` y bronce `#A88B63` como acento. Todo vive en `src/styles.css` (variables oklch).
- **Texturas**: hormigón sutil como mosaico procedural (`public/images/hormigon-sobre-claro.webp`, `hormigon-sobre-oscuro.webp`, ~40 KB cada uno). La madera aparece en los tonos de color y en el visor 3D.
- **Hero ("stopper scroll")**: foto real de la obra *Lo de Cata* (Punta del Diablo, con piscina), recortada sin el título del afiche, con recorte propio para celular. Lo primero que se lee, de un vistazo: **+40 años de experiencia en el rubro** (la cifra cuenta de 0 a 40), "Familia de constructores. Obras en todo Uruguay. Hogares a tu medida.", y dos columnas **Ayer** (obras de gran porte: edificios, complejos habitacionales y centros hospitalarios) y **Hoy** (cabañas y viviendas en woodframe y tradicional, reformas, ampliaciones y mobiliario a medida), más los dos botones. La firma "Construir confianza. Edificar futuro." quedó como línea final. Todos los datos son los que la empresa declaró; no se agregó ninguna cifra nueva.
- **Nosotros**: ya no repite la experiencia ni el "40+" (están en el hero). Cuenta el camino de la familia en una línea de tiempo (2014: se instalan a vivir en Punta del Diablo · 2015: empiezan a construir en el pueblo · Hoy), con la línea que se dibuja al bajar.
- **Costa de Punta del Diablo**: reemplaza a la foto de detalle "Ampliación en proceso, 2023". Se ve **completa, a todo el ancho y sin recortar** (`public/images/costa-punta-del-diablo.webp`, 2334 × 987 px, y una versión de 1200 px). Es una imagen ilustrada (lleva un cartel con los logos de SCH Design y SCH Construcciones), por eso el epígrafe dice "Ilustración"; si querés otro texto, está en `CoastBand` (`src/components/home/About.tsx`).
- **Secciones nuevas o rediseñadas**: header con menú desplegable de servicios y menú móvil, nosotros, servicios, pilares, obras (grilla editorial 4:5 + visor de galería con teclado, deslizar y miniaturas), proceso, redes, contacto, pie de página y botón flotante de WhatsApp. Las páginas de servicio (`/woodframe`, `/construccion-tradicional`, `/mobiliario`) usan el mismo header y pie.
- **Conservado tal cual**: textos, nombres, años y descripciones de las 12 obras, cotizador, funciones del configurador 3D (lo que cambió es el aspecto de sus materiales, ver más abajo), preguntas frecuentes, rutas, datos de contacto y el armado del mensaje de WhatsApp.
- **Movimiento** (`src/lib/motion.tsx` y `src/styles.css`): solo `transform` y `opacity`, sin librerías nuevas. Respeta `prefers-reduced-motion` (con esa opción el contador muestra el valor final y se apagan todos los efectos) y, si el JavaScript falla, el contenido queda visible. Efectos: titulares que suben palabra por palabra, contador animado, barra de avance de lectura arriba de todo, el contenido del hero se aleja y se atenúa al bajar, luz suave que sigue al mouse en el hero (solo escritorio), botones que se acercan al puntero y con brillo al pasar, afiches de obras que se inclinan hacia el mouse, subrayado animado en el menú, líneas de progreso en Nosotros y en Proceso, y zoom suave de la costa al aparecer. Los efectos de puntero solo se activan con mouse, no en pantallas táctiles.
- **Accesibilidad / SEO**: `lang="es"`, enlace "Saltar al contenido", un solo `h1`, foco visible, anclas que no quedan tapadas por el header, etiquetas y validación en el formulario, títulos y metadatos por página, `canonical`, `og:image`, JSON-LD con redes (`sameAs`), 404 y pantalla de error en español.
- **Colores de componentes existentes**: el verde de WhatsApp (`--whatsapp`) pasó a bronce y el azul de la categoría *Moderna* del cotizador (`--sch-blue`) a gris piedra, para respetar la paleta.

## Visor 3D: texturas

Los 14 materiales del visor (chapones, drywall, machimbre, lambriz, piso de pino, tres siding, hormigón, madera curada, arena, pasto, chapa y mesada) pasaron de un dibujo simple a **mapas PBR completos**: color, relieve (normal) y rugosidad + oclusión.

- **Dónde están**: `public/textures/<material>/` (`albedo`, `normal`, `orm`; cada uno en `.webp` de 1024 px y `-512.webp` para celulares). Pesan unos 14 MB en total, pero el visor descarga solo los materiales que la casa usa.
- **Cómo se cargan** (`src/components/configurator/pbr.ts`): al abrir el visor se muestra una muestra provisoria dibujada en el navegador y, en cuanto se descargan, pasa sola a la textura real. Cada material se descarga una vez aunque lo usen varias piezas, y se libera de la memoria de video cuando nadie lo usa. Si la descarga falla queda la provisoria.
- **Qué muestran**: madera con anillos, nudos, poros, juntas y bordes biselados; siding con solape y sombra bajo cada tabla; hormigón con poros y grano; arena con ondulaciones y conchillas; pasto de hojas sueltas; chapa acanalada; mesada tipo cuarzo.
- **Terreno**: ahora se repiten todos los mapas (antes solo el color, y el relieve no seguía la escala). Las matas de pasto usan color por vértice.
- **Luz**: sombras de 2048 px (escritorio) y entorno de 256 px.
- **Límites**: son texturas **generadas por código**, no fotografías escaneadas; en un acercamiento extremo no igualan un material fotografiado. Se revisaron en una vista previa 2D con iluminación simulada y se comprobó que los archivos cargan en un navegador, pero el visor 3D real (Three.js) no se pudo ejecutar en el entorno donde se preparó: **conviene abrirlo y mirar los materiales de cerca** antes de publicar.
- **Regenerar o ajustar**: `tools/texturas/` (ver su `LEEME.md`).

## Visor 3D: capturas 4K y grabación del recorrido

Botones abajo a la derecha del visor (`src/components/configurator/Viewer3D.tsx`; lógica en `src/lib/mediaCapture.ts` y `src/components/configurator/tour.ts`):

- **Capturar imagen 4K** (cámara con la etiqueta "4K"): guarda un PNG con el lado mayor de **3840 px** (con un visor 16:9 son 3840 × 2160) y la **marca de agua con el logo de SCH** abajo a la derecha. Mantiene el encuadre que ves. El nombre lleva la resolución real, por ejemplo `SCH-mi-cabana-3840x2160.png`. Si el dispositivo no admite 4K (límite de la placa de video o de memoria, típico en celulares viejos) baja a 2560 o 1920 px y **avisa en pantalla** cuál logró; nunca dice "4K" si no lo fue.
- **Grabar recorrido** (cámara de video): arranca el recorrido automático (vuelta exterior de 9 s + barrido por el interior de 6 s) y **se detiene solo al terminar**, descargando el video con la marca de agua y un contador REC mientras graba. Se puede detener antes con el botón cuadrado, o tomar el control del modelo con el mouse o el dedo (en ese caso sigue grabando hasta que lo detengas; el máximo es de 3 minutos). Con la opción de sistema "reducir movimiento" no hay recorrido automático: graba tu navegación hasta que toques Detener.
- **Formato**: MP4 (H.264) si el navegador puede grabarlo, para compartirlo directo por WhatsApp; si no, WebM. Full HD de lado mayor (1280 px en celulares). El nombre lleva la resolución, por ejemplo `SCH-recorrido-cabana-1280x720.mp4`.
- **Qué se probó y qué no**: las funciones de captura y grabación y los botones se probaron en un Chromium real (con un renderer de prueba en lugar de Three.js): salió un PNG de 3840 × 2160 con el logo, y un MP4 reproducible con el logo, con el recorrido completo y la detención automática. **No se pudo ejecutar el visor 3D real (Three.js)**, así que falta mirar con tus propios ojos que la captura 4K y el video muestren bien la casa; **abrilo, sacá una captura y grabá un recorrido antes de publicar**. Dos límites conocidos: en la prueba el video salió a unos 15 cuadros por segundo porque el entorno de prueba tiene CPU lenta (en una computadora o celular con placa de video debería rondar los 30, pero no lo medimos), y la grabación en WebM de Chrome no trae la duración en el archivo (algunos reproductores no dejan adelantar).
- **Se necesita** un navegador con `MediaRecorder`. Se probó en Chromium (Chrome y Edge); Firefox y Safari recientes lo incluyen, pero **no se probaron**. Si el navegador no lo tiene, el botón de grabar queda deshabilitado con una explicación y la captura sigue funcionando (esto sí se probó).

## Sistemas constructivos SCH (sección nueva)

Sección `#sistemas` (entre "Proceso" y "Diseñá tu casa"; también en el menú Servicios y en el pie). Título, subtítulo y frase de cierre tal como los pediste. Dos visores 3D de pared por capas, uno por sistema; todo se renderiza en 3D (no hay imágenes fijas como reemplazo del visor).

- **Wood Frame** (de adentro hacia afuera): revestimiento interior (placa de yeso/Durlock, chapones de pino, chapones de eucalipto o machimbre de pino) · estructura de madera (montantes y soleras) con lana de vidrio · placa OSB · membrana hidrófuga · clavaderas **opcionales** ("Con clavaderas" / "Sin clavaderas") · revestimiento exterior (siding de fibrocemento gris claro por defecto, tablas de madera o chapa acanalada).
- **Construcción tradicional**: revoque interior · mampostería (ladrillo hueco «ticholo» con sus huecos, o ladrillo común) · mortero de asiento y juntas · hormigón armado (encadenado horizontal y vertical, dintel, armaduras y estribos) · revoque exterior (con o sin).
- **Interacciones** (todas reales): elegir sistema y cada alternativa (con tags), seleccionar una capa en el 3D o en la lista, ocultar/mostrar capas, separar las capas con un botón y con un deslizador, armar de nuevo, girar y acercar (mouse, rueda, dedos y botones), vistas (isométrica, frente, corte lateral, desde el interior, planta), **comparar alternativas** lado a lado (A y B) y **restaurar** el estado original. Cada capa tiene su ficha (nombre, descripción, función, material, textura y si es opcional).
- **Contenido técnico**: la ficha de cada capa explica qué es y para qué sirve; **no trae espesores, resistencias ni prestaciones térmicas** porque SCH no las definió. El modelo es ilustrativo y no es un diseño estructural (lo dice la propia sección).
- **Referencias**: las dos imágenes que mandaste se usaron solo como guía técnica de capas y geometría. No se copió ningún logo ni marca de terceros.
- **Celular**: el 3D arranca bloqueado ("Tocá para mover el modelo 3D") para no atrapar el scroll; un toque lo activa. Los controles quedan fuera del modelo.
- **Archivos**: `src/components/sistemas/` (Sistemas.tsx = interfaz, WallViewer.tsx = escena Three), `src/config/wallSystems.ts` (textos y opciones), `src/lib/wallModel.ts`/`wallGeometry.ts`/`wallState.ts`/`wallCamera.ts` (modelo, geometría, estado y cámara; funciones puras con pruebas). Texturas nuevas en `public/textures/` (osb, lanaVidrio, membrana, ladrilloComun, ladrilloHueco, revoque, revoqueFino, maderaEstructural, chaponPino, chaponEucalipto), generadas con `tools/texturas/`.

## Cotizador: identidad de color por categoría

Solo cambió el aspecto (`src/components/cotizador/Cotizador.tsx`, `LogisticsCalculator.tsx`, `palette.ts` y los tokens `--cat-*`, `--sys-*`, `--zone-*` de `src/styles.css`). **No se tocó ningún precio, fórmula ni regla**: `src/lib/cotizador.ts`, `cotizador.test.ts`, `config/pricing.ts` y `store/useConfigurator.ts` son idénticos a los originales, y las 28 pruebas de tarifas y logística pasan.

- Cada categoría tiene su color (Rústica ámbar, Moderna azul grisáceo, Allwood verde pino, Esencial terracota, Clásica verde azulado) en tarjeta, punto, importe, deslizador, tabla comparativa y nombres de las diferencias. Los dos sistemas (pestañas) y los tramos logísticos también tienen el suyo.
- Estados: pestaña activa/disponible, "comparar con los mismos m²" activo, botones − / + (hover, deshabilitado en el mínimo/máximo con borde punteado), campo inválido, tramo logístico seleccionado con pista de 5 tramos.
- Resumen: barras proporcionales en "Comparás tu inversión" (importe ÷ mayor importe) y número que se anima al cambiar. Las tarjetas aparecen escalonadas y se elevan al pasar el mouse (sin movimiento con "reducir movimiento").
- Contraste: todos los colores de categoría y de tramo superan 4,5:1 sobre la tarjeta oscura (se calculó en la prueba).

## Diseñá tu casa: entorno, día/noche y vegetación

Barra de herramientas nueva (`EntornoToolbar.tsx`) bajo las herramientas de edición: **Cámara · Día y noche · Materiales · Entorno · Vegetación · Iluminación · Visualización**. Un panel a la vez; Escape lo cierra; funciona con teclado.

- **Cámara**: Frontal, Lateral, Aérea, Fachada, Encuadre automático (encuadra casa y vegetación) e Interior. La cámara **no baja del suelo** y, en las vistas exteriores, **no entra en la casa** (se la saca hacia afuera a 40 cm de la pared); en el interior queda por encima del piso activo. Lógica en `src/lib/cameraViews.ts`.
- **Día y noche**: botones Modo día / Modo noche con transición progresiva de 2,4 s (pasa por atardecer o amanecer), control de hora (00:00–23:45) y accesos a amanecer y atardecer. Cambian sol/luna, color del cielo (domo con estrellas), niebla, luz ambiente, exposición y reflejos; de noche se encienden las ventanas y una luz interior. Con "reducir movimiento" el cambio es directo. Lógica en `src/lib/skyModel.ts`.
- **Entorno**: cielo, sol, luna y nubes son ambiente (no se seleccionan). Las nubes se desplazan despacio solo si "Cielo animado" está activo, el visor está en pantalla, el equipo no es modesto y no pediste menos movimiento.
- **Vegetación**: pino, eucalipto, palmera y arbusto. Agregar (un toque en el terreno), seleccionar, **arrastrar** el árbol seleccionado o moverlo de a 1 m con botones, quitar uno o todos, mostrar/ocultar. No deja plantar sobre la casa (separación mínima), fuera del terreno ni encimado con otro; hay un máximo de 40. Si la casa crece o se mueve, aleja los árboles que quedaron pegados. Es **ilustrativa**: no forma parte del presupuesto y **no se guarda en el enlace para compartir**. Reglas en `src/lib/vegetation.ts`.
- **Iluminación**: luces de la casa y exposición. **Materiales**: muestra la terminación elegida con sus muestras y lleva al paso "Terminación". **Visualización**: planta, exterior, interior, corte, recorrido, "ver bajo la casa" y restaurar el entorno.
- **Si algo del entorno falla** al dibujarse, el visor vuelve a las luces de antes y la casa sigue viéndose (`SafeBoundary` en `Entorno.tsx`). Los cambios al código existente son mínimos: `Viewer3D.tsx` (luces, vistas, restricción de cámara), `House.tsx` (brillo de ventanas de noche) y `Configurator.tsx` (la barra).

## Diseñá tu casa: calidad de render (postproducción)

Para acercar el visor a un render profesional dentro de lo que permite un navegador, hay **tres calidades** en *Visualización → Calidad de render* y una cadena de postproducción hecha **solo con lo que ya trae Three** (no se sumó ninguna librería). Archivos: `src/components/configurator/renderPipeline.ts` (la cadena), `PostFX.tsx` (la ejecuta y se vigila a sí misma), `Reflections.tsx` (reflejos del cielo), `src/lib/renderQuality.ts` (perfiles y reglas, con pruebas) y `src/store/useRenderFx.ts` (estado).

- **Económico**: el render de siempre, sin postproducción. Es el que arranca en celulares y en equipos de 4 núcleos o menos, y el respaldo si algo falla.
- **Alto**: sombras suaves en esquinas (oclusión ambiental), brillo de luces (bloom), reflejos del cielo, tono de cine, suavizado de bordes FXAA y un ajuste de color con viñeta suave.
- **Ultra**: lo mismo con más muestras de oclusión, suavizado de bordes MSAA ×4, sombras del sol de 4096 px y reflejos de mayor resolución. Arranca solo en computadoras potentes (8 núcleos o más).
- **Reflejos del cielo**: se calculan del mismo cielo que se ve (degradé, sol, luna, estrellas) a la hora elegida, y siguen la transición día/noche. Reemplazan al entorno fijo de antes; si fallan, vuelve el entorno fijo.
- **Cada efecto se puede apagar** (sombras en esquinas, brillo, reflejos, color y viñeta) y hay un **ajuste automático**: si el visor se mueve a menos de unos 24 cuadros por segundo de corrido, baja un escalón de calidad y lo avisa. Se puede desactivar.
- **Captura 4K y video**: la captura pasa por la misma cadena (sin MSAA en 4K por memoria de video; usa FXAA) y, si no puede, sale **sin efectos y lo avisa**. Una captura completamente negra no se entrega: se reintenta a menor resolución. El video graba lo que se ve en pantalla.
- **Se desactiva sola** si no puede armar la cadena, si falla al dibujar o si el cuadro sale completamente negro; vuelve al render simple y lo explica en la barra, con un botón para reintentar.
- **Lo que NO es**: no es trazado de rayos ni iluminación global, no tiene profundidad de campo ni reflejos en tiempo real de los objetos (solo del cielo). Un render de Lumion o V-Ray se calcula durante minutos; esto corre en tiempo real en el navegador.
- **Cambia el aspecto del cielo**: con la cadena activa, el cielo y las nubes también pasan por el tono de cine, así que pueden verse algo distintos que en Económico. El nivel de luz que dan los reflejos (`SKY_ENV_GAIN` en `Reflections.tsx`), la fuerza de la oclusión y el brillo (`src/lib/renderQuality.ts`) son números pensados sin poder ver la escena: **hay que mirarlos y ajustarlos** (cada uno es un número).

## Qué se probó y qué NO se pudo probar

**Probado en un navegador real (Chromium + Playwright)**, con el visor 3D reemplazado por uno de prueba y las librerías de Three sin instalar:
- Sistemas constructivos: 71 comprobaciones (títulos, tags, capas, ocultar, fichas, explosión, vistas, comparar, restaurar, teclado, celular y que nada se salga de la pantalla).
- Cotizador: 53 comprobaciones (colores distintos por categoría, estados, cálculos de ejemplo —40 m² = USD 34.000 / 36.000 / 39.600, 65 m², logística 10 % = +USD 5.200—, copiar y WhatsApp, movimiento reducido, celular, contraste ≥ 4,5).
- Barra de "Diseñá tu casa": 63 comprobaciones (cada botón contra el estado real del entorno, teclado, movimiento reducido y celular).
- Calidad de render (panel *Visualización*): 34 comprobaciones (los tres perfiles, qué efectos quedan activos en cada uno, cada interruptor, ajuste automático, aviso y reintento ante una falla, teclado y celular).
- **Pruebas de lógica** (258 en total entre las que se pudieron correr; incluyen perfiles de calidad, ajuste automático, detección de cuadro negro y el enganche de la captura con la cadena de efectos): modelo y geometría de paredes, cielo día/noche, vegetación, vistas y restricciones de cámara, cotizador, capturas y datos. Las pruebas viejas que dependen de paquetes no instalados acá (`immer`, `polygon-clipping`, `lz-string`, TanStack) no se pudieron correr; esos archivos no se modificaron.

**NO se pudo probar** (no hay Three.js/WebGL instalable en el entorno de trabajo):
1. **El 3D real de las paredes** (`WallViewer.tsx`) y **el 3D real del entorno** (`Entorno.tsx`: cielo, nubes, luces, árboles, brillo de ventanas, plantar/arrastrar con el mouse, restricción de cámara dentro del visor, vistas predefinidas aplicadas a la cámara). El código se revisó y compila (sintaxis e importaciones), la geometría de las paredes se verificó con un rasterizador de prueba y la lógica pura está probada, pero **nadie vio todavía esas escenas funcionando en WebGL**. Antes de publicar: abrí la web, mové las paredes y el visor "Diseñá tu casa", probá día/noche, plantar y arrastrar un árbol, las cinco vistas, y una captura 4K de noche.
2. `bun run test` (vitest), `tsc` sobre todo el proyecto y `bun run build`: no se corrieron. Los tests se ejecutaron con un corredor propio equivalente.
3. Firefox, Safari y navegadores de celular reales: solo se probó Chromium (incluido el modo celular emulado).
4. **La cadena de postproducción real** (oclusión ambiental, brillo, tono de cine, FXAA/MSAA, reflejos PMREM, sombras de 4096 px y la captura 4K con efectos). Su lógica y su respaldo están probados, y se verificaron contra la documentación oficial de Three la firma de `PMREMGenerator.fromScene` y el orden `OutputPass` → FXAA; pero **no se ejecutó en una placa de video**, no se vio la imagen resultante y no se pudo consultar el código fuente de `GTAOPass`. Puede haber que ajustar valores, o que algún efecto se comporte distinto en una placa o navegador concreto. Por eso se vigila sola y vuelve al render simple si falla.
5. Rendimiento real (cuadros por segundo, memoria) y la auditoría de Lighthouse. El visor dibuja solo cuando hace falta, apaga sombras y baja la resolución en celulares y equipos modestos, el cielo animado se detiene fuera de pantalla y la memoria se libera al desmontar, pero **no se midió**.

**Limitaciones conocidas**: la calidad inicial se decide al cargar (celular o ≤ 4 núcleos) y después el ajuste automático la baja si el visor va lento (no la vuelve a subir sola); durante una grabación de video el ajuste automático puede bajar la calidad; en la vista interior la cámara queda sobre el piso pero puede atravesar paredes; las vistas predefinidas no aplican en "Planta" (se vuelve al exterior); los árboles no se guardan con el diseño; el sombreado de los árboles y la luna usan la misma luz principal.

## Imágenes

- Todo vive en `public/images/`: cada foto en dos tamaños (`nombre.webp` de 1600 px y `nombre-800.webp` de 800 px). El código arma el `srcset` solo (`src/lib/img.ts`).
- Los archivos `src/assets/*.asset.json` son los punteros de Lovable; los que se usan ahora apuntan a `/images/...`. Los 26 punteros viejos que nada importa se dejaron como estaban.
- **Agregar una obra**: copiá `nombre.webp` y `nombre-800.webp` a `public/images/`, y sumá la entrada en `src/data/projects.ts` (con un puntero `.asset.json` o directamente con la URL `/images/nombre.webp`).
- Costa: `costa-punta-del-diablo.webp` (2334 × 987 px) y `costa-punta-del-diablo-1200.webp`. La foto `detalle-madera*.webp` (ampliación 2023) se retiró de la web y del ZIP.
- Hero: `hero-obra-1280.webp`, `hero-obra-1736.webp` y `hero-obra-movil.webp` (todos recortes de la portada original de *Lo de Cata*).

## Archivos retirados

`src/assets/sch-hero.jpg`, `project-exterior.jpg`, `project-facade.jpg` y `project-interior.jpg`: no estaban importados en ningún lado y eran imágenes que no corresponden a obras reales de SCH. Siguen estando en el ZIP original.

## Notas

- `SITE_URL` (`src/data/servicios.ts`) es `https://schconstrucciones.lovable.app`; de ahí salen `canonical`, `og:url` y `og:image`. Si publicás con otro dominio, cambialo ahí.
- El formulario de contacto **no envía datos a ningún servidor**: arma el mensaje y abre WhatsApp (`wa.me/59895564068`) para que lo envíe la persona.
- Las tipografías (Urbanist y Epilogue) se cargan desde Google Fonts, como antes.
- No hay claves, tokens ni credenciales en el proyecto.
