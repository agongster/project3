(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,23480,e=>{"use strict";e.s(["N",0,{scene:"overworld",hp:10,maxHp:10,combo:0,location:"Town Square",prompt:null,dungeon:null,boss:null,dashReady:1},"Q",0,225,"W",0,400,"_",0,function(e){let{owner:t,repo:r,sha:n}=e.repo;return`${t}/${r}@${n.slice(0,12)}`}])},56592,e=>{"use strict";var t=e.i(30065);let r=new Set(["tests","test"]),n=new Set(["setup.py","manage.py"]),i=/^if\s+__name__\s*==\s*["']__main__["']\s*:/m;function a(e){return e.slice(e.lastIndexOf("/")+1)}var o=e.i(85096),s=e.i(11439),l=e.i(29084);function c(e,t,r){let n=[...e.warnings];return r>0&&n.push(`${u(r,"file")} couldn't be analyzed and appear as ruins.`),{repo:e.repo,description:e.description,stars:e.stars,files:t,stats:h(t),warnings:n,demo:e.demo,readme:e.readme??null}}function m(e,c){var m,h;let u,p=function(e,t){let o,s=a(e);return"__init__.py"===s?"init":(o=a(e)).startsWith("test_")||o.endsWith("_test.py")||"conftest.py"===o||e.split("/").slice(0,-1).some(e=>r.has(e))?"test":n.has(s)||null!==t&&i.test(t)?"script":"module"}(e.path,e.source),f={file:(m=e,h=p,{path:m.path,size:m.size,lineCount:0,status:"failed",kind:h,findings:[],overflow:0,quality:d,outline:(0,t.U)()}),findings:[],fixes:new Map};if(null===e.source)return f;try{u=c(e.source).map(o.e)}catch{return f}let g=(0,o.t)(e.source),y=u.filter(e=>(0,l.T)(e.code)),b=u.filter(e=>!(0,l.T)(e.code)&&!(0,l.B)(e.code,p)),w=new Map,k=b.map(t=>{let r=(0,o.m)(e.path,t,g);return t.fix&&w.set(r,t.fix),r}),{findings:v,overflow:x}=(0,o.n)(k);return{file:{path:e.path,size:e.size,lineCount:function(e){if(""===e)return 0;let t=(0,o.t)(e);return""===t[t.length-1]?t.length-1:t.length}(e.source),status:"ok",kind:p,findings:v,overflow:x,quality:(0,s.J)(e.source,y,k.length),outline:(0,t.O)(e.source)},findings:(0,o.d)(k),fixes:w}}let d={score:0,grade:"C",highlights:[],metrics:{definitions:0,docCoverage:0,hintCoverage:0,commentRatio:0,probeHits:0}};function h(e){let t={fileCount:e.length,lineCount:0,findingCount:0,bySeverity:{minion:0,elite:0,boss:0},cleanFiles:0,buggyFiles:0};for(let r of e){for(let e of(t.lineCount+=r.lineCount,t.findingCount+=r.findings.length,r.findings))t.bySeverity[e.severity]++;r.findings.length>0?t.buggyFiles++:"ok"===r.status&&t.cleanFiles++}return t}function u(e,t){return`${e} ${t}${1===e?"":"s"}`}e.s(["P",0,function(e,t,r){let n=t.map(e=>m(e,r).file),i=n.filter((e,r)=>"failed"===e.status&&null!==t[r].source).length;return c(e,n,i)},"h",0,c,"z",0,h,"N",0,m,"G",0,u],56592)},87874,90963,18140,71587,25191,e=>{"use strict";var t=e.i(56592),r=e.i(75037);let n="/project3";e.s(["z",0,n,"T",0,!0],90963);let i={listing:"Reading the kingdom map…",downloading:"Unrolling scrolls…",linting:"Sniffing for bugs…",building:"Raising the kingdom…",done:"The kingdom awaits!"};function a(e,t=0,r=0){let n=r>0?`${i[e]} ${t}/${r}`:i[e];return{stage:e,done:t,total:r,label:n}}e.s(["f",0,a],18140);var o=e.i(29084);let s=`${n}/lint-worker.js?v=2`;class l extends Error{constructor(e){super(e),this.name="LinterDiedError"}}async function c(){let e=new Worker(s,{type:"module"});try{var t;await (t=e,new Promise((e,r)=>{let n=setTimeout(()=>i(Error("The bug detector took too long to load.")),3e4);function i(i){clearTimeout(n),t.onmessage=null,t.onerror=null,i?r(i):e()}t.onmessage=e=>{"ready"===e.data.type?i():"init-error"===e.data.type&&i(Error(`The bug detector failed to start: ${e.data.message}`))},t.onerror=e=>{e.preventDefault(),i(Error(`The bug detector failed to load${e.message?`: ${e.message}`:"."}`))},t.postMessage({type:"init",options:o.w})}))}catch(t){throw e.terminate(),t}return function(e){let t=new Map,r=1,n=null;function i(r){if(!n){for(let i of(n=r,e.terminate(),t.values()))clearTimeout(i.timer),i.reject(r);t.clear()}}function a(a,o){if(n)return Promise.reject(n);let s=r++;return new Promise((r,n)=>{let c=setTimeout(()=>i(new l("The bug detector stopped answering.")),2e4);t.set(s,{resolve:r,reject:n,timer:c}),e.postMessage({type:a,id:s,source:o})})}return e.onmessage=e=>{let r=e.data;if("result"!==r.type)return;let n=t.get(r.id);n&&(t.delete(r.id),clearTimeout(n.timer),void 0!==r.error?n.reject(Error(r.error)):n.resolve(r.value))},e.onerror=e=>{e.preventDefault(),i(new l("The bug detector crashed."))},{async lint(e){let t=await a("lint",e);return Array.isArray(t)?t:[]},async format(e){let t=await a("format",e);if("string"!=typeof t)throw Error("The formatter returned no text.");return t},dispose(){i(new l("The bug detector was shut down."))}}}(e)}async function m(e){try{return await e}catch(e){throw console.error("Lintlands: the Ruff lint worker failed to start",e),new r._("linter_failed","Couldn't start the bug detector. Try reloading the page.")}}async function d(e,t,n,i,o){let s=new Map;n(a("linting",0,e.length));for(let l=0;l<e.length;l++){(0,r.W)(i);let c=e[l].source;if(null!==c&&!s.has(c))try{s.set(c,await t.lint(c))}catch(t){console.warn(`Lintlands: Ruff could not lint ${e[l].path}`,t)}await o?.(),n(a("linting",l+1,e.length))}return s}e.s(["n",0,l,"y",0,c,"Z",0,d,"H",0,m],71587);var h=e.i(76194);let u={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",mdash:"—",ndash:"–",hellip:"…"},p=/.+?[.!?]+["')\]]*(?=\s|$)|.+$/g;function f(e,t=160){if("string"!=typeof e)return null;for(let r of function(e){let t=[],r=[],n=null,i=()=>{r.length>0&&t.push(r.join(" ")),r=[]};for(let t of e.split("\n")){let e=t.trim(),a=/^(`{3,}|~{3,})/.exec(e)?.[1];if(null!==n){a&&a[0]===n[0]&&(n=null);continue}if(a){i(),n=a;continue}if(/^#{1,6}(\s|$)/.test(e)||/^([=\-~^*#+_`])\1{2,}\s*$/.test(e.replace(/\s+/g,""))){1===r.length&&/^[=\-~^]/.test(e)&&(r=[]),i();continue}if(""===e||e.startsWith("|")||/^([-*+]|\d+[.)])\s+/.test(e)||e.startsWith(".. ")||/^:[\w-]+:/.test(e)||t.replace(/\t/g," ".repeat(4)).startsWith(" ".repeat(4))){i();continue}r.push(e.replace(/^>\s?/,""))}return i(),t}(e.slice(0,1e4).replace(/\r\n?/g,"\n").replace(/<!--[\s\S]*?-->/g,"\n"))){let e=function(e){let t=e.replace(/<!--[\s\S]*?-->/g," ").replace(/!\[[^\]]*\]\([^)]*\)/g," ").replace(/!\[[^\]]*\]\[[^\]]*\]/g," ").replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/\[([^\]]*)\]\[[^\]]*\]/g,"$1").replace(/`([^`<]*?)\s*<[^>]*>`_{1,2}/g,"$1").replace(/:[\w-]+:`([^`]*)`/g,"$1").replace(/<[^>]*>/g," ").replace(/https?:\/\/\S+/g," ").replace(/`+/g,"").replace(/\*+|__/g,"").replace(/:[a-z0-9_+-]+:/g," ");return(0,h.R)(t.replace(/&#(\d{1,6});/g,(e,t)=>{let r=Number(t);return r>=32&&r<=1114111?String.fromCodePoint(r):""}).replace(/&([a-z]+);/gi,(e,t)=>u[t.toLowerCase()]??"").replace(/\[\s*\]|\(\s*\)/g," "))}(r.slice(0,2e3));if((0,h.x)(e)>=24&&(0,h.K)(e)>=4)return function(e,t){let r="";for(let n of e.match(p)??[]){let e=`${r} ${n.trim()}`.trim();if(Array.from(e).length>t)break;r=e}return r||(0,h.w)(e,t)}(e,t)}return null}e.s(["f",0,f],25191);let g={owner:"lintlands",repo:"demo-kingdom",ref:"main",sha:"d3c0de5ca1ab1ec0ffee0ba5eba11c0de5d3e0aa"},y=`# Crumbleton Bakery & Potion Shop

[![build](https://img.shields.io/badge/build-crumbly-orange.svg)](https://example.com/ci) ![license](https://img.shields.io/badge/license-MIT-blue.svg)

<p align="center"><img src="docs/storefront.png" width="320"></p>

The **friendliest** bakery-and-potion shop in the kingdom, run entirely by [Python](https://www.python.org) scripts. We bake at dawn and brew at dusk. Please do not feed the cauldron.

## Getting started

\`\`\`bash
python main.py
\`\`\`
`,b=String.raw,w=[{path:"main.py",source:b`"""Crumbleton Bakery & Potion Shop: the front door of the kingdom."""

import rich

from bakery.oven import bake_batch, describe
from potions.ingredients import rare_ingredients


def open_shop() -> None:
    """Greet the morning customers with fresh pastries."""
    # The morning tray: always croissants, sometimes something daring.
    for pastry in bake_batch(["croissant", "cinnamon swirl"], minutes=25):
        rich.print(describe(pastry))
    for ingredient in rare_ingredients():
        print(f"Today's rare find: {ingredient.name}")


if __name__ == "__main__":
    open_shop()
`},{path:"config.py",source:b`"""Shop settings. Please don't read this file out loud."""

SHOP_NAME = "Crumbleton Bakery & Potion Shop"
OPENING_HOUR = 7

# The till is locked with the royal password.
ADMIN_PASSWORD = "sugarplum123"

# FIXME: the dragon discount should not be negative.
DRAGON_DISCOUNT = -0.5
`},{path:"bakery/__init__.py",source:""},{path:"bakery/oven.py",source:b`"""The royal oven: turns raw dough into golden, flaky pastries."""

from dataclasses import dataclass

# Every pastry bakes at the same cosy temperature (in degrees Celsius).
OVEN_TEMPERATURE = 180


@dataclass
class Pastry:
    """A single pastry, from lump of dough to crowning glory."""

    name: str
    minutes_baked: int = 0

    def is_golden(self) -> bool:
        """Return True once the pastry has baked long enough to shine."""
        # Twenty minutes is the sweet spot for most croissants.
        return self.minutes_baked >= 20


def bake(pastry: Pastry, minutes: int) -> Pastry:
    """Bake a pastry for a few more minutes and return it."""
    # Never bake for negative time; the oven is not a time machine.
    pastry.minutes_baked += max(0, minutes)
    return pastry


def bake_batch(names: list[str], minutes: int) -> list[Pastry]:
    """Bake a whole tray of pastries at once."""
    return [bake(Pastry(name), minutes) for name in names]


def describe(pastry: Pastry) -> str:
    """Describe a pastry the way the head baker would."""
    if pastry.is_golden():
        return f"A golden {pastry.name}, fresh from the oven!"
    return f"A pale {pastry.name}. Give it a few more minutes."
`},{path:"bakery/recipes.py",source:b`"""Secret recipes of the Crumbleton Bakery."""

import os
import random

# The house sourdough starter, fed every morning by the apprentice.
STARTER = {"flour": 100, "water": 100}

# TODO: ask Granny Marzipan for her cinnamon roll recipe.


def scale_recipe(recipe, servings):
    """Multiply every ingredient so the recipe feeds more hungry knights."""
    leftovers = recipe.get("leftovers")
    scaled = {}
    for ingredient, grams in recipe.items():
        scaled[ingredient] = grams * servings
    # scaled["sugar"] = scaled["sugar"] * 2
    return scaled


def pick_daily_special(recipes):
    """Let fate choose today's special."""
    if recipes == None:
        return "plain bread"
    return random.choice(list(recipes))
`},{path:"bakery/orders.py",source:b`"""Taking orders from hungry villagers (and the occasional dragon)."""


def add_to_basket(item, basket=[]):
    """Put an item in the customer's basket."""
    basket.append(item)
    return basket


def read_order(slip):
    """Read a handwritten order slip like '3 croissants'."""
    try:
        count, pastry = slip.split(" ", 1)
        return int(count), pastry
    except:
        return 0, "mystery bun"


def total_price(order):
    """Add up the cost of an order."""
    count, pastry = order
    return count * PRICES[pastry]
`},{path:"bakery/pricing.py",source:b`"""How much does a pastry cost today? It depends... on everything."""


def price_of(pastry, day, customer, weather, coupon):
    """Work out the price of one pastry. Good luck."""
    price = 3
    if pastry == "croissant":
        price = 4
    elif pastry == "eclair":
        price = 5
    elif pastry == "dragonfruit tart":
        price = 9
    if day == "Saturday":
        price += 1
    elif day == "Monday":
        price -= 1
    if customer == "knight":
        price -= 1
    elif customer == "dragon":
        price *= 10
    if weather == "rainy":
        if coupon:
            price -= 2
        else:
            price -= 1
    if coupon is "HALFOFF":
        price = price / 2
    for _ in range(3):
        if price < 1:
            price += 1
    return price
`},{path:"potions/__init__.py",source:b`"""Potions: brewing, bottling and labelling magical drinks."""

from .ingredients import Ingredient

__all__ = ["Ingredient"]
`},{path:"potions/brewing.py",source:b`"""The Grand Cauldron's brewing instructions. Handle with oven mitts."""

import subprocess


def brew(recipe_text: str) -> float:
    """Brew a potion from a recipe such as '2 * newt + 3 * moonlight'."""
    ingredients = {"newt": 1.5, "moonlight": 2.0, "glitter": 0.5}
    # Let Python do the maths for us. What could possibly go wrong?
    return eval(recipe_text, {}, ingredients)


def bottle(potion_name: str) -> None:
    """Ask the bottling machine to fill a bottle with the named potion."""
    subprocess.run(f"bottler --fill {potion_name}", shell=True, check=True)
`},{path:"potions/cauldron.py",source:b`"""The cauldron itself. Someone stirred a little too hard."""


class Cauldron:
    """A big iron pot that bubbles ominously."""

    def __init__(self, size: int) -> None:
        self.size = size
        self.contents: list[str] = []

    def add(self, ingredient: str) -> None:
        """Drop an ingredient into the brew."""
        self.contents.append(ingredient

    def stir(self, times: int) -> str:
        """Stir the brew clockwise, as tradition demands."""
        return "bubble " * times
`},{path:"potions/ingredients.py",source:b`"""A field guide to potion ingredients and where to find them."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Ingredient:
    """Something that can go into a potion."""

    name: str
    rarity: int
    found_in: str

    def is_rare(self):
        """Rare ingredients are worth a detour."""
        return self.rarity >= 3


# The witch's shopping list, sorted from common to legendary.
PANTRY = [
    Ingredient("newt eye", 1, "the pond"),
    Ingredient("moonlight", 3, "the hill at midnight"),
    Ingredient("dragon scale", 5, "a very grumpy dragon"),
]


def find(name):
    """Look up an ingredient by name, or return None."""
    for ingredient in PANTRY:
        if ingredient.name == name:
            return ingredient
    return None


def rare_ingredients() -> list[Ingredient]:
    """All ingredients rare enough to brag about."""
    return [item for item in PANTRY if item.is_rare()]
`},{path:"potions/labels.py",source:b`"""Printing labels for potion bottles, with appropriate warnings."""

WARNINGS = {"fizzy": "May cause hiccups.", "glowing": "Do not drink after dark."}


def label_for(potion_name, effects):
    """Write the label text for one bottle."""
    if not potion_name:
        ValueError("Every potion needs a name!")
    lines = [potion_name.upper()]
    for effect in effects:
        if effect in WARNINGS.keys():
            lines.append(WARNINGS[effect])
    return "\n".join(lines)


def make_printers(colors):
    printers = []
    for color in colors:
        printers.append(lambda text: f"[{color}] {text}")
    return printers
`},{path:"tests/test_oven.py",source:b`"""Tests for the royal oven."""

from bakery.oven import Pastry, bake, describe


def test_fresh_pastry_is_not_golden() -> None:
    assert not Pastry("croissant").is_golden()


def test_baking_long_enough_makes_it_golden() -> None:
    assert bake(Pastry("eclair"), 25).is_golden()


def test_negative_minutes_are_ignored() -> None:
    assert bake(Pastry("bun"), -10).minutes_baked == 0


def test_description_mentions_the_name() -> None:
    assert "croissant" in describe(Pastry("croissant", 30))
`},{path:"tests/test_recipes.py",source:b`"""Tests for the secret recipes."""

from bakery.recipes import scale_recipe


def test_scaling_doubles_everything() -> None:
    """Twice the knights, twice the flour."""
    doubled = scale_recipe({"flour": 100, "egg": 2}, 2)
    assert doubled == {"flour": 200, "egg": 4}


def test_scaling_by_zero_empties_the_bowl() -> None:
    """Nobody is hungry today."""
    original = {"flour": 100}
    result = scale_recipe({"flour": 100}, 0)
    assert result == {"flour": 0}
`},{path:"tools/inventory.py",source:b`"""Counting what is left in the pantry at the end of the day."""

from collections import Counter


def count_items(shelf):
    """Count how many of each item are on a shelf."""
    return Counter(shelf)


def low_stock(counts, threshold=3):
    """Items that are running low and need restocking."""
    return sorted(name for name, amount in counts.items() if amount < threshold)


def merge_shelves(*shelves):
    total = Counter()
    for shelf in shelves:
        total.update(count_items(shelf))
    return total
`},{path:"tools/restock.py",source:b`"""Restocking the pantry from the market cart. Run it every morning."""

import json


def load_delivery(path):
    """Read the market cart's delivery note."""
    try:
        with open(path) as note:
            return json.load(note)
    except Exception:
        return {}


def restock(pantry, delivery):
    """Add delivered goods to the pantry."""
    list = sorted(delivery)
    for item in list:
        pantry[item] = pantry.get(item, 0) + delivery[item]
    # TODO: send a thank-you note to the market witch.
    return pantry


if __name__ == "__main__":
    print(restock({}, load_delivery("delivery.json")))
`}],k=[{path:"README.md",text:y},{path:"requirements.txt",text:`# Everything the shop needs to open its doors.
rich>=13.0
`},{path:"pyproject.toml",text:`[project]
name = "crumbleton-bakery"
version = "0.3.1"
description = "The friendliest bakery-and-potion shop in the kingdom."
requires-python = ">=3.11"
dependencies = ["rich>=13.0"]

[tool.ruff]
line-length = 100
`},{path:"shop.yaml",text:`# Opening hours and house rules of the Crumbleton Bakery & Potion Shop.
shop:
  name: Crumbleton Bakery & Potion Shop
  opens: "07:00"
  closes: "19:00"
oven:
  temperature_celsius: 180
cauldron:
  stir_clockwise: true
  # Never leave it unattended after dusk.
  max_bubbles: 99
`}],v={listing:400,perDownload:70,perLint:40,building:300};function x(e,t){return new Promise((n,i)=>{if(t?.aborted)return i((0,r.R)());let a=setTimeout(()=>{t?.removeEventListener("abort",o),n()},e);function o(){clearTimeout(a),i((0,r.R)())}t?.addEventListener("abort",o,{once:!0})})}function S(e){return new TextEncoder().encode(e).length}async function _(e,t,r=x){let n=w.length;e(a("listing")),await r(v.listing,t);for(let i=0;i<=n;i++)e(a("downloading",i,n)),i<n&&await r(v.perDownload,t)}async function B(e,t,r={}){let n=r.sleep??x,i=(r.createLintClient??c)();i.catch(()=>void 0);try{await _(e,t,n);let r=await m(i),o=await d(w,r,e,t,()=>n(v.perLint,t));e(a("building")),await n(v.building,t);let s=T(e=>o.get(e)??[]);return e(a("done")),s}finally{i.then(e=>e.dispose(),()=>void 0)}}function T(e){return(0,t.P)(P(),w.map(e=>({path:e.path,size:S(e.source),source:e.source})),e)}function P(){return{repo:g,description:"The Crumbleton Bakery & Potion Shop — a tiny kingdom to practise on.",stars:113,demo:!0,warnings:[],readme:f(y)}}e.s(["i",0,v,"v",0,k,"q",0,g,"z",0,w,"s",0,B,"$",0,T,"w",0,P,"j",0,x,"_",0,_,"o",0,S],87874)},75037,e=>{"use strict";class t extends Error{code;retryAfterSec;constructor(e,t,r){super(t),this.name="AnalyzeError",this.code=e,this.retryAfterSec=r}}function r(){return new t("aborted","Analysis cancelled.")}e.s(["_",0,t,"R",0,r,"W",0,function(e){if(e?.aborted)throw r()}])},29084,e=>{"use strict";var t=e.i(74727);let r=["D100","D101","D102","D103","ANN001","ANN201","ANN202","E501","E701","E702","N801","N802","N803","N806"],n=new Set(["S105","S106","S107","S108","PLR0913"]),i={"target-version":"py314","line-length":100,lint:{select:["F","E711","E712","E721","E722","E731","E741","B","S","C901","PLE","PLR0911","PLR0913","PLR0915","PLW0120","PLW0127","PLW0128","PLW0129","PLW0131","PLW0133","PLW0177","PLW0211","PLW0602","PLW0642","PLW0711","PLW1501","PLW1508","PLW2101","PLW3301","BLE001","A001","A002","ERA001","FIX001","FIX002","FIX003","FIX004","SIM101","SIM102","SIM103","SIM110","SIM118","SIM210","SIM300",...r],ignore:["S101","S311","S603","S606","S607","B028","B905","B911","B912","F405"],mccabe:{"max-complexity":10},pylint:{"max-args":8,"max-returns":6,"max-statements":50},"flake8-builtins":{ignorelist:["id","type","format","help","dir","input","hash","filter","vars","bin","hex","ascii","license","copyright","credits","exit","quit"]}}},a=new Set(r),o="SYNTAX",s={dustBunny:"unused",todoMite:"todo",echoBat:"style",gremlin:"bug",phantom:"bug",mimic:"trap",swallowToad:"error-handling",spaghetti:"complexity",keyThief:"security",evalSerpent:"security",glitchKing:"syntax"},l={[o]:{monster:"glitchKing",title:"Syntax error",tip:"Python can't read this file at all — check the marked line for a missing bracket, colon or quote."},F622:{monster:"glitchKing",title:"Two starred targets",tip:"Python won't compile this file: only one `*name` is allowed on the left of `=`."},F701:{monster:"glitchKing",title:"`break` outside a loop",tip:"Python won't compile this file: `break` only works inside a `for` or `while` loop."},F702:{monster:"glitchKing",title:"`continue` outside a loop",tip:"Python won't compile this file: `continue` only works inside a `for` or `while` loop."},F704:{monster:"glitchKing",title:"`yield` outside a function",tip:"Python won't compile this file: move the `yield` into a function (or remove it)."},F706:{monster:"glitchKing",title:"`return` outside a function",tip:"Python won't compile this file: `return` only works inside a function."},F707:{monster:"glitchKing",title:"Bare `except` before others",tip:"Python won't compile this file: the bare `except:` must be the last handler."},PLE0115:{monster:"glitchKing",title:"Both `nonlocal` and `global`",tip:"Python won't compile this file: a name is either `nonlocal` or `global`, not both."},PLE0117:{monster:"glitchKing",title:"`nonlocal` with nothing to bind",tip:"Python won't compile this file: `nonlocal` needs the name in an enclosing function."},PLE0118:{monster:"glitchKing",title:"Name used before `global`",tip:"Python won't compile this file: put the `global` line before the name is used."},PLE1142:{monster:"glitchKing",title:"await outside async function",tip:"Python won't compile this file: mark the function `async def`, or don't await here."},F401:{monster:"dustBunny",title:"Unused import",tip:"Delete the import, or add the name to `__all__` if it is meant to be re-exported."},F402:{monster:"mimic",title:"Loop variable hides an import",tip:"Rename the loop variable so it doesn't replace the imported module."},F403:{monster:"echoBat",title:"Wildcard import",tip:"Import the names you need explicitly so readers know where they come from."},F541:{monster:"echoBat",title:"f-string without placeholders",tip:"Drop the `f` prefix — there is nothing to fill in."},F601:{monster:"gremlin",title:"Duplicate dictionary key",tip:"Only the last value survives; remove or rename the duplicate key."},F632:{monster:"gremlin",title:"`is` used with a literal",tip:"Use `==` to compare values; `is` checks identity and may randomly fail."},F811:{monster:"echoBat",title:"Redefined before use",tip:"Remove the earlier definition or give one of them a different name."},F821:{monster:"phantom",title:"Undefined name",tip:"Define or import the name before using it — or fix the typo."},F822:{monster:"phantom",title:"Undefined name in `__all__`",tip:"Only list names that the module actually defines."},F823:{monster:"phantom",title:"Variable used before assignment",tip:"Assign the variable before reading it, or mark it `global`/`nonlocal` if that was the intent."},F841:{monster:"dustBunny",title:"Unused variable",tip:"Delete the assignment, or use `_` if you only need the side effect."},F842:{monster:"dustBunny",title:"Unused annotated variable",tip:"Remove the annotation-only line if nothing uses it."},E711:{monster:"echoBat",title:"Comparison to None with ==",tip:"Write `x is None` (or `is not None`)."},E712:{monster:"echoBat",title:"Comparison to True/False",tip:"Write `if x:` or `if not x:` instead of comparing to a boolean."},E721:{monster:"echoBat",title:"Type comparison with ==",tip:"Use `isinstance(x, Kind)`, which also accepts subclasses."},E722:{monster:"swallowToad",title:"Bare except",tip:"Catch the specific exception you expect, e.g. `except ValueError:`."},E731:{monster:"echoBat",title:"Lambda assigned to a name",tip:"Use a regular `def` — it gets a real name in tracebacks."},E741:{monster:"echoBat",title:"Ambiguous variable name",tip:"Avoid `l`, `O` and `I`; they look like 1 and 0. Pick a descriptive name."},B002:{monster:"gremlin",title:"`++x` does nothing",tip:"Python has no `++` operator; write `x += 1`."},B004:{monster:"gremlin",title:"Unreliable callable check",tip:'Use `callable(x)` instead of `hasattr(x, "__call__")`.'},B005:{monster:"mimic",title:"strip() with a multi-character string",tip:"strip() removes *characters*, not a suffix — use `removeprefix`/`removesuffix`."},B006:{monster:"mimic",title:"Mutable default argument",tip:"Default to `None` and create the list/dict inside the function."},B007:{monster:"dustBunny",title:"Unused loop variable",tip:"Rename it to `_` (or `_name`) to show it is intentionally unused."},B008:{monster:"mimic",title:"Function call in default argument",tip:"Defaults are evaluated once; default to `None` and call the function inside."},B009:{monster:"echoBat",title:"getattr with a constant",tip:"Just write `obj.name` — getattr only helps when the name is dynamic."},B010:{monster:"echoBat",title:"setattr with a constant",tip:"Just write `obj.name = value`."},B011:{monster:"gremlin",title:"assert False",tip:"`python -O` strips asserts; raise `AssertionError` (or a better exception) instead."},B012:{monster:"swallowToad",title:"return/break in finally",tip:"Jumping out of `finally` silently discards any exception — move it out of the block."},B015:{monster:"gremlin",title:"Comparison result unused",tip:"The result is thrown away — did you mean to `assert` it or assign with `=`?"},B016:{monster:"gremlin",title:"Raising a literal",tip:'Raise an exception object, e.g. `raise ValueError("…")`.'},B017:{monster:"swallowToad",title:"Test catches any exception",tip:"Assert the specific exception type, or the test passes for the wrong reason."},B018:{monster:"echoBat",title:"Useless expression",tip:"This line computes a value and throws it away — delete it or use the value."},B019:{monster:"mimic",title:"lru_cache on a method",tip:"The cache keeps `self` alive forever; cache a module-level function instead."},B020:{monster:"mimic",title:"Loop variable overwrites the iterable",tip:"Give the loop variable a different name than the thing you loop over."},B023:{monster:"mimic",title:"Closure captures a loop variable",tip:"Bind the current value with a default argument (`lambda x=x: …`)."},B024:{monster:"echoBat",title:"Abstract class without abstract methods",tip:"Mark at least one method `@abstractmethod`, or drop `ABC`."},B026:{monster:"mimic",title:"*args after a keyword argument",tip:"Put `*args` before keyword arguments; the current order is confusing."},B027:{monster:"echoBat",title:"Empty method in an abstract class",tip:"Decorate it with `@abstractmethod` if subclasses must override it."},B033:{monster:"echoBat",title:"Duplicate item in a set",tip:"Remove the repeated value."},B904:{monster:"swallowToad",title:"Exception context lost",tip:"Use `raise NewError(…) from err` so the original cause is kept."},B909:{monster:"mimic",title:"List modified while looping over it",tip:"Loop over a copy (`for x in items[:]`) or build a new list."},S102:{monster:"evalSerpent",title:"Use of exec()",tip:"Avoid running strings as code; call real functions or use a lookup table."},S105:{monster:"keyThief",title:"Hardcoded password",tip:"Read secrets from an environment variable or a secrets manager, never the source."},S106:{monster:"keyThief",title:"Hardcoded password argument",tip:"Pass the secret in from an environment variable instead of a string literal."},S107:{monster:"keyThief",title:"Hardcoded password default",tip:"Don't give passwords a default value; require the caller to provide one."},S201:{monster:"evalSerpent",title:"Flask debug mode",tip:"Never ship `debug=True`; its console lets visitors run Python on your server."},S301:{monster:"evalSerpent",title:"Unsafe pickle load",tip:"Unpickling untrusted data runs arbitrary code — use JSON for data you didn't create."},S302:{monster:"evalSerpent",title:"Unsafe marshal load",tip:"`marshal` data can crash or trick the interpreter — use JSON for data you didn't create."},S307:{monster:"evalSerpent",title:"Use of eval()",tip:"Use `ast.literal_eval` for data, or parse the input explicitly."},S323:{monster:"keyThief",title:"Unverified SSL context",tip:"Use `ssl.create_default_context()`, which checks the server's certificate."},S501:{monster:"keyThief",title:"TLS verification disabled",tip:"Remove `verify=False`; it lets anyone impersonate the server and read your secrets."},S506:{monster:"evalSerpent",title:"Unsafe yaml.load",tip:"Use `yaml.safe_load`, which can't construct arbitrary objects."},S507:{monster:"keyThief",title:"SSH host key not checked",tip:"Don't auto-accept unknown host keys; load known hosts and reject the rest."},S601:{monster:"evalSerpent",title:"Shell command over SSH",tip:"Never build the remote command from input; quote it with `shlex.quote` or avoid the shell."},S602:{monster:"evalSerpent",title:"Shell injection (shell=True)",tip:"Pass a list of arguments without `shell=True` so input can't become commands."},S604:{monster:"evalSerpent",title:"Call with shell=True",tip:"Avoid `shell=True`; pass arguments as a list."},S605:{monster:"evalSerpent",title:"Command run through a shell",tip:"Use `subprocess.run([...])` with an argument list instead of `os.system`."},S608:{monster:"evalSerpent",title:"SQL built from strings",tip:"Use query parameters (`?` / `%s` placeholders) instead of formatting SQL yourself."},S609:{monster:"evalSerpent",title:"Wildcard in a shell command",tip:"A `*` in a shell command expands to file names an attacker can choose — list the files yourself."},S610:{monster:"evalSerpent",title:"Raw SQL in Django extra()",tip:"Use Django's query API (or `params=`) instead of SQL text in `extra()`."},S611:{monster:"evalSerpent",title:"Django RawSQL",tip:"Pass values through `params`, never by formatting them into the SQL text."},S612:{monster:"evalSerpent",title:"logging.config.listen",tip:"The listener runs any config sent to its port — don't open it, or pass `verify=`."},S103:{monster:"mimic",category:"security",title:"Overly open file permissions",tip:"Grant only the permissions needed, e.g. `0o600` for private files."},S104:{monster:"mimic",category:"security",title:"Listening on all interfaces",tip:"Bind to `127.0.0.1` unless the service really must be public."},S108:{monster:"mimic",category:"security",title:"Hardcoded temp file",tip:"Use the `tempfile` module so other users can't hijack the path."},S110:{monster:"swallowToad",title:"try-except-pass",tip:"At least log the exception so failures don't vanish silently."},S112:{monster:"swallowToad",title:"try-except-continue",tip:"Log the exception before skipping, so you know what went wrong."},S113:{monster:"gremlin",category:"security",title:"Request without a timeout",tip:"Pass `timeout=…` so a slow server can't hang your program forever."},S202:{monster:"mimic",category:"security",title:"Unsafe tar extraction",tip:'Pass `filter="data"` to `extractall` so archives can\'t write outside the folder.'},S306:{monster:"mimic",category:"security",title:"Insecure mktemp",tip:"Use `tempfile.mkstemp` or `NamedTemporaryFile` instead."},S310:{monster:"mimic",category:"security",title:"URL open with any scheme",tip:"Check that the URL starts with `http://` or `https://` before opening it."},S324:{monster:"mimic",category:"security",title:"Weak hash function",tip:"Use SHA-256 for security, or pass `usedforsecurity=False` for checksums."},S701:{monster:"mimic",category:"security",title:"Template autoescape off",tip:"Turn autoescaping on so user input can't inject HTML."},C901:{monster:"spaghetti",title:"Function too complex",tip:"Split it into smaller helper functions, each doing one thing."},PLR0911:{monster:"spaghetti",title:"Too many return statements",tip:"Simplify the branching, e.g. with a lookup table or early validation."},PLR0912:{monster:"spaghetti",title:"Too many branches",tip:"Extract groups of branches into helper functions."},PLR0913:{monster:"spaghetti",title:"Too many arguments",tip:"Group related arguments into a dataclass or split the function."},PLR0915:{monster:"spaghetti",title:"Function too long",tip:"Break the function into smaller, well-named steps."},PLE0704:{monster:"gremlin",title:"Bare raise outside except",tip:"A lone `raise` only works inside an `except` block; raise a specific exception."},PLE1205:{monster:"gremlin",title:"Too many logging arguments",tip:"Make the number of `%s` placeholders match the arguments."},PLE1206:{monster:"gremlin",title:"Too few logging arguments",tip:"Make the number of `%s` placeholders match the arguments."},PLW0120:{monster:"echoBat",title:"Pointless else on a loop",tip:"Without a `break`, the `else` always runs — un-indent its body."},PLW0127:{monster:"echoBat",title:"Variable assigned to itself",tip:"`x = x` does nothing; remove it."},PLW0129:{monster:"gremlin",title:"Assert on a string (always true)",tip:"A non-empty string is always truthy; assert the actual condition."},PLW0133:{monster:"gremlin",title:"Exception created but not raised",tip:"Add `raise` in front — right now the error is silently ignored."},PLW0177:{monster:"gremlin",title:"Comparison with NaN",tip:"NaN never equals anything; use `math.isnan(x)`."},PLW0211:{monster:"gremlin",title:"Static method with `self`",tip:"Remove `@staticmethod` or the `self` parameter."},PLW0602:{monster:"echoBat",title:"Unneeded global statement",tip:"`global` is only needed when you assign to the name; delete it."},PLW0642:{monster:"mimic",title:"Reassigning self",tip:"Assigning to `self` only changes a local name; return a new object instead."},PLW0711:{monster:"mimic",title:"`except A or B`",tip:"This only catches A — write `except (A, B):`."},PLW1508:{monster:"gremlin",title:"Non-string env var default",tip:"Environment variables are strings; use a string default and convert it."},PLW3301:{monster:"echoBat",title:"Nested min/max",tip:"Flatten it: `max(a, b, c)`."},BLE001:{monster:"swallowToad",title:"Catching every exception",tip:"Catch the exceptions you expect; let real bugs surface."},A001:{monster:"mimic",title:"Variable shadows a builtin",tip:"Rename it — the builtin (like `list` or `str`) is hidden for the rest of the scope."},A002:{monster:"mimic",title:"Argument shadows a builtin",tip:"Rename the parameter so the builtin stays usable inside the function."},ERA001:{monster:"todoMite",title:"Commented-out code",tip:"Delete it — version control remembers old code for you."},FIX001:{monster:"todoMite",title:"FIXME comment",tip:"Fix it now, or turn it into an issue so it isn't forgotten."},FIX002:{monster:"todoMite",title:"TODO comment",tip:"Finish the TODO or move it to the issue tracker."},FIX003:{monster:"todoMite",title:"XXX comment",tip:"Resolve the note or turn it into an issue."},FIX004:{monster:"todoMite",title:"HACK comment",tip:"Replace the hack with a proper solution when you can."},SIM101:{monster:"echoBat",title:"Repeated isinstance calls",tip:"Merge them: `isinstance(x, (A, B))`."},SIM102:{monster:"echoBat",title:"Nested ifs",tip:"Combine them with `and` into a single `if`."},SIM103:{monster:"echoBat",title:"Needless if/return True",tip:"Return the condition directly: `return x > 0`."},SIM110:{monster:"echoBat",title:"Loop re-implements any()/all()",tip:"Use `any(...)` or `all(...)` — shorter and clearer."},SIM118:{monster:"echoBat",title:"`in dict.keys()`",tip:"Write `key in d`; `.keys()` is unnecessary."},SIM210:{monster:"echoBat",title:"`True if x else False`",tip:"Write `bool(x)`."},SIM300:{monster:"echoBat",title:"Yoda comparison",tip:"Put the variable first: `if answer == 42`."}},c=[{prefix:"SIM",row:{monster:"echoBat",title:"Code that could be simpler",tip:"There is a shorter, clearer way to write this."}},{prefix:"PLR",row:{monster:"spaghetti",title:"Overgrown code",tip:"Split this into smaller pieces."}},{prefix:"PLW",row:{monster:"gremlin",title:"Suspicious code",tip:"This probably doesn't do what it looks like — double-check it."}},{prefix:"PLE",row:{monster:"gremlin",title:"Code that will crash",tip:"Python will raise an error here at runtime — fix the marked line."}},{prefix:"FIX",row:{monster:"todoMite",title:"Leftover note",tip:"Resolve the note or move it to the issue tracker."}},{prefix:"ERA",row:{monster:"todoMite",title:"Commented-out code",tip:"Delete it — version control remembers old code for you."}},{prefix:"BLE",row:{monster:"swallowToad",title:"Catching every exception",tip:"Catch only the exceptions you expect."}},{prefix:"C9",row:{monster:"spaghetti",title:"Function too complex",tip:"Split it into smaller helper functions."}},{prefix:"F5",row:{monster:"gremlin",title:"Broken string formatting",tip:"Make the placeholders match the arguments you pass."}},{prefix:"F",row:{monster:"gremlin",title:"Likely bug",tip:"Pyflakes is sure something is wrong here — read the message closely."}},{prefix:"E",row:{monster:"echoBat",title:"Style slip",tip:"Tidy up this line as the message suggests."}},{prefix:"A",row:{monster:"mimic",title:"Name shadows a builtin",tip:"Rename it so the builtin stays usable."}},{prefix:"B",row:{monster:"gremlin",title:"Python gotcha",tip:"This pattern often hides a bug — read the message and double-check."}},{prefix:"S",row:{monster:"evalSerpent",title:"Security risk",tip:"This can be abused by an attacker; follow the message to make it safe."}}],m={monster:"gremlin",title:"Suspicious code",tip:"The linter flagged this line — read the message and double-check it."};e.s(["w",0,i,"$",0,o,"B",0,function(e,t){return"test"===t&&n.has(e)},"T",0,function(e){return a.has(e)},"z",0,function(e){let r=l[e]??c.find(t=>e.startsWith(t.prefix))?.row??m;return{title:r.title,tip:r.tip,monster:r.monster,severity:t.v[r.monster].severity,category:r.category??s[r.monster]}}])},74727,e=>{"use strict";let t=[{id:"twig",slot:"weapon",rarity:"common",starter:!0,name:"Trusty Twig",blurb:"Every great debugger starts with a stick.",style:"swing",damage:1,cooldownMs:280,range:20,knockback:6},{id:"bugNet",slot:"weapon",rarity:"common",name:"Bug Net",blurb:"Huge swoosh. Catches bugs. Literally.",style:"swing",damage:1,cooldownMs:320,range:30,knockback:4},{id:"keyboard",slot:"weapon",rarity:"common",name:"Clacky Keyboard",blurb:"Mechanical switches. Maximum bonk.",style:"slam",damage:2,cooldownMs:520,range:22,knockback:10},{id:"lintRoller",slot:"weapon",rarity:"common",name:"Lint Roller",blurb:"Rolls right through the fuzz.",style:"thrust",damage:1,cooldownMs:300,range:34,knockback:8},{id:"rubberDuck",slot:"weapon",rarity:"rare",name:"Rubber Duck",blurb:"Explain the bug to it. Then throw it.",style:"projectile",damage:2,cooldownMs:380,range:110,knockback:6},{id:"formatterBlade",slot:"weapon",rarity:"rare",name:"Formatter Blade",blurb:"88 columns of razor-sharp consistency.",style:"swing",damage:2,cooldownMs:220,range:24,knockback:6},{id:"typeBow",slot:"weapon",rarity:"rare",name:"Type-Hint Bow",blurb:"def arrow() -> Ouch:",style:"projectile",damage:2,cooldownMs:340,range:150,knockback:5,pierce:!0},{id:"gitBoomerang",slot:"weapon",rarity:"rare",name:"Git Boomerang",blurb:"Whatever you push comes back.",style:"boomerang",damage:2,cooldownMs:560,range:90,knockback:4},{id:"refactorHammer",slot:"weapon",rarity:"epic",name:"Refactor Hammer",blurb:"Breaks big problems into small ones.",style:"slam",damage:4,cooldownMs:600,range:34,knockback:14},{id:"debugWand",slot:"weapon",rarity:"epic",name:"Debugger Wand",blurb:"Sets breakpoints that chase the bug.",style:"projectile",damage:2,cooldownMs:260,range:140,knockback:3,homing:!0},{id:"snakeWhip",slot:"weapon",rarity:"epic",name:"Python Whip",blurb:"import antigravity; crack!",style:"thrust",damage:3,cooldownMs:300,range:52,knockback:9},{id:"mergeSaber",slot:"weapon",rarity:"legendary",name:"Merge Saber",blurb:"Resolves every conflict in one stroke.",style:"swing",damage:3,cooldownMs:200,range:30,knockback:8,wave:!0},{id:"zenStaff",slot:"weapon",rarity:"legendary",name:"Staff of Zen",blurb:"Beautiful is better than ugly.",style:"nova",damage:3,cooldownMs:480,range:56,knockback:12},{id:"goldenDuck",slot:"weapon",rarity:"legendary",name:"Golden Duck",blurb:"The quack heard around the codebase.",style:"boomerang",damage:4,cooldownMs:420,range:110,knockback:8}],r=[{id:"beanie",slot:"hat",rarity:"common",starter:!0,name:"Cozy Beanie",blurb:"Standard-issue late-night coding hat."},{id:"strawHat",slot:"hat",rarity:"common",starter:!0,name:"Straw Hat",blurb:"For touching grass."},{id:"partyHat",slot:"hat",rarity:"common",name:"Party Hat",blurb:"It compiled on the first try!"},{id:"headphones",slot:"hat",rarity:"common",name:"Headphones",blurb:"Lo-fi beats to squash bugs to."},{id:"catEars",slot:"hat",rarity:"rare",name:"Cat Ears",blurb:"Nyan-level productivity."},{id:"flowerCrown",slot:"hat",rarity:"rare",name:"Flower Crown",blurb:"Woven from the cleanest functions."},{id:"topHat",slot:"hat",rarity:"rare",name:"Top Hat",blurb:"Distinguished engineer."},{id:"wizardHat",slot:"hat",rarity:"epic",name:"Wizard Hat",blurb:"For regex sorcery."},{id:"snakeHood",slot:"hat",rarity:"epic",name:"Snake Hood",blurb:"Become the Python."},{id:"halo",slot:"hat",rarity:"legendary",name:"Halo",blurb:"Zero warnings. Zero sins."},{id:"crown",slot:"hat",rarity:"legendary",name:"Royal Crown",blurb:"Benevolent ruler for life."}],n=[{id:"sparkleTrail",slot:"trail",rarity:"common",name:"Sparkle Steps",blurb:"Leave a little glitter behind.",colors:["#fff6a9","#ffffff","#ffd66b"],shape:"sparkle"},{id:"petalTrail",slot:"trail",rarity:"rare",name:"Petal Path",blurb:"Flowers bloom where you walk.",colors:["#ffb7c5","#ff8fab","#ffe5ec"],shape:"petal"},{id:"heartTrail",slot:"trail",rarity:"rare",name:"Heart Beat",blurb:"You love clean code and it shows.",colors:["#ff6b81","#ff9aa2"],shape:"heart"},{id:"bitTrail",slot:"trail",rarity:"epic",name:"Bit Stream",blurb:"0s and 1s tumble out of your pockets.",colors:["#7cf5a4","#3ddc84","#b8ffd0"],shape:"bit"},{id:"rainbowTrail",slot:"trail",rarity:"legendary",name:"Rainbow Road",blurb:"All six colors of the merge graph.",colors:["#ff6b6b","#ffa94d","#ffd43b","#69db7c","#4dabf7","#b197fc"],shape:"note"}],i=[...t,{id:"hotCoffee",slot:"charm",rarity:"common",name:"Hot Coffee",blurb:"+15% move speed. Jittery but effective.",effect:"speed",value:.15},{id:"coinMagnet",slot:"charm",rarity:"common",name:"Coin Magnet",blurb:"Coins fly to you from far away.",effect:"magnet",value:40},{id:"heartCookie",slot:"charm",rarity:"rare",name:"Heart Cookie",blurb:"+1 heart. Baked with love.",effect:"maxHp",value:2},{id:"luckyClover",slot:"charm",rarity:"rare",name:"Lucky Clover",blurb:"+50% coins from everything.",effect:"coins",value:.5},{id:"springBoots",slot:"charm",rarity:"rare",name:"Spring Boots",blurb:"Dash twice as often. Boing.",effect:"dash",value:.5},{id:"cactusBuddy",slot:"charm",rarity:"epic",name:"Cactus Buddy",blurb:"Anything that bumps you gets poked.",effect:"thorns",value:2},{id:"docScarf",slot:"charm",rarity:"epic",name:"Docstring Scarf",blurb:"Slowly heals you. Well-documented warmth.",effect:"regen",value:8},{id:"greenCheck",slot:"charm",rarity:"legendary",name:"Green Checkmark",blurb:"All tests passing: 30% chance of double damage.",effect:"crit",value:.3},...r,{id:"duckling",slot:"pet",rarity:"common",name:"Duckling",blurb:"Waddles after you and nudges coins your way.",perk:"collector",flies:!1},{id:"snek",slot:"pet",rarity:"rare",name:"Snek",blurb:"A tiny python. Bites bugs for you.",perk:"fighter",flies:!1},{id:"byteBat",slot:"pet",rarity:"rare",name:"Byte Bat",blurb:"Sniffs out extra coins.",perk:"lucky",flies:!0},{id:"pixelCat",slot:"pet",rarity:"epic",name:"Pixel Cat",blurb:"Knocks monsters off the table.",perk:"fighter",flies:!1},{id:"cloudPuff",slot:"pet",rarity:"epic",name:"Cloud Puff",blurb:"Rains the occasional heart.",perk:"healer",flies:!0},{id:"starSprite",slot:"pet",rarity:"legendary",name:"Star Sprite",blurb:"A fallen star that showers you in luck.",perk:"lucky",flies:!0},...n],a=new Map(i.map(e=>[e.id,e])),o=[{id:"meadow",name:"Sunny Meadow",blurb:"Green hills, daisies and a warm breeze.",ambient:"pollen",accent:"#7ec850",dark:!1},{id:"sakura",name:"Sakura Spring",blurb:"Pink blossoms drifting over soft grass.",ambient:"petals",accent:"#ff9ebb",dark:!1},{id:"autumn",name:"Maple Autumn",blurb:"Crunchy leaves and golden afternoons.",ambient:"leaves",accent:"#e8833a",dark:!1},{id:"snow",name:"Snowy Hollow",blurb:"A quiet village under fresh powder.",ambient:"snow",accent:"#9fd8f0",dark:!1},{id:"beach",name:"Coral Coast",blurb:"Sandy paths, palm trees and sea spray.",ambient:"bubbles",accent:"#3cc7c0",dark:!1},{id:"night",name:"Firefly Night",blurb:"Lantern light and fireflies after dark.",ambient:"fireflies",accent:"#8a7dff",dark:!0}],s=[{name:"Tomato",hex:"#e5484d"},{name:"Pumpkin",hex:"#f08c3a"},{name:"Sunflower",hex:"#f2c94c"},{name:"Leaf",hex:"#58b368"},{name:"Lagoon",hex:"#3cc7c0"},{name:"Cornflower",hex:"#4a90e2"},{name:"Grape",hex:"#7c5cff"},{name:"Peony",hex:"#e667af"},{name:"Cocoa",hex:"#8d6e63"},{name:"Cloud",hex:"#f1f3f5"},{name:"Charcoal",hex:"#343a40"},{name:"Wine",hex:"#9b2c4a"},{name:"Forest",hex:"#3a7a4a"},{name:"Navy",hex:"#2c4580"},{name:"Blossom",hex:"#ffb3c7"},{name:"Lilac",hex:"#b9a2f0"},{name:"Ice",hex:"#a6dcf2"},{name:"Lime",hex:"#a6c84a"},{name:"Oat",hex:"#e8d6b0"},{name:"Camel",hex:"#b5835a"},{name:"Slate",hex:"#7a8691"}],l=s.length+1;e.s(["y",0,i,"Z",0,["None","Cape","Backpack","Wings","Quiver","Tail"],"z",0,10,"O",0,["Hijab"],"p",0,["None","Glasses","Round specs","Shades","Eye patch","Monocle"],"D",0,[{name:"Dark",hex:"#2b1d34"},{name:"Brown",hex:"#7a4526"},{name:"Hazel",hex:"#8f7a2a"},{name:"Green",hex:"#2e9a52"},{name:"Blue",hex:"#3473e0"},{name:"Grey",hex:"#6f8296"},{name:"Violet",hex:"#8a52e0",fantasy:!0},{name:"Amber",hex:"#d4881a",fantasy:!0},{name:"Ruby",hex:"#d0344a",fantasy:!0}],"H",0,["Dot","Sparkle","Sleepy","Happy","Wide","Wink","Lashes","Fierce"],"_",0,[0,1,4,6,3,5,2,7],"m",0,["None","Blush","Freckles","Beauty mark","Scar","Face paint","Bandage"],"s",0,["None","Mustache","Goatee","Short beard","Beard"],"B",0,[{name:"Espresso",hex:"#3b2a20"},{name:"Chestnut",hex:"#6b4226"},{name:"Copper",hex:"#a8672f"},{name:"Golden",hex:"#e3b55c"},{name:"Flaxen",hex:"#f4e3b1"},{name:"Scarlet",hex:"#d9534f",fantasy:!0},{name:"Bubblegum",hex:"#ff8fab",fantasy:!0},{name:"Violet",hex:"#7c5cff",fantasy:!0},{name:"Sky",hex:"#4dabf7",fantasy:!0},{name:"Mint",hex:"#3ddc97",fantasy:!0},{name:"Snow",hex:"#e9ecef"},{name:"Black",hex:"#2b2b35"},{name:"Ash brown",hex:"#8b6b52"},{name:"Ginger",hex:"#c8582a"},{name:"Strawberry",hex:"#e2a072"},{name:"Grey",hex:"#a3a8b4"},{name:"Berry",hex:"#b8336a",fantasy:!0},{name:"Lavender",hex:"#b79cff",fantasy:!0},{name:"Indigo",hex:"#3d4fc4",fantasy:!0},{name:"Teal",hex:"#1f9e9a",fantasy:!0}],"x",0,[11,0,1,12,2,13,14,3,4,15,10,5,16,6,17,7,18,8,19,9],"e",0,["Short","Bob","Long","Ponytail","Spiky","Curly","Buns","Bald","Pixie","Undercut","Buzz","Mohawk","Afro","Puffs","Braids","Locs","Wavy","Twintails","Hijab"],"q",0,[7,10,0,8,9,4,11,5,12,13,1,6,3,17,14,15,2,16,18],"l",0,r,"C",0,[{faceDetail:0,eyewear:0},{faceDetail:0,eyewear:1},{faceDetail:1,eyewear:0},{faceDetail:2,eyewear:0}],"L",0,["Curious Intern","Bug Spotter","Junior Debugger","Lint Apprentice","Code Gardener","Senior Squasher","Refactor Knight","Staff Purifier","Principal Sage","Benevolent Maintainer"],"G",0,[0,40,100,180,280,400,550,730,950,1200],"Y",0,2,"v",0,{dustBunny:{kind:"dustBunny",name:"Dust Bunny",severity:"minion",archetype:"hopper",hp:2,speed:22,touchDamage:1,coins:[2,4],xp:5,size:16,blurb:"Gathers wherever unused imports and variables are left lying around."},todoMite:{kind:"todoMite",name:"Todo Mite",severity:"minion",archetype:"skitter",hp:1,speed:48,touchDamage:0,coins:[3,6],xp:5,size:16,blurb:"Feeds on TODO comments. Promises it will leave 'later'."},echoBat:{kind:"echoBat",name:"Echo Bat",severity:"minion",archetype:"flutter",hp:2,speed:34,touchDamage:1,coins:[2,5],xp:6,size:16,blurb:"Repeats itself. Repeats itself. Lives in redundant code."},gremlin:{kind:"gremlin",name:"Gremlin",severity:"elite",archetype:"chaser",hp:9,speed:36,touchDamage:1,coins:[8,12],xp:15,size:16,blurb:"A plain old bug. Breaks things at runtime and giggles."},phantom:{kind:"phantom",name:"Phantom",severity:"elite",archetype:"blinker",hp:8,speed:28,touchDamage:1,coins:[8,12],xp:15,size:16,blurb:"The ghost of a name that was never defined."},mimic:{kind:"mimic",name:"Mimic",severity:"elite",archetype:"ambusher",hp:10,speed:60,touchDamage:1,coins:[10,16],xp:18,size:16,blurb:"Looks like harmless code. It is not harmless code."},swallowToad:{kind:"swallowToad",name:"Swallow Toad",severity:"elite",archetype:"spitter",hp:9,speed:20,touchDamage:1,coins:[8,12],xp:15,size:16,blurb:"Gulps down exceptions whole so nobody ever hears about them."},spaghetti:{kind:"spaghetti",name:"Spaghetti Beast",severity:"elite",archetype:"tank",hp:9,speed:16,touchDamage:1,coins:[12,18],xp:20,size:24,blurb:"A function so tangled it became sentient."},keyThief:{kind:"keyThief",name:"Key Thief",severity:"boss",archetype:"boss",hp:33,speed:40,touchDamage:2,coins:[30,40],xp:50,size:32,blurb:"Collects passwords that were hardcoded in plain sight."},evalSerpent:{kind:"evalSerpent",name:"Eval Serpent",severity:"boss",archetype:"boss",hp:39,speed:34,touchDamage:2,coins:[30,40],xp:50,size:32,blurb:"Will happily execute anything you feed it."},glitchKing:{kind:"glitchKing",name:"Glitch King",severity:"boss",archetype:"boss",hp:36,speed:30,touchDamage:2,coins:[30,40],xp:50,size:32,blurb:"Rules over code that does not even parse."}},"f",0,["Smile","Grin","Open","Smirk","Tongue","Flat"],"c",0,["Tee","Hoodie","Overalls","Dress","Robe","Jacket","Sweater","Apron","Armor","Cloak","Sporty","Kimono","Tunic"],"U",0,l,"I",0,s,"b",0,[0,11,1,19,8,2,18,17,3,12,4,16,5,13,6,15,7,14,9,20,10],"o",0,[0,10,1,6,5,2,7,3,11,12,4,9,8],"E",0,["common","rare","epic","legendary"],"g",0,{common:{label:"Common",color:"#9fb4c7",stars:1,dupeRefund:8},rare:{label:"Rare",color:"#5aa9ff",stars:2,dupeRefund:20},epic:{label:"Epic",color:"#c77dff",stars:3,dupeRefund:50},legendary:{label:"Legendary",color:"#ffc93c",stars:4,dupeRefund:120}},"r",0,[{name:"Peach",hex:"#ffe0c2"},{name:"Sand",hex:"#f6c9a0"},{name:"Honey",hex:"#e0a878"},{name:"Caramel",hex:"#c68653"},{name:"Cocoa",hex:"#9a5f3c"},{name:"Umber",hex:"#6b4027"},{name:"Porcelain",hex:"#fff0e4"},{name:"Olive",hex:"#c9a079"},{name:"Bronze",hex:"#b2714a"},{name:"Ebony",hex:"#4e2e20"},{name:"Moss",hex:"#a9d79a",fantasy:!0},{name:"Frost",hex:"#bccbff",fantasy:!0}],"n",0,[6,0,1,2,7,3,8,4,5,9,10,11],"X",0,"twig","$",0,o,"J",0,16,"h",0,n,"P",0,t,"t",0,function(e){return a.get(e)},"k",0,function(e){return o.find(t=>t.id===e)??o[0]},"i",0,function(e){let r=a.get(e);return r&&"weapon"===r.slot?r:t[0]}])},13473,e=>{"use strict";function t(e){let t=0x811c9dc5;for(let r=0;r<e.length;r++)t^=e.charCodeAt(r),t=Math.imul(t,0x1000193);return t>>>0}function r(e){let t=e>>>0;return()=>{let e=t=t+0x6d2b79f5>>>0;return e=Math.imul(e^e>>>15,1|e),(((e^=e+Math.imul(e^e>>>7,61|e))^e>>>14)>>>0)/0x100000000}}e.s(["o",0,function(e,t){return e()<t},"I",0,t,"a",0,r,"O",0,function(e,t){if(0===t.length)throw Error("pick() called with an empty list");return t[Math.floor(e()*t.length)]},"D",0,function(e,t,r){return t+Math.floor(e()*(r-t+1))},"Y",0,function(e,t,r){return t+e()*(r-t)},"b",0,function(e){return r(t(e))},"c",0,function(e,t){let r=t.slice();for(let t=r.length-1;t>0;t--){let n=Math.floor(e()*(t+1));[r[t],r[n]]=[r[n],r[t]]}return r},"r",0,function(e,t){let r=t.reduce((e,t)=>e+t,0),n=e()*r;for(let e=0;e<t.length;e++)if((n-=t[e])<0)return e;return t.length-1}])},27639,e=>{"use strict";e.s(["U",0,{Grass:0,Meadow:1,Path:2,Plaza:3,Water:4,Sand:5,Bridge:6,DungeonFloor:7,DungeonFloorAlt:8,DungeonWall:9,DungeonWallFace:10,DungeonVoid:11,DungeonExit:12},"x",0,["dustBunny","todoMite","echoBat","gremlin","phantom","mimic","swallowToad","spaghetti","keyThief","evalSerpent","glitchKing"]])}]);