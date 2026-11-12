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

// Seviyeler bir şiddet merdiveni değil, duruma göre seçilir. Seviye 2 düşük, Seviye 4 yüksek uyarılmışlıktır.
const LEVELS = [
  { id: 1, name: "Hafif kayma",
    signs: ["Elin telefona gidiyor", "Aynı paragrafı tekrar okuyorsun", "Sıkılma, huzursuzluk"],
    goal: "Döngüye girmeden kesmek. 2–5 dk." },
  { id: 2, name: "Zihinsel sis (brain fog)",
    signs: ["Uyuşukluk, esneme", "Okuduğunu anlamıyorsun", "Masada çökmüş oturuş"],
    goal: "Uyarılmışlık düşük: yükseltmek. 5–10 dk. Her gün böyleyse önce uykuna bak." },
  { id: 3, name: "Uzun kaçış sonrası",
    signs: ["Uzun süre oyun / kısa video / porno tükettin", "\"Gün zaten bitti\" düşüncesi", "Başlamak imkânsız görünüyor"],
    goal: "Kaymanın güne yayılmasını önlemek: ortamı değiştir, 10 dk'lık bir blokla dön. 10–20 dk." },
  { id: 4, name: "Yüksek gerginlik ya da donma",
    signs: ["Yoğun kaygı, çarpıntı, yerinde duramama", "Ya da tamamen donmuş, hiçbir şey yapamıyor hissi", "Önceki müdahaleler bugün işe yaramadı"],
    goal: "Stres yükünü nefes ve hareketle boşaltmak. 20–40 dk." },
];

