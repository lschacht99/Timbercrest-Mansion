#!/usr/bin/env python3
"""Builds the Timbercrest Mansions static website (real .html files).
Run:  python3 build.py
Edit page content in the PAGES section below, then re-run to regenerate.
Every page is crawlable HTML with its own <title>, meta description, and JSON-LD.
"""
import os, html

OUT = os.path.dirname(os.path.abspath(__file__))
BASE = "https://timbercrestmansions.com"

PROPS = [
    dict(id="the-timbercrest", name="The Timbercrest", br=12, sleeps=32, baths=12.5,
         price=2450, minN=2, pets="allowed", rating=4.97, reviews=86, city="West Dover, Vermont",
         g1="#3a3f49", g2="#16181d", cluster=False,
         title="The Timbercrest — 12BR | Sleeps 32 | Indoor Pool | Hot Tub | Near Mt. Snow",
         desc="The flagship estate at the foot of Mount Snow, built by local legend Jack Ridgeway. Twelve bedrooms for up to 32 guests, with an indoor heated pool, hot tubs, a full game room and sweeping mountain views.",
         amenities=["Indoor pool","Hot tub","Sauna","Game room","Indoor fireplace","Full kitchen","Wifi","Free parking","Pets allowed","Washer & dryer","Fire pit","Ski storage"]),
    dict(id="the-myrtle", name="The Myrtle", br=7, sleeps=18, baths=4,
         price=1280, minN=2, pets="fee", rating=4.92, reviews=64, city="Dover, Vermont",
         g1="#6e5840", g2="#372a1d", cluster=True,
         title="The Myrtle — 7BR | Sleeps 18 | Hot Tub | Pool | Near Mt. Snow",
         desc="A warm, historic Vermont mansion for up to 18 guests. Spacious common areas, a pool and hot tub, and minutes to the lifts — ideal for family gatherings and friend getaways.",
         amenities=["Hot tub","Swimming pool","Indoor fireplace","Full kitchen","Wifi","Free parking","Family friendly","Washer & dryer","BBQ grill","Game room"]),
    dict(id="the-birch", name="The Birch", br=13, sleeps=32, baths=11,
         price=2300, minN=2, pets="no", rating=4.95, reviews=71, city="Dover, Vermont",
         g1="#54687a", g2="#26333e", cluster=True,
         title="The Birch — 13BR | Sleeps 32 | Hot Tub | Pool | Near Mt. Snow",
         desc="A spacious mansion just two minutes from Mount Snow. Thirteen bedrooms, eleven baths, room for all the gear, and the family room sits right next to the game room — built for big groups.",
         amenities=["Hot tub","Swimming pool","Game room","Indoor fireplace","Ski storage","Full kitchen","Wifi","Free parking","Washer & dryer","Sound system"]),
    dict(id="the-mahogany", name="The Mahogany", br=9, sleeps=22, baths=9.5,
         price=1750, minN=2, pets="allowed", rating=4.94, reviews=58, city="Dover, Vermont",
         g1="#7a4a3a", g2="#37201a", cluster=True,
         title="The Mahogany — 9BR | Sleeps 22 | Hot Tub | Pool | Near Mt. Snow",
         desc="Nine bedrooms — nearly every one with its own bath — for up to 22 guests. Richly appointed interiors, a pool and hot tub, and quintessential New England grounds near Mount Snow.",
         amenities=["Hot tub","Swimming pool","Indoor fireplace","Full kitchen","Wifi","Free parking","Pets allowed","Washer & dryer","Piano","Patio"]),
]
PETS = {"allowed": "Pets welcome", "fee": "Pets welcome (fee applies)", "no": "No pets"}
CLUSTER_GUESTS = sum(p["sleeps"] for p in PROPS if p["cluster"])  # 72
CLUSTER_BEDS = sum(p["br"] for p in PROPS if p["cluster"])        # 29
ALL_GUESTS = sum(p["sleeps"] for p in PROPS)                      # 104

REVIEWS = [
    ("Evan H.", 5, "Jan 2026", "Amazing property and location!", "Perfect for a large group — 28 of us over New Year's. The staff answered every question immediately, and being right by Mount Snow is unbeatable for a ski weekend."),
    ("Layla F.", 5, "Nov 2025", "Our Thanksgiving tradition continues", "Thank you for making our 26-year family tradition so special. The home improvements and special touches were perfect — already looking forward to next year."),
    ("Kay G.", 5, "Mar 2026", "Excellent ski house", "Great for a large family or friends. The family room next to the game room, the fabulous indoor pool, room for everyone's gear — and the property manager was right there to help."),
    ("Jose S.", 5, "Feb 2026", "Wonderful family reunion", "Every room having its own bathroom was a great convenience. Very accommodating hosts — would definitely stay again."),
]
NEARBY = [("Mount Snow",4),("Price Chopper (groceries)",12),("Dunkin'",8),("Wilmington Village",12),("Dot's Restaurant",10),("Gas & pharmacy",10)]

