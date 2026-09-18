import json, re, glob, os

SRC="/sessions/charming-practical-bell/mnt/HUB Drive constructeurs/dreame_sav/faq_pem.html"
OUT="/sessions/charming-practical-bell/mnt/HUB Drive constructeurs/dreame_sav/faq_robot.html"
html=open(SRC,encoding="utf-8").read()

# --- load data ---
fr=json.load(open("/sessions/charming-practical-bell/mnt/HUB Drive constructeurs/dreame_sav/_faq_build/fr_entries.json",encoding="utf-8"))
for e in fr: e["en"]=e.get("en","")
data=list(fr)
for f in sorted(glob.glob("/sessions/charming-practical-bell/mnt/HUB Drive constructeurs/dreame_sav/_faq_build/b*.json")):
    data+=json.load(open(f,encoding="utf-8"))

# model order
ORDER=['D9 Plus','D10 Plus','D10s','D10s Plus','D10s Pro','D20','D20 Plus','D20 Pro','D20 Pro Plus',
 'E20','E20 Plus','E40 Ultra','L10 Pro','L10 Ultra','L10s Ultra','P10 Ultra','P10 Pro Ultra',
 'S20 Ultra','X40 Ultra','X50 Ultra','X60 Ultra','Z10 Pro',"Kit raccordement d'eau",'Tous modèles']
present=set()
for e in data:
    for m in e["m"]: present.add(m)
MODELS=[m for m in ORDER if m in present]+sorted(m for m in present if m not in ORDER)
CATS=['Dépannage','Info produit','Fonctions & réglages','Consommables & entretien','Caractéristiques','Batterie & charge','Divers']

# sort data by category order then model
ci={c:i for i,c in enumerate(CATS)}
data.sort(key=lambda e:(ci.get(e["c"],99), e["m"][0] if e["m"] else "", e["q"]))

def jrow(e):
    return json.dumps({"m":e["m"],"c":e["c"],"q":e["q"],"a":e["a"],"en":e.get("en","")},ensure_ascii=False)
faq_js="const FAQ = [\n"+",\n".join(jrow(e) for e in data)+"\n];"

# replace FAQ array
html=re.sub(r"const FAQ = \[.*?\n\];", faq_js.replace('\\','\\\\'), html, flags=re.S)
# replace MODELS
html=re.sub(r"const MODELS = \[.*?\];", "const MODELS = "+json.dumps(MODELS,ensure_ascii=False)+";", html)
# robust en
html=html.replace("it.q + ' ' + it.a + ' ' + it.en + ' '", "it.q + ' ' + it.a + ' ' + (it.en||'') + ' '")
# title
html=html.replace("<title>FAQ Aspirateurs laveurs — PEM · SAV Dreame · Fnac Darty</title>",
                  "<title>FAQ Robots aspirateurs — SAV Dreame · Fnac Darty</title>")
# hero
html=html.replace("<h1>FAQ Aspirateurs laveurs</h1>","<h1>FAQ Robots aspirateurs laveurs</h1>")
html=html.replace("<p>Questions fréquentes et dépannage — gammes H11, H12, M12 et H15.</p>",
                  "<p>Questions fréquentes et dépannage — robots Dreame (D, E, L, P, S, X, Z).</p>")
# nav: add FAQ Robot link and set active
old_nav='''  <nav>
    <a href="dreame.html">Recherche</a>
    <a href="lecteur_bom.html">Lecteur BOM</a>
    <a href="pem.html">PEM</a>
    <a href="faq_pem.html" class="active">FAQ</a>
  </nav>'''
new_nav='''  <nav>
    <a href="dreame.html">Recherche</a>
    <a href="lecteur_bom.html">Lecteur BOM</a>
    <a href="pem.html">PEM</a>
    <a href="faq_pem.html">FAQ Aspis laveurs</a>
    <a href="faq_robot.html" class="active">FAQ Robots</a>
  </nav>'''
html=html.replace(old_nav,new_nav)
# footer
html=html.replace("SAV Dreame — FAQ PEM","SAV Dreame — FAQ Robots")
# placeholder search
html=html.replace('placeholder="Rechercher un symptôme, une pièce, un code…"',
                  'placeholder="Rechercher un symptôme, un modèle, une pièce…"')

open(OUT,"w",encoding="utf-8").write(html)
print("Wrote",OUT)
print("Entries:",len(data)," Models:",len(MODELS))
print("Models:",MODELS)
# stats per category
from collections import Counter
print(Counter(e["c"] for e in data))
