[1Cómo nos evalúan](#evaluacion) [2Cómo ganamos](#ganar) [3Entregables 01–06](#entregables) [4Guion del video](#video) [5Presentación](#deck) [6Capturas de la web](#capturas) [7Prompts por fase](#prompts) [8Checklist final](#checklist)

FinTechathon 2026 · International Track · Topic E · SME Finance Copilot

# NanFeng 南风: kit de entrega para ganar

Basado en las bases oficiales (PDF FinTechathon) y en el estado real del repo y del deploy al 14 de octubre. El jurado no va a navegar la página: nos evalúa por el video, el deck y los documentos. Todo lo de abajo está pensado para esa lectura.

**20 oct · 12:59**cierre en hora de Chile (23:59 Beijing, UTC+8). No es de noche.

**≤ 5:00**video demo; en nuestro tema es parte obligatoria de la evidencia 06

**≤ 10:00**presentación final; se entrega ahora y se presenta en Shenzhen

**31 oct**anuncio de finalistas · final 21–23 nov en Shenzhen, al menos uno presencial

1 · Lo que dice el PDF

<a id="evaluacion"></a>

## Cómo nos evalúan

Revisión online el 20 de octubre por expertos de WeBank y académicos. Todo en inglés. Los seis temas comparten la misma rúbrica.

40%

### Task completion

- El agente hace tareas reales, de punta a punta
- Lo prueban: video, logs del sandbox (06), tests (04)

30%

### Security & compliance

- Niveles de permiso y lista de riesgos conocidos
- Lo prueban: 05, sección 5 de 01, red team

30%

### Innovation & interaction

- Qué tan nuevo es y qué tan bien se usa
- Lo prueban: video, deck, canales, tres idiomas

+0–5

### Bono on-chain

- Exploración on-chain, aunque no sea el Topic F
- Lo prueban: tx de Sepolia visible en Etherscan

**Lo que significa para nosotros**

El jurado ve archivos, no la app. Si algo no aparece en el video, en el deck o en un PDF, para ellos no existe. Por eso cada escena del video y cada diapositiva lleva marcado el criterio que demuestra: TC task completion, SC security & compliance, II innovation & interaction, ON bono on-chain.

2 · Estrategia

<a id="ganar"></a>

## Cómo ganamos

### Usar las palabras del tema

El tema es "AI as a Financial Participant". Nuestra frase de cierre ya lo dice: "NanFeng doesn't advise. It acts, with your permission." Repetirla al inicio del video, en la portada y en el cierre del deck.

### Hacer visible la rúbrica

Una diapositiva "How we meet the brief" que mapea 40/30/30 + bono a pruebas concretas, y en el video un chip discreto abajo a la izquierda con el criterio de cada escena. Le ahorramos trabajo al juez.

### Pruebas reales, no maquetas

Los jueces desconfían de las demos armadas. Mostrar el badge API LIVE, la transacción en Etherscan, el CI en verde y el contador 4/46 → 46/46. Cada número en pantalla debe tener su fuente.

### Los mismos números en todas partes

81% · 19 días · USD 142.400 · CLP 2,1M vs 3,8M · 45% · 46/46 · 50/50 · −41%. El video viejo decía USD 2,6 bn y el deck 2,8 bn: usar **USD 2.8 bn** (temporada completa, FreshFruitPortal).

### Un deck que se entiende sin orador

En la revisión online nadie lo presenta. Cada título es una frase completa con el argumento, y las fuentes van al pie. Las notas del orador quedan para Shenzhen.

### Inglés nativo y chino revisado

Toda la entrega es en inglés. Pasar el guion y el deck por una revisión de inglés, y los subtítulos 中文 por un hablante nativo antes de exportar.

3 · Submission checklist del PDF

<a id="entregables"></a>

## Entregables 01–06

Qué pide cada uno, dónde está hoy, qué falta y qué capturas lleva. Los IDs `C01`… están en la sección 6.

4 · Entregable 03 + parte del 06

<a id="video"></a>

## Guion del video demo · 5:00

Narración en inglés, subtítulos quemados en inglés y 中文. Meta real 4:50 para tener margen. Grabar en 1920×1080, tema claro, la web en inglés salvo la escena 11.

**Lo que cambió respecto del guion anterior**

Se agregan dos escenas que suben puntaje: **la actividad del agente** (escena 7, demuestra que es un agente que actúa, el tema del concurso) y **la transacción en Etherscan** (escena 9, prueba on-chain real para el bono). Para hacer espacio se acortan la apertura y el ¿Y si…?

| # | Tiempo | Pantalla y acción | Narración (EN) · subtítulo 中文 | Criterio |
| --- | --- | --- | --- | --- |

### Antes de grabar

- Para que la escena 9 tenga tx en Etherscan: grabando en local, poner una vez en el `.env` `NANFENG_ANCHOR_BACKEND=evm`, `NANFENG_EVM_RPC_URL` y `NANFENG_EVM_PRIVATE_KEY` (la wallet de testnet; Camilo la pasa por privado, nunca al repo). Grabando contra el sitio en vivo no hace falta, pero el código llega por SMS al teléfono del dueño.
- Borrar los datos del sitio en el navegador para que aparezca la vista Summary y el saludo.
- Iniciar sesión como dueño antes de grabar, así el login no interrumpe la escena 8.
- Reiniciar el sandbox antes de cada toma (Reset sandbox).
- Grabar en local con `NANFENG_OTP_MODE=sandbox` y el código `482913`; decir en pantalla que la versión real manda un código por SMS.
- Barra de marcadores oculta, notificaciones apagadas, cursor resaltado.
- Esperar 3 segundos después de cada carga antes de hacer clic: los clics de los primeros segundos se pierden.

### Edición y entrega

- Chip del criterio abajo a la izquierda en cada escena (TC, SC, II, ON), 12 px de alto, sin animación.
- Subtítulos quemados: inglés arriba, 中文 abajo. 中文 revisado por un nativo.
- Último frame 3 segundos: logo, `www.nanfengcfo.com` y el link del repo.
- MP4 H.264 1080p, máximo 5:00. Verificar que abre sin internet.
- Alojarlo donde se abra desde China continental: adjunto o el portal del concurso. Nada de YouTube ni Google Drive.
- Cortar una versión de 2:30 (escenas 2 a 10) para la diapositiva 4 del deck.

5 · Entregable 02

<a id="deck"></a>

## Presentación · 9:30 hablados, 11 diapositivas

Se entrega como PDF el 20 de octubre y se presenta en vivo en la final. Cada diapositiva dice qué va escrito, qué captura lleva y qué se dice.

6 · Fotos de la web

<a id="capturas"></a>

## Capturas de la web

Un solo set de capturas sirve para el deck y los documentos. Nombrar cada archivo con su ID, por ejemplo `C05-financing-options-en.png`, y guardarlas en `valentin-castro/captures/`.

### Cómo sacarlas

- Chrome, ventana de 1600×900, zoom del navegador al 100%, pantalla Retina (salen a 3200×1800).
- Tema claro y la web en inglés, salvo las marcadas 中文.
- Sesión de dueño iniciada. Sandbox reiniciado para las capturas "antes"; aprobar el plan para las "después".
- Capturar solo el contenido de la página (Cmd+Shift+P en DevTools → "Capture screenshot"), sin la barra del navegador.
- Sin datos personales reales: todo es la empresa ficticia Huerto Austral.

### Cómo ponerlas en el deck

- Un marco de navegador fino y neutro. Nada de mockups de laptop ni teléfonos 3D.
- Nunca deformar. Si no cabe, recortar según la columna "Recorte".
- Un número clave resaltado con un círculo o recuadro dorado fino, máximo uno por captura.
- Pie de foto de una línea en gris: qué pantalla es y que es un sandbox.

| ID | Pantalla | Ruta y estado | Recorte | Se usa en |
| --- | --- | --- | --- | --- |

7 · Para la herramienta de IA

<a id="prompts"></a>

## Prompts por fase

Pensados para hacer el deck por fases en cualquier herramienta de presentaciones con IA. Van en inglés porque el deck es en inglés. Pegar uno por fase, revisar y recién ahí pasar al siguiente.

8 · Antes del 20 de octubre, 12:59 hora de Chile

<a id="checklist"></a>

## Checklist final

### Técnico

- Camilo, una sola vez: redeploy del backend en Railway para cargar el anclaje al arrancar, y comprobar que `GET /audit/anchors` no viene vacío. Después se ancla solo.
- Andy: volver a correr el paquete de evidencia 06 contra el deploy después del redeploy.
- Actualizar o sacar `valentin-castro/STATUS.md`: hoy dice que falta el agente y el dominio, y ya no es cierto.
- Repo público, README con link a la URL en vivo, CI en verde en `main`.
- Arreglar los clics que se pierden en los primeros segundos de carga.

### Entrega

- 01 y 05 exportados a PDF con sus capturas.
- 02 deck en PDF, títulos que se entienden solos, fuentes al pie.
- 03 video MP4 ≤ 5:00, inglés + 中文.
- 06 logs del sandbox + tx de Sepolia + el video.
- Certificados de alumno regular en inglés de los cinco.
- Una pasada final con el prompt de la fase 5 y el equipo leyendo todo como juez.
- Subir con al menos un día de margen; se puede reemplazar hasta el cierre.