def photo(g1, g2, label="", cls="", style=""):
    tag = f'<span class="tag">{label}</span>' if label else ""
    return f'<div class="photo {cls}" style="--g1:{g1};--g2:{g2};{style}" role="img" aria-label="{label or "Timbercrest Mansions"}">{tag}</div>'

def stars(n): return '<span style="letter-spacing:1px">' + "★"*n + '</span>'

def head(title, desc, rel="", jsonld=""):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#16181d">
<link rel="icon" type="image/svg+xml" href="{rel}favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{rel}assets/styles.css">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={{theme:{{extend:{{fontFamily:{{serif:["Cormorant Garamond","serif"]}}}}}}}}</script>
{f'<script type="application/ld+json">{jsonld}</script>' if jsonld else ''}
</head>
<body>'''

def header(active, rel=""):
    nav = [("Stays","index.html"),("The concept","concept.html"),("Events & weddings","events.html"),("The area","area.html")]
    links = "".join(
        f'<a href="{rel}{href}" class="px-4 py-2 rounded-full transition {"bg-stone-900 text-white" if active==href else "text-stone-600 hover:bg-stone-100"}" style="text-decoration:none">{label}</a>'
        for label, href in nav)
    return f'''
<header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
    <a href="{rel}index.html" class="flex items-center gap-2 shrink-0" style="text-decoration:none">
      <span class="font-serif text-lg sm:text-xl tracking-wide text-stone-900">Timbercrest <span class="text-stone-400 hidden sm:inline">Mansions</span></span>
    </a>
    <nav class="hidden md:flex items-center gap-1 text-sm">{links}</nav>
    <div class="hidden md:block">
      {'<a href="'+rel+'booking.html?event=1" class="btn btn-primary" style="padding:.6rem 1.25rem;border-radius:99px;text-decoration:none">Plan a group stay</a>' if active!="index.html" else '<a href="'+rel+'booking.html" class="btn btn-primary" style="padding:.6rem 1.25rem;border-radius:99px;text-decoration:none">Book now</a>'}
    </div>
    <a href="{rel}booking.html" class="md:hidden btn btn-primary" style="padding:.5rem 1rem;border-radius:99px;font-size:.85rem;text-decoration:none">Book</a>
  </div>
</header>'''

def mobilenav(active, rel=""):
    items=[("Stays","index.html"),("Concept","concept.html"),("Events","events.html"),("Area","area.html"),("Booking","booking.html")]
    cells="".join(
        f'<a href="{rel}{href}" class="flex flex-col items-center gap-1 py-2.5 {"text-stone-900 font-semibold" if active==href else "text-stone-500"}" style="text-decoration:none">{label}</a>'
        for label,href in items)
    return f'<nav class="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 grid grid-cols-5 text-[10px]">{cells}</nav>'

def getting_here():
    rows=[("From Boston","≈ 2.5 hours via Route 2 / VT-100"),("From New York City","≈ 4 hours via I-91 N / VT-100"),
          ("From Hartford","≈ 2 hours via I-91 N"),("Nearest airports","Albany (ALB) ≈ 1.5 h · Hartford (BDL) ≈ 2 h")]
    r="".join(f'<div class="text-sm"><span class="font-medium">{a}</span><div class="text-stone-500">{b}</div></div>' for a,b in rows)
    return f'''<section class="rounded-xl border border-stone-200 bg-stone-50/60 p-5 sm:p-7">
  <h2 class="font-serif text-xl mb-1">Getting here</h2>
  <p class="text-sm text-stone-500 mb-4">All mansions sit in Dover &amp; West Dover, Vermont — just off scenic Route 100, minutes from the Mount Snow base. Exact address and door codes are shared after booking.</p>
  <div class="grid sm:grid-cols-2 gap-x-8 gap-y-3">{r}</div>
  <p class="text-xs text-stone-400 mt-4">Free on-site parking at every property · Winter tip: VT-100 is plowed early and often.</p>
</section>'''

def why_book_direct():
    pts=[("Best price guaranteed","Lower than Airbnb or VRBO — always."),
         ("No platform service fees","Skip the 14–20% fees other sites add at checkout."),
         ("Talk to the actual team","Direct contact with on-site managers Michelle & Ryan."),
         ("More flexible policies","Friendlier terms when you book with us directly.")]
    g="".join(f'<div class="flex gap-3 items-start text-sm"><span style="width:1.5rem;height:1.5rem;border-radius:50%;background:#1c1917;color:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto">✓</span><div><span class="font-medium">{t}</span><div class="text-stone-500">{d}</div></div></div>' for t,d in pts)
    return f'''<section class="rounded-xl border border-stone-200 bg-stone-50/70 p-5 sm:p-6">
  <h2 class="font-serif text-xl mb-1">Why book direct</h2>
  <p class="text-sm text-stone-500 mb-4">The same mansions cost more on the big platforms. Here's what booking here gets you.</p>
  <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3">{g}</div>
