---
name: dashboard-research
description: Benzer secim/politika dashboard ornekleri — UI/UX desenleri + uygulama notlari
type: project
status: active
last_updated: 2026-05-12
---

# Dashboard Arastirmasi — Benzer Secim/Politika Panelleri

Mevcut `dashboard.html` icin referans olabilecek 12 dashboard / kutuphane / pattern. Her birinde **ne ise yariyor**, **bizim panelle kiyas** ve **alabilecegimiz pattern** notu var.

---

## 1) 270toWin — What-If Senaryo Olusturucu (ABD)
- **URL:** https://www.270towin.com/2024-election/interactive-map
- **Ne yapiyor:** Eyalet eyalet tiklayarak ABD baskanlik secim sonucunu kullanici elinde sekillendirir. Renk degisimi animasyonlu, sag panelde anlik electoral vote sayaci ("To Win 270") var.
- **Ozellikler:**
  - **Tek tikla deger atama** — bir eyalete tikla, R/D/Toss-up renkleri arasinda donsun.
  - **Sticky toplam paneli** — sag ust kosede "Trump 312 / Harris 226" gibi anlik MV (elektoral oy) sayaci hep gorunur.
  - **Senaryo paylasimi (URL state):** dashboard durumunu URL parametresine yazip linkle paylasilabilir.
  - **Preset senaryolar:** "2020 results", "Toss-up split" gibi hazir baslangiclar.
  - **Save/Load:** kullanici senaryosunu localStorage'a kaydetme + sonra acma.
- **Bizim panel icin:** "Run Simulation" butonunu kaldirip slider'lar degisince **anlik** hesaplama yapmak daha akici olur. URL state ile senaryo paylasim cok onemli — Mert'le "ben simdi soyle bir senaryo denedim" demek icin tek link gonderilebilir.

---

## 2) ElectoSIM — D'Hondt + 12+ Sistem Simulatoru (Acik Kaynak)
- **URL:** https://app.electosim.com/en
- **Ne yapiyor:** Genel oy paylari → secim cevresi bazli D'Hondt/Hare/Sainte-Lague vs. 12 farkli algoritma. Hemicycle + bar + harita uctu.
- **Ozellikler:**
  - **Sekmeli tab UI:** "General | Constituencies | Pactometer | Methods" — bizimle aynı sekmeli mantik degil ama bilesen ayrismasi temiz.
  - **Pactometer (ittifak hesaplayici):** kullanici ittifak birlestirme/bolme yapabilir — bizim "ittifak birlestir/ayir toggle"imizla aynı isi yapar.
  - **Vote transfer modal:** "A partisinden B'ye %5 transfer et" gibi senaryo kurulumu. Slider yerine transfer mantigi ilginc — Mert "MHP'nin %2'sini AKP'ye geri ver" demek isteyebilir.
  - **CSV/JSON export:** Sonuc tablolarini indirilebilir.
  - **Algoritma seffafligi:** her metod icin formul/aciklama panel acilir.
- **Bizim panel icin:**
  - **Pactometer:** ittifak birlestirme/bolme toggle'ini "ittifak tasarimi" sekmesine alıp Mert'in custom ittifak kurmasina izin verebiliriz (CHP+Sol birlesik, IYI+MI birlesik vs.).
  - **Algoritma seffafligi:** "D'Hondt nasıl calistir?" expand-collapse panel.
  - **CSV/JSON export:** "Sonucu indir" butonu (bizim mevcut data zaten JSON, sadece UI lazim).

---

## 3) Electoral Calculus (UK) — Swing-Based Forecaster
- **URL:** https://www.electoralcalculus.co.uk/userpoll.html
- **Ne yapiyor:** Kullanici Brexit/Reform/Lab/Con vs. ulusal oy yuzdesi girer, 650 secim cevresi icin Uniform National Swing (UNS) ile MV tahmini.
- **Ozellikler:**
  - **Iki kademe swing:** ulusal swing + Iskocya/Galler ayri swing. Bizdeki "Milli Gorus icin ilce agirlik mode" toggle'i ile aynı felsefe.
  - **Tarihsel baseline secimi:** 1955-2023 arasi her secimi baseline alarak swing hesaplayabilirsiniz. Bizdeki 2023/2018/2015K baseline toggle paralel.
  - **"Tactical voting" slider:** 0-100% — stratejik oy oranı parametre. Boyle bir gizli kalibrasyon parametremiz yok ama "Milli Gorus agirlik" benzer rol.
  - **Cikti:** "All changed seats", "Majority-sorted seats", "Regional breakdown" — birden cok cikti gorunumu.
