"""Participación real del PO, brecha contra meta/tope y metas si el PO operara solo.

Pedidos del PO = dato real (po_real.csv); el resto de la demanda lo saca Crowd.
Las unidades se reparten con el mismo tamaño de pedido para PO y Crowd.
"""
import csv
from pathlib import Path

META_PED_PO = 9
TOPE_PED_PO = 11
META_UNI_PO = 350
BASE = Path(__file__).parent


def cargar(nombre):
    with open(BASE / nombre, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def calcular(fila, ped_po):
    ped, uni = int(fila["Pedidos_Totales"]), int(fila["Unidades_Totales"])
    po, crowd = int(fila["Dotacion_PO"]), int(fila["Dotacion_Crowd"])
    upp = uni / ped
    ped_crowd = ped - ped_po
    prod_crowd = ped_crowd / crowd
    extra_meta = max(0, po * META_PED_PO - ped_po)
    extra_tope = max(0, po * TOPE_PED_PO - ped_po)
    return {
        "Fecha": fila["Fecha"],
        "Denominacion": fila["Denominacion"],
        "Pedidos": ped,
        "PO": po,
        "Crowd": crowd,
        "Ped_PO_real": ped_po,
        "Part_PO": round(ped_po / ped, 3),
        "Part_Crowd": round(ped_crowd / ped, 3),
        "Ped_por_PO": round(ped_po / po, 1),
        "Uni_por_PO": round(ped_po * upp / po),
        "Ped_por_Crowd": round(prod_crowd, 1),
        "Brecha_meta": round(META_PED_PO - ped_po / po, 1),
        "Ped_extra_PO_meta": extra_meta,
        "Ped_extra_PO_tope": extra_tope,
        "Crowd_liberable_meta": round(extra_meta / prod_crowd, 1),
        "Crowd_liberable_tope": round(extra_tope / prod_crowd, 1),
        "Solo_PO_ped": round(ped / po, 1),
        "Solo_PO_uni": round(uni / po),
        "PO_necesario_meta": round(ped / META_PED_PO, 1),
        "PO_necesario_tope": round(ped / TOPE_PED_PO, 1),
        "PO_necesario_uni": round(uni / META_UNI_PO, 1),
    }


def main():
    real = {r["Fecha"]: int(r["Pedidos_PO_Real"]) for r in cargar("po_real.csv")}
    salida = [calcular(f, real[f["Fecha"]]) for f in cargar("datos_rama.csv") if f["Fecha"] in real]
    with open(BASE / "resultado_alcance_po.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=salida[0].keys(), delimiter=";")
        w.writeheader()
        w.writerows(salida)
    for r in salida:
        print(r)


if __name__ == "__main__":
    main()