</section>'''

def promo():
    return '''<section class="rounded-xl bg-stone-900 text-white p-6 sm:p-8 sm:flex items-center justify-between gap-8">
  <div><p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#d97706">Book direct &amp; save</p>
  <h2 class="font-serif text-2xl mt-1">Up to 15% less than the big platforms</h2>
  <p class="text-white/70 text-sm mt-2 max-w-md">Returning guests save 10% on their next stay, and early-bird peak-season dates come with our best rates of the year. Join the VIP list for exclusive offers.</p></div>
  <form class="mt-5 sm:mt-0 shrink-0 w-full sm:w-72 flex gap-2" onsubmit="this.innerHTML='<div class=\\'text-sm\\' style=\\'background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:.6rem;padding:.75rem 1rem\\'>✓ You\\'re on the list.</div>';return false;">
    <input type="email" required placeholder="you@email.com" aria-label="Email" style="flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:.6rem;padding:.7rem .9rem;color:#fff;font:inherit">
    <button class="btn btn-white" style="padding:0 1rem">Join</button>
  </form>
</section>'''

def pet_badge(p):
    tone = "background:#f5f5f4;color:#78716c" if p["pets"]=="no" else "background:rgba(146,64,14,.1);color:#92400e"
    return f'<span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:500;padding:.25rem .6rem;border-radius:99px;{tone}">🐾 {PETS[p["pets"]]}</span>'

def footer():
    return '''<footer class="max-w-7xl mx-auto px-4 sm:px-8 mt-16 border-t border-stone-100 pt-6 pb-28 md:pb-10 text-xs text-stone-400 flex flex-wrap gap-x-6 gap-y-2">
  <span>© Timbercrest Mansions</span><span>Privacy</span><span>Terms</span><span>802-210-0018</span>
  <span class="sm:ml-auto">Best rates guaranteed when booking direct</span>
</footer>'''

def scripts(rel="", booking=False):
    s=f'<script src="{rel}assets/data.js"></script><script src="{rel}assets/site.js"></script>'
    if booking: s+=f'<script src="{rel}assets/booking.js"></script>'
    return s+"</body></html>"

def card(p, rel=""):
    return f'''<a href="{rel}stays/{p["id"]}.html" class="block fade" style="text-decoration:none">
  {photo(p["g1"],p["g2"],"",cls="",style="aspect-ratio:4/3;border-radius:.9rem")}
  <div class="mt-3">
    <div class="flex justify-between gap-3">
      <span class="font-semibold text-[15px]">{p["title"].split(" — ")[0]} — {p["br"]}BR</span>
      <span class="text-sm shrink-0">★ {p["rating"]} <span class="text-stone-400">({p["reviews"]})</span></span>
    </div>
    <div class="text-sm text-stone-500">{p["city"]} · sleeps {p["sleeps"]}</div>
    <div class="flex items-center gap-2 mt-1"><span class="text-sm"><span class="font-semibold">${p["price"]:,}</span> <span class="text-stone-500">night</span></span>{pet_badge(p) if p["pets"]!="no" else ""}</div>
  </div></a>'''

# ---------------- PAGE BUILDERS ----------------
def build_home():
    grid="".join(card(p) for p in PROPS)
    jsonld = '{"@context":"https://schema.org","@type":"LocalBusiness","name":"Timbercrest Mansions","description":"Luxury Vermont mansion rentals near Mount Snow.","address":{"@type":"PostalAddress","addressLocality":"West Dover","addressRegion":"VT","addressCountry":"US"},"telephone":"+1-802-210-0018","url":"%s","priceRange":"$$$"}' % BASE
    body=f'''
<main class="max-w-7xl mx-auto px-4 sm:px-8 py-7 space-y-12">
  <div class="fade">
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">Dover &amp; West Dover, Vermont</p>
    <h1 class="font-serif text-3xl sm:text-5xl mt-1">Luxury Vermont mansion rentals near Mount Snow</h1>
  </div>

  <div id="search-wrap" class="relative max-w-2xl">
    <div class="flex items-center gap-3 bg-white border border-stone-200 rounded-full px-5 h-14 shadow-md">
      <span>🔎</span>
      <input id="usearch" autocomplete="off" placeholder="Search mansions, weddings, things to do, places…" class="flex-1 outline-none text-sm" style="border:none">
    </div>
    <div id="search-panel" class="panel hidden mt-2 w-full p-3" style="max-height:24rem;overflow:auto"><div id="search-results"></div></div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-7 sm:gap-6">{grid}</div>

  <section class="rounded-xl overflow-hidden relative p-6 sm:p-10 text-white fade" style="background:linear-gradient(120deg,#16181d,#44403c 55%,#54687a)">
    <p class="text-[11px] uppercase tracking-[0.25em] text-white/60 font-semibold">More than 48 guests?</p>
    <h2 class="font-serif text-2xl sm:text-4xl mt-2">Rent the whole hillside.</h2>
    <p class="text-white/80 text-sm sm:text-base mt-3 max-w-xl">The Myrtle, The Birch and The Mahogany sit <b>side by side</b>. Book two or all three together — {CLUSTER_BEDS} bedrooms and up to <b>{CLUSTER_GUESTS} guests</b> on one private hillside. Add The Timbercrest for up to {ALL_GUESTS}.</p>
    <a href="events.html" class="btn btn-white inline-block mt-5" style="padding:.85rem 1.5rem;text-decoration:none">Plan a group stay →</a>
  </section>

  {promo()}
  {why_book_direct()}

  <section>
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">What to do around</p>
    <h2 class="font-serif text-2xl sm:text-3xl mt-1 mb-4">Minutes from everything</h2>
    <p class="text-stone-600 text-sm max-w-2xl">Skiing at Mount Snow, lakes and biking in summer, and some of Vermont's best fall foliage — all minutes from your private mansion. <a href="area.html" class="underline">Explore the area →</a></p>
  </section>

  {getting_here()}
