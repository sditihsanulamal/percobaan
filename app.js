import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    getFirestore,
    collection, 
    onSnapshot, 
    getDocs, 
    doc, 
    setDoc, 
    updateDoc, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBDKfmReRO4M8DMUN8VB2Rmzh7AgkzYA4g",
    authDomain: "b-toraja.firebaseapp.com",
    projectId: "b-toraja",
    storageBucket: "b-toraja.firebasestorage.app",
    messagingSenderId: "738438625873",
    appId: "1:738438625873:web:5ced29512ce68c34d55670"
};

const app = initializeApp(firebaseConfig);
// Strategi: Offline persistence multi-tab — aman saat buka banyak tab sekaligus & tahan crash
let db;
try {
    db = initializeFirestore(app, { 
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        }) 
    });
} catch (e) {
    console.warn("Firestore initializeFirestore fallback to getFirestore:", e);
    db = getFirestore(app);
}
const auth = getAuth(app);

// MULTI-KELAS DINAMIS
const kamusKelas = {
    "1A": "1A Melayu", "1B": "1B Batak", "1C": "1C Nias", "1D": "1D Minang",
    "2A": "2A Jawa", "2B": "2B Sunda", "2C": "2C Mentawai", "2D": "2D Aceh",
    "3A": "3A Alas", "3B": "3B Pakpak", "3C": "3C Gorontalo", "3D": "3D Flores",
    "4A": "4A Dayak", "4B": "4B Betawi", "4C": "4C Badui", "4D": "4D Madura",
    "5A": "5A Tengger", "5B": "5B Toraja", "5C": "5C Ternate", "5D": "5D Bugis",
    "6A": "6A Kutai", "6B": "6B Paser", "6C": "6C Banjar", "6D": "6D Manggarai"
};

const urlParams = new URLSearchParams(window.location.search);
window.kelasTarget = (urlParams.get('kelas') || '5B').toUpperCase();
const namaLengkapKelas = kamusKelas[window.kelasTarget] || (window.kelasTarget + " (Belum Tersedia)");

document.querySelector('header h1').innerText = namaLengkapKelas;
document.querySelector('.sidebar-header-text h2').innerText = namaLengkapKelas;
document.title = "Jurnal Hafalan " + namaLengkapKelas + " - Profesional Edition";
document.getElementById('loginKelasInfo').innerText = 'Guru kelas ' + namaLengkapKelas;

const koleksiMurid = "murid_" + window.kelasTarget;
const koleksiMading = "mading_" + window.kelasTarget;

let dataMuridDinamis = [];
let isAdmin = false;
window.setAdminMode = (state) => {
    isAdmin = !!state;
    window.isAdmin = isAdmin;
};
let dataMadingDinamis = {};
window.currentMadingId = null;

window.getJumlahRakaat = () => {
    const tingkat = parseInt(window.kelasTarget.charAt(0));
    if (tingkat === 1) return 2;
    if (tingkat === 6) return 6;
    return 4;
};
window.toggleSidebarMenu = () => document.getElementById('mainSidebar').classList.toggle('open');

window.tambahItemMading = (type, data = {}) => {
    const isHadits = type === 'hadits';
    const container = document.getElementById(isHadits ? 'container-hadits' : 'container-doa');

    let html = `<div class="dinamis-item" style="border:1px dashed rgba(212,175,55,0.4); padding:15px; margin-bottom:15px; border-radius:8px; position:relative;">
        <button type="button" onclick="this.parentElement.remove()" style="position:absolute; top:10px; right:10px; background:rgba(255,59,48,0.2); color:#ff3b30; border:1px solid #ff3b30; border-radius:4px; padding:4px 8px; font-size:10px; cursor:pointer;">Hapus</button>
        <div class="detail-label" style="margin-bottom:8px;">Judul ${isHadits ? 'Hadits' : 'Doa'}</div>
        <input type="text" class="admin-input dyn-judul" value="${data.judul || ''}" style="margin-bottom:10px;">
        <div class="detail-label" style="margin-bottom:8px;">Teks Arab ${isHadits ? 'Hadits' : 'Doa'}</div>
        <textarea class="admin-input dyn-arab" rows="2" style="font-family:'Amiri'; font-size:18px; direction:rtl; margin-bottom:10px;">${data.arab || ''}</textarea>`;

    if (!isHadits) {
        html += `<div class="detail-label" style="margin-bottom:8px;">Latin Doa</div>
                 <textarea class="admin-input dyn-latin" rows="2" style="margin-bottom:10px;">${data.latin || ''}</textarea>`;
    }

    html += `<div class="detail-label" style="margin-bottom:8px;">Arti ${isHadits ? 'Hadits' : 'Doa'}</div>
             <textarea class="admin-input dyn-arti" rows="2" style="margin-bottom:16px;">${data.arti || ''}</textarea>
             <div class="audio-url-section" style="margin-bottom:10px;">
                 <span class="audio-url-label">🎙️ URL Audio Rekaman (Opsional)</span>
                 <input type="text" class="admin-input dyn-audio" value="${data.audio || ''}" style="margin-top:8px;" placeholder="https://voca.ro/...">
                 <a href="https://vocaroo.com" target="_blank" style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:var(--gold); text-decoration:none; margin-top:10px; background:rgba(212,175,55,0.1); padding:8px 14px; border-radius:12px; border:1px solid rgba(212,175,55,0.3);">
                     🎙️ Rekam Suara di Vocaroo
                 </a>
             </div>
        </div>`;

    container.insertAdjacentHTML('beforeend', html);
};

window.getTanggalHariIni = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
};

// Tanggal hari sekolah terakhir (Senin-Jumat)
// Jika hari ini Sabtu, tampilkan Jumat. Jika Minggu, tampilkan Jumat.
window.getTanggalHariSekolah = () => {
    const d = new Date();
    const day = d.getDay(); // 0=Minggu, 6=Sabtu
    if (day === 0) d.setDate(d.getDate() - 2); // Minggu → Jumat
    else if (day === 6) d.setDate(d.getDate() - 1); // Sabtu → Jumat
    const namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
    const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.getMonth()];
    return `${namaHari}, ${String(d.getDate()).padStart(2,'0')} ${namaBulan} ${d.getFullYear()}`;
};

// ============================================================
// DATABASE 114 SURAH RESMI MANDIRI (SDIT IHSANUL AMAL)
// ============================================================
export const DATA_114_SURAH = [
    { no: 1, nama: "Al-Fatihah", arab: "الفاتحة", ayat: 7, juz: 1 },
    { no: 2, nama: "Al-Baqarah", arab: "البقرة", ayat: 286, juz: 1 },
    { no: 3, nama: "Ali 'Imran", arab: "آل عمران", ayat: 200, juz: 3 },
    { no: 4, nama: "An-Nisa'", arab: "النساء", ayat: 176, juz: 4 },
    { no: 5, nama: "Al-Ma'idah", arab: "المائدة", ayat: 120, juz: 6 },
    { no: 6, nama: "Al-An'am", arab: "الأنعام", ayat: 165, juz: 7 },
    { no: 7, nama: "Al-A'raf", arab: "الأعراف", ayat: 206, juz: 8 },
    { no: 8, nama: "Al-Anfal", arab: "الأنفال", ayat: 75, juz: 9 },
    { no: 9, nama: "At-Taubah", arab: "التوبة", ayat: 129, juz: 10 },
    { no: 10, nama: "Yunus", arab: "يونس", ayat: 109, juz: 11 },
    { no: 11, nama: "Hud", arab: "هود", ayat: 123, juz: 11 },
    { no: 12, nama: "Yusuf", arab: "يوسف", ayat: 111, juz: 12 },
    { no: 13, nama: "Ar-Ra'd", arab: "الرعد", ayat: 43, juz: 13 },
    { no: 14, nama: "Ibrahim", arab: "إبراهيم", ayat: 52, juz: 13 },
    { no: 15, nama: "Al-Hijr", arab: "الحجر", ayat: 99, juz: 14 },
    { no: 16, nama: "An-Nahl", arab: "النحل", ayat: 128, juz: 14 },
    { no: 17, nama: "Al-Isra'", arab: "الإسراء", ayat: 111, juz: 15 },
    { no: 18, nama: "Al-Kahf", arab: "الكهف", ayat: 110, juz: 15 },
    { no: 19, nama: "Maryam", arab: "مريم", ayat: 98, juz: 16 },
    { no: 20, nama: "Taha", arab: "طه", ayat: 135, juz: 16 },
    { no: 21, nama: "Al-Anbiya'", arab: "الأنبياء", ayat: 112, juz: 17 },
    { no: 22, nama: "Al-Hajj", arab: "الحج", ayat: 78, juz: 17 },
    { no: 23, nama: "Al-Mu'minun", arab: "المؤمنون", ayat: 118, juz: 18 },
    { no: 24, nama: "An-Nur", arab: "النور", ayat: 64, juz: 18 },
    { no: 25, nama: "Al-Furqan", arab: "الفرقان", ayat: 77, juz: 18 },
    { no: 26, nama: "Asy-Syu'ara'", arab: "الشعراء", ayat: 227, juz: 19 },
    { no: 27, nama: "An-Naml", arab: "النمل", ayat: 93, juz: 19 },
    { no: 28, nama: "Al-Qasas", arab: "القصص", ayat: 88, juz: 20 },
    { no: 29, nama: "Al-'Ankabut", arab: "العنكبوت", ayat: 69, juz: 20 },
    { no: 30, nama: "Ar-Rum", arab: "الروم", ayat: 60, juz: 21 },
    { no: 31, nama: "Luqman", arab: "لقمان", ayat: 34, juz: 21 },
    { no: 32, nama: "As-Sajdah", arab: "السجدة", ayat: 30, juz: 21 },
    { no: 33, nama: "Al-Ahzab", arab: "الأحزاب", ayat: 73, juz: 21 },
    { no: 34, nama: "Saba'", arab: "سبأ", ayat: 54, juz: 22 },
    { no: 35, nama: "Fatir", arab: "فاطر", ayat: 45, juz: 22 },
    { no: 36, nama: "Yasin", arab: "يس", ayat: 83, juz: 22 },
    { no: 37, nama: "As-Saffat", arab: "الصافات", ayat: 182, juz: 23 },
    { no: 38, nama: "Sad", arab: "ص", ayat: 88, juz: 23 },
    { no: 39, nama: "Az-Zumar", arab: "الزمر", ayat: 75, juz: 23 },
    { no: 40, nama: "Ghafir", arab: "غافر", ayat: 85, juz: 24 },
    { no: 41, nama: "Fussilat", arab: "فصلت", ayat: 54, juz: 24 },
    { no: 42, nama: "Asy-Syura", arab: "الشورى", ayat: 53, juz: 25 },
    { no: 43, nama: "Az-Zukhruf", arab: "الزخرف", ayat: 89, juz: 25 },
    { no: 44, nama: "Ad-Dukhan", arab: "الدخان", ayat: 59, juz: 25 },
    { no: 45, nama: "Al-Jatsiyah", arab: "الجاثية", ayat: 37, juz: 25 },
    { no: 46, nama: "Al-Ahqaf", arab: "الأحقاف", ayat: 35, juz: 26 },
    { no: 47, nama: "Muhammad", arab: "محمد", ayat: 38, juz: 26 },
    { no: 48, nama: "Al-Fath", arab: "الفتح", ayat: 29, juz: 26 },
    { no: 49, nama: "Al-Hujurat", arab: "الحجرات", ayat: 18, juz: 26 },
    { no: 50, nama: "Qaf", arab: "ق", ayat: 45, juz: 26 },
    { no: 51, nama: "Az-Zariyat", arab: "الذاريات", ayat: 60, juz: 26 },
    { no: 52, nama: "At-Tur", arab: "الطور", ayat: 49, juz: 27 },
    { no: 53, nama: "An-Najm", arab: "النجم", ayat: 62, juz: 27 },
    { no: 54, nama: "Al-Qamar", arab: "القمر", ayat: 55, juz: 27 },
    { no: 55, nama: "Ar-Rahman", arab: "الرحمن", ayat: 78, juz: 27 },
    { no: 56, nama: "Al-Waqi'ah", arab: "الواقعة", ayat: 96, juz: 27 },
    { no: 57, nama: "Al-Hadid", arab: "الحديد", ayat: 29, juz: 27 },
    { no: 58, nama: "Al-Mujadilah", arab: "المجادلة", ayat: 22, juz: 28 },
    { no: 59, nama: "Al-Hasyr", arab: "الحشر", ayat: 24, juz: 28 },
    { no: 60, nama: "Al-Mumtahanah", arab: "الممتحنة", ayat: 13, juz: 28 },
    { no: 61, nama: "As-Saff", arab: "الصف", ayat: 14, juz: 28 },
    { no: 62, nama: "Al-Jumu'ah", arab: "الجمعة", ayat: 11, juz: 28 },
    { no: 63, nama: "Al-Munafiqun", arab: "المنافقون", ayat: 11, juz: 28 },
    { no: 64, nama: "At-Taghabun", arab: "التغابن", ayat: 18, juz: 28 },
    { no: 65, nama: "At-Talaq", arab: "الطلاق", ayat: 12, juz: 28 },
    { no: 66, nama: "At-Tahrim", arab: "التحريم", ayat: 12, juz: 28 },
    { no: 67, nama: "Al-Mulk", arab: "الملك", ayat: 30, juz: 29 },
    { no: 68, nama: "Al-Qalam", arab: "القلم", ayat: 52, juz: 29 },
    { no: 69, nama: "Al-Haqqah", arab: "الحاقة", ayat: 52, juz: 29 },
    { no: 70, nama: "Al-Ma'arij", arab: "المعارج", ayat: 44, juz: 29 },
    { no: 71, nama: "Nuh", arab: "نوح", ayat: 28, juz: 29 },
    { no: 72, nama: "Al-Jinn", arab: "الجن", ayat: 28, juz: 29 },
    { no: 73, nama: "Al-Muzzammil", arab: "المزمل", ayat: 20, juz: 29 },
    { no: 74, nama: "Al-Muddassir", arab: "المدثر", ayat: 56, juz: 29 },
    { no: 75, nama: "Al-Qiyamah", arab: "القيامة", ayat: 40, juz: 29 },
    { no: 76, nama: "Al-Insan", arab: "الإنسان", ayat: 31, juz: 29 },
    { no: 77, nama: "Al-Mursalat", arab: "المرسلات", ayat: 50, juz: 29 },
    { no: 78, nama: "An-Naba'", arab: "النبأ", ayat: 40, juz: 30 },
    { no: 79, nama: "An-Nazi'at", arab: "النازعات", ayat: 46, juz: 30 },
    { no: 80, nama: "'Abasa", arab: "عبس", ayat: 42, juz: 30 },
    { no: 81, nama: "At-Takwir", arab: "التكوير", ayat: 29, juz: 30 },
    { no: 82, nama: "Al-Infitar", arab: "الانفطار", ayat: 19, juz: 30 },
    { no: 83, nama: "Al-Muthaffifin", arab: "المطففين", ayat: 36, juz: 30 },
    { no: 84, nama: "Al-Insyiqaq", arab: "الانشقاق", ayat: 25, juz: 30 },
    { no: 85, nama: "Al-Buruj", arab: "البروج", ayat: 22, juz: 30 },
    { no: 86, nama: "At-Tariq", arab: "الطارق", ayat: 17, juz: 30 },
    { no: 87, nama: "Al-A'la", arab: "الأعلى", ayat: 19, juz: 30 },
    { no: 88, nama: "Al-Ghasyiyah", arab: "الغاشية", ayat: 26, juz: 30 },
    { no: 89, nama: "Al-Fajr", arab: "الفجر", ayat: 30, juz: 30 },
    { no: 90, nama: "Al-Balad", arab: "البلد", ayat: 20, juz: 30 },
    { no: 91, nama: "Asy-Syams", arab: "الشمس", ayat: 15, juz: 30 },
    { no: 92, nama: "Al-Lail", arab: "الليل", ayat: 21, juz: 30 },
    { no: 93, nama: "Ad-Duha", arab: "الضحى", ayat: 11, juz: 30 },
    { no: 94, nama: "Asy-Syarh", arab: "الشرح", ayat: 8, juz: 30 },
    { no: 95, nama: "At-Tin", arab: "التين", ayat: 8, juz: 30 },
    { no: 96, nama: "Al-'Alaq", arab: "العلق", ayat: 19, juz: 30 },
    { no: 97, nama: "Al-Qadr", arab: "القدر", ayat: 5, juz: 30 },
    { no: 98, nama: "Al-Bayyinah", arab: "البينة", ayat: 8, juz: 30 },
    { no: 99, nama: "Az-Zalzalah", arab: "الزلزلة", ayat: 8, juz: 30 },
    { no: 100, nama: "Al-'Adiyat", arab: "العاديات", ayat: 11, juz: 30 },
    { no: 101, nama: "Al-Qari'ah", arab: "القارعة", ayat: 11, juz: 30 },
    { no: 102, nama: "At-Takatsur", arab: "التكاثر", ayat: 8, juz: 30 },
    { no: 103, nama: "Al-'Asr", arab: "العصر", ayat: 3, juz: 30 },
    { no: 104, nama: "Al-Humazah", arab: "الهمزة", ayat: 9, juz: 30 },
    { no: 105, nama: "Al-Fil", arab: "الفيل", ayat: 5, juz: 30 },
    { no: 106, nama: "Quraisy", arab: "قريش", ayat: 4, juz: 30 },
    { no: 107, nama: "Al-Ma'un", arab: "الماعون", ayat: 7, juz: 30 },
    { no: 108, nama: "Al-Kautsar", arab: "الكوثر", ayat: 3, juz: 30 },
    { no: 109, nama: "Al-Kafirun", arab: "الكافرون", ayat: 6, juz: 30 },
    { no: 110, nama: "An-Nasr", arab: "النصر", ayat: 3, juz: 30 },
    { no: 111, nama: "Al-Lahab", arab: "اللهب", ayat: 5, juz: 30 },
    { no: 112, nama: "Al-Ikhlas", arab: "الإخلاص", ayat: 4, juz: 30 },
    { no: 113, nama: "Al-Falaq", arab: "الفلق", ayat: 5, juz: 30 },
    { no: 114, nama: "An-Nas", arab: "الناس", ayat: 6, juz: 30 }
];
window.DATA_114_SURAH = DATA_114_SURAH;

// Helper: Hari aktif hafalan Qur'an dengan Cutoff Pukul 16.00 (Sore)
window.getHariQuranAktif = () => {
    const d = new Date();
    const day = d.getDay(); // 0=Ahad, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
    const isAfterCutoff = d.getHours() >= 16; // Pukul 16.00 ke atas beralih ke persiapan hari berikutnya

    if (day === 0) {
        // Ahad: Sebelum 16.00 masih Kamis, Pukul 16.00 ke atas berganti ke persiapan Senin
        return isAfterCutoff ? 'senin' : 'kamis';
    }
    if (day === 1) {
        // Senin: Sebelum 16.00 setoran Senin, Pukul 16.00 ke atas persiapan Selasa
        return isAfterCutoff ? 'selasa' : 'senin';
    }
    if (day === 2) {
        // Selasa: Sebelum 16.00 setoran Selasa, Pukul 16.00 ke atas persiapan Rabu
        return isAfterCutoff ? 'rabu' : 'selasa';
    }
    if (day === 3) {
        // Rabu: Sebelum 16.00 setoran Rabu, Pukul 16.00 ke atas persiapan Kamis
        return isAfterCutoff ? 'kamis' : 'rabu';
    }
    // Kamis, Jumat, Sabtu:
    // Kamis s/d Ahad sebelum 16.00 tetap menampilkan Kamis (Opsi A)
    return 'kamis';
};

// Helper: Hari aktif sekolah (Senin - Jumat) untuk Muraja'ah & Imam Sholat
window.getHariSekolahAktif = () => {
    const d = new Date();
    const day = d.getDay();
    if (day === 1) return 'senin';
    if (day === 2) return 'selasa';
    if (day === 3) return 'rabu';
    if (day === 4) return 'kamis';
    if (day === 5) return 'jumat';
    return 'senin'; // default Sabtu, Minggu ke Senin (persiapan pekan baru)
};

