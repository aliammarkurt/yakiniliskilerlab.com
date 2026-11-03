/* ============================================================
   Fikir Havuzu — ekip alanı uygulaması
   ------------------------------------------------------------
   - Giriş: e-posta + şifre (doğrulama e-postası ile) ya da Google
   - Yalnızca Firestore'daki "members" listesinde olan e-postalar girer
   - Araştırmacılar fikir yazar, herkes tüm fikirleri ve yorumları görür
   - Akademisyenler (role: "academic") fikirlere akademik değerlendirme
     ekler ve üye listesini yönetir
   Veri erişimini firestore.rules korur; bu dosya yalnızca arayüzdür.
   ============================================================ */

import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const app = document.getElementById("fh-app");

/* ---------- Dil yardımcıları ---------- */
// Her metin iki dilde üretilir; site.css hangisinin görüneceğine karar verir.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const L = (tr, en) => `<span data-l="tr">${tr}</span><span data-l="en">${en ?? tr}</span>`;
const lang = () => (document.documentElement.lang === "en" ? "en" : "tr");
const tl = (tr, en) => (lang() === "en" ? en : tr);
const fmtDate = (d, withTime) => {
  if (!d) return "";
  const o = withTime
    ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "long", year: "numeric" };
  return L(d.toLocaleDateString("tr-TR", o), d.toLocaleDateString("en-GB", o));
};

/* ---------- Form tanımları ---------- */
// Araştırmacının dolduracağı alanlar (teknik terim yok).
const IDEA_FIELDS = [
  { k: "title", req: true, kind: "input", max: 150,
    tr: "Fikrine kısa bir ad ver", en: "Give your idea a short name",
    htr: "Örneğin: “Telefonla geçen akşamlar ve çiftlerin yakınlığı”", hen: "For example: “Evenings on the phone and couples' closeness”" },
  { k: "spark", req: true, kind: "textarea", rows: 5, max: 6000,
    tr: "Seni bu konuya ne meraklandırdı?", en: "What made you curious about this?",
    htr: "Bir gözlem, kendi ya da çevrendeki bir deneyim, bir okuma, bir haber, danışmanlık pratiğinden bir an… Hikâyesini anlatman yeterli.",
    hen: "An observation, an experience of yours or someone around you, a reading, a news story, a moment from counseling practice… Just tell the story." },
  { k: "question", req: true, kind: "textarea", rows: 8, max: 10000,
    tr: "Merak ettiğin şey ne?", en: "What do you want to find out?",
    htr: "Kendi cümlelerinle, istediğin kadar uzun yaz. Soru biçiminde olması gerekmiyor; aklındaki her ihtimali ekleyebilirsin.",
    hen: "Write in your own words, as long as you like. It doesn't have to be a question; add every possibility you have in mind." },
  { k: "who", kind: "textarea", rows: 3, max: 3000,
    tr: "Bu konu en çok kimleri ilgilendiriyor?", en: "Who does this concern most?",
    htr: "Çiftler, ergenler, evli bireyler, aileler, ebeveynler, arkadaş grupları…", hen: "Couples, adolescents, married people, families, parents, groups of friends…" },
  { k: "benefit", kind: "textarea", rows: 4, max: 4000,
    tr: "Bu sorunun cevabını bulursak kime ne faydası olur?", en: "If we found the answer, who would benefit and how?",
    htr: "Çiftlere, ailelere, psikolojik danışmanlara, okullara, politikaya…", hen: "Couples, families, counselors, schools, policy…" },
  { k: "reading", kind: "input", max: 300, opt: true,
    tr: "Bu fikir hangi okumadan ya da toplantıdan aklına geldi?", en: "Which reading or meeting sparked this idea?",
    htr: "Örneğin: Toplantı 2, Walsh (2003)", hen: "For example: Meeting 2, Walsh (2003)" },
  { k: "links", kind: "textarea", rows: 3, max: 3000, opt: true,
    tr: "Paylaşmak istediğin bir kaynak, haber ya da bağlantı var mı?", en: "Any source, news story or link you want to share?",
    htr: "Her satıra bir tane.", hen: "One per line." },
  { k: "involvement", kind: "radio",
    tr: "Bu fikrin üzerinde çalışmak ister misin?", en: "Would you like to work on this idea?",
    options: [
      ["Evet, üzerinde çalışmak isterim", "Yes, I'd like to work on it"],
      ["Belki", "Maybe"],
      ["Şimdilik yalnızca fikir veriyorum", "For now I'm just sharing the idea"],
    ] },
];

// Akademisyenlerin dolduracağı alanlar. Değerler Türkçe saklanır.
const LEVELS = [["Birey", "Individual"], ["Diyad (çift)", "Dyad (couple)"], ["Aile", "Family"], ["Çok düzeyli", "Multilevel"]];
const DESIGNS = [["Kesitsel", "Cross-sectional"], ["Boylamsal", "Longitudinal"], ["Günlük-günlük", "Daily diary"], ["Diyadik", "Dyadic"],
  ["Müdahale", "Intervention"], ["Ölçek geliştirme", "Scale development"], ["Nitel", "Qualitative"], ["Karma", "Mixed methods"]];
const MATURITY = [["Tohum", "Seed"], ["Gelişiyor", "Developing"], ["Aday", "Candidate"], ["Taslak", "Draft"], ["Birleşti", "Merged"]];
const PATHS = [["Proje (fon)", "Project (grant)"], ["Makale (SSCI)", "Article (SSCI)"], ["Henüz belirsiz", "Not yet clear"]];
const SCORES = [
  ["originality", "Özgün değer", "Originality"], ["theory", "Kuramsal temel", "Theoretical basis"],
  ["feasibility", "Yöntem ve fizibilite", "Method and feasibility"], ["impact", "Yaygın etki", "Broader impact"],
  ["fit", "Laboratuvar uyumu", "Fit with the lab"], ["learning", "Ekip öğrenmesi", "Team learning"],
];
const en = (list, v) => (list.find((o) => o[0] === v) || [v, v])[1];