const SOURCES = {
  albulescu2022: "Albulescu, P. ve ark. (2022). \"Give me a break!\" A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. PLoS ONE, 17(8), e0272460. https://doi.org/10.1371/journal.pone.0272460",
  ariga2011: "Ariga, A. & Lleras, A. (2011). Brief and rare mental \"breaks\" keep you focused: Deactivation and reactivation of task goals preempt vigilance decrements. Cognition, 118(3), 439–443. https://doi.org/10.1016/j.cognition.2010.12.007",
  balban2023: "Balban, M. Y. ve ark. (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. Cell Reports Medicine, 4(1), 100895. https://doi.org/10.1016/j.xcrm.2022.100895",
  berman2008: "Berman, M. G., Jonides, J. & Kaplan, S. (2008). The cognitive benefits of interacting with nature. Psychological Science, 19(12), 1207–1212. https://doi.org/10.1111/j.1467-9280.2008.02225.x",
  brooks2006: "Brooks, A. & Lack, L. (2006). A brief afternoon nap following nocturnal sleep restriction: Which nap duration is most recuperative? Sleep, 29(6), 831–840. https://doi.org/10.1093/sleep/29.6.831",
  chang2012: "Chang, Y. K. ve ark. (2012). The effects of acute exercise on cognitive performance: A meta-analysis. Brain Research, 1453, 87–101. https://doi.org/10.1016/j.brainres.2012.02.068",
  dai2014: "Dai, H., Milkman, K. L. & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science, 60(10), 2563–2582. https://doi.org/10.1287/mnsc.2014.1901",
  duckworth2016: "Duckworth, A. L., Gendler, T. S. & Gross, J. J. (2016). Situational strategies for self-control. Perspectives on Psychological Science, 11(1), 35–55. https://doi.org/10.1177/1745691615623247",
  ganio2011: "Ganio, M. S. ve ark. (2011). Mild dehydration impairs cognitive performance and mood of men. British Journal of Nutrition, 106(10), 1535–1543. https://doi.org/10.1017/S0007114511002005",
  edmonds2013: "Edmonds, C. J., Crombie, R. & Gardner, M. R. (2013). Subjective thirst moderates changes in speed of responding associated with water consumption. Frontiers in Human Neuroscience, 7, 363. https://doi.org/10.3389/fnhum.2013.00363",
  godek2022: "Godek, D. & Freeman, A. M. (2022). Physiology, Diving Reflex. StatPearls Publishing (güncelleme 26.09.2022). PMID 30855833. https://www.ncbi.nlm.nih.gov/books/NBK538245/",
  gollwitzer1999: "Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. American Psychologist, 54(7), 493–503. https://doi.org/10.1037/0003-066X.54.7.493",
  gollwitzer2006: "Gollwitzer, P. M. & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119. https://doi.org/10.1016/S0065-2601(06)38002-1",
  wang2021: "Wang, G., Wang, Y. & Gai, X. (2021). A meta-analysis of the effects of mental contrasting with implementation intentions on goal attainment. Frontiers in Psychology, 12, 565202. https://doi.org/10.3389/fpsyg.2021.565202",
  hagger2016: "Hagger, M. S. ve ark. (2016). A multilab preregistered replication of the ego-depletion effect. Perspectives on Psychological Science, 11(4), 546–573. https://doi.org/10.1177/1745691616652873",
  vohs2021: "Vohs, K. D., Schmeichel, B. J. ve ark. (2021). A multisite preregistered paradigmatic test of the ego-depletion effect. Psychological Science, 32(10), 1566–1581. https://doi.org/10.1177/0956797621989733",
  kaplan1995: "Kaplan, S. (1995). The restorative benefits of nature: Toward an integrative framework. Journal of Environmental Psychology, 15(3), 169–182. https://doi.org/10.1016/0272-4944(95)90001-2",
  stevenson2018: "Stevenson, M. P., Schilhab, T. & Bentsen, P. (2018). Attention Restoration Theory II: A systematic review to clarify attention processes affected by exposure to natural environments. Journal of Toxicology and Environmental Health, Part B, 21(4), 227–268. https://doi.org/10.1080/10937404.2018.1505571",
  lembke2021: "Lembke, A. (2021). Dopamine Nation: Finding Balance in the Age of Indulgence. New York: Dutton. ISBN 978-1-5247-4672-8. (Popüler kitap; klinik görüş.)",
  nehlig2010: "Nehlig, A. (2010). Is caffeine a cognitive enhancer? Journal of Alzheimer's Disease, 20(S1), S85–S94. https://doi.org/10.3233/JAD-2010-091315",
  oppezzo2014: "Oppezzo, M. & Schwartz, D. L. (2014). Give your ideas some legs: The positive effect of walking on creative thinking. Journal of Experimental Psychology: Learning, Memory, and Cognition, 40(4), 1142–1152. https://doi.org/10.1037/a0036577",
  owen2008: "Owen, G. N. ve ark. (2008). The combined effects of L-theanine and caffeine on cognitive performance and mood. Nutritional Neuroscience, 11(4), 193–198. https://doi.org/10.1179/147683008X301513",
  efsa2015: "EFSA Panel on Dietetic Products, Nutrition and Allergies (2015). Scientific opinion on the safety of caffeine. EFSA Journal, 13(5), 4102. https://doi.org/10.2903/j.efsa.2015.4102",
  klevebrant2022: "Klevebrant, L. & Frick, A. (2022). Effects of caffeine on anxiety and panic attacks in patients with panic disorder: A systematic review and meta-analysis. General Hospital Psychiatry, 74, 22–31. https://doi.org/10.1016/j.genhosppsych.2021.11.005",
  gardiner2023: "Gardiner, C. ve ark. (2023). The effect of caffeine on subsequent sleep: A systematic review and meta-analysis. Sleep Medicine Reviews, 69, 101764. https://doi.org/10.1016/j.smrv.2023.101764",
  sirois2013: "Sirois, F. & Pychyl, T. (2013). Procrastination and the priority of short-term mood regulation: Consequences for future self. Social and Personality Psychology Compass, 7(2), 115–127. https://doi.org/10.1111/spc3.12011",
  sramek2000: "Šrámek, P. ve ark. (2000). Human physiological responses to immersion into water of different temperatures. European Journal of Applied Physiology, 81(5), 436–442. https://doi.org/10.1007/s004210050065",
  shattock2012: "Shattock, M. J. & Tipton, M. J. (2012). 'Autonomic conflict': A different way to die during cold water immersion? Journal of Physiology, 590(14), 3219–3230. https://doi.org/10.1113/jphysiol.2012.229864",
  linehan2015: "Linehan, M. M. (2015). DBT Skills Training Manual (2. baskı). Guilford Press.",
  steel2007: "Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure. Psychological Bulletin, 133(1), 65–94. https://doi.org/10.1037/0033-2909.133.1.65",
  szuhany2015: "Szuhany, K. L., Bugatti, M. & Otto, M. W. (2015). A meta-analytic review of the effects of exercise on brain-derived neurotrophic factor. Journal of Psychiatric Research, 60, 56–64. https://doi.org/10.1016/j.jpsychires.2014.10.003",
  ensari2015: "Ensari, I., Greenlee, T. A., Motl, R. W. & Petruzzello, S. J. (2015). Meta-analysis of acute exercise effects on state anxiety: An update of randomized controlled trials over the past 25 years. Depression and Anxiety, 32(8), 624–634. https://doi.org/10.1002/da.22370",
  singh2023: "Singh, B. ve ark. (2023). Effectiveness of physical activity interventions for improving depression, anxiety and distress: An overview of systematic reviews. British Journal of Sports Medicine, 57(18), 1203–1209. https://doi.org/10.1136/bjsports-2022-106195",
  ward2017: "Ward, A. F. ve ark. (2017). Brain drain: The mere presence of one's own smartphone reduces available cognitive capacity. Journal of the Association for Consumer Research, 2(2), 140–154. https://doi.org/10.1086/691462",
  parry2024: "Parry, D. A. (2024). Does the mere presence of a smartphone impact cognitive performance? A meta-analysis of the \"brain drain effect\". Media Psychology, 27(5), 737–762. https://doi.org/10.1080/15213269.2023.2286647",
  hartmann2020: "Hartmann, M., Martarelli, C. S., Reber, T. P. & Rothen, N. (2020). Does a smartphone on the desk drain our brain? No evidence of cognitive costs due to smartphone presence in a short-term and prospective memory task. Consciousness and Cognition, 86, 103033. https://doi.org/10.1016/j.concog.2020.103033",
  talens2023: "Talens-Estarelles, C. ve ark. (2023). The effects of breaks on digital eye strain, dry eye and binocular vision: Testing the 20-20-20 rule. Contact Lens and Anterior Eye, 46(2), 101744. https://doi.org/10.1016/j.clae.2022.101744",
  gruning2023: "Grüning, D. J., Riedel, F. & Lorenz-Spreen, P. (2023). Directing smartphone use through the self-nudge app one sec. PNAS, 120(8), e2213114120. https://doi.org/10.1073/pnas.2213114120",
  haskell2008: "Haskell, C. F. ve ark. (2008). The effects of L-theanine, caffeine and their combination on cognition and mood. Biological Psychology, 77(2), 113–122. https://doi.org/10.1016/j.biopsycho.2007.09.008",
  buchanan2022: "Buchanan, K. L. ve ark. (2022). The preference for sugar over sweetener depends on a gut sensor cell. Nature Neuroscience, 25(2), 191–200. https://doi.org/10.1038/s41593-021-00982-7",
  xie2023: "Xie, J. ve ark. (2023). The effect of short-form video addiction on undergraduates' academic procrastination: A moderated mediation model. Frontiers in Psychology, 14, 1298361. https://doi.org/10.3389/fpsyg.2023.1298361",
  ruizpardo2022: "Ruiz Pardo, A. C. & Minda, J. P. (2022). Reexamining the \"brain drain\" effect: A replication of Ward et al. (2017). Acta Psychologica, 230, 103717. https://doi.org/10.1016/j.actpsy.2022.103717",
  // --- Ödül, dopamin, davranışsal bağımlılık ---
  schultz2016: "Schultz, W. (2016). Dopamine reward prediction error coding. Dialogues in Clinical Neuroscience, 18(1), 23–32. https://doi.org/10.31887/DCNS.2016.18.1/wschultz",
  berridge2016: "Berridge, K. C. & Robinson, T. E. (2016). Liking, wanting, and the incentive-sensitization theory of addiction. American Psychologist, 71(8), 670–679. https://doi.org/10.1037/amp0000059",
  salamone2012: "Salamone, J. D. & Correa, M. (2012). The mysterious motivational functions of mesolimbic dopamine. Neuron, 76(3), 470–485. https://doi.org/10.1016/j.neuron.2012.10.021",
  niv2007: "Niv, Y., Daw, N. D., Joel, D. & Dayan, P. (2007). Tonic dopamine: Opportunity costs and the control of response vigor. Psychopharmacology, 191(3), 507–520. https://doi.org/10.1007/s00213-006-0502-4",
  kurzban2013: "Kurzban, R., Duckworth, A., Kable, J. W. & Myers, J. (2013). An opportunity cost model of subjective effort and task performance. Behavioral and Brain Sciences, 36(6), 661–679. https://doi.org/10.1017/S0140525X12003196",
  agrawal2022: "Agrawal, M., Mattar, M. G., Cohen, J. D. & Daw, N. D. (2022). The temporal dynamics of opportunity costs: A normative account of cognitive fatigue and boredom. Psychological Review, 129(3), 564–585. https://doi.org/10.1037/rev0000309",
  fiorillo2003: "Fiorillo, C. D., Tobler, P. N. & Schultz, W. (2003). Discrete coding of reward probability and uncertainty by dopamine neurons. Science, 299(5614), 1898–1902. https://doi.org/10.1126/science.1077349",
  ferster1957: "Ferster, C. B. & Skinner, B. F. (1957). Schedules of Reinforcement. Appleton-Century-Crofts. https://doi.org/10.1037/10627-000",
  flaherty1996: "Flaherty, C. F. (1996). Incentive Relativity. Cambridge University Press.",
  brand2016: "Brand, M., Young, K. S., Laier, C., Wölfling, K. & Potenza, M. N. (2016). Integrating psychological and neurobiological considerations regarding the development and maintenance of specific Internet-use disorders: An Interaction of Person-Affect-Cognition-Execution (I-PACE) model. Neuroscience & Biobehavioral Reviews, 71, 252–266. https://doi.org/10.1016/j.neubiorev.2016.08.033",
  brewer2017: "Brewer, J. (2017). The Craving Mind: From Cigarettes to Smartphones to Love — Why We Get Hooked and How We Can Break Bad Habits. Yale University Press. ISBN 978-0-300-22324-8.",
  volkow2009: "Volkow, N. D., Fowler, J. S., Wang, G.-J., Baler, R. & Telang, F. (2009). Imaging dopamine's role in drug abuse and addiction. Neuropharmacology, 56(Suppl. 1), 3–8. https://doi.org/10.1016/j.neuropharm.2008.05.022",
  walla2024: "Walla, P. & Zheng, Y. (2024). Intense short-video-based social media use reduces the P300 event-related potential component in a visual oddball experiment: A sign for reduced attention. Life, 14(3), 290. https://doi.org/10.3390/life14030290",
  nguyen2025: "Nguyen, L. ve ark. (2025). Feeds, feelings, and focus: A systematic review and meta-analysis examining the cognitive and mental health correlates of short-form video use. Psychological Bulletin, 151(9), 1125–1146. https://doi.org/10.1037/bul0000498",
  kuhn2014: "Kühn, S. & Gallinat, J. (2014). Brain structure and functional connectivity associated with pornography consumption: The brain on porn. JAMA Psychiatry, 71(7), 827–834. https://doi.org/10.1001/jamapsychiatry.2014.93",
  voon2014: "Voon, V. ve ark. (2014). Neural correlates of sexual cue reactivity in individuals with and without compulsive sexual behaviours. PLoS ONE, 9(7), e102419. https://doi.org/10.1371/journal.pone.0102419",
  laier2013: "Laier, C., Schulte, F. P. & Brand, M. (2013). Pornographic picture processing interferes with working memory performance. Journal of Sex Research, 50(7), 642–652. https://doi.org/10.1080/00224499.2012.716873",
  kraus2018: "Kraus, S. W. ve ark. (2018). Compulsive sexual behaviour disorder in the ICD-11. World Psychiatry, 17(1), 109–110. https://doi.org/10.1002/wps.20499",
  grubbs2019: "Grubbs, J. B., Perry, S. L., Wilt, J. A. & Reid, R. C. (2019). Pornography problems due to moral incongruence: An integrative model with a systematic review and meta-analysis. Archives of Sexual Behavior, 48(2), 397–415. https://doi.org/10.1007/s10508-018-1248-x",
  difeliceantonio2018: "DiFeliceantonio, A. G. ve ark. (2018). Supra-additive effects of combining fat and carbohydrate on food reward. Cell Metabolism, 28(1), 33–44.e3. https://doi.org/10.1016/j.cmet.2018.05.018",
  hall2019: "Hall, K. D. ve ark. (2019). Ultra-processed diets cause excess calorie intake and weight gain: An inpatient randomized controlled trial of ad libitum food intake. Cell Metabolism, 30(1), 67–77.e3. https://doi.org/10.1016/j.cmet.2019.05.008",
  kaelberer2018: "Kaelberer, M. M. ve ark. (2018). A gut-brain neural circuit for nutrient sensory transduction. Science, 361(6408), eaat5236. https://doi.org/10.1126/science.aat5236",
  lane2024: "Lane, M. M. ve ark. (2024). Ultra-processed food exposure and adverse health outcomes: Umbrella review of epidemiological meta-analyses. BMJ, 384, e077310. https://doi.org/10.1136/bmj-2023-077310",
  gearhardt2016: "Gearhardt, A. N., Corbin, W. R. & Brownell, K. D. (2016). Development of the Yale Food Addiction Scale Version 2.0. Psychology of Addictive Behaviors, 30(1), 113–121. https://doi.org/10.1037/adb0000136",
  // --- Evrimsel çerçeve ---
  li2018: "Li, N. P., van Vugt, M. & Colarelli, S. M. (2018). The evolutionary mismatch hypothesis: Implications for psychological science. Current Directions in Psychological Science, 27(1), 38–44. https://doi.org/10.1177/0963721417731378",
  tinbergen1950: "Tinbergen, N. & Perdeck, A. C. (1950). On the stimulus situation releasing the begging response in the newly hatched herring gull chick (Larus argentatus argentatus Pont.). Behaviour, 3(1), 1–39. https://doi.org/10.1163/156853951X00197",
  barrett2010: "Barrett, D. (2010). Supernormal Stimuli: How Primal Urges Overran Their Evolutionary Purpose. W. W. Norton. (Popüler bilim kitabı; kavram için.)",
  bromberg2009: "Bromberg-Martin, E. S. & Hikosaka, O. (2009). Midbrain dopamine neurons signal preference for advance information about upcoming rewards. Neuron, 63(1), 119–126. https://doi.org/10.1016/j.neuron.2009.06.009",
  fawcett2012: "Fawcett, T. W., McNamara, J. M. & Houston, A. I. (2012). When is it adaptive to be patient? A general framework for evaluating delayed rewards. Behavioural Processes, 89(2), 128–136. https://doi.org/10.1016/j.beproc.2011.08.015",
  kidd2013: "Kidd, C., Palmeri, H. & Aslin, R. N. (2013). Rational snacking: Young children's decision-making on the marshmallow task is moderated by beliefs about environmental reliability. Cognition, 126(1), 109–114. https://doi.org/10.1016/j.cognition.2012.08.004",
  charnov1976: "Charnov, E. L. (1976). Optimal foraging, the marginal value theorem. Theoretical Population Biology, 9(2), 129–136. https://doi.org/10.1016/0040-5809(76)90040-X",
  pirolli1999: "Pirolli, P. & Card, S. (1999). Information foraging. Psychological Review, 106(4), 643–675. https://doi.org/10.1037/0033-295X.106.4.643",
  hills2015: "Hills, T. T. ve ark. (2015). Exploration versus exploitation in space, mind, and society. Trends in Cognitive Sciences, 19(1), 46–54. https://doi.org/10.1016/j.tics.2014.10.004",
  // --- Dopamin orucu, oyun ---
  radtke2022: "Radtke, T., Apel, T., Schenkel, K., Keller, J. & von Lindern, E. (2022). Digital detox: An effective solution in the smartphone era? A systematic literature review. Mobile Media & Communication, 10(2), 190–215. https://doi.org/10.1177/20501579211028647",
  allcott2022: "Allcott, H., Gentzkow, M. & Song, L. (2022). Digital addiction. American Economic Review, 112(7), 2424–2463. https://doi.org/10.1257/aer.20210867",
  lerman1995: "Lerman, D. C. & Iwata, B. A. (1995). Prevalence of the extinction burst and its attenuation during treatment. Journal of Applied Behavior Analysis, 28(1), 93–94. https://doi.org/10.1901/jaba.1995.28-93",
  who2019icd11: "World Health Organization (2019). ICD-11 for Mortality and Morbidity Statistics: 6C51 Gaming disorder. https://icd.who.int/browse11/l-m/en#/http://id.who.int/icd/entity/1448597234",
  stevens2021: "Stevens, M. W. R., Dorstyn, D., Delfabbro, P. H. & King, D. L. (2021). Global prevalence of gaming disorder: A systematic review and meta-analysis. Australian & New Zealand Journal of Psychiatry, 55(6), 553–568. https://doi.org/10.1177/0004867420962851",
  spicer2022: "Spicer, S. G. ve ark. (2022). Loot boxes, problem gambling and problem video gaming: A systematic review and meta-synthesis. New Media & Society, 24(4), 1001–1022. https://doi.org/10.1177/14614448211027175",
  zendle2018: "Zendle, D. & Cairns, P. (2018). Video game loot boxes are linked to problem gambling: Results of a large-scale survey. PLoS ONE, 13(11), e0206767. https://doi.org/10.1371/journal.pone.0206767",
  koepp1998: "Koepp, M. J. ve ark. (1998). Evidence for striatal dopamine release during a video game. Nature, 393(6682), 266–268. https://doi.org/10.1038/30498",
  bediou2018: "Bediou, B. ve ark. (2018). Meta-analysis of action video game impact on perceptual, attentional, and cognitive skills. Psychological Bulletin, 144(1), 77–110. https://doi.org/10.1037/bul0000130",
  sala2018: "Sala, G., Tatlidil, K. S. & Gobet, F. (2018). Video game training does not enhance cognitive ability: A comprehensive meta-analytic investigation. Psychological Bulletin, 144(2), 111–139. https://doi.org/10.1037/bul0000139",
  vuorre2022: "Vuorre, M., Johannes, N., Magnusson, K. & Przybylski, A. K. (2022). Time spent playing video games is unlikely to impact well-being. Royal Society Open Science, 9(7), 220411. https://doi.org/10.1098/rsos.220411",
  przybylski2010: "Przybylski, A. K., Rigby, C. S. & Ryan, R. M. (2010). A motivational model of video game engagement. Review of General Psychology, 14(2), 154–166. https://doi.org/10.1037/a0019440",
  // --- Kayma, nüks önleme, öz-izleme ---
  larimer1999: "Larimer, M. E., Palmer, R. S. & Marlatt, G. A. (1999). Relapse prevention: An overview of Marlatt's cognitive-behavioral model. Alcohol Research & Health, 23(2), 151–160.",
  wohl2010: "Wohl, M. J. A., Pychyl, T. A. & Bennett, S. H. (2010). I forgive myself, now I can study: How self-forgiveness for procrastinating can reduce future procrastination. Personality and Individual Differences, 48(7), 803–808. https://doi.org/10.1016/j.paid.2010.01.029",
  breines2012: "Breines, J. G. & Chen, S. (2012). Self-compassion increases self-improvement motivation. Personality and Social Psychology Bulletin, 38(9), 1133–1143. https://doi.org/10.1177/0146167212445599",
  bowen2009: "Bowen, S. & Marlatt, A. (2009). Surfing the urge: Brief mindfulness-based intervention for college student smokers. Psychology of Addictive Behaviors, 23(4), 666–671. https://doi.org/10.1037/a0017127",
  bowen2014: "Bowen, S. ve ark. (2014). Relative efficacy of mindfulness-based relapse prevention, standard relapse prevention, and treatment as usual for substance use disorders: A randomized clinical trial. JAMA Psychiatry, 71(5), 547–556. https://doi.org/10.1001/jamapsychiatry.2013.4546",
  masicampo2011: "Masicampo, E. J. & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. Journal of Personality and Social Psychology, 101(4), 667–683. https://doi.org/10.1037/a0024192",
  wood2016: "Wood, W. & Rünger, D. (2016). Psychology of habit. Annual Review of Psychology, 67, 289–314. https://doi.org/10.1146/annurev-psych-122414-033417",
  lally2010: "Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W. & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology, 40(6), 998–1009. https://doi.org/10.1002/ejsp.674",
  friese2017: "Friese, M., Frankenbach, J., Job, V. & Loschelder, D. D. (2017). Does self-control training improve self-control? A meta-analysis. Perspectives on Psychological Science, 12(6), 1077–1099. https://doi.org/10.1177/1745691617697076",
  // --- Dikkat ve çalışma blokları ---
  leroyglomb2018: "Leroy, S. & Glomb, T. M. (2018). Tasks interrupted: How anticipating time pressure on resumption of an interrupted task causes attention residue and low performance on interrupting tasks and how a \"ready-to-resume\" plan mitigates the effects. Organization Science, 29(3), 380–397. https://doi.org/10.1287/orsc.2017.1184",
  szpunar2013: "Szpunar, K. K., Khan, N. Y. & Schacter, D. L. (2013). Interpolated memory tests reduce mind wandering and improve learning of online lectures. PNAS, 110(16), 6313–6317. https://doi.org/10.1073/pnas.1221764110",
  biwer2023: "Biwer, F., Wiradhany, W., oude Egbrink, M. G. A. & de Bruin, A. B. H. (2023). Understanding effort regulation: Comparing \"Pomodoro\" breaks and self-regulated breaks. British Journal of Educational Psychology, 93(S2), 353–367. https://doi.org/10.1111/bjep.12593",
  warm2008: "Warm, J. S., Parasuraman, R. & Matthews, G. (2008). Vigilance requires hard mental work and is stressful. Human Factors, 50(3), 433–441. https://doi.org/10.1518/001872008X312152",
  // --- Uyku ---
  lim2010: "Lim, J. & Dinges, D. F. (2010). A meta-analysis of the impact of short-term sleep deprivation on cognitive variables. Psychological Bulletin, 136(3), 375–389. https://doi.org/10.1037/a0018883",
  hershner2014: "Hershner, S. D. & Chervin, R. D. (2014). Causes and consequences of sleepiness among college students. Nature and Science of Sleep, 6, 73–84. https://doi.org/10.2147/NSS.S62907",
  chang2015: "Chang, A.-M., Aeschbach, D., Duffy, J. F. & Czeisler, C. A. (2015). Evening use of light-emitting eReaders negatively affects sleep, circadian timing, and next-morning alertness. PNAS, 112(4), 1232–1237. https://doi.org/10.1073/pnas.1418490112",
  drake2013: "Drake, C., Roehrs, T., Shambroom, J. & Roth, T. (2013). Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. Journal of Clinical Sleep Medicine, 9(11), 1195–1200. https://doi.org/10.5664/jcsm.3170",
  phillips2017: "Phillips, A. J. K. ve ark. (2017). Irregular sleep/wake patterns are associated with poorer academic performance and delayed circadian and sleep/wake timing. Scientific Reports, 7, 3216. https://doi.org/10.1038/s41598-017-03171-4",
  blume2019: "Blume, C., Garbazza, C. & Spitschan, M. (2019). Effects of light on human circadian rhythms, sleep and mood. Somnologie, 23(3), 147–156. https://doi.org/10.1007/s11818-019-00215-x",
  hirshkowitz2015: "Hirshkowitz, M. ve ark. (2015). National Sleep Foundation's sleep time duration recommendations: Methodology and results summary. Sleep Health, 1(1), 40–43. https://doi.org/10.1016/j.sleh.2014.12.010",
  edinger2021: "Edinger, J. D. ve ark. (2021). Behavioral and psychological treatments for chronic insomnia disorder in adults: An American Academy of Sleep Medicine clinical practice guideline. Journal of Clinical Sleep Medicine, 17(2), 255–262. https://doi.org/10.5664/jcsm.8986",
  riemann2023: "Riemann, D. ve ark. (2023). The European Insomnia Guideline: An update on the diagnosis and treatment of insomnia 2023. Journal of Sleep Research, 32(6), e14035. https://doi.org/10.1111/jsr.14035",
  // --- Belirti / yönlendirme ---
  kessler2005: "Kessler, R. C. ve ark. (2005). The World Health Organization Adult ADHD Self-Report Scale (ASRS): A short screening scale for use in the general population. Psychological Medicine, 35(2), 245–256. https://doi.org/10.1017/S0033291704002892",
  song2021: "Song, P. ve ark. (2021). The prevalence of adult attention-deficit hyperactivity disorder: A global systematic review and meta-analysis. Journal of Global Health, 11, 04009. https://doi.org/10.7189/jogh.11.04009",
  apa2022: "American Psychiatric Association (2022). Diagnostic and Statistical Manual of Mental Disorders, 5. baskı, gözden geçirilmiş metin (DSM-5-TR). https://doi.org/10.1176/appi.books.9780890425787",
};