// Helper: Dapatkan string target Qur'an aktif dari Mading (berjalan otomatis sesuai hari & jam cut-off 16.00)
window.getTargetQuranMadingAktif = () => {
    if (!dataMadingDinamis || !dataMadingDinamis['target-quran']?.fields) return '';
    const fields = dataMadingDinamis['target-quran'].fields;
    const curDay = window.getHariQuranAktif();
    const hasNewFormat = !!(fields.senin_surah || fields.selasa_surah || fields.rabu_surah || fields.kamis_surah);

    const rawSurah = fields[curDay + '_surah'] || (!hasNewFormat ? (fields.surah || '') : '');
    const rawAyat = fields[curDay + '_ayat'] || (!hasNewFormat ? (fields.ayat ? fields.ayat.replace(/^ayat\s*/i, '').trim() : '') : '');

    const cleanSurah = (rawSurah || '').replace(/^surah\s*/i, '').trim();
    const cleanAyat = (rawAyat || '').replace(/^ayat\s*/i, '').trim();

    if (!cleanSurah) return '';
    const surahText = 'Surah ' + cleanSurah;
    if (cleanAyat) {
        return `${surahText} Ayat ${cleanAyat}`;
    }
    return surahText;
};

// ============================================================
// SISTEM SURAH PICKER & FORM TARGET MINGGUAN
// ============================================================
window.initSurahPicker = (day) => {
    const listEl = document.getElementById('list-' + day + '-surah');
    if (!listEl || listEl.children.length > 0) return;

    let html = '';
    const allowedSurahs = window.getImamAllowedSurahs();
    allowedSurahs.forEach(s => {
        const juzBadge = window.getSurahJuzBadge(s);
        html += `<div class="surah-picker-item" data-no="${s.no}" data-nama="${s.nama}" onclick="window.selectSurahPicker('${day}', ${s.no})">`
            + `<div style="display:flex; align-items:center; gap:8px;">`
            + `<span style="color:var(--gold); font-weight:700;">${s.no}.</span> `
            + `<span>${s.nama}</span>`
            + `<span class="surah-item-meta">(${s.ayat} ayat)</span>`
            + `</div>`
            + `<span style="font-size:10px; color:var(--gold); background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); padding:1px 6px; border-radius:6px; font-weight:700;">${juzBadge}</span>`
            + `</div>`;
    });
    listEl.innerHTML = html;
};

window.toggleSurahPicker = (day) => {
    const dropdown = document.getElementById('dropdown-' + day + '-surah');
    const trigger = document.getElementById('trigger-' + day + '-surah');
    if (!dropdown || !trigger) return;
    const isShow = dropdown.classList.contains('show');

    document.querySelectorAll('.surah-picker-dropdown').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.surah-picker-trigger').forEach(t => t.classList.remove('active'));

    if (!isShow) {
        window.initSurahPicker(day);
        dropdown.classList.add('show');
        trigger.classList.add('active');
    }
};

window.filterSurahPicker = (day, query) => {
    const listEl = document.getElementById('list-' + day + '-surah');
    if (!listEl) return;
    const q = (query || '').toLowerCase().trim();

    Array.from(listEl.children).forEach(item => {
        const no = item.getAttribute('data-no');
        const nama = (item.getAttribute('data-nama') || '').toLowerCase();
        const matches = !q || nama.includes(q) || no.includes(q);
        item.style.display = matches ? 'flex' : 'none';
    });
};

window.selectSurahPicker = (day, surahNo) => {
    const s = DATA_114_SURAH.find(item => item.no === surahNo);
    if (!s) return;

    const hiddenInput = document.getElementById('fq-' + day + '-surah');
    if (hiddenInput) hiddenInput.value = s.nama;

    const juzBadge = window.getSurahJuzBadge(s);
    const labelEl = document.getElementById('label-' + day + '-surah');
    if (labelEl) {
        labelEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;">`
            + `<span class="surah-picker-num">${s.no}</span>`
            + `<b style="color:var(--gold-light);">${s.nama}</b>`
            + (juzBadge ? `<span style="font-size:10px; color:var(--gold); background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); padding:1px 6px; border-radius:6px; font-weight:700;">${juzBadge}</span>` : '')
            + `</span>`;
    }

    const listEl = document.getElementById('list-' + day + '-surah');
    if (listEl) {
        Array.from(listEl.children).forEach(it => {
            it.classList.toggle('selected', parseInt(it.getAttribute('data-no')) === surahNo);
        });
    }

    const dropdown = document.getElementById('dropdown-' + day + '-surah');
    const trigger = document.getElementById('trigger-' + day + '-surah');
    if (dropdown) dropdown.classList.remove('show');
    if (trigger) trigger.classList.remove('active');

    window.validasiBatasAyat(day);
};

window.setSurahPickerVal = (day, surahNameOrNo) => {
    window.initSurahPicker(day);
    if (!surahNameOrNo) {
        const hiddenInput = document.getElementById('fq-' + day + '-surah');
        if (hiddenInput) hiddenInput.value = '';
        const labelEl = document.getElementById('label-' + day + '-surah');
        if (labelEl) labelEl.innerText = 'Pilih Surah (Juz 1, 2, 28–30)...';
        return;
    }

    let s = null;
    if (typeof surahNameOrNo === 'number' || /^\d+$/.test(surahNameOrNo)) {
        s = DATA_114_SURAH.find(item => item.no === parseInt(surahNameOrNo));
    } else {
        const cleanName = surahNameOrNo.toString().toLowerCase().replace(/^surah\s+/i, '').replace(/[^a-z0-9]/g, '');
        s = DATA_114_SURAH.find(item => item.nama.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName);
    }

    if (s) {
        window.selectSurahPicker(day, s.no);
    } else {
        const hiddenInput = document.getElementById('fq-' + day + '-surah');
        if (hiddenInput) hiddenInput.value = surahNameOrNo;
        const labelEl = document.getElementById('label-' + day + '-surah');
        if (labelEl) labelEl.innerText = surahNameOrNo;
    }
};

window.validasiBatasAyat = (day) => {
    const surahVal = document.getElementById('fq-' + day + '-surah')?.value || '';
    const ayatInput = document.getElementById('fq-' + day + '-ayat');
    const hintEl = document.getElementById('hint-' + day + '-ayat');
    if (!ayatInput || !hintEl) return;

    const s = DATA_114_SURAH.find(item => item.nama.toLowerCase() === surahVal.toLowerCase());
    if (s) {
        const valStr = ayatInput.value || '';
        const nums = valStr.match(/\d+/g);
        if (nums && nums.length > 0) {
            const maxNum = Math.max(...nums.map(n => parseInt(n, 10)));
            if (maxNum > s.ayat) {
                hintEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">⚠️ Melebihi batas! Surah ${s.nama} hanya memiliki ${s.ayat} ayat (ayat ${maxNum} tidak ada).</span>`;
            } else {
                hintEl.innerText = `Total: ${s.ayat} ayat`;
            }
        } else {
            hintEl.innerText = `Total: ${s.ayat} ayat`;
        }
    } else {
        hintEl.innerText = '';
    }
};

window.salinSurahKeSemuaHari = (fromDay) => {
    const surahVal = document.getElementById('fq-' + fromDay + '-surah')?.value;
    if (!surahVal) {
        alert("Pilih surah untuk hari " + fromDay + " terlebih dahulu sebelum menyalin.");
        return;
    }
    const days = ['senin', 'selasa', 'rabu', 'kamis'];
    days.forEach(d => {
        if (d !== fromDay) {
            window.setSurahPickerVal(d, surahVal);
        }
    });
    alert(`✅ Surah "${surahVal}" berhasil disalin ke semua hari (Senin s/d Kamis)! Silakan sesuaikan nomor ayat dan rekaman audio masing-masing hari.`);
};

window.switchAdminQuranDay = (day) => {
    document.querySelectorAll('#adminQuranDayNav .quran-day-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-day') === day);
    });
    ['senin', 'selasa', 'rabu', 'kamis'].forEach(d => {
        const pane = document.getElementById('pane-quran-' + d);
        if (pane) pane.style.display = (d === day) ? 'block' : 'none';
    });
};

window.switchPublicQuranDay = () => {};

// Switcher Admin & Public untuk Muraja'ah dan Imam
window.switchAdminMurajaahDay = (day) => {
    document.querySelectorAll('#adminMurajaahDayNav .quran-day-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-day') === day);
    });
    ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
        const pane = document.getElementById('pane-admin-murajaah-' + d);
        if (pane) pane.style.display = (d === day) ? 'block' : 'none';
    });
};

window.switchAdminImamDay = (day) => {
    document.querySelectorAll('#adminImamDayNav .quran-day-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-day') === day);
    });
    ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
        const pane = document.getElementById('pane-admin-imam-' + d);
        if (pane) pane.style.display = (d === day) ? 'block' : 'none';
    });
};

window.switchPublicMurajaahDay = (day) => {
    document.querySelectorAll('#publicMurajaahDayTabs .royal-day-pill, #publicMurajaahDayTabs .mading-day-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-day') === day);
    });
    ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
        const pane = document.getElementById('pub-pane-murajaah-' + d);
        if (pane) pane.style.display = (d === day) ? 'block' : 'none';
    });
};

window.switchPublicImamDay = (day) => {
    document.querySelectorAll('#publicImamDayTabs .royal-day-pill, #publicImamDayTabs .mading-day-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-day') === day);
    });
    ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
        const pane = document.getElementById('pub-pane-imam-' + d);
        if (pane) pane.style.display = (d === day) ? 'block' : 'none';
    });
};

// ============================================================
// SISTEM SMART SURAH PICKER (DROPDOWN SURAH ADMIN JADWAL IMAM)
// ============================================================
window.getSurahJuzBadge = (s) => {
    if (!s) return '';
    if (s.no === 1) return 'Juz 1';
    if (s.no === 2) return 'Juz 1–2';
    return `Juz ${s.juz}`;
};

window.getImamAllowedSurahs = (query = '') => {
    const q = (query || '').toLowerCase().trim();
    return (window.DATA_114_SURAH || []).filter(s => {
        // Dibatasi khusus surah-surah yang berada di Juz 1, 2, 28, 29, dan 30:
        // - No 1: Al-Fatihah (Juz 1)
        // - No 2: Al-Baqarah (Juz 1 & 2)
        // - No 58..66: Al-Mujadilah s/d At-Tahrim (Juz 28)
        // - No 67..77: Al-Mulk s/d Al-Mursalat (Juz 29)
        // - No 78..114: An-Naba' s/d An-Nas (Juz 30)
        const isAllowed = (s.no === 1 || s.no === 2 || (s.no >= 58 && s.no <= 114));
        if (!isAllowed) return false;
        if (!q) return true;

        const juzText = (s.no === 1 ? 'juz 1' : (s.no === 2 ? 'juz 1 juz 2 juz 1-2 juz 1–2' : `juz ${s.juz}`));
        return s.nama.toLowerCase().includes(q) || String(s.no).includes(q) || juzText.includes(q);
    });
};

