# Génère tests/fixtures/bulletin-cases.pdf : python3 tests/fixtures/bulletin-cases.py tests/fixtures/bulletin-cases.pdf
# Génère un bulletin PDF « comme un logiciel de paie » : chaque case est un texte séparé,
# sans espace entre les cases, émis COLONNE PAR COLONNE (ordre différent de la lecture).
import sys
rows = [
  ("Période du 01/10/2026 au 31/10/2026", None, None, None, None),
  ("Salaire de base", "151,67", "12,0200", "1 823,07", None),
  ("Heures supplémentaires 25%", "17,33", "15,0250", "260,38", None),
  ("Prime de salissure", None, None, "50,00", None),
  ("Indemnité de fin de mission", "2 133,45", "10,00", "213,35", None),
  ("Indemnité compensatrice de congés payés", "2 346,80", "10,00", "234,68", None),
  ("SALAIRE BRUT", None, None, "2 581,48", None),
  ("Vieillesse plafonnée", "2 581,48", "6,90", None, "178,12"),
  ("CSG déductible", "2 536,30", "6,80", None, "172,47"),
  ("Indemnité de panier", "10,00", "9,50", "95,00", None),
  ("NET A PAYER", None, None, "2 044,10", None),
]
xs = [40, 260, 330, 400, 480]
def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
ops = []
for col in range(5):                      # colonne par colonne
    for i, r in enumerate(rows):
        v = r[col]
        if not v: continue
        y = 780 - i * 18
        if col > 0:                        # nombres alignés à droite : largeur approx.
            x = xs[col] + 60 - len(v) * 5
        else:
            x = xs[col]
        ops.append(f"BT /F1 9 Tf 1 0 0 1 {x} {y} Tm ({esc(v)}) Tj ET")
content = "\n".join(ops).encode("cp1252")
objs = []
objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>")
objs.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
out = bytearray(b"%PDF-1.4\n")
offs = []
for n, o in enumerate(objs, 1):
    offs.append(len(out))
    out += b"%d 0 obj\n" % n + o + b"\nendobj\n"
xref = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
for o in offs: out += b"%010d 00000 n \n" % o
out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
open(sys.argv[1], "wb").write(out)