- **Bizim panel icin:**
  - **"Degisen cevreler" gorunumu:** yeni senaryoda hangi cevrede MV el degistirdi (2023'e gore). Bu cok degerli bir view, su anda yok.
  - **"Marjinal cevreler" tablosu:** kazanan parti +1 MV'a kac oy uzakta — kapali olcusu zaten +1 marjinal MV haritamizda var, tablo halinde de sunulabilir.

---

## 4) NYT 2024 Precinct Map — Map Mastery
- **URL:** https://www.nytimes.com/interactive/2025/us/elections/2024-election-map-precinct-results.html
- **Ne yapiyor:** Sandik (precinct) bazli harita, 4 milyondan fazla nokta. Hover'da yerel sonuclar, zoom yapilinca daha ince granularite.
- **Ozellikler:**
  - **Continuous zoom:** county → tract → precinct. Bizim "il ↔ cevre" toggle'i bunun mini versiyonu.
  - **Margin coloring:** sadece "kazanan rengi" degil, **kazanma marji** koyuluk olarak — A partisinin %55 ve %75 oldugu cevre farkli koyulukta. Bizdeki "kazanan modu" kategorik; **margin modu da var ama tek partilere odakli** — ulkesel ozet harita olarak "kim kazandi + ne kadar farkla" katmani ekleyebiliriz.
  - **Shift overlay:** 2020 → 2024 kayma okları (kucuk ok her ilcede). Bizdeki "2023'e gore degisim" view yok — bu ZALIM bir feature olur.
  - **Demographics overlay:** Yas/gelir/egitim grup gore eski sonuc karsilastirmasi.
- **Bizim panel icin:**
  - **Margin koyulugu:** kategorik kazanan harita yerine "kazanan parti rengi + opaklikla marj" (kazanan %30 ise solgun, %60 ise koyu) — daha bilgi yogun.
  - **Shift okları:** her cevrede 2023 → senaryo (kim kazaniyor → kim kazandi, ok yonu = degisim buyuklugu) bonus harita.

---

## 5) VoteHub 2024 Precinct Map
- **URL:** https://votehub.com/2024-map/
- Cloudflare blokuyla fetch alamadik ama public bilinen ozellikler:
  - **2020 vs 2024 shift Map:** kayma yonu (mavi → kirmizi) yatay bar her precinct icin.
  - **Demographic crossbreak:** harita uzerinde demografi filtresi (race, income).
  - **Yuksek performans:** WebGL ile 100K+ feature render.
- **Bizim panel icin:** Demografi katmanı bizde simdilik yok, ama gelecekte "is ortakligi", "kentlesme", "egitim" gibi katmanlar eklenebilir.

---

## 6) Flourish Parliament Charts
- **URL:** https://flourish.studio/visualisations/parliament-charts/
- **Ne yapiyor:** Hemicycle template engine. Drag-drop ile seat sayisi, parti rengi, majority cizgisi.
- **Ozellikler:**
  - **Majority threshold cizgisi:** otomatik 50% cizgi. Bizdeki 301-cizgisini kaldirdik (Mert istegi) ama opsiyonel olarak geri konabilir.
  - **Election flip animation:** secimden secime gecisleri animasyonla gosteriyor. Bizdeki baseline degisikligi (2023 → 2018) anlik snap; **CSS transition** ile dilim acilarini animate edebiliriz.
  - **Highlight on hover:** belirli partiye hover etti misiniz, hemicycle'de o partinin koltuklari belirginlesir.
  - **Mobile responsive:** her ekran boyutunda calisir.
- **Bizim panel icin:**
  - **Hemicycle hover highlight:** mevcut hemicycle SVG'ye `mouseover` listener ekleyip o partinin dilimini renk ile vurgulamak kolay.
  - **Baseline gecis animasyonu:** 2023 → 2018 toggle'da CSS transition (300ms) ile dilim genislikleri animate edilebilir.
  - **Compare mode:** iki senaryoyu yan yana hemicycle (sol = "baseline", sag = "senaryo") — Mert "2023 actual vs benim senaryom" karsilastirmasi cok isterdi.

---

## 7) BBC UK Election 2024 Dashboard
- Fetch alamadik (geoblok) ama BBC interactive design diline iliskin bilgi:
  - **Sticky party tally bar:** ust kisimda her parti icin MV sayaci ile yatay stacked bar (650/650).
  - **Swing-o-meter:** ulusal swing kucuk gauge widget — bizdeki slider'larin gauge gosterimi.
  - **Result detail drill-down:** cevreye tiklayinca alt panel acilir, parti parti oy + MV.
  - **Color-coded turnout heatmap:** katilim haritasi ayri katman.
- **Bizim panel icin:**
  - **Ust stacked bar:** 600 MV yatay tek satir, parti renkleri stack — mevcut "parti pill ozet" yerine veya yaninda gorsel. (Şu anda hemicycle var, stacked bar ek ozet olarak iyi.)
  - **Cevre drill-down panel:** haritada bir cevreye tiklayinca alt panelde "Adana — CHP 12, AKP 8, MHP 3, ..." tablo acilsin.

---

## 8) ABC Antony Green Election Calculator (Avustralya)
- **Ne yapiyor:** Iki parti tercih (TPP) swing slider. 150 federal koltuk icin sonuc tahmini.
- **Ozellikler:**
  - **Tek slider felsefesi:** "swing to/from Labor" tek slider — minimum input, maksimum cikti.
  - **Marjinal koltuk listesi:** "1% swing'le kaybedilecek 8 koltuk" gibi spesifik liste.
  - **Mobile-first:** telefonda mukemmel calisir.
- **Bizim panel icin:**
  - **Mobile responsive:** mevcut layout (geniş grid) telefonda kotu olur. Media query ile slider'lar dikeye dusup harita kucultulebilir.

---

## 9) Berly D'Hondt Calculator
- **URL:** https://projects.berly.kim/DHondtCalc/index.html
- **Ne yapiyor:** Minimalist D'Hondt — parti adi + oy gir, allokasyon turlarini tablo halinde gosterir.
- **Bizim panel icin:** Inceltilmis bir "**D'Hondt turlari** sekmesi" eklenebilir. Kullanici secili cevrenin (mesela Istanbul 1) D'Hondt turlarini gormek istedinde tablo acilir: tur 1, tur 2, tur 3, ...n. **Egitici/sefffaflik degeri yuksek**.

---

## 10) IMF/World Bank Interactive Dashboards
- **URL:** https://datatopics.worldbank.org/world-development-indicators/
- Politika dashboard'larinin **kurumsal** versiyonu. Bizim ank-ar markali tasarima yakindir.
- **Ozellikler:**
  - **Sade ust banner:** logo + slogan + ana navigasyon.
  - **Sol sticky filter sidebar:** ulke/yil/gosterge — bizim slider/toggle panellerimizle ayni rol.
  - **Tab-based main view:** "Chart | Table | Map | Metadata" — bizde de "Harita | Hemicycle | Tablo | Cevre detayi" sekmeleri olabilir, scroll yerine.
  - **Citation footer:** "Source: World Bank, retrieved YYYY-MM-DD" — bizim "Methodology" footer'imiz isi gormeli (D'Hondt + uniform swing aciklamasi).

