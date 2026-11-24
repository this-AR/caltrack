"""Build assets/foods.json from INDB (cooked Indian recipes) + IFCT 2017 (raw foods) + a small curated list.
Usage: python build_foods.py <data_dir> <out_json>
Every nutrient is per 100 g, in the units of NUTRIENTS below (must match src/nutrients.ts order).
"""
import json, re, sys, math
import pandas as pd

DATA, OUT = sys.argv[1], sys.argv[2]
NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'chol', 'calcium', 'phosphorus',
             'magnesium', 'sodium', 'potassium', 'iron', 'zinc', 'copper', 'manganese', 'selenium', 'vitA', 'vitE',
             'vitD', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'folate', 'vitC']

def num(v):
    try:
        v = float(v)
        return 0.0 if math.isnan(v) else v
    except (TypeError, ValueError):
        return 0.0

def rnd(v):
    return round(v, 3) if v < 10 else round(v, 1)

foods = []

# ---------- INDB: 1014 cooked recipes, per-100g values + one household serving ----------
d = pd.read_excel(f'{DATA}/indb/INDB.xlsx')
BOWLISH = {'bowl', 'small bowl', 'curry bowl', 'soup bowl', 'dish', 'plate', 'casserole dish', 'souffle dish'}
PORTIONS = {'bowl', 'small bowl', 'curry bowl', 'soup bowl', 'plate', 'small plate', 'cup', 'tea cup', 'glass',
            'tall glass', 'portion'}
for _, r in d.iterrows():
    kcal = num(r.energy_kcal)
    vals = [kcal, num(r.protein_g), num(r.carb_g), num(r.fat_g), num(r.fibre_g), num(r.freesugar_g),
            num(r.sfa_mg) / 1000, num(r.cholesterol_mg), num(r.calcium_mg), num(r.phosphorus_mg), num(r.magnesium_mg),
            num(r.sodium_mg), num(r.potassium_mg), num(r.iron_mg), num(r.zinc_mg), num(r.copper_mg),
            num(r.manganese_mg), num(r.selenium_ug), num(r.vita_ug), num(r.vite_mg),
            num(r.vitd3_ug),  # vitd2 is inherited from IFCT's implausible plant D2 values (e.g. 31 µg in a ladoo)
            num(r.vitk1_ug) + num(r.vitk2_ug), num(r.vitb1_mg), num(r.vitb2_mg), num(r.vitb3_mg), num(r.vitb5_mg),
            num(r.vitb6_mg), num(r.vitb7_ug), max(num(r.folate_ug), num(r.vitb9_ug)), num(r.vitc_mg)]
    # ~35 INDB rows (mostly soups/consommes) have macros 1.5-6x what their kcal allows; kcal is the plausible one,
    # so scale protein..satfat down to match it. Micros are left as published.
    atw = 4 * vals[1] + 4 * vals[2] + 9 * vals[3] + 2 * vals[4]
    if kcal > 0 and atw > 1.25 * kcal:
        vals[1:7] = [v * kcal / atw for v in vals[1:7]]
    servings = []
    unit = str(r.servings_unit).strip() if isinstance(r.servings_unit, str) else ''
    if kcal > 0 and num(r.unit_serving_energy_kcal) > 0 and unit:
        g = num(r.unit_serving_energy_kcal) / kcal * 100
        # INDB sometimes gives the whole recipe yield as "1 bowl"/"1 plate"/"1 cup" (up to 1100 g); drop those
        if 1 <= g <= (500 if unit in PORTIONS else 2000):
            servings.append([f'1 {unit}', round(g)])
    if unit in BOWLISH or not servings:
        servings.append(['1 katori', 150])  # standard Indian katori ~150 g cooked dish
    name = str(r.food_name).strip()
    foods.append({'id': 'indb:' + r.food_code, 'name': name, 'alt': '', 'src': 'INDB', 'grp': 'Recipes',
                  'serv': servings, 'n': [rnd(v) for v in vals]})