</main>
{footer()}
{mobilenav("index.html")}
'''
    return head("Luxury Vermont Mansion Rentals Near Mount Snow | Timbercrest Mansions",
                "Luxury Vermont mansion rentals near Mount Snow. Sleeps up to 32 guests. Indoor pools, hot tubs, game rooms. Book direct and save. West Dover, VT.",
                rel="", jsonld=jsonld) + header("index.html") + body + scripts()

def build_listing(p):
    rel="../"
    amen="".join(f'<div class="flex items-center gap-3 text-sm text-stone-700">• {a}</div>' for a in p["amenities"])
    nearby="".join(f'<div class="flex items-center justify-between text-sm border-b border-stone-100 pb-2"><span>{n}</span><span class="text-stone-500">{m} min</span></div>' for n,m in NEARBY)
    revs="".join(f'<div class="bg-white rounded-xl border border-stone-100 p-4"><div>{stars(s)}</div><div class="font-medium text-sm mt-1">{t}</div><p class="text-sm text-stone-700 mt-1">{x}</p><div class="text-xs text-stone-400 mt-2">{nm} · {dt}</div></div>' for nm,s,dt,t,x in REVIEWS)
    gallery = (photo(p["g1"],p["g2"],"Exterior",style="grid-row:span 2;grid-column:span 2") +
               photo(p["g2"],p["g1"],"Great room") + photo(p["g1"],p["g2"],"Pool & spa") +
               photo(p["g2"],p["g1"],"Suites") + photo(p["g1"],p["g2"],"Grounds"))
    cluster_note = (f'<a href="../events.html" class="block rounded-xl border p-4 text-sm" style="border-color:rgba(146,64,14,.25);background:rgba(146,64,14,.05);text-decoration:none"><b>Need more space? This mansion has neighbors.</b><div class="text-stone-600 mt-0.5">Combine with the houses next door for up to {CLUSTER_GUESTS} guests side by side →</div></a>' if p["cluster"] else "")
    jsonld = ('{"@context":"https://schema.org","@type":"LodgingBusiness","name":"%s","description":"%s",'
              '"address":{"@type":"PostalAddress","addressLocality":"%s","addressRegion":"VT","addressCountry":"US"},'
              '"numberOfRooms":%d,"priceRange":"$%d+/night",'
              '"aggregateRating":{"@type":"AggregateRating","ratingValue":%s,"reviewCount":%d},"url":"%s/stays/%s"}'
              ) % (p["name"], p["desc"].replace('"',"'"), p["city"].split(",")[0], p["br"], p["price"], p["rating"], p["reviews"], BASE, p["id"])
    body=f'''
