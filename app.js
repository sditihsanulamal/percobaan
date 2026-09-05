import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
const db = getFirestore(app);
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
    if (tingkat >= 1 && tingkat <= 2) return 2;
    if (tingkat === 6) return 6; 
    return 4;
};
window.toggleSidebarMenu = () => document.getElementById('mainSidebar').classList.toggle('open');

window.getTanggalHariIni = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
};

function renderGaleri(fields) {
    const grid = document.getElementById('galleryGrid');
    const fotoData = [
        { key: 'foto1', caption: 'Pembacaan Zikir Pagi', time: '08:00 - 08:20 WITA', icon: '📿' },
        { key: 'foto2', caption: 'Sholat Dhuha', time: '08:00 - 08:20 WITA', icon: '📸' },
        { key: 'foto3', caption: "Muraja'ah Hafalan", time: '08:45 - 09:10 WITA', icon: '📖' },
    ];

    let html = '';
    let queueProxy = [];

    fotoData.forEach((foto, idx) => {
        let rawInput = fields ? (fields[foto.key] || '').trim() : '';
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
                <div><div class="gallery-caption">${foto.caption}</div>
                <span class="gallery-time">${foto.time}</span></div>
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

onSnapshot(collection(db, koleksiMading), (snapshot) => {
    dataMadingDinamis = {};
    snapshot.forEach((doc) => { dataMadingDinamis[doc.id] = doc.data(); });

    const infoDok = dataMadingDinamis['info-dokumentasi'];
    const f = (infoDok && infoDok.fields) ? infoDok.fields : null;

    if (f) {
        document.getElementById('teksTanggalDokumentasi').innerText = f.tanggal || "Belum diset";
    }

    const sig = JSON.stringify(f);
    if (sig !== lastGaleriSig) {
        lastGaleriSig = sig;
        renderGaleri(f);
    }
});

onAuthStateChanged(auth, (user) => {
    isAdmin = !!user;
    document.getElementById('adminBadge').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('loginForm').style.display = isAdmin ? 'none' : 'block';
    document.getElementById('logoutForm').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btnEditTanggal').style.display = isAdmin ? 'inline-block' : 'none';
    
    if (isAdmin && user.email) {
        document.getElementById('loggedInAs').innerText = '✉️ ' + user.email;
    }
});

onSnapshot(collection(db, koleksiMurid), (snapshot) => {
    if (!snapshot.empty) {
        dataMuridDinamis = [];
        snapshot.forEach((doc) => { dataMuridDinamis.push({ id: doc.id, ...doc.data() }); });
        dataMuridDinamis.sort((a, b) => a.nama.localeCompare(b.nama));
        window.renderMurid();
    } else {
        document.getElementById('muridList').innerHTML = '<div style="text-align:center; color:var(--gold-muted); margin-top:40px; font-weight:500; grid-column:1/-1;">Belum ada data murid untuk kelas ' + window.kelasTarget + '.<br>Silakan tambahkan data via halaman Setup Murid.</div>';
    }
});

window.getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

window.renderMurid = () => {
    const list = document.getElementById('muridList');
    const hariIni = window.getTanggalHariIni();
    const cards = [];
    dataMuridDinamis.forEach((murid, index) => {
        let stQ = murid.quranStatus || "belum";
        let stH = murid.haditsStatus || "belum";
        let stD = murid.doaStatus || "belum";
        let statusHarian = (murid.tanggalSetor === hariIni) ? (murid.setoranHarian || "belum") : "belum";
        let glowClass = (statusHarian === 'sudah') ? 'sudah-setor' : '';
        cards.push('<div class="glass-panel murid-card ' + glowClass + '" onclick="window.openModal(' + index + ')">'
            + '<div class="avatar">' + window.getInitials(murid.nama) + '</div>'
            + '<div class="murid-info">'
            + '<div class="murid-nama">' + murid.nama + '</div>'
            + '<div class="status-dots">'
            + '<span class="dot ' + stQ + '" title="Qur\'an"></span>'
            + '<span class="dot ' + stH + '" title="Hadits"></span>'
            + '<span class="dot ' + stD + '" title="Doa"></span>'
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

const setBadge = (elementId, status) => {
    const el = document.getElementById(elementId);
    el.className = 'dot ' + status;
    el.innerText = "";
    el.style.width = '14px'; el.style.height = '14px'; el.style.flexShrink = '0';
};

window.openModal = (index) => {
    const murid = dataMuridDinamis[index];
    document.getElementById('modalNama').innerText = murid.nama;
    document.getElementById('modalInitials').innerText = window.getInitials(murid.nama);
    document.getElementById('editId').value = murid.id;
    
    const qStatus = murid.quranStatus || "belum";
    const hStatus = murid.haditsStatus || "belum";
    const dStatus = murid.doaStatus || "belum";
    const hariIni = window.getTanggalHariIni();
    const statusHarian = (murid.tanggalSetor === hariIni) ? (murid.setoranHarian || "belum") : "belum";
    
    window.pilihSetoranHarian(statusHarian);
    document.getElementById('editQuranTarget').value = murid.quranTarget || "";
    document.getElementById('editQuranRealisasi').value = murid.quranRealisasi || "-";
    document.getElementById('editStatusQuran').value = qStatus;
    setBadge('badgeQuran', qStatus);
    document.getElementById('editHaditsTarget').value = murid.haditsTarget || "";
    document.getElementById('editHaditsRealisasi').value = murid.haditsRealisasi || "-";
    document.getElementById('editStatusHadits').value = hStatus;
    setBadge('badgeHadits', hStatus);
    document.getElementById('editDoaTarget').value = murid.doaTarget || "";
    document.getElementById('editDoaRealisasi').value = murid.doaRealisasi || "-";
    document.getElementById('editStatusDoa').value = dStatus;
    setBadge('badgeDoa', dStatus);
    document.getElementById('progressModal').classList.add('open');

    const inputs = document.querySelectorAll('#progressModal textarea.admin-input');
    const selects = document.querySelectorAll('#progressModal .admin-select-status');
    const badges = document.querySelectorAll('#progressModal .status-badge, #progressModal .dot');

    if (isAdmin) {
        inputs.forEach(i => { i.disabled = false; i.style.height = "auto"; });
        selects.forEach(s => s.style.display = 'block');
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
        ['senin','selasa','rabu','kamis','jumat'].forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;">'
                + '<div style="font-weight:700;color:var(--gold);margin-bottom:12px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">'
                + D + ' - <span style="color:#fff;">' + (fields[d+'_nama'] || '-') + '</span></div>'
                + '<div style="display:flex;flex-direction:column;gap:10px;">'
                + '<div><div style="font-size:11px;color:var(--text-muted);">☀️ Pagi</div><div style="font-size:14px;font-weight:600;color:#fff;">' + (fields[d+'_pagi'] || '-') + '</div></div>'
                + '<div><div style="font-size:11px;color:var(--text-muted);">🌙 Sore</div><div style="font-size:14px;font-weight:600;color:#fff;">' + (fields[d+'_sore'] || '-') + '</div></div>'
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
        return '<div style="text-align:center;margin-bottom:30px;">'
            + '<span class="hari-badge" style="margin-top:0;">' + (fields.h_judul || '') + '</span>'
            + '<div class="arabic-text" style="margin:20px 0;">' + (fields.h_arab || '') + '</div>'
            + '<div style="font-size:14px;font-style:italic;color:var(--text-muted);">"' + (fields.h_arti || '') + '"</div>'
            + buatAudioPlayer(fields.h_audio)
            + '</div>'
            + '<hr style="border:0;border-top:1px dashed rgba(255,255,255,0.1);margin:20px 0;">'
            + '<div style="text-align:center;">'
            + '<span class="hari-badge" style="margin-top:0;">' + (fields.d_judul || '') + '</span>'
            + '<div class="arabic-text" style="margin:20px 0;">' + (fields.d_arab || '') + '</div>'
            + '<div style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:1px;margin-bottom:12px;">' + (fields.d_latin || '') + '</div>'
            + '<div style="font-size:14px;font-style:italic;color:var(--text-muted);">"' + (fields.d_arti || '') + '"</div>'
            + buatAudioPlayer(fields.d_audio)
            + '</div>';
    
    } else if (id === 'jadwal-imam') {
        const jmlRakaat = window.getJumlahRakaat();
        let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
        ['senin','selasa','rabu','kamis','jumat'].forEach(d => {
            const D = d.charAt(0).toUpperCase() + d.slice(1);
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;">'
                + '<div style="font-weight:700;color:var(--gold);margin-bottom:12px;font-size:15px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">'
                + D + ' - <span style="color:#fff;">' + (fields[d+'_nama'] || '-') + '</span></div>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
            
            for (let r = 1; r <= jmlRakaat; r++) {
                html += '<div><div style="font-size:11px;color:var(--text-muted);">Raka\'at ' + r + '</div><div style="font-size:13px;font-weight:600;">' + (fields[d+'_r'+r] || '-') + '</div></div>';
            }
            
            html += '</div></div>';
        });
        return html + '</div>';
    } else if (id === 'jadwal-tilawah') {
        let html = '<div style="display:flex;flex-direction:column;gap:16px;">';
        for (let i = 1; i <= 3; i++) {
            html += '<div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:16px;border-left:4px solid var(--gold);">'
                + '<div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px;">' + (fields['h'+i] || '') + '</div>'
                + '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:2px;">' + (fields['n'+i] || '') + '</div>'
                + '<div style="font-size:14px;color:var(--text-muted);">' + (fields['s'+i] || '') + '</div></div>';
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
        ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
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
        ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
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
            ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
                document.getElementById('fm-' + day + '-nama').value = f[day + '_nama'] || '';
                document.getElementById('fm-' + day + '-pagi').value = f[day + '_pagi'] || '';
                document.getElementById('fm-' + day + '-sore').value = f[day + '_sore'] || '';
            });
        } else if (id === 'target-quran') {
            document.getElementById('fq-surah').value = f.surah || '';
            document.getElementById('fq-ayat').value = f.ayat || '';
            document.getElementById('fq-audio').value = f.audio || '';
        } else if (id === 'target-hadits') {
            document.getElementById('fh-judul').value = f.h_judul || '';
            document.getElementById('fh-arab').value = f.h_arab || '';
            document.getElementById('fh-arti').value = f.h_arti || '';
            document.getElementById('fh-audio').value = f.h_audio || '';
            document.getElementById('fd-judul').value = f.d_judul || '';
            document.getElementById('fd-arab').value = f.d_arab || '';
            document.getElementById('fd-latin').value = f.d_latin || '';
            document.getElementById('fd-arti').value = f.d_arti || '';
            document.getElementById('fd-audio').value = f.d_audio || '';
        } else if (id === 'jadwal-tilawah') {
            for (let i = 1; i <= 3; i++) {
                document.getElementById('ft-h' + i).value = f['h' + i] || '';
                document.getElementById('ft-n' + i).value = f['n' + i] || '';
                document.getElementById('ft-s' + i).value = f['s' + i] || '';
            }
       } else if (id === 'jadwal-imam') {
            const jmlRakaat = window.getJumlahRakaat();
            ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
                document.getElementById('fi-' + day + '-nama').value = f[day + '_nama'] || '';
                for (let r = 1; r <= jmlRakaat; r++) {
                    const inputEl = document.getElementById('fi-' + day + '-r' + r);
                    if (inputEl) inputEl.value = f[day + '_r' + r] || '';
                }
            });
        } else if (id === 'info-dokumentasi') {
            document.getElementById('fdok-tanggal').value = f.tanggal || '';
            document.getElementById('fdok-foto1').value = f.foto1 || '';
            document.getElementById('fdok-foto2').value = f.foto2 || '';
            document.getElementById('fdok-foto3').value = f.foto3 || '';
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

window.simpanDataMading = async () => {
    if (!isAdmin) return;
    const btn = document.getElementById('btnSaveMading');
    btn.innerText = "Menyimpan...";
    const id = window.currentMadingId;
    const newTitle = document.getElementById('editMadingTitle').value;
    let newFields = {};
    
    if (id === 'jadwal-murajaah') {
        ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
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
        newFields = {
            h_judul: document.getElementById('fh-judul').value,
            h_arab: document.getElementById('fh-arab').value,
            h_arti: document.getElementById('fh-arti').value,
            h_audio: document.getElementById('fh-audio').value, 
            d_judul: document.getElementById('fd-judul').value,
            d_arab: document.getElementById('fd-arab').value,
            d_latin: document.getElementById('fd-latin').value,
            d_arti: document.getElementById('fd-arti').value,
            d_audio: document.getElementById('fd-audio').value  
        };
    } else if (id === 'jadwal-tilawah') {
        for (let i = 1; i <= 3; i++) {
            newFields['h' + i] = document.getElementById('ft-h' + i).value;
            newFields['n' + i] = document.getElementById('ft-n' + i).value;
            newFields['s' + i] = document.getElementById('ft-s' + i).value;
        }
    } else if (id === 'jadwal-imam') {
        const jmlRakaat = window.getJumlahRakaat();
        ['senin','selasa','rabu','kamis','jumat'].forEach(day => {
            newFields[day + '_nama'] = document.getElementById('fi-' + day + '-nama').value;
            for (let r = 1; r <= jmlRakaat; r++) {
                const inputEl = document.getElementById('fi-' + day + '-r' + r);
                if (inputEl) {
                    newFields[day + '_r' + r] = inputEl.value;
                }
            }
        });
    } else if (id === 'info-dokumentasi') {
        newFields = {
            tanggal: document.getElementById('fdok-tanggal').value,
            foto1: document.getElementById('fdok-foto1').value, 
            foto2: document.getElementById('fdok-foto2').value, 
            foto3: document.getElementById('fdok-foto3').value  
        };
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
                    const haditsTarget = (newFields.h_judul || '').trim();
                    const doaTarget = (newFields.d_judul || '').trim();
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

window.simpanDataMurid = async () => {
    if (!isAdmin) return;
    const btn = document.getElementById('btnSaveMurid'); btn.innerText = "Menyimpan...";
    try {
        await updateDoc(doc(db, koleksiMurid, document.getElementById('editId').value), {
            setoranHarian: document.getElementById('valSetoranHarian').value,
            tanggalSetor: window.getTanggalHariIni(),
            quranTarget: document.getElementById('editQuranTarget').value,
            quranRealisasi: document.getElementById('editQuranRealisasi').value,
            quranStatus: document.getElementById('editStatusQuran').value,
            haditsTarget: document.getElementById('editHaditsTarget').value,
            haditsRealisasi: document.getElementById('editHaditsRealisasi').value,
            haditsStatus: document.getElementById('editStatusHadits').value,
            doaTarget: document.getElementById('editDoaTarget').value,
            doaRealisasi: document.getElementById('editDoaRealisasi').value,
            doaStatus: document.getElementById('editStatusDoa').value
        });
        btn.innerText = "Simpan Perubahan Dasbor"; window.closeModal('progressModal');
    } catch (error) { alert("Error: " + error.message); btn.innerText = "Simpan Perubahan Dasbor"; }
};