# ---------- IFCT 2017: 542 raw foods, all values in grams/100g, energy in kJ ----------
f = pd.read_csv(f'{DATA}/ifct/package/index.csv')
f.columns = [c.split('; ')[1] for c in f.columns]
G = lambda r, c, mult=1.0: num(r.get(c)) * mult
dupe = f['name'].str.strip().duplicated(keep=False)  # e.g. marine vs freshwater "Crab", "Cat fish"
for i, r in f.iterrows():
    grp = str(r.get('grup') or 'Raw')
    vita = G(r, 'retol', 1e6) + G(r, 'cartbeq', 1e6) / 12  # µg RAE
    kcal = G(r, 'enerc') / 4.184
    atw = 4 * G(r, 'protcnt') + 4 * G(r, 'choavldf') + 9 * G(r, 'fatce') + 2 * G(r, 'fibtg')
    if kcal == 0 or (atw > 50 and kcal > 1.8 * atw):  # oils/ghee have enerc=0; chicken leg enerc is a typo (1605 kJ)
        kcal = atw
    # IFCT lists D2 for cereals, pulses, spices, fruit (up to 118 µg/100 g); only fungi and milk really have it
    d2 = G(r, 'ergcal', 1e6) if grp in ('Mushrooms', 'Milk and Milk Products') else 0
    b6 = G(r, 'vitb6c', 1e3)
    b6 = b6 / 1000 if b6 > 3 else b6  # fish/shellfish/egg-white B6 is published in µg (100-316 "mg")
    biot = G(r, 'biot', 1e6)
    biot = biot / 1000 if biot > 200 else biot  # fish/liver biotin is published in ng (1000-2875 "µg")
    vals = [kcal, G(r, 'protcnt'), G(r, 'choavldf'), G(r, 'fatce'), G(r, 'fibtg'), G(r, 'fsugar'),
            G(r, 'fasat'), G(r, 'cholc', 1e3), G(r, 'ca', 1e3), G(r, 'p', 1e3), G(r, 'mg', 1e3), G(r, 'na', 1e3),
            G(r, 'k', 1e3), G(r, 'fe', 1e3), G(r, 'zn', 1e3), G(r, 'cu', 1e3), G(r, 'mn', 1e3), G(r, 'se', 1e6),
            vita, G(r, 'tocpha', 1e3), d2 + G(r, 'chocal', 1e6),
            G(r, 'vitk1', 1e6) + G(r, 'vitk2', 1e6), G(r, 'thia', 1e3), G(r, 'ribf', 1e3), G(r, 'nia', 1e3),
            G(r, 'pantac', 1e3), b6, biot, G(r, 'folsum', 1e6), G(r, 'vitc', 1e3)]
    lang = str(r.get('lang') or '')
    hindi = re.findall(r'(?:^|; )H\. ([^;.]+)', lang)
    eng = re.findall(r'(?:^|; )E\. ([^;.]+)', lang)
    alt = ', '.join(hindi + eng)
    serv = [['1 tbsp', 15]] if grp in ('Edible Oils and Fats', 'Condiments and Spices', 'Sugars') else []
    name = str(r['name']).strip()
    if dupe[i]:
        name += f", {str(r.get('scie') or r['code']).strip()}"
    if grp == 'Egg and Egg Products' and 'whole' in name:
        serv = [['1 egg', 50]]
    if name.startswith('Milk,'):
        serv = [['1 glass', 250]]
    # "(raw)" only where it is true: not on boiled eggs, omelettes, juices, oils, sugars, spices, dried fruit
    cooked = re.search(r'\bboiled|omlet|roasted|juice|dried|powder', name, re.I)
    if not cooked and grp not in ('Edible Oils and Fats', 'Sugars', 'Condiments and Spices'):
        name += ' (raw)'
    foods.append({'id': 'ifct:' + r['code'], 'name': name, 'alt': alt, 'src': 'IFCT',
                  'grp': grp, 'serv': serv, 'n': [rnd(max(v, 0)) for v in vals]})

