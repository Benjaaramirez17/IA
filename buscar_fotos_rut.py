#!/usr/bin/env python3
"""
Script para buscar fotos (Frontal y Posterior) por RUT en Google Sheets.
Hoja: "hola" | Columnas: RUT | Frontal | Posterior
"""

import sys
import gspread
from google.oauth2.service_account import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
import os

SPREADSHEET_ID = "1RZFu7fvNoyu7mr2SLwLhD7aYBHnF0GhAmF-JVEoyhLI"
SHEET_NAME = "hola"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

CREDENTIALS_FILE = "credentials.json"   # Service Account o OAuth2 client
TOKEN_FILE = "token.pickle"             # Caché OAuth2


def get_client_oauth2():
    """Autenticación OAuth2 (abre navegador la primera vez)."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)

    return gspread.authorize(creds)


def get_client_service_account():
    """Autenticación con Service Account (sin navegador)."""
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    return gspread.authorize(creds)


def normalizar_rut(rut: str) -> str:
    """Elimina puntos y espacios, mantiene guión, convierte a mayúsculas."""
    return rut.strip().replace(".", "").replace(" ", "").upper()


def buscar_por_rut(rut_buscar: str):
    # Detectar tipo de credencial
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"ERROR: No se encontró el archivo '{CREDENTIALS_FILE}'.")
        print("Coloca tu archivo de credenciales (Service Account o OAuth2) con ese nombre.")
        sys.exit(1)

    try:
        # Intentar Service Account primero
        client = get_client_service_account()
    except Exception:
        try:
            client = get_client_oauth2()
        except Exception as e:
            print(f"ERROR de autenticación: {e}")
            sys.exit(1)

    try:
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        sheet = spreadsheet.worksheet(SHEET_NAME)
    except Exception as e:
        print(f"ERROR al abrir la hoja: {e}")
        sys.exit(1)

    rut_buscar_norm = normalizar_rut(rut_buscar)

    # Leer todos los datos (fila 1 = encabezados)
    datos = sheet.get_all_values()
    if not datos:
        print("La hoja está vacía.")
        return

    encabezados = datos[0]
    filas = datos[1:]

    resultados = []
    for i, fila in enumerate(filas, start=2):  # start=2 por encabezado
        if not fila:
            continue
        rut_hoja = normalizar_rut(fila[0]) if fila[0] else ""
        if rut_hoja == rut_buscar_norm:
            frontal   = fila[1] if len(fila) > 1 else "—"
            posterior = fila[2] if len(fila) > 2 else "—"
            resultados.append({
                "fila": i,
                "rut": fila[0],
                "frontal": frontal,
                "posterior": posterior,
            })

    if not resultados:
        print(f"No se encontró el RUT '{rut_buscar}' en la hoja.")
        return

    for r in resultados:
        print(f"\n{'='*50}")
        print(f"  RUT      : {r['rut']}  (fila {r['fila']})")
        print(f"  Frontal  : {r['frontal']}")
        print(f"  Posterior: {r['posterior']}")
    print(f"{'='*50}\n")
    print(f"Total encontrados: {len(resultados)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python buscar_fotos_rut.py <RUT>")
        print("Ejemplo: python buscar_fotos_rut.py 12345678-9")
        sys.exit(1)

    rut_input = " ".join(sys.argv[1:])
    buscar_por_rut(rut_input)
