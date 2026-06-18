# Proyecto IA — Documentación

## Descripción
Proyecto de Inteligencia Artificial con modelos de clasificación, regresión y árboles de decisión, más utilidades de gestión de datos (búsqueda de fotos por RUT en Google Sheets).

## Estructura del proyecto

```
IA/
├── index.py              # Menú principal — punto de entrada del proyecto
├── buscar_fotos_rut.py   # Busca fotos Frontal/Posterior por RUT en Google Sheets
├── credentials.json      # Credenciales Google (NO subir a git)
├── token.pickle          # Caché OAuth2 (auto-generado)
│
├── Datasets/
│   ├── Ia.csv            # Clasificación multi-clase (V1–V14, separador ;)
│   ├── Modeloia.csv      # Regresión/clasificación con variables socioeconómicas
│   ├── arbol.csv         # Árbol de decisión multi-variable (V1–V5)
│   ├── arbolde           # Dataset Wine para árbol (14 variables, sin extensión)
│   ├── iaarbol.csv       # Árbol: temperatura, edad, mes, año, ciudad
│   ├── IA RNA.csv        # Red neuronal artificial (Y, X1, X2)
│   ├── IARNANEG .csv     # RNA — datos negativos (Y, X1, X2)
│   └── IARNANfin.csv     # RNA — datos finales negativos (Y, X1, X2)
```

## Datasets

| Archivo | Tipo de modelo | Variables | Separador |
|---|---|---|---|
| `Ia.csv` | Clasificación | V1 (clase) + V2–V14 | `;` |
| `Modeloia.csv` | Clasificación/Regresión | V1 (clase) + variables socioeconómicas | `;` |
| `arbol.csv` | Árbol de decisión | V1 (clase) + V2–V5 | `;` |
| `arbolde` | Árbol (Wine dataset) | V1 (clase) + V2–V14 | `,` |
| `iaarbol.csv` | Árbol | temperatura, edad, mes, año, ciudad | `;` |
| `IA RNA.csv` | Red neuronal | Y (salida) + X1, X2 | `;` |
| `IARNANEG .csv` | Red neuronal | Y, X1, X2 (negativos) | `,` |
| `IARNANfin.csv` | Red neuronal | Y, X1, X2 (negativos fin) | `,` |

## Dependencias

```bash
pip install pandas scikit-learn matplotlib gspread google-auth google-auth-oauthlib
```

## Uso rápido

```bash
# Menú interactivo
python index.py

# Buscar fotos por RUT directamente
python buscar_fotos_rut.py 12345678-9
```

## Google Sheets — Configuración

1. Obtener credenciales en [Google Cloud Console](https://console.cloud.google.com)
2. Guardar como `credentials.json` en la raíz del proyecto
3. Compartir el spreadsheet con el email de la Service Account
4. Sheet ID: `1RZFu7fvNoyu7mr2SLwLhD7aYBHnF0GhAmF-JVEoyhLI` | Pestaña: `hola`

## Comandos frecuentes

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar menú principal
python index.py

# Ver datasets disponibles
python index.py --lista

# Buscar RUT
python buscar_fotos_rut.py <RUT>
```

## Notas
- Los archivos CSV usan separador `;` salvo `arbolde`, `IARNANEG .csv` e `IARNANfin.csv` que usan `,`
- `credentials.json` y `token.pickle` están en `.gitignore` — nunca subirlos al repositorio