const INTERVENTIONS = [
  { id: "dalga", levels: [1], envs: ALL_ENVS, title: "Dürtüyü izle (urge surfing), 3 dk", dur: "3 dk",
    steps: ["Telefona uzanma dürtüsünü fark et, hareketi durdur", "Dürtünün bedende nerede hissedildiğini adlandır: göğüs, eller, karın", "3 dk boyunca yükselip alçalmasını izle; ne karşı koy ne uy", "Dürtü azalınca kaldığın satıra dön"],
    why: "Dürtüler genellikle birkaç dakika içinde yükselip kendiliğinden azalır; bastırmak yerine izlemek, dürtü ile davranış arasındaki otomatik bağı zayıflatır. Öğrenci sigara içicilerinde kısa bir dürtü izleme talimatı bir hafta sonra içilen sigarayı azalttı; bu tekniği içeren nüks önleme programı (MBRP) 12 ayda standart tedaviden iyi sonuç verdi. Telefon ve kısa video dürtüsü için doğrudan deney yok. Masadan kalkmadan yapılabilen tek seçenek budur.",
    ev: "orta", src: ["bowen2009", "bowen2014"] },

  { id: "su", levels: [1, 2], envs: ALL_ENVS, title: "Bir bardak su iç", dur: "1 dk",
    steps: ["Masadan kalk, suyu kendin doldur", "Bir bardağı bitir, masaya dön"],
    why: "Egzersizle yaklaşık %1,5 sıvı kaybı yaşayan erkeklerde dikkat ve ruh hâli düştü. Masada oturan biri nadiren bu kadar susuz kalır; susuz değilken su içmenin etkisi küçük ve tutarsızdır. Pratik değeri: masadan kısa ve uyaransız bir kopuş.",
    ev: "zayif", src: ["ganio2011", "edmonds2013"] },

  { id: "uzak", levels: [1], envs: ALL_ENVS, title: "Uzağa bak (2–3 dk)", dur: "2–3 dk",
    steps: ["Pencereye veya koridorun sonuna git", "En uzak noktaya bak, gözlerini gevşet", "Bu sürede telefona bakma"],
    why: "29 kişilik bir çalışmada 20-20-20 kuralı hatırlatıcıları (20 dakikada bir, 20 saniye uzağa bakmak) iki hafta içinde ekran kaynaklı göz yorgunluğu şikâyetlerini azalttı. \"Uzağa bakmak stres sistemini doğrudan kapatır\" iddiası popülerdir ama doğrudan kanıtı yoktur. Asıl işlevi: kısa, uyaransız mola.",
    ev: "zayif", src: ["talens2023", "albulescu2022"] },

  { id: "kalk", levels: [1], envs: ALL_ENVS, title: "Kalk, 3–5 dk yürü", dur: "3–5 dk",
    steps: ["Ayağa kalk, oda / koridor boyunca yürü", "Telefonu masada bırak", "Süre bitince otur ve kaldığın satırı bul"],
    why: "Mikro-molalar (≤10 dk) canlılığı artırır ve yorgunluğu azaltır; performansa genel etkisi anlamlı değildi, yalnızca bilişsel yükü düşük görevlerde iyileşme görüldü. Uzun görevlerde kısa hedef-kopuşları dikkat düşüşünü önleyebilir (tek, küçük bir deney).",
    ev: "orta", src: ["albulescu2022", "ariga2011"] },

  { id: "telefon", levels: [1, 2, 3], envs: ALL_ENVS, title: "Telefonu görüş alanından çıkar", dur: "1 dk",
    steps: ["Telefonu sessize al", "Başka odaya ya da çantanın içine koy", "Bilgisayarda dikkat dağıtan sekmeleri kapat"],
    why: "Bir çalışmada telefonun masada durması çalışma belleğini düşürdü; ön kayıtlı birebir tekrarında etki bulunmadı, 56 etki büyüklüğünü birleştiren bir meta-analizde ise yalnızca çalışma belleğinde küçük bir etki kaldı. Daha sağlam gerekçe: telefona uzanmayı zorlaştırmak. Ortamı değiştiren durumsal stratejiler, anlık irade direncinden daha etkilidir.",
    ev: "orta", src: ["duckworth2016", "ward2017", "ruizpardo2022", "hartmann2020", "parry2024"] },

  { id: "bosalt", levels: [1, 2], envs: ALL_ENVS, title: "Zihni boşalt: açık işleri yaz (2 dk)", dur: "2 dk",
    steps: ["Kafanda dönen her şeyi (mesaj, ödev, alışveriş) bir kâğıda yaz", "Her birine tek satırlık bir \"ne zaman\" ekle", "Kâğıdı kapat, masaya dön"],
    why: "Tamamlanmamış işler dikkati böler. Deneylerde, işi yapmak değil, yalnızca ne zaman yapılacağını planlamak bile bu zihinsel müdahaleyi ortadan kaldırdı. Tek laboratuvardan, küçük örneklemli deneyler.",
    ev: "orta", src: ["masicampo2011"] },

  { id: "nefes", levels: [1, 2, 4], envs: ALL_ENVS, title: "Döngüsel iç çekiş (cyclic sighing), 5 dk", dur: "5 dk",
    steps: ["Burundan derin nefes al, sonuna kısa ikinci bir nefes ekle", "Ağızdan yavaş ve uzun ver", "5 dk boyunca tekrarla"],
    why: "Randomize bir çalışmada günlük 5 dk döngüsel iç çekiş, mindfulness meditasyonuna kıyasla olumlu duyguyu daha fazla artırdı ve dinlenik solunum hızını düşürdü. Tek çalışma, sınırlı örneklem.",
    ev: "orta", src: ["balban2023"] },

  { id: "yuz", levels: [2, 3, 4], envs: ALL_ENVS, title: "Yüzünü soğuk suyla yıka / ıslat", dur: "2 dk",
    steps: ["Lavaboya git", "Nefesini tutup 15–30 sn yüzüne soğuk su çarp ya da ıslak soğuk havluyu yüzüne bastır", "Kurulan, 3 yavaş nefes al, masaya dön"],
    why: "Yüzün soğuk suyla teması dalış refleksini (diving reflex) tetikler: vagus siniri üzerinden kalp hızı düşer. Bu yüzden yoğun kaygıda (Seviye 4) hızlı sakinleşme aracı olarak kullanılır. Siste hissedilen canlanma ise soğuk uyaranın ve kısa ortam değişiminin etkisidir; odak üzerine doğrudan çalışma azdır.",
    caution: "Ritim bozukluğu, yavaş kalp atışı, bayılma öyküsü, Raynaud veya soğuk ürtikeri varsa yapma.",
    ev: "zayif", src: ["godek2022", "linehan2015"] },

  { id: "kafein", levels: [1, 2], envs: ALL_ENVS, title: "Kafein (isteğe bağlı L-teanin ile)", dur: "5 dk",
    steps: ["Tek doz, orta miktar: 1 fincan filtre kahve veya 2 bardak çay (~50–120 mg)", "Yatıştan en az 8 saat önce bitir (23:00'te yatıyorsan 15:00'ten sonra alma)", "Kaygılı veya çarpıntılıysan bu adımı atla"],
    why: "Kafein adenozin reseptörlerini bloke ederek yorgunluk hissini geciktirir; uyanıklık ve basit dikkat görevlerinde etkisi tutarlıdır. 50 mg kafein + 100 mg L-teanin, plaseboya göre dikkat değiştirmede hızı ve doğruluğu iyileştirdi; başka bir çalışmada yorgunluk hissini de azalttı. Etkiler ve örneklemler küçüktür. Kafeinin yarılanma ömrü kişiden kişiye çok değişir (genelde 3–6 saat; doğum kontrol hapı kullananlarda ve gebelikte daha uzun).",
    caution: "Seviye 3–4'te, kaygı / çarpıntı varken kullanma. Panik bozukluğu, ritim bozukluğu veya kontrolsüz yüksek tansiyon varsa ya da gebeysen hekimine danış (gebelikte günlük üst sınır ~200 mg). Tek seferde 200 mg'ı, günde 400 mg'ı aşma; enerji içecekleri ve DEHB ilaçlarıyla etkisi toplanır.",
    ev: "guclu", src: ["nehlig2010", "owen2008", "haskell2008", "efsa2015", "klevebrant2022", "gardiner2023"] },

  { id: "hareket", levels: [2], envs: ["ev", "yurt"], title: "5 dk vücut ağırlığı hareketi", dur: "5 dk",
    steps: ["20 squat, 10 şınav, 30 sn plank", "2–3 tur, nefes nefese kalmadan", "Su iç, masaya dön"],
    why: "Akut egzersiz bilişsel performansta küçük bir artış sağlar (meta-analiz, g≈0,1); süre ve yoğunluk etkiyi değiştirir ve kanıt daha çok 10–20 dk üzeri egzersizden gelir. 5 dk'lık hareketin asıl işlevi uyarılmışlığı yükseltmek ve masadan kopmaktır.",
    ev: "orta", src: ["chang2012"] },

  { id: "disari", levels: [2, 3], envs: ALL_ENVS, title: "Binadan çık, serin havada 5–10 dk yürü", dur: "5–10 dk",
    steps: ["Hafif serin hissedecek kıyafetle dışarı çık", "Telefona bakmadan tempolu yürü", "Dönüşte direkt masaya otur"],
    why: "Üç etkiyi birleştirir: hareket, hafif soğuk uyaran, ortam değişimi. Yürümek yaratıcı fikir üretimini artırdı; doğa maruziyetinin çalışma belleği ve bilişsel esneklik üzerinde küçük–orta, ölçüme göre değişen etkileri bulundu (dikkat yenilenme teorisi). 5–10 dk'lık kısa yürüyüş için doğrudan veri yok.",
    ev: "orta", src: ["stevenson2018", "berman2008", "oppezzo2014"] },

  { id: "mekan", levels: [2, 3], envs: ALL_ENVS, title: "Çalışma yerini değiştir", dur: "5 dk",
    steps: ["Başka bir masa / kat / oda / mekâna geç", "Yeni yerde yalnızca bir dersin materyali olsun"],
    why: "Alışkanlıklar ortam ipuçlarına bağlanır. Kaçış davranışının tekrarlandığı ortamdan çıkmak, otomatik tetikleyicileri (cue) devre dışı bırakır.",
    ev: "orta", src: ["wood2016"] },

  { id: "affet", levels: [3], envs: ALL_ENVS, pin: true, title: "Kaymayı kaydet, kendine yüklenme (2 dk)", dur: "2 dk",
    steps: ["Tek cümle yaz: ne kadar sürdü, hemen öncesinde ne hissediyordun", "Kendine şunu söyle: \"Bu bir kayma. Günün geri kalanını belirlemiyor.\"", "Kaybedilen süreyi telafi etmeye çalışma; sıradaki blok 10 dk", "Aynı uygulamaya dönüş yolunu kapat (çıkış yap, telefonu başka odaya koy)"],
    why: "Tek bir kaymayı \"zaten bozdum\" diye yorumlamak (abstinence violation effect), kaymanın nükse dönmesinin bilinen yollarından biridir. Bir sınava çalışmayı ertelediği için kendini affeden öğrenciler, bir sonraki sınavda daha az erteledi; etkiyi olumsuz duygudaki azalma açıkladı. Başarısızlıktan sonra kendine anlayışla yaklaşanlar tekrar sınavı için daha uzun çalıştı.",
    ev: "orta", src: ["larimer1999", "wohl2010", "breines2012"] },

  { id: "dus", levels: [3], envs: ["ev", "yurt"], title: "Duş al (son 30–60 sn soğuk), kıyafet değiştir", dur: "10 dk",
    steps: ["Ilık başla, 3–5 dk", "Son 30–60 sn soğuk su", "Temiz kıyafet giy, odayı havalandır", "Duştan çıkınca direkt başlangıç görevine geç"],
    why: "14°C suda 1 saat (baş dışarıda) kalan genç erkeklerde kandaki noradrenalin %530, dopamin %250 arttı; \"soğuk duş dopamini %250 artırır\" iddiası buradan gelir. Ölçülen beyindeki değil kandaki dopamindir ve 30–60 sn'lik duşa genellenemez. Pratik değeri, ortamı ve beden durumunu belirgin şekilde değiştirerek kaçış davranışıyla bağı kesmesidir. \"Yeni başlangıç\" etkisi takvim dönüm noktalarında gösterildi, duş için test edilmedi.",
    caution: "Kalp-damar rahatsızlığı, ritim bozukluğu veya bayılma öyküsü varsa soğuk suya ani girişten kaçın; soğuğa ılıktan kademeli geç, başını ilk anda soğuk suya sokma.",
    ev: "zayif", src: ["sramek2000", "dai2014", "shattock2012"] },

  { id: "surtunme", levels: [3], envs: ALL_ENVS, title: "Sürtünme ekle (friction)", dur: "5 dk",
    steps: ["Oyundan / uygulamadan çıkış yap, kısayolu kaldır", "Telefonu başka odaya koy", "Site engelleyiciyi (blocker) zaman ayarlı aç", "Masada yalnızca tek dersin materyali kalsın"],
    why: "Davranış en az çaba gerektiren seçeneğe kayar. Kaçış seçeneğine birkaç adım eklemek ve çalışma seçeneğini hazır bırakmak, anlık irade direncine güvenmekten daha etkilidir. Büyük bir saha deneyinde kendi ekran süresi limitini koyabilen kullanıcıların sosyal medya kullanımı belirgin düştü.",
    ev: "orta", src: ["duckworth2016", "wood2016", "allcott2022"] },

  { id: "temel", levels: [3, 4], envs: ALL_ENVS, title: "Temel ihtiyaç kontrolü (HALT)", dur: "2–15 dk",
    steps: ["Aç mısın? → Hafif, işlenmemiş bir şey ye", "Uykusuz musun? → Kısa kestirmeyi düşün", "Gergin / yalnız mısın? → Biriyle 5 dk konuş"],
    why: "HALT (Hungry, Angry, Lonely, Tired) klinik bir hatırlatıcıdır, bilimsel bir model değildir. Açlık, uykusuzluk ve stresin öz-denetimi zorlaştırdığı genel olarak desteklenir. Not: \"İrade bir yakıt gibi tükenir\" (ego depletion) fikri iki büyük ölçekli, ön kayıtlı tekrar çalışmasında doğrulanmadı.",
    ev: "zayif", src: ["hagger2016", "vohs2021"] },

  { id: "kestirme", levels: [2, 3, 4], envs: ["ev", "yurt"], title: "Kısa kestirme (~10 dk uyku)", dur: "15–20 dk",
    steps: ["Alarmı 15–20 dk sonrasına kur (uykuya dalma dahil, hedef ~10 dk uyku)", "Kalkınca ışığı aç, yüzünü yıka", "En geç 15:00–16:00'da yap"],
    why: "Gece uykusu 5 saate kısıtlanan 24 genç yetişkinde 10 dk kestirme, uyanıklık ve bilişsel performansı hemen iyileştirdi; etkinin bir kısmı 155 dk sürdü. 20 dk kestirmenin faydası ancak ~35 dk sonra başladı; 30 dk kestirmede kalkışta sersemlik (sleep inertia) görüldü.",
    caution: "Geceleri uykuya dalmakta zorlanıyorsan (insomnia) gündüz kestirmesi gece uykunu bozabilir. Kaygı yüksekken uykuya dalmak zordur ve yatakta telefona dönme riski artar; önce nefes veya yürüyüş.",
    ev: "orta", src: ["brooks2006"] },

  { id: "kardiyo", levels: [4], envs: ALL_ENVS, title: "20–30 dk orta tempo kardiyo", dur: "20–30 dk",
    steps: ["Koşu, bisiklet veya tempolu yürüyüş", "Konuşabileceğin tempoda kal", "Dönüşte duş, ardından başlangıç görevi"],
    why: "Akut egzersiz durumluk kaygıyı azaltır ve sonrasında bilişsel performans küçük ölçüde iyileşir (meta-analizler). Düzenli egzersiz BDNF düzeyini artırır ve depresyon, kaygı ve sıkıntıyı azaltmada etkilidir.",
    caution: "Göğüs ağrısı, baş dönmesi veya orantısız nefes darlığı olursa dur. Bilinen kalp hastalığı varsa önce hekimine danış. Panik atak yaşıyorsan çarpıntı ilk dakikalarda kaygıyı artırabilir; tempoyu yavaş başlat.",
    ev: "guclu", src: ["ensari2015", "singh2023", "chang2012", "szuhany2015"] },

  { id: "doga", levels: [3, 4], envs: ALL_ENVS, title: "Park / yeşil alanda 20+ dk yürüyüş", dur: "20–50 dk",
    steps: ["Telefonu cebinde tut, ekrana bakma", "Yeşil alan veya ağaçlık bir rota seç", "Dönüşte direkt başlangıç görevi"],
    why: "Küçük bir deneyde parkta yapılan yürüyüş sonrası, şehir içi yürüyüşe göre ters sayı dizisi (backwards digit span) performansı arttı. Sistematik derlemede doğa maruziyetinin etkileri küçük–orta ve ölçüme göre değişken bulundu.",
    ev: "orta", src: ["berman2008", "stevenson2018", "kaplan1995"] },
];

