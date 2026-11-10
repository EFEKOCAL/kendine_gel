// Protokol verisi: seviyeler, ortamlar, müdahaleler ve kaynaklar.
// KURAL: Her müdahale en az bir kaynağa ve dürüst bir kanıt seviyesine bağlı olmalı.
// Kanıt seviyeleri: guclu (meta-analiz / tutarlı çoklu çalışma), orta (birkaç çalışma, sınırlı genelleme),
// zayif (mekanizma makul ama doğrudan kanıt az / popüler iddia).

const EVIDENCE = {
  guclu: { label: "Güçlü kanıt", cls: "ev-strong" },
  orta:  { label: "Orta kanıt",  cls: "ev-mid" },
  zayif: { label: "Sınırlı kanıt", cls: "ev-weak" },
};

const ENVS = [
  { id: "ev",        label: "Ev" },
  { id: "yurt",      label: "Yurt" },
  { id: "okul",      label: "Okul / Kampüs" },
  { id: "kutuphane", label: "Kütüphane" },
];
const ALL_ENVS = ENVS.map(e => e.id);

const LEVELS = [
  { id: 1, name: "Hafif kayma",
    signs: ["Elin telefona gidiyor", "Aynı paragrafı tekrar okuyorsun", "Sıkılma, huzursuzluk"],
    goal: "Döngüye girmeden kesmek. 2–5 dk." },
  { id: 2, name: "Zihinsel sis (brain fog)",
    signs: ["Uyuşukluk, esneme", "Okuduğunu anlamıyorsun", "Masada çökmüş oturuş"],
    goal: "Uyarılmışlık düzeyini (arousal) yükseltmek. 5–10 dk." },
  { id: 3, name: "Kaçış döngüsü",
    signs: ["Uzun süre oyun / kısa video / porno tükettin", "Suçluluk, \"gün bitti\" hissi", "Başlamak imkânsız görünüyor"],
    goal: "Günü ikiye bölmek: bedeni ve ortamı tamamen sıfırlamak. 10–20 dk." },
  { id: 4, name: "Tam kilitlenme",
    signs: ["Yoğun kaygı veya huzursuzluk", "Yerinde duramıyorsun ya da tamamen donmuşsun", "Önceki seviyeler işe yaramadı"],
    goal: "Stres yükünü hareketle boşaltmak. 20–40 dk." },
];

