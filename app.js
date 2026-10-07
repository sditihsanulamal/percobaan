import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, persistentLocalCache, collection, onSnapshot, getDocs, doc, setDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
// Strategi 1: Aktifkan offline persistence — data di-cache di browser, hemat read saat refresh
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
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
}

function handleMuridSnapshot(snapshot) {
    if (!snapshot.empty) {
        dataMuridDinamis = [];
        snapshot.forEach((docSnap) => { dataMuridDinamis.push({ id: docSnap.id, ...docSnap.data() }); });
        dataMuridDinamis.sort((a, b) => a.nama.localeCompare(b.nama));
        window.renderMurid();
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

    if (isAdmin) {
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
        cards.push('<div class="glass-panel murid-card ' + glowClass + '" onclick="window.openModal(' + index + ')">'
            + '<div class="avatar">' + window.getInitials(murid.nama) + '</div>'
            + '<div class="murid-info">'
            + '<div class="murid-nama">' + murid.nama + '</div>'
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

window.openModal = (index) => {
    const murid = dataMuridDinamis[index];
    document.getElementById('modalNama').innerText = murid.nama;
    document.getElementById('modalInitials').innerText = window.getInitials(murid.nama);
    document.getElementById('editId').value = murid.id;

    const hariIni = window.getTanggalHariIni();

    // ✅ SETIAP mata pelajaran punya tanggal setor sendiri.
    // Qur'an bisa reset setiap hari, Hadits/Doa hanya reset di hari Jumat.
    // Ini mencegah nilai lama terhapus hanya karena mata pelajaran lain diisi.
    const sudahSetorQuranHariIni  = (murid.tanggalSetorQuran  || murid.tanggalSetor || '') === hariIni;
    const sudahSetorHaditsHariIni = (murid.tanggalSetorHadits || murid.tanggalSetor || '') === hariIni;
    const sudahSetorDoaHariIni    = (murid.tanggalSetorDoa    || murid.tanggalSetor || '') === hariIni;

    // Master flag untuk badge setoranHarian (sesuai tanggalSetor utama)
    const sudahDinilaiHariIni = (murid.tanggalSetor === hariIni);

    // Mode admin: nilai per subjek hanya tampil jika tanggal subjek tersebut = hari ini
    const qStatus    = isAdmin ? (sudahSetorQuranHariIni  ? (murid.quranStatus  || 'belum') : 'belum') : (murid.quranStatus  || 'belum');
    const qNilaiAngka= isAdmin ? (sudahSetorQuranHariIni  ? (murid.quranNilaiAngka  || '') : '') : (murid.quranNilaiAngka  || '');
    const hStatus    = isAdmin ? (sudahSetorHaditsHariIni ? (murid.haditsStatus || 'belum') : 'belum') : (murid.haditsStatus || 'belum');
    const hNilaiAngka= isAdmin ? (sudahSetorHaditsHariIni ? (murid.haditsNilaiAngka || '') : '') : (murid.haditsNilaiAngka || '');
    const dStatus    = isAdmin ? (sudahSetorDoaHariIni    ? (murid.doaStatus    || 'belum') : 'belum') : (murid.doaStatus    || 'belum');
    const dNilaiAngka= isAdmin ? (sudahSetorDoaHariIni    ? (murid.doaNilaiAngka    || '') : '') : (murid.doaNilaiAngka    || '');

    // Alias untuk mode publik (wali murid) — sama dengan nilai di DB
    const qStatusPublik = murid.quranStatus || 'belum';
    const qNilaiAngkaPublik = murid.quranNilaiAngka || '';
    const hStatusPublik = murid.haditsStatus || 'belum';
    const hNilaiAngkaPublik = murid.haditsNilaiAngka || '';
    const dStatusPublik = murid.doaStatus || 'belum';
    const dNilaiAngkaPublik = murid.doaNilaiAngka || '';

    const statusHarian = sudahDinilaiHariIni ? (murid.setoranHarian || 'belum') : 'belum';

    window.pilihSetoranHarian(statusHarian);
    document.getElementById('editQuranTarget').value = murid.quranTarget || "";
    document.getElementById('editQuranRealisasi').value = murid.quranRealisasi || "-";
    document.getElementById('editStatusQuran').value = qStatus;

    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(qStatus) && qStatus !== 'belum') {
        if (qStatus === 'tidakSetor') {
            window.pilihTidakSetor('quran');
        } else {
            window.pilihGradeQuran(qStatus);
            if (qNilaiAngka) window.updateNilaiManual(qNilaiAngka);
        }
    } else if (isAdmin) {
        document.querySelectorAll('.grade-pill-btn:not(.hadits-pill-btn):not(.doa-pill-btn)').forEach(btn => btn.classList.remove('active'));
        document.getElementById('customDropdownContainer').style.display = 'none';
    }

    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(hStatus) && hStatus !== 'belum') {
        if (hStatus === 'tidakSetor') {
            window.pilihTidakSetor('hadits');
        } else {
            window.pilihGradeHadits(hStatus);
            if (hNilaiAngka) window.updateHaditsNilai(hNilaiAngka);
        }
    } else if (isAdmin) {
        document.querySelectorAll('.hadits-pill-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('haditsDropdownContainer').style.display = 'none';
    }

    if (isAdmin && ['A', 'B', 'C', 'D', 'tidakSetor'].includes(dStatus) && dStatus !== 'belum') {
        if (dStatus === 'tidakSetor') {
            window.pilihTidakSetor('doa');
        } else {
            window.pilihGradeDoa(dStatus);
            if (dNilaiAngka) window.updateDoaNilai(dNilaiAngka);
        }
    } else if (isAdmin) {
        document.querySelectorAll('.doa-pill-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('doaDropdownContainer').style.display = 'none';
    }

    // Badge: admin pakai nilai hari ini (bisa kosong), publik pakai nilai permanen
    setBadge('badgeQuran', isAdmin ? qStatus : qStatusPublik, isAdmin ? qNilaiAngka : qNilaiAngkaPublik);
    document.getElementById('editHaditsTarget').value = murid.haditsTarget || "";
    document.getElementById('editHaditsRealisasi').value = murid.haditsRealisasi || "-";
    document.getElementById('editStatusHadits').value = hStatus;
    setBadge('badgeHadits', isAdmin ? hStatus : hStatusPublik, isAdmin ? hNilaiAngka : hNilaiAngkaPublik);
    document.getElementById('editDoaTarget').value = murid.doaTarget || "";
    document.getElementById('editDoaRealisasi').value = murid.doaRealisasi || "-";
    document.getElementById('editStatusDoa').value = dStatus;
    setBadge('badgeDoa', isAdmin ? dStatus : dStatusPublik, isAdmin ? dNilaiAngka : dNilaiAngkaPublik);
    document.getElementById('progressModal').classList.add('open');

    const inputs = document.querySelectorAll('#progressModal textarea.admin-input');
    const selects = document.querySelectorAll('#progressModal .admin-select-status');
    const badges = document.querySelectorAll('#progressModal .status-badge, #progressModal .dot');

    if (isAdmin) {
        inputs.forEach(i => { i.disabled = false; i.style.height = "auto"; });
        selects.forEach(s => { s.style.display = (s.id === 'quranGradeContainer' || s.id === 'haditsChips' || s.id === 'doaChips') ? 'flex' : 'block'; });
        badges.forEach(b => b.style.display = 'none');
        document.getElementById('btnSaveMurid').style.display = 'block';
        document.getElementById('quranChips').style.display = 'flex';
        document.getElementById('adminSetoranHarianContainer').style.display = 'flex';
    } else {
        inputs.forEach(i => { i.disabled = true; i.style.height = 'auto'; setTimeout(() => { i.style.height = (i.scrollHeight + 2) + 'px'; }, 50); });
        selects.forEach(s => s.style.display = 'none');
        badges.forEach(b => b.style.display = 'block');
        document.getElementById('btnSaveMurid').style.display = 'none';
        document.getElementById('quranChips').style.display = 'none';
        document.getElementById('adminSetoranHarianContainer').style.display = 'none';
    }
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
        let html = '<div style="display:flex; flex-direction:column; gap:16px;">';
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;">'
                + '<div style="font-weight:700;color:var(--gold);margin-bottom:12px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">'
                + D + ' - <span style="color:#fff;">' + (fields[d + '_nama'] || '-') + '</span></div>'
                + '<div style="display:flex;flex-direction:column;gap:10px;">'
                + '<div><div style="font-size:11px;color:var(--text-muted);">☀️ Pagi</div><div style="font-size:14px;font-weight:600;color:#fff;">' + (fields[d + '_pagi'] || '-') + '</div></div>'
                + '<div><div style="font-size:11px;color:var(--text-muted);">🌙 Sore</div><div style="font-size:14px;font-weight:600;color:#fff;">' + (fields[d + '_sore'] || '-') + '</div></div>'
                + '</div></div>';
        });
        return html + '</div>';

    } else if (id === 'target-quran') {
        return '<div style="text-align:center;padding:15px 10px;">'
            + '<div style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">Mohon Sambil Buka Al-Qur\'an, ya 😇</div>'
            + '<div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;font-family:\'Lora\',serif;">' + (fields.surah || '-') + '</div>'
            + '<div style="color:var(--gold);font-size:16px;font-weight:600;margin-bottom:20px;">' + (fields.ayat || '') + '</div>'
            + buatAudioPlayer(fields.audio)
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
        const jmlRakaat = window.getJumlahRakaat();
        let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;">'
                + '<div style="font-weight:700;color:var(--gold);margin-bottom:12px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">'
                + D + ' - <span style="color:#fff;">' + (fields[d + '_nama'] || '-') + '</span></div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

            for (let r = 1; r <= jmlRakaat; r++) {
                html += '<div><div style="font-size:11px;color:var(--text-muted);">Raka\'at ' + r + '</div><div style="font-size:13px;font-weight:600;">' + (fields[d + '_r' + r] || '-') + '</div></div>';
            }

            html += '</div></div>';
        });
        return html + '</div>';
    } else if (id === 'jadwal-tilawah') {
        let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
        for (let i = 1; i <= 3; i++) {
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;border-left:4px solid var(--gold);">'
                + '<div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px;">' + (fields['h' + i] || '') + '</div>'
                + '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:2px;">' + (fields['n' + i] || '') + '</div>'
                + '<div style="font-size:14px;color:var(--text-muted);">' + (fields['s' + i] || '') + '</div></div>';
        }
        return html + '<div style="margin-top:10px;padding:16px;background:rgba(253,224,71,0.1);border-radius:16px;">'
            + '<div style="color:var(--gold);font-weight:700;margin-bottom:8px;font-size:13px;">📝 Catatan:</div>'
            + '<ul style="color:#fff;font-size:13px;margin-left:20px;line-height:1.6;opacity:0.9;">'
            + '<li>Pembacaan Al-Qur\'an dengan nada Hijaz.</li>'
            + '<li>Waktu: 12.00 - 12.20 (20 menit).</li>'
            + '</ul></div></div>';
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

    if (id === 'jadwal-murajaah' && document.getElementById('murajaah-fields-container').innerHTML === '') {
        let h = '';
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
            const Day = day.charAt(0).toUpperCase() + day.slice(1);
            h += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">'
                + '<div class="detail-label" style="margin-bottom:12px;color:white;">Hari ' + Day + '</div>'
                + '<input type="text" id="fm-' + day + '-nama" class="admin-input" placeholder="Nama Pemimpin" style="margin-bottom:10px;">'
                + '<input type="text" id="fm-' + day + '-pagi" class="admin-input" placeholder="Muraja\'ah Pagi" style="margin-bottom:10px;">'
                + '<input type="text" id="fm-' + day + '-sore" class="admin-input" placeholder="Muraja\'ah Sore">'
                + '</div>';
        });
        document.getElementById('murajaah-fields-container').innerHTML = h;
    }

    if (id === 'jadwal-imam' && document.getElementById('imam-fields-container').innerHTML === '') {
        const jmlRakaat = window.getJumlahRakaat();
        let h = '';
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
            const Day = day.charAt(0).toUpperCase() + day.slice(1);
            h += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">'
                + '<div class="detail-label" style="margin-bottom:12px;color:white;">Hari ' + Day + '</div>'
                + '<input type="text" id="fi-' + day + '-nama" class="admin-input" placeholder="Nama Imam" style="margin-bottom:10px;">'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

            for (let r = 1; r <= jmlRakaat; r++) {
                h += '<input type="text" id="fi-' + day + '-r' + r + '" class="admin-input" placeholder="Rakaat ' + r + '" style="font-size:13px;">';
            }

            h += '</div></div>';
        });
        document.getElementById('imam-fields-container').innerHTML = h;
    }

    if (id === 'jadwal-tilawah' && document.getElementById('form-jadwal-tilawah').innerHTML === '') {
        let h = '';
        for (let i = 1; i <= 3; i++) {
            h += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.05);">'
                + '<div class="detail-label" style="margin-bottom:8px;">Jadwal ' + i + '</div>'
                + '<input type="text" id="ft-h' + i + '" class="admin-input" placeholder="Hari/Tgl" style="margin-bottom:8px;">'
                + '<input type="text" id="ft-n' + i + '" class="admin-input" placeholder="Nama Santri" style="margin-bottom:8px;">'
                + '<input type="text" id="ft-s' + i + '" class="admin-input" placeholder="Surah">'
                + '</div>';
        }
        document.getElementById('form-jadwal-tilawah').innerHTML = h;
    }

    if (isAdmin) {
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
                document.getElementById('fm-' + day + '-nama').value = f[day + '_nama'] || '';
                document.getElementById('fm-' + day + '-pagi').value = f[day + '_pagi'] || '';
                document.getElementById('fm-' + day + '-sore').value = f[day + '_sore'] || '';
            });
        } else if (id === 'target-quran') {
            document.getElementById('fq-surah').value = f.surah || '';
            document.getElementById('fq-ayat').value = f.ayat || '';
            document.getElementById('fq-audio').value = f.audio || '';
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
                document.getElementById('ft-h' + i).value = f['h' + i] || '';
                document.getElementById('ft-n' + i).value = f['n' + i] || '';
                document.getElementById('ft-s' + i).value = f['s' + i] || '';
            }
        } else if (id === 'jadwal-imam') {
            const jmlRakaat = window.getJumlahRakaat();
            ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
                document.getElementById('fi-' + day + '-nama').value = f[day + '_nama'] || '';
                for (let r = 1; r <= jmlRakaat; r++) {
                    const inputEl = document.getElementById('fi-' + day + '-r' + r);
                    if (inputEl) inputEl.value = f[day + '_r' + r] || '';
                }
            });
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
            surah: document.getElementById('fq-surah').value,
            ayat: document.getElementById('fq-ayat').value,
            audio: document.getElementById('fq-audio').value
        };
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
            const targetGabungan = newFields.surah + ' - ' + newFields.ayat;
            dataMuridDinamis.forEach((murid) => {
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

const dbQuran = "Al-Fatihah:7,Al-Baqarah:286,Ali 'Imran:200,An-Nisa:176,Al-Ma'idah:120,Al-An'am:165,Al-A'raf:206,Al-Anfal:75,At-Taubah:129,Yunus:109,Hud:123,Yusuf:111,Ar-Ra'd:43,Ibrahim:52,Al-Hijr:99,An-Nahl:128,Al-Isra':111,Al-Kahf:110,Maryam:98,Taha:135,Al-Anbiya':112,Al-Hajj:78,Al-Mu'minun:118,An-Nur:64,Al-Furqan:77,Asy-Syu'ara':227,An-Naml:93,Al-Qasas:88,Al-'Ankabut:69,Ar-Rum:60,Luqman:34,As-Sajdah:30,Al-Ahzab:73,Saba':54,Fatir:45,Yasin:83,As-Saffat:182,Sad:88,Az-Zumar:75,Ghafir:85,Fussilat:54,Asy-Syura:53,Az-Zukhruf:89,Ad-Dukhan:59,Al-Jasiyah:37,Al-Ahqaf:35,Muhammad:38,Al-Fath:29,Al-Hujurat:18,Qaf:45,Az-Zariyat:60,At-Tur:49,An-Najm:62,Al-Qamar:55,Ar-Rahman:78,Al-Waqi'ah:96,Al-Hadid:29,Al-Mujadilah:22,Al-Hasyr:24,Al-Mumtahanah:13,As-Saff:14,Al-Jumu'ah:11,Al-Munafiqun:11,At-Tagabun:18,At-Talaq:12,At-Tahrim:12,Al-Mulk:30,Al-Qalam:52,Al-Haqqah:52,Al-Ma'arij:44,Nuh:28,Al-Jinn:28,Al-Muzzammil:20,Al-Muddassir:56,Al-Qiyamah:40,Al-Insan:31,Al-Mursalat:50,An-Naba':40,An-Nazi'at:46,'Abasa:42,At-Takwir:29,Al-Infitar:19,Al-Mutaffifin:36,Al-Insyiqaq:25,Al-Buruj:22,At-Tariq:17,Al-A'la:19,Al-Gasyiyah:26,Al-Fajr:30,Al-Balad:20,Asy-Syams:15,Al-Lail:21,Ad-Duha:11,Asy-Syarh:8,At-Tin:8,Al-'Alaq:19,Al-Qadr:5,Al-Bayyinah:8,Az-Zalzalah:8,Al-'Adiyat:11,Al-Qari'ah:11,At-Takasur:8,Al-'Asr:3,Al-Humazah:9,Al-Fil:5,Quraisy:4,Al-Ma'un:7,Al-Kausar:3,Al-Kafirun:6,An-Nasr:3,Al-Lahab:5,Al-Ikhlas:4,Al-Falaq:5,An-Nas:6"
    .split(',').map(s => { let [n, a] = s.split(':'); return { nama: n, batas: parseInt(a) }; });

window.tambahAyatPintar = (aksi) => {
    let textarea = document.getElementById('editQuranRealisasi');
    let teksAsli = textarea.value.trim();
    if (aksi === 'ulangi') { if (!teksAsli.includes("(Muraja'ah)")) textarea.value = teksAsli + " (Muraja'ah)"; return; }

    let teksBersih = teksAsli.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Normalisasi ejaan yang sering berbeda transliterasinya
    teksBersih = teksBersih.replace('mujadalah', 'mujadilah');
    teksBersih = teksBersih.replace('baqaroh', 'baqarah');
    teksBersih = teksBersih.replace('fatehah', 'fatihah');
    teksBersih = teksBersih.replace('imron', 'imran');
    teksBersih = teksBersih.replace('maidoh', 'maidah');
    teksBersih = teksBersih.replace('dhuha', 'duha');
    teksBersih = teksBersih.replace('thariq', 'tariq');
    teksBersih = teksBersih.replace('thaahaa', 'taha').replace('thaha', 'taha');
    teksBersih = teksBersih.replace('sajadah', 'sajdah');

    let indexSurah = -1; let panjangKecocokan = 0;
    for (let i = 0; i < dbQuran.length; i++) {
        let namaNormal = dbQuran[i].nama.toLowerCase().replace(/[^a-z]/g, '');
        if (teksBersih.includes(namaNormal) && namaNormal.length > panjangKecocokan) { indexSurah = i; panjangKecocokan = namaNormal.length; }
    }
    let angkaMatch = teksAsli.match(/(\d+)(?!.*\d)/);
    let ayatSekarang = angkaMatch ? parseInt(angkaMatch[0]) : 0;
    if (indexSurah === -1 || ayatSekarang === 0) { textarea.value = teksAsli + " (+" + aksi + ")"; return; }
    let surahIni = dbQuran[indexSurah];
    let ayatBaru = ayatSekarang + aksi;
    if (ayatBaru > surahIni.batas) {
        let sisaAyat = ayatBaru - surahIni.batas;
        if (indexSurah + 1 < dbQuran.length) { textarea.value = 'Surah ' + dbQuran[indexSurah + 1].nama + ' ayat ' + sisaAyat; }
        else { textarea.value = 'Khatam! (An-Nas Selesai)'; }
    } else { textarea.value = 'Surah ' + surahIni.nama + ' ayat ' + ayatBaru; }
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
    container.style.display = 'block';

    let html = '';
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

    arr.forEach(num => {
        html += `<div class="custom-dropdown-item" onclick="window.selectHaditsNilai(${num})">${num}</div>`;
    });
    // Tambahkan opsi "Tidak Setor Sama Sekali" di paling bawah dropdown D
    if (grade === 'D') {
        html += `<div class="custom-dropdown-item tidak-setor-item" onclick="window.pilihTidakSetor('hadits')">❌ Tidak Setor Sama Sekali</div>`;
    }
    document.getElementById('haditsDropdownList').innerHTML = html;

    const midIndex = Math.floor(arr.length / 2);
    window.updateHaditsNilai(arr[midIndex]);
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
    container.style.display = 'block';

    let html = '';
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

    arr.forEach(num => {
        html += `<div class="custom-dropdown-item" onclick="window.selectDoaNilai(${num})">${num}</div>`;
    });
    // Tambahkan opsi "Tidak Setor Sama Sekali" di paling bawah dropdown D
    if (grade === 'D') {
        html += `<div class="custom-dropdown-item tidak-setor-item" onclick="window.pilihTidakSetor('doa')">❌ Tidak Setor Sama Sekali</div>`;
    }
    document.getElementById('doaDropdownList').innerHTML = html;

    const midIndex = Math.floor(arr.length / 2);
    window.updateDoaNilai(arr[midIndex]);
};

window.pilihGradeQuran = (grade) => {
    document.getElementById('editStatusQuran').value = grade;
    document.querySelectorAll('.grade-pill-btn:not(.hadits-pill-btn):not(.doa-pill-btn)').forEach(btn => {
        if (btn.getAttribute('data-grade') === grade) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const container = document.getElementById('customDropdownContainer');
    container.style.display = 'block';

    let html = '';
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

    arr.forEach(num => {
        html += `<div class="custom-dropdown-item" onclick="window.selectCustomNilai(${num})">${num}</div>`;
    });
    // Tambahkan opsi "Tidak Setor Sama Sekali" di paling bawah dropdown D
    if (grade === 'D') {
        html += `<div class="custom-dropdown-item tidak-setor-item" onclick="window.pilihTidakSetor('quran')">❌ Tidak Setor Sama Sekali</div>`;
    }

    document.getElementById('customDropdownList').innerHTML = html;

    const midIndex = Math.floor(arr.length / 2);
    window.updateNilaiManual(arr[midIndex]);
};

// Handler untuk status "Tidak Setor Sama Sekali"
window.pilihTidakSetor = (subject) => {
    if (subject === 'quran') {
        document.getElementById('editStatusQuran').value = 'tidakSetor';
        document.getElementById('editQuranNilaiAngka').value = '';
        document.getElementById('customDropdownText').innerText = '❌ Tidak Setor';
        // Tutup dropdown
        document.getElementById('customDropdownContainer').classList.remove('open');
        document.getElementById('customDropdownList').classList.remove('show');
        // Aktifkan pill D agar terlihat konteksnya
        document.querySelectorAll('.grade-pill-btn:not(.hadits-pill-btn):not(.doa-pill-btn)').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    } else if (subject === 'hadits') {
        document.getElementById('editStatusHadits').value = 'tidakSetor';
        document.getElementById('editHaditsNilaiAngka').value = '';
        document.getElementById('haditsDropdownText').innerText = '❌ Tidak Setor';
        document.getElementById('haditsDropdownContainer').classList.remove('open');
        document.getElementById('haditsDropdownList').classList.remove('show');
        document.querySelectorAll('.hadits-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    } else if (subject === 'doa') {
        document.getElementById('editStatusDoa').value = 'tidakSetor';
        document.getElementById('editDoaNilaiAngka').value = '';
        document.getElementById('doaDropdownText').innerText = '❌ Tidak Setor';
        document.getElementById('doaDropdownContainer').classList.remove('open');
        document.getElementById('doaDropdownList').classList.remove('show');
        document.querySelectorAll('.doa-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-grade') === 'D');
        });
    }
    // Otomatis set setoranHarian = 'sudah' agar masuk statistik hari ini
    window.pilihSetoranHarian('sudah');
};

window.updateHaditsNilai = (val) => {
    document.getElementById('editHaditsNilaiAngka').value = val;
    document.getElementById('haditsDropdownText').innerText = val;
};

window.updateDoaNilai = (val) => {
    document.getElementById('editDoaNilaiAngka').value = val;
    document.getElementById('doaDropdownText').innerText = val;
};

window.updateNilaiManual = (val) => {
    document.getElementById('editQuranNilaiAngka').value = val;
    const textSpan = document.getElementById('customDropdownText');
    if (textSpan) textSpan.innerText = val;

    document.getElementById('customDropdownList').querySelectorAll('.custom-dropdown-item').forEach(item => {
        if (item.innerText == val) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
};

window.toggleCustomDropdown = () => {
    const container = document.getElementById('customDropdownContainer');
    const list = document.getElementById('customDropdownList');
    container.classList.toggle('open');
    list.classList.toggle('show');
};

window.selectCustomNilai = (val) => {
    window.updateNilaiManual(val);
    const container = document.getElementById('customDropdownContainer');
    const list = document.getElementById('customDropdownList');
    container.classList.remove('open');
    list.classList.remove('show');
};

window.toggleHaditsDropdown = () => {
    const container = document.getElementById('haditsDropdownContainer');
    const list = document.getElementById('haditsDropdownList');
    container.classList.toggle('open');
    list.classList.toggle('show');
};

window.selectHaditsNilai = (val) => {
    window.updateHaditsNilai(val);
    const container = document.getElementById('haditsDropdownContainer');
    const list = document.getElementById('haditsDropdownList');
    container.classList.remove('open');
    list.classList.remove('show');
};

window.toggleDoaDropdown = () => {
    const container = document.getElementById('doaDropdownContainer');
    const list = document.getElementById('doaDropdownList');
    container.classList.toggle('open');
    list.classList.toggle('show');
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
            const matchSurah = qRealisasi.match(/Surah\s+([A-Za-z\-'\s]+)\s+ayat/i);
            const matchAyat = qRealisasi.match(/ayat\s+([0-9\-\+]+)/i);
            if (matchSurah) parsedSurah = matchSurah[1].trim();
            else parsedSurah = qRealisasi.split('ayat')[0].trim();
            if (matchAyat) parsedAyat = matchAyat[1].trim();
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
   STATISTICS DASHBOARD LOGIC
========================================= */

window.openStatsModal = () => {
    document.getElementById('statsModal').classList.add('open');
    renderStatsChart();
};

// switchStatsTab dipertahankan agar tidak error jika masih ada referensi lama
window.switchStatsTab = () => renderStatsChart();

window.toggleStatList = (id) => {
    const list = document.getElementById(id);
    const hint = document.getElementById('hint-' + id);
    if (!list) return;
    const isOpen = list.classList.toggle('open');
    if (hint) {
        hint.classList.toggle('expanded', isOpen);
        const arrow = hint.querySelector('.stat-bar-hint-arrow');
        if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
        hint.querySelector('.hint-text').textContent = isOpen ? 'Sembunyikan daftar nama' : 'Ketuk untuk lihat daftar nama';
    }
};

// Toggle baris nilai A/B/C/D di dalam sub-breakdown
window.toggleSubGrade = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const row = el.previousElementSibling;
    const isOpen = el.classList.toggle('open');
    if (row) row.classList.toggle('active', isOpen);
};

// Ganti tampilan sub-breakdown saat pill mata pelajaran diklik
window.switchSubBreakdown = (subj, btn) => {
    btn.closest('.sub-pills').querySelectorAll('.sub-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const data = window._subjectBreakdownData;
    if (!data) return;

    const gradeConfig = [
        { g: 'A', icon: '👑', color: '#93c5fd', cls: 'a' },
        { g: 'B', icon: '🌟', color: '#6ee7b7', cls: 'b' },
        { g: 'C', icon: '⚡', color: '#fcd34d', cls: 'c' },
        { g: 'D', icon: '⏳', color: '#94a3b8', cls: 'd' },
    ];

    const html = gradeConfig.map(gc => {
        const names = data[subj][gc.g];
        const chipsHtml = names.length > 0
            ? names.map(n => `<span class="stat-name-chip">${n}</span>`).join('')
            : `<span style="opacity:0.35; font-size:10px;">Tidak ada murid di kategori ini.</span>`;
        const listId = `subgrade-${subj}-${gc.g}`;
        return `
            <div class="sub-grade-row" onclick="window.toggleSubGrade('${listId}')">
                <span class="sub-grade-label" style="color:${gc.color};">${gc.icon} Nilai ${gc.g}</span>
                <span class="sub-grade-count" style="color:${gc.color};">${names.length} anak</span>
                <span class="sub-grade-arrow">▼</span>
            </div>
            <div class="sub-grade-names stat-color-${gc.cls}" id="${listId}">${chipsHtml}</div>
        `;
    }).join('');

    document.getElementById('subBreakdownContent').innerHTML = html;
};

function renderStatsChart() {
    const container = document.getElementById('statsChartContainer');
    const hariIni = window.getTanggalHariIni();

    const totalMurid = dataMuridDinamis.length;
    if (totalMurid === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px 20px;">Belum ada data murid untuk kelas ini.</div>';
        return;
    }

    // Struktur data kategori
    const stats = {
        sudahSetor:   { names: [], muridList: [] },
        izin:         { names: [] },
        berhalangan:  { names: [] },
        belumHariIni: { names: [] },
        tidakSetor:   { names: [] },
    };

    dataMuridDinamis.forEach(murid => {
        // Status permanen "Tidak Setor Sama Sekali"
        const adaTidakSetor = (murid.quranStatus === 'tidakSetor' || murid.haditsStatus === 'tidakSetor' || murid.doaStatus === 'tidakSetor');
        if (adaTidakSetor) {
            stats.tidakSetor.names.push(murid.nama);
            return;
        }

        const sudahDinilaiHariIni = (murid.tanggalSetor === hariIni);
        const setoranHarian = murid.setoranHarian || 'belum';

        if (sudahDinilaiHariIni && setoranHarian === 'sudah') {
            stats.sudahSetor.names.push(murid.nama);
            stats.sudahSetor.muridList.push(murid); // simpan objek lengkap untuk sub-breakdown
        } else if (sudahDinilaiHariIni && setoranHarian === 'izin') {
            stats.izin.names.push(murid.nama);
        } else if (sudahDinilaiHariIni && setoranHarian === 'berhalangan') {
            stats.berhalangan.names.push(murid.nama);
        } else {
            stats.belumHariIni.names.push(murid.nama);
        }
    });

    // Bangun data per-mata-pelajaran untuk sub-breakdown (disimpan global agar switchSubBreakdown bisa akses)
    const buildSubjectData = (muridList) => {
        const subjectMap = {
            quran:  { Q: 'quranStatus',  A: [], B: [], C: [], D: [] },
            hadits: { Q: 'haditsStatus', A: [], B: [], C: [], D: [] },
            doa:    { Q: 'doaStatus',    A: [], B: [], C: [], D: [] },
        };
        muridList.forEach(murid => {
            ['quran', 'hadits', 'doa'].forEach(subj => {
                const statusRaw = murid[subjectMap[subj].Q] || '';
                const grade = ['A', 'B', 'C', 'D'].includes(statusRaw) ? statusRaw : 'D';
                subjectMap[subj][grade].push(murid.nama);
            });
        });
        // Kembalikan hanya A/B/C/D per subjek
        return {
            quran:  { A: subjectMap.quran.A,  B: subjectMap.quran.B,  C: subjectMap.quran.C,  D: subjectMap.quran.D  },
            hadits: { A: subjectMap.hadits.A, B: subjectMap.hadits.B, C: subjectMap.hadits.C, D: subjectMap.hadits.D },
            doa:    { A: subjectMap.doa.A,    B: subjectMap.doa.B,    C: subjectMap.doa.C,    D: subjectMap.doa.D    },
        };
    };
    window._subjectBreakdownData = buildSubjectData(stats.sudahSetor.muridList);

    // Summary row
    const sudah = stats.sudahSetor.names.length;
    const pct = Math.round((sudah / totalMurid) * 100);
    const emoji = pct === 100 ? '🎉' : pct >= 70 ? '💪' : pct >= 40 ? '📈' : '🕐';

    let html = `
        <div style="text-align:center; padding: 12px 0 18px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 16px;">
            <div style="font-size: 36px; line-height:1; margin-bottom:6px;">${emoji}</div>
            <div style="font-size:22px; font-weight:800; color: var(--gold);">${sudah} / ${totalMurid}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:3px; letter-spacing:0.5px;">SUDAH SETOR HARI INI &nbsp;·&nbsp; ${pct}% Ketuntasan</div>
        </div>
    `;

    // Helper: render satu bar kategori utama
    const renderBar = (key, icon, title, clsColor, names, extraHtml = '') => {
        const count = names.length;
        const percentage = Math.round((count / totalMurid) * 100) || 0;
        const listId = `stat-list-${key}`;
        const hintId = `hint-${listId}`;
        const chipsHtml = count > 0
            ? names.map(n => `<span class="stat-name-chip">${n}</span>`).join('')
            : `<span style="opacity:0.4; font-size:11px;">Tidak ada murid di kategori ini.</span>`;

        return `
            <div class="stat-bar-container">
                <div class="stat-bar-header">
                    <span class="stat-color-${clsColor}" style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:14px;">${icon}</span>
                        ${title}
                    </span>
                    <span class="stat-bar-count-badge">${count} anak</span>
                </div>
                <div class="stat-bar-track" onclick="window.toggleStatList('${listId}')">
                    <div class="stat-bar-fill stat-bg-${clsColor}" style="width:0%;" data-width="${percentage}%"></div>
                </div>
                <div id="${hintId}" class="stat-bar-hint" onclick="window.toggleStatList('${listId}')">
                    <span class="stat-bar-hint-arrow">▼</span>
                    <span class="hint-text">Ketuk untuk lihat daftar nama</span>
                    <span style="margin-left:auto; opacity:0.4;">${percentage}%</span>
                </div>
                <div id="${listId}" class="stat-names-list stat-color-${clsColor}">
                    ${extraHtml}
                    ${count > 0 && !extraHtml ? chipsHtml : (extraHtml ? '' : chipsHtml)}
                </div>
            </div>
        `;
    };

    // Sub-breakdown per mata pelajaran untuk "Sudah Setor"
    const buildSubBreakdownHtml = (subj) => {
        const data = window._subjectBreakdownData[subj];
        const gradeConfig = [
            { g: 'A', icon: '👑', color: '#93c5fd', cls: 'a' },
            { g: 'B', icon: '🌟', color: '#6ee7b7', cls: 'b' },
            { g: 'C', icon: '⚡', color: '#fcd34d', cls: 'c' },
            { g: 'D', icon: '⏳', color: '#94a3b8', cls: 'd' },
        ];
        return gradeConfig.map(gc => {
            const names = data[gc.g];
            const chipsHtml = names.length > 0
                ? names.map(n => `<span class="stat-name-chip">${n}</span>`).join('')
                : `<span style="opacity:0.35; font-size:10px;">Tidak ada murid di kategori ini.</span>`;
            const listId = `subgrade-${subj}-${gc.g}`;
            return `
                <div class="sub-grade-row" onclick="window.toggleSubGrade('${listId}')">
                    <span class="sub-grade-label" style="color:${gc.color};">${gc.icon} Nilai ${gc.g}</span>
                    <span class="sub-grade-count" style="color:${gc.color};">${names.length} anak</span>
                    <span class="sub-grade-arrow">▼</span>
                </div>
                <div class="sub-grade-names stat-color-${gc.cls}" id="${listId}">${chipsHtml}</div>
            `;
        }).join('');
    };

    const subBreakdown = sudah === 0 ? '' : `
        <div class="sub-breakdown-container">
            <div class="sub-pills">
                <button class="sub-pill active" onclick="window.switchSubBreakdown('quran', this)">📖 Qur'an</button>
                <button class="sub-pill" onclick="window.switchSubBreakdown('hadits', this)">📜 Hadits</button>
                <button class="sub-pill" onclick="window.switchSubBreakdown('doa', this)">🤲 Doa</button>
            </div>
            <div id="subBreakdownContent">
                ${buildSubBreakdownHtml('quran')}
            </div>
        </div>
    `;

    // Untuk bar "Sudah Setor": tidak tampilkan chip nama (sudah ada di sub-breakdown)
    const renderBarSudah = () => {
        const count = sudah;
        const percentage = Math.round((count / totalMurid) * 100) || 0;
        const listId = 'stat-list-sudah';
        const hintId = 'hint-stat-list-sudah';
        return `
            <div class="stat-bar-container">
                <div class="stat-bar-header">
                    <span class="stat-color-a" style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:14px;">✅</span>
                        Sudah Setor
                    </span>
                    <span class="stat-bar-count-badge">${count} anak</span>
                </div>
                <div class="stat-bar-track" onclick="window.toggleStatList('${listId}')">
                    <div class="stat-bar-fill stat-bg-a" style="width:0%;" data-width="${percentage}%"></div>
                </div>
                <div id="${hintId}" class="stat-bar-hint" onclick="window.toggleStatList('${listId}')">
                    <span class="stat-bar-hint-arrow">▼</span>
                    <span class="hint-text">Ketuk untuk lihat rincian nilai</span>
                    <span style="margin-left:auto; opacity:0.4;">${percentage}%</span>
                </div>
                <div id="${listId}" class="stat-names-list stat-color-a">
                    ${subBreakdown}
                </div>
            </div>
        `;
    };

    html += renderBarSudah();
    html += renderBar('izin', '🏥', 'Izin / Sakit', 'izin', stats.izin.names);
    html += renderBar('berhalangan', '🛑', 'Berhalangan / Uzur', 'berhalangan', stats.berhalangan.names);
    html += renderBar('belum', '⏳', 'Belum Setor Hari Ini', 'd', stats.belumHariIni.names);
    html += renderBar('tidaksetor', '🚫', 'Tidak Setor Sama Sekali', 'e', stats.tidakSetor.names);

    container.innerHTML = html;

    // Staggered bar animation
    setTimeout(() => {
        container.querySelectorAll('.stat-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-width');
        });
    }, 80);
}