<main class="max-w-6xl mx-auto px-4 sm:px-8 pb-32 lg:pb-16">
  <a href="../index.html" class="inline-flex items-center gap-2 text-sm py-4" style="text-decoration:none">← All mansions</a>
  <h1 class="font-serif text-2xl sm:text-4xl">{p["name"]}</h1>
  <p class="text-stone-600 text-sm mt-1 font-medium">{p["br"]}BR · Sleeps {p["sleeps"]} · {p["amenities"][0]} · {p["amenities"][1]} · Near Mt. Snow</p>
  <p class="text-stone-500 text-sm">{p["city"]}</p>

  <div class="mt-4 relative" style="display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:.5rem;height:24rem;border-radius:1rem;overflow:hidden">{gallery}
    <a href="../booking.html?ids={p['id']}" class="btn btn-white" style="position:absolute;bottom:.75rem;right:.75rem;padding:.6rem 1rem;text-decoration:none;box-shadow:0 10px 20px rgba(0,0,0,.15)">📅 Check availability</a>
  </div>

  <div class="lg:grid lg:grid-cols-[1fr_360px] lg:gap-12 mt-8">
    <div>
      <div class="pb-6 border-b border-stone-200">
        <h2 class="text-lg font-semibold">Entire mansion · {p["sleeps"]} guests · {p["br"]} BR · {p["baths"]} baths</h2>
        <div class="flex flex-wrap items-center gap-3 mt-2 text-sm">★ {p["rating"]} · <span class="underline">{p["reviews"]} reviews</span> {pet_badge(p)} <span class="text-stone-500">· {p["minN"]}-night minimum</span></div>
      </div>
      <div class="py-6">{cluster_note}</div>
      <p class="pb-6 border-b border-stone-200 text-stone-700">{p["desc"]}</p>
      <div class="py-6 border-b border-stone-200"><h2 class="font-semibold mb-4">What this place offers</h2><div class="grid sm:grid-cols-2 gap-y-3 gap-x-6">{amen}</div></div>
      <div class="py-6 border-b border-stone-200">{why_book_direct()}</div>
      <div class="py-6 border-b border-stone-200"><h2 class="font-semibold mb-1">What's nearby</h2><p class="text-sm text-stone-500 mb-4">Drive times from the property.</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">{nearby}</div></div>
      <div class="py-6">
        <div class="rounded-xl bg-stone-50 border border-stone-200 p-5 sm:p-6">
          <h2 class="font-semibold mb-4">★ {p["rating"]} · {p["reviews"]} reviews</h2>
          <div class="grid sm:grid-cols-2 gap-5">{revs}</div>
        </div>
      </div>
    </div>
    <aside class="hidden lg:block">
      <div class="border border-stone-200 rounded-xl p-6 sticky top-24" style="box-shadow:0 20px 40px -12px rgba(0,0,0,.08)">
        <div class="flex items-baseline gap-1 mb-4"><span class="text-xl font-semibold">${p["price"]:,}</span><span class="text-stone-500 text-sm">night</span></div>
        <a href="../booking.html?ids={p['id']}" class="btn btn-primary block text-center" style="padding:.9rem;text-decoration:none">Reserve</a>
        <p class="fine">You won't be charged yet · {p["minN"]}-night minimum</p>
      </div>
    </aside>
  </div>
</main>

<div class="lg:hidden fixed left-0 right-0 bg-white/95 backdrop-blur border-t border-stone-200 px-4 py-3 flex items-center justify-between z-30" style="bottom:3.5rem">
  <div class="text-sm"><span class="font-semibold">${p["price"]:,}</span> night<div class="text-xs text-stone-500">{p["minN"]}-night min</div></div>
  <a href="../booking.html?ids={p['id']}" class="btn btn-primary" style="padding:.75rem 1.5rem;text-decoration:none">Reserve</a>
</div>
{footer()}
{mobilenav("", rel)}
'''
    return head(f'{p["name"]} — {p["br"]}BR Vermont Mansion Near Mount Snow | Timbercrest Mansions',
                f'{p["name"]}: {p["br"]} bedrooms, sleeps {p["sleeps"]}, {p["baths"]} baths. {", ".join(p["amenities"][:3])}. {p["city"]}. Book direct and save.',
                rel=rel, jsonld=jsonld) + header("", rel) + body + scripts(rel)

def build_events():
    houses="".join(f'<div class="rounded-xl overflow-hidden border border-stone-200">{photo(p["g1"],p["g2"],p["name"],style="height:8rem")}<div class="p-4 text-sm"><b>{p["name"]}</b><div class="text-stone-500">{p["br"]} BR · sleeps {p["sleeps"]}</div></div></div>' for p in PROPS if p["cluster"])
    vignettes=[("#3a3f49","#16181d","The morning","Getting ready with your mom and your best friends in a sunlit suite, coffee going cold because nobody can stop laughing."),
               ("#6e5840","#372a1d","The moment","Vows in the formal garden, the Green Mountains behind you, the people who raised you in the front row."),
               ("#54687a","#26333e","The night","Dancing in the carriage barn until late — then everyone wanders home across the lawn, together under the same stars.")]
    vig="".join(f'<div>{photo(a,b,l,style="height:14rem;border-radius:.9rem")}<p class="text-sm text-stone-600 mt-3">{t}</p></div>' for a,b,l,t in vignettes)
    types=[("Weddings","Multi-day destination weddings with on-site lodging for all."),("Reunions","26-year traditions happen here. Every family under one (or three) roofs."),("Corporate retreats","Ballrooms, libraries and breakout-ready common areas."),("Milestones","Anniversaries, galas and private parties in New England style.")]
    typ="".join(f'<div class="rounded-xl border border-stone-200 p-5"><div class="font-medium text-sm">{t}</div><p class="text-xs text-stone-500 mt-1">{d}</p></div>' for t,d in types)
    body=f'''