const SOURCES = {
  albulescu2022: "Albulescu, P. ve ark. (2022). \"Give me a break!\" A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. PLoS ONE, 17(8), e0272460.",
  ariga2011: "Ariga, A. & Lleras, A. (2011). Brief and rare mental \"breaks\" keep you focused: Deactivation and reactivation of task goals preempt vigilance decrements. Cognition, 118(3), 439–443.",
  balban2023: "Balban, M. Y. ve ark. (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. Cell Reports Medicine, 4(1), 100895.",
  berman2008: "Berman, M. G., Jonides, J. & Kaplan, S. (2008). The cognitive benefits of interacting with nature. Psychological Science, 19(12), 1207–1212.",
  brooks2006: "Brooks, A. & Lack, L. (2006). A brief afternoon nap following nocturnal sleep restriction: Which nap duration is most recuperative? Sleep, 29(6), 831–840.",
  chang2012: "Chang, Y. K. ve ark. (2012). The effects of acute exercise on cognitive performance: A meta-analysis. Brain Research, 1453, 87–101.",
  dai2014: "Dai, H., Milkman, K. L. & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science, 60(10), 2563–2582.",
  duckworth2016: "Duckworth, A. L. ve ark. (2016). Situational strategies for self-control. Perspectives on Psychological Science, 11(1), 35–55.",
  ganio2011: "Ganio, M. S. ve ark. (2011). Mild dehydration impairs cognitive performance and mood of men. British Journal of Nutrition, 106(10), 1535–1543.",
  godek2022: "Godek, D. & Freeman, A. M. (2022). Physiology, Diving Reflex. StatPearls Publishing.",
  gollwitzer1999: "Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. American Psychologist, 54(7), 493–503.",
  hagger2016: "Hagger, M. S. ve ark. (2016). A multilab preregistered replication of the ego-depletion effect. Perspectives on Psychological Science, 11(4), 546–573.",
  kaplan1995: "Kaplan, S. (1995). The restorative benefits of nature: Toward an integrative framework. Journal of Environmental Psychology, 15(3), 169–182.",
  lembke2021: "Lembke, A. (2021). Dopamine Nation: Finding Balance in the Age of Indulgence. Dutton.",
  nehlig2010: "Nehlig, A. (2010). Is caffeine a cognitive enhancer? Journal of Alzheimer's Disease, 20(S1), S85–S94.",
  oppezzo2014: "Oppezzo, M. & Schwartz, D. L. (2014). Give your ideas some legs: The positive effect of walking on creative thinking. Journal of Experimental Psychology: Learning, Memory, and Cognition, 40(4), 1142–1152.",
  owen2008: "Owen, G. N. ve ark. (2008). The combined effects of L-theanine and caffeine on cognitive performance and mood. Nutritional Neuroscience, 11(4), 193–198.",
  sirois2013: "Sirois, F. & Pychyl, T. (2013). Procrastination and the priority of short-term mood regulation. Social and Personality Psychology Compass, 7(2), 115–127.",
  sramek2000: "Šrámek, P. ve ark. (2000). Human physiological responses to immersion into water of different temperatures. European Journal of Applied Physiology, 81(5), 436–442.",
  steel2007: "Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review. Psychological Bulletin, 133(1), 65–94.",
  szuhany2015: "Szuhany, K. L., Bugatti, M. & Otto, M. W. (2015). A meta-analytic review of the effects of exercise on brain-derived neurotrophic factor. Journal of Psychiatric Research, 60, 56–64.",
  ward2017: "Ward, A. F. ve ark. (2017). Brain drain: The mere presence of one's own smartphone reduces available cognitive capacity. Journal of the Association for Consumer Research, 2(2), 140–154.",
  // --- Davranışsal bağımlılık literatürü (Gemini araştırmasından seçilip düzeltildi) ---
  schultz2016: "Schultz, W. (2016). Dopamine reward prediction error coding. Dialogues in Clinical Neuroscience, 18(1), 23–32.",
  brand2016: "Brand, M., Young, K. S., Laier, C., Wölfling, K. & Potenza, M. N. (2016). Integrating psychological and neurobiological considerations regarding the development and maintenance of specific Internet-use disorders: An Interaction of Person-Affect-Cognition-Execution (I-PACE) model. Neuroscience & Biobehavioral Reviews, 71, 252–266.",
  brewer2017: "Brewer, J. (2017). The Craving Mind: From Cigarettes to Smartphones to Love — Why We Get Hooked and How We Can Break Bad Habits. Yale University Press.",
  volkow2009: "Volkow, N. D., Fowler, J. S., Wang, G.-J., Baler, R. & Telang, F. (2009). Imaging dopamine's role in drug abuse and addiction. Neuropharmacology, 56(Suppl. 1), 3–8.",
  yan2024: "Yan, T. ve ark. (2024). Intense short-video-based social media use reduces the P300 event-related potential component in a visual oddball experiment: A sign for reduced attention. (PMC10971362)",
  kuhn2014: "Kühn, S. & Gallinat, J. (2014). Brain structure and functional connectivity associated with pornography consumption: The brain on porn. JAMA Psychiatry, 71(7), 827–834.",
  voon2014: "Voon, V. ve ark. (2014). Neural correlates of sexual cue reactivity in individuals with and without compulsive sexual behaviours. PLoS ONE, 9(7), e102419.",
  laier2013: "Laier, C., Schulte, F. P. & Brand, M. (2013). Pornographic picture processing interferes with working memory performance. Journal of Sex Research, 50(7), 642–652.",
  kraus2018: "Kraus, S. W. ve ark. (2018). Compulsive sexual behaviour disorder in the ICD-11. World Psychiatry, 17(1), 109–110.",
  difeliceantonio2018: "DiFeliceantonio, A. G. ve ark. (2018). Supra-additive effects of combining fat and carbohydrate on food reward. Cell Metabolism, 28(1), 33–44.",
  hall2019: "Hall, K. D. ve ark. (2019). Ultra-processed diets cause excess calorie intake and weight gain: An inpatient randomized controlled trial of ad libitum food intake. Cell Metabolism, 30(1), 67–77.",
  kaelberer2018: "Kaelberer, M. M. ve ark. (2018). A gut-brain neural circuit for nutrient sensory transduction. Science, 361(6408), eaat5236.",
  lane2024: "Lane, M. M. ve ark. (2024). Ultra-processed food exposure and adverse health outcomes: Umbrella review of epidemiological meta-analyses. BMJ, 384, e077310.",
  gearhardt2016: "Gearhardt, A. N., Corbin, W. R. & Brownell, K. D. (2016). Development of the Yale Food Addiction Scale Version 2.0. Psychology of Addictive Behaviors, 30(1), 113–121.",
  wood2016:"Wood, W. & Rünger, D. (2016). Psychology of habit. Annual Review of Psychology, 67, 289–314.",
};

