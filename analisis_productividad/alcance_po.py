"""Alcance del PO a meta/tope y Crowd necesario con la productividad real de Crowd."""
import csv
import math
from pathlib import Path

META_PED_PO = 9
TOPE_PED_PO = 11
META_UNI_PO = 350
BASE = Path(__file__).parent


def cargar(nombre):
    with open(BASE / nombre, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def main():
    real = {r["Fecha"]: int(r["Pedidos_Crowd_Real"]) for r in cargar("crowd_real.csv")}
    salida = []
    for f in cargar("datos_rama.csv"):
        if f["Fecha"] not in real:
            continue
        ped, uni = int(f["Pedidos_Totales"]), int(f["Unidades_Totales"])
        po, crowd = int(f["Dotacion_PO"]), int(f["Dotacion_Crowd"])
        ped_crowd = real[f["Fecha"]]
        upp = uni / ped
        prod_crowd = ped_crowd / crowd
        salida.append({
            "Fecha": f["Fecha"],
            "Denominacion": f["Denominacion"],
            "Pedidos": ped,
            "PO": po,
            "Alcance_PO_meta_ped": po * META_PED_PO,
            "Alcance_PO_meta_uni": po * META_UNI_PO,
            "Cobertura_meta": round(po * META_PED_PO / ped, 2),
            "Alcance_PO_tope_ped": po * TOPE_PED_PO,
            "Cobertura_tope": round(po * TOPE_PED_PO / ped, 2),
            "Ped_PO_real": round((ped - ped_crowd) / po, 1),
            "Uni_PO_real": round((ped - ped_crowd) * upp / po),
            "Crowd": crowd,
            "Ped_Crowd_real": ped_crowd,
            "Prod_Crowd_real": round(prod_crowd, 1),
            "Crowd_necesario_meta": math.ceil(max(0, ped - po * META_PED_PO) / prod_crowd),
            "Crowd_necesario_tope": math.ceil(max(0, ped - po * TOPE_PED_PO) / prod_crowd),
        })
    with open(BASE / "resultado_alcance_po.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=salida[0].keys(), delimiter=";")
        w.writeheader()
        w.writerows(salida)
    for r in salida:
        print(r)


if __name__ == "__main__":
    main()