<main class="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-14">
  <section class="rounded-xl overflow-hidden relative p-7 sm:p-14 text-white fade" style="background:linear-gradient(135deg,#372a1d,#44403c 60%,#16181d)">
    <p class="text-[11px] uppercase tracking-[0.25em] text-white/60 font-semibold">Weddings &amp; events in Vermont</p>
    <h1 class="font-serif text-3xl sm:text-5xl mt-3 max-w-2xl">A timeless celebration in the Green Mountains</h1>
    <p class="text-white/80 mt-4 text-sm sm:text-base max-w-2xl">Close your eyes for a second. Your grandmother on the veranda at golden hour. Cousins racing across the lawn. Your first dance under the beams of a restored carriage barn — and everyone you love asleep just up the stairs, not across town in a hotel. That's what this place is for.</p>
    <a href="booking.html?event=1" class="btn btn-white inline-block mt-6" style="padding:.85rem 1.5rem;text-decoration:none">Start an event inquiry</a>
  </section>

  <section>
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">Picture your day</p>
    <h2 class="font-serif text-2xl sm:text-3xl mt-1 mb-5">The memories book themselves</h2>
    <div class="grid sm:grid-cols-3 gap-4">{vig}</div>
  </section>

  <section>
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">48+ guests? This is the move</p>
    <h2 class="font-serif text-2xl sm:text-3xl mt-1 mb-2">Three mansions, side by side</h2>
    <p class="text-stone-600 text-sm sm:text-base max-w-2xl">The Myrtle, The Birch and The Mahogany are neighbors on the same hillside. Most venues cap your guest list — here, you simply add a mansion. Grandparents in one house, the wedding party next door, the families with little ones in the third. Nobody you love gets left off the list.</p>
    <div class="grid sm:grid-cols-3 gap-4 mt-6">{houses}</div>
    <div class="mt-4 rounded-xl bg-stone-900 text-white p-6 sm:p-8 sm:flex items-center justify-between gap-8">
      <div class="grid grid-cols-3 gap-6 text-center sm:text-left">
        <div><div class="font-serif text-3xl">{CLUSTER_GUESTS}</div><div class="text-xs text-white/60 uppercase">guests, 3 houses</div></div>
        <div><div class="font-serif text-3xl">{CLUSTER_BEDS}</div><div class="text-xs text-white/60 uppercase">bedrooms</div></div>
        <div><div class="font-serif text-3xl">{ALL_GUESTS}</div><div class="text-xs text-white/60 uppercase">with The Timbercrest</div></div>
      </div>
      <a href="booking.html?event=1&ids=the-myrtle,the-birch,the-mahogany" class="btn btn-white inline-block mt-6 sm:mt-0" style="padding:.85rem 1.5rem;text-decoration:none">Check multi-mansion availability</a>
    </div>
    <p class="text-xs text-stone-400 mt-2">Mix and match — rent any two, all three, or all four. Anytime, not just for events.</p>
  </section>

  <section>
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">Beyond weddings</p>
    <h2 class="font-serif text-2xl sm:text-3xl mt-1 mb-5">Any occasion worth gathering for</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">{typ}</div>
  </section>

  <section><h2 class="font-serif text-2xl mb-3">Everything to do, minutes away</h2><p class="text-stone-600 text-sm max-w-2xl">From skiing to foliage drives to farm visits, your guests will never run out of things to do. <a href="area.html" class="underline">See the area →</a></p></section>
  {getting_here()}
</main>
{footer()}
{mobilenav("events.html")}
'''
    return head("Vermont Wedding & Event Venue Near Mount Snow | Timbercrest Mansions",
                "Host weddings, reunions and retreats in a private Vermont estate. Combine side-by-side mansions for groups of 48+. Lodging for everyone on site.",
                rel="") + header("events.html") + body + scripts()

def build_area():
    acts=[("Mount Snow Resort","winter","600 acres, 20 lifts, 1,900 ft vertical across four faces. 5 min from the mansions."),
          ("Carinthia Parks","winter","Mount Snow's dedicated freestyle terrain-park face — jumps, rails and pipes."),
          ("Snowmobile & dog sledding","winter","Guided snowmobile tours, cross-country trails, snowshoeing and dog sledding."),
          ("Snow tubing","winter","Lift-served tubing lanes — the easiest big laughs for non-skiers."),
          ("Bluebird Express foliage rides","fall","Scenic chairlift rides with views to Somerset Reservoir. Peak color: first ten days of October."),
          ("Mt. Olga fire tower","fall","A short family hike to a fire tower with a 360° view of the foliage."),
          ("Valley Trail","summer","A gentle walking and biking path linking West Dover to Wilmington."),
          ("Lake & summer adventure","summer","Nearby lakes for swimming and paddling, plus mountain biking, golf and hiking."),
          ("Adams Family Farm","all","A working Vermont farm — animals, wagon and sleigh rides, and maple everything."),
          ("Wilmington village","all","Historic village 10 minutes away — shops, galleries, breweries and restaurants."),
          ("Dot's Restaurant","all","A classic American diner with a retro vibe — the local pick for any meal.")]
    cards="".join(f'<div class="rounded-xl border border-stone-200 p-5" data-season="{s}"><p class="text-[10px] uppercase tracking-[0.2em] font-semibold" style="color:#92400e">{s}</p><div class="font-serif text-lg mt-0.5">{n}</div><p class="text-sm text-stone-600 mt-1">{b}</p></div>' for n,s,b in acts)
    itineraries=[("The Powder Day","Winter",[("7:00","Steam off the indoor pool"),("8:30","First chair, 5 min to the lift"),("12:30","Lunch back at one table"),("4:30","Hot tub debrief, game room for the kids"),("7:00","Dinner for the whole crew")]),
                 ("The Lake Day","Summer",[("9:00","Bike the Valley Trail"),("11:00","Swim and paddle"),("1:00","Picnic on the water"),("3:00","Lift-served hike or golf"),("6:00","BBQ + fire pit")]),
                 ("The Foliage Saturday","Fall",[("9:00","Bluebird Express ride"),("11:00","Mt. Olga fire tower"),("1:00","Lunch in Wilmington"),("3:00","Adams Family Farm"),("5:00","Cider by the fire")])]
    itin="".join('<div class="rounded-xl border border-stone-200 p-5"><p class="text-[10px] uppercase tracking-[0.2em] font-semibold" style="color:#92400e">'+s+'</p><div class="font-serif text-xl mt-0.5 mb-3">'+t+'</div>'+"".join(f'<div class="flex gap-3 text-sm mb-2"><span class="text-stone-400" style="width:2.5rem;flex:0 0 auto">{tm}</span><span class="text-stone-600">{st}</span></div>' for tm,st in plan)+'</div>' for t,s,plan in itineraries)
    body=f'''