const INTERVENTIONS = [
  { id: "su", levels: [1, 2], envs: ALL_ENVS, title: "Bir bardak su iç", dur: "1 dk",
    steps: ["Masadan kalk, suyu kendin doldur", "Bir bardağı bitir, masaya dön"],
    why: "Hafif dehidrasyon (vücut ağırlığının ~%1–2'si) dikkat ve ruh hâlinde ölçülebilir düşüşle ilişkilendirilmiştir. Etki küçüktür; pratik değeri, masadan kısa bir kopuş sağlamasıdır.",
    ev: "orta", src: ["ganio2011"] },

  { id: "uzak", levels: [1], envs: ALL_ENVS, title: "Uzağa bak (2–3 dk)", dur: "2–3 dk",
    steps: ["Pencereye veya koridorun sonuna git", "En uzak noktaya bak, gözlerini gevşet", "Bu sürede telefona bakma"],
    why: "Ekran yakın ve dar odaklı görme gerektirir; kısa uzak-bakış molaları göz yorgunluğunu azaltır. \"Uzağa bakmak stres sistemini doğrudan kapatır\" iddiası popülerdir ama doğrudan kanıtı sınırlıdır. Asıl işlevi: kısa, uyaransız mola.",
    ev: "zayif", src: ["albulescu2022"] },

  { id: "kalk", levels: [1], envs: ALL_ENVS, title: "Kalk, 3–5 dk yürü", dur: "3–5 dk",
    steps: ["Ayağa kalk, oda / koridor boyunca yürü", "Telefonu masada bırak", "Süre bitince otur ve kaldığın satırı bul"],
    why: "Mikro-molalar (≤10 dk) canlılığı artırır ve yorgunluğu azaltır; performans etkisi göreve göre değişir. Uzun görevlerde kısa hedef-kopuşları dikkat düşüşünü önleyebilir.",
    ev: "orta", src: ["albulescu2022", "ariga2011"] },

  { id: "telefon", levels: [1, 2, 3], envs: ALL_ENVS, title: "Telefonu görüş alanından çıkar", dur: "1 dk",
    steps: ["Telefonu sessize al", "Başka odaya ya da çantanın içine koy", "Bilgisayarda dikkat dağıtan sekmeleri kapat"],
    why: "Bir çalışmada telefonun masada yalnızca durması bile çalışma belleği kapasitesini düşürdü (sonraki tekrar çalışmalarında etki daha küçük bulundu). Daha sağlam bulgu: ortamı değiştiren durumsal stratejiler, anlık irade direncinden daha etkilidir.",
    ev: "orta", src: ["ward2017", "duckworth2016"] },

  { id: "nefes", levels: [1, 2, 4], envs: ALL_ENVS, title: "Döngüsel iç çekiş (cyclic sighing), 5 dk", dur: "5 dk",
    steps: ["Burundan derin nefes al, sonuna kısa ikinci bir nefes ekle", "Ağızdan yavaş ve uzun ver", "5 dk boyunca tekrarla"],
    why: "Randomize bir çalışmada günlük 5 dk döngüsel iç çekiş, mindfulness meditasyonuna kıyasla olumlu duyguyu daha fazla artırdı ve dinlenik solunum hızını düşürdü. Tek çalışma, sınırlı örneklem.",
    ev: "orta", src: ["balban2023"] },

  { id: "yuz", levels: [2, 3], envs: ALL_ENVS, title: "Yüzünü ve enseni soğuk suyla yıka", dur: "2 dk",
    steps: ["Lavaboya git", "20–30 sn yüzüne soğuk su çarp, enseni ıslat", "Kurulan, direkt masaya dön"],
    why: "Yüzün soğuk suyla teması dalış refleksini (diving reflex) tetikler, kalp hızı düşer; soğuk uyaran kısa süreli bir uyanıklık hissi verir. Odak üzerine doğrudan çalışma azdır; etkinin büyük kısmı uyarılma ve kısa ortam değişimidir.",
    ev: "zayif", src: ["godek2022"] },

  { id: "kafein", levels: [1, 2], envs: ALL_ENVS, title: "Kafein (isteğe bağlı L-teanin ile)", dur: "5 dk",
    steps: ["Orta doz: 1 fincan filtre kahve (~75–150 mg)", "Öğleden sonra geç saatte alma (uykuyu bozar)", "Kaygılıysan bu adımı atla"],
    why: "Kafein adenozin reseptörlerini bloke ederek yorgunluk sinyalini azaltır; uyanıklık ve dikkat görevlerinde tutarlı olumlu etkisi vardır. L-teanin ile kombinasyonu bazı çalışmalarda dikkat değiştirme doğruluğunu artırdı ve yorgunluğu azalttı.",
    caution: "Seviye 3–4'te, kaygı / çarpıntı varken veya günlük ~400 mg üzerinde kullanma.",
    ev: "guclu", src: ["nehlig2010", "owen2008"] },

  { id: "hareket", levels: [2], envs: ["ev", "yurt"], title: "5 dk vücut ağırlığı hareketi", dur: "5 dk",
    steps: ["20 squat, 10 şınav, 30 sn plank", "2–3 tur, nefes nefese kalmadan", "Su iç, masaya dön"],
    why: "Akut egzersiz sonrası bilişsel performansta küçük ama tutarlı bir artış görülür (meta-analiz). Etki egzersizden birkaç dakika sonra en belirgindir.",
    ev: "guclu", src: ["chang2012"] },

  { id: "disari", levels: [2, 3], envs: ALL_ENVS, title: "Binadan çık, serin havada 5–10 dk yürü", dur: "5–10 dk",
    steps: ["Hafif serin hissedecek kıyafetle dışarı çık", "Telefona bakmadan tempolu yürü", "Dönüşte direkt masaya otur"],
    why: "Üç etkiyi birleştirir: hareket, hafif soğuk uyaran, ortam değişimi. Yürüyüş ve doğal çevrede kısa süre geçirmek, yönlendirilmiş dikkat (directed attention) görevlerinde performansı artırabilir (dikkat yenilenme teorisi).",
    ev: "orta", src: ["berman2008", "kaplan1995", "oppezzo2014"] },

  { id: "mekan", levels: [2, 3], envs: ALL_ENVS, title: "Çalışma yerini değiştir", dur: "5 dk",
    steps: ["Başka bir masa / kat / oda / mekâna geç", "Yeni yerde yalnızca bir dersin materyali olsun"],
    why: "Alışkanlıklar ortam ipuçlarına bağlanır. Kaçış davranışının tekrarlandığı ortamdan çıkmak, otomatik tetikleyicileri (cue) devre dışı bırakır.",
    ev: "orta", src: ["wood2016"] },

  { id: "dus", levels: [3], envs: ["ev", "yurt"], title: "Duş al (son 30–60 sn soğuk), kıyafet değiştir", dur: "10 dk",
    steps: ["Ilık başla, 3–5 dk", "Son 30–60 sn soğuk su", "Temiz kıyafet giy, odayı havalandır", "Duştan çıkınca direkt başlangıç görevine geç"],
    why: "Soğuk suya girişte plazma noradrenalin ve dopamin düzeyi artar; ancak bu çalışmada 14°C suda 1 saat kalınmıştır. 30 sn'lik duşa \"dopamin %250 artar\" diye genellenemez. Daha sağlam gerekçe: belirgin bir \"öncesi / sonrası\" sınırı (temporal landmark) yeni başlangıç davranışını destekler.",
    caution: "Kalp-damar rahatsızlığı varsa soğuk suya ani girişten kaçın.",
    ev: "zayif", src: ["sramek2000", "dai2014"] },

  { id: "surtunme", levels: [3], envs: ALL_ENVS, title: "Sürtünme ekle (friction)", dur: "5 dk",
    steps: ["Oyundan / uygulamadan çıkış yap, kısayolu kaldır", "Telefonu başka odaya koy", "Site engelleyici (blocker) aç", "Masada yalnızca tek dersin materyali kalsın"],
    why: "Davranış en az çaba gerektiren seçeneğe kayar. Kaçış seçeneğine birkaç adım eklemek ve çalışma seçeneğini hazır bırakmak, anlık irade direncine güvenmekten daha etkilidir.",
    ev: "orta", src: ["duckworth2016", "wood2016"] },

  { id: "temel", levels: [3, 4], envs: ALL_ENVS, title: "Temel ihtiyaç kontrolü (HALT)", dur: "2–15 dk",
    steps: ["Aç mısın? → Hafif, işlenmemiş bir şey ye", "Uykusuz musun? → Kısa kestirmeyi düşün", "Gergin / yalnız mısın? → Biriyle 5 dk konuş"],
    why: "HALT (Hungry, Angry, Lonely, Tired) klinik bir hatırlatıcıdır, bilimsel bir model değildir. Açlık, uykusuzluk ve stresin öz-denetimi zorlaştırdığı genel olarak desteklenir. Not: \"İrade bir yakıt gibi tükenir\" (ego depletion) fikri büyük ölçekli tekrar çalışmasında doğrulanmadı.",
    ev: "zayif", src: ["hagger2016"] },

  { id: "kestirme", levels: [3, 4], envs: ["ev", "yurt"], title: "10–20 dk kestirme", dur: "10–20 dk",
    steps: ["Alarm kur: en fazla 20 dk", "Kalkınca yüzünü yıka", "Akşamüstü geç saatte yapma"],
    why: "Uyku kısıtlaması sonrası 10 dk kestirme, uyanıklık ve bilişsel performansı hemen iyileştirdi; 20–30 dk kestirmelerde kalkış sonrası sersemlik (sleep inertia) görüldü.",
    ev: "orta", src: ["brooks2006"] },

  { id: "kardiyo", levels: [4], envs: ALL_ENVS, title: "20–30 dk orta tempo kardiyo", dur: "20–30 dk",
    steps: ["Koşu, bisiklet veya tempolu yürüyüş", "Konuşabileceğin tempoda kal (Zone 2)", "Dönüşte duş, ardından başlangıç görevi"],
    why: "Egzersiz BDNF (brain-derived neurotrophic factor) düzeyini artırır ve akut egzersiz sonrası bilişsel performans iyileşir (iki meta-analiz). Stres ve kaygıyı azaltmada hareket, kanıtı en sağlam araçlardan biridir.",
    ev: "guclu", src: ["szuhany2015", "chang2012"] },

  { id: "doga", levels: [3, 4], envs: ALL_ENVS, title: "Park / yeşil alanda 20+ dk yürüyüş", dur: "20–50 dk",
    steps: ["Telefonu cebinde tut, ekrana bakma", "Yeşil alan veya ağaçlık bir rota seç", "Dönüşte direkt başlangıç görevi"],
    why: "Parkta yapılan yürüyüş sonrası, şehir içi yürüyüşe göre ters sayı dizisi (backwards digit span) performansı arttı. Dikkat yenilenme teorisiyle uyumludur.",
    ev: "orta", src: ["berman2008", "kaplan1995"] },
];

const LEVEL4_NOTE = "Bu durum haftalarca sık tekrarlıyorsa, uyku ve iştah bozuluyorsa veya hiçbir şeyden keyif alamıyorsan bu bir verimlilik sorunu olmayabilir. Üniversitenin psikolojik danışmanlık birimi veya bir uzmanla görüşmek mantıklı bir sonraki adımdır.";
