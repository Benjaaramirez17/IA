"""Productividad PO vs participación Crowd por día y por denominación."""
import csv
import math
import sys
from pathlib import Path

PEDIDOS_POR_CROWD = 6
PARTICIPACION_PO = (0.55, 0.60, 0.65)
META_PED_PO = 9
TOPE_PED_PO = 11
META_UNI_PO = 350
PROD_CROWD = 5.5
BASE = Path(__file__).parent


def cargar(ruta):
    with open(ruta, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def calcular(fila):
    ped = int(fila["Pedidos_Totales"])
    crowd = int(fila["Dotacion_Crowd"])
    po = int(fila["Dotacion_PO"])
    uni = int(fila["Unidades_Totales"])
    upp = uni / ped
    ped_crowd = min(crowd * PEDIDOS_POR_CROWD, ped)
    ped_po = ped - ped_crowd
    escenarios = escenarios_participacion(ped, uni, po, crowd)
    return {
        "Fecha": fila["Fecha"],
        "Denominacion": fila["Denominacion"],
        "Pedidos": ped,
        "Crowd": crowd,
        "PO": po,
        "Unidades": uni,
        "UPP": upp,
        "Ped_PO_bruto": ped / po,
        "Uni_PO_bruto": uni / po,
        "Ped_Crowd": ped_crowd,
        "Uni_Crowd": ped_crowd * upp,
        "Part_Crowd": ped_crowd / ped,
        "Ped_rest_PO": ped_po,
        "Ped_PO_neto": ped_po / po,
        "Uni_PO_neto": ped_po * upp / po,
        **escenarios,
        **crowd_requerido(ped, uni, po),
    }


def crowd_requerido(ped, uni, po):
    """Crowd que cubre la demanda que excede la meta y el tope de pedidos por PO."""
    upp = uni / ped
    return {
        "Crowd_meta": math.ceil(max(0, ped - po * META_PED_PO) / PROD_CROWD),
        "Crowd_tope": math.ceil(max(0, ped - po * TOPE_PED_PO) / PROD_CROWD),
        "Crowd_meta_unid": math.ceil(max(0, uni - po * META_UNI_PO) / (PROD_CROWD * upp)),
    }


def escenarios_participacion(ped, uni, po, crowd):
    """Reparte la demanda con el PO tomando una participación fija; el resto va a Crowd."""
    res = {}
    for sh in PARTICIPACION_PO:
        tag = f"{sh:.0%}"
        res[f"Ped_PO_{tag}"] = ped * sh / po
        res[f"Uni_PO_{tag}"] = uni * sh / po
        res[f"Ped_Crowd_{tag}"] = ped * (1 - sh) / crowd
        res[f"Uni_Crowd_{tag}"] = uni * (1 - sh) / crowd
    return res


def resumir(filas):
    """Promedios ponderados del segmento (sumas totales / sumas totales)."""
    ped = sum(r["Pedidos"] for r in filas)
    uni = sum(r["Unidades"] for r in filas)
    po = sum(r["PO"] for r in filas)
    crowd = sum(r["Crowd"] for r in filas)
    ped_crowd = sum(r["Ped_Crowd"] for r in filas)
    uni_crowd = sum(r["Uni_Crowd"] for r in filas)
    n = len(filas)
    return {
        "Dias": n,
        "Pedidos/dia": ped / n,
        "Unidades/dia": uni / n,
        "Crowd/dia": crowd / n,
        "PO/dia": po / n,
        "UPP": uni / ped,
        "Ped_PO_bruto": ped / po,
        "Uni_PO_bruto": uni / po,
        "Part_Crowd": ped_crowd / ped,
        "Ped_PO_neto": (ped - ped_crowd) / po,
        "Uni_PO_neto": (uni - uni_crowd) / po,
        # Participación del PO con la que cada Crowd haría exactamente PEDIDOS_POR_CROWD
        "Part_PO_equilibrio": 1 - crowd * PEDIDOS_POR_CROWD / ped,
        **escenarios_participacion(ped, uni, po, crowd),
        **crowd_requerido(ped / n, uni / n, po / n),
    }


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "datos_rama.csv"
    detalle = [calcular(f) for f in cargar(ruta)]

    with open(BASE / "resultado_diario.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=detalle[0].keys(), delimiter=";")
        w.writeheader()
        for r in detalle:
            w.writerow({k: round(v, 2) if isinstance(v, float) else v for k, v in r.items()})

    segmentos = {}
    for r in detalle:
        segmentos.setdefault(r["Denominacion"], []).append(r)
    resumen = {k: resumir(v) for k, v in segmentos.items()}
    resumen["Total"] = resumir(detalle)

    with open(BASE / "resultado_por_denominacion.csv", "w", newline="", encoding="utf-8") as f:
        campos = ["Denominacion", *resumen["Total"].keys()]
        w = csv.DictWriter(f, fieldnames=campos, delimiter=";")
        w.writeheader()
        for k, v in resumen.items():
            w.writerow({"Denominacion": k, **{c: round(x, 2) for c, x in v.items()}})

    print(f"{'Fecha':8} {'Den':9} {'Ped':>4} {'UPP':>5} {'Ped/PO b':>8} {'Uni/PO b':>8} "
          f"{'%Crowd':>6} {'Ped/PO n':>8} {'Uni/PO n':>8}")
    for r in detalle:
        print(f"{r['Fecha']:8} {r['Denominacion']:9} {r['Pedidos']:>4} {r['UPP']:>5.1f} "
              f"{r['Ped_PO_bruto']:>8.1f} {r['Uni_PO_bruto']:>8.0f} {r['Part_Crowd']:>6.0%} "
              f"{r['Ped_PO_neto']:>8.1f} {r['Uni_PO_neto']:>8.0f}")
    print()
    for k, v in resumen.items():
        print(k, {c: round(x, 2) for c, x in v.items()})


if __name__ == "__main__":
    main()