window.renderImamSurahPickerItems = (pickerId, targetInputId, list) => {
    let html = `<div class="surah-picker-item" onclick="window.selectImamSurahPicker('${pickerId}', '${targetInputId}', '')" style="color:#f87171; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:4px;">`
        + `<span>✕ Kosongkan Pilihan</span>`
        + `</div>`;

    if (!list || list.length === 0) {
        html += `<div style="padding:14px; text-align:center; color:var(--text-muted); font-size:12px;">Surah tidak ditemukan di Juz 1, 2, 28, 29, 30</div>`;
    } else {
        list.forEach(s => {
            const safeName = (s.nama || '').replace(/'/g, "\\'");
            const juzBadge = window.getSurahJuzBadge(s);
            html += `<div class="surah-picker-item" data-nama="${s.nama}" data-no="${s.no}" onclick="window.selectImamSurahPicker('${pickerId}', '${targetInputId}', '${safeName}')">`
                + `<div style="display:flex; align-items:center; gap:10px;">`
                + `<span class="surah-picker-num">${s.no}</span>`
                + `<span style="color:#fff; font-weight:600;">${s.nama}</span>`
                + `</div>`
                + `<div style="display:flex; align-items:center; gap:8px;">`
                + `<span style="font-size:10px; color:var(--gold); background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); padding:1px 6px; border-radius:6px; font-weight:700;">${juzBadge}</span>`
                + `<span style="font-size:11px; color:var(--text-muted);">${s.ayat} Ayat</span>`
                + `</div>`
                + `</div>`;
        });
    }
    return html;
};

window.createImamSurahPickerMarkup = (pickerId, targetInputId, placeholder = 'Pilih Surah (Juz 1, 2, 28–30)...') => {
    return `<div class="surah-picker-wrap" id="picker-wrap-surah-${pickerId}">`
        + `<input type="hidden" id="${targetInputId}" value="">`
        + `<div class="surah-picker-trigger" id="trigger-surah-${pickerId}" onclick="window.toggleImamSurahPicker('${pickerId}', '${targetInputId}')">`
        + `<span class="surah-picker-label" id="label-surah-${pickerId}">${placeholder}</span>`
        + `<svg class="surah-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`
        + `</div>`
        + `<div class="surah-picker-dropdown" id="dropdown-surah-${pickerId}">`
        + `<div class="surah-picker-list" id="list-surah-${pickerId}"></div>`
        + `</div>`
        + `</div>`;
};

window.initImamSurahPicker = (pickerId, targetInputId) => {
    const listEl = document.getElementById('list-surah-' + pickerId);
    if (!listEl) return;
    const list = window.getImamAllowedSurahs();
    listEl.innerHTML = window.renderImamSurahPickerItems(pickerId, targetInputId, list);
};

window.toggleImamSurahPicker = (pickerId, targetInputId) => {
    const dropdown = document.getElementById('dropdown-surah-' + pickerId);
    const trigger = document.getElementById('trigger-surah-' + pickerId);
    if (!dropdown || !trigger) return;
    const isShow = dropdown.classList.contains('show');

    // Tutup semua dropdown lain
    document.querySelectorAll('.surah-picker-dropdown, .student-picker-dropdown').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.surah-picker-trigger, .student-picker-trigger').forEach(t => t.classList.remove('active'));

    if (!isShow) {
        window.initImamSurahPicker(pickerId, targetInputId);
        dropdown.classList.add('show');
        trigger.classList.add('active');
    }
};

window.filterImamSurahPicker = () => {};

window.selectImamSurahPicker = (pickerId, targetInputId, namaSurah) => {
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = namaSurah || '';

    const labelEl = document.getElementById('label-surah-' + pickerId);
    if (labelEl) {
        if (namaSurah) {
            const surahObj = (window.DATA_114_SURAH || []).find(s => s.nama.toLowerCase() === namaSurah.toLowerCase());
            const noSurah = surahObj ? surahObj.no : '✦';
            const juzBadge = surahObj ? window.getSurahJuzBadge(surahObj) : '';
            labelEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;">`
                + `<span class="surah-picker-num">${noSurah}</span>`
                + `<b style="color:var(--gold-light);">${namaSurah}</b>`
                + (juzBadge ? `<span style="font-size:10px; color:var(--gold); background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); padding:1px 6px; border-radius:6px; font-weight:700;">${juzBadge}</span>` : '')
                + `</span>`;
        } else {
            labelEl.innerText = 'Pilih Surah (Juz 1, 2, 28–30)...';
        }
    }

    const dropdown = document.getElementById('dropdown-surah-' + pickerId);
    const trigger = document.getElementById('trigger-surah-' + pickerId);
    if (dropdown) dropdown.classList.remove('show');
    if (trigger) trigger.classList.remove('active');

    const m = targetInputId.match(/^fi-([a-z]+)-surah$/);
    if (m) {
        window.syncImamSmartInputs(m[1]);
    }
};

window.setImamSurahPickerVal = (pickerId, targetInputId, namaSurah) => {
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = namaSurah || '';

    const labelEl = document.getElementById('label-surah-' + pickerId);
    if (labelEl) {
        if (namaSurah) {
            const surahObj = (window.DATA_114_SURAH || []).find(s => s.nama.toLowerCase() === namaSurah.toLowerCase());
            const noSurah = surahObj ? surahObj.no : '✦';
            const juzBadge = surahObj ? window.getSurahJuzBadge(surahObj) : '';
            labelEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;">`
                + `<span class="surah-picker-num">${noSurah}</span>`
                + `<b style="color:var(--gold-light);">${namaSurah}</b>`
                + (juzBadge ? `<span style="font-size:10px; color:var(--gold); background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); padding:1px 6px; border-radius:6px; font-weight:700;">${juzBadge}</span>` : '')
                + `</span>`;
        } else {
            labelEl.innerText = 'Pilih Surah (Juz 1, 2, 28–30)...';
        }
    }
};

window.toggleImamInputMode = (day) => {
    const smartContainer = document.getElementById('mode-smart-' + day);
    const manualContainer = document.getElementById('mode-manual-' + day);
    const btn = document.getElementById('btn-toggle-mode-' + day);
    if (!smartContainer || !manualContainer || !btn) return;

    const isSmartActive = (smartContainer.style.display !== 'none');
    if (isSmartActive) {
        smartContainer.style.display = 'none';
        manualContainer.style.display = 'flex';
        btn.innerHTML = '⚡ Mode Cepat';
    } else {
        window.syncImamSmartInputs(day);
        manualContainer.style.display = 'none';
        smartContainer.style.display = 'block';
        btn.innerHTML = '✏️ Ketik Manual';
    }
};

window.syncImamSmartInputs = (day) => {
    const surahInput = document.getElementById('fi-' + day + '-surah');
    const surah = surahInput ? surahInput.value.trim() : '';
    const jmlRakaat = window.getJumlahRakaat();

    for (let r = 1; r <= jmlRakaat; r++) {
        const startEl = document.getElementById('fi-' + day + '-r' + r + '-start');
        const endEl = document.getElementById('fi-' + day + '-r' + r + '-end');
        const rawEl = document.getElementById('fi-' + day + '-r' + r);
        if (!rawEl) continue;

        const start = startEl ? startEl.value.trim() : '';
        const end = endEl ? endEl.value.trim() : '';

        if (!surah && !start && !end) {
            rawEl.value = '';
        } else if (surah) {
            if (start && end) {
                rawEl.value = (start === end) ? `${surah} ayat ${start}` : `${surah} ayat ${start}–${end}`;
            } else if (start) {
                rawEl.value = `${surah} ayat ${start}`;
            } else {
                rawEl.value = surah;
            }
        } else {
            if (start && end) {
                rawEl.value = (start === end) ? `Ayat ${start}` : `Ayat ${start}–${end}`;
            } else if (start) {
                rawEl.value = `Ayat ${start}`;
            } else {
                rawEl.value = '';
            }
        }
    }
};

window.parseRakaatString = (str) => {
    if (!str || typeof str !== 'string') return { surah: '', start: '', end: '' };
    const cleaned = str.trim();
    if (!cleaned) return { surah: '', start: '', end: '' };

    const regex = /^(?:surah\s+)?(.*?)(?:\s+ayat\s+(\d+)(?:\s*[\u2013\u2014\-]\s*(\d+))?)?$/i;
    const match = cleaned.match(regex);
    if (match) {
        const surah = (match[1] || '').trim();
        const start = match[2] || '';
        const end = match[3] || (match[2] ? match[2] : '');
        return { surah, start, end };
    }
    return { surah: cleaned, start: '', end: '' };
};

// ============================================================
// SISTEM CUSTOM STUDENT PICKER (DROPDOWN NAMA MURID)
// ============================================================
window.createStudentPickerMarkup = (pickerId, targetInputId, placeholder = 'Pilih Nama Ananda / Santri...') => {
    return `<div class="student-picker-wrap" id="picker-wrap-student-${pickerId}">`
        + `<input type="hidden" id="${targetInputId}" value="">`
        + `<div class="student-picker-trigger" id="trigger-student-${pickerId}" onclick="window.toggleStudentPicker('${pickerId}', '${targetInputId}')">`
        + `<span class="student-picker-label" id="label-student-${pickerId}">${placeholder}</span>`
        + `<svg class="student-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`
        + `</div>`
        + `<div class="student-picker-dropdown" id="dropdown-student-${pickerId}">`
        + `<div class="student-picker-list" id="list-student-${pickerId}"></div>`
        + `</div>`
        + `</div>`;
};

window.initStudentPicker = (pickerId, targetInputId) => {
    const listEl = document.getElementById('list-student-' + pickerId);
    if (!listEl) return;

    let html = `<div class="student-picker-item" onclick="window.selectStudentPicker('${pickerId}', '${targetInputId}', '')" style="color:#f87171; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:4px;">`
        + `<span>✕ Kosongkan Pilihan</span>`
        + `</div>`;

    if (Array.isArray(dataMuridDinamis) && dataMuridDinamis.length > 0) {
        dataMuridDinamis.forEach(m => {
            const initials = window.getInitials(m.nama || '');
            const safeName = (m.nama || '').replace(/'/g, "\\'");
            html += `<div class="student-picker-item" data-nama="${m.nama}" onclick="window.selectStudentPicker('${pickerId}', '${targetInputId}', '${safeName}')">`
                + `<div style="display:flex; align-items:center; gap:10px;">`
                + `<div class="student-picker-avatar">${initials}</div>`
                + `<span style="color:#fff; font-weight:600;">${m.nama}</span>`
                + `</div>`
                + `</div>`;
        });
    } else {
        html += `<div style="padding:14px; text-align:center; color:var(--text-muted); font-size:12px;">Belum ada data murid di kelas ${window.kelasTarget}</div>`;
    }
    listEl.innerHTML = html;
};

window.toggleStudentPicker = (pickerId, targetInputId) => {
    const dropdown = document.getElementById('dropdown-student-' + pickerId);
    const trigger = document.getElementById('trigger-student-' + pickerId);
    if (!dropdown || !trigger) return;
    const isShow = dropdown.classList.contains('show');

    // Tutup semua dropdown lain
    document.querySelectorAll('.surah-picker-dropdown, .student-picker-dropdown').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.surah-picker-trigger, .student-picker-trigger').forEach(t => t.classList.remove('active'));

    if (!isShow) {
        window.initStudentPicker(pickerId, targetInputId);
        dropdown.classList.add('show');
        trigger.classList.add('active');
    }
};

window.filterStudentPicker = () => {};

window.selectStudentPicker = (pickerId, targetInputId, namaMurid) => {
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = namaMurid || '';

    const labelEl = document.getElementById('label-student-' + pickerId);
    if (labelEl) {
        if (namaMurid) {
            const initials = window.getInitials(namaMurid);
            labelEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;"><span class="student-picker-avatar mini">${initials}</span><b>${namaMurid}</b></span>`;
        } else {
            labelEl.innerText = 'Pilih Nama Ananda / Santri...';
        }
    }

    const dropdown = document.getElementById('dropdown-student-' + pickerId);
    const trigger = document.getElementById('trigger-student-' + pickerId);
    if (dropdown) dropdown.classList.remove('show');
    if (trigger) trigger.classList.remove('active');
};

window.setStudentPickerVal = (pickerId, targetInputId, namaMurid) => {
    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = namaMurid || '';

    const labelEl = document.getElementById('label-student-' + pickerId);
    if (labelEl) {
        if (namaMurid) {
            const initials = window.getInitials(namaMurid);
            labelEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;"><span class="student-picker-avatar mini">${initials}</span><b>${namaMurid}</b></span>`;
        } else {
            labelEl.innerText = 'Pilih Nama Ananda / Santri...';
        }
    }
};

// Tutup dropdown surah & student jika klik di luar
document.addEventListener('click', (e) => {
    if (!e.target.closest('.surah-picker-wrap')) {
        document.querySelectorAll('.surah-picker-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.surah-picker-trigger').forEach(t => t.classList.remove('active'));
    }
    if (!e.target.closest('.student-picker-wrap')) {
        document.querySelectorAll('.student-picker-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.student-picker-trigger').forEach(t => t.classList.remove('active'));
    }
});

function renderGaleri(fields) {
    const grid = document.getElementById('galleryGrid');

    // Bangun daftar foto: prioritaskan array 'fotos' (format baru).
    // Jika belum ada, backward-compatible dengan foto1/foto2/foto3 lama.
    let fotoData = [];
    if (fields && Array.isArray(fields.fotos) && fields.fotos.length > 0) {
        fotoData = fields.fotos.map(f => ({
            key: null,
            rawUrl: f.url || '',
            caption: f.label || 'Dokumentasi',
            time: '',
            icon: '📸'
        }));
    } else if (fields) {
        // Fallback ke format lama
        const legacyItems = [
            { rawUrl: fields.foto1 || '', caption: 'Pembacaan Zikir Pagi', icon: '📿' },
            { rawUrl: fields.foto2 || '', caption: 'Sholat Dhuha', icon: '📸' },
            { rawUrl: fields.foto3 || '', caption: "Muraja'ah Hafalan", icon: '📖' },
        ];
        fotoData = legacyItems.filter(i => i.rawUrl);
        if (fotoData.length === 0) fotoData = legacyItems; // tampilkan semua meski kosong
    }

    let html = '';
    let queueProxy = [];

    fotoData.forEach((foto, idx) => {
        let rawInput = (foto.rawUrl !== undefined ? foto.rawUrl : (fields ? (fields[foto.key] || '') : '')).trim();
        let finalUrl = '';
        let needsExtract = false;

        if (rawInput) {
            const regexSrc = /src=["'](.*?)["']/;
            const regexBbcode = /\[img\](.*?)\[\/img\]/i;

            if (regexSrc.test(rawInput)) {
                finalUrl = rawInput.match(regexSrc)[1];
            } else if (regexBbcode.test(rawInput)) {
                finalUrl = rawInput.match(regexBbcode)[1];
            } else if (rawInput.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i)) {
                finalUrl = rawInput;
            } else if (rawInput.includes('ibb.co/')) {
                needsExtract = true;
            } else {
                finalUrl = rawInput;
            }
        }

        const imgId = 'img-' + idx;
        const btnId = 'btn-' + idx;
        const loadingId = 'load-' + idx;
        const iconId = 'icon-' + idx;

        if (needsExtract) {
            queueProxy.push({ url: rawInput, imgId, btnId, loadingId, iconId });
        }

        const displayImg = (finalUrl && !needsExtract) ? 'block' : 'none';
        const displayLoading = needsExtract ? 'flex' : 'none';
        const displayIcon = (!finalUrl && !needsExtract) ? 'flex' : 'none';

        const fotoKonten = rawInput
            ? `<img id="${imgId}" src="${finalUrl}" class="foto-real" alt="${foto.caption}" style="display:${displayImg}; width:100%; height:100%; object-fit:cover;" referrerpolicy="no-referrer" onerror="this.style.display='none'; document.getElementById('${iconId}').style.display='flex';">
               <div id="${loadingId}" style="display:${displayLoading}; position:absolute; flex-direction:column; align-items:center; gap:8px; color:var(--gold-muted); font-size:12px; font-weight:600;">
                   <svg style="animation: spin 1s linear infinite; width:24px; height:24px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style="opacity:0.75"></path></svg>
                   Mengekstrak Foto...
               </div>
               <span id="${iconId}" class="mading-icon" style="display:${displayIcon}; position:absolute; flex-direction:column; align-items:center; gap:8px;">${foto.icon}<span style="font-size:11px; font-family:'Inter'; color:var(--danger); font-weight:600;">Gagal Memuat Foto</span></span>`
            : `<span class="mading-icon" style="position:absolute;">${foto.icon}</span>`;

        const downloadBtn = rawInput
            ? `<a id="${btnId}" href="${finalUrl}" target="_blank" download class="download-btn" style="display:${finalUrl ? 'inline-flex' : 'none'};"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Unduh</a>`
            : `<span style="font-size:11px; color:var(--text-muted);">Foto belum tersedia</span>`;

        html += `<div class="glass-panel gallery-card">
            <div class="foto-placeholder">${fotoKonten}</div>
            <div class="gallery-info-wrapper">
                <div class="gallery-caption">${foto.caption}</div>
                ${downloadBtn}
            </div></div>`;
    });

    grid.innerHTML = html || '<div style="text-align:center; color:var(--text-muted); margin-top:30px; grid-column:1/-1;">Belum ada dokumentasi hari ini.</div>';

    queueProxy.forEach(item => {
        fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(item.url)}`)
            .then(res => res.json())
            .then(data => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, "text/html");

                let directUrl = '';
                const ogImage = doc.querySelector('meta[property="og:image"]');
                const linkImage = doc.querySelector('link[rel="image_src"]');

                if (ogImage && ogImage.content) {
                    directUrl = ogImage.content;
                } else if (linkImage && linkImage.href) {
                    directUrl = linkImage.href;
                }

                if (directUrl) {
                    document.getElementById(item.imgId).src = directUrl;
                    document.getElementById(item.imgId).style.display = 'block';
                    document.getElementById(item.btnId).href = directUrl;
                    document.getElementById(item.btnId).style.display = 'inline-flex';
                    document.getElementById(item.loadingId).style.display = 'none';
                } else {
                    throw new Error("Direct link diblokir server.");
                }
            })
            .catch(() => {
                document.getElementById(item.loadingId).style.display = 'none';
                document.getElementById(item.iconId).style.display = 'flex';
            });
    });
}

renderGaleri(null);
let lastGaleriSig = JSON.stringify(null);

// Strategi 4: Handler data dipisah menjadi fungsi agar bisa dipakai baik oleh onSnapshot maupun getDocs
function handleMadingSnapshot(snapshot) {
    dataMadingDinamis = {};
    snapshot.forEach((docSnap) => { dataMadingDinamis[docSnap.id] = docSnap.data(); });

    const infoDok = dataMadingDinamis['info-dokumentasi'];
    const f = (infoDok && infoDok.fields) ? infoDok.fields : null;

    // Tanggal otomatis sesuai hari sekolah (Senin-Jumat) — tidak perlu input manual
    document.getElementById('teksTanggalDokumentasi').innerText = window.getTanggalHariSekolah();

    const sig = JSON.stringify(f);
    if (sig !== lastGaleriSig) {
        lastGaleriSig = sig;
        renderGaleri(f);
    }

    // ✅ Jika modal detail ananda sedang terbuka, pastikan Target Qur'an langsung sinkron
    const modalMurid = document.getElementById('progressModal');
    if (modalMurid && modalMurid.classList.contains('open')) {
        const targetEl = document.getElementById('editQuranTarget');
        if (targetEl) {
            const madingTarget = window.getTargetQuranMadingAktif();
            if (madingTarget) {
                targetEl.value = madingTarget;
                const dispEl = document.getElementById('displayQuranTarget');
                if (dispEl && typeof ekstrakSurahDanAyatModal === 'function') {
                    const parsed = ekstrakSurahDanAyatModal(madingTarget);
                    if (parsed) {
                        dispEl.innerHTML = 'Surah ' + parsed.namaSurah + ' <span class="target-ayat-accent">: Ayat ' + parsed.ayat + '</span>';
                    } else {
                        dispEl.innerHTML = madingTarget;
                    }
                }
            }
        }
    }
}

function handleMuridSnapshot(snapshot) {
    if (!snapshot.empty) {
        dataMuridDinamis = [];
        snapshot.forEach((docSnap) => { dataMuridDinamis.push({ id: docSnap.id, ...docSnap.data() }); });
        dataMuridDinamis.sort((a, b) => a.nama.localeCompare(b.nama));
        window.renderMurid();
        if (urlParams.has('openStats') || urlParams.get('stats') === '1') {
            window.openStatsModal();
        }
    } else {
        document.getElementById('muridList').innerHTML = '<div style="text-align:center; color:var(--gold-muted); margin-top:40px; font-weight:500; grid-column:1/-1;">Belum ada data murid untuk kelas ' + window.kelasTarget + '.<br>Silakan tambahkan data via halaman Setup Murid.</div>';
    }
}

// Referensi unsubscribe untuk membersihkan listener lama saat role berubah
let unsubMading = null;
let unsubMurid = null;

onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;
    document.getElementById('adminBadge').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('loginForm').style.display = isAdmin ? 'none' : 'block';
    document.getElementById('logoutForm').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btnEditTanggal').style.display = isAdmin ? 'inline-block' : 'none';

    if (isAdmin && user.email) {
        document.getElementById('loggedInAs').innerText = '✉️ ' + user.email;
    }

    // Bersihkan listener lama sebelum pasang yang baru
    if (unsubMading) { unsubMading(); unsubMading = null; }
    if (unsubMurid) { unsubMurid(); unsubMurid = null; }

    if (isAdmin || window.isAdmin) {
        // Guru (admin): real-time listener — selalu dapat update otomatis
        unsubMading = onSnapshot(collection(db, koleksiMading), handleMadingSnapshot);
        unsubMurid = onSnapshot(collection(db, koleksiMurid), handleMuridSnapshot);
    } else {
        // Wali murid / publik: ambil sekali saja — hemat read, cache persistence yang urus sisanya
        getDocs(collection(db, koleksiMading)).then(handleMadingSnapshot);
        getDocs(collection(db, koleksiMurid)).then(handleMuridSnapshot);
    }
});

window.getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

window.renderMurid = () => {
    const list = document.getElementById('muridList');
    const hariIni = window.getTanggalHariIni();
    const cards = [];
    dataMuridDinamis.forEach((murid, index) => {
        const getCssClass = (status) => {
            if (status === 'A' || status === 'mumtaz') return 'mumtaz';
            if (status === 'B' || status === 'tuntas') return 'tuntas';
            if (status === 'C' || status === 'proses') return 'proses';
            return 'belum';
        };

        let cssQ = getCssClass(murid.quranStatus);
        let cssH = getCssClass(murid.haditsStatus);
        let cssD = getCssClass(murid.doaStatus);

        let hariIniStr = window.getTanggalHariIni();
        let statusHarian = (murid.tanggalSetor === hariIniStr) ? (murid.setoranHarian || "belum") : "belum";
        let glowClass = (statusHarian === 'sudah') ? 'sudah-setor' : '';
        let ribbonHtml = (statusHarian === 'sudah') 
            ? '<div class="diagonal-sash-container"><div class="diagonal-sash-ribbon">✓ SETOR</div></div>' 
            : '';
        let didoakanHariIni = localStorage.getItem('doa_ananda_' + murid.id + '_' + hariIniStr) === '1';
        let doaBadgeHtml = didoakanHariIni ? '<span class="badge-doa-glow" title="Telah Didoakan Orang Tua Hari Ini">🤲</span>' : '';

        cards.push('<div class="glass-panel murid-card ' + glowClass + '" onclick="window.openModal(' + index + ')">'
            + ribbonHtml
            + '<div class="avatar">' + window.getInitials(murid.nama) + '</div>'
            + '<div class="murid-info">'
            + '<div class="murid-nama"><span>' + murid.nama + '</span>' + doaBadgeHtml + '</div>'
            + '<div class="status-dots">'
            + '<span class="dot ' + cssQ + '" title="Qur\'an"></span>'
            + '<span class="dot ' + cssH + '" title="Hadits"></span>'
            + '<span class="dot ' + cssD + '" title="Doa"></span>'
            + '</div></div></div>');
    });
    list.innerHTML = cards.join('');
};

let debounceCariTimer = null;
window.cariMurid = () => {
    clearTimeout(debounceCariTimer);
    debounceCariTimer = setTimeout(() => {
        const input = document.getElementById('searchInput').value.toLowerCase();
        const cards = document.getElementsByClassName('murid-card');
        for (let i = 0; i < cards.length; i++) {
            const nama = cards[i].querySelector('.murid-nama').innerText.toLowerCase();
            cards[i].style.display = nama.includes(input) ? 'flex' : 'none';
        }
    }, 120);
};

window.switchTab = (tabId, btn) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.floating-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
    document.querySelectorAll('audio').forEach(a => a.pause());
};

const setBadge = (elementId, status, nilaiAngka) => {
    const el = document.getElementById(elementId);

    let grade = status;
    if (status === 'mumtaz') grade = 'A';
    else if (status === 'tuntas') grade = 'B';
    else if (status === 'proses') grade = 'C';
    else if (status === 'belum') grade = 'D';
    else if (status === 'tidakSetor') grade = 'X';
    else if (!['A', 'B', 'C', 'D'].includes(status)) grade = 'D';

    let cssClass = 'belum';
    if (grade === 'A') cssClass = 'mumtaz';
    else if (grade === 'B') cssClass = 'tuntas';
    else if (grade === 'C') cssClass = 'proses';

    el.className = 'dot ' + cssClass;

    if (['badgeQuran', 'badgeHadits', 'badgeDoa'].includes(elementId)) {
        el.style.width = 'auto'; el.style.height = 'auto'; el.style.padding = '4px 8px'; el.style.borderRadius = '12px'; el.style.fontSize = '11px'; el.style.fontWeight = 'bold';
        if (grade === 'X') {
            el.className = 'status-badge premium-badge grade-x';
            el.innerText = '❌ Tidak Setor';
            el.style.background = ''; el.style.color = '';
        } else if (grade === 'D' && (!nilaiAngka || nilaiAngka == 0)) {
            el.innerText = 'Belum Setor';
            el.style.background = 'rgba(239,68,68,0.2)'; el.style.color = 'var(--danger)';
        } else {
            let prefix = isAdmin ? `Nilai: ${nilaiAngka || '-'} ` : ``;
            let kurungBuka = isAdmin ? `(` : ``;
            let kurungTutup = isAdmin ? `)` : ``;

            if (grade === 'A') {
                el.className = 'status-badge premium-badge grade-a';
                el.innerText = prefix + `${kurungBuka}👑 A${kurungTutup}`;
            }
            else if (grade === 'B') {
                el.className = 'status-badge premium-badge grade-b';
                el.innerText = prefix + `${kurungBuka}🌟 B${kurungTutup}`;
            }
            else if (grade === 'C') {
                el.className = 'status-badge premium-badge grade-c';
                el.innerText = prefix + `${kurungBuka}⚡ C${kurungTutup}`;
            }
            else {
                el.className = 'status-badge premium-badge grade-d';
                el.innerText = prefix ? prefix + `(⏳ D)` : `⏳ D (Belum)`;
            }

            // Bersihkan inline style lama agar CSS Class berfungsi
            el.style.background = ''; el.style.color = '';
        }
    } else {
        el.innerText = "";
        el.style.width = '14px'; el.style.height = '14px'; el.style.padding = '0';
    }
};


/* ==========================================================================
   MAJESTIC MUTABA'AH HELPER STATE & CONTROLS (SDIT IHSANUL AMAL)
   ========================================================================== */
let activeModalSurahIndex = 0;
let activeModalSurahName = "Al-Baqarah";
let activeModalCurrentAyat = 1;
let activeModalTargetAyat = 1;
let activeModalTargetSurahIndex = -1;
let activeModalIsMurajaah = false;

function ekstrakSurahDanAyatModal(str) {
    if (!str || str === '-') return null;
    let teksBersih = str.toLowerCase().replace(/[^a-z0-9]/g, '');

    teksBersih = teksBersih.replace('mujadalah', 'mujadilah')
        .replace('baqaroh', 'baqarah')
        .replace('fatehah', 'fatihah')
        .replace('imron', 'imran')
        .replace('maidoh', 'maidah')
        .replace('dhuha', 'duha')
        .replace('thariq', 'tariq')
        .replace('thaahaa', 'taha').replace('thaha', 'taha')
        .replace('sajadah', 'sajdah');

    let indexSurah = -1;
    let panjangKecocokan = 0;
    for (let i = 0; i < DATA_114_SURAH.length; i++) {
        let namaNormal = DATA_114_SURAH[i].nama.toLowerCase().replace(/[^a-z]/g, '');
        if (teksBersih.includes(namaNormal) && namaNormal.length > panjangKecocokan) {
            indexSurah = i;
            panjangKecocokan = namaNormal.length;
        }
    }

    let angkaMatch = str.match(/(\d+)(?!.*\d)/);
    let ayatSekarang = angkaMatch ? parseInt(angkaMatch[0], 10) : 0;

    if (indexSurah !== -1 && ayatSekarang > 0) {
        return { indexSurah, ayat: ayatSekarang, namaSurah: DATA_114_SURAH[indexSurah].nama };
    }
    return null;
}

function updateQuranGaugeAndDisplay() {
    const dispSurah = document.getElementById('displaySurahNama');
    if (dispSurah) {
        dispSurah.innerHTML = activeModalSurahName + ' <span class="edit-pencil">✏️</span>';
    }
    const dialLabel = document.getElementById('dialSurahLabel');
    if (dialLabel) {
        dialLabel.innerHTML = 'Surah ' + activeModalSurahName;
    }
    const dispAyat = document.getElementById('displayAyatNum');
    if (dispAyat) {
        dispAyat.innerText = activeModalCurrentAyat;
    }

    const realisasiStr = 'Surah ' + activeModalSurahName + ' ayat ' + activeModalCurrentAyat + (activeModalIsMurajaah ? " (Muraja'ah)" : "");
    const qRealisasiInput = document.getElementById('editQuranRealisasi');
    if (qRealisasiInput) qRealisasiInput.value = realisasiStr;
    const txtWali = document.getElementById('txtWaliQuranSetor');
    if (txtWali) txtWali.innerText = realisasiStr;

    let pct = 0;
    let selisih = 0;
    if (activeModalTargetSurahIndex !== -1 && activeModalSurahIndex !== activeModalTargetSurahIndex) {
        if (activeModalSurahIndex > activeModalTargetSurahIndex) {
            pct = 100;
            selisih = -1;
        } else {
            pct = Math.min(99, Math.round((activeModalCurrentAyat / (DATA_114_SURAH[activeModalSurahIndex]?.ayat || 100)) * 50));
            selisih = 1;
        }
    } else if (activeModalTargetAyat > 0) {
        pct = Math.min(100, Math.round((activeModalCurrentAyat / activeModalTargetAyat) * 100));
        selisih = activeModalTargetAyat - activeModalCurrentAyat;
    }
    const bar = document.getElementById('quranProgressBar');
    if (bar) bar.style.width = pct + '%';
    const lblPct = document.getElementById('lblProgressPct');
    if (lblPct) lblPct.innerHTML = pct + '% <span>Tercapai</span>';
    const lblStatus = document.getElementById('lblProgressStatus');
    if (lblStatus) {
        if (activeModalTargetSurahIndex !== -1 && activeModalSurahIndex > activeModalTargetSurahIndex) {
            lblStatus.innerHTML = '<strong style="color:#34d399;">Melampaui Target (Surah Selanjutnya) 🌟</strong>';
        } else if (selisih > 0) {
            lblStatus.innerHTML = 'Selisih <strong style="color:#ffffff;">' + selisih + ' Ayat</strong> Menuju Target';
        } else if (selisih === 0) {
            lblStatus.innerHTML = '<strong style="color:#fef08a;">Tepat Sesuai Target Kelas! 🎯</strong>';
        } else {
            lblStatus.innerHTML = '<strong style="color:#34d399;">Melampaui Target (+ ' + Math.abs(selisih) + ' Ayat) 🌟</strong>';
        }
    }
}

/* ==========================================================================
   POLESAN CSS DIALOG PROMPT KUSTOM (PENGGANTI PROMPT BAWAAN BROWSER)
   ========================================================================== */
let _activePromptType = 'surah'; // 'surah' | 'ayat'

window.bukaPromptUbahSurah = () => {
    _activePromptType = 'surah';
    const overlay = document.getElementById('dialogPromptKustom');
    const icon = document.getElementById('promptIcon');
    const title = document.getElementById('promptTitle');
    const msg = document.getElementById('promptMessage');
    const inp = document.getElementById('promptInput');
    const hint = document.getElementById('promptSuggestionHint');

    if (!overlay || !inp) return;
    if (icon) icon.innerText = '📖';
    if (title) title.innerText = 'sditihsanulamal.github.io says';
    if (msg) msg.innerText = "Ketik nama Surah yang disetorkan ananda (contoh: Ali 'Imran, An-Naba', dll):";
    inp.type = 'text';
    inp.placeholder = 'Nama Surah atau nomor (1-114)...';
    inp.value = activeModalSurahName;
    if (hint) hint.innerHTML = '';

    overlay.style.display = 'flex';
    overlay.classList.add('open');
    setTimeout(() => {
        inp.focus();
        inp.select();
        window.handlePromptInputChange(inp.value);
    }, 50);
};

window.bukaPromptUbahAyat = () => {
    _activePromptType = 'ayat';
    const overlay = document.getElementById('dialogPromptKustom');
    const icon = document.getElementById('promptIcon');
    const title = document.getElementById('promptTitle');
    const msg = document.getElementById('promptMessage');
    const inp = document.getElementById('promptInput');
    const hint = document.getElementById('promptSuggestionHint');

    if (!overlay || !inp) return;
    if (icon) icon.innerText = '🎯';
    if (title) title.innerText = 'sditihsanulamal.github.io says';
    const surahData = DATA_114_SURAH[activeModalSurahIndex];
    const maxAyat = (surahData && surahData.ayat) ? surahData.ayat : 286;
    if (msg) msg.innerText = 'Ketik nomor ayat yang disetorkan ananda (Surah ' + activeModalSurahName + ', 1 - ' + maxAyat + '):';
    inp.type = 'number';
    inp.placeholder = 'Nomor ayat...';
    inp.value = activeModalCurrentAyat;
    if (hint) hint.innerHTML = 'Surah ' + activeModalSurahName + ' memiliki ' + maxAyat + ' ayat. Melebihi batas ini otomatis lanjut ke surah berikutnya.';

    overlay.style.display = 'flex';
    overlay.classList.add('open');
    setTimeout(() => {
        inp.focus();
        inp.select();
    }, 50);
};

window.editAyatManual = () => {
    window.bukaPromptUbahAyat();
};

window.tutupPromptKustom = () => {
    const overlay = document.getElementById('dialogPromptKustom');
    if (overlay) {
        overlay.classList.remove('open');
        overlay.style.display = 'none';
    }
};

window.handlePromptInputChange = (val) => {
    const hint = document.getElementById('promptSuggestionHint');
    if (!hint) return;
    if (_activePromptType === 'ayat') {
        const num = parseInt(val, 10);
        const surahData = DATA_114_SURAH[activeModalSurahIndex];
        if (surahData && !isNaN(num) && num > 0) {
            if (num > surahData.ayat) {
                let tempIdx = activeModalSurahIndex;
                let tempNum = num;
                let nextSurah = surahData;
                while (tempNum > nextSurah.ayat && tempIdx + 1 < DATA_114_SURAH.length) {
                    tempNum -= nextSurah.ayat;
                    tempIdx++;
                    nextSurah = DATA_114_SURAH[tempIdx];
                }
                hint.innerHTML = '⚡ <strong>Melebihi ' + surahData.nama + ' (' + surahData.ayat + ' ayat)</strong>: Otomatis lanjut ke <strong>Surah ' + nextSurah.nama + ' ayat ' + tempNum + '</strong>';
            } else {
                hint.innerHTML = 'Ayat ' + num + ' dari ' + surahData.ayat + ' (' + surahData.nama + ')';
            }
        } else {
            hint.innerHTML = '';
        }
        return;
    }

    if (!val || !val.trim()) {
        hint.innerHTML = '';
        return;
    }
    const clean = val.trim().replace(/^surah\s+/i, '');
    const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normClean = normalize(clean);

    // 1. Nomor surah (1-114)
    const num = parseInt(clean, 10);
    if (!isNaN(num) && String(num) === clean && num >= 1 && num <= 114) {
        const found = DATA_114_SURAH.find(s => s.no === num);
        if (found) {
            hint.innerHTML = '✨ Cocok: <strong>' + found.no + '. ' + found.nama + '</strong> (' + found.ayat + ' ayat • Juz ' + found.juz + ') ' + (found.arab || '');
            return;
        }
    }

    // 2. Exact match nama
    const exactMatch = (DATA_114_SURAH || []).find(s => normalize(s.nama) === normClean);
    if (exactMatch) {
        hint.innerHTML = '✨ Cocok: <strong>' + exactMatch.no + '. ' + exactMatch.nama + '</strong> (' + exactMatch.ayat + ' ayat • Juz ' + exactMatch.juz + ') ' + (exactMatch.arab || '');
        return;
    }

    // 3. Substring match
    const partialMatch = (DATA_114_SURAH || []).find(s => normalize(s.nama).includes(normClean));
    if (partialMatch && normClean.length >= 2) {
        hint.innerHTML = '🔍 Disarankan: <strong>' + partialMatch.no + '. ' + partialMatch.nama + '</strong> (' + partialMatch.ayat + ' ayat • Juz ' + partialMatch.juz + ')';
        return;
    }

    hint.innerHTML = '✏️ Nama surah kustom: "<strong>' + clean + '</strong>"';
};

window.submitPromptKustom = () => {
    const inp = document.getElementById('promptInput');
    if (!inp) return;
    const val = inp.value.trim();

    if (_activePromptType === 'ayat') {
        let num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) {
            let curSurah = DATA_114_SURAH[activeModalSurahIndex];
            if (curSurah) {
                while (num > curSurah.ayat && activeModalSurahIndex + 1 < DATA_114_SURAH.length) {
                    num -= curSurah.ayat;
                    activeModalSurahIndex++;
                    curSurah = DATA_114_SURAH[activeModalSurahIndex];
                    activeModalSurahName = curSurah.nama;
                }
                activeModalCurrentAyat = Math.min(num, curSurah.ayat);
            } else {
                activeModalCurrentAyat = num;
            }
            updateQuranGaugeAndDisplay();
        }
        window.tutupPromptKustom();
        return;
    }

    // Mode Surah
    if (val) {
        const clean = val.replace(/^surah\s+/i, '');
        const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normClean = normalize(clean);

        const num = parseInt(clean, 10);
        let matched = null;
        if (!isNaN(num) && String(num) === clean && num >= 1 && num <= 114) {
            matched = DATA_114_SURAH.find(s => s.no === num);
        } else {
            matched = (DATA_114_SURAH || []).find(s => normalize(s.nama) === normClean);
            if (!matched) {
                matched = (DATA_114_SURAH || []).find(s => normalize(s.nama).includes(normClean));
            }
        }

        if (matched) {
            activeModalSurahName = matched.nama;
            activeModalSurahIndex = matched.no - 1;
            if (activeModalCurrentAyat > matched.ayat) {
                activeModalCurrentAyat = 1;
            }
        } else {
            activeModalSurahName = clean;
        }

        updateQuranGaugeAndDisplay();
    }

    window.tutupPromptKustom();
};

window.stepAyat = (delta) => {
    let curSurah = DATA_114_SURAH[activeModalSurahIndex];
    if (!curSurah) {
        activeModalCurrentAyat = Math.max(1, activeModalCurrentAyat + delta);
        updateQuranGaugeAndDisplay();
        return;
    }

    let ayatBaru = activeModalCurrentAyat + delta;

    // Jika melebihi batas ayat surah saat ini: otomatis berpindah ke surah selanjutnya!
    while (ayatBaru > curSurah.ayat) {
        if (activeModalSurahIndex + 1 < DATA_114_SURAH.length) {
            ayatBaru -= curSurah.ayat;
            activeModalSurahIndex++;
            curSurah = DATA_114_SURAH[activeModalSurahIndex];
            activeModalSurahName = curSurah.nama;
        } else {
            // Sudah surah terakhir (An-Nas)
            ayatBaru = curSurah.ayat;
            break;
        }
    }

    // Jika kurang dari 1: mundur ke surah sebelumnya (jika delta negatif)
    while (ayatBaru < 1 && activeModalSurahIndex > 0) {
        activeModalSurahIndex--;
        curSurah = DATA_114_SURAH[activeModalSurahIndex];
        activeModalSurahName = curSurah.nama;
        ayatBaru += curSurah.ayat;
    }

    activeModalCurrentAyat = Math.max(1, ayatBaru);
    updateQuranGaugeAndDisplay();
};

window.toggleMurajaahModal = () => {
    activeModalIsMurajaah = !activeModalIsMurajaah;
    const btnMur = document.getElementById('btnMurajaah');
    if (btnMur) btnMur.classList.toggle('murajaah-active', activeModalIsMurajaah);
    updateQuranGaugeAndDisplay();
};

window.switchSubject = (subject, btn) => {
    ['quran', 'hadits', 'doa'].forEach(s => {
        const deck = document.getElementById('deck' + s.charAt(0).toUpperCase() + s.slice(1));
        const tab = document.getElementById('tabBtn-' + s);
        if (deck) deck.style.display = (s === subject) ? 'block' : 'none';
        if (tab) {
            if (s === subject) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
};

window.syncHaditsManual = (val) => {
    const el = document.getElementById('txtWaliHaditsSetor');
    if (el) el.innerText = val || '-';
};

window.syncDoaManual = (val) => {
    const el = document.getElementById('txtWaliDoaSetor');
    if (el) el.innerText = val || '-';
};

window.openModalDoa = () => {
    const m = document.getElementById('modalDoa');
    if (!m) return;
    requestAnimationFrame(() => {
        m.classList.add('open');
    });
};

window.closeModalDoa = () => {
    const m = document.getElementById('modalDoa');
    if (m) m.classList.remove('open');
};

let _bottomSheetTimer = null;

window.openBottomSheetDoa = (namaAnanda) => {
    const sheet = document.getElementById('bottomSheetDoaFeedback');
    if (!sheet) return;
    const nameEl = document.getElementById('doaNamaAnanda');
    if (nameEl) nameEl.textContent = namaAnanda || 'Ananda';

    clearTimeout(_bottomSheetTimer);
    requestAnimationFrame(() => {
        sheet.classList.add('is-visible');
    });

    // Auto dismiss after 6.5s if not closed manually
    _bottomSheetTimer = setTimeout(() => {
        window.closeBottomSheetDoa();
    }, 6500);
};

window.closeBottomSheetDoa = () => {
    const sheet = document.getElementById('bottomSheetDoaFeedback');
    if (sheet) sheet.classList.remove('is-visible');
    clearTimeout(_bottomSheetTimer);
};

window.kirimDoaOrangTua = () => {
    window.closeModalDoa();
    const idMurid = document.getElementById('editId').value;
    const namaMurid = document.getElementById('modalNama') ? document.getElementById('modalNama').innerText : 'Ananda';
    const hariIni = window.getTanggalHariIni();
    if (idMurid) {
        localStorage.setItem('doa_ananda_' + idMurid + '_' + hariIni, '1');
    }
    const tRow = document.getElementById('tandaDidoakanRow');
    if (tRow) tRow.style.display = 'block';

    if (window.renderMurid) window.renderMurid();

    // Munculkan Bottom-Sheet Berkah menggantikan alert browser
    setTimeout(() => {
        window.openBottomSheetDoa(namaMurid);
    }, 120);
};


function getGradeFromScore(num) {
    num = parseInt(num, 10);
    if (isNaN(num)) return 'A';
    if (num >= 93) return 'A';
    if (num >= 84) return 'B';
    if (num >= 75) return 'C';
    return 'D';
}

window.populateGradeDropdown = (subject, grade) => {
    let arr = [];
    if (grade === 'A') {
        for (let i = 100; i >= 93; i--) arr.push(i);
    } else if (grade === 'B') {
        for (let i = 92; i >= 84; i--) arr.push(i);
    } else if (grade === 'C') {
        for (let i = 83; i >= 75; i--) arr.push(i);
    } else if (grade === 'D') {
        for (let i = 74; i >= 60; i--) arr.push(i);
    }

    let listId = 'customDropdownList';
    let selectFn = 'window.selectCustomNilai';
    if (subject === 'hadits') {
        listId = 'haditsDropdownList';
        selectFn = 'window.selectHaditsNilai';
    } else if (subject === 'doa') {
        listId = 'doaDropdownList';
        selectFn = 'window.selectDoaNilai';
    }

    let html = '';
    arr.forEach(num => {
        html += `<div class="custom-dropdown-item" onclick="${selectFn}(${num})">${num}</div>`;
    });
    if (grade === 'D') {
        html += `<div class="custom-dropdown-item tidak-setor-item" onclick="window.pilihTidakSetor('${subject}')">❌ Tidak Setor Sama Sekali</div>`;
    }

    const listEl = document.getElementById(listId);
    if (listEl) listEl.innerHTML = html;
};

window.openModal = (index) => {
    const murid = dataMuridDinamis[index];
    document.getElementById('modalNama').innerText = murid.nama;
    document.getElementById('modalInitials').innerText = window.getInitials(murid.nama);
    document.getElementById('editId').value = murid.id;

    // Reset Deck ke Al-Qur'an
    window.switchSubject('quran');

    const hariIni = window.getTanggalHariIni();

    // Check status doa orang tua hari ini
    const tRow = document.getElementById('tandaDidoakanRow');
    if (tRow) {
        const didoakan = localStorage.getItem('doa_ananda_' + murid.id + '_' + hariIni) === '1';
        tRow.style.display = didoakan ? 'block' : 'none';
    }

    // Tanggal setor per mapel
    const sudahSetorQuranHariIni  = (murid.tanggalSetorQuran  || murid.tanggalSetor || '') === hariIni;
    const sudahSetorHaditsHariIni = (murid.tanggalSetorHadits || murid.tanggalSetor || '') === hariIni;
    const sudahSetorDoaHariIni    = (murid.tanggalSetorDoa    || murid.tanggalSetor || '') === hariIni;
    const sudahDinilaiHariIni = (murid.tanggalSetor === hariIni);

    const qStatus    = isAdmin ? (sudahSetorQuranHariIni  ? (murid.quranStatus  || 'belum') : 'belum') : (murid.quranStatus  || 'belum');
    const qNilaiAngka= isAdmin ? (sudahSetorQuranHariIni  ? (murid.quranNilaiAngka  || '') : '') : (murid.quranNilaiAngka  || '');
    const hStatus    = isAdmin ? (sudahSetorHaditsHariIni ? (murid.haditsStatus || 'belum') : 'belum') : (murid.haditsStatus || 'belum');
    const hNilaiAngka= isAdmin ? (sudahSetorHaditsHariIni ? (murid.haditsNilaiAngka || '') : '') : (murid.haditsNilaiAngka || '');
    const dStatus    = isAdmin ? (sudahSetorDoaHariIni    ? (murid.doaStatus    || 'belum') : 'belum') : (murid.doaStatus    || 'belum');
    const dNilaiAngka= isAdmin ? (sudahSetorDoaHariIni    ? (murid.doaNilaiAngka    || '') : '') : (murid.doaNilaiAngka    || '');

    const qStatusPublik = murid.quranStatus || 'belum';
    const qNilaiAngkaPublik = murid.quranNilaiAngka || '';
    const hStatusPublik = murid.haditsStatus || 'belum';
    const hNilaiAngkaPublik = murid.haditsNilaiAngka || '';
    const dStatusPublik = murid.doaStatus || 'belum';
    const dNilaiAngkaPublik = murid.doaNilaiAngka || '';

    const statusHarian = sudahDinilaiHariIni ? (murid.setoranHarian || 'belum') : 'belum';
    window.pilihSetoranHarian(statusHarian);

    // ==========================================
    // 1. DATA AL-QUR'AN (MASTHEAD, GAUGE & DIAL)
    // ==========================================
    const targetMadingAktif = window.getTargetQuranMadingAktif();
    const targetQuranVal = targetMadingAktif || murid.quranTarget || "";
    document.getElementById('editQuranTarget').value = targetQuranVal;

    const realisasiVal = murid.quranRealisasi || "";
    document.getElementById('editQuranRealisasi').value = realisasiVal || "-";
    document.getElementById('editStatusQuran').value = qStatus;

    // Parsing Target
    const parsedTarget = ekstrakSurahDanAyatModal(targetQuranVal);
    const dispQuranTarget = document.getElementById('displayQuranTarget');
    if (parsedTarget) {
        activeModalTargetSurahIndex = parsedTarget.indexSurah;
        activeModalTargetAyat = parsedTarget.ayat;
        dispQuranTarget.innerHTML = 'Surah ' + parsedTarget.namaSurah + ' <span class="target-ayat-accent">: Ayat ' + parsedTarget.ayat + '</span>';
    } else {
        activeModalTargetSurahIndex = -1;
        activeModalTargetAyat = 1;
        dispQuranTarget.innerHTML = targetQuranVal || "-";
    }

    // Parsing Realisasi
    activeModalIsMurajaah = realisasiVal.includes("(Muraja'ah)");
    const btnMur = document.getElementById('btnMurajaah');
    if (btnMur) btnMur.classList.toggle('murajaah-active', activeModalIsMurajaah);

    const parsedRealisasi = ekstrakSurahDanAyatModal(realisasiVal);
    if (parsedRealisasi) {
        activeModalSurahIndex = parsedRealisasi.indexSurah;
        activeModalSurahName = parsedRealisasi.namaSurah;
        activeModalCurrentAyat = parsedRealisasi.ayat;
    } else if (parsedTarget) {
        activeModalSurahIndex = parsedTarget.indexSurah;
        activeModalSurahName = parsedTarget.namaSurah;
        activeModalCurrentAyat = Math.max(1, parsedTarget.ayat - 1);
    } else {
        activeModalSurahIndex = 0;
        activeModalSurahName = DATA_114_SURAH[0].nama;
        activeModalCurrentAyat = 1;
    }

    // Update Tampilan Stepper & Gauge
    updateQuranGaugeAndDisplay();
    window.tutupPromptKustom();

    // Grade Al-Qur'an (Admin)
    let effQStatus = qStatus;
    if ((!effQStatus || effQStatus === 'belum') && qNilaiAngka) {
        effQStatus = getGradeFromScore(qNilaiAngka);
    }
    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(effQStatus) && effQStatus !== 'belum') {
        if (effQStatus === 'tidakSetor') {
            window.pilihTidakSetor('quran');
        } else {
            window.pilihGradeQuran(effQStatus);
            if (qNilaiAngka) window.updateNilaiManual(qNilaiAngka);
        }
    } else if (isAdmin) {
        window.populateGradeDropdown('quran', 'A');
        document.querySelectorAll('.grade-pill-quran').forEach(btn => btn.classList.remove('active'));
        const custBtnText = document.getElementById('customDropdownText');
        if (custBtnText) custBtnText.innerText = '--';
    }

    // ==========================================
    // 2. DATA HADITS
    // ==========================================
    const madingHadits = (dataMadingDinamis['target-hadits']?.fields?.listHadits || []).map(h => h.judul).filter(Boolean).join(" & ").trim();
    const targetHaditsVal = murid.haditsTarget || madingHadits || "";
    document.getElementById('editHaditsTarget').value = targetHaditsVal;
    const dispHaditsTarget = document.getElementById('displayHaditsTarget');
    if (dispHaditsTarget) dispHaditsTarget.innerText = targetHaditsVal || "-";

    const realisasiHaditsVal = murid.haditsRealisasi || "";
    document.getElementById('editHaditsRealisasi').value = realisasiHaditsVal;
    const txtWaliHadits = document.getElementById('txtWaliHaditsSetor');
    if (txtWaliHadits) txtWaliHadits.innerText = realisasiHaditsVal || "-";
    document.getElementById('editStatusHadits').value = hStatus;

    let effHStatus = hStatus;
    if ((!effHStatus || effHStatus === 'belum') && hNilaiAngka) {
        effHStatus = getGradeFromScore(hNilaiAngka);
    }
    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(effHStatus) && effHStatus !== 'belum') {
        if (effHStatus === 'tidakSetor') {
            window.pilihTidakSetor('hadits');
        } else {
            window.pilihGradeHadits(effHStatus);
            if (hNilaiAngka) window.updateHaditsNilai(hNilaiAngka);
        }
    } else if (isAdmin) {
        window.populateGradeDropdown('hadits', 'A');
        document.querySelectorAll('.hadits-pill-btn').forEach(btn => btn.classList.remove('active'));
        const hBtnText = document.getElementById('haditsDropdownText');
        if (hBtnText) hBtnText.innerText = '--';
    }

    // ==========================================
    // 3. DATA DOA
    // ==========================================
    const madingDoa = (dataMadingDinamis['target-hadits']?.fields?.listDoa || []).map(d => d.judul).filter(Boolean).join(" & ").trim();
    const targetDoaVal = murid.doaTarget || madingDoa || "";
    document.getElementById('editDoaTarget').value = targetDoaVal;
    const dispDoaTarget = document.getElementById('displayDoaTarget');
    if (dispDoaTarget) dispDoaTarget.innerText = targetDoaVal || "-";

    const realisasiDoaVal = murid.doaRealisasi || "";
    document.getElementById('editDoaRealisasi').value = realisasiDoaVal;
    const txtWaliDoa = document.getElementById('txtWaliDoaSetor');
    if (txtWaliDoa) txtWaliDoa.innerText = realisasiDoaVal || "-";
    document.getElementById('editStatusDoa').value = dStatus;

    let effDStatus = dStatus;
    if ((!effDStatus || effDStatus === 'belum') && dNilaiAngka) {
        effDStatus = getGradeFromScore(dNilaiAngka);
    }
    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(effDStatus) && effDStatus !== 'belum') {
        if (effDStatus === 'tidakSetor') {
            window.pilihTidakSetor('doa');
        } else {
            window.pilihGradeDoa(effDStatus);
            if (dNilaiAngka) window.updateDoaNilai(dNilaiAngka);
        }
    } else if (isAdmin) {
        window.populateGradeDropdown('doa', 'A');
        document.querySelectorAll('.doa-pill-btn').forEach(btn => btn.classList.remove('active'));
        const dBtnText = document.getElementById('doaDropdownText');
        if (dBtnText) dBtnText.innerText = '--';
    }

    // ==========================================
    // 4. STEMPEL PREDIKAT KELANCARAN WALI SANTRI
    // ==========================================
    const predikatSDIT = {
        A: { text: "Sangat Lancar (Mumtaz)", color: "#34d399" },
        B: { text: "Lancar (Jayyid Jiddan)", color: "#6ee7b7" },
        C: { text: "Cukup Lancar (Jayyid)", color: "#fcd34d" },
        D: { text: "Perlu Bimbingan (Muraja'ah)", color: "#f87171" }
    };

    function setWaliPredikat(status, elmId) {
        const el = document.getElementById(elmId);
        if (!el) return;
        if (status === 'tidakSetor') {
            el.innerText = "Belum Setor";
            el.style.color = "#f87171";
        } else if (predikatSDIT[status]) {
            el.innerText = predikatSDIT[status].text;
            el.style.color = predikatSDIT[status].color;
        } else {
            el.innerText = "Belum Dinilai";
            el.style.color = "#94a3b8";
        }
    }

    setWaliPredikat(qStatusPublik, 'lblPredikatNama');
    setWaliPredikat(hStatusPublik, 'lblPredikatHaditsNama');
    setWaliPredikat(dStatusPublik, 'lblPredikatDoaNama');

    // ==========================================
    // 5. TATA LETAK MODE GURU VS WALI SANTRI
    // ==========================================
    const adminRows = [
        document.getElementById('quranAdminGradesRow'),
        document.getElementById('haditsAdminGradesRow'),
        document.getElementById('doaAdminGradesRow'),
        document.getElementById('adminSetoranHarianContainer')
    ];
    const noteEl = document.getElementById('spreadsheetNote');
    const saveBtn = document.getElementById('btnSaveMurid');
    const doaBtn = document.getElementById('btnDoaWali');
    const actionGuru = document.getElementById('actionAreaGuru');
    const actionWali = document.getElementById('actionAreaWali');

    if (isAdmin || window.isAdmin) {
        adminRows.forEach(r => { if (r) r.style.display = 'flex'; });
        if (noteEl) noteEl.style.display = 'block';
        if (actionGuru) actionGuru.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'flex';
        if (actionWali) actionWali.style.display = 'none';
        if (doaBtn) doaBtn.style.display = 'none';

        document.getElementById('quranGuruInputArea').style.display = 'block';
        document.getElementById('quranWaliSlateArea').style.display = 'none';

        document.getElementById('haditsGuruInputArea').style.display = 'block';
        document.getElementById('haditsWaliSlateArea').style.display = 'none';

        document.getElementById('doaGuruInputArea').style.display = 'block';
        document.getElementById('doaWaliSlateArea').style.display = 'none';
    } else {
        adminRows.forEach(r => { if (r) r.style.display = 'none'; });
        if (noteEl) noteEl.style.display = 'none';
        if (actionGuru) actionGuru.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (actionWali) actionWali.style.display = 'block';
        if (doaBtn) doaBtn.style.display = 'flex';

        document.getElementById('quranGuruInputArea').style.display = 'none';
        document.getElementById('quranWaliSlateArea').style.display = 'block';

        document.getElementById('haditsGuruInputArea').style.display = 'none';
        document.getElementById('haditsWaliSlateArea').style.display = 'block';

        document.getElementById('doaGuruInputArea').style.display = 'none';
        document.getElementById('doaWaliSlateArea').style.display = 'block';
    }

    document.getElementById('progressModal').classList.add('open');
};

window.renderMadingHtml = (id, fields) => {
    if (!fields) return "<p style='text-align:center; color:var(--text-muted);'>Data sedang disinkronkan...</p>";

    const buatAudioPlayer = (url) => {
        if (url) {
            let finalUrl = url;
            const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
            const driveMatch = url.match(driveRegex);
            const vocarooRegex = /voca\.ro\/([a-zA-Z0-9]+)|vocaroo\.com\/([a-zA-Z0-9]+)/;
            const vocarooMatch = url.match(vocarooRegex);

            if (driveMatch && driveMatch[1]) {
                finalUrl = 'https://drive.google.com/uc?export=download&id=' + driveMatch[1];
            } else if (vocarooMatch) {
                const vocarooId = vocarooMatch[1] || vocarooMatch[2];
                finalUrl = 'https://media.vocaroo.com/mp3/' + vocarooId;
            }

            return '<div class="audio-player-wrap">'
                + '<audio controls><source src="' + finalUrl + '"></audio>'
                + '<div style="font-size:11px; color:var(--text-muted); margin-top:6px; text-align:center;">🎙️ Audio Rekaman</div>'
                + '</div>';
        }
        return '<div class="audio-unavailable">🎙️ Audio belum tersedia</div>';
    };

    if (id === 'jadwal-murajaah') {
        const days = [
            { key: 'senin', label: 'Senin' },
            { key: 'selasa', label: 'Selasa' },
            { key: 'rabu', label: 'Rabu' },
            { key: 'kamis', label: 'Kamis' },
            { key: 'jumat', label: 'Jumat' }
        ];
        const activeDay = window.getHariSekolahAktif();

        let tabsHtml = '<div class="royal-day-tabs" id="publicMurajaahDayTabs">';
        days.forEach(d => {
            const isActive = (d.key === activeDay);
            tabsHtml += `<button type="button" class="royal-day-pill ${isActive ? 'active' : ''}" data-day="${d.key}" onclick="window.switchPublicMurajaahDay('${d.key}')">${d.label}</button>`;
        });
        tabsHtml += '</div>';

        let panesHtml = '<div id="publicMurajaahDayPanes">';
        days.forEach(d => {
            const isVisible = (d.key === activeDay);
            const nama = fields[d.key + '_nama'] || '-';
            const pagi = fields[d.key + '_pagi'] || '-';
            const sore = fields[d.key + '_sore'] || '-';
            const initials = nama !== '-' ? window.getInitials(nama) : '—';

            panesHtml += `<div class="royal-pane" id="pub-pane-murajaah-${d.key}" style="${isVisible ? '' : 'display:none;'}">`
                + `<div class="royal-hero-card">`
                + `  <div class="royal-avatar-initials">${initials}</div>`
                + `  <div class="royal-honor-ribbon"><span class="royal-star">✦</span> PEMANDU MURAJA'AH <span class="royal-star">✦</span></div>`
                + `  <div class="royal-person-name">${nama}</div>`
                + `  <div class="royal-flourish"><span>✦</span></div>`
                + `</div>`
                + `<div class="royal-unified-canvas">`
                + `  <div class="royal-canvas-section">`
                + `    <div class="royal-canvas-label">☀️ Sesi Pagi</div>`
                + `    <div class="royal-canvas-value">${pagi}</div>`
                + `  </div>`
                + `  <div class="royal-canvas-divider"></div>`
                + `  <div class="royal-canvas-section">`
                + `    <div class="royal-canvas-label">🌙 Sesi Sore</div>`
                + `    <div class="royal-canvas-value">${sore}</div>`
                + `  </div>`
                + `</div>`
                + `</div>`;
        });
        panesHtml += '</div>';
        return tabsHtml + panesHtml;

    } else if (id === 'target-quran') {
        const activeDay = window.getHariQuranAktif();
        const hasNewFormat = !!(fields.senin_surah || fields.selasa_surah || fields.rabu_surah || fields.kamis_surah);
        const surah = fields[activeDay + '_surah'] || (!hasNewFormat ? (fields.surah || '') : '');
        const rawAyat = fields[activeDay + '_ayat'] || (!hasNewFormat ? (fields.ayat ? fields.ayat.replace(/^ayat\s*/i, '').trim() : '') : '');
        let ayatStr = '-';
        if (rawAyat) {
            const cleanAyat = rawAyat.replace(/^ayat\s*/i, '').trim();
            ayatStr = cleanAyat ? ('Ayat ' + cleanAyat) : '-';
        } else if (!hasNewFormat && fields.ayat) {
            ayatStr = fields.ayat;
        }
        const audio = fields[activeDay + '_audio'] || (!hasNewFormat ? (fields.audio || '') : '');

        const cleanSurahName = surah.replace(/^surah\s+/i, '').trim();
        const displaySurah = cleanSurahName ? ('Surah ' + cleanSurahName) : '-';

        return '<div style="text-align:center; padding:15px 10px;">'
            + '<div style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">Mohon Sambil Buka Al-Qur\'an, ya 😇</div>'
            + `<div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:6px;font-family:'Lora',serif;">${displaySurah}</div>`
            + `<div style="color:var(--gold);font-size:18px;font-weight:700;margin-bottom:24px;">${ayatStr}</div>`
            + buatAudioPlayer(audio)
            + '</div>';

    } else if (id === 'target-hadits') {
        let htmlHadits = '';
        const listH = fields.listHadits || (fields.h_judul ? [{ judul: fields.h_judul, arab: fields.h_arab, arti: fields.h_arti, audio: fields.h_audio }] : []);
        listH.forEach(h => {
            if (!h.judul && !h.arab) return;
            htmlHadits += '<div style="text-align:center;margin-bottom:30px;">'
                + '<span class="hari-badge" style="margin-top:0;">' + (h.judul || '') + '</span>'
                + '<div class="arabic-text" style="margin:20px 0;">' + (h.arab || '') + '</div>'
                + '<div style="font-size:14px;font-style:italic;color:var(--text-muted);">"' + (h.arti || '') + '"</div>'
                + buatAudioPlayer(h.audio)
                + '</div>';
        });

        let htmlDoa = '';
        const listD = fields.listDoa || (fields.d_judul ? [{ judul: fields.d_judul, arab: fields.d_arab, latin: fields.d_latin, arti: fields.d_arti, audio: fields.d_audio }] : []);
        listD.forEach(d => {
            if (!d.judul && !d.arab) return;
            htmlDoa += '<div style="text-align:center;margin-bottom:30px;">'
                + '<span class="hari-badge" style="margin-top:0;">' + (d.judul || '') + '</span>'
                + '<div class="arabic-text" style="margin:20px 0;">' + (d.arab || '') + '</div>'
                + '<div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:1px;margin-bottom:12px;">' + (d.latin || '') + '</div>'
                + '<div style="font-size:14px;font-style:italic;color:var(--text-muted);">"' + (d.arti || '') + '"</div>'
                + buatAudioPlayer(d.audio)
                + '</div>';
        });

        const divider = (htmlHadits && htmlDoa) ? '<hr style="border:0;border-top:1px dashed rgba(255,255,255,0.1);margin:20px 0;">' : '';
        return (htmlHadits || '') + divider + (htmlDoa || '');

    } else if (id === 'jadwal-imam') {
        const days = [
            { key: 'senin', label: 'Senin' },
            { key: 'selasa', label: 'Selasa' },
            { key: 'rabu', label: 'Rabu' },
            { key: 'kamis', label: 'Kamis' },
            { key: 'jumat', label: 'Jumat' }
        ];
        const activeDay = window.getHariSekolahAktif();
        const jmlRakaat = window.getJumlahRakaat();

        let tabsHtml = '<div class="royal-day-tabs" id="publicImamDayTabs">';
        days.forEach(d => {
            const isActive = (d.key === activeDay);
            tabsHtml += `<button type="button" class="royal-day-pill ${isActive ? 'active' : ''}" data-day="${d.key}" onclick="window.switchPublicImamDay('${d.key}')">${d.label}</button>`;
        });
        tabsHtml += '</div>';

        let panesHtml = '<div id="publicImamDayPanes">';
        days.forEach(d => {
            const isVisible = (d.key === activeDay);
            const nama = fields[d.key + '_nama'] || '-';
            const initials = nama !== '-' ? window.getInitials(nama) : '—';

            let stepperItemsHtml = '';
            for (let r = 1; r <= jmlRakaat; r++) {
                const val = fields[d.key + '_r' + r] || '-';
                stepperItemsHtml += `<div class="royal-stepper-item">`
                    + `  <div class="royal-stepper-node">${r}</div>`
                    + `  <div class="royal-stepper-content">`
                    + `    <div class="royal-stepper-label">Raka'at ke-${r}</div>`
                    + `    <div class="royal-stepper-value">${val}</div>`
                    + `  </div>`
                    + `</div>`;
            }

            panesHtml += `<div class="royal-pane" id="pub-pane-imam-${d.key}" style="${isVisible ? '' : 'display:none;'}">`
                + `<div class="royal-hero-card">`
                + `  <div class="royal-avatar-initials imam">${initials}</div>`
                + `  <div class="royal-honor-ribbon imam"><span class="royal-star">✦</span> IMAM SHOLAT DHUHA <span class="royal-star">✦</span></div>`
                + `  <div class="royal-person-name">${nama}</div>`
                + `  <div class="royal-flourish"><span>✦</span></div>`
                + `</div>`
                + `<div class="royal-unified-canvas royal-stepper-canvas">`
                + stepperItemsHtml
                + `</div>`
                + `</div>`;
        });
        panesHtml += '</div>';
        return tabsHtml + panesHtml;

    } else if (id === 'jadwal-tilawah') {
        let itemsHtml = '<div class="tilawah-timeline">';
        for (let i = 1; i <= 3; i++) {
            const hari = fields['h' + i] || '-';
            const nama = fields['n' + i] || '-';
            const surah = fields['s' + i] || '-';

            itemsHtml += `<div class="tilawah-timeline-item">`
                + `<div class="tilawah-timeline-node">${i}</div>`
                + `<div class="tilawah-timeline-content">`
                + `<div class="tilawah-timeline-meta">`
                + `<span class="tilawah-timeline-date">📅 ${hari}</span>`
                + `</div>`
                + `<div class="tilawah-timeline-name">${nama}</div>`
                + `<div class="tilawah-timeline-surah">📖 ${surah}</div>`
                + `</div>`
                + `</div>`;
        }
        itemsHtml += '</div>';

        const broadcastStrip = `<div class="tilawah-broadcast-strip">`
            + `<div class="icon">🎙️</div>`
            + `<div class="text">Disiarkan dengan <b>Langgam Hijaz</b> • Waktu: <b>12.00 – 12.20 WITA</b> (20 Menit)</div>`
            + `</div>`;

        return itemsHtml + broadcastStrip;
    }
    return "";
};