---

## 11) FT Election Tracker (Financial Times)
- **Tasarim Felsefesi:** "**Charticles**" — yazı + interaktif grafik bir arada, scroll-driven storytelling.
- **Ozellikler:**
  - **Scrollytelling:** dashboard'a girince ilk gorulen "ana mesaj" buyuk metin, asagi indikce detay parametreleri.
  - **Kontrolu sona biraktir:** ilk acilista "varsayilan senaryo" sonucu gosterilir; slider'lar asagi inince acilir.
  - **Az renk paleti:** parti rengi + 1-2 nötr ton; ana metin sade.
- **Bizim panel icin:**
  - **Ilk gorunum:** kullanici dashboard'i acinca ilk **mevcut senaryo sonucu** (CHP 169, AKP 152, ...) buyuk gözukmeli. Sliderlar **alta** veya yana cekilir; ortada sonuc.

---

## 12) Tilegrams (NYT, NPR) — Carpik Harita Yerine Esit Hexagon
- **URL:** https://pitchinteractive.com/projects/tilegrams.html
- **Ne yapiyor:** Cografi alana gore degil **MV sayisina gore** orantili hexagon harita. Istanbul (98 MV) ile Bartin (2 MV) cografi haritada Bartin daha buyuk gozukur — yanli okuma. Tilegram'da MV sayisina orantili.
- **Bizim panel icin:**
  - **Cevre hexagon harita** opsiyonu: 87 cevre × MV sayisi → hexagon grid (Istanbul 1/2/3 yan yana 3 buyuk hex, Bartin 1 kucuk hex).
  - **Cografi vs orantili toggle:** "Geographic Map | MV-Proportional Tilegram" buton paneli.