/* ---------- Okumalar ---------- */
// Tür kodları veritabanında İngilizce saklanır; ekranda iki dilde gösterilir.
const KINDS = [["core", "Çekirdek", "Core"], ["current", "Güncel", "Current"], ["optional", "İsteğe bağlı", "Optional"], ["fund", "Fon bakışı", "Funding lens"]];
const kindOrder = (k) => { const i = KINDS.findIndex((x) => x[0] === k); return i < 0 ? 9 : i; };
const kindL = (k) => { const x = KINDS.find((y) => y[0] === k) || [k, k, k]; return L(esc(x[1]), esc(x[2])); };
// Kısa etiket: "Toplantı 1 · Cox & Paley (1997)" — künyenin yıl parantezine kadarki kısmı
const readingShort = (r) => {
  const m = String(r.citation || "").match(/^(.*?\(\d{4}[a-z]?\))/);
  let s = m ? m[1] : clip(r.citation, 60);
  s = s.replace(/,\s*[A-ZÇĞİÖŞÜ]\.(?:\s*[A-ZÇĞİÖŞÜ]\.)*/g, "").replace(/,\s*&/g, " &").replace(/\s+/g, " ").replace(/\s+\(/, " (");
  return `Toplantı ${r.meeting} · ${s}`;
};

// İlk 8 haftalık program (Okuma Programı ve Fikir Sistemi dokümanı ile aynı)
const SEED_READINGS = [
  [1, "Sistemik temeller", "core", "Cox, M. J., & Paley, B. (1997). Families as systems. Annual Review of Psychology, 48, 243–267.", "https://doi.org/10.1146/annurev.psych.48.1.243"],
  [1, "Sistemik temeller", "core", "Bronfenbrenner, U. (1986). Ecology of the family as a context for human development: Research perspectives. Developmental Psychology, 22(6), 723–742.", "https://doi.org/10.1037/0012-1649.22.6.723"],
  [1, "Sistemik temeller", "current", "Sameroff, A. (2010). A unified theory of development: A dialectic integration of nature and nurture. Child Development, 81(1), 6–22.", "https://doi.org/10.1111/j.1467-8624.2009.01378.x"],
  [1, "Sistemik temeller", "optional", "Watzlawick, P., Beavin, J. H., & Jackson, D. D. (1967). Pragmatics of human communication. W. W. Norton. (Bölüm 2: İletişimin aksiyomları)", ""],
  [1, "Sistemik temeller", "fund", "TÜBİTAK 1001 programının güncel çağrı metni ve proje değerlendirme ölçütleri", ""],
  [2, "Aile sistemleri kuramları", "core", "Minuchin, P. (1985). Families and individual development: Provocations from the field of family therapy. Child Development, 56(2), 289–302.", "https://doi.org/10.2307/1129720"],
  [2, "Aile sistemleri kuramları", "core", "Walsh, F. (2003). Family resilience: A framework for clinical practice. Family Process, 42(1), 1–18.", "https://doi.org/10.1111/j.1545-5300.2003.00001.x"],
  [2, "Aile sistemleri kuramları", "current", "Calatrava, M., Martins, M. V., Schweer-Collins, M., Duch-Ceballos, C., & Rodríguez-González, M. (2022). Differentiation of self: A scoping review of Bowen Family Systems Theory's core construct. Clinical Psychology Review, 91, 102101.", "https://doi.org/10.1016/j.cpr.2021.102101"],
  [2, "Aile sistemleri kuramları", "optional", "McCubbin, H. I., & Patterson, J. M. (1983). The family stress process: The Double ABCX Model of family adjustment and adaptation. In H. I. McCubbin, M. Sussman, & J. M. Patterson (Eds.), Social stress and the family (pp. 7–37). Haworth.", ""],
  [2, "Aile sistemleri kuramları", "optional", "Skowron, E. A., & Friedlander, M. L. (1998). The Differentiation of Self Inventory: Development and initial validation. Journal of Counseling Psychology, 45(3), 235–246.", "https://doi.org/10.1037/0022-0167.45.3.235"],
  [3, "Bağlanma ve karşılıklı bağımlılık", "core", "Finkel, E. J., Simpson, J. A., & Eastwick, P. W. (2017). The psychology of close relationships: Fourteen core principles. Annual Review of Psychology, 68, 383–411.", "https://doi.org/10.1146/annurev-psych-010416-044038"],
  [3, "Bağlanma ve karşılıklı bağımlılık", "core", "Rusbult, C. E., & Van Lange, P. A. M. (2003). Interdependence, interaction, and relationships. Annual Review of Psychology, 54, 351–375.", "https://doi.org/10.1146/annurev.psych.54.101601.145059"],
  [3, "Bağlanma ve karşılıklı bağımlılık", "current", "Fraley, R. C., & Shaver, P. R. (2000). Adult romantic attachment: Theoretical developments, emerging controversies, and unanswered questions. Review of General Psychology, 4(2), 132–154.", "https://doi.org/10.1037/1089-2680.4.2.132"],
  [3, "Bağlanma ve karşılıklı bağımlılık", "optional", "Hazan, C., & Shaver, P. (1987). Romantic love conceptualized as an attachment process. Journal of Personality and Social Psychology, 52(3), 511–524.", "https://doi.org/10.1037/0022-3514.52.3.511"],
  [3, "Bağlanma ve karşılıklı bağımlılık", "optional", "Le, B., & Agnew, C. R. (2003). Commitment and its theorized determinants: A meta-analysis of the Investment Model. Personal Relationships, 10(1), 37–57.", "https://doi.org/10.1111/1475-6811.00035"],
  [4, "Süreç, stres ve diyad", "core", "Karney, B. R., & Bradbury, T. N. (1995). The longitudinal course of marital quality and stability: A review of theory, method, and research. Psychological Bulletin, 118(1), 3–34.", "https://doi.org/10.1037/0033-2909.118.1.3"],
  [4, "Süreç, stres ve diyad", "core", "Falconier, M. K., Jackson, J. B., Hilpert, P., & Bodenmann, G. (2015). Dyadic coping and relationship satisfaction: A meta-analysis. Clinical Psychology Review, 42, 28–46.", "https://doi.org/10.1016/j.cpr.2015.07.002"],
  [4, "Süreç, stres ve diyad", "current", "Karney, B. R., & Bradbury, T. N. (2020). Research on marital satisfaction and stability in the 2010s: Challenging conventional wisdom. Journal of Marriage and Family, 82(1), 100–116.", "https://doi.org/10.1111/jomf.12635"],
  [4, "Süreç, stres ve diyad", "optional", "Laurenceau, J.-P., Barrett, L. F., & Pietromonaco, P. R. (1998). Intimacy as an interpersonal process: The importance of self-disclosure, partner disclosure, and perceived partner responsiveness in interpersonal exchanges. Journal of Personality and Social Psychology, 74(5), 1238–1251.", "https://doi.org/10.1037/0022-3514.74.5.1238"],
  [4, "Süreç, stres ve diyad", "optional", "Hilpert, P., Randall, A. K., Sorokowski, P., Atkins, D. C., Sorokowska, A., Ahmadi, K., et al. (2016). The associations of dyadic coping and relationship satisfaction vary between and within nations: A 35-nation study. Frontiers in Psychology, 7, 1106.", "https://doi.org/10.3389/fpsyg.2016.01106"],
];

/* ---------- Durum ---------- */
let api = null;
const S = {
  user: null, member: null, ideas: [], members: [], readings: [], readingEdit: null,
  view: "list", id: null, editId: null, academicOpen: false,
  q: "", fMaturity: "", fPath: "", mine: false,
  unsub: [], unsubComments: null, comments: [],
};

/* ============================================================
   Firebase bağlantısı
   ============================================================ */
async function firebaseApi() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js"),
  ]);
  const fbApp = initializeApp(firebaseConfig);
  const auth = A.getAuth(fbApp);
  auth.languageCode = "tr";
  const db = F.getFirestore(fbApp);
  const toDate = (t) => (t && t.toDate ? t.toDate() : null);
  const mapUser = (u) => u && { uid: u.uid, email: (u.email || "").toLowerCase(), verified: u.emailVerified, name: u.displayName || "" };
  const snapList = (snap) => snap.docs.map((d) => {
    const x = d.data({ serverTimestamps: "estimate" });
    return { id: d.id, ...x, createdAt: toDate(x.createdAt), updatedAt: toDate(x.updatedAt),
      academic: x.academic ? { ...x.academic, updatedAt: toDate(x.academic.updatedAt) } : null };
  });

  return {
    onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(mapUser(u))),
    signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    signUp: async (e, p) => { const c = await A.createUserWithEmailAndPassword(auth, e, p); await A.sendEmailVerification(c.user); },
    resend: () => A.sendEmailVerification(auth.currentUser),
    reset: (e) => A.sendPasswordResetEmail(auth, e),
    google: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    signOut: () => A.signOut(auth),
    refresh: async () => { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return mapUser(auth.currentUser); },

    getMember: async (email) => { const s = await F.getDoc(F.doc(db, "members", email)); return s.exists() ? s.data() : null; },
    watchIdeas: (cb, err) => F.onSnapshot(F.query(F.collection(db, "ideas"), F.orderBy("createdAt", "desc")), (s) => cb(snapList(s)), err),
    addIdea: (data) => F.addDoc(F.collection(db, "ideas"), { ...data, createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() }),
    updateIdea: (id, data) => F.updateDoc(F.doc(db, "ideas", id), { ...data, updatedAt: F.serverTimestamp() }),
    setAcademic: (id, a) => F.updateDoc(F.doc(db, "ideas", id), { academic: { ...a, updatedAt: F.serverTimestamp() } }),
    deleteIdea: (id) => F.deleteDoc(F.doc(db, "ideas", id)),

    watchComments: (id, cb) => F.onSnapshot(F.query(F.collection(db, "ideas", id, "comments"), F.orderBy("createdAt", "asc")), (s) => cb(snapList(s))),
    addComment: (id, data) => F.addDoc(F.collection(db, "ideas", id, "comments"), { ...data, createdAt: F.serverTimestamp() }),
    deleteComment: (id, cid) => F.deleteDoc(F.doc(db, "ideas", id, "comments", cid)),

    watchReadings: (cb) => F.onSnapshot(F.collection(db, "readings"), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    addReading: (data) => F.addDoc(F.collection(db, "readings"), { ...data, updatedAt: F.serverTimestamp() }),
    updateReading: (id, data) => F.updateDoc(F.doc(db, "readings", id), { ...data, updatedAt: F.serverTimestamp() }),
    deleteReading: (id) => F.deleteDoc(F.doc(db, "readings", id)),

    watchMembers: (cb) => F.onSnapshot(F.collection(db, "members"), (s) => cb(s.docs.map((d) => ({ email: d.id, ...d.data() })))),
    setMember: (email, data) => F.setDoc(F.doc(db, "members", email), data),
    deleteMember: (email) => F.deleteDoc(F.doc(db, "members", email)),
  };
}