// Kaymadan hemen önceki his (isteğe bağlı kayıt). Geçmiş'te özetlenir.
const TRIGGERS = [
  ["sikilma", "Sıkılma"], ["kaygi", "Kaygı / stres"], ["belirsizlik", "Görev belirsiz veya zor"],
  ["yorgunluk", "Yorgunluk / uykusuzluk"], ["yalnizlik", "Yalnızlık / keyifsizlik"], ["aclik", "Açlık"], ["bilmiyorum", "Bilmiyorum"],
];

// Hazırlık: çalışmaya oturmadan önce. Amaç odak kaymadan önce sürtünmeyi ayarlamak.
const PREP = [
  { id: "telefon", text: "Telefon başka odada ya da çantada, sessizde", why: "Telefonun yakında durmasının dikkate etkisi küçük ve tartışmalı; asıl kazanç, ona uzanmayı zorlaştırmak.", src: ["duckworth2016", "parry2024"] },
  { id: "sekme", text: "Bilgisayarda yalnızca gereken sekmeler açık; oyun / sosyal medya kapalı, çıkış yapılmış", why: "Kaçış seçeneğine adım eklemek anlık dirençten daha etkili.", src: ["duckworth2016"] },
  { id: "materyal", text: "Masada tek dersin materyali var", why: "Her ek seçenek, başlama kararını geciktirir.", src: ["wood2016"] },
  { id: "gorev", text: "İlk görev yazılı ve küçük (\"3. bölüm, ilk 2 sayfa\")", why: "Somut görev, başlama eşiğini düşürür.", src: ["gollwitzer1999"] },
  { id: "plan", text: "Bu bloğun en olası engelini yazdın ve ona eğer–o zaman cevabı verdin (\"bildirim gelirse → telefonu çantaya koyarım\")", why: "Önce engeli düşünüp planı ona bağlamak (WOOP), yalnızca hedef koymaktan daha etkilidir.", src: ["wang2021", "gollwitzer2006"] },
  { id: "su", text: "Masada su var, atıştırmalık yok", why: "Atıştırmalık her sıkılmada küçük bir ödül ve dikkat kesintisi sunar.", src: ["wood2016"] },
  { id: "beden", text: "Son 2 saatte hareket ettin ya da en az kısa bir yürüyüş yaptın", why: "Akut egzersiz sonrası bilişsel performans küçük ama tutarlı artar.", src: ["chang2012"] },
  { id: "kalkis", text: "Bugün her zamanki saatte kalktın ve gün ışığı aldın", why: "Sabit kalkış ve sabah ışığı iç saati sabitler; akşam uyku kolaylaşır.", src: ["phillips2017", "blume2019"] },
  { id: "kafein", text: "Kafein zamanı uygun (yatıştan 8+ saat önce, kaygı yok)", why: "Geç kafein uykuyu, uyku da ertesi günün odağını bozar.", src: ["gardiner2023"] },
  { id: "uyku", text: "Dün gece yeterli uyudun (yoksa bloklarını kısa tut: 10–15 dk)", why: "Uykusuzluk en çok sürekli dikkati düşürür.", src: ["lim2010"] },
];