<main class="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-12">
  <div class="fade">
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">What to do around</p>
    <h1 class="font-serif text-3xl sm:text-4xl mt-1">Four seasons around Mount Snow</h1>
    <p class="text-stone-600 text-sm sm:text-base max-w-2xl mt-2">World-class skiing in winter, lakes and biking in summer, and some of Vermont's best leaf-peeping each fall — all minutes from your private mansion.</p>
  </div>

  <div class="flex gap-2 overflow-x-auto pb-1" id="season-filter">
    <button class="chip on" data-s="all">All year</button>
    <button class="chip" data-s="winter">Winter</button>
    <button class="chip" data-s="summer">Summer</button>
    <button class="chip" data-s="fall">Fall foliage</button>
  </div>
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" id="act-grid">{cards}</div>

  <section>
    <p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">If you only have one day</p>
    <h2 class="font-serif text-2xl sm:text-3xl mt-1 mb-5">Three perfect days, planned</h2>
    <div class="grid sm:grid-cols-3 gap-4">{itin}</div>
  </section>

  {getting_here()}
</main>
{footer()}
{mobilenav("area.html")}
<script>
  document.querySelectorAll('#season-filter .chip').forEach(b=>b.onclick=()=>{{
    document.querySelectorAll('#season-filter .chip').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); const s=b.dataset.s;
    document.querySelectorAll('#act-grid [data-season]').forEach(c=>{{
      c.style.display=(s==='all'||c.dataset.season===s||c.dataset.season==='all')?'':'none';
    }});
  }});