# ---------- curated: everyday items missing or awkward in the two tables (approx. USDA/label values) ----------
# name, alt, servings, kcal, protein, carbs, fat, fiber, sugar, satfat, calcium, sodium, potassium, iron[, {other key: value}]
CUR = [
    ('Whey protein powder', 'whey, protein shake', [['1 scoop', 30]], 400, 78, 10, 6, 0, 6, 3, 500, 300, 600, 1),
    ('Egg, whole, boiled', 'anda, ande, egg', [['1 egg', 50]], 155, 12.6, 1.1, 10.6, 0, 1.1, 3.3, 50, 124, 126, 1.2,
     {'chol': 373, 'vitA': 149, 'vitD': 2.2, 'folate': 44, 'selenium': 30, 'b2': 0.51}),
    ('Egg white, boiled', 'anda safedi', [['1 egg white', 33]], 52, 10.9, 0.7, 0.2, 0, 0.7, 0, 7, 166, 163, 0.1),
    ('Banana', 'kela', [['1 medium', 118]], 89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 5, 1, 358, 0.3,
     {'vitC': 8.7, 'b6': 0.37, 'magnesium': 27}),
    ('Apple', 'seb', [['1 medium', 180]], 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 6, 1, 107, 0.1, {'vitC': 4.6}),
    ('Milk, toned', 'doodh, milk', [['1 glass', 250], ['1 cup', 150]], 58, 3.1, 4.7, 3, 0, 4.7, 1.9, 120, 45, 150, 0.1,
     {'chol': 10, 'b2': 0.17, 'phosphorus': 95}),
    ('Curd / dahi', 'dahi, yogurt, curd', [['1 katori', 150]], 60, 3.1, 4.7, 3.3, 0, 4.7, 2.1, 121, 46, 155, 0.1,
     {'chol': 13, 'b2': 0.14, 'phosphorus': 95}),
    ('Greek yogurt, plain', 'hung curd', [['1 cup', 170]], 73, 10, 3.9, 1.9, 0, 3.6, 1.2, 110, 36, 141, 0.1, {'chol': 5}),
    ('Paneer', 'cottage cheese', [['1 cube', 20], ['1 katori', 100]], 265, 18.3, 1.2, 20.8, 0, 1.2, 13, 480, 22, 120, 0.2,
     {'chol': 90, 'phosphorus': 300}),
    ('Tofu, firm', 'soya paneer', [['1 slice', 80]], 144, 17.3, 2.8, 8.7, 2.3, 0.6, 1.3, 683, 14, 237, 2.7),
    ('Soya chunks, dry', 'nutrela, soya bari', [['1 katori dry', 50]], 345, 52, 33, 0.5, 13, 0, 0.1, 350, 20, 2000, 20),
    ('Oats, rolled', 'daliya oats', [['1/2 cup dry', 40]], 389, 16.9, 66.3, 6.9, 10.6, 1, 1.2, 54, 2, 429, 4.7),
    ('Peanut butter', 'moongphali butter', [['1 tbsp', 16]], 588, 25, 20, 50, 6, 9, 10, 43, 430, 649, 1.9),
    ('Peanuts, roasted', 'moongphali, mungfali', [['1 handful', 30]], 585, 23.7, 21.5, 49.7, 8, 4.2, 6.9, 54, 6, 658, 2.3),
    ('Almonds', 'badam', [['10 almonds', 12]], 579, 21.2, 21.6, 49.9, 12.5, 4.4, 3.8, 269, 1, 733, 3.7),
    ('Chicken breast, cooked', 'chicken', [['1 piece', 120]], 165, 31, 0, 3.6, 0, 0, 1, 15, 74, 256, 1,
     {'chol': 85, 'b3': 13.7, 'selenium': 27}),
    ('Bread, white', 'double roti, bread', [['1 slice', 25]], 265, 9, 49, 3.2, 2.7, 5, 0.7, 260, 491, 115, 3.6),
    ('Bread, brown/whole wheat', 'atta bread', [['1 slice', 28]], 247, 13, 41, 3.4, 7, 6, 0.7, 107, 450, 248, 2.5),
    ('Ghee', 'desi ghee', [['1 tsp', 5], ['1 tbsp', 14]], 900, 0, 0, 100, 0, 0, 62, 0, 0, 0, 0,
     {'chol': 256, 'vitA': 840, 'vitE': 2.8}),
    ('Sugar', 'cheeni, shakkar', [['1 tsp', 5]], 387, 0, 100, 0, 0, 100, 0, 1, 1, 2, 0),
    ('Cola / soft drink', 'coke, pepsi, thums up', [['1 can', 330]], 42, 0, 10.6, 0, 0, 10.6, 0, 2, 4, 2, 0),
    ('Black coffee', 'coffee', [['1 cup', 240]], 1, 0.1, 0, 0, 0, 0, 0, 2, 2, 49, 0),
    # home-style Indian staples that INDB lacks or ranks below look-alikes (approx. home-recipe values)
    ('Rice, cooked (plain)', 'chawal, bhat, steamed rice, boiled rice, plain rice', [['1 katori', 150], ['1 plate', 250]],
     130, 2.7, 28.2, 0.3, 0.4, 0.1, 0.1, 10, 1, 35, 0.2, {'phosphorus': 43, 'magnesium': 12, 'b1': 0.02}),
    ('Jeera rice', 'cumin rice, zeera rice', [['1 katori', 150], ['1 plate', 250]],
     155, 2.8, 28, 3.5, 0.5, 0.2, 1.8, 12, 200, 40, 0.4),
    ('Toor dal, cooked (arhar dal tadka)', 'arhar dal, tuvar dal, tur dal, toor dal, dal fry, dal tadka, pigeon pea',
     [['1 katori', 150]], 118, 6.5, 15, 3, 3, 0.5, 1.2, 25, 250, 300, 1.3, {'folate': 60, 'magnesium': 35}),
    ('Rajma curry', 'rajmah, rajma masala, kidney beans', [['1 katori', 150]],
     126, 5.5, 15, 4, 5, 2, 0.6, 40, 300, 350, 1.8, {'folate': 70}),
    ('Chole (chickpea curry)', 'chhole, chana masala, kabuli chana, chickpea curry, pindi chole', [['1 katori', 150]],
     158, 6, 18, 6, 5, 2, 0.8, 45, 350, 250, 2, {'folate': 90}),
    ('Paneer butter masala', 'paneer makhani, butter paneer', [['1 katori', 150]],
     205, 7, 8, 16, 1.2, 4, 9, 150, 400, 180, 0.8, {'chol': 40}),
    ('Chicken biryani', 'murgh biryani, biriyani', [['1 plate', 300], ['1 katori', 150]],
     185, 9, 22, 7, 0.8, 1, 2.5, 20, 400, 170, 0.9, {'chol': 35}),
    ('Jalebi', 'jilebi, imarti', [['1 piece', 30]], 380, 2.5, 60, 15, 0.5, 45, 6, 15, 20, 30, 0.6),
    ('Buttermilk (chaas)', 'chaas, chhachh, mattha, majjige, salted buttermilk', [['1 glass', 250]],
     22, 1.5, 2, 0.8, 0, 2, 0.5, 60, 150, 80, 0.1),
    ('Mango, ripe', 'aam, mango', [['1 medium (flesh)', 150], ['1 cup sliced', 165]],
     60, 0.8, 15, 0.4, 1.6, 13.7, 0.1, 11, 1, 168, 0.2, {'vitC': 36, 'vitA': 54, 'folate': 43}),
]
for i, c in enumerate(CUR):
    name, alt, serv, kcal, p, cb, fat, fib, sug, sf, ca, na, k, fe = c[:14]
    n = [0.0] * len(NUTRIENTS)
    for key, v in list(zip(['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'calcium', 'sodium',
                            'potassium', 'iron'], [kcal, p, cb, fat, fib, sug, sf, ca, na, k, fe])) + \
            list((c[14] if len(c) > 14 else {}).items()):
        n[NUTRIENTS.index(key)] = v
    foods.append({'id': f'cur:{i}', 'name': name, 'alt': alt, 'src': 'Common', 'grp': 'Common', 'serv': serv, 'n': n})

assert all(len(x['n']) == len(NUTRIENTS) for x in foods)
assert len({x['id'] for x in foods}) == len(foods)
for x in foods:  # curated rows must be Atwater-consistent; report the rest
    a = 4 * x['n'][1] + 4 * x['n'][2] + 9 * x['n'][3] + 2 * x['n'][4]
    if max(a, x['n'][0]) > 20 and abs(a - x['n'][0]) > 0.25 * max(a, x['n'][0]):
        assert x['src'] != 'Common', x['name']
        print('energy vs macros off >25%:', x['id'], x['name'], x['n'][0], round(a))
json.dump({'nutrients': NUTRIENTS, 'foods': foods}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False,
          separators=(',', ':'))
print(len(foods), 'foods ->', OUT)
for q in ['rajma', 'rice', 'chapati', 'dal', 'paneer']:
    print(q, [x['name'] for x in foods if q in x['name'].lower()][:6])