---

# Bizim Panelde Hemen Uygulanabilir 10 Iyileme

Oncelik sirasi (etki × dusuk maliyet):

1. **URL state encoding** — slider degerleri ?chp=29.1&akp=25.4&... URL'ye yazilsin; link paylasilabilsin.  **(270toWin pattern)**
2. **Anlik hesaplama** — "Run Simulation" butonunu kaldir, slider degisince debounce'lu (300ms) anlik run.  **(modern UX standardi)**
3. **Ilk acilista sonuc** — sayfa acilinca varsayilan senaryo (Mert'in 29.1/25.4/...) zaten hesaplanmis goste; slider'lar **collapse panel**'de.  **(FT scrollytelling pattern)**
4. **Cevre drill-down panel** — haritada bir cevreye tiklayinca sag panelde "Adana — CHP 12 MV, AKP 8 MV, ..." parti + oy + MV tablosu.  **(BBC pattern)**
5. **Compare mode** — iki senaryoyu yan yana — sol "baseline 2023 actual", sag "kullanicinin senaryosu". Hemicycle ust uste, harita yan yana, fark tablosu.  **(NYT shift overlay)**
6. **Degisen cevreler tablosu** — senaryoda hangi cevrede kazanan parti degisti? "2023 CHP → senaryo MI" gibi liste.  **(Electoral Calculus pattern)**
7. **Hemicycle hover highlight** — mouse parti dilimine girince o parti vurgulanir, alt panelde "CHP 169 MV (28.2%)" etiket.  **(Flourish pattern)**
8. **D'Hondt turlari modal** — "Secili cevrenin D'Hondt turlarini gor" buton, modal acilir, tur tur quotient tablosu.  **(Berly + egitici deger)**
9. **CSV/JSON export butonu** — "Senaryoyu indir" → mv_dagilim_cevre.csv + senaryo.json.  **(ElectoSIM pattern)**
10. **Mobile responsive** — telefonda map ust, slider'lar alta, hemicycle ortada — tek sutun.  **(Antony Green pattern)**

---

# Tasarim Direktorluk Notu

Bizim panel zaten **bircok pro feature'a sahip**: D'Hondt validation MAE 5.5 MV/parti, multi-baseline, alliance split toggle, MG agirlik mode, ank-ar markali sticky banner. Yukaridaki 10 oneri tamamen "ust-katman cila" — temel iskelet salam.

**En cok eksigimiz:** URL state + compare mode + cevre drill-down panel. Bu uc adim panelin "ozel rapor" haline donmesini saglar.

**En az gerek:** Demografi katmani (uzun vadeli), tilegram (gorsel ego), animasyon (cosmetic).

---

## Eklenebilecek Yazi-Bicimi Bilesenleri

Dashboard tek basina anlamli olsa da, **yazili kisa rapor** ile beraber paylasilirsa daha guclu:

- **Methodology box:** "D'Hondt nedir? Uniform proportional swing nasil calisir? MG ilce agirligi neyi olcer?" 200-300 kelime yazili kapali kutu.
- **Limitations box:** "Bu simulator soyle varsayimlari yapar: (1) tum cevrelerde aynı swing katsayisi, (2) MG icin 3-seri ortalama, (3) ittifak ici alt-dağılım proportional. Gercek sonuc su nedenlerle farklilasabilir: ..."
- **Senaryo galerisi:** Mert + sen onaylı 4-5 hazır senaryo butonu — "Cumhur Ittifaki dağılmazsa", "DEM baraj alti kalir ise", "Milliyetci Ittifak daginirsa", "MG ittifaki olmazsa".

---

[[projects/dhont-mv-senaryo/web-export/DASHBOARD-DESIGN.md]] | [[projects/dhont-mv-senaryo/web-export/examples/dashboard.html]]