const LEVEL4_NOTE = "Bu durum iki haftadan uzun süredir çoğu gün tekrarlıyorsa; uykun, iştahın veya enerjin belirgin değiştiyse, eskiden keyif aldığın şeylerden artık keyif alamıyorsan ya da oyun, kısa video, porno veya yeme üzerinde kontrolü kaybettiğini görüyorsan bu bir verimlilik sorunu olmayabilir. Üniversitenin psikolojik danışmanlık birimi, aile hekimi veya psikiyatri polikliniği iyi bir başlangıçtır; teknoloji ve davranışsal bağımlılık için Yeşilay Danışmanlık Merkezi (YEDAM) 115 hattı ücretsiz destek verir. İlk kez yaşadığın göğüs ağrısı, nefes darlığı ya da kendine zarar verme düşüncen varsa 112'yi ara veya en yakın acil servise git.";

const LAPSE_NOTE = "Kaybedilen süreyi telafi etmeye çalışma. Sıradaki blok 10 dk; amaç günün kaybedilmediğini görmek. Kayma bir veri, karakter kanıtı değil.";

// Yardım hatları: Rehber'deki "belirti" modülü ve ana sayfa altbilgisi kullanır.
const HELP_NOTE = "Kendine zarar verme düşüncen varsa: 112 ya da en yakın acil servis. Davranışsal bağımlılık: YEDAM 115.";
