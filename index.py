#!/usr/bin/env python3
"""
Punto de entrada del proyecto IA.
Menú interactivo para cargar datasets, entrenar modelos y buscar fotos por RUT.
"""

import os
import sys
import argparse

import pandas as pd

# ── Configuración de datasets ─────────────────────────────────────────────────

DATASETS = {
    "1": {
        "nombre": "Clasificación general (Ia.csv)",
        "archivo": "Ia.csv",
        "sep": ";",
        "decimal": ",",
        "target": "V1",
        "tipo": "clasificacion",
    },
    "2": {
        "nombre": "Modelo socioeconómico (Modeloia.csv)",
        "archivo": "Modeloia.csv",
        "sep": ";",
        "decimal": ",",
        "target": "V1",
        "tipo": "clasificacion",
    },
    "3": {
        "nombre": "Árbol de decisión — variables (arbol.csv)",
        "archivo": "arbol.csv",
        "sep": ";",
        "decimal": ",",
        "target": "V1",
        "tipo": "arbol",
    },
    "4": {
        "nombre": "Árbol de decisión — Wine (arbolde)",
        "archivo": "arbolde",
        "sep": ",",
        "decimal": ".",
        "target": "V1",
        "tipo": "arbol",
    },
    "5": {
        "nombre": "Árbol — temperatura/edad/mes/año/ciudad (iaarbol.csv)",
        "archivo": "iaarbol.csv",
        "sep": ";",
        "decimal": ",",
        "target": "temperatura",
        "tipo": "arbol",
    },
    "6": {
        "nombre": "Red neuronal (IA RNA.csv)",
        "archivo": "IA RNA.csv",
        "sep": ";",
        "decimal": ",",
        "target": "Y",
        "tipo": "rna",
    },
    "7": {
        "nombre": "RNA — datos negativos (IARNANEG .csv)",
        "archivo": "IARNANEG .csv",
        "sep": ",",
        "decimal": ".",
        "target": "Y",
        "tipo": "rna",
    },
    "8": {
        "nombre": "RNA — datos negativos finales (IARNANfin.csv)",
        "archivo": "IARNANfin.csv",
        "sep": ",",
        "decimal": ".",
        "target": "Y",
        "tipo": "rna",
    },
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ── Carga de datos ────────────────────────────────────────────────────────────

def cargar_dataset(config: dict) -> pd.DataFrame:
    ruta = os.path.join(BASE_DIR, config["archivo"])
    if not os.path.exists(ruta):
        print(f"  ERROR: No se encontró '{ruta}'")
        return None

    df = pd.read_csv(
        ruta,
        sep=config["sep"],
        decimal=config["decimal"],
        engine="python",
    )
    df.columns = df.columns.str.strip()
    df = df.apply(lambda col: col.map(lambda x: str(x).strip() if isinstance(x, str) else x))
    df = df.apply(pd.to_numeric, errors="ignore")
    return df


def mostrar_info(df: pd.DataFrame, config: dict):
    print(f"\n  Filas: {len(df)}  |  Columnas: {len(df.columns)}")
    print(f"  Columnas: {list(df.columns)}")
    print(f"  Variable objetivo: '{config['target']}'")
    if config["target"] in df.columns:
        print(f"  Clases/valores únicos: {sorted(df[config['target']].dropna().unique())}")
    print(f"\n{df.head(3).to_string(index=False)}\n")


# ── Modelos ───────────────────────────────────────────────────────────────────

def entrenar_clasificacion(df: pd.DataFrame, config: dict):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.metrics import classification_report, accuracy_score

    target = config["target"]
    if target not in df.columns:
        print(f"  ERROR: columna '{target}' no encontrada.")
        return

    X = df.drop(columns=[target]).select_dtypes(include="number")
    y = df[target]
    X = X.fillna(X.mean())

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    modelo = KNeighborsClassifier(n_neighbors=5)
    modelo.fit(X_train, y_train)
    y_pred = modelo.predict(X_test)

    print(f"\n  Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred, zero_division=0))


def entrenar_arbol(df: pd.DataFrame, config: dict):
    from sklearn.model_selection import train_test_split
    from sklearn.tree import DecisionTreeClassifier, export_text
    from sklearn.metrics import accuracy_score

    target = config["target"]
    if target not in df.columns:
        print(f"  ERROR: columna '{target}' no encontrada.")
        return

    X = df.drop(columns=[target]).select_dtypes(include="number")
    y = df[target]
    X = X.fillna(X.mean())

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    modelo = DecisionTreeClassifier(max_depth=4, random_state=42)
    modelo.fit(X_train, y_train)
    y_pred = modelo.predict(X_test)

    print(f"\n  Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print("\n  Árbol (primeras ramas):")
    print(export_text(modelo, feature_names=list(X.columns), max_depth=3))


def entrenar_rna(df: pd.DataFrame, config: dict):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.neural_network import MLPRegressor
    from sklearn.metrics import mean_squared_error, r2_score
    import math

    target = config["target"]
    if target not in df.columns:
        print(f"  ERROR: columna '{target}' no encontrada.")
        return

    X = df.drop(columns=[target]).select_dtypes(include="number")
    y = df[target]
    X = X.fillna(X.mean())

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    modelo = MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42)
    modelo.fit(X_train, y_train)
    y_pred = modelo.predict(X_test)

    mse = mean_squared_error(y_test, y_pred)
    print(f"\n  MSE  : {mse:.4f}")
    print(f"  RMSE : {math.sqrt(mse):.4f}")
    print(f"  R²   : {r2_score(y_test, y_pred):.4f}")


ENTRENADORES = {
    "clasificacion": entrenar_clasificacion,
    "arbol": entrenar_arbol,
    "rna": entrenar_rna,
}


# ── Búsqueda de fotos ─────────────────────────────────────────────────────────

def buscar_fotos():
    rut = input("  Ingrese RUT a buscar: ").strip()
    if not rut:
        print("  RUT vacío.")
        return
    os.system(f'python "{os.path.join(BASE_DIR, "buscar_fotos_rut.py")}" "{rut}"')


# ── Menú ──────────────────────────────────────────────────────────────────────

def menu_dataset() -> dict | None:
    print("\n╔══════════════════════════════════════════════╗")
    print("║            SELECCIONAR DATASET               ║")
    print("╠══════════════════════════════════════════════╣")
    for k, v in DATASETS.items():
        print(f"║  {k}. {v['nombre']:<42}║")
    print("║  0. Volver                                   ║")
    print("╚══════════════════════════════════════════════╝")
    op = input("  Opción: ").strip()
    return DATASETS.get(op)


def menu_principal():
    while True:
        print("\n╔══════════════════════════════════════════════╗")
        print("║           PROYECTO IA — MENÚ PRINCIPAL       ║")
        print("╠══════════════════════════════════════════════╣")
        print("║  1. Cargar y explorar dataset                ║")
        print("║  2. Entrenar modelo                          ║")
        print("║  3. Buscar fotos por RUT (Google Sheets)     ║")
        print("║  4. Listar todos los datasets                ║")
        print("║  0. Salir                                    ║")
        print("╚══════════════════════════════════════════════╝")
        op = input("  Opción: ").strip()

        if op == "0":
            print("\n  Hasta luego.\n")
            break

        elif op == "1":
            cfg = menu_dataset()
            if cfg:
                print(f"\n  Cargando: {cfg['nombre']} ...")
                df = cargar_dataset(cfg)
                if df is not None:
                    mostrar_info(df, cfg)

        elif op == "2":
            cfg = menu_dataset()
            if cfg:
                print(f"\n  Entrenando sobre: {cfg['nombre']} ...")
                df = cargar_dataset(cfg)
                if df is not None:
                    mostrar_info(df, cfg)
                    fn = ENTRENADORES.get(cfg["tipo"])
                    if fn:
                        fn(df, cfg)
                    else:
                        print("  Tipo de modelo no soportado.")

        elif op == "3":
            buscar_fotos()

        elif op == "4":
            print("\n  Datasets disponibles:")
            for k, v in DATASETS.items():
                ruta = os.path.join(BASE_DIR, v["archivo"])
                existe = "✓" if os.path.exists(ruta) else "✗"
                print(f"  [{existe}] {k}. {v['nombre']}")

        else:
            print("  Opción no válida.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Proyecto IA — Menú principal")
    parser.add_argument("--lista", action="store_true", help="Listar datasets y salir")
    args = parser.parse_args()

    if args.lista:
        print("\nDatasets disponibles:")
        for k, v in DATASETS.items():
            ruta = os.path.join(BASE_DIR, v["archivo"])
            existe = "OK" if os.path.exists(ruta) else "FALTA"
            print(f"  [{existe}] {k}. {v['nombre']}  ({v['archivo']})")
        sys.exit(0)

    menu_principal()
