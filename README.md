# Scraper OEFA - Tribunal de Fiscalización Ambiental

Scraper HTTP en **TypeScript** que recorre el Repositorio Digital del OEFA, extrae la
metadata de cada resolución del Tribunal de Fiscalización Ambiental (TFA) y descarga
sus PDFs, con manejo de _rate limiting_ (HTTP 429) mediante reintentos con backoff
exponencial.

- Sitio: `https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml`
- Sin automatización de navegador: solo peticiones HTTP (`axios`) + parsing (`cheerio`).

## Cómo funciona el sitio

El portal es una aplicación **PrimeFaces / JSF (Mojarra)**. El scraper reproduce el
mismo flujo que hace el navegador con peticiones HTTP:

1. **GET** de la página de consulta: entrega la cookie de sesión `JSESSIONID` y un
   token `javax.faces.ViewState`. La tabla arranca vacía.
2. **POST AJAX "Buscar"** (filtros vacíos): devuelve un `partial-response` XML con las
   primeras filas y el total de registros (~1753 en 176 páginas), más un `ViewState`
   actualizado.
3. **POST AJAX de paginación** (`dt_first = página * 10`): devuelve las filas de cada
   página.
4. **POST full-form** con `param_uuid`: descarga el PDF del documento
   (`Content-Disposition: attachment; filename=...`).

De cada fila se extrae: número de expediente, administrado, unidad fiscalizable,
sector, número de resolución y el `uuid` interno del documento.

## Requisitos

- Node.js 18 o superior.

## Instalación

```bash
npm install
```

## Uso

Ejecutar el scraper completo (recorre todas las páginas y descarga todos los PDFs):

```bash
npm run scrape
```

```bash
# Solo las primeras 3 páginas
npx ts-node src/index.ts --max-pages 3

# Empezar desde la página 5, descargar como máximo 20 registros
npx ts-node src/index.ts --start-page 5 --limit 20

# Solo extraer metadata, sin descargar PDFs
npx ts-node src/index.ts --no-pdf

# Reintentar únicamente las descargas que fallaron antes
npm run retry-failed
```

### Opciones (flags)

| Flag             | Descripción                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `--start-page N` | Página inicial (1-based). Por defecto `1`.                         |
| `--max-pages N`  | Número máximo de páginas a recorrer.                               |
| `--limit N`      | Número máximo de registros a procesar en la ejecución.            |
| `--no-pdf`       | Extrae metadata sin descargar los PDFs.                            |
| `--retry-failed` | Reprocesa solo los documentos registrados en `data/failed.json`.  |

> No es necesario descargar los 1753 documentos en una sola corrida. Los flags
> `--max-pages` / `--limit` permiten demostrar el funcionamiento con un subconjunto;
> dejándolo correr sin límites llega a descargarlos todos.

## Salidas

- `data/resolutions.json`: índice estructurado con la metadata de cada resolución
  (incluye `uuid` y el nombre del PDF descargado).
- `pdfs/`: PDFs descargados, con nombre descriptivo derivado del documento.
- `data/failed.json`: documentos cuya descarga falló tras agotar los reintentos, para
  reprocesarlos luego con `--retry-failed`.

## Manejo de errores 429 y robustez

- Cada descarga y petición reintenta ante un **429 (Too Many Requests)** con backoff
  exponencial + jitter, respetando la cabecera `Retry-After` si viene presente
  (ver `src/utils/retry.ts`).
- Tras agotar los reintentos, el documento se registra en `data/failed.json` y el
  scraper continúa con el siguiente.
- Se aplican delays entre peticiones para no sobrecargar el servidor.
- Reanudable: si un PDF ya existe se omite; el `ViewState` se actualiza en cada
  respuesta y la sesión se puede reiniciar ante expiración.

## Estructura del proyecto

```
src/
  config.ts            Constantes: URL, campos JSF, delays, config de reintentos
  types.ts             Tipos (ResolutionRecord, FailedDownload, CliOptions)
  index.ts             Orquestador + parsing de flags
  http/
    session.ts         Cliente axios con cookie jar + ViewState
    jsf.ts             Construcción de payloads JSF y extracción de ViewState
  scraper/
    search.ts          Búsqueda inicial y paginación
    parser.ts          Parsing de filas (cheerio) -> registros
    pdf.ts             Descarga de PDFs con manejo de 429
  utils/
    retry.ts           Backoff exponencial y detección de 429
    files.ts           E/S de archivos y sanitización de nombres
    failures.ts        Registro de descargas fallidas
    logger.ts          Logging con timestamps
```