/* ============================================================
   Başlangıç
   ============================================================ */
const configMissing = !firebaseConfig || /^BURAYA/.test(firebaseConfig.apiKey || "");

if (window.__FH_TEST_API__) {
  api = window.__FH_TEST_API__;   // yalnızca yerel test için
  start();
} else if (configMissing) {
  renderSetup();
} else {
  firebaseApi().then((a) => { api = a; start(); }).catch((e) => renderFatal(e));
}

function start() {
  api.onAuth(async (u) => {
    stopWatchers();
    S.user = u; S.member = null;
    if (!u) return renderAuth();
    if (!u.verified) return renderVerify();
    try { S.member = await api.getMember(u.email); } catch (e) { S.member = null; }
    if (!S.member) return renderDenied();
    S.view = "list";
    S.unsub.push(api.watchIdeas((list) => { S.ideas = list; if (S.view !== "form" && !S.academicOpen) render(); }, (e) => renderFatal(e)));
    S.unsub.push(api.watchReadings((list) => {
      S.readings = list.sort((a, b) => (a.meeting - b.meeting) || (kindOrder(a.kind) - kindOrder(b.kind)) || ((a.order || 0) - (b.order || 0)));
      if (S.view === "readings" && !S.readingEdit) render();
    }));
    if (isAcademic()) S.unsub.push(api.watchMembers((list) => { S.members = list; if (S.view === "members") render(); }));
    render();
  });
}

function stopWatchers() {
  S.unsub.forEach((f) => f && f()); S.unsub = [];
  if (S.unsubComments) { S.unsubComments(); S.unsubComments = null; }
}
const isAcademic = () => S.member && S.member.role === "academic";
const myName = () => (S.member && S.member.name) || S.user.name || S.user.email;

/* ============================================================
   Giriş ekranları
   ============================================================ */
function renderSetup() {
  app.innerHTML = `
    <div class="fh-panel fh-narrow">
      <h2>${L("Kurulum bekleniyor", "Setup pending")}</h2>
      <p class="fh-muted">${L("Fikir Havuzu henüz bir veritabanına bağlanmadı. Kurulum adımları depodaki <code>FIKIR-HAVUZU-KURULUM.md</code> dosyasında.",
        "The Idea Pool is not connected to a database yet. Setup steps are in <code>FIKIR-HAVUZU-KURULUM.md</code> in the repository.")}</p>
    </div>`;
}

function renderFatal(e) {
  console.error(e);
  app.innerHTML = `
    <div class="fh-panel fh-narrow">
      <h2>${L("Bir sorun oluştu", "Something went wrong")}</h2>
      <p class="fh-muted">${L("Sayfa yüklenemedi. Sayfayı yenilemeyi deneyin; sorun sürerse bize yazın:", "The page could not load. Try refreshing; if it persists, write to us:")}
      <a href="mailto:info@yakiniliskilerlab.com">info@yakiniliskilerlab.com</a></p>
    </div>`;
}

function renderAuth(mode = "in", msg = "") {
  app.innerHTML = `
    <div class="fh-panel fh-narrow">
      <div class="fh-seg" role="tablist">
        <button type="button" role="tab" aria-selected="${mode === "in"}" data-act="mode-in">${L("Giriş yap", "Sign in")}</button>
        <button type="button" role="tab" aria-selected="${mode === "up"}" data-act="mode-up">${L("Hesap oluştur", "Create account")}</button>
      </div>
      <p class="fh-muted fh-small">${mode === "in"
        ? L("Laboratuvar ekibine kayıtlı e-posta adresinle giriş yap.", "Sign in with the email address registered with the lab team.")
        : L("İlk kez giriyorsan, laboratuvara bildirdiğin e-posta adresiyle bir şifre belirle. Ardından e-postana gelen bağlantıyla adresini doğrula.",
            "If this is your first time, set a password with the email address you gave the lab. Then confirm your address with the link sent to your inbox.")}</p>
      <form class="fh-form" data-form="auth" data-mode="${mode}" novalidate>
        <label class="fh-field"><span class="fh-label">${L("E-posta", "Email")}</span>
          <input type="email" name="email" autocomplete="email" required></label>
        <label class="fh-field"><span class="fh-label">${L("Şifre", "Password")}</span>
          <input type="password" name="password" autocomplete="${mode === "in" ? "current-password" : "new-password"}" minlength="6" required>
          ${mode === "up" ? `<span class="fh-hint">${L("En az 6 karakter.", "At least 6 characters.")}</span>` : ""}</label>
        ${msg ? `<p class="fh-msg">${msg}</p>` : ""}
        <button class="fh-btn" type="submit">${mode === "in" ? L("Giriş yap", "Sign in") : L("Hesabı oluştur", "Create account")}</button>
        ${mode === "in" ? `<button class="fh-link" type="button" data-act="reset">${L("Şifremi unuttum", "Forgot my password")}</button>` : ""}
      </form>
      <div class="fh-or"><span>${L("ya da", "or")}</span></div>
      <button class="fh-btn fh-btn-ghost fh-wide" type="button" data-act="google">
        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
        ${L("Google ile devam et", "Continue with Google")}
      </button>
      <p class="fh-muted fh-small fh-center">${L("Yalnızca laboratuvar ekibine kayıtlı e-posta adresleri içeri girebilir.", "Only email addresses registered with the lab team can enter.")}</p>
    </div>`;
}

