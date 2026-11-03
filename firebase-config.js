/* ============================================================
   Firebase bağlantı ayarları — Fikir Havuzu (ekip alanı)
   ------------------------------------------------------------
   Firebase konsolunda Proje ayarları → Genel → "Uygulamalarınız"
   bölümündeki web uygulamasının yapılandırma değerlerini buraya
   yapıştırın. Bu değerler gizli değildir; erişimi Firestore
   güvenlik kuralları (firestore.rules) korur.
   Kurulum adımları: FIKIR-HAVUZU-KURULUM.md
   ============================================================ */
export const firebaseConfig = {
  apiKey: "BURAYA_API_KEY",
  authDomain: "BURAYA_PROJE_ID.firebaseapp.com",
  projectId: "BURAYA_PROJE_ID",
  storageBucket: "BURAYA_PROJE_ID.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId: "BURAYA_APP_ID"
};
