"""Los glifos acentuados *_pat de la Brasika guardan en la CharString CFF el ancho
absoluto en vez de (ancho - nominalWidthX). Según el rasterizador se lee un ancho
mayor y aparece un hueco tras á é í ó ú ü ñ. Este script lo corrige.
Uso: python scripts/fix-brasika-widths.py <entrada.otf> <salida.otf>"""
import sys
from fontTools.ttLib import TTFont

src, dst = sys.argv[1:3]
f = TTFont(src)
td = f['CFF '].cff.topDictIndex[0]
nominal = td.Private.nominalWidthX
for g in f.getGlyphOrder():
    if not g.endswith('_pat'):
        continue
    c = td.CharStrings[g]; c.decompile()
    w = f['hmtx'][g][0]
    c.program[0] = w - nominal
    print(g, w, '->', c.program[0])
f.save(dst)