function renderVerify(msg = "") {
  app.innerHTML = `
    <div class="fh-panel fh-narrow">
      <h2>${L("E-posta adresini doğrula", "Confirm your email address")}</h2>
      <p>${L(`<strong>${esc(S.user.email)}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra aşağıdaki düğmeye bas. E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bak.`,
        `We sent a confirmation link to <strong>${esc(S.user.email)}</strong>. After clicking it, press the button below. If the email doesn't arrive within a few minutes, check your spam folder.`)}</p>
      ${msg ? `<p class="fh-msg">${msg}</p>` : ""}
      <div class="fh-row">
        <button class="fh-btn" type="button" data-act="verified">${L("Doğruladım", "I've confirmed it")}</button>
        <button class="fh-btn fh-btn-ghost" type="button" data-act="resend">${L("Bağlantıyı tekrar gönder", "Send the link again")}</button>
        <button class="fh-link" type="button" data-act="signout">${L("Çıkış yap", "Sign out")}</button>
      </div>
    </div>`;
}

function renderDenied() {
  app.innerHTML = `
    <div class="fh-panel fh-narrow">
      <h2>${L("Bu adres ekip listesinde yok", "This address is not on the team list")}</h2>
      <p>${L(`<strong>${esc(S.user.email)}</strong> adresi laboratuvar ekibi listesinde görünmüyor. Laboratuvara farklı bir e-posta adresi bildirdiysen o adresle giriş yap ya da bize yaz.`,
        `<strong>${esc(S.user.email)}</strong> is not on the lab team list. If you gave the lab a different email address, sign in with that one or write to us.`)}</p>
      <div class="fh-row">
        <a class="fh-btn fh-btn-ghost" href="mailto:info@yakiniliskilerlab.com">info@yakiniliskilerlab.com</a>
        <button class="fh-link" type="button" data-act="signout">${L("Çıkış yap", "Sign out")}</button>
      </div>
    </div>`;
}

function authError(e) {
  const c = (e && e.code) || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return L("E-posta ya da şifre hatalı. İlk kez giriyorsan önce “Hesap oluştur” sekmesini kullan.", "Wrong email or password. If this is your first time, use “Create account” first.");
  if (c.includes("email-already-in-use")) return L("Bu e-posta ile zaten bir hesap var. “Giriş yap” sekmesini kullan.", "An account already exists for this email. Use “Sign in”.");
  if (c.includes("weak-password")) return L("Şifre en az 6 karakter olmalı.", "The password must be at least 6 characters.");
  if (c.includes("invalid-email")) return L("Geçerli bir e-posta adresi yaz.", "Enter a valid email address.");
  if (c.includes("too-many-requests")) return L("Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.", "Too many attempts. Try again in a few minutes.");
  if (c.includes("popup")) return L("Google penceresi kapatıldı ya da engellendi.", "The Google window was closed or blocked.");
  return L("İşlem tamamlanamadı. Tekrar dene.", "That didn't work. Please try again.");
}

/* ============================================================
   Ana uygulama
   ============================================================ */
function render() {
  if (!S.user || !S.member) return;
  // Canlı güncellemede yazılmakta olan yorum ve arama metni kaybolmasın
  const draft = app.querySelector('[data-form="comment"] textarea');
  const draftVal = draft ? draft.value : "";
  const hadFocus = draft && document.activeElement === draft;
  renderInner();
  const d2 = app.querySelector('[data-form="comment"] textarea');
  if (d2 && draftVal) { d2.value = draftVal; if (hadFocus) d2.focus(); }
}

function renderInner() {
  const tabs = [
    ["list", L("Fikirler", "Ideas") + ` <span class="fh-count">${S.ideas.length}</span>`],
    ["readings", L("Okumalar", "Readings")],
    ["form", L("Fikir paylaş", "Share an idea")],
  ];
  if (isAcademic()) tabs.push(["members", L("Üyeler", "Members")]);
  const active = S.view === "detail" ? "list" : S.view;

  app.innerHTML = `
    <div class="fh-bar">
      <div class="fh-who">
        <span class="fh-avatar" aria-hidden="true">${esc(initials(myName()))}</span>
        <span><strong>${esc(myName())}</strong>
          <span class="fh-role">${isAcademic() ? L("Akademisyen", "Academic") : L("Araştırmacı", "Researcher")}</span></span>
      </div>
      <button class="fh-link" type="button" data-act="signout">${L("Çıkış yap", "Sign out")}</button>
    </div>
    <nav class="fh-tabs" aria-label="${tl("Fikir Havuzu bölümleri", "Idea Pool sections")}">
      ${tabs.map(([k, label]) => `<button type="button" data-act="tab" data-v="${k}" aria-current="${active === k ? "page" : "false"}">${label}</button>`).join("")}
    </nav>
    <div id="fh-view"></div>`;

  const v = document.getElementById("fh-view");
  if (S.view === "list") v.innerHTML = viewList();
  else if (S.view === "detail") v.innerHTML = viewDetail();
  else if (S.view === "form") v.innerHTML = viewForm();
  else if (S.view === "members") v.innerHTML = viewMembers();
  else if (S.view === "readings") v.innerHTML = viewReadings();
}

const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function go(view, extra = {}) {
  if (S.unsubComments && view !== "detail") { S.unsubComments(); S.unsubComments = null; S.comments = []; }
  Object.assign(S, { view, academicOpen: false }, extra);
  render();
  window.scrollTo({ top: document.querySelector(".fh-section").offsetTop - 8, behavior: "smooth" });
}

/* ---------- Liste ---------- */
function filtered() {
  const q = S.q.trim().toLocaleLowerCase("tr");
  return S.ideas.filter((i) => {
    const m = i.academic && i.academic.maturity;
    if (S.fMaturity === "_none" && m) return false;
    if (S.fMaturity && S.fMaturity !== "_none" && m !== S.fMaturity) return false;
    if (S.fPath && !(i.academic && i.academic.path === S.fPath)) return false;
    if (S.mine && i.authorUid !== S.user.uid) return false;
    if (q && ![i.title, i.question, i.spark, i.authorName].join(" ").toLocaleLowerCase("tr").includes(q)) return false;
    return true;
  });
}

function badges(i) {
  const a = i.academic;
  if (!a || !a.maturity) return `<span class="fh-badge fh-badge-wait">${L("Değerlendirme bekliyor", "Awaiting review")}</span>`;
  let h = `<span class="fh-badge fh-badge-m">${L(esc(a.maturity), esc(en(MATURITY, a.maturity)))}</span>`;
  if (a.path) h += `<span class="fh-badge fh-badge-p">${L(esc(a.path), esc(en(PATHS, a.path)))}</span>`;
  if (a.cluster) h += `<span class="fh-badge">${esc(a.cluster)}</span>`;
  return h;
}

function viewList() {
  const opt = (list, cur) => list.map(([tr, e]) => `<option value="${esc(tr)}" ${cur === tr ? "selected" : ""}>${esc(tl(tr, e))}</option>`).join("");
  const items = filtered();
  const cards = items.map((i) => `
    <button type="button" class="fh-card" data-act="open" data-id="${esc(i.id)}">
      <span class="fh-card-badges">${badges(i)}</span>
      <span class="fh-card-title">${esc(i.title)}</span>
      <span class="fh-card-text">${esc(clip(i.question, 190))}</span>
      <span class="fh-card-meta">${esc(i.authorName || "")} · ${fmtDate(i.createdAt)}</span>
    </button>`).join("");

  return `
    <div class="fh-filters">
      <label class="fh-search"><span class="fh-sr">${L("Ara", "Search")}</span>
        <input type="search" data-in="q" value="${esc(S.q)}" placeholder="${esc(tl("Fikirlerde ara…", "Search ideas…"))}"></label>
      <select data-in="fMaturity" aria-label="${esc(tl("Olgunluk", "Maturity"))}">
        <option value="">${esc(tl("Tüm aşamalar", "All stages"))}</option>
        <option value="_none" ${S.fMaturity === "_none" ? "selected" : ""}>${esc(tl("Değerlendirme bekliyor", "Awaiting review"))}</option>
        ${opt(MATURITY, S.fMaturity)}
      </select>
      <select data-in="fPath" aria-label="${esc(tl("Yol", "Path"))}">
        <option value="">${esc(tl("Tüm yollar", "All paths"))}</option>${opt(PATHS, S.fPath)}
      </select>
      <label class="fh-check"><input type="checkbox" data-in="mine" ${S.mine ? "checked" : ""}> ${L("Yalnızca benimkiler", "Only mine")}</label>
    </div>
    ${S.ideas.length === 0 ? `
      <div class="fh-empty">
        <h3>${L("Havuz şimdilik boş", "The pool is empty for now")}</h3>
        <p class="fh-muted">${L("İlk fikri sen paylaş; yarım kalmış bir merak da değerlidir.", "Be the first to share an idea; even a half-formed curiosity counts.")}</p>
        <button class="fh-btn" type="button" data-act="tab" data-v="form">${L("Fikir paylaş", "Share an idea")}</button>
      </div>`
      : items.length === 0 ? `<p class="fh-empty fh-muted">${L("Bu filtrelerle eşleşen fikir yok.", "No ideas match these filters.")}</p>`
      : `<div class="fh-cards">${cards}</div>`}`;
}

const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

/* ---------- Detay ---------- */
function viewDetail() {
  const i = S.ideas.find((x) => x.id === S.id);
  if (!i) return `<p class="fh-muted">${L("Bu fikir bulunamadı ya da silindi.", "This idea was not found or has been deleted.")}</p>
    <button class="fh-link" type="button" data-act="tab" data-v="list">← ${L("Tüm fikirler", "All ideas")}</button>`;
  const mine = i.authorUid === S.user.uid;
  const a = i.academic || {};
  const answers = IDEA_FIELDS.filter((f) => f.k !== "title" && i[f.k]).map((f) => {
    let val = esc(i[f.k]);
    if (f.kind === "radio") { const o = f.options.find((x) => x[0] === i[f.k]); val = o ? L(esc(o[0]), esc(o[1])) : val; }
    if (f.k === "links") val = linkify(i[f.k]);
    return `<div class="fh-qa"><h4>${L(f.tr, f.en)}</h4><p class="fh-pre">${val}</p></div>`;
  }).join("");

  const scoreVals = SCORES.map(([k]) => Number(a.scores && a.scores[k])).filter((n) => n >= 1);
  const scoreBlock = scoreVals.length ? `
    <div class="fh-scores">${SCORES.map(([k, tr, e]) => a.scores && a.scores[k]
      ? `<div><span>${L(tr, e)}</span><strong>${esc(a.scores[k])}</strong></div>` : "").join("")}
      <div class="fh-score-total"><span>${L("Ortalama", "Average")}</span><strong>${(scoreVals.reduce((s, n) => s + n, 0) / scoreVals.length).toFixed(2)}</strong></div>
    </div>` : "";

  const hasAcademic = a.maturity || a.framework || a.level || a.design || a.path || a.cluster || a.feedback || scoreVals.length;
  const rows = [
    ["Kuramsal çerçeve", "Theoretical framework", a.framework && esc(a.framework)],
    ["Analiz düzeyi", "Level of analysis", a.level && L(esc(a.level), esc(en(LEVELS, a.level)))],
    ["Olası desen", "Possible design", a.design && L(esc(a.design), esc(en(DESIGNS, a.design)))],
    ["Olgunluk", "Maturity", a.maturity && L(esc(a.maturity), esc(en(MATURITY, a.maturity)))],
    ["Önerilen yol", "Suggested path", a.path && L(esc(a.path), esc(en(PATHS, a.path)))],
    ["Küme", "Cluster", a.cluster && esc(a.cluster)],
  ].filter((r) => r[2]);

  return `
    <button class="fh-link fh-back" type="button" data-act="tab" data-v="list">← ${L("Tüm fikirler", "All ideas")}</button>
    <article class="fh-detail">
      <header class="fh-detail-head">
        <div class="fh-card-badges">${badges(i)}</div>
        <h2>${esc(i.title)}</h2>
        <p class="fh-muted">${esc(i.authorName || "")} · ${fmtDate(i.createdAt)}${i.updatedAt && i.createdAt && i.updatedAt - i.createdAt > 60000 ? ` · ${L("düzenlendi", "edited")}` : ""}</p>
        <div class="fh-row">
          ${mine ? `<button class="fh-btn fh-btn-ghost fh-btn-sm" type="button" data-act="edit" data-id="${esc(i.id)}">${L("Düzenle", "Edit")}</button>` : ""}
          ${isAcademic() || (mine && !i.academic) ? `<button class="fh-link fh-danger" type="button" data-act="delete" data-id="${esc(i.id)}">${L("Sil", "Delete")}</button>` : ""}
        </div>
      </header>

      <div class="fh-answers">${answers}</div>

      <section class="fh-academic">
        <div class="fh-academic-head">
          <h3>${L("Akademik değerlendirme", "Academic review")}</h3>
          ${isAcademic() && !S.academicOpen ? `<button class="fh-btn fh-btn-sm" type="button" data-act="academic">${hasAcademic ? L("Düzenle", "Edit") : L("Değerlendir", "Review")}</button>` : ""}
        </div>
        ${S.academicOpen ? academicForm(a) : hasAcademic ? `
          ${rows.length ? `<dl class="fh-dl">${rows.map((r) => `<div><dt>${L(r[0], r[1])}</dt><dd>${r[2]}</dd></div>`).join("")}</dl>` : ""}
          ${scoreBlock}
          ${a.feedback ? `<div class="fh-feedback"><h4>${L("Fikri yazana not", "Note to the author")}</h4><p class="fh-pre">${esc(a.feedback)}</p></div>` : ""}
          <p class="fh-muted fh-small">${esc(a.updatedByName || "")}${a.updatedAt ? " · " + fmtDate(a.updatedAt) : ""}</p>`
          : `<p class="fh-muted">${L("Bu fikir henüz değerlendirilmedi. Akademisyenlerimiz kuramsal çerçeveyi, olası deseni ve fikrin hangi yola uygun olduğunu burada paylaşacak.",
              "This idea hasn't been reviewed yet. Our academics will add the theoretical framework, a possible design and the best path for the idea here.")}</p>`}
      </section>

      <section class="fh-comments">
        <h3>${L("Katkılar ve yorumlar", "Contributions and comments")} <span class="fh-count">${S.comments.length}</span></h3>
        <ul class="fh-comment-list">
          ${S.comments.map((c) => `
            <li>
              <div class="fh-comment-meta"><strong>${esc(c.authorName)}</strong> · ${fmtDate(c.createdAt, true)}
                ${c.authorUid === S.user.uid || isAcademic() ? `<button class="fh-link fh-danger fh-small" type="button" data-act="del-comment" data-cid="${esc(c.id)}">${L("Sil", "Delete")}</button>` : ""}</div>
              <p class="fh-pre">${esc(c.text)}</p>
            </li>`).join("") || `<li class="fh-muted">${L("Henüz yorum yok. Bu fikre bir şey eklemek ister misin?", "No comments yet. Would you like to add something to this idea?")}</li>`}
        </ul>
        <form class="fh-form" data-form="comment">
          <label class="fh-field"><span class="fh-sr">${L("Yorum", "Comment")}</span>
            <textarea name="text" rows="3" maxlength="5000" required placeholder="${esc(tl("Bir katkı, soru ya da kaynak ekle…", "Add a contribution, question or source…"))}"></textarea></label>
          <button class="fh-btn fh-btn-sm" type="submit">${L("Gönder", "Send")}</button>
        </form>
      </section>
    </article>`;
}

function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}

function academicForm(a) {
  const sel = (name, list, cur, ph) => `
    <select name="${name}"><option value="">${esc(ph)}</option>
      ${list.map(([tr, e]) => `<option value="${esc(tr)}" ${cur === tr ? "selected" : ""}>${esc(tr)} · ${esc(e)}</option>`).join("")}</select>`;
  const clusters = [...new Set(S.ideas.map((i) => i.academic && i.academic.cluster).filter(Boolean))];
  const sc = a.scores || {};
  return `
    <form class="fh-form fh-academic-form" data-form="academic">
      <div class="fh-grid2">
        <label class="fh-field fh-span2"><span class="fh-label">${L("Kuramsal çerçeve", "Theoretical framework")}</span>
          <input name="framework" maxlength="300" value="${esc(a.framework)}"></label>
        <label class="fh-field"><span class="fh-label">${L("Analiz düzeyi", "Level of analysis")}</span>${sel("level", LEVELS, a.level, "—")}</label>
        <label class="fh-field"><span class="fh-label">${L("Olası desen", "Possible design")}</span>${sel("design", DESIGNS, a.design, "—")}</label>
        <label class="fh-field"><span class="fh-label">${L("Olgunluk", "Maturity")}</span>${sel("maturity", MATURITY, a.maturity, "—")}</label>
        <label class="fh-field"><span class="fh-label">${L("Önerilen yol", "Suggested path")}</span>${sel("path", PATHS, a.path, "—")}</label>
        <label class="fh-field fh-span2"><span class="fh-label">${L("Küme", "Cluster")}</span>
          <input name="cluster" maxlength="120" list="fh-clusters" value="${esc(a.cluster)}">
          <datalist id="fh-clusters">${clusters.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
          <span class="fh-hint">${L("Var olan bir kümeyi seç ya da yeni bir ad yaz.", "Pick an existing cluster or type a new name.")}</span></label>
      </div>
      <fieldset class="fh-fieldset">
        <legend class="fh-label">${L("Puanlama (1–5, isteğe bağlı; genellikle “Aday” aşamasında)", "Scores (1–5, optional; usually at the “Candidate” stage)")}</legend>
        <div class="fh-grid3">
          ${SCORES.map(([k, tr, e]) => `
            <label class="fh-field"><span class="fh-label fh-small">${L(tr, e)}</span>
              <select name="score_${k}"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option ${Number(sc[k]) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>`).join("")}
        </div>
      </fieldset>
      <label class="fh-field"><span class="fh-label">${L("Fikri yazana not", "Note to the author")}</span>
        <textarea name="feedback" rows="5" maxlength="6000">${esc(a.feedback)}</textarea>
        <span class="fh-hint">${L("Fikrin güçlü yanlarını ve bir sonraki adımda neyi düşünebileceğini yaz. Bu not, araştırmacının öğrenmesine yardım eder.",
          "Write what is strong about the idea and what to think about next. This note helps the researcher learn.")}</span></label>
      <div class="fh-row">
        <button class="fh-btn" type="submit">${L("Kaydet", "Save")}</button>
        <button class="fh-link" type="button" data-act="academic-cancel">${L("Vazgeç", "Cancel")}</button>
      </div>
    </form>`;
}

/* ---------- Fikir formu ---------- */
function viewForm() {
  const i = S.editId ? S.ideas.find((x) => x.id === S.editId) || {} : {};
  const fields = IDEA_FIELDS.map((f) => {
    const label = `<span class="fh-label">${L(f.tr, f.en)}${f.req ? ' <span class="fh-req" aria-hidden="true">*</span>' : ""}${f.opt ? ` <span class="fh-opt">${L("isteğe bağlı", "optional")}</span>` : ""}</span>`;
    const hint = f.htr ? `<span class="fh-hint">${L(f.htr, f.hen)}</span>` : "";
    if (f.kind === "input" && f.k === "reading") return `<label class="fh-field">${label}<span class="fh-hint">${S.readings.length
        ? L("Listeden seçebilir ya da kendin yazabilirsin.", "Pick from the list or type your own.")
        : L(f.htr, f.hen)}</span>
      <input name="${f.k}" maxlength="${f.max}" list="fh-reading-list" autocomplete="off" value="${esc(i[f.k])}">
      <datalist id="fh-reading-list">${S.readings.map((r) => `<option value="${esc(readingShort(r))}">`).join("")}</datalist></label>`;
    if (f.kind === "input") return `<label class="fh-field">${label}${hint}<input name="${f.k}" maxlength="${f.max}" ${f.req ? "required" : ""} value="${esc(i[f.k])}"></label>`;
    if (f.kind === "textarea") return `<label class="fh-field">${label}${hint}<textarea name="${f.k}" rows="${f.rows}" maxlength="${f.max}" ${f.req ? "required" : ""}>${esc(i[f.k])}</textarea></label>`;
    return `<fieldset class="fh-field fh-fieldset"><legend>${label}</legend>${f.options.map(([tr, e], n) => `
      <label class="fh-radio"><input type="radio" name="${f.k}" value="${esc(tr)}" ${(i[f.k] ? i[f.k] === tr : n === 0) ? "checked" : ""}> ${L(tr, e)}</label>`).join("")}</fieldset>`;
  }).join("");

  return `
    <div class="fh-form-wrap">
      ${S.editId ? `<button class="fh-link fh-back" type="button" data-act="open" data-id="${esc(S.editId)}">← ${L("Fikre dön", "Back to the idea")}</button>` : ""}
      <div class="fh-note">
        <h3>${S.editId ? L("Fikrini düzenle", "Edit your idea") : L("Aklındakini paylaş", "Share what's on your mind")}</h3>
        <p>${L("Doğru ya da yanlış fikir yok. Kuram, yöntem ya da analiz bilmen gerekmiyor; bunlara birlikte şekil vereceğiz. Yarım kalmış bir merak da değerlidir. Paylaştığın fikri tüm ekip görecek.",
          "There are no right or wrong ideas. You don't need to know theory, methods or analysis; we will shape those together. Even a half-formed curiosity counts. The whole team will see the idea you share.")}</p>
      </div>
      <form class="fh-form fh-idea-form" data-form="idea" novalidate>
        ${fields}
        <p class="fh-msg" hidden></p>
        <div class="fh-row">
          <button class="fh-btn" type="submit">${S.editId ? L("Değişiklikleri kaydet", "Save changes") : L("Fikri paylaş", "Share the idea")}</button>
          <button class="fh-link" type="button" data-act="${S.editId ? "open" : "tab"}" data-id="${esc(S.editId || "")}" data-v="list">${L("Vazgeç", "Cancel")}</button>
        </div>
      </form>
    </div>`;
}

/* ---------- Okumalar ---------- */
function readingForm(r) {
  const meetings = [...new Set(S.readings.map((x) => x.meeting))];
  const lastMeeting = meetings.length ? Math.max(...meetings) : 1;
  const themes = [...new Set(S.readings.map((x) => x.theme).filter(Boolean))];
  r = r || { meeting: lastMeeting, theme: (S.readings.find((x) => x.meeting === lastMeeting) || {}).theme || "", kind: "core", citation: "", link: "" };
  return `
    <form class="fh-form fh-panel fh-reading-form" data-form="reading">
      <h3>${S.readingEdit === "new" ? L("Okuma ekle", "Add a reading") : L("Okumayı düzenle", "Edit reading")}</h3>
      <div class="fh-grid-reading">
        <label class="fh-field"><span class="fh-label">${L("Toplantı no", "Meeting no.")}</span>
          <input type="number" name="meeting" min="1" max="99" value="${esc(r.meeting)}" required></label>
        <label class="fh-field"><span class="fh-label">${L("Tema", "Theme")}</span>
          <input name="theme" maxlength="120" list="fh-themes" value="${esc(r.theme)}">
          <datalist id="fh-themes">${themes.map((t) => `<option value="${esc(t)}">`).join("")}</datalist></label>
        <label class="fh-field"><span class="fh-label">${L("Tür", "Type")}</span>
          <select name="kind">${KINDS.map(([k, tr, e]) => `<option value="${k}" ${r.kind === k ? "selected" : ""}>${esc(tr)} · ${esc(e)}</option>`).join("")}</select></label>
      </div>
      <label class="fh-field"><span class="fh-label">${L("Künye", "Citation")}</span>
        <textarea name="citation" rows="3" maxlength="1000" required>${esc(r.citation)}</textarea>
        <span class="fh-hint">${L("APA biçiminde tam künye.", "Full APA-style citation.")}</span></label>
      <label class="fh-field"><span class="fh-label">${L("Bağlantı", "Link")} <span class="fh-opt">${L("isteğe bağlı", "optional")}</span></span>
        <input type="url" name="link" maxlength="500" value="${esc(r.link)}" placeholder="https://">
        <span class="fh-hint">${L("DOI bağlantısı ya da metnin paylaşıldığı Google Drive bağlantısı.", "A DOI link or the Google Drive link where the text is shared.")}</span></label>
      <p class="fh-msg" hidden></p>
      <div class="fh-row">
        <button class="fh-btn" type="submit">${L("Kaydet", "Save")}</button>
        <button class="fh-link" type="button" data-act="reading-cancel">${L("Vazgeç", "Cancel")}</button>
      </div>
    </form>`;
}

function viewReadings() {
  const ac = isAcademic();
  const editing = S.readingEdit && S.readingEdit !== "new" ? S.readings.find((r) => r.id === S.readingEdit) : null;
  const counts = {};
  S.ideas.forEach((i) => { if (i.reading) counts[i.reading] = (counts[i.reading] || 0) + 1; });

  const groups = [];
  S.readings.forEach((r) => {
    let g = groups.find((x) => x.meeting === r.meeting);
    if (!g) { g = { meeting: r.meeting, theme: r.theme, items: [] }; groups.push(g); }
    if (!g.theme && r.theme) g.theme = r.theme;
    g.items.push(r);
  });

  const item = (r) => {
    const n = counts[readingShort(r)] || 0;
    return `
      <li class="fh-reading${S.readingEdit === r.id ? " is-editing" : ""}">
        <span class="fh-kind fh-kind-${esc(r.kind)}">${kindL(r.kind)}</span>
        <div class="fh-reading-body">
          <p class="fh-cite">${esc(r.citation)}</p>
          <div class="fh-reading-meta">
            ${r.link ? `<a class="fh-open" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${L("Bağlantıyı aç", "Open link")} <span aria-hidden="true">↗</span></a>` : ""}
            ${n ? `<span class="fh-muted fh-small">${L(`${n} fikir bu okumadan doğdu`, `${n} idea${n > 1 ? "s" : ""} from this reading`)}</span>` : ""}
            ${ac ? `<span class="fh-reading-tools">
              <button class="fh-link fh-small" type="button" data-act="reading-edit" data-rid="${esc(r.id)}">${L("Düzenle", "Edit")}</button>
              <button class="fh-link fh-danger fh-small" type="button" data-act="reading-delete" data-rid="${esc(r.id)}">${L("Sil", "Delete")}</button></span>` : ""}
          </div>
        </div>
      </li>`;
  };

  return `
    <div class="fh-readings-head">
      <p class="fh-muted">${L("Her toplantıda çekirdek okumaları herkes okur; güncel okumayı sunucular derinlemesine okur, isteğe bağlı okumalar ilgi duyanlar içindir. Bir okuma aklına bir fikir getirirse “Fikir paylaş” sekmesinde o okumayı seçebilirsin.",
        "Everyone reads the core readings for each meeting; presenters read the current one in depth, and optional readings are for those interested. If a reading sparks an idea, you can pick it in the “Share an idea” tab.")}</p>
      ${ac && S.readingEdit !== "new" ? `<button class="fh-btn fh-btn-sm" type="button" data-act="reading-new">${L("Okuma ekle", "Add a reading")}</button>` : ""}
    </div>
    ${ac && S.readingEdit === "new" ? readingForm(null) : ""}
    ${ac && editing ? readingForm(editing) : ""}
    ${groups.length === 0 ? `
      <div class="fh-empty">
        <h3>${L("Okuma listesi henüz boş", "The reading list is empty for now")}</h3>
        ${ac ? `<p class="fh-muted">${L("İlk 8 haftanın 20 okumasını tek seferde yükleyebilir ya da okumaları tek tek ekleyebilirsin.", "You can load the 20 readings of the first 8 weeks at once, or add readings one by one.")}</p>
          <div class="fh-row" style="justify-content:center">
            <button class="fh-btn" type="button" data-act="reading-seed">${L("İlk 4 toplantının okumalarını yükle", "Load the first 4 meetings' readings")}</button>
          </div>`
        : `<p class="fh-muted">${L("Okumalar eklendiğinde burada toplantılara göre listelenecek.", "Readings will be listed here by meeting once they are added.")}</p>`}
      </div>`
    : groups.map((g) => `
      <section class="fh-meeting">
        <h3><span class="fh-meeting-no">${L(`Toplantı ${g.meeting}`, `Meeting ${g.meeting}`)}</span>${g.theme ? ` ${esc(g.theme)}` : ""}</h3>
        <ul class="fh-reading-list">${g.items.map(item).join("")}</ul>
      </section>`).join("")}`;
}

/* ---------- Üyeler (akademisyen) ---------- */
function viewMembers() {
  const sorted = [...S.members].sort((a, b) => (a.role === b.role ? String(a.name).localeCompare(String(b.name), "tr") : a.role === "academic" ? -1 : 1));
  return `
    <div class="fh-panel">
      <h3>${L("Üye ekle", "Add a member")}</h3>
      <p class="fh-muted fh-small">${L("Buraya eklenen e-posta adresleri Fikir Havuzu'na girebilir. Kişi ilk girişte bu adresle hesap oluşturur ya da Google ile girer.",
        "Email addresses added here can enter the Idea Pool. The person creates an account with this address on first visit, or signs in with Google.")}</p>
      <form class="fh-form fh-member-form" data-form="member">
        <label class="fh-field"><span class="fh-label">${L("Ad Soyad", "Full name")}</span><input name="name" required maxlength="120"></label>
        <label class="fh-field"><span class="fh-label">${L("E-posta", "Email")}</span><input type="email" name="email" required></label>
        <label class="fh-field"><span class="fh-label">${L("Rol", "Role")}</span>
          <select name="role"><option value="researcher">${esc(tl("Araştırmacı", "Researcher"))}</option><option value="academic">${esc(tl("Akademisyen", "Academic"))}</option></select></label>
        <button class="fh-btn" type="submit">${L("Ekle", "Add")}</button>
      </form>
      <details class="fh-bulk" ${S.bulkOpen ? "open" : ""}>
        <summary>${L("Toplu ekle", "Add in bulk")}</summary>
        <form class="fh-form" data-form="bulk">
          <label class="fh-field"><span class="fh-label">${L("Liste", "List")}</span>
            <span class="fh-hint">${L("Her satıra bir kişi: <code>Ad Soyad, e-posta</code>. Satırın sonuna <code>, akademisyen</code> yazarsan o kişi akademisyen olarak eklenir. Listede zaten olan adresler atlanır.",
              "One person per line: <code>Full name, email</code>. Add <code>, academic</code> at the end of a line to add that person as an academic. Addresses already on the list are skipped.")}</span>
            <textarea name="lines" rows="8" spellcheck="false" placeholder="Ayşe Yılmaz, ayse@ornek.com&#10;Mehmet Demir, mehmet@ornek.com&#10;Elif Kaya, elif@ornek.com, akademisyen"></textarea></label>
          ${S.bulkMsg ? `<p class="fh-msg">${S.bulkMsg}</p>` : ""}
          <div class="fh-row"><button class="fh-btn" type="submit">${L("Listeyi ekle", "Add the list")}</button></div>
        </form>
      </details>
    </div>
    <div class="fh-table-wrap">
      <table class="fh-table">
        <thead><tr><th>${L("Ad Soyad", "Name")}</th><th>${L("E-posta", "Email")}</th><th>${L("Rol", "Role")}</th><th><span class="fh-sr">${L("İşlem", "Action")}</span></th></tr></thead>
        <tbody>${sorted.map((m) => `
          <tr><td>${esc(m.name)}</td><td>${esc(m.email)}</td>
            <td>${m.role === "academic" ? L("Akademisyen", "Academic") : L("Araştırmacı", "Researcher")}</td>
            <td>${m.email === S.user.email ? "" : `<button class="fh-link fh-danger" type="button" data-act="del-member" data-email="${esc(m.email)}">${L("Çıkar", "Remove")}</button>`}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

/* ============================================================
   Etkileşimler
   ============================================================ */
function openIdea(id) {
  if (S.unsubComments) S.unsubComments();
  S.comments = [];
  S.unsubComments = api.watchComments(id, (list) => { S.comments = list; if (S.view === "detail" && S.id === id && !S.academicOpen) render(); });
  go("detail", { id, editId: null });
}

app.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  try {
    if (act === "mode-in") renderAuth("in");
    else if (act === "mode-up") renderAuth("up");
    else if (act === "google") { try { await api.google(); } catch (e) { renderAuth("in", authError(e)); } }
    else if (act === "reset") {
      const email = (app.querySelector('[name="email"]').value || "").trim();
      if (!email) return renderAuth("in", L("Önce e-posta adresini yaz, sonra “Şifremi unuttum”a bas.", "Type your email first, then press “Forgot my password”."));
      try { await api.reset(email); renderAuth("in", L("Şifre yenileme bağlantısı gönderildi (adres kayıtlıysa).", "A password reset link has been sent (if the address is registered).")); }
      catch (e) { renderAuth("in", authError(e)); }
    }
    else if (act === "verified") {
      const u = await api.refresh();
      if (u.verified) { S.user = u; location.reload(); }
      else renderVerify(L("Adres henüz doğrulanmamış görünüyor. E-postadaki bağlantıya tıkladığından emin ol.", "The address doesn't look confirmed yet. Make sure you clicked the link in the email."));
    }
    else if (act === "resend") { await api.resend(); renderVerify(L("Bağlantı tekrar gönderildi.", "The link was sent again.")); }
    else if (act === "signout") { await api.signOut(); }
    else if (act === "tab") go(b.dataset.v, { editId: null, readingEdit: null });
    else if (act === "reading-new") { S.readingEdit = "new"; render(); app.querySelector('[data-form="reading"] [name="citation"]')?.focus(); }
    else if (act === "reading-edit") { S.readingEdit = b.dataset.rid; render(); app.querySelector('[data-form="reading"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (act === "reading-cancel") { S.readingEdit = null; render(); }
    else if (act === "reading-delete") {
      if (!confirm(tl("Bu okuma listeden silinsin mi?", "Remove this reading from the list?"))) return;
      await api.deleteReading(b.dataset.rid);
    }
    else if (act === "reading-seed") {
      b.disabled = true;
      for (const [n, [meeting, theme, kind, citation, link]] of SEED_READINGS.entries())
        await api.addReading({ meeting, theme, kind, citation, link, order: n, updatedBy: S.user.email });
    }
    else if (act === "open") openIdea(b.dataset.id);
    else if (act === "edit") go("form", { editId: b.dataset.id });
    else if (act === "academic") { S.academicOpen = true; render(); }
    else if (act === "academic-cancel") { S.academicOpen = false; render(); }
    else if (act === "delete") {
      if (!confirm(tl("Bu fikri silmek istediğine emin misin? Bu işlem geri alınamaz.", "Are you sure you want to delete this idea? This can't be undone."))) return;
      await api.deleteIdea(b.dataset.id); go("list");
    }
    else if (act === "del-comment") {
      if (!confirm(tl("Bu yorum silinsin mi?", "Delete this comment?"))) return;
      await api.deleteComment(S.id, b.dataset.cid);
    }
    else if (act === "del-member") {
      if (!confirm(tl(`${b.dataset.email} ekipten çıkarılsın mı?`, `Remove ${b.dataset.email} from the team?`))) return;
      await api.deleteMember(b.dataset.email);
    }
  } catch (e) { console.error(e); alert(tl("İşlem tamamlanamadı. Tekrar dene.", "That didn't work. Please try again.")); }
});

app.addEventListener("input", (ev) => {
  const k = ev.target.dataset.in;
  if (!k) return;
  S[k] = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value;
  // Arama kutusunda odak kaybolmasın diye yalnızca kart listesini yeniler
  const v = document.getElementById("fh-view");
  const pos = ev.target.selectionStart;
  v.innerHTML = viewList();
  const el = v.querySelector(`[data-in="${k}"]`);
  if (el && k === "q") { el.focus(); el.setSelectionRange(pos, pos); }
});

app.addEventListener("submit", async (ev) => {
  const form = ev.target.closest("form[data-form]");
  if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form;
  const fd = new FormData(form);
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    if (kind === "auth") {
      const email = String(fd.get("email") || "").trim().toLowerCase(), pw = String(fd.get("password") || "");
      try { form.dataset.mode === "up" ? await api.signUp(email, pw) : await api.signIn(email, pw); }
      catch (e) { renderAuth(form.dataset.mode, authError(e)); }
    }
    else if (kind === "idea") {
      const data = {};
      IDEA_FIELDS.forEach((f) => { data[f.k] = String(fd.get(f.k) || "").trim(); });
      const missing = IDEA_FIELDS.filter((f) => f.req && !data[f.k]);
      if (missing.length) {
        const m = form.querySelector(".fh-msg");
        m.hidden = false;
        m.innerHTML = L("Yıldızlı (*) alanları doldurman yeterli: fikrin adı, seni ne meraklandırdığı ve merak ettiğin şey.",
          "Just fill in the starred (*) fields: the idea's name, what made you curious, and what you want to find out.");
        form.querySelector(`[name="${missing[0].k}"]`).focus();
        btn.disabled = false;
        return;
      }
      if (S.editId) { await api.updateIdea(S.editId, data); openIdea(S.editId); }
      else {
        const ref = await api.addIdea({ ...data, authorUid: S.user.uid, authorEmail: S.user.email, authorName: myName() });
        openIdea(ref.id);
      }
    }
    else if (kind === "academic") {
      const scores = {};
      SCORES.forEach(([k]) => { const v = Number(fd.get("score_" + k)); if (v >= 1 && v <= 5) scores[k] = v; });
      const a = { scores, updatedBy: S.user.email, updatedByName: myName() };
      ["framework", "level", "design", "maturity", "path", "cluster", "feedback"].forEach((k) => { a[k] = String(fd.get(k) || "").trim(); });
      await api.setAcademic(S.id, a);
      S.academicOpen = false; render();
    }
    else if (kind === "comment") {
      const text = String(fd.get("text") || "").trim();
      form.reset();   // canlı güncelleme metni geri yazmasın diye önce temizlenir
      if (text) {
        try { await api.addComment(S.id, { text, authorUid: S.user.uid, authorName: myName() }); }
        catch (e) { const t = app.querySelector('[data-form="comment"] textarea'); if (t) t.value = text; throw e; }
      }
    }
    else if (kind === "reading") {
      const link = String(fd.get("link") || "").trim();
      const msg = form.querySelector(".fh-msg");
      if (link && !/^https?:\/\//i.test(link)) {
        msg.hidden = false;
        msg.innerHTML = L("Bağlantı http:// ya da https:// ile başlamalı.", "The link must start with http:// or https://.");
        btn.disabled = false; return;
      }
      const data = {
        meeting: Math.max(1, Math.min(99, parseInt(fd.get("meeting"), 10) || 1)),
        theme: String(fd.get("theme") || "").trim(),
        kind: KINDS.some((k) => k[0] === fd.get("kind")) ? fd.get("kind") : "core",
        citation: String(fd.get("citation") || "").trim(),
        link, updatedBy: S.user.email,
      };
      if (!data.citation) { msg.hidden = false; msg.innerHTML = L("Künye boş olamaz.", "The citation can't be empty."); btn.disabled = false; return; }
      if (S.readingEdit === "new") await api.addReading({ ...data, order: Date.now() });
      else await api.updateReading(S.readingEdit, data);
      S.readingEdit = null; render();
    }
    else if (kind === "bulk") {
      // Her satır: Ad Soyad, e-posta[, akademisyen]  (virgül, noktalı virgül ya da sekme)
      const known = new Set(S.members.map((m) => m.email));
      const added = [], skipped = [], bad = [];
      S.bulkOpen = true; S.bulkMsg = "";
      for (const raw of String(fd.get("lines") || "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const parts = line.split(/[,;\t]/).map((x) => x.trim()).filter(Boolean);
        const email = (parts.find((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) || "").toLowerCase();
        const academic = parts.some((x) => /^(akademisyen|academic)$/i.test(x));
        const name = parts.filter((x) => !/@/.test(x) && !/^(akademisyen|academic|araştırmacı|arastirmaci|researcher)$/i.test(x)).join(" ").slice(0, 120);
        if (!email || !name) { bad.push(line); continue; }
        if (known.has(email)) { skipped.push(email); continue; }
        await api.setMember(email, { name, role: academic ? "academic" : "researcher" });
        known.add(email); added.push(email);
      }
      S.bulkMsg = L(`${added.length} kişi eklendi.`, `${added.length} added.`)
        + (skipped.length ? " " + L(`${skipped.length} adres zaten listedeydi.`, `${skipped.length} already on the list.`) : "")
        + (bad.length ? "<br>" + L("Okunamayan satırlar (ad ya da e-posta eksik):", "Lines that couldn't be read (missing name or email):") + "<br>" + bad.map(esc).join("<br>") : "");
      render();
    }
    else if (kind === "member") {
      const email = String(fd.get("email") || "").trim().toLowerCase();
      await api.setMember(email, { name: String(fd.get("name") || "").trim(), role: fd.get("role") === "academic" ? "academic" : "researcher" });
      form.reset();
    }
  } catch (e) {
    console.error(e);
    alert(tl("Kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.", "Could not save. Check your connection and try again."));
  } finally { if (btn.isConnected) btn.disabled = false; }
});

// Dil değişince yalnızca öznitelikteki metinler (placeholder, seçenekler) yenilenir.
new MutationObserver(() => {
  if (S.member && (S.view === "list" || S.view === "members" || (S.view === "readings" && !S.readingEdit))) render();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