window.openMading = (id) => {
    window.currentMadingId = id;
    const data = dataMadingDinamis[id] || { title: "Memuat...", fields: {} };

    const titleText = document.getElementById('madingTitleText');
    const contentDiv = document.getElementById('madingContent');
    const editTitle = document.getElementById('editMadingTitle');
    const btnSave = document.getElementById('btnSaveMading');
    const adminArea = document.getElementById('madingAdminFormArea');

    document.querySelectorAll('.admin-form-mading').forEach(el => el.style.display = 'none');

    if (id === 'jadwal-murajaah') {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        let navHtml = '<div class="quran-day-nav" id="adminMurajaahDayNav">';
        days.forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            navHtml += `<button type="button" class="quran-day-pill" data-day="${d}" onclick="window.switchAdminMurajaahDay('${d}')">${D}</button>`;
        });
        navHtml += '</div>';

        let panesHtml = '';
        days.forEach(d => {
            panesHtml += `<div class="admin-murajaah-day-pane" id="pane-admin-murajaah-${d}" style="display:none;">`
                + `<div class="detail-label" style="margin-bottom:6px;">Pemimpin Muraja'ah</div>`
                + window.createStudentPickerMarkup('murajaah-' + d, 'fm-' + d + '-nama', 'Pilih Pemimpin Muraja\'ah...')
                + `<div class="detail-label" style="margin-top:12px; margin-bottom:6px;">Materi Muraja'ah Pagi ☀️</div>`
                + `<input type="text" id="fm-${d}-pagi" class="admin-input" placeholder="Contoh: An-Naba – At-Thariq">`
                + `<div class="detail-label" style="margin-top:12px; margin-bottom:6px;">Materi Muraja'ah Sore 🌙</div>`
                + `<input type="text" id="fm-${d}-sore" class="admin-input" placeholder="Contoh: Al-A'la – An-Nas">`
                + `</div>`;
        });
        document.getElementById('murajaah-fields-container').innerHTML = navHtml + panesHtml;
    }

    if (id === 'jadwal-imam') {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        const jmlRakaat = window.getJumlahRakaat();
        let navHtml = '<div class="quran-day-nav" id="adminImamDayNav">';
        days.forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            navHtml += `<button type="button" class="quran-day-pill" data-day="${d}" onclick="window.switchAdminImamDay('${d}')">${D}</button>`;
        });
        navHtml += '</div>';

        let panesHtml = '';
        days.forEach(d => {
            let rakaatSmartCards = '';
            let rakaatManualInputs = '';
            for (let r = 1; r <= jmlRakaat; r++) {
                rakaatSmartCards += `<div class="imam-rakaat-strip">`
                    + `<span class="rakaat-strip-tag">Raka'at ${r}</span>`
                    + `<div class="imam-range-inputs">`
                    + `<input type="number" min="1" id="fi-${d}-r${r}-start" class="admin-input-num" placeholder="Mulai" oninput="window.syncImamSmartInputs('${d}')">`
                    + `<span class="range-dash">–</span>`
                    + `<input type="number" min="1" id="fi-${d}-r${r}-end" class="admin-input-num" placeholder="Sampai" oninput="window.syncImamSmartInputs('${d}')">`
                    + `</div>`
                    + `</div>`;

                rakaatManualInputs += `<div class="imam-rakaat-strip">`
                    + `<span class="rakaat-strip-tag">Raka'at ${r}</span>`
                    + `<input type="text" id="fi-${d}-r${r}" class="admin-input" placeholder="Contoh: An-Nazi'at ayat 1–12" style="font-size:12px; padding:6px 10px; flex:1;">`
                    + `</div>`;
            }

            panesHtml += `<div class="admin-imam-day-pane" id="pane-admin-imam-${d}" style="display:none;">`
                + `<div class="detail-label" style="margin-bottom:6px;">Imam Sholat</div>`
                + window.createStudentPickerMarkup('imam-' + d, 'fi-' + d + '-nama', 'Pilih Imam Sholat...')
                + `<div class="imam-rakaat-header-row">`
                + `<div class="detail-label" style="margin:0;">Bacaan Surah & Ayat</div>`
                + `<button type="button" class="btn-toggle-input-mode" id="btn-toggle-mode-${d}" onclick="window.toggleImamInputMode('${d}')">✏️ Ketik Manual</button>`
                + `</div>`
                + `<div id="mode-smart-${d}">`
                + `<div style="margin-bottom:8px;">`
                + window.createImamSurahPickerMarkup('imam-' + d, 'fi-' + d + '-surah', 'Pilih Surah (Juz 1, 2, 28–30)...')
                + `</div>`
                + `<div class="imam-rakaat-strips-list">`
                + rakaatSmartCards
                + `</div>`
                + `</div>`
                + `<div id="mode-manual-${d}" class="imam-rakaat-strips-list" style="display:none;">`
                + rakaatManualInputs
                + `</div>`
                + `</div>`;
        });
        document.getElementById('imam-fields-container').innerHTML = navHtml + panesHtml;
    }

    if (id === 'jadwal-tilawah') {
        let h = '<div style="display:flex; flex-direction:column; gap:14px;">';
        for (let i = 1; i <= 3; i++) {
            h += '<div style="background:rgba(0,0,0,0.25); padding:16px; border-radius:16px; border:1px solid rgba(212,175,55,0.2);">'
                + `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">`
                + `<span class="tilawah-badge-sesi">SESI ${i}</span>`
                + `<span style="font-size:11px; color:var(--text-muted);">Tilawah Live</span>`
                + `</div>`
                + '<div class="detail-label" style="margin-bottom:6px;">Hari & Tanggal</div>'
                + `<input type="text" id="ft-h${i}" class="admin-input" placeholder="Contoh: Senin, 12 Okt" style="margin-bottom:12px;">`
                + '<div class="detail-label" style="margin-bottom:6px;">Pilih Santri Penampil</div>'
                + window.createStudentPickerMarkup('tilawah-' + i, 'ft-n' + i, 'Pilih Santri Penampil...')
                + '<div class="detail-label" style="margin-top:12px; margin-bottom:6px;">Surah & Ayat yang Dibawakan</div>'
                + `<input type="text" id="ft-s${i}" class="admin-input" placeholder="Contoh: Surah Al-Mulk ayat 1-15">`
                + '</div>';
        }
        h += '</div>';
        document.getElementById('form-jadwal-tilawah').innerHTML = h;
    }

    if (isAdmin || window.isAdmin) {
        titleText.style.display = 'none';
        contentDiv.style.display = 'none';
        adminArea.style.display = 'block';
        editTitle.style.display = 'block';
        btnSave.style.display = 'block';
        editTitle.value = data.title;

        const f = data.fields || {};
        document.getElementById('form-' + id).style.display = 'block';

        if (id === 'jadwal-murajaah') {
            ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
                window.setStudentPickerVal('murajaah-' + day, 'fm-' + day + '-nama', f[day + '_nama'] || '');
                const pEl = document.getElementById('fm-' + day + '-pagi');
                if (pEl) pEl.value = f[day + '_pagi'] || '';
                const sEl = document.getElementById('fm-' + day + '-sore');
                if (sEl) sEl.value = f[day + '_sore'] || '';
            });
            window.switchAdminMurajaahDay(window.getHariSekolahAktif());
        } else if (id === 'target-quran') {
            ['senin', 'selasa', 'rabu', 'kamis'].forEach(day => {
                window.initSurahPicker(day);
                const surahVal = f[day + '_surah'] || (day === 'senin' ? (f.surah || '') : '');
                const rawAyat = f[day + '_ayat'] || (day === 'senin' ? (f.ayat ? f.ayat.replace(/^ayat\s*/i, '').trim() : '') : '');
                const audioVal = f[day + '_audio'] || (day === 'senin' ? (f.audio || '') : '');

                window.setSurahPickerVal(day, surahVal);
                const ayatEl = document.getElementById('fq-' + day + '-ayat');
                if (ayatEl) ayatEl.value = rawAyat;
                const audioEl = document.getElementById('fq-' + day + '-audio');
                if (audioEl) audioEl.value = audioVal;
                window.validasiBatasAyat(day);
            });
            window.switchAdminQuranDay(window.getHariQuranAktif());
        } else if (id === 'target-hadits') {
            document.getElementById('container-hadits').innerHTML = '';
            document.getElementById('container-doa').innerHTML = '';

            const listH = f.listHadits || (f.h_judul ? [{ judul: f.h_judul, arab: f.h_arab, arti: f.h_arti, audio: f.h_audio }] : []);
            if (listH.length === 0) listH.push({});
            listH.forEach(h => window.tambahItemMading('hadits', h));

            const listD = f.listDoa || (f.d_judul ? [{ judul: f.d_judul, arab: f.d_arab, latin: f.d_latin, arti: f.d_arti, audio: f.d_audio }] : []);
            if (listD.length === 0) listD.push({});
            listD.forEach(d => window.tambahItemMading('doa', d));
        } else if (id === 'jadwal-tilawah') {
            for (let i = 1; i <= 3; i++) {
                const hEl = document.getElementById('ft-h' + i);
                if (hEl) hEl.value = f['h' + i] || '';
                window.setStudentPickerVal('tilawah-' + i, 'ft-n' + i, f['n' + i] || '');
                const sEl = document.getElementById('ft-s' + i);
                if (sEl) sEl.value = f['s' + i] || '';
            }
        } else if (id === 'jadwal-imam') {
            const jmlRakaat = window.getJumlahRakaat();
            ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
                window.setStudentPickerVal('imam-' + day, 'fi-' + day + '-nama', f[day + '_nama'] || '');

                let detectedSurah = '';
                let isAllSmartCompatible = true;
                let anyValuePresent = false;

                for (let r = 1; r <= jmlRakaat; r++) {
                    const rawVal = f[day + '_r' + r] || '';
                    const rawInput = document.getElementById('fi-' + day + '-r' + r);
                    if (rawInput) rawInput.value = rawVal;

                    if (rawVal) anyValuePresent = true;

                    const parsed = window.parseRakaatString(rawVal);
                    const startInput = document.getElementById('fi-' + day + '-r' + r + '-start');
                    const endInput = document.getElementById('fi-' + day + '-r' + r + '-end');
                    if (startInput) startInput.value = parsed.start || '';
                    if (endInput) endInput.value = parsed.end || '';

                    if (parsed.surah) {
                        const found = (window.DATA_114_SURAH || []).find(s =>
                            s.nama.toLowerCase() === parsed.surah.toLowerCase() ||
                            s.nama.toLowerCase().replace(/['-]/g, '') === parsed.surah.toLowerCase().replace(/['-]/g, '')
                        );
                        if (found) {
                            if (!detectedSurah) detectedSurah = found.nama;
                        } else {
                            isAllSmartCompatible = false;
                        }
                    }
                }

                if (detectedSurah) {
                    window.setImamSurahPickerVal('imam-' + day, 'fi-' + day + '-surah', detectedSurah);
                } else {
                    window.setImamSurahPickerVal('imam-' + day, 'fi-' + day + '-surah', '');
                }

                if (anyValuePresent && !isAllSmartCompatible && !detectedSurah) {
                    window.toggleImamInputMode(day);
                }
            });
            window.switchAdminImamDay(window.getHariSekolahAktif());
        } else if (id === 'info-dokumentasi') {
            // Bangun daftar item: prioritaskan format array baru, fallback ke lama
            let existingItems = [];
            if (Array.isArray(f.fotos) && f.fotos.length > 0) {
                existingItems = f.fotos;
            } else {
                // Migrasi dari format lama
                if (f.foto1) existingItems.push({ label: 'Pembacaan Zikir Pagi', url: f.foto1 });
                if (f.foto2) existingItems.push({ label: 'Sholat Dhuha', url: f.foto2 });
                if (f.foto3) existingItems.push({ label: "Muraja'ah Hafalan", url: f.foto3 });
            }
            if (existingItems.length === 0) {
                existingItems = [
                    { label: 'Pembacaan Zikir Pagi', url: '' },
                    { label: 'Sholat Dhuha', url: '' },
                    { label: "Muraja'ah Hafalan", url: '' },
                ];
            }
            window._renderFotoDinamis(existingItems);
            const prev = document.getElementById('fdok-tanggal-preview');
            if (prev) prev.innerText = window.getTanggalHariSekolah();
        }
    } else {
        titleText.style.display = 'block';
        contentDiv.style.display = 'block';
        adminArea.style.display = 'none';
        editTitle.style.display = 'none';
        btnSave.style.display = 'none';
        titleText.innerHTML = data.title;
        contentDiv.innerHTML = window.renderMadingHtml(id, data.fields);
    }
    document.getElementById('madingModal').classList.add('open');
};