</script>
'''
    return head("Things to Do Near Mount Snow, Vermont | Timbercrest Mansions",
                "Skiing, lakes, fall foliage, villages and diners — four seasons of things to do minutes from your Timbercrest mansion near Mount Snow.",
                rel="") + header("area.html") + body + scripts()

def build_concept():
    eras=[("1980s","Jack builds big","Local legend Jack Ridgeway, a pioneer of the vacation-rental industry, builds these estates at the foot of Mount Snow with his wife Margit — at a scale nobody else dared: huge rooms, abundant common areas, craftsmanship in every detail."),
          ("Decades of gatherings","Traditions take root","Families return year after year. One family has celebrated Thanksgiving here for 26 years and counting. Reunions, ski weeks, weddings — the houses become the backdrop of people's lives."),
          ("Today","Restored, not replaced","Each mansion is thoughtfully updated — modern amenities, restored carriage barn, on-site managers Michelle & Ryan — while keeping the timeless character Jack built into the walls.")]
    erahtml=""
    for i,(yr,t,x) in enumerate(eras):
        g=("#6e5840","#372a1d") if i%2 else ("#3a3f49","#16181d")
        ph=photo(g[0],g[1],yr,style="height:16rem;border-radius:.9rem")
        order2="order:2" if i%2 else ""
        erahtml+=f'<div class="grid md:grid-cols-2 gap-5 md:gap-10 items-center"><div style="{order2}">{ph}</div><div><p class="text-[11px] uppercase tracking-[0.25em] font-semibold" style="color:#92400e">{yr}</p><h2 class="font-serif text-2xl mt-1">{t}</h2><p class="text-stone-600 text-sm sm:text-base mt-2">{x}</p></div></div>'
    moments=[("#3a3f49","#16181d","7:00 AM","Steam rising off the indoor pool before the mountain wakes up."),
             ("#54687a","#26333e","9:30 AM","Thirty pairs of boots, one mudroom, two minutes to the lifts."),
             ("#6e5840","#372a1d","1:00 PM","Lunch for everyone at one table — no reservation for 28 required."),
             ("#7a4a3a","#37201a","5:00 PM","Hot tub debrief. The kids take over the game room."),
             ("#44403c","#16181d","9:00 PM","Fire pit, Green Mountain sky, nobody has to drive anywhere.")]
    mom="".join(f'<div style="width:18rem">{photo(a,b,l,style="height:22rem;border-radius:.9rem")}<p class="text-sm text-stone-600 mt-3">{t}</p></div>' for a,b,l,t in moments)
    ways=[("Stay","Book one mansion for a ski week, a reunion, or a long weekend with everyone.","Browse the mansions","index.html"),
          ("Celebrate","Weddings, retreats and milestones with exclusive use of an entire estate — or the whole hillside for 48+.","Events & weddings","events.html"),
          ("Explore","Skiing, lakes, foliage, villages and diners — four seasons of Vermont, minutes from the door.","See the area","area.html")]
    way="".join(f'<a href="{h}" class="block rounded-xl border border-stone-200 p-6" style="text-decoration:none"><div class="font-serif text-xl">{t}</div><p class="text-sm text-stone-500 mt-1.5">{d}</p><span class="inline-block text-sm font-medium underline mt-4">{c} →</span></a>' for t,d,c,h in ways)
    body=f'''
{photo("#16181d","#3a3f49","",cls="flex",style="min-height:26rem;height:60vh;align-items:flex-end")}
<div class="max-w-3xl mx-auto px-4 sm:px-8 -mt-40 relative" style="z-index:1">
  <p class="text-[11px] uppercase tracking-[0.3em] text-white/60 font-semibold">The concept</p>
  <h1 class="font-serif text-4xl sm:text-6xl text-white leading-tight mt-3">Everyone you love.<br>Under one roof.</h1>
  <p class="text-white/80 mt-4 text-sm sm:text-base max-w-xl">Timbercrest isn't a hotel, and it isn't a typical rental. It's four historic mansions built for one thing: gathering people — 18, 32, or a hundred of them — minutes from Mount Snow.</p>
</div>

<main class="max-w-6xl mx-auto px-4 sm:px-8 py-14 space-y-16">
  <p class="font-serif text-2xl sm:text-3xl max-w-3xl mx-auto">Most trips split a group across hotel rooms, hallways and group chats. Here, the whole point is the opposite — <span style="color:#92400e">one kitchen, one long table, one fire</span>, and enough bedrooms that nobody sleeps on a couch.</p>

  <section class="space-y-10"><h2 class="font-serif text-2xl sm:text-3xl">The houses Jack built</h2>{erahtml}</section>

  <section>
    <h2 class="font-serif text-2xl sm:text-3xl mb-5">One day, told in five frames</h2>
    <div class="snap-row pb-4">{mom}</div>
  </section>

  <section><h2 class="font-serif text-2xl sm:text-3xl mb-5">Three ways in</h2><div class="grid sm:grid-cols-3 gap-4">{way}</div></section>

  <p class="font-serif text-2xl sm:text-3xl text-center max-w-3xl mx-auto">"Thank you for helping us make our family tradition — 26 years — so special."</p>
  {getting_here()}
</main>
{footer()}
{mobilenav("concept.html")}
'''
    return head("The Concept — Four Mansions for Gathering | Timbercrest Mansions",
                "Not a hotel, not a typical rental. Four historic mansions at Mount Snow built for gathering everyone you love under one roof.",
                rel="") + header("concept.html") + body + scripts()

def build_booking():
    body=f'''
<main class="max-w-6xl mx-auto px-4 sm:px-8 py-6 pb-40 lg:pb-16" id="booking-root"></main>
{footer()}
{mobilenav("booking.html")}
'''
    return head("Book Your Stay | Timbercrest Mansions",
                "Book one mansion or combine several side-by-side estates in a single reservation. Best rates guaranteed when booking direct.",
                rel="") + header("booking.html") + body + scripts(booking=True)

# ---------------- WRITE ----------------
def w(path, content):
    full=os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full,"w").write(content)
    print("wrote", path)

w("index.html", build_home())
w("events.html", build_events())
w("area.html", build_area())
w("concept.html", build_concept())
w("booking.html", build_booking())
for p in PROPS:
    w(f"stays/{p['id']}.html", build_listing(p))

# sitemap + robots
urls = ["", "events.html", "area.html", "concept.html", "booking.html"] + [f"stays/{p['id']}.html" for p in PROPS]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sm += "".join(f'  <url><loc>{BASE}/{u}</loc></url>\n' for u in urls) + "</urlset>\n"
w("sitemap.xml", sm)
w("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
print("DONE")