// ─── Form dinamis untuk galeri dokumentasi ────────────────────────────────
window._renderFotoDinamis = (items) => {
    const container = document.getElementById('fdok-container');
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, idx) => window._tambahFotoItem(item.label, item.url));
};

window._tambahFotoItem = (label = '', url = '') => {
    const container = document.getElementById('fdok-container');
    if (!container) return;
    const idx = container.children.length;
    const wrap = document.createElement('div');
    wrap.className = 'fdok-item';
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid rgba(255,255,255,0.07); margin-bottom:8px; position:relative;';
    wrap.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
            <span style="font-size:10px; font-weight:700; color:var(--gold-muted); text-transform:uppercase; letter-spacing:0.5px;">Item ${idx + 1}</span>
            <button type="button" onclick="this.closest('.fdok-item').remove()"
                style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:6px; padding:2px 8px; font-size:11px; cursor:pointer; font-weight:700; transition:all 0.15s ease;">
                🗑 Hapus
            </button>
        </div>
        <input type="text" class="fdok-label admin-input" placeholder="Nama kegiatan (mis: Sholat Dhuha)" value="${label}" style="margin-bottom:0;">
        <input type="text" class="fdok-url admin-input" placeholder="URL foto (Tautan Langsung dari PostImg...)" value="${url}" style="margin-bottom:0;">
    `;
    container.appendChild(wrap);
};
// ──────────────────────────────────────────────────────────────────────────

window.simpanDataMading = async () => {

    if (!isAdmin) return;
    const btn = document.getElementById('btnSaveMading');
    btn.innerText = "Menyimpan...";
    const id = window.currentMadingId;
    const newTitle = document.getElementById('editMadingTitle').value;
    let newFields = {};

    if (id === 'jadwal-murajaah') {
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
            newFields[day + '_nama'] = document.getElementById('fm-' + day + '-nama').value;
            newFields[day + '_pagi'] = document.getElementById('fm-' + day + '-pagi').value;
            newFields[day + '_sore'] = document.getElementById('fm-' + day + '-sore').value;
        });
    } else if (id === 'target-quran') {
        newFields = {
            senin_surah: (document.getElementById('fq-senin-surah')?.value || '').trim(),
            senin_ayat: (document.getElementById('fq-senin-ayat')?.value || '').trim(),
            senin_audio: (document.getElementById('fq-senin-audio')?.value || '').trim(),

            selasa_surah: (document.getElementById('fq-selasa-surah')?.value || '').trim(),
            selasa_ayat: (document.getElementById('fq-selasa-ayat')?.value || '').trim(),
            selasa_audio: (document.getElementById('fq-selasa-audio')?.value || '').trim(),

            rabu_surah: (document.getElementById('fq-rabu-surah')?.value || '').trim(),
            rabu_ayat: (document.getElementById('fq-rabu-ayat')?.value || '').trim(),
            rabu_audio: (document.getElementById('fq-rabu-audio')?.value || '').trim(),

            kamis_surah: (document.getElementById('fq-kamis-surah')?.value || '').trim(),
            kamis_ayat: (document.getElementById('fq-kamis-ayat')?.value || '').trim(),
            kamis_audio: (document.getElementById('fq-kamis-audio')?.value || '').trim(),
        };

        const hariIni = window.getHariQuranAktif();
        const activeSurah = newFields[hariIni + '_surah'] || newFields.senin_surah || '';
        const activeAyat = newFields[hariIni + '_ayat'] || newFields.senin_ayat || '';
        const activeAudio = newFields[hariIni + '_audio'] || newFields.senin_audio || '';

        const cleanAyat = activeAyat.replace(/^ayat\s*/i, '').trim();
        newFields.surah = activeSurah;
        newFields.ayat = cleanAyat ? ('Ayat ' + cleanAyat) : '';
        newFields.audio = activeAudio;
    } else if (id === 'target-hadits') {
        const hItems = Array.from(document.getElementById('container-hadits').children).map(item => ({
            judul: item.querySelector('.dyn-judul').value,
            arab: item.querySelector('.dyn-arab').value,
            arti: item.querySelector('.dyn-arti').value,
            audio: item.querySelector('.dyn-audio').value
        })).filter(h => h.judul || h.arab);
        const dItems = Array.from(document.getElementById('container-doa').children).map(item => ({
            judul: item.querySelector('.dyn-judul').value,
            arab: item.querySelector('.dyn-arab').value,
            latin: item.querySelector('.dyn-latin').value,
            arti: item.querySelector('.dyn-arti').value,
            audio: item.querySelector('.dyn-audio').value
        })).filter(d => d.judul || d.arab);
        newFields = { listHadits: hItems, listDoa: dItems };
    } else if (id === 'jadwal-tilawah') {
        for (let i = 1; i <= 3; i++) {
            newFields['h' + i] = document.getElementById('ft-h' + i).value;
            newFields['n' + i] = document.getElementById('ft-n' + i).value;
            newFields['s' + i] = document.getElementById('ft-s' + i).value;
        }
    } else if (id === 'jadwal-imam') {
        const jmlRakaat = window.getJumlahRakaat();
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
            const smartContainer = document.getElementById('mode-smart-' + day);
            if (smartContainer && smartContainer.style.display !== 'none') {
                window.syncImamSmartInputs(day);
            }
            newFields[day + '_nama'] = document.getElementById('fi-' + day + '-nama').value;
            for (let r = 1; r <= jmlRakaat; r++) {
                const inputEl = document.getElementById('fi-' + day + '-r' + r);
                if (inputEl) {
                    newFields[day + '_r' + r] = inputEl.value;
                }
            }
        });
    } else if (id === 'info-dokumentasi') {
        // Kumpulkan semua item dari form dinamis
        const fotosArr = [];
        document.querySelectorAll('.fdok-item').forEach(item => {
            const label = item.querySelector('.fdok-label').value.trim();
            const url   = item.querySelector('.fdok-url').value.trim();
            if (label || url) fotosArr.push({ label, url });
        });
        newFields = { fotos: fotosArr };
    }

    try {
        await setDoc(doc(db, koleksiMading, id), { title: newTitle, fields: newFields }, { merge: true });

        if (id === 'target-quran') {
            const batch = writeBatch(db);
            const cleanSurah = (newFields.surah || '').replace(/^surah\s*/i, '').trim();
            const cleanAyat = (newFields.ayat || '').replace(/^ayat\s*/i, '').trim();
            const targetGabungan = cleanSurah 
                ? ('Surah ' + cleanSurah + (cleanAyat ? ' Ayat ' + cleanAyat : '')) 
                : '';
            dataMuridDinamis.forEach((murid) => {
                murid.quranTarget = targetGabungan;
                batch.update(doc(db, koleksiMurid, murid.id), { quranTarget: targetGabungan });
            });
            await batch.commit();
        }

        if (id === 'target-hadits') {
            const batch = writeBatch(db);
            const haditsTarget = (newFields.listHadits || []).map(h => h.judul).filter(Boolean).join(" & ").trim();
            const doaTarget = (newFields.listDoa || []).map(d => d.judul).filter(Boolean).join(" & ").trim();
            dataMuridDinamis.forEach((murid) => {
                const updates = {};
                if (haditsTarget) updates.haditsTarget = haditsTarget;
                if (doaTarget) updates.doaTarget = doaTarget;
                if (Object.keys(updates).length) batch.update(doc(db, koleksiMurid, murid.id), updates);
            });
            await batch.commit();
        }

        btn.innerText = "Simpan Pengumuman";
        window.closeModal('madingModal');
    } catch (error) {
        alert("Error: " + error.message);
        btn.innerText = "Simpan Pengumuman";
    }
};

window.closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('open');
    if (modalId === 'madingModal') document.getElementById('madingModal').querySelectorAll('audio').forEach(a => a.pause());
};
window.closeModalOnBackdrop = (event, modalId) => { if (event.target.id === modalId) window.closeModal(modalId); };

window.loginAdmin = () => {
    const btn = document.querySelector('#loginForm button');
    btn.innerText = "Memproses...";
    signInWithEmailAndPassword(auth, document.getElementById('adminEmail').value, document.getElementById('adminPassword').value)
        .then(() => { btn.innerText = "Masuk Dashboard"; window.closeModal('loginModal'); })
        .catch(() => { alert("Login gagal. Periksa kembali email & password Anda."); btn.innerText = "Masuk Dashboard"; });
};

window.logoutAdmin = () => signOut(auth).then(() => window.closeModal('loginModal'));

const dbQuran = DATA_114_SURAH.map(s => ({ nama: s.nama, batas: s.ayat, no: s.no, arab: s.arab }));

window.tambahAyatPintar = (aksi) => {
    let textarea = document.getElementById('editQuranRealisasi');
    if (!textarea) return;
    let teksAsli = textarea.value.trim();

    if (aksi === 'ulangi') {
        if (!teksAsli.includes("(Muraja'ah)")) {
            textarea.value = (teksAsli === '-' || !teksAsli) ? "(Muraja'ah)" : (teksAsli + " (Muraja'ah)");
        }
        return;
    }

    // Helper mengekstrak surah dan ayat dari string teks
    function ekstrakSurahDanAyat(str) {
        if (!str || str === '-') return null;
        let teksBersih = str.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Normalisasi transliterasi umum
        teksBersih = teksBersih.replace('mujadalah', 'mujadilah')
            .replace('baqaroh', 'baqarah')
            .replace('fatehah', 'fatihah')
            .replace('imron', 'imran')
            .replace('maidoh', 'maidah')
            .replace('dhuha', 'duha')
            .replace('thariq', 'tariq')
            .replace('thaahaa', 'taha').replace('thaha', 'taha')
            .replace('sajadah', 'sajdah');

        let indexSurah = -1;
        let panjangKecocokan = 0;
        for (let i = 0; i < DATA_114_SURAH.length; i++) {
            let namaNormal = DATA_114_SURAH[i].nama.toLowerCase().replace(/[^a-z]/g, '');
            if (teksBersih.includes(namaNormal) && namaNormal.length > panjangKecocokan) {
                indexSurah = i;
                panjangKecocokan = namaNormal.length;
            }
        }

        let angkaMatch = str.match(/(\d+)(?!.*\d)/);
        let ayatSekarang = angkaMatch ? parseInt(angkaMatch[0], 10) : 0;

        if (indexSurah !== -1 && ayatSekarang > 0) {
            return { indexSurah, ayat: ayatSekarang };
        }
        return null;
    }

    // 1. Coba ekstrak dari teks di editQuranRealisasi saat ini
    let data = ekstrakSurahDanAyat(teksAsli);

    // 2. Jika realisasi masih kosong / "-" / belum ada surah & ayat:
    // Ambil basis dari Target Hafalan hari ini (editQuranTarget)!
    if (!data) {
        let targetStr = document.getElementById('editQuranTarget')?.value.trim();
        data = ekstrakSurahDanAyat(targetStr);
    }

    // 3. Jika tetap belum ditemukan:
    if (!data) {
        data = { indexSurah: 0, ayat: 1 };
    }

    let surahIni = DATA_114_SURAH[data.indexSurah];
    let ayatBaru = data.ayat + (typeof aksi === 'number' ? aksi : 1);

    if (ayatBaru > surahIni.ayat) {
        let sisaAyat = ayatBaru - surahIni.ayat;
        if (data.indexSurah + 1 < DATA_114_SURAH.length) {
            let surahBerikut = DATA_114_SURAH[data.indexSurah + 1];
            textarea.value = 'Surah ' + surahBerikut.nama + ' ayat ' + sisaAyat;
        } else {
            textarea.value = 'Khatam! (An-Nas Selesai)';
        }
    } else {
        textarea.value = 'Surah ' + surahIni.nama + ' ayat ' + ayatBaru;
    }
};

window.pilihSetoranHarian = (status) => {
    document.getElementById('valSetoranHarian').value = status;
    document.querySelectorAll('.setoran-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-val') === status) btn.classList.add('active');
    });
    const badge = document.getElementById('badgeSetoranHarian');
    if (status === 'sudah') { badge.innerHTML = "✅ Alhamdulillah, Sudah Setor"; badge.style.cssText = "background:rgba(16,185,129,0.2);color:var(--success);border:1px solid rgba(16,185,129,0.5);"; }
    else if (status === 'berhalangan') { badge.innerHTML = "🛑 Berhalangan / Udzhur"; badge.style.cssText = "background:rgba(245,158,11,0.2);color:var(--warning);border:1px solid rgba(245,158,11,0.5);"; }
    else if (status === 'izin') { badge.innerHTML = "🏥 Izin / Sakit"; badge.style.cssText = "background:rgba(59,130,246,0.2);color:var(--mumtaz);border:1px solid rgba(59,130,246,0.5);"; }
    else { badge.innerHTML = "⏳ Belum Setor Hari Ini"; badge.style.cssText = "background:rgba(239,68,68,0.2);color:var(--danger);border:1px solid rgba(239,68,68,0.5);"; }
};

window.pilihGradeHadits = (grade) => {
    document.getElementById('editStatusHadits').value = grade;
    document.querySelectorAll('.hadits-pill-btn').forEach(btn => {
        if (btn.getAttribute('data-grade') === grade) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const container = document.getElementById('haditsDropdownContainer');
    if (container) container.style.display = 'block';

    window.populateGradeDropdown('hadits', grade);

    const defaultScore = { A: 95, B: 88, C: 78, D: 70 }[grade] || 88;
    window.updateHaditsNilai(defaultScore);
};

window.pilihGradeDoa = (grade) => {
    document.getElementById('editStatusDoa').value = grade;
    document.querySelectorAll('.doa-pill-btn').forEach(btn => {
        if (btn.getAttribute('data-grade') === grade) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const container = document.getElementById('doaDropdownContainer');
    if (container) container.style.display = 'block';

    window.populateGradeDropdown('doa', grade);

    const defaultScore = { A: 95, B: 88, C: 78, D: 70 }[grade] || 95;
    window.updateDoaNilai(defaultScore);
};

window.pilihGradeQuran = (grade) => {
    document.getElementById('editStatusQuran').value = grade;
    document.querySelectorAll('.grade-pill-quran, .grade-pill-btn:not(.hadits-pill-btn):not(.doa-pill-btn)').forEach(btn => {
        if (btn.getAttribute('data-grade') === grade) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const container = document.getElementById('customDropdownContainer');
    if (container) container.style.display = 'block';

    window.populateGradeDropdown('quran', grade);

    const defaultScore = { A: 95, B: 88, C: 78, D: 70 }[grade] || 95;
    window.updateNilaiManual(defaultScore);
};

// Handler untuk status "Tidak Setor Sama Sekali"
window.pilihTidakSetor = (subject) => {
    if (subject === 'quran') {
        document.getElementById('editStatusQuran').value = 'tidakSetor';
        document.getElementById('editQuranNilaiAngka').value = '';
        document.getElementById('customDropdownText').innerText = '❌ Tidak Setor';
        const container = document.getElementById('customDropdownContainer');
        const list = document.getElementById('customDropdownList');
        if (container) container.classList.remove('open');
        if (list) list.classList.remove('show');
        document.querySelectorAll('.grade-pill-quran, .grade-pill-btn:not(.hadits-pill-btn):not(.doa-pill-btn)').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    } else if (subject === 'hadits') {
        document.getElementById('editStatusHadits').value = 'tidakSetor';
        document.getElementById('editHaditsNilaiAngka').value = '';
        document.getElementById('haditsDropdownText').innerText = '❌ Tidak Setor';
        const container = document.getElementById('haditsDropdownContainer');
        const list = document.getElementById('haditsDropdownList');
        if (container) container.classList.remove('open');
        if (list) list.classList.remove('show');
        document.querySelectorAll('.hadits-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    } else if (subject === 'doa') {
        document.getElementById('editStatusDoa').value = 'tidakSetor';
        document.getElementById('editDoaNilaiAngka').value = '';
        document.getElementById('doaDropdownText').innerText = '❌ Tidak Setor';
        const container = document.getElementById('doaDropdownContainer');
        const list = document.getElementById('doaDropdownList');
        if (container) container.classList.remove('open');
        if (list) list.classList.remove('show');
        document.querySelectorAll('.doa-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    }
    window.pilihSetoranHarian('sudah');
};

window.updateHaditsNilai = (val) => {
    document.getElementById('editHaditsNilaiAngka').value = val;
    const el = document.getElementById('haditsDropdownText');
    if (el) el.innerText = val;
    document.getElementById('haditsDropdownList').querySelectorAll('.custom-dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.innerText == val);
    });
};

window.updateDoaNilai = (val) => {
    document.getElementById('editDoaNilaiAngka').value = val;
    const el = document.getElementById('doaDropdownText');
    if (el) el.innerText = val;
    document.getElementById('doaDropdownList').querySelectorAll('.custom-dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.innerText == val);
    });
};

window.updateNilaiManual = (val) => {
    document.getElementById('editQuranNilaiAngka').value = val;
    const textSpan = document.getElementById('customDropdownText');
    if (textSpan) textSpan.innerText = val;

    document.getElementById('customDropdownList').querySelectorAll('.custom-dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.innerText == val);
    });
};

window.toggleCustomDropdown = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const list = document.getElementById('customDropdownList');
    if (list && !list.children.length) {
        const activePill = document.querySelector('.grade-pill-quran.active');
        const g = activePill ? activePill.getAttribute('data-grade') : 'A';
        const curScore = document.getElementById('editQuranNilaiAngka')?.value;
        window.populateGradeDropdown('quran', g);
        if (curScore) window.updateNilaiManual(curScore);
    }
    const container = document.getElementById('customDropdownContainer');
    if (container) container.classList.toggle('open');
    if (list) list.classList.toggle('show');
};

window.selectCustomNilai = (val) => {
    window.updateNilaiManual(val);
    const container = document.getElementById('customDropdownContainer');
    const list = document.getElementById('customDropdownList');
    if (container) container.classList.remove('open');
    if (list) list.classList.remove('show');
};

window.toggleHaditsDropdown = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const list = document.getElementById('haditsDropdownList');
    if (list && !list.children.length) {
        const activePill = document.querySelector('.hadits-pill-btn.active');
        const g = activePill ? activePill.getAttribute('data-grade') : 'A';
        const curScore = document.getElementById('editHaditsNilaiAngka')?.value;
        window.populateGradeDropdown('hadits', g);
        if (curScore) window.updateHaditsNilai(curScore);
    }
    const container = document.getElementById('haditsDropdownContainer');
    if (container) container.classList.toggle('open');
    if (list) list.classList.toggle('show');
};

window.selectHaditsNilai = (val) => {
    window.updateHaditsNilai(val);
    const container = document.getElementById('haditsDropdownContainer');
    const list = document.getElementById('haditsDropdownList');
    if (container) container.classList.remove('open');
    if (list) list.classList.remove('show');
};

window.toggleDoaDropdown = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const list = document.getElementById('doaDropdownList');
    if (list && !list.children.length) {
        const activePill = document.querySelector('.doa-pill-btn.active');
        const g = activePill ? activePill.getAttribute('data-grade') : 'A';
        const curScore = document.getElementById('editDoaNilaiAngka')?.value;
        window.populateGradeDropdown('doa', g);
        if (curScore) window.updateDoaNilai(curScore);
    }
    const container = document.getElementById('doaDropdownContainer');
    if (container) container.classList.toggle('open');
    if (list) list.classList.toggle('show');
};

window.selectDoaNilai = (val) => {
    window.updateDoaNilai(val);
    const container = document.getElementById('doaDropdownContainer');
    const list = document.getElementById('doaDropdownList');
    if (container) container.classList.remove('open');
    if (list) list.classList.remove('show');
};

window.selectDoaNilai = (val) => {
    window.updateDoaNilai(val);
    const container = document.getElementById('doaDropdownContainer');
    const list = document.getElementById('doaDropdownList');
    container.classList.remove('open');
    list.classList.remove('show');
};

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
    ['custom', 'hadits', 'doa'].forEach(prefix => {
        const container = document.getElementById(prefix + 'DropdownContainer');
        if (container && !container.contains(event.target)) {
            container.classList.remove('open');
            const list = document.getElementById(prefix + 'DropdownList');
            if (list) list.classList.remove('show');
        }
    });
});

window.simpanDataMurid = async () => {
    if (!isAdmin) return;
    const btn = document.getElementById('btnSaveMurid'); btn.innerText = "Menyimpan...";
    try {
        const docId = document.getElementById('editId').value;
        const qStatus = document.getElementById('editStatusQuran').value;
        const qNilaiAngka = document.getElementById('editQuranNilaiAngka').value;
        const qRealisasi = document.getElementById('editQuranRealisasi').value;
        const namaMurid = document.getElementById('modalNama').innerText;
        const tglHariIni = window.getTanggalHariIni();

        // Ambil nilai yang ada di form (hasil dari sesi admin saat ini)
        const hStatusSave  = document.getElementById('editStatusHadits').value;
        const hNilaiSave   = document.getElementById('editHaditsNilaiAngka').value;
        const dStatusSave  = document.getElementById('editStatusDoa').value;
        const dNilaiSave   = document.getElementById('editDoaNilaiAngka').value;

        // Selalu simpan: setoranHarian, tanggalSetor master, dan semua target/realisasi
        // (target bisa diupdate kapan saja, tidak perlu ada grade dulu)
        const updatePayload = {
            setoranHarian: document.getElementById('valSetoranHarian').value,
            tanggalSetor: tglHariIni,   // master date untuk badge setoranHarian & glow kartu
            quranTarget:    document.getElementById('editQuranTarget').value,
            quranRealisasi: qRealisasi,
            haditsTarget:    document.getElementById('editHaditsTarget').value,
            haditsRealisasi: document.getElementById('editHaditsRealisasi').value,
            doaTarget:    document.getElementById('editDoaTarget').value,
            doaRealisasi: document.getElementById('editDoaRealisasi').value,
        };

        // ✅ Qur'an: grade & tanggal hanya disimpan jika admin mengisi (bukan 'belum')
        // Ini mencegah nilai Qur'an dari Kamis tertimpa saat admin isi Hadits di Jumat
        if (qStatus && qStatus !== 'belum') {
            updatePayload.quranStatus     = qStatus;
            updatePayload.quranNilaiAngka = qNilaiAngka;
            updatePayload.tanggalSetorQuran = tglHariIni;
        }

        // ✅ Hadits: grade & tanggal hanya disimpan jika admin mengisi
        if (hStatusSave && hStatusSave !== 'belum') {
            updatePayload.haditsStatus      = hStatusSave;
            updatePayload.haditsNilaiAngka  = hNilaiSave;
            updatePayload.tanggalSetorHadits = tglHariIni;
        }

        // ✅ Doa: grade & tanggal hanya disimpan jika admin mengisi
        if (dStatusSave && dStatusSave !== 'belum') {
            updatePayload.doaStatus     = dStatusSave;
            updatePayload.doaNilaiAngka = dNilaiSave;
            updatePayload.tanggalSetorDoa = tglHariIni;
        }

        await updateDoc(doc(db, koleksiMurid, docId), updatePayload);

        // Coba parsing surah dan ayat untuk spreadsheet
        let parsedSurah = "-";
        let parsedAyat = "-";
        if (qRealisasi && qRealisasi !== "-") {
            const matchSurah = qRealisasi.match(/Surah\s+([A-Za-z\-'\s]+?)(?:\s+ayat|\s*-\s*ayat|$)/i);
            const matchAyat = qRealisasi.match(/ayat\s*([0-9]+)/i);
            if (matchSurah && matchSurah[1]) {
                parsedSurah = matchSurah[1].trim();
            } else {
                const sObj = DATA_114_SURAH.find(s => qRealisasi.toLowerCase().includes(s.nama.toLowerCase()));
                if (sObj) parsedSurah = sObj.nama;
                else parsedSurah = qRealisasi.split('ayat')[0].replace(/^Surah\s+/i, '').trim();
            }
            if (matchAyat && matchAyat[1]) {
                parsedAyat = matchAyat[1].trim();
            } else {
                const anyNum = qRealisasi.match(/\b\d+\b/);
                if (anyNum) parsedAyat = anyNum[0];
            }
        }

        const haditsStatus = document.getElementById('editStatusHadits').value;
        const doaStatus = document.getElementById('editStatusDoa').value;

        // Webhook Push to Google Sheets (Background)
        // Hanya kirim ke spreadsheet jika admin menyematkan badge "Sudah Setor"
        const statusSetoranFinal = document.getElementById('valSetoranHarian').value;
        if (statusSetoranFinal === 'sudah') {
            const webhookUrl = "https://script.google.com/macros/s/AKfycbwfOfypie9Xrjf5xz1-v_L5rx5CcbbPBKMn2UUlqvXPFHd8tcWMZXgZ5SE9cF-0PiYt/exec";
            const dt = new Date();
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dt.getDay()];
            const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][dt.getMonth()];
            const tanggalStr = namaHari + ", " + ("0" + dt.getDate()).slice(-2) + " " + namaBulan; // e.g. "Selasa, 13 September"

            const payload = {
                kelas: window.kelasTarget,
                nama: namaMurid,
                surah: parsedSurah,
                ayat: parsedAyat,
                nilai: qNilaiAngka,
                qStatus: qStatus,
                haditsRealisasi: document.getElementById('editHaditsRealisasi').value,
                haditsNilai: document.getElementById('editHaditsNilaiAngka').value,
                haditsStatus: document.getElementById('editStatusHadits').value,
                doaRealisasi: document.getElementById('editDoaRealisasi').value,
                doaNilai: document.getElementById('editDoaNilaiAngka').value,
                doaStatus: document.getElementById('editStatusDoa').value,
                tanggalCari: tanggalStr, // Masih dikirim untuk cadangan
                hari: namaHari,
                tanggal: dt.getDate(),
                bulan: dt.getMonth() + 1,
                tahun: dt.getFullYear()
            };

            fetch(webhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            }).catch(e => console.log("Webhook error:", e));
        }

        btn.innerText = "Simpan Perubahan Dasbor"; window.closeModal('progressModal');
    } catch (error) { alert("Error: " + error.message); btn.innerText = "Simpan Perubahan Dasbor"; }
};

/* =========================================
   STATISTICS DASHBOARD LOGIC (BORDERLESS MAJESTIC)
   OPTIMIZED FOR 60FPS MOBILE PERFORMANCE
========================================= */

const StatAudioEngine = {
    init() {},
    play(_) {}
};

function getStudentInitials(name) {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

window.activeStatSubject = 'quran';
window._subjectBreakdownData = null;
window._statsDataCache = null;
window._lastStatsSignature = null;

window.openStatsModal = () => {
    const modal = document.getElementById('statsModal');
    if (!modal) return;
    StatAudioEngine.init();
    
    // Prevent background scrolling while modal is open on mobile
    document.body.style.overflow = 'hidden';
    
    // Construct or update DOM
    renderStatsChart();
    
    // Use requestAnimationFrame for a buttery 60fps GPU entrance
    requestAnimationFrame(() => {
        modal.classList.add('open');
    });
};

window.closeStatsModal = () => {
    const modal = document.getElementById('statsModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
};

window.switchStatSubject = (subj) => {
    window.closeAllTierDrawers();
    StatAudioEngine.play('tick');
    window.activeStatSubject = subj;

    ['quran', 'hadits', 'doa'].forEach(s => {
        const btn = document.getElementById(`btnStatSubj-${s}`);
        if (btn) {
            btn.classList.toggle('active', s === subj);
        }
    });

    window.renderStatistikSubject();
};

window.closeAllTierDrawers = () => {
    ['A', 'B', 'C', 'D', 'X'].forEach(tier => {
        const drawer = document.getElementById(`tierDrawer${tier}`);
        const arrow = document.getElementById(`tierArrow${tier}`);
        const row = document.getElementById(`tierRowContainer${tier}`);
        if (drawer) drawer.classList.remove('is-open');
        if (arrow) arrow.classList.remove('is-open');
        if (row) row.classList.remove(`active-${tier}`);
    });
};

window.toggleTierDrawer = (tier) => {
    const drawer = document.getElementById(`tierDrawer${tier}`);
    const arrow = document.getElementById(`tierArrow${tier}`);
    const row = document.getElementById(`tierRowContainer${tier}`);
    if (!drawer || !row) return;

    const isOpen = drawer.classList.contains('is-open');

    if (!isOpen) {
        drawer.classList.add('is-open');
        if (arrow) arrow.classList.add('is-open');
        row.classList.add(`active-${tier}`);
    } else {
        drawer.classList.remove('is-open');
        if (arrow) arrow.classList.remove('is-open');
        row.classList.remove(`active-${tier}`);
    }
};

window.renderStatistikSubject = () => {
    const data = window._subjectBreakdownData;
    const stats = window._statsDataCache;
    if (!data || !stats) return;

    const subj = window.activeStatSubject || 'quran';
    const subjData = data[subj] || { A: [], B: [], C: [], D: [], X: [] };
    const sudahCount = stats.sudahSetor.names.length;

    const subLabels = { quran: "Al-Qur'an", hadits: "Hadits", doa: "Doa" };
    const labelEl = document.getElementById('spectrumActiveLabel');
    if (labelEl) {
        labelEl.textContent = `${subLabels[subj] || subj} (${sudahCount} Anak)`;
    }

    const cA = subjData.A.length;
    const cB = subjData.B.length;
    const cC = subjData.C.length;
    const cD = subjData.D.length;
    const cX = subjData.X.length;

    const pA = sudahCount > 0 ? (cA / sudahCount) * 100 : 0;
    const pB = sudahCount > 0 ? (cB / sudahCount) * 100 : 0;
    const pC = sudahCount > 0 ? (cC / sudahCount) * 100 : 0;
    const pD = sudahCount > 0 ? (cD / sudahCount) * 100 : 0;
    const pX = sudahCount > 0 ? (cX / sudahCount) * 100 : 0;

    const sA = document.getElementById('specBarA');
    const sB = document.getElementById('specBarB');
    const sC = document.getElementById('specBarC');
    const sD = document.getElementById('specBarD');
    const sX = document.getElementById('specBarX');

    if (sA) sA.style.width = `${pA}%`;
    if (sB) sB.style.width = `${pB}%`;
    if (sC) sC.style.width = `${pC}%`;
    if (sD) sD.style.width = `${pD}%`;
    if (sX) sX.style.width = `${pX}%`;

    const renderChips = (names, themeCls) => {
        if (!names || names.length === 0) {
            return '<span style="font-size:10px; color:rgba(255,255,255,0.3); font-style:italic; padding:4px 0; text-align:center; width:100%; display:block;">✨ Tidak ada ananda di kategori ini.</span>';
        }
        return names.map(n => `<span class="stat-chip-btn ${themeCls}">${n}</span>`).join('');
    };

    const lA = document.getElementById('tierListA');
    const lB = document.getElementById('tierListB');
    const lC = document.getElementById('tierListC');
    const lD = document.getElementById('tierListD');
    const lX = document.getElementById('tierListX');

    if (lA) lA.innerHTML = renderChips(subjData.A, 'chip-theme-a');
    if (lB) lB.innerHTML = renderChips(subjData.B, 'chip-theme-b');
    if (lC) lC.innerHTML = renderChips(subjData.C, 'chip-theme-c');
    if (lD) lD.innerHTML = renderChips(subjData.D, 'chip-theme-d');
    if (lX) lX.innerHTML = renderChips(subjData.X, 'chip-theme-x');
};

function renderStatsChart() {
    const container = document.getElementById('statsChartContainer');
    if (!container) return;
    const hariIni = window.getTanggalHariIni();

    const totalMurid = dataMuridDinamis.length;
    if (totalMurid === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 20px;font-size:13px;">Belum ada data murid untuk kelas ini.</div>';
        return;
    }

    // Memoization check: if data has not changed and container is already rendered, skip re-parsing HTML
    const dataSig = `${window.kelasTarget}_${hariIni}_` + dataMuridDinamis.map(m => `${m.id || ''}:${m.tanggalSetor || ''}:${m.setoranHarian || ''}:${m.quranStatus || ''}:${m.haditsStatus || ''}:${m.doaStatus || ''}`).join(';');
    if (window._lastStatsSignature === dataSig && container.innerHTML.trim().length > 0) {
        window.renderStatistikSubject();
        window.closeAllTierDrawers();
        return;
    }
    window._lastStatsSignature = dataSig;

    const stats = {
        sudahSetor:   { names: [], muridList: [] },
        izin:         { names: [] },
        berhalangan:  { names: [] },
        belumHariIni: { names: [] },
    };

    dataMuridDinamis.forEach(murid => {
        const sudahDinilaiHariIni = (murid.tanggalSetor === hariIni);
        const setoranHarian = murid.setoranHarian || 'belum';

        if (sudahDinilaiHariIni && setoranHarian === 'sudah') {
            stats.sudahSetor.names.push(murid.nama);
            stats.sudahSetor.muridList.push(murid);
        } else if (sudahDinilaiHariIni && setoranHarian === 'izin') {
            stats.izin.names.push(murid.nama);
        } else if (sudahDinilaiHariIni && setoranHarian === 'berhalangan') {
            stats.berhalangan.names.push(murid.nama);
        } else {
            stats.belumHariIni.names.push(murid.nama);
        }
    });

    const buildSubjectData = (muridList) => {
        const subjectMap = {
            quran:  { Q: 'quranStatus',  A: [], B: [], C: [], D: [], X: [] },
            hadits: { Q: 'haditsStatus', A: [], B: [], C: [], D: [], X: [] },
            doa:    { Q: 'doaStatus',    A: [], B: [], C: [], D: [], X: [] },
        };
        muridList.forEach(murid => {
            ['quran', 'hadits', 'doa'].forEach(subj => {
                const statusRaw = murid[subjectMap[subj].Q] || '';
                if (statusRaw === 'tidakSetor') {
                    subjectMap[subj].X.push(murid.nama);
                } else {
                    const grade = ['A', 'B', 'C', 'D'].includes(statusRaw) ? statusRaw : 'D';
                    subjectMap[subj][grade].push(murid.nama);
                }
            });
        });
        return {
            quran:  subjectMap.quran,
            hadits: subjectMap.hadits,
            doa:    subjectMap.doa,
        };
    };

    window._subjectBreakdownData = buildSubjectData(stats.sudahSetor.muridList);
    window._statsDataCache = stats;

    const sudah = stats.sudahSetor.names.length;
    const izin = stats.izin.names.length;
    const berhalangan = stats.berhalangan.names.length;
    const belum = stats.belumHariIni.names.length;
    const pct = Math.round((sudah / totalMurid) * 100);

    const circumference = 314.16; // 2 * PI * 50
    const offset = circumference - (pct / 100) * circumference;

    const kelasTag = (window.kelasTarget ? `KELAS ${window.kelasTarget.toUpperCase()}` : 'SDIT IHSANUL AMAL') + ' · REKAP LIVE';

    // Attendance summary bottom section
    let bottomAttendanceHtml = '';
    if (izin === 0 && berhalangan === 0 && belum === 0) {
        bottomAttendanceHtml = `
            <div class="stats-bottom-attendance">
                <div class="stats-banner-perfect">
                    <span>✨</span>
                    <span>Seluruh ${totalMurid} ananda hadir & telah menyetorkan hafalan hari ini.</span>
                </div>
            </div>
        `;
    } else {
        bottomAttendanceHtml = '<div class="stats-bottom-attendance">';
        if (izin > 0) {
            bottomAttendanceHtml += `
                <div class="stats-absent-row">
                    <span style="color:#60a5fa; flex-shrink:0; margin-top:2px;">🏥</span>
                    <div style="flex:1;">
                        <span style="color:#cbd5e1; font-weight:700;">Izin / Sakit (${izin} anak):</span>
                        <div class="stats-absent-chips">
                            ${stats.izin.names.map(n => `
                                <span class="stat-chip-btn chip-theme-izin">${n}</span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        if (berhalangan > 0) {
            bottomAttendanceHtml += `
                <div class="stats-absent-row">
                    <span style="color:#fbbf24; flex-shrink:0; margin-top:2px;">🛑</span>
                    <div style="flex:1;">
                        <span style="color:#cbd5e1; font-weight:700;">Berhalangan (${berhalangan} anak):</span>
                        <div class="stats-absent-chips">
                            ${stats.berhalangan.names.map(n => `
                                <span class="stat-chip-btn chip-theme-berhalangan">${n}</span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        if (belum > 0) {
            bottomAttendanceHtml += `
                <div class="stats-absent-row">
                    <span style="color:#f87171; flex-shrink:0; margin-top:2px;">⏳</span>
                    <div style="flex:1;">
                        <span style="color:#cbd5e1; font-weight:700;">Belum Setor (${belum} anak):</span>
                        <div class="stats-absent-chips">
                            ${stats.belumHariIni.names.map(n => `
                                <span class="stat-chip-btn chip-theme-belum">${n}</span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        bottomAttendanceHtml += '</div>';
    }

    container.innerHTML = `
        <!-- HEADER MODAL STATISTIK -->
        <div class="stats-header-wrap">
            <div class="stats-live-tag">
                <span class="stats-live-dot"></span>
                <span>${kelasTag}</span>
            </div>
            <h2 class="stats-header-title">
                Statistik Hari Ini
            </h2>
            <p class="stats-header-sub">
                Rekapitulasi Kualitas Mutaba'ah & Kelancaran Ananda
            </p>
        </div>

        <!-- HERO SEAMLESS: RING GAUGE DENGAN NAFAS LEGA -->
        <div class="stats-hero-row">
            <!-- Circular Completion Ring -->
            <div class="stats-ring-box">
                <svg class="stats-ring-svg" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.06)" stroke-width="5" fill="transparent" />
                    <circle id="heroRingCircle" cx="60" cy="60" r="50" stroke="url(#cleanRingGrad)" stroke-width="5" stroke-linecap="round" fill="transparent" stroke-dasharray="314.16" stroke-dashoffset="${offset}" style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);" />
                    <defs>
                        <linearGradient id="cleanRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#34d399" />
                            <stop offset="60%" stop-color="#fef08a" />
                            <stop offset="100%" stop-color="#d4af37" />
                        </linearGradient>
                    </defs>
                </svg>
                <div class="stats-ring-center">
                    <span class="stats-ring-pct">${pct}%</span>
                    <span class="stats-ring-sub">${pct === 100 ? 'TUNTAS' : 'SEBAGIAN'}</span>
                </div>
            </div>

            <!-- Attendance Stats Grid -->
            <div class="stats-counter-grid">
                <div class="stats-counter-item">
                    <div class="stats-counter-icon stats-icon-sudah">✅</div>
                    <div class="stats-counter-info">
                        <span class="stats-counter-title">Sudah Setor</span>
                        <span class="stats-counter-num stats-num-highlight">${sudah} <span class="stats-counter-unit">anak</span></span>
                    </div>
                </div>
                <div class="stats-counter-item">
                    <div class="stats-counter-icon stats-icon-neutral">🏥</div>
                    <div class="stats-counter-info">
                        <span class="stats-counter-title">Izin / Sakit</span>
                        <span class="stats-counter-num stats-num-dim">${izin} <span class="stats-counter-unit">anak</span></span>
                    </div>
                </div>
                <div class="stats-counter-item">
                    <div class="stats-counter-icon stats-icon-neutral">🛑</div>
                    <div class="stats-counter-info">
                        <span class="stats-counter-title">Berhalangan</span>
                        <span class="stats-counter-num stats-num-dim">${berhalangan} <span class="stats-counter-unit">anak</span></span>
                    </div>
                </div>
                <div class="stats-counter-item">
                    <div class="stats-counter-icon stats-icon-neutral">⏳</div>
                    <div class="stats-counter-info">
                        <span class="stats-counter-title">Belum Setor</span>
                        <span class="stats-counter-num stats-num-dim">${belum} <span class="stats-counter-unit">anak</span></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- SUBJECT SWITCHER DECK -->
        <div class="stats-subj-deck">
            <button type="button" onclick="window.switchStatSubject('quran')" id="btnStatSubj-quran" class="stats-subj-btn ${window.activeStatSubject === 'quran' ? 'active' : ''}">
                <span>📖</span> Al-Qur'an
            </button>
            <button type="button" onclick="window.switchStatSubject('hadits')" id="btnStatSubj-hadits" class="stats-subj-btn ${window.activeStatSubject === 'hadits' ? 'active' : ''}">
                <span>📜</span> Hadits
            </button>
            <button type="button" onclick="window.switchStatSubject('doa')" id="btnStatSubj-doa" class="stats-subj-btn ${window.activeStatSubject === 'doa' ? 'active' : ''}">
                <span>🤲</span> Doa
            </button>
        </div>

        <!-- LUMINOUS SPECTRUM BAR -->
        <div class="stats-spectrum-wrap">
            <div class="stats-spectrum-header">
                <span class="stats-spectrum-title">
                    <span>📊</span> Sebaran Kelancaran
                </span>
                <span id="spectrumActiveLabel" class="stats-spectrum-tag">Memuat...</span>
            </div>

            <!-- Slim Spectrum Track -->
            <div class="stats-spectrum-track">
                <div id="specBarA" style="width: 0%;" class="stats-spectrum-seg stats-seg-a" title="Mumtaz"></div>
                <div id="specBarB" style="width: 0%;" class="stats-spectrum-seg stats-seg-b" title="Jayyid Jiddan"></div>
                <div id="specBarC" style="width: 0%;" class="stats-spectrum-seg stats-seg-c" title="Jayyid"></div>
                <div id="specBarD" style="width: 0%;" class="stats-spectrum-seg stats-seg-d" title="Muraja'ah"></div>
                <div id="specBarX" style="width: 0%;" class="stats-spectrum-seg stats-seg-x" title="Tidak Setor"></div>
            </div>

            <!-- Legend Minimalis -->
            <div class="stats-spectrum-legend">
                <span class="stats-legend-item stats-legend-mumtaz"><span class="stats-legend-dot"></span> Mumtaz</span>
                <span class="stats-legend-item stats-legend-jiddan"><span class="stats-legend-dot"></span> J. Jiddan</span>
                <span class="stats-legend-item stats-legend-jayyid"><span class="stats-legend-dot"></span> Jayyid</span>
                <span class="stats-legend-item stats-legend-murajaah"><span class="stats-legend-dot"></span> Muraja'ah</span>
                <span class="stats-legend-item stats-legend-tdk"><span class="stats-legend-dot"></span> Tdk Setor</span>
            </div>
        </div>

        <!-- DAFTAR KLASIFIKASI KELANCARAN (CENTERED & DEFAULT TERTUTUP) -->
        <div class="stats-tiers-container" id="tierCardsContainer">
            <!-- ROW 1: MUMTAZ (SAPPHIRE BLUE) -->
            <div id="tierRowContainerA" class="tier-row-container">
                <div onclick="window.toggleTierDrawer('A')" class="tier-click-target">
                    <div class="tier-title-line tier-title-A">
                        <span class="tier-icon-sparkle">🌟</span>
                        <span>Mumtaz</span>
                        <span class="tier-qualifier">(Sangat Lancar)</span>
                        <span id="tierArrowA" class="tier-arrow-indicator">▼</span>
                    </div>
                    <div class="tier-desc-line tier-desc-A">
                        Fasih, Tajwid & Makhraj Sempurna
                    </div>
                </div>
                <div id="tierDrawerA" class="tier-drawer-wrapper">
                    <div id="tierListA" class="tier-chips-deck border-top-A"></div>
                </div>
            </div>

            <!-- ROW 2: JAYYID JIDDAN (EMERALD GREEN) -->
            <div id="tierRowContainerB" class="tier-row-container">
                <div onclick="window.toggleTierDrawer('B')" class="tier-click-target">
                    <div class="tier-title-line tier-title-B">
                        <span class="tier-icon-sparkle">✨</span>
                        <span>Jayyid Jiddan</span>
                        <span class="tier-qualifier">(Lancar)</span>
                        <span id="tierArrowB" class="tier-arrow-indicator">▼</span>
                    </div>
                    <div class="tier-desc-line tier-desc-B">
                        Lancar & Terbimbing Mandiri
                    </div>
                </div>
                <div id="tierDrawerB" class="tier-drawer-wrapper">
                    <div id="tierListB" class="tier-chips-deck border-top-B"></div>
                </div>
            </div>

            <!-- ROW 3: JAYYID (AMBER GOLD) -->
            <div id="tierRowContainerC" class="tier-row-container">
                <div onclick="window.toggleTierDrawer('C')" class="tier-click-target">
                    <div class="tier-title-line tier-title-C">
                        <span class="tier-icon-sparkle">📖</span>
                        <span>Jayyid</span>
                        <span class="tier-qualifier">(Cukup Lancar)</span>
                        <span id="tierArrowC" class="tier-arrow-indicator">▼</span>
                    </div>
                    <div class="tier-desc-line tier-desc-C">
                        Cukup Lancar, Terus Dimantapkan
                    </div>
                </div>
                <div id="tierDrawerC" class="tier-drawer-wrapper">
                    <div id="tierListC" class="tier-chips-deck border-top-C"></div>
                </div>
            </div>

            <!-- ROW 4: MURAJA'AH (CORAL ROSE) -->
            <div id="tierRowContainerD" class="tier-row-container">
                <div onclick="window.toggleTierDrawer('D')" class="tier-click-target">
                    <div class="tier-title-line tier-title-D">
                        <span class="tier-icon-sparkle">🔄</span>
                        <span>Muraja'ah</span>
                        <span class="tier-qualifier">(Perlu Bimbingan)</span>
                        <span id="tierArrowD" class="tier-arrow-indicator">▼</span>
                    </div>
                    <div class="tier-desc-line tier-desc-D">
                        Perlu Pengulangan Rutin Bersama Guru
                    </div>
                </div>
                <div id="tierDrawerD" class="tier-drawer-wrapper">
                    <div id="tierListD" class="tier-chips-deck border-top-D"></div>
                </div>
            </div>

            <!-- ROW 5: TIDAK SETOR SAMA SEKALI (CRIMSON RED) -->
            <div id="tierRowContainerX" class="tier-row-container">
                <div onclick="window.toggleTierDrawer('X')" class="tier-click-target">
                    <div class="tier-title-line tier-title-X">
                        <span class="tier-icon-sparkle">🚫</span>
                        <span>Tidak Setor Sama Sekali</span>
                        <span id="tierArrowX" class="tier-arrow-indicator">▼</span>
                    </div>
                    <div class="tier-desc-line tier-desc-X">
                        Hadir Hari Ini · Belum Menyetorkan Subjek Ini
                    </div>
                </div>
                <div id="tierDrawerX" class="tier-drawer-wrapper">
                    <div id="tierListX" class="tier-chips-deck border-top-X"></div>
                </div>
            </div>
        </div>

        <!-- STATUS KEHADIRAN & CATATAN AKHIR -->
        ${bottomAttendanceHtml}
    `;

    // Populate active subject and ensure all drawers start closed by default
    window.renderStatistikSubject();
    window.closeAllTierDrawers();
}

// Backward compatibility stubs
window.switchStatsTab = () => renderStatsChart();
window.toggleStatList = (id) => {};
window.toggleSubGrade = (id) => {};
window.switchSubBreakdown = (subj, btn) => window.switchStatSubject(subj);
