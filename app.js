const USER = "Pak Suhendra";
const stamp = () =>
  new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const S = (k, n, d, by, at) => ({
  kode: k,
  nama: n,
  deskripsi: d,
  by: by || USER,
  at: at || "20 Okt 2026, 09.15",
});

// Relational Database State
let db = { pl: [], cpl: [], bk: [], mk: [], cpmk: [], sub_cpmk: [], logs: [] };

const STORAGE_KEY = "SA_KURIKULUM_DB_V6";

function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn("Gagal menyimpan ke localStorage:", e);
  }
}

function hydrateDb(data) {
  const rel = data.relasi || {};
  const cplPl = rel.cpl_pl || [];
  const cplBk = rel.cpl_bk || [];
  const bkMk = rel.bk_mk || [];
  const cplMk = rel.cpl_mk || [];
  const mkCpmk = rel.mk_cpmk || [];
  const subCpmkList = (data.sub_cpmk || []).map((s) => ({
    ...s,
    nama: s.deskripsi || s.nama || s.kode,
  }));

  // Profil Lulusan (4 Profil Utama D4 TRPL)
  const pl = (data.profil_lulusan || []).map((p) => ({
    ...p,
    deskripsi: p.deskripsi || p.profil_lulusan || "",
    profesi: p.profesi || "",
    profesi_detail: p.profesi_detail || p.detail_profesi || "",
    nama: p.profesi || (p.kode === "PL4" ? "Budaya a-STAR" : p.kode),
    cpl: cplPl.filter((r) => r.pl === p.kode).map((r => r.cpl)),
  }));

  // CPL (12 butir: 8 Hard skill, 4 Soft skill)
  const softCpls = ["CPL09", "CPL10", "CPL11", "CPL12"];
  const cpl = (data.cpl || []).map((c) => ({
    ...c,
    nama: c.uraian || c.nama || c.kode,
    uraian: c.uraian || c.nama || "",
    jenis: c.jenis || (softCpls.includes(c.kode) ? "Soft skill" : "Hard skill"),
    pl: c.pl && c.pl.length ? c.pl : cplPl.filter((r) => r.cpl === c.kode).map((r => r.pl)),
    bk: c.bk && c.bk.length ? c.bk : cplBk.filter((r) => r.cpl === c.kode).map((r => r.bk)),
    mk: c.mk && c.mk.length ? c.mk : cplMk.filter((r) => r.cpl === c.kode).map((r => r.mk)),
  }));

  // BK (19 butir: BK-01 s.d. BK-19)
  const bk = (data.bahan_kajian || data.bk || []).map((b) => ({
    ...b,
    nama: b.nama || b.kode,
    deskripsi: b.deskripsi || `${b.kategori || ""}${b.referensi ? ` (${b.referensi})` : ""}`,
    mk: b.mk && b.mk.length ? b.mk : bkMk.filter((r) => r.bk === b.kode).map((r => r.mk)),
    cpl: b.cpl && b.cpl.length ? b.cpl : cplBk.filter((r) => r.bk === b.kode).map((r => r.cpl)),
  }));

  // MK (46 mata kuliah, 8 semester, 144 SKS total)
  const mk = (data.mata_kuliah || data.mk || []).map((m) => {
    const sem = m.sem ?? m.semester ?? 1;
    const sksTeori = m.sksTeori ?? m.sks_teori ?? 0;
    const sksPrak = m.sksPrak ?? ((m.sks_praktik ?? 0) + (m.sks_praktikum ?? 0));
    const sksTotal = m.sks ?? m.sks_total ?? (sksTeori + sksPrak);
    const kat = m.kat || (m.kategori && m.kategori.includes("Umum") ? "Umum" : "Inti RPL");
    const jenis = m.jenis || (m.tipe && m.tipe.includes("Praktek") ? "Praktik" : "Teori");
    return {
      ...m,
      sem,
      semester: sem,
      sksTeori,
      sks_teori: sksTeori,
      sksPrak,
      sks_praktik: m.sks_praktik ?? sksPrak,
      sks_praktikum: m.sks_praktikum ?? 0,
      sks: sksTotal,
      sks_total: sksTotal,
      kat,
      kategori: m.kategori || (kat === "Umum" ? "Mata Kuliah Umum" : "Mata Kuliah Inti RPL"),
      jenis,
      tipe: m.tipe || (jenis === "Praktik" ? "Mata Kuliah Praktek" : "Mata Kuliah Teori"),
      bk: m.bk && m.bk.length ? m.bk : bkMk.filter((r) => r.mk === m.kode).map((r => r.bk)),
      cpl: m.cpl && m.cpl.length ? m.cpl : cplMk.filter((r) => r.mk === m.kode).map((r => r.cpl)),
      cpmk: m.cpmk && m.cpmk.length ? m.cpmk : [...new Set(mkCpmk.filter((r) => r.mk === m.kode).map((r => r.cpmk)))],
      prasyarat: m.prasyarat || [],
    };
  });

  // CPMK (42 butir)
  const cpmk = (data.cpmk || []).map((c) => ({
    ...c,
    nama: c.nama || c.deskripsi || c.kode,
    deskripsi: c.deskripsi || c.nama || "",
    mk: c.mk && c.mk.length ? c.mk : [...new Set(mkCpmk.filter((r) => r.cpmk === c.kode).map((r => r.mk)))],
    sub_cpmk: subCpmkList.filter((s) => s.cpmk === c.kode),
  }));

  // Initial audit logs dari 17 riwayat perbaikan
  let logs = data.logs;
  if (!logs || !logs.length) {
    logs = (data.riwayat_perbaikan || []).map((note, idx) => {
      let master = "all";
      const nLower = note.toLowerCase();
      if (nLower.includes("mk") || nLower.includes("semester") || note.includes("KRPL") || note.includes("URPL")) master = "mk";
      else if (nLower.includes("cpl")) master = "cpl";
      else if (nLower.includes("cpmk")) master = "cpmk";
      else if (nLower.includes("bk")) master = "bk";
      else if (nLower.includes("pl")) master = "pl";
      return {
        id: `LOG-OBE-${String(idx + 1).padStart(2, "0")}`,
        timestamp: "02 Nov 2026, 08.08",
        isoTimestamp: "2026-11-02T08:08:00.000Z",
        user: "Tim Pengembang Kurikulum",
        master,
        aksi: "ubah",
        kode: `REV-${String(idx + 1).padStart(2, "0")}`,
        nama: "Penyelarasan Data Kurikulum V1",
        keterangan: note,
        changes: [{ field: "kurikulum", label: "Perbaikan Sumber Data", old: "Tabel Excel Kur_OBE.V1", new: "Standardisasi database.json" }],
        detail: { catatan: note },
      };
    });
  }

  return {
    ...data,
    pl,
    cpl,
    bk,
    mk,
    cpmk,
    sub_cpmk: subCpmkList,
    logs,
  };
}

async function initDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object" && (saved.mata_kuliah || saved.mk)) {
        Object.assign(db, hydrateDb(saved));
        render();
        return;
      }
    }
    const res = await fetch("database.json");
    if (res.ok) {
      const data = await res.json();
      Object.assign(db, hydrateDb(data));
      saveDb();
    }
  } catch (e) {
    console.warn("Gagal memuat database.json:", e);
  }
  render();
}

// Menu Navigation Definition (12 modules + master data + audit log)
const MENU_GROUPS = [
  {
    title: "Data Master",
    items: [
      {
        id: "pl",
        label: "Profil Lulusan (PL)",
      },
      {
        id: "cpl",
        label: "Capaian Pembelajaran (CPL)",
      },
      { id: "bk", label: "Bahan Kajian (BK)" },
      { id: "mk", label: "Mata Kuliah (MK)" },
      {
        id: "cpmk",
        label: "Capaian MK (CPMK)",
      },
      {
        id: "sub_cpmk",
        label: "Sub-CPMK (170)",
      },
    ],
  },
  {
    title: "Riwayat & Audit Log",
    items: [
      { id: "log_master", label: "Riwayat Log Master" },
    ],
  },
  {
    title: "Matriks Relasi OBE",
    items: [
      { id: "cpl_pl", label: "Matriks CPL–PL" },
      { id: "cpl_bk", label: "Matriks CPL–BK" },
      { id: "bk_mk", label: "Matriks BK–MK" },
      { id: "cpl_mk", label: "Matriks CPL–MK" },
      {
        id: "bk_cpl_mk",
        label: "Matriks BK–CPL–MK",
      },
    ],
  },
  {
    title: "Struktur & Organisasi MK",
    items: [
      { id: "susunan_mk", label: "Susunan Mata Kuliah" },
      {
        id: "organisasi_mk",
        label: "Organisasi Mata Kuliah",
      },
    ],
  },
  {
    title: "Analisis & Pemenuhan CPL",
    items: [
      { id: "pemenuhan_cpl", label: "Pemenuhan CPL" },
      { id: "cpl_cpmk_mk", label: "CPL–CPMK–MK" },
      {
        id: "cpmk_semester",
        label: "CPMK per Semester",
      },
    ],
  },
];

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const $ = (id) => document.getElementById(id);

const nextCode = (t, pre) => {
  const n = db[t].filter((r) => r.kode.startsWith(pre)).length + 1;
  return pre + String(n).padStart(2, "0");
};

const nextCPMKCode = (cplKode) => {
  const numPart = cplKode.replace(/\D/g, "").padStart(2, "0");
  const pre = `CPMK${numPart}.`;
  const existing =
    db.cpmk.filter((c) => c.kode.startsWith(pre)).length + 1;
  return `${pre}${String(existing).padStart(2, "0")}`;
};

const mkCode = (kat) => {
  const p = kat === "Umum" ? "urpl" : "krpl";
  const n = db.mk.filter((r) => r.kode.startsWith(p + "25")).length + 1;
  return p + "25" + String(n).padStart(2, "0");
};

// Entity configuration for Master Data
const E = {
  pl: {
    group: "Data Master",
    label: "Profil Lulusan (PL)",
    add: "Tambah PL",
    lead: "Gambaran peran profesional yang akan dijalani lulusan TRPL di dunia kerja (4 Profil Lulusan D4 TRPL). PL merupakan fondasi utama perumusan seluruh CPL.",
    pre: "PL",
    fields: [
      { k: "kode", l: "Kode PL", h: "Format standar: PL1, PL2, PL3, PL4." },
      { k: "deskripsi", l: "Profil Lulusan (PL) Prodi", t: "area" },
      { k: "profesi", l: "Profesi", opt: 1, h: "Contoh: Associate Software Engineer, Associate AI engineer" },
      { k: "profesi_detail", l: "Detail Profesi", opt: 1, h: "Contoh: Web developer, back end developer, front end developer, mobile programmer, sistem analis" },
    ],
    cols: [
      "Kode",
      "Profil Lulusan (PL) Prodi",
      "Profesi",
      "Detail Profesi",
      "CPL Terkait",
    ],
    row: (r) => {
      const assigned =
        r.cpl ||
        (db.cpl || [])
          .filter((c) => c.pl && c.pl.includes(r.kode))
          .map((c) => c.kode);
      return [
        `<span class="kode">${esc(r.kode)}</span>`,
        `<span style="line-height:1.5">${esc(r.deskripsi || r.profil_lulusan || "")}</span>`,
        r.profesi ? `<b>${esc(r.profesi)}</b>` : `<span style="color:var(--text-secondary)">-</span>`,
        r.profesi_detail ? `<span style="color:var(--text-secondary);font-size:13px;line-height:1.4">${esc(r.profesi_detail)}</span>` : `<span style="color:var(--text-secondary)">-</span>`,
        assigned.length
          ? `<div class="pl-list">${assigned
              .map((c) => {
                const cpl = (db.cpl || []).find((x) => x.kode === c);
                return `<div class="pl-row"><span class="tag neutral" title="${cpl ? esc(cpl.nama) : ""}">${esc(c)}</span>${cpl ? `<span class="pl-name">${esc(cpl.nama)}</span>` : ""}</div>`;
              })
              .join("")}</div>`
          : `<span class="tag warn">Belum ada CPL</span>`,
      ];
    },
  },
  cpl: {
    group: "Data Master",
    label: "Capaian Pembelajaran Lulusan (CPL)",
    add: "Tambah CPL",
    lead: "Kemampuan terukur yang harus dikuasai oleh setiap lulusan TRPL. Setiap CPL wajib diturunkan dari minimal satu Profil Lulusan (PL).",
    pre: "CPL",
    fields: [
      {
        k: "kode",
        l: "Kode CPL",
        h: "Format standar: CPL01, CPL02, dst.",
      },
      { k: "nama", l: "Pernyataan Capaian Pembelajaran" },
      {
        k: "jenis",
        l: "Jenis Kompetensi",
        t: "sel",
        o: ["Hard skill", "Soft skill"],
      },
      {
        k: "pl",
        l: "Diturunkan dari Profil Lulusan (PL)",
        t: "multi",
        h: "Pilih minimal satu PL yang mendasari CPL ini.",
      },
    ],
    cols: [
      "Kode",
      "Capaian Pembelajaran Lulusan (CPL)",
      "Jenis",
      "Profil Lulusan (PL)",
    ],
    row: (r) => [
      `<span class="kode">${esc(r.kode)}</span>`,
      `<b>${esc(r.nama || r.uraian)}</b>${r.sumber ? `<br><small style="color:var(--text-secondary)"><b>Rujukan:</b> ${esc(r.sumber.split('\n')[0])}</small>` : ""}`,
      `<span class="tag ${r.jenis === "Hard skill" ? "hard" : "softs"}">${r.jenis}</span>`,
      r.pl && r.pl.length
        ? `<div class="pl-list">${r.pl
            .map((p) => {
              const pl = (db.pl || []).find((x) => x.kode === p);
              return `<div class="pl-row"><span class="tag neutral">${esc(p)}</span>${pl ? `<span class="pl-name">${esc(pl.nama)}</span>` : ""}</div>`;
            })
            .join("")}</div>`
        : '<span class="tag warn">Belum ada PL</span>',
    ],
  },
  bk: {
    group: "Data Master",
    label: "Bahan Kajian (BK)",
    add: "Tambah BK",
    lead: "Materi kajian keilmuan yang dibutuhkan untuk mencapai CPL. Sesuai prinsip kurikulum OBE, setiap BK wajib diwadahi oleh minimal 1 Mata Kuliah.",
    pre: "BK",
    fields: [
      { k: "kode", l: "Kode BK", h: "Format standar: BK-01, BK-02, dst." },
      { k: "nama", l: "Nama Bahan Kajian" },
      { k: "deskripsi", l: "Cakupan Materi", t: "area", opt: 1 },
      {
        k: "mk",
        l: "Mata Kuliah Pengampu (Minimal 1 MK)",
        t: "multi-mk",
        h: "Pilih mata kuliah yang mengajarkan bahan kajian ini.",
      },
    ],
    cols: [
      "Kode",
      "Bahan Kajian & Cakupan",
      "Mata Kuliah Pengampu",
    ],
    row: (r) => {
      const assigned = r.mk || [];
      return [
        `<span class="kode">${esc(r.kode)}</span>`,
        `<b>${esc(r.nama)}</b>${r.kategori ? ` <span class="tag neutral" style="font-size:10.5px">${esc(r.kategori)}</span>` : ""}<br><span class="by">${esc(r.deskripsi || r.referensi || "")}</span>`,
        assigned.length
          ? `<div class="pl-list">${assigned
              .map((m) => {
                const mk = (db.mk || []).find((x) => x.kode === m);
                return `<div class="pl-row"><span class="tag neutral" title="${mk ? esc(mk.nama) : ""}">${esc(m)}</span>${mk ? `<span class="pl-name">${esc(mk.nama)}</span>` : ""}</div>`;
              })
              .join("")}</div>`
          : `<span class="tag warn">Belum ada MK (Null)</span>`,
      ];
    },
  },
  mk: {
    group: "Data Master",
    label: "Mata Kuliah (MK)",
    add: "Tambah MK",
    lead: "Daftar 46 mata kuliah program studi TRPL lengkap dengan kategori, distribusi SKS (Teori & Praktik), penempatan semester 1-8, dan prasyarat.",
    pre: "MK",
    fields: [
      {
        k: "kat",
        l: "Kategori MK",
        t: "sel",
        o: ["Inti RPL", "Umum"],
        h: "Awalan kode: KRPL untuk Inti RPL, URPL untuk Umum, IRPL untuk Magang.",
      },
      { k: "kode", l: "Kode MK", h: "Format: KRPL25xx / URPL25xx / IRPL25xx." },
      { k: "nama", l: "Nama Mata Kuliah" },
      { k: "sem", l: "Semester", t: "num", min: 1, max: 8, def: 1 },
      {
        k: "sksTeori",
        l: "SKS Teori (T)",
        t: "num",
        min: 0,
        max: 6,
        def: 1,
      },
      {
        k: "sksPrak",
        l: "SKS Praktik (P)",
        t: "num",
        min: 0,
        max: 12,
        def: 2,
      },
      {
        k: "jenis",
        l: "Bentuk Pelaksanaan",
        t: "sel",
        o: ["Praktik", "Teori"],
      },
      {
        k: "prasyarat",
        l: "Mata Kuliah Prasyarat (Opsional)",
        t: "multi-prereq",
      },
    ],
    cols: [
      "Kode",
      "Mata Kuliah",
      "Semester",
      "Kategori",
      "SKS (T / P / Total)",
      "Jenis",
      "Prasyarat",
    ],
    row: (r) => [
      `<span class="kode">${esc(r.kode)}</span>`,
      `<b>${esc(r.nama)}</b>${r.nama_en ? `<br><small style="color:var(--text-secondary);font-style:italic">${esc(r.nama_en)}</small>` : ""}`,
      `Sem ${r.sem || 1}`,
      `<span class="tag neutral">${r.kat}</span>`,
      `<b>${(r.sksTeori || 0) + (r.sksPrak || 0)} SKS</b> (${r.sksTeori || 0}T / ${r.sksPrak || 0}P)`,
      `<span class="tag ${r.jenis === "Praktik" ? "hard" : "softs"}">${r.jenis}</span>`,
      r.prasyarat && r.prasyarat.length
        ? r.prasyarat
            .map((p) => `<span class="tag neutral">${esc(p)}</span>`)
            .join("")
        : '<span style="color:var(--text-muted)">-</span>',
    ],
  },
  cpmk: {
    group: "Data Master",
    label: "Capaian Pembelajaran Mata Kuliah (CPMK)",
    add: "Tambah CPMK",
    lead: "Capaian pembelajaran spesifik yang diturunkan dari CPL dan diukur pada mata kuliah tertentu. Penomoran kode terstandarisasi CPMK.xx.y sesuai nomor CPL induk.",
    pre: "CPMK",
    fields: [
      {
        k: "cpl",
        l: "CPL Induk",
        t: "sel-cpl",
        h: "Pilih CPL yang diturunkan menjadi CPMK ini.",
      },
      {
        k: "mk",
        l: "Mata Kuliah Pengampu",
        t: "multi-mk",
        h: "Pilih MK yang mengukur CPMK ini.",
      },
      {
        k: "kode",
        l: "Kode CPMK (Terstandarisasi)",
        h: "Format standar: CPMK.xx.y, contoh CPMK.01.1",
      },
      { k: "nama", l: "Pernyataan Capaian Mata Kuliah" },
    ],
    cols: [
      "Kode CPMK",
      "Pernyataan Capaian MK",
      "CPL Induk",
      "Mata Kuliah Pengampu",
      "Sub-CPMK",
    ],
    row: (r) => {
      const assignedCpl = Array.isArray(r.cpl)
        ? r.cpl
        : r.cpl
          ? [r.cpl]
          : [];
      const assignedMk = Array.isArray(r.mk) ? r.mk : r.mk ? [r.mk] : [];
      const subList = r.sub_cpmk || (db.sub_cpmk || []).filter(s => s.cpmk === r.kode);
      return [
        `<span class="kode">${esc(r.kode)}</span>`,
        `<b>${esc(r.nama || r.deskripsi)}</b>`,
        assignedCpl.length
          ? `<div class="pl-list">${assignedCpl
              .map((c) => {
                const cpl = (db.cpl || []).find((x) => x.kode === c);
                return `<div class="pl-row"><span class="tag neutral" title="${cpl ? esc(cpl.nama) : ""}">${esc(c)}</span>${cpl ? `<span class="pl-name">${esc(cpl.nama)}</span>` : ""}</div>`;
              })
              .join("")}</div>`
          : `<span class="tag warn">Belum ada CPL</span>`,
        assignedMk.length
          ? `<div class="pl-list">${assignedMk
              .map((m) => {
                const mk = (db.mk || []).find((x) => x.kode === m);
                return `<div class="pl-row"><span class="tag neutral" title="${mk ? esc(mk.nama) : ""}">${esc(m)}</span>${mk ? `<span class="pl-name">${esc(mk.nama)}</span>` : ""}</div>`;
              })
              .join("")}</div>`
          : `<span class="tag warn">Belum ada MK (Null)</span>`,
        subList.length
          ? `<span class="tag neutral" style="background:#eff6ff;color:#1e40af;font-weight:600">${subList.length} Sub-CPMK</span>`
          : `<span style="color:var(--text-muted)">-</span>`,
      ];
    },
  },
  sub_cpmk: {
    group: "Data Master",
    label: "Sub-CPMK (Kemampuan Akhir)",
    add: "Tambah Sub-CPMK",
    lead: "Kemampuan akhir yang direncanakan pada tiap tahap pembelajaran (170 Sub-CPMK). Dirumuskan berdasarkan CPL dan CPMK, serta mengacu pada unit kompetensi SKKNI.",
    pre: "Sub-CPMK",
    fields: [
      { k: "kode", l: "Kode Sub-CPMK", h: "Format standar: Sub-CPMK.xx.y.z" },
      { k: "cpl", l: "CPL Induk", t: "sel-cpl" },
      { k: "cpmk", l: "CPMK Induk" },
      { k: "deskripsi", l: "Pernyataan Kemampuan Akhir", t: "area" },
      { k: "unit_skkni", l: "Unit SKKNI Acuan", opt: 1 },
    ],
    cols: [
      "Kode Sub-CPMK",
      "Kemampuan Akhir (Sub-CPMK)",
      "CPL & CPMK Induk",
      "Acuan Unit SKKNI",
    ],

    row: (r) => [
      `<span class="kode" style="font-size:12px">${esc(r.kode)}</span>`,
      `<b>${esc(r.deskripsi || r.nama)}</b>`,
      `<div class="pl-list">
        <span class="tag neutral" title="CPL Induk">${esc(r.cpl)}</span>
        <span class="tag neutral" style="background:#e0f2fe;color:#0369a1" title="CPMK Induk">${esc(r.cpmk)}</span>
      </div>`,
      r.unit_skkni
        ? `<span class="tag hard" style="font-size:11px" title="Unit SKKNI">${esc(r.unit_skkni)}</span>`
        : `<span style="color:var(--text-muted);font-size:11px">-</span>`,
    ],
  },
};

let tab = "pl";
let edit = null;
let form = {};

function toast() {
  // Notifikasi dinonaktifkan sepenuhnya
}

function isMobile() {
  return window.innerWidth <= 820;
}

function toggleSidebar() {
  const app = document.querySelector(".app");
  const btn = $("toggle-sidebar");
  if (isMobile()) {
    app.classList.toggle("sidebar-mobile-open");
    const isOpen = app.classList.contains("sidebar-mobile-open");
    if (btn) btn.setAttribute("aria-expanded", isOpen);
  } else {
    app.classList.toggle("sidebar-hidden");
    const isHidden = app.classList.contains("sidebar-hidden");
    if (btn) btn.setAttribute("aria-expanded", !isHidden);
  }
}

function closeMobileSidebar() {
  const app = document.querySelector(".app");
  if (app.classList.contains("sidebar-mobile-open")) {
    app.classList.remove("sidebar-mobile-open");
    const btn = $("toggle-sidebar");
    if (btn && isMobile()) btn.setAttribute("aria-expanded", "false");
  }
}

function nav() {
  $("aside-nav").innerHTML = MENU_GROUPS.map(
    (g) => `
<h6>${g.title}</h6>
<div>
${g.items
  .map((it) => {
    const isCur =
      it.id === tab ||
      (it.id === "log_master" &&
        (tab === "log_master" || tab.startsWith("log_")));
    return `<button class="nav" ${isCur ? 'aria-current="page"' : ""} data-t="${it.id}">${it.label}</button>`;
  })
  .join("")}
</div>
`,
  ).join("");
}

const MASTER_META = {
  all: {
    name: "Seluruh Master",
    short: "Semua",
    badge: "ALL",
    desc: "seluruh data master kurikulum TRPL",
  },
  pl: {
    name: "Profil Lulusan (PL)",
    short: "PL",
    badge: "PL",
    desc: "Profil Lulusan (PL)",
  },
  cpl: {
    name: "Capaian Pembelajaran (CPL)",
    short: "CPL",
    badge: "CPL",
    desc: "Capaian Pembelajaran Lulusan (CPL)",
  },
  bk: {
    name: "Bahan Kajian (BK)",
    short: "BK",
    badge: "BK",
    desc: "Bahan Kajian (BK)",
  },
  mk: {
    name: "Mata Kuliah (MK)",
    short: "MK",
    badge: "MK",
    desc: "Mata Kuliah (MK)",
  },
  cpmk: {
    name: "Capaian MK (CPMK)",
    short: "CPMK",
    badge: "CPMK",
    desc: "Capaian Pembelajaran Mata Kuliah (CPMK)",
  },
  sub_cpmk: {
    name: "Sub-CPMK (Kemampuan Akhir)",
    short: "Sub-CPMK",
    badge: "Sub-CPMK",
    desc: "Kemampuan akhir tahapan pembelajaran (Sub-CPMK)",
  },
};

let logMasterFilter = "all";
let logActionFilter = "";
let logUserFilter = "";
let logSearchQuery = "";
let logTimeFilter = "all"; // 'all', 'today', 'yesterday', 'last7', 'last30', 'thisMonth', 'custom'
let logDateStart = "";     // YYYY-MM-DD
let logDateEnd = "";       // YYYY-MM-DD
let logSortOrder = "desc"; // 'desc' (terbaru) or 'asc' (terlama)

function formatDateShort(isoDateStr) {
  if (!isoDateStr) return "";
  const [y, m, d] = isoDateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${months[m - 1]} ${y}`;
}

function parseLogDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr) ? null : dateStr;

  const idMonths = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, ags: 7, agt: 7, agustus: 7, aug: 7,
    sep: 8, sept: 8, september: 8,
    okt: 9, oktober: 9, oct: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11,
  };

  const m = String(dateStr)
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[,\s]+(\d{1,2})[.:](\d{1,2}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monStr = m[2].toLowerCase();
    const year = parseInt(m[3], 10);
    const hour = m[4] != null ? parseInt(m[4], 10) : 0;
    const min = m[5] != null ? parseInt(m[5], 10) : 0;
    const month = idMonths[monStr];
    if (month !== undefined) {
      return new Date(year, month, day, hour, min);
    }
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getLogTimeFilterRange(filterType, customStart, customEnd) {
  if (!filterType || filterType === "all") return null;

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (filterType === "today") {
    return { start: startOfDay(now), end: endOfDay(now), label: "Hari Ini" };
  }
  if (filterType === "yesterday") {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y), label: "Kemarin" };
  }
  if (filterType === "last7") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { start: startOfDay(s), end: endOfDay(now), label: "7 Hari Terakhir" };
  }
  if (filterType === "last30") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: startOfDay(s), end: endOfDay(now), label: "30 Hari Terakhir" };
  }
  if (filterType === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: startOfDay(s), end: endOfDay(e), label: "Bulan Ini" };
  }
  if (filterType === "custom") {
    let s = null;
    let e = null;
    if (customStart) {
      const [y, m, d] = customStart.split("-").map(Number);
      s = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    if (customEnd) {
      const [y, m, d] = customEnd.split("-").map(Number);
      e = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    let lbl = "Rentang Kustom";
    if (customStart && customEnd) {
      lbl = `${formatDateShort(customStart)} – ${formatDateShort(customEnd)}`;
    } else if (customStart) {
      lbl = `Mulai ${formatDateShort(customStart)}`;
    } else if (customEnd) {
      lbl = `Sampai ${formatDateShort(customEnd)}`;
    }
    return { start: s, end: e, label: lbl };
  }
  return null;
}

function updateLogResetBtn() {
  const btn = $("log-btn-reset");
  if (!btn) return;
  const hasFilter = Boolean(
    logSearchQuery ||
    logActionFilter ||
    logUserFilter ||
    logTimeFilter !== "all" ||
    logDateStart ||
    logDateEnd ||
    logSortOrder !== "desc"
  );
  btn.style.display = hasFilter ? "inline-flex" : "none";
}

function getFieldLabel(t, k) {
  const labels = {
    kode: "Kode",
    nama: "Nama / Judul",
    deskripsi: "Deskripsi / Cakupan",
    jenis: "Jenis / Bentuk",
    kat: "Kategori MK",
    sks: "Total SKS",
    sksTeori: "SKS Teori",
    sksPrak: "SKS Praktik",
    sem: "Semester",
    prasyarat: "Mata Kuliah Prasyarat",
    pl: "Profil Lulusan Terkait",
    bk: "Bahan Kajian Terkait",
    mk: "Mata Kuliah Terkait",
    cpl: "CPL Terkait",
    cpmk: "CPMK Induk",
    unit_skkni: "Unit SKKNI",
    profesi_detail: "Rincian Jabatan",
  };
  return labels[k] || k;
}

function formatVal(v) {
  if (v == null || v === "")
    return '<span style="color:var(--text-muted)">- Kosong -</span>';
  if (Array.isArray(v)) {
    if (!v.length)
      return '<span style="color:var(--text-muted)">- Tidak ada -</span>';
    return v
      .map((item) => `<span class="tag neutral">${esc(item)}</span>`)
      .join(" ");
  }
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  return esc(String(v));
}

function addAuditLog({
  master,
  aksi,
  kode,
  nama,
  keterangan,
  changes = [],
  detail = {},
}) {
  if (!db.logs) db.logs = [];
  const nextNum = db.logs.length + 1;
  const newLog = {
    id: "LOG-" + String(nextNum).padStart(3, "0"),
    master,
    masterLabel: MASTER_META[master]?.name || master.toUpperCase(),
    aksi,
    kode,
    nama: nama || kode,
    user: USER,
    at: stamp(),
    keterangan:
      keterangan ||
      `${aksi === "tambah" ? "Menambahkan" : aksi === "ubah" ? "Mengubah" : "Menghapus"} data ${kode}`,
    changes,
    detail,
  };
  db.logs.unshift(newLog);
  saveDb();
  return newLog;
}

// Master Router for Rendering Views
function render() {
  nav();
  const q = $("q").value.trim().toLowerCase();
  const isMaster = tab in E;
  const isLog = tab === "log_master" || tab.startsWith("log_");

  if (isMaster) {
    renderMaster(tab, q);
  } else if (isLog) {
    renderLogPage(tab);
  } else if (tab === "cpl_pl") {
    renderMatrixCplPl();
  } else if (tab === "cpl_bk") {
    renderMatrixCplBk();
  } else if (tab === "bk_mk") {
    renderMatrixBkMk();
  } else if (tab === "cpl_mk") {
    renderMatrixCplMk();
  } else if (tab === "bk_cpl_mk") {
    renderMatrixBkCplMk();
  } else if (tab === "susunan_mk") {
    renderSusunanMk();
  } else if (tab === "organisasi_mk") {
    renderOrganisasiMk();
  } else if (tab === "pemenuhan_cpl") {
    renderPemenuhanCpl();
  } else if (tab === "cpl_cpmk_mk") {
    renderCplCpmkMk();
  } else if (tab === "cpmk_semester") {
    renderCpmkSemester();
  } else {
    renderMatrixOrSpecialView(tab, q);
  }
}

// 1. Render Master Tables (PL, CPL, BK, MK, CPMK)
function renderMaster(t, q) {
  if ($("log-header-container"))
    $("log-header-container").innerHTML = "";

  const e = E[t];
  $("crumb").textContent = `${e.group} / ${e.label}`;
  $("title").textContent = e.label;
  $("lead").textContent = e.lead;
  $("bar").style.display = "flex";
  $("add").style.display = "inline-flex";
  $("add").textContent = "+ " + e.add;

  const btnLog = $("btn-master-log");
  if (btnLog) {
    btnLog.style.display = "inline-flex";
    btnLog.dataset.targetLogMaster = t;
    btnLog.dataset.t = "log_master";
    const masterShort = MASTER_META[t]?.short || e.pre || t.toUpperCase();
    btnLog.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      Riwayat Log ${masterShort}
    `;
  }

  const f = $("flt");
  if (f) {
    f.hidden = true;
    f.style.display = "none";
  }

  const rows = (db[t] || [])
    .map((r, i) => [r, i])
    .filter(
      ([r]) =>
        !q ||
        (
          r.kode +
          " " +
          (r.nama || "") +
          " " +
          (r.deskripsi || "") +
          " " +
          (r.profesi || "") +
          " " +
          (r.profesi_detail || "") +
          " " +
          (r.unit_skkni || "")
        )
          .toLowerCase()
          .includes(q),
    );

  $("view-container").innerHTML = `
<div class="scroll">
<table>
  <thead id="th"><tr>${e.cols.map((c) => `<th>${c}</th>`).join("")}<th>Aksi</th></tr></thead>
  <tbody id="tb">${rows
    .map(
      ([r, i]) =>
        `<tr>${e
          .row(r)
          .map((c) => `<td>${c}</td>`)
          .join(
            "",
          )}<td><div class="act"><button class="ib" data-e="${i}">Ubah</button><button class="ib del" data-d="${i}">Hapus</button></div></td></tr>`,
    )
    .join("")}</tbody>
</table>
</div>
<div id="empty">${rows.length ? "" : `<div class="empty"><b>${q ? "Tidak ada data yang cocok" : "Belum ada data"}</b><br>${q ? "Ubah kata kunci pencarian." : "Klik “" + e.add + "” untuk mulai mengisi."}</div>`}</div>
<div class="foot" id="foot">Menampilkan ${rows.length} dari ${db[t].length} data</div>
`;
}

// 2. Render Riwayat Log Master Page
function renderLogPage(activeTab) {
  if (activeTab === "log_pl") logMasterFilter = "pl";
  else if (activeTab === "log_cpl") logMasterFilter = "cpl";
  else if (activeTab === "log_bk") logMasterFilter = "bk";
  else if (activeTab === "log_mk") logMasterFilter = "mk";
  else if (activeTab === "log_cpmk") logMasterFilter = "cpmk";
  else if (activeTab === "log_master") {
    if (!logMasterFilter) logMasterFilter = "all";
  }

  const meta = MASTER_META[logMasterFilter] || MASTER_META.all;
  $("crumb").textContent = "Riwayat & Audit Log / " + meta.name;
  $("title").textContent = "Riwayat Log " + meta.name;
  $("lead").textContent =
    "Audit trail dan rekam jejak aktivitas perubahan " +
    meta.desc +
    " kurikulum TRPL sesuai standar akreditasi dan tata kelola akademik OBE.";
  $("bar").style.display = "none";
  const btnLog = $("btn-master-log");
  if (btnLog) btnLog.style.display = "none";

  const allLogs = db.logs || [];
  const scopedLogs =
    logMasterFilter === "all"
      ? allLogs
      : allLogs.filter((l) => l.master === logMasterFilter);

  const totalCount = scopedLogs.length;
  const addCount = scopedLogs.filter((l) => l.aksi === "tambah").length;
  const editCount = scopedLogs.filter((l) => l.aksi === "ubah").length;
  const delCount = scopedLogs.filter((l) => l.aksi === "hapus").length;

  const masterKeys = ["all", "pl", "cpl", "bk", "mk", "cpmk", "sub_cpmk"];
  const masterCounts = {
    all: allLogs.length,
    pl: allLogs.filter((l) => l.master === "pl").length,
    cpl: allLogs.filter((l) => l.master === "cpl").length,
    bk: allLogs.filter((l) => l.master === "bk").length,
    mk: allLogs.filter((l) => l.master === "mk").length,
    cpmk: allLogs.filter((l) => l.master === "cpmk").length,
    sub_cpmk: allLogs.filter((l) => l.master === "sub_cpmk").length,
  };

  // Render Header: Stats Cards & Segmented Master Tabs
  $("log-header-container").innerHTML = `
    <div class="log-stats-grid">
      <div class="log-stat-card">
        <div class="log-stat-icon all">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="log-stat-info">
          <span class="log-stat-value">${totalCount}</span>
          <span class="log-stat-label">Total Aktivitas Log</span>
        </div>
      </div>
      <div class="log-stat-card">
        <div class="log-stat-icon add">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </div>
        <div class="log-stat-info">
          <span class="log-stat-value">${addCount}</span>
          <span class="log-stat-label">Data Ditambahkan</span>
        </div>
      </div>
      <div class="log-stat-card">
        <div class="log-stat-icon edit">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </div>
        <div class="log-stat-info">
          <span class="log-stat-value">${editCount}</span>
          <span class="log-stat-label">Data Diperbarui</span>
        </div>
      </div>
      <div class="log-stat-card">
        <div class="log-stat-icon del">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </div>
        <div class="log-stat-info">
          <span class="log-stat-value">${delCount}</span>
          <span class="log-stat-label">Data Dihapus</span>
        </div>
      </div>
    </div>

    <div class="log-master-tabs">
      ${masterKeys
        .map(
          (k) => `
        <button class="log-tab-btn ${k === logMasterFilter ? "active" : ""}" data-log-master="${k}">
          <span>${esc(MASTER_META[k].name)}</span>
          <span class="log-tab-count">${masterCounts[k]}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;

  const hasFilter = Boolean(
    logSearchQuery ||
    logActionFilter ||
    logUserFilter ||
    logTimeFilter !== "all" ||
    logDateStart ||
    logDateEnd ||
    logSortOrder !== "desc"
  );

  $("view-container").innerHTML = `
    <div class="log-toolbar">
      <div class="log-search-box" style="flex:1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 14z"/>
        </svg>
        <input id="log-q" type="search" placeholder="Cari kode, nama, user, atau keterangan..." value="${esc(logSearchQuery)}" aria-label="Cari Log">
      </div>
    </div>

    <div id="log-table-area"></div>
  `;

  renderLogTable();
}

function renderLogTable() {
  const allLogs = db.logs || [];
  const scopedLogs =
    logMasterFilter === "all"
      ? allLogs
      : allLogs.filter((l) => l.master === logMasterFilter);

  const timeRange = getLogTimeFilterRange(logTimeFilter, logDateStart, logDateEnd);

  const filtered = scopedLogs.filter((l) => {
    if (logSearchQuery) {
      const qStr = (
        l.id +
        " " +
        l.kode +
        " " +
        (l.nama || "") +
        " " +
        (l.keterangan || "") +
        " " +
        l.user +
        " " +
        l.masterLabel +
        " " +
        (l.at || "")
      ).toLowerCase();
      if (!qStr.includes(logSearchQuery)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const dateA = parseLogDate(a.at);
    const dateB = parseLogDate(b.at);
    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;
    return logSortOrder === "asc" ? timeA - timeB : timeB - timeA;
  });

  const clearBtn = $("log-btn-clear-date");
  if (clearBtn) {
    clearBtn.style.display = logDateStart || logDateEnd ? "inline-flex" : "none";
  }

  const area = $("log-table-area");
  if (!area) return;

  area.innerHTML = `
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th style="width:125px">ID & Waktu</th>
            <th style="width:95px">Master</th>
            <th style="width:105px">Aksi</th>
            <th style="min-width:180px">Entitas Terkait</th>
            <th style="min-width:280px">Keterangan & Perubahan</th>
            <th style="width:170px">Pengguna</th>
            <th style="width:80px">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((l) => {
              const initials = (l.user || "TK")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const changeSnippet =
                l.changes && l.changes.length
                  ? `<div class="log-changes-snippet">
                      ${l.changes
                        .slice(0, 3)
                        .map(
                          (c) =>
                            `<span class="log-change-chip"><b>${esc(c.label || c.field)}</b>${c.old != null && c.new != null ? `: ${esc(String(c.old))} &rarr; ${esc(String(c.new))}` : ""}</span>`,
                        )
                        .join("")}
                      ${l.changes.length > 3 ? `<span class="log-change-chip">+${l.changes.length - 3} lainnya</span>` : ""}
                    </div>`
                  : "";

              return `
                <tr>
                  <td>
                    <span class="kode" style="font-size:12px;color:var(--text-muted)">${esc(l.id)}</span>
                    <span class="by" style="font-weight:500;color:var(--text)">${esc(l.at)}</span>
                  </td>
                  <td>
                    <span class="badge-master ${l.master}">${esc(MASTER_META[l.master]?.short || l.master)}</span>
                  </td>
                  <td>
                    <span class="badge-action ${l.aksi}">
                      ${l.aksi === "tambah" ? "Tambah" : l.aksi === "ubah" ? "Ubah" : "Hapus"}
                    </span>
                  </td>
                  <td>
                    <span class="kode">${esc(l.kode)}</span><br>
                    <b>${esc(l.nama)}</b>
                  </td>
                  <td>
                    <span>${esc(l.keterangan)}</span>
                    ${changeSnippet}
                  </td>
                  <td>
                    <div class="log-user-pill">
                      <span class="log-user-av">${esc(initials)}</span>
                      <span>${esc(l.user)}</span>
                    </div>
                  </td>
                  <td>
                    <button class="ib" data-log-id="${esc(l.id)}" title="Lihat detail riwayat perubahan">Detail</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <div id="log-empty">
      ${
        filtered.length
          ? ""
          : `<div class="empty">
              <b>Tidak ada riwayat log yang sesuai</b><br>
              Coba sesuaikan kata kunci pencarian, filter master, filter waktu, atau filter aksi.
            </div>`
      }
    </div>
    <div class="foot" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <span>Menampilkan <b>${filtered.length}</b> dari <b>${scopedLogs.length}</b> riwayat log (${MASTER_META[logMasterFilter]?.name || "Master"})</span>
      ${
        timeRange
          ? `<span class="log-foot-filter-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Filter Waktu: <b>${esc(timeRange.label)}</b>
            </span>`
          : ""
      }
    </div>
  `;
}

function openLogDetail(logId) {
  const l = (db.logs || []).find((x) => x.id === logId);
  if (!l) return;

  const initials = (l.user || "TK")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  let detailSection = "";

  if (l.aksi === "ubah") {
    if (l.changes && l.changes.length) {
      detailSection = `
        <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:var(--text)">Perbandingan Perubahan Nilai:</h3>
        <table class="log-diff-table">
          <thead>
            <tr>
              <th>Atribut / Kolom</th>
              <th>Sebelum Perubahan</th>
              <th>Sesudah Perubahan</th>
            </tr>
          </thead>
          <tbody>
            ${l.changes
              .map(
                (c) => `
              <tr>
                <td><b>${esc(c.label || c.field)}</b></td>
                <td><span class="log-diff-old">${formatVal(c.old)}</span></td>
                <td><span class="log-diff-new">${formatVal(c.new)}</span></td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      detailSection = `<p class="s">Data diperbarui tanpa perubahan field utama.</p>`;
    }
  } else if (l.aksi === "tambah") {
    const snapshot = l.detail || {};
    detailSection = `
      <h3 style="font-size:14px;font-weight:600;margin:16px 0 8px;color:var(--text)">Snapshot Data Yang Dibuat:</h3>
      <div class="log-snapshot-grid">
        ${Object.keys(snapshot)
          .filter((k) => k !== "by" && k !== "at")
          .map(
            (k) => `
          <div class="log-snapshot-item">
            <label>${esc(getFieldLabel(l.master, k))}</label>
            <strong>${formatVal(snapshot[k])}</strong>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } else if (l.aksi === "hapus") {
    const snapshot = l.detail || {};
    detailSection = `
      <div class="banner" style="margin:14px 0 10px;background:var(--danger-bg);color:var(--danger);border-color:var(--danger)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <span>Entitas ini telah dihapus permanen dari kurikulum aktif TRPL dan tercatat dalam arsip audit log.</span>
      </div>
      <h3 style="font-size:14px;font-weight:600;margin:14px 0 8px;color:var(--text)">Snapshot Terakhir Sebelum Dihapus:</h3>
      <div class="log-snapshot-grid">
        ${Object.keys(snapshot)
          .filter((k) => k !== "by" && k !== "at")
          .map(
            (k) => `
          <div class="log-snapshot-item">
            <label>${esc(getFieldLabel(l.master, k))}</label>
            <strong>${formatVal(snapshot[k])}</strong>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  open(`
    <div class="log-modal">
      <h2>Detail Riwayat Log #${esc(l.id)}</h2>
      <p class="s">Catatan aktivitas perubahan data master pada kurikulum TRPL Politeknik Astra.</p>

      <div class="log-modal-header-card">
        <div>
          <span class="badge-master ${l.master}" style="margin-right:6px">${esc(MASTER_META[l.master]?.name || l.master)}</span>
          <span class="badge-action ${l.aksi}">${l.aksi === "tambah" ? "Ditambahkan" : l.aksi === "ubah" ? "Diperbarui" : "Dihapus"}</span>
          <div class="log-modal-entity" style="margin-top:6px">${esc(l.kode)} – ${esc(l.nama)}</div>
        </div>
        <div class="log-user-pill">
          <span class="log-user-av">${esc(initials)}</span>
          <div style="line-height:1.2">
            <div style="font-weight:600;font-size:12px">${esc(l.user)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${esc(l.at)}</div>
          </div>
        </div>
      </div>

      <div style="font-size:13px;line-height:1.5;margin-bottom:12px;color:var(--text)">
        <strong>Keterangan Aktivitas:</strong><br>
        <span style="color:var(--text-secondary)">${esc(l.keterangan)}</span>
      </div>

      ${detailSection}

      <div class="mf" style="margin-top:24px">
        <button class="btn" data-x style="margin:0">Tutup Detail</button>
      </div>
    </div>
  `);
}

// Helper: Menemukan metadata modul dari MENU_GROUPS
function getMenuModule(id) {
  for (const g of MENU_GROUPS) {
    const item = g.items.find((it) => it.id === id);
    if (item) return { group: g.title, label: item.label };
  }
  return { group: "Kurikulum OBE", label: id };
}

// ==========================================================
// MATRIKS CPL-PL (2D)
// ==========================================================
let matrixSearch = "";
let matrixJenisFilter = "all";
let matrixStatusFilter = "all";
// ==========================================================
// UNIFIED 2D RELATION MATRIX TEMPLATE ENGINE (OBE)
// ==========================================================
const matrixState = {
  search: { cpl_pl: "", cpl_bk: "", bk_mk: "", cpl_mk: "" },
  interactive: { cpl_pl: false, cpl_bk: false, bk_mk: false, cpl_mk: false }
};

let matrixHoverCol = null;



const MATRIX_CONFIGS = {
  cpl_pl: {
    id: "cpl_pl",
    crumb: "Matriks Relasi OBE / Matriks CPL–PL",
    title: "Matriks Relasi CPL – Profil Lulusan (2D)",
    lead: "Pemetaan dua dimensi antara Capaian Pembelajaran Lulusan (CPL) dan Profil Lulusan (PL) TRPL. Memastikan setiap profil lulusan didukung oleh kompetensi yang tepat sesuai standar OBE.",
    rowEntity: "cpl",
    colEntity: "pl",
    relationField: "pl",
    rowCodeLabel: "Kode CPL",
    rowNameLabel: "Pernyataan Capaian Pembelajaran Lulusan (CPL)",
    colLabel: "PL",
    searchPlaceholder: "Cari CPL (kode / kata kunci)...",
    rowFilter: (c) => true,
    colFilter: (p) => !String(p.kode).includes("ALT"),
    colBtnClass: "pl-head-btn",
    colDataAttr: "data-matrix-pl-info",
    legendTitle: "Keterangan Matriks:",
    legendLinked: "Mendukung Profil Lulusan",
    legendUnlinked: "Tidak Berkaitan Langsung",
    obePassMsg: "Semua CPL & PL memiliki relasi",
    obeGuideModalId: "cpl_pl"
  },
  cpl_bk: {
    id: "cpl_bk",
    crumb: "Matriks Relasi OBE / Matriks CPL–BK",
    title: "Matriks Relasi CPL – Bahan Kajian (CPL–BK)",
    lead: "Pemetaan dua dimensi antara Capaian Pembelajaran Lulusan (CPL) dan Bahan Kajian (BK / Body of Knowledge). Menentukan bidang keilmuan yang esensial untuk membentuk setiap kompetensi lulusan.",
    rowEntity: "cpl",
    colEntity: "bk",
    relationField: "bk",
    rowCodeLabel: "Kode CPL",
    rowNameLabel: "Capaian Pembelajaran Lulusan (CPL)",
    colLabel: "BK",
    searchPlaceholder: "Cari CPL (kode / kata kunci)...",
    colBtnClass: "bk-head-btn",
    colDataAttr: "data-matrix-bk-info",
    legendTitle: "Keterangan Matriks:",
    legendLinked: "Bahan Kajian Mendukung CPL",
    legendUnlinked: "Tidak Terhubung Langsung",
    obePassMsg: "Semua CPL & BK saling terhubung",
    obeGuideModalId: "cpl_bk"
  },
  bk_mk: {
    id: "bk_mk",
    crumb: "Matriks Relasi OBE / Matriks BK–MK",
    title: "Matriks Pengemasan Bahan Kajian ke Mata Kuliah (BK–MK)",
    lead: "Pemetaan pengemasan materi Bahan Kajian (BK) ke dalam unit pembelajaran Mata Kuliah (MK). Aturan OBE: Tidak boleh ada Bahan Kajian yang berdiri tanpa Mata Kuliah (Orphan BK = 0, minimal 1 MK).",
    rowEntity: "bk",
    colEntity: "mk",
    relationField: "mk",
    rowCodeLabel: "Kode BK",
    rowNameLabel: "Bahan Kajian (Materi & Pokok Bahasan)",
    colLabel: "MK",
    searchPlaceholder: "Cari BK (kode / kata kunci)...",
    colBtnClass: "mk-head-btn",
    colDataAttr: "data-matrix-mk-info",
    legendTitle: "Keterangan Matriks:",
    legendLinked: "Bahan Kajian Dikemas ke Mata Kuliah",
    legendUnlinked: "Tidak Dikemas",
    obePassMsg: "0 BK kosong (Semua BK memiliki MK)",
    obeGuideModalId: "bk_mk"
  },
  cpl_mk: {
    id: "cpl_mk",
    crumb: "Matriks Relasi OBE / Matriks CPL–MK",
    title: "Matriks Beban CPL pada Mata Kuliah (CPL–MK)",
    lead: "Pemetaan beban Capaian Pembelajaran Lulusan (CPL) pada setiap Mata Kuliah kurikulum TRPL. Mengidentifikasi kontribusi mata kuliah terhadap capaian profil lulusan.",
    rowEntity: "cpl",
    colEntity: "mk",
    relationField: "mk",
    rowCodeLabel: "Kode CPL",
    rowNameLabel: "Capaian Pembelajaran Lulusan (CPL)",
    colLabel: "MK",
    searchPlaceholder: "Cari CPL (kode / kata kunci)...",
    colBtnClass: "mk-head-btn",
    colDataAttr: "data-matrix-mk-info",
    legendTitle: "Keterangan Matriks:",
    legendLinked: "CPL Dibebankan pada Mata Kuliah",
    legendUnlinked: "Tidak Dibebankan",
    obePassMsg: "Semua CPL & MK memiliki keterkaitan",
    obeGuideModalId: "cpl_mk"
  }
};

function renderMatrix2D(cfgKey) {
  const cfg = MATRIX_CONFIGS[cfgKey];
  if (!cfg) return;

  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = cfg.crumb;
  $("title").textContent = cfg.title;
  $("lead").textContent = cfg.lead;
  $("bar").style.display = "none";

  const allRows = (db[cfg.rowEntity] || []).filter(cfg.rowFilter || (() => true));
  const allCols = (db[cfg.colEntity] || []).filter(cfg.colFilter || (() => true));

  let totalActiveLinks = 0;
  let orphanRowCount = 0;
  let orphanColCount = 0;

  allRows.forEach((r) => {
    const links = (r[cfg.relationField] || []).length;
    totalActiveLinks += links;
    if (links === 0) orphanRowCount++;
  });

  allCols.forEach((col) => {
    const sup = allRows.filter((r) => (r[cfg.relationField] || []).includes(col.kode)).length;
    if (sup === 0) orphanColCount++;
  });

  const isObeCompliant = orphanRowCount === 0 && orphanColCount === 0;
  const isInteractive = Boolean(matrixState.interactive[cfgKey]);
  const searchQuery = (matrixState.search[cfgKey] || "").toLowerCase();

  const filteredRows = allRows.filter((r) => {
    if (!searchQuery) return true;
    const term = (r.kode + " " + (r.nama || "") + " " + (r.deskripsi || "") + " " + (r.jenis || "") + " " + (r.kategori || "")).toLowerCase();
    return term.includes(searchQuery);
  });

  // Calculate stats cards values
  let stat1Sub = "";
  if (cfg.rowEntity === "cpl") {
    const hardCount = allRows.filter((c) => c.jenis === "Hard skill").length;
    const softCount = allRows.filter((c) => c.jenis === "Soft skill").length;
    stat1Sub = hardCount + " Hard skill &bull; " + softCount + " Soft skill";
  } else if (cfg.rowEntity === "bk") {
    stat1Sub = "Rumpun keilmuan wajib";
  }

  let stat2Sub = "";
  if (cfg.colEntity === "pl") {
    stat2Sub = "Seluruh profil aktif kurikulum";
  } else if (cfg.colEntity === "bk") {
    stat2Sub = "Rumpun keilmuan aktif kurikulum";
  } else if (cfg.colEntity === "mk") {
    const totalSks = allCols.reduce((acc, m) => acc + (parseInt(m.sks, 10) || 0), 0);
    stat2Sub = totalSks + " Total SKS &bull; 8 Semester";
  }

  const avgLinks = allCols.length ? (totalActiveLinks / allCols.length).toFixed(1) : "0";

  const renderedHtml = `
    <div class="matrix-view-wrap">
      <!-- 1. Top Stat Cards -->
      <div class="matrix-stats-grid">
        <div class="matrix-stat-card">
          <div class="matrix-stat-icon cpl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allRows.length} ${cfg.rowEntity.toUpperCase()}</span>
            <span class="matrix-stat-label">Total ${cfg.rowCodeLabel}</span>
            <span class="matrix-stat-sub">${stat1Sub}</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon pl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allCols.length} ${cfg.colEntity.toUpperCase()}</span>
            <span class="matrix-stat-label">Total ${cfg.colLabel}</span>
            <span class="matrix-stat-sub">${stat2Sub}</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon relation">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${totalActiveLinks} Tautan</span>
            <span class="matrix-stat-label">Relasi Aktif Terpetakan</span>
            <span class="matrix-stat-sub">Rata-rata ${avgLinks} ${cfg.rowEntity.toUpperCase()} per ${cfg.colEntity.toUpperCase()}</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon obe ${isObeCompliant ? "pass" : ""}">
            ${isObeCompliant
              ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
              : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
            }
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val" style="${isObeCompliant ? "color:var(--success)" : "color:var(--warning)"}">${isObeCompliant ? "100% Terpenuhi" : "Perlu Evaluasi"}</span>
            <span class="matrix-stat-label">Standar Validasi OBE</span>
            <span class="matrix-stat-sub">${isObeCompliant ? cfg.obePassMsg : (orphanRowCount + " " + cfg.rowEntity.toUpperCase() + " kosong, " + orphanColCount + " " + cfg.colEntity.toUpperCase() + " kosong")}</span>
          </div>
        </div>
      </div>

      <!-- 2. Interactive Control Toolbar -->
      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <div class="matrix-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              class="matrix-search-input"
              data-matrix-id="${cfg.id}"
              id="matrix-${cfg.id}-q"
              type="search"
              placeholder="${cfg.searchPlaceholder}"
              value="${esc(searchQuery)}"
              aria-label="${cfg.searchPlaceholder}"
            />
          </div>
        </div>

        <div class="matrix-toolbar-right">
          <button
            type="button"
            class="matrix-mode-badge ${isInteractive ? "active" : ""}"
            data-matrix-mode-toggle="${cfg.id}"
            id="matrix-${cfg.id}-toggle-mode"
            title="${isInteractive ? "Mode Edit Aktif (Klik untuk mematikan)" : "Mode Edit Mati (Klik untuk mengaktifkan)"}"
            role="switch"
            aria-checked="${isInteractive}"
          >
            <span class="matrix-mode-dot"></span>
            <span>Mode Edit</span>
          </button>

          <button
            type="button"
            class="matrix-btn-tool"
            data-matrix-guide="${cfg.id}"
            id="matrix-${cfg.id}-btn-guide"
            title="Lihat Panduan Standar OBE ${cfg.title}"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Panduan OBE
          </button>
        </div>
      </div>

      <!-- 3. Scrollable 2D Table Grid -->
      <div class="matrix-scroll-wrap" id="matrix-scroll-container">
        <table class="matrix-table ${isInteractive ? "" : "view-only"}">
          <thead>
            <tr>
              <th class="th-cpl-code" scope="col">${cfg.rowCodeLabel}</th>
              <th class="th-cpl-name" scope="col">${cfg.rowNameLabel}</th>
              ${allCols.map((col) => {
                const rowCount = allRows.filter((r) => (r[cfg.relationField] || []).includes(col.kode)).length;
                const semBadge = col.sem ? `<span class="tag neutral" style="font-size:10px;height:18px;line-height:16px;padding:0 4px;margin-right:2px">S${col.sem}</span>` : "";
                const sksSub = col.sks ? `<span style="font-size:10px;color:var(--text-muted);display:block;margin-top:2px">${col.sks} SKS</span>` : "";
                return `
                  <th class="th-col th-${cfg.colEntity}" data-col="${esc(col.kode)}" scope="col">
                    <button
                      type="button"
                      class="${cfg.colBtnClass}"
                      ${cfg.colDataAttr}="${esc(col.kode)}"
                      title="Klik untuk melihat detail: ${esc(col.kode)} &bull; ${esc(col.nama || col.profesi || col.deskripsi || '')}"
                    >
                      ${semBadge}
                      <span class="pl-head-code bk-head-code mk-head-code">${esc(col.kode)}</span>
                      ${sksSub}
                      <span class="matrix-tf-pill ${rowCount > 0 ? "" : "empty"}">${rowCount} ${cfg.rowEntity.toUpperCase()}</span>
                    </button>
                  </th>
                `;
              }).join("")}
            </tr>
          </thead>

          <tbody>
            ${filteredRows.length
              ? filteredRows.map((r) => {
                  const assignedCols = r[cfg.relationField] || [];
                  const isHard = r.jenis === "Hard skill";
                  const rowDetailAttr = cfg.rowEntity === "bk"
                    ? `data-matrix-bk-info="${esc(r.kode)}"`
                    : `data-matrix-cpl-info="${esc(r.kode)}"`;
                  
                  const rowBadge = cfg.rowEntity === "bk"
                    ? `<span class="tag neutral" style="font-size:11px;height:20px;line-height:18px;background:#f3f4f6">${esc(r.kategori || "Inti Keilmuan")} &bull; ${r.bobot || 0}%</span>`
                    : `<span class="tag ${isHard ? "hard" : "softs"}" style="font-size:11px;height:20px;line-height:18px">${esc(r.jenis || "Hard skill")}</span>`;

                  return `
                    <tr data-row="${esc(r.kode)}">
                      <td class="td-cpl-code">
                        <button
                          type="button"
                          class="matrix-cpl-btn ${cfg.rowEntity === "bk" ? "neutral" : (isHard ? "hard" : "softs")}"
                          ${rowDetailAttr}
                          title="Klik untuk melihat detail ${esc(r.kode)}"
                          style="${cfg.rowEntity === "bk" ? "background:#fef3c7;color:#b45309;border-color:#fde68a" : ""}"
                        >
                          ${esc(r.kode)}
                        </button>
                      </td>

                      <td class="td-cpl-name">
                        <div style="font-weight:500;color:var(--text);line-height:1.45">${esc(r.nama || r.deskripsi || "")}</div>
                        <div style="margin-top:4px">${rowBadge}</div>
                      </td>

                      ${allCols.map((col) => {
                        const isLinked = assignedCols.includes(col.kode);
                        return `
                          <td class="matrix-cell" data-col="${esc(col.kode)}" data-cell-row="${esc(r.kode)}" data-cell-col="${esc(col.kode)}">
                            <button
                              type="button"
                              class="matrix-btn ${isLinked ? "linked" : "unlinked"}"
                              data-matrix-id="${cfg.id}"
                              data-matrix-toggle-row="${esc(r.kode)}"
                              data-matrix-toggle-col="${esc(col.kode)}"
                              title="${esc(r.kode)} &bull; ${esc(col.kode)}: ${isLinked ? "Terhubung (Klik untuk melepas)" : "Belum terhubung (Klik untuk menghubungkan)"}"
                              aria-label="${esc(r.kode)} ke ${esc(col.kode)}: ${isLinked ? "Terhubung" : "Tidak Terhubung"}"
                            >
                              ${isLinked
                                ? '<span class="matrix-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>'
                                : `<span class="matrix-dash">&mdash;</span>
                                   <span class="matrix-btn-hover-label" title="Hubungkan">
                                     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                   </span>`
                              }
                            </button>
                          </td>
                        `;
                      }).join("")}
                    </tr>
                  `;
                }).join("")
              : `
                <tr>
                  <td colspan="${allCols.length + 2}" style="text-align:center;padding:48px 16px">
                    <div class="empty">
                      <b>Tidak ada data yang sesuai</b><br>
                      Coba sesuaikan kata kunci pencarian Anda.
                    </div>
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>

      <!-- 4. Guidance & Legend Footer Card -->
      <div class="matrix-guide-card">
        <div class="matrix-legend-items">
          <span style="font-weight:600;color:var(--text);font-size:12px">${cfg.legendTitle}</span>
          <div class="matrix-legend-item">
            <span class="matrix-legend-chip linked">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
            </span>
            <span>${cfg.legendLinked}</span>
          </div>
          <div class="matrix-legend-item">
            <span class="matrix-legend-chip unlinked">&mdash;</span>
            <span>${cfg.legendUnlinked}</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
          Klik kode untuk melihat detail rincian materi. Aktifkan Mode Edit untuk mengubah relasi.
        </div>
      </div>
    </div>
  `;

  $("view-container").innerHTML = renderedHtml;
}

// Generic Relation Toggle Handler with Automatic Audit Logging
function toggleMatrixRelation(cfgKey, rowKode, colKode) {
  const cfg = MATRIX_CONFIGS[cfgKey];
  if (!cfg) return;
  if (!matrixState.interactive[cfgKey]) return;

  const rows = db[cfg.rowEntity] || [];
  const rowObj = rows.find((r) => r.kode === rowKode);
  if (!rowObj) return;

  if (!Array.isArray(rowObj[cfg.relationField])) {
    rowObj[cfg.relationField] = [];
  }

  const arr = rowObj[cfg.relationField];
  const idx = arr.indexOf(colKode);
  const isAdd = idx === -1;
  if (isAdd) {
    arr.push(colKode);
  } else {
    arr.splice(idx, 1);
  }

  rowObj.by = USER;
  rowObj.at = stamp();

  const relLabel = cfg.colLabel || cfg.colEntity.toUpperCase();
  addAuditLog({
    master: cfg.rowEntity,
    aksi: "ubah",
    kode: rowObj.kode,
    nama: rowObj.nama || rowObj.deskripsi || rowObj.kode,
    keterangan: `${isAdd ? "Menghubungkan" : "Memutuskan"} relasi ${rowObj.kode} dengan ${relLabel} ${colKode}`,
    changes: [
      {
        field: cfg.relationField,
        label: `Relasi ${relLabel}`,
        old: isAdd ? "Tidak Terhubung" : "Terhubung",
        new: isAdd ? "Terhubung" : "Tidak Terhubung"
      }
    ],
    detail: { ...rowObj }
  });

  saveDb();
  renderMatrix2D(cfgKey);
}

// Backward compatible wrappers
function renderMatrixCplPl() { renderMatrix2D("cpl_pl"); }
function renderMatrixCplBk() { renderMatrix2D("cpl_bk"); }
function renderMatrixBkMk() { renderMatrix2D("bk_mk"); }
function renderMatrixCplMk() { renderMatrix2D("cpl_mk"); }

function toggleMatrixRelationCplBk(c, b) { toggleMatrixRelation("cpl_bk", c, b); }
function toggleMatrixRelationBkMk(b, m) { toggleMatrixRelation("bk_mk", b, m); }
function toggleMatrixRelationCplMk(c, m) { toggleMatrixRelation("cpl_mk", c, m); }

function openMatrixPlDetail(plKode) {
  const pl = (db.pl || []).find((p) => p.kode === plKode);
  if (!pl) return;

  const assignedCpl = (db.cpl || []).filter((c) =>
    (c.pl || []).includes(plKode),
  );

  open(`
    <div class="matrix-modal-wrap">
      <div class="matrix-modal-header">
        <div>
          <span class="matrix-modal-badge pl">${esc(pl.kode)}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Profil Lulusan TRPL</span>
        </div>
        <span class="tag neutral">${assignedCpl.length} CPL Terhubung</span>
      </div>

      <h2 style="font-size:18px;margin:0 0 8px">${esc(pl.nama)}</h2>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 16px">
        ${esc(pl.deskripsi || "Belum ada deskripsi profil lulusan.")}
      </p>

      <div style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
        Dikelola oleh: <b>${esc(pl.by || USER)}</b> &bull; Terakhir diubah: <b>${esc(pl.at || "-")}</b>
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--text)">Daftar CPL yang Mendukung Profil Ini (${assignedCpl.length}):</h3>
      ${
        assignedCpl.length
          ? `
        <div class="matrix-modal-list">
          ${assignedCpl
            .map(
              (c) => `
            <div class="matrix-modal-item">
              <span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}" style="margin:0;flex-shrink:0">${esc(c.kode)}</span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px;line-height:1.3">${esc(c.nama)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(c.jenis || "Hard skill")}</div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : `
        <div class="banner" style="background:var(--warning-bg);color:var(--warning);border-color:var(--warning)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
          <span><b>Peringatan:</b> Profil lulusan ini belum memiliki CPL pendukung. Klik pada sel kolom ${esc(pl.kode)} di matriks untuk menghubungkan CPL.</span>
        </div>
      `
      }

      <div class="mf" style="margin-top:20px">
        <button class="btn" data-x style="margin:0">Tutup</button>
      </div>
    </div>
  `);
}

function openMatrixCplDetail(cplKode) {
  const cpl = (db.cpl || []).find((c) => c.kode === cplKode);
  if (!cpl) return;

  const assignedPl = (cpl.pl || [])
    .map((pk) => (db.pl || []).find((p) => p.kode === pk))
    .filter(Boolean);
  const assignedBk = (cpl.bk || [])
    .map((bk) => (db.bk || []).find((b) => b.kode === bk))
    .filter(Boolean);
  const assignedMk = (cpl.mk || [])
    .map((mk) => (db.mk || []).find((m) => m.kode === mk))
    .filter(Boolean);

  open(`
    <div class="matrix-modal-wrap">
      <div class="matrix-modal-header">
        <div>
          <span class="matrix-modal-badge cpl">${esc(cpl.kode)}</span>
          <span class="tag ${cpl.jenis === "Hard skill" ? "hard" : "softs"}" style="margin-left:8px">${esc(cpl.jenis || "Hard skill")}</span>
        </div>
        <span class="tag neutral">${assignedPl.length} PL Terhubung</span>
      </div>

      <h2 style="font-size:16px;margin:0 0 12px;line-height:1.4">${esc(cpl.nama)}</h2>

      <div style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
        Dikelola oleh: <b>${esc(cpl.by || USER)}</b> &bull; Terakhir diubah: <b>${esc(cpl.at || "-")}</b>
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">Profil Lulusan yang Diturunkan (${assignedPl.length}):</h3>
      ${
        assignedPl.length
          ? `
        <div class="matrix-modal-list" style="margin-bottom:14px;max-height:160px">
          ${assignedPl
            .map(
              (p) => `
            <div class="matrix-modal-item">
              <span class="tag neutral" style="margin:0;flex-shrink:0">${esc(p.kode)}</span>
              <div>
                <b>${esc(p.nama)}</b>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(p.deskripsi || "")}</div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : `
        <div class="banner" style="background:var(--warning-bg);color:var(--warning);border-color:var(--warning);margin-bottom:14px">
          <span><b>Peringatan:</b> CPL ini belum diturunkan ke Profil Lulusan manapun. Sesuai standar OBE, CPL wajib menopang minimal 1 PL.</span>
        </div>
      `
      }

      ${
        assignedBk.length
          ? `
        <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">Bahan Kajian (BK) Terkait:</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          ${assignedBk.map((b) => `<span class="tag neutral"><b>${esc(b.kode)}</b> &bull; ${esc(b.nama)}</span>`).join("")}
        </div>
      `
          : ""
      }

      ${
        assignedMk.length
          ? `
        <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">Mata Kuliah (MK) Pengampu:</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          ${assignedMk.map((m) => `<span class="tag neutral"><b>${esc(m.kode)}</b> &bull; ${esc(m.nama)}</span>`).join("")}
        </div>
      `
          : ""
      }

      <div class="mf" style="margin-top:20px">
        <button class="btn ghost" data-x style="margin:0">Tutup</button>
      </div>
    </div>
  `);
}

function openMatrixGuideModal() {
  open(`
    <div class="matrix-modal-wrap">
      <h2 style="font-size:18px;margin:0 0 8px">Panduan Matriks CPL &ndash; Profil Lulusan (2D)</h2>
      <p class="s">Standar Penyusunan Kurikulum Berbasis Luaran (Outcome-Based Education &ndash; TRPL)</p>

      <div style="font-size:13px;line-height:1.6;color:var(--text);margin-top:14px">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px">
          <b style="color:var(--primary)">Prinsip Dasar OBE KPT / SN-Dikti:</b>
          <ul style="margin:6px 0 0;padding-left:20px">
            <li><b>Profil Lulusan (PL)</b> adalah deskripsi peran profesional dan keahlian nyata lulusan di industri software.</li>
            <li><b>Capaian Pembelajaran Lulusan (CPL)</b> merupakan kompetensi terukur (sikap, pengetahuan, keterampilan khusus) yang wajib dikuasai untuk menjalankan peran profil tersebut.</li>
            <li><b>Aturan Relasi:</b> Setiap CPL harus mendukung sekurang-kurangnya satu PL. Tidak boleh ada CPL yang berdiri sendiri tanpa profil penampung, dan setiap PL harus didukung oleh fondasi kompetensi CPL.</li>
          </ul>
        </div>

        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px">
          <b style="color:var(--text)">Cara Mengoperasikan Matriks:</b>
          <ul style="margin:6px 0 0;padding-left:20px">
            <li><b>Mode Edit:</b> Aktifkan sakelar Mode Edit di kanan atas untuk mengubah relasi pemetaan sel matriks.</li>
            <li><b>Klik Sel Relasi:</b> Klik tombol sel matriks untuk menghubungkan atau memutuskan relasi antara baris CPL dan kolom PL. Perubahan langsung tersimpan ke data relasi dan audit log.</li>
            <li><b>Master Data Terpusat:</b> Penambahan, perubahan pernyataan, atau klasifikasi CPL dikelola terpusat melalui menu <b>Data Master &gt; Capaian Pembelajaran (CPL)</b>, bukan dari halaman matriks.</li>
            <li><b>Informasi Lengkap:</b> Klik tombol <span style="display:inline-block;border:1px solid var(--border);border-radius:50%;width:16px;height:16px;line-height:14px;text-align:center;font-size:11px">i</span> pada judul PL atau klik kode CPL untuk melihat rincian pemetaan kurikulum.</li>
            <li><b>Pencarian &amp; Filter:</b> Saring berdasarkan kata kunci atau status pemetaan untuk mendeteksi kompetensi yang belum terhubung.</li>
          </ul>
        </div>
      </div>

      <div class="mf" style="margin-top:16px">
        <button class="btn" data-x style="margin:0">Saya Mengerti</button>
      </div>
    </div>
  `);
}

// 3. Render Matrix & Analysis Views (Under Construction)

// ==========================================================
// STATE VARIABLES FOR ALL 11 OBE VIEWS
// ==========================================================
let matrixCplBkSearch = "";
let matrixCplBkJenisFilter = "all";
let matrixCplBkStatusFilter = "all";
let matrixCplBkInteractive = false;
let matrixCplBkHoverCol = null;

let matrixBkMkSearch = "";
let matrixBkMkSemFilter = "all";
let matrixBkMkStatusFilter = "all";
let matrixBkMkInteractive = false;
let matrixBkMkHoverCol = null;

let matrixCplMkSearch = "";
let matrixCplMkSemFilter = "all";
let matrixCplMkJenisFilter = "all";
let matrixCplMkInteractive = false;
let matrixCplMkHoverCol = null;

let tripartitView = "bk";
let tripartitSearch = "";
let tripartitStatusFilter = "all";

let susunanSemFilter = "all";
let susunanKatFilter = "all";
let susunanSearch = "";

let orgSelectedMk = null;
let orgKatFilter = "all";

let pemenuhanSearch = "";
let pemenuhanJenisFilter = "all";

let cpmkSearch = "";
let cpmkCplFilter = "all";
let cpmkMkFilter = "all";
let cpmkExpanded = {};

let cpmkSemActive = 1;
let cpmkSemSearch = "";

// ==========================================================
// DETAIL MODALS FOR BK, MK, AND CPMK
// ==========================================================
function openMatrixBkDetail(bkKode) {
  const bk = (db.bk || []).find((b) => b.kode === bkKode);
  if (!bk) return;

  const assignedCpl = (db.cpl || []).filter((c) => (c.bk || []).includes(bkKode));
  const assignedMk = (bk.mk || []).map((k) => (db.mk || []).find((m) => m.kode === k)).filter(Boolean);

  open(`
    <div class="matrix-modal-wrap">
      <div class="matrix-modal-header">
        <div>
          <span class="bk-head-code" style="font-size:13px;padding:3px 8px">${esc(bk.kode)}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Bahan Kajian (Body of Knowledge)</span>
        </div>
        <span class="tag neutral">${assignedMk.length} MK Penampung</span>
      </div>

      <h2 style="font-size:18px;margin:0 0 8px">${esc(bk.nama)}</h2>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 16px">
        ${esc(bk.deskripsi || "Belum ada deskripsi bahan kajian.")}
      </p>

      <div style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
        Dikelola oleh: <b>${esc(bk.by || USER)}</b> &bull; Terakhir diubah: <b>${esc(bk.at || "-")}</b>
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 8px;color:var(--text)">Mata Kuliah Penampung (${assignedMk.length}):</h3>
      ${
        assignedMk.length
          ? `
        <div class="matrix-modal-list">
          ${assignedMk
            .map(
              (m) => `
            <div class="matrix-modal-item">
              <span class="mk-head-code" style="margin:0;flex-shrink:0">${esc(m.kode)}</span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:13px;line-height:1.3">${esc(m.nama)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                  Semester ${esc(m.sem)} &bull; ${esc(m.sks)} SKS (${esc(m.jenis)}) &bull; ${esc(m.kat)}
                </div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : `
        <div class="banner" style="background:var(--warning-bg);color:var(--warning);border-color:var(--warning)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
          <span><b>Peringatan Kritis OBE:</b> Bahan Kajian ini belum dikemas ke Mata Kuliah manapun (Orphan BK). Minimal 1 Mata Kuliah harus menampung bahan kajian ini.</span>
        </div>
      `
      }

      <h3 style="font-size:13px;font-weight:600;margin:16px 0 8px;color:var(--text)">CPL yang Membutuhkan BK Ini (${assignedCpl.length}):</h3>
      <div class="matrix-modal-list">
        ${
          assignedCpl.length
            ? assignedCpl
                .map(
                  (c) => `
              <div class="matrix-modal-item">
                <span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}" style="margin:0;flex-shrink:0">${esc(c.kode)}</span>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:12.5px">${esc(c.nama)}</div>
                </div>
              </div>
            `,
                )
                .join("")
            : '<div style="font-size:12px;color:var(--text-muted)">Belum ada CPL yang terhubung langsung.</div>'
        }
      </div>

      <div class="mf" style="margin-top:20px">
        <button class="btn" data-x style="margin:0">Tutup</button>
      </div>
    </div>
  `);
}

function openMatrixMkDetail(mkKode) {
  const mk = (db.mk || []).find((m) => m.kode === mkKode);
  if (!mk) return;

  const assignedBk = (db.bk || []).filter((b) => (b.mk || []).includes(mkKode));
  const assignedCpl = (db.cpl || []).filter((c) => (c.mk || []).includes(mkKode));
  const assignedCpmk = (db.cpmk || []).filter((c) => (c.mk || []).includes(mkKode));

  open(`
    <div class="matrix-modal-wrap">
      <div class="matrix-modal-header">
        <div>
          <span class="mk-head-code" style="font-size:13px;padding:3px 8px">${esc(mk.kode)}</span>
          <span class="pill-kat ${mk.kat === "Umum" ? "umum" : "inti"}" style="margin-left:6px">${esc(mk.kat)}</span>
          <span class="pill-jenis ${mk.jenis === "Praktik" ? "prak" : "teori"}" style="margin-left:4px">${esc(mk.jenis)}</span>
        </div>
        <span class="tag neutral">Semester ${esc(mk.sem)} &bull; ${esc(mk.sks)} SKS</span>
      </div>

      <h2 style="font-size:18px;margin:0 0 6px">${esc(mk.nama)}</h2>
      <div style="font-size:12.5px;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <span>SKS Teori: <b>${esc(mk.sksTeori || 0)}</b></span>
        <span>SKS Praktik: <b>${esc(mk.sksPrak || 0)}</b></span>
        <span>Total SKS: <b>${esc(mk.sks)}</b></span>
        <span>Prasyarat: <b>${(mk.prasyarat && mk.prasyarat.length) ? mk.prasyarat.join(", ") : "Tidak ada"}</b></span>
      </div>

      <div style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:8px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
        Dikelola oleh: <b>${esc(mk.by || USER)}</b> &bull; Terakhir diubah: <b>${esc(mk.at || "-")}</b>
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">Bahan Kajian yang Dikemas (${assignedBk.length}):</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${
          assignedBk.length
            ? assignedBk.map((b) => `<span class="bk-head-code" style="cursor:pointer" data-matrix-bk-info="${esc(b.kode)}" title="${esc(b.nama)}">${esc(b.kode)} - ${esc(b.nama)}</span>`).join("")
            : '<span style="font-size:12px;color:var(--warning)">Belum ada Bahan Kajian yang dikemas ke MK ini.</span>'
        }
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">CPL yang Didukung (${assignedCpl.length}):</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${
          assignedCpl.length
            ? assignedCpl.map((c) => `<span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}" style="cursor:pointer" data-matrix-cpl-info="${esc(c.kode)}">${esc(c.kode)}</span>`).join("")
            : '<span style="font-size:12px;color:var(--warning)">Belum ada CPL yang dibebankan ke MK ini.</span>'
        }
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:0 0 6px;color:var(--text)">Capaian MK (CPMK) Terkait (${assignedCpmk.length}):</h3>
      <div class="matrix-modal-list">
        ${
          assignedCpmk.length
            ? assignedCpmk
                .map(
                  (cp) => `
              <div class="matrix-modal-item">
                <span class="cpmk-code-pill" style="margin:0;flex-shrink:0">${esc(cp.kode)}</span>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:12.5px">${esc(cp.nama)}</div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                    Induk: ${(cp.cpl || []).join(", ")} &bull; ${(cp.sub_cpmk || []).length} Sub-CPMK
                  </div>
                </div>
              </div>
            `,
                )
                .join("")
            : '<div style="font-size:12px;color:var(--text-muted)">Belum ada CPMK spesifik yang dipetakan ke MK ini.</div>'
        }
      </div>

      <div class="mf" style="margin-top:20px">
        <button class="btn" data-x style="margin:0">Tutup</button>
      </div>
    </div>
  `);
}

function openMatrixCpmkDetail(cpmkKode) {
  const cpmk = (db.cpmk || []).find((c) => c.kode === cpmkKode);
  if (!cpmk) return;

  const assignedCpl = (cpmk.cpl || []).map((k) => (db.cpl || []).find((c) => c.kode === k)).filter(Boolean);
  const assignedMk = (cpmk.mk || []).map((k) => (db.mk || []).find((m) => m.kode === k)).filter(Boolean);
  const subList = cpmk.sub_cpmk || [];

  open(`
    <div class="matrix-modal-wrap">
      <div class="matrix-modal-header">
        <div>
          <span class="cpmk-code-pill" style="font-size:13px;padding:3px 8px">${esc(cpmk.kode)}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Capaian Pembelajaran Mata Kuliah (CPMK)</span>
        </div>
        <span class="tag neutral">${subList.length} Sub-CPMK</span>
      </div>

      <h2 style="font-size:17px;margin:0 0 10px;line-height:1.4">${esc(cpmk.nama)}</h2>

      <div style="margin-bottom:14px">
        <span style="font-size:12px;font-weight:600;color:var(--text-muted)">CPL Induk:</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
          ${assignedCpl.map((c) => `<span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}">${esc(c.kode)} - ${esc(c.nama)}</span>`).join("")}
        </div>
      </div>

      <div style="margin-bottom:14px">
        <span style="font-size:12px;font-weight:600;color:var(--text-muted)">Mata Kuliah Pengampu:</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
          ${assignedMk.map((m) => `<span class="mk-head-code" style="cursor:pointer" data-matrix-mk-info="${esc(m.kode)}">${esc(m.kode)} - ${esc(m.nama)} (Sem ${esc(m.sem)})</span>`).join("")}
        </div>
      </div>

      <h3 style="font-size:13px;font-weight:600;margin:16px 0 8px;color:var(--text)">Rincian Sub-CPMK (${subList.length}):</h3>
      <div class="matrix-modal-list">
        ${
          subList.length
            ? subList
                .map(
                  (s, idx) => `
              <div class="matrix-modal-item">
                <span class="tag primary" style="margin:0;flex-shrink:0">${esc(s.kode || ("SubCPMK." + (idx + 1)))}</span>
                <div style="flex:1;font-size:12.5px;line-height:1.4">
                  ${esc(s.nama)}
                </div>
              </div>
            `,
                )
                .join("")
            : '<div style="font-size:12px;color:var(--text-muted)">Belum ada Sub-CPMK terperinci.</div>'
        }
      </div>

      <div class="mf" style="margin-top:20px">
        <button class="btn" data-x style="margin:0">Tutup</button>
      </div>
    </div>
  `);
}

// Relation Toggle Handlers
function renderMatrixBkCplMk() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Matriks Relasi OBE / Matriks Keterpaduan BK–CPL–MK";
  $("title").textContent = "Matriks Keterpaduan & Validasi BK – CPL – MK (Tripartit)";
  $("lead").textContent =
    "Sintesis integrasi tripartit kurikulum OBE (gabungan CPL–BK, BK–MK, dan CPL–MK). Memastikan tidak ada Bahan Kajian yang null MK (minimal 1 MK), dan seluruh mata kuliah memiliki landasan materi serta capaian yang saling mendukung.";
  $("bar").style.display = "none";

  const allBk = db.bk || [];
  const allMk = db.mk || [];
  const allCpl = db.cpl || [];

  const orphanBk = allBk.filter(b => (!b.mk || b.mk.length === 0));
  const orphanMk = allMk.filter(m => {
    const hasBk = allBk.some(b => (b.mk || []).includes(m.kode));
    const hasCpl = allCpl.some(c => (c.mk || []).includes(m.kode));
    return !hasBk || !hasCpl;
  });

  const isSystemValid = orphanBk.length === 0 && orphanMk.length === 0;

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-stats-grid">
        <div class="matrix-stat-card">
          <div class="matrix-stat-icon obe ${isSystemValid ? "pass" : ""}">
            ${isSystemValid 
              ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
              : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
            }
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val" style="${isSystemValid ? "color:var(--success)" : "color:var(--warning)"}">${isSystemValid ? "100% Selaras & Terpadu" : "Terdapat Peringatan"}</span>
            <span class="matrix-stat-label">Status Integritas Tripartit</span>
            <span class="matrix-stat-sub">${isSystemValid ? "Konsistensi silang 5-6-7 terpenuhi" : "Perlu penyelarasan relasi"}</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon pl" style="background:#fef3c7;color:#b45309">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val" style="${orphanBk.length === 0 ? "color:var(--success)" : "color:var(--danger)"}">${orphanBk.length} Orphan BK</span>
            <span class="matrix-stat-label">Validasi Null MK (Target 0)</span>
            <span class="matrix-stat-sub">${orphanBk.length === 0 ? "Seluruh BK dikemas min. 1 MK" : "Ada BK belum masuk ke MK!"}</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon cpl" style="background:#e0e7ff;color:#3730a3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allMk.length - orphanMk.length} / ${allMk.length} MK</span>
            <span class="matrix-stat-label">Kelengkapan BK & CPL MK</span>
            <span class="matrix-stat-sub">Mata kuliah berpilar lengkap</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon relation">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">3 Pilar Kurikulum</span>
            <span class="matrix-stat-label">Keterhubungan Saling Mendukung</span>
            <span class="matrix-stat-sub">CPL &harr; BK &harr; MK Terhubung</span>
          </div>
        </div>
      </div>

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <div class="tripartit-tabs">
            <button type="button" class="tripartit-tab-btn ${tripartitView === "bk" ? "active" : ""}" data-tripartit-tab="bk">
              Tinjauan per Bahan Kajian (BK)
            </button>
            <button type="button" class="tripartit-tab-btn ${tripartitView === "mk" ? "active" : ""}" data-tripartit-tab="mk">
              Tinjauan per Mata Kuliah (MK)
            </button>
          </div>
          <div class="matrix-search" style="margin-left:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="tripartit-q" type="search" placeholder="Cari kode/nama..." value="${esc(tripartitSearch)}" />
          </div>
        </div>
      </div>

      <div class="scroll" style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:auto">
        ${tripartitView === "bk" ? renderTripartitBkView(allBk, allCpl, allMk) : renderTripartitMkView(allMk, allBk, allCpl)}
      </div>

      <div class="matrix-guide-card">
        <div style="font-size:12.5px;color:var(--text);font-weight:600;margin-bottom:4px">
          Kaidah Baku Integrasi Tripartit Kurikulum OBE (Sheet 5-6-7):
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">
          1. <b>Bahan Kajian Wajib Dikemas:</b> Setiap Bahan Kajian wajib terwadahi minimal pada 1 Mata Kuliah (aturan: <code>validasi tidak boleh null</code>).<br>
          2. <b>Mata Kuliah Wajib Berisi Bahan Kajian:</b> Setiap Mata Kuliah harus mengemas minimal satu Bahan Kajian.<br>
          3. <b>Keselarasan CPL:</b> Mata kuliah yang mengemas Bahan Kajian tertentu harus mendukung CPL yang membutuhkan Bahan Kajian tersebut.
        </div>
      </div>
    </div>
  `;
}

function renderTripartitBkView(allBk, allCpl, allMk) {
  const filtered = allBk.filter(b => {
    if (tripartitSearch) {
      const term = (b.kode + " " + (b.nama || "")).toLowerCase();
      if (!term.includes(tripartitSearch)) return false;
    }
    return true;
  });

  return `
    <table class="table" style="min-width:850px">
      <thead>
        <tr>
          <th style="width:110px">Kode BK</th>
          <th>Nama Bahan Kajian</th>
          <th style="width:220px">CPL yang Membutuhkan</th>
          <th style="width:300px">Mata Kuliah Penampung</th>
          <th style="width:140px;text-align:center">Validasi Integritas</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(b => {
          const reqCpl = allCpl.filter(c => (c.bk || []).includes(b.kode));
          const packMk = (b.mk || []).map(k => allMk.find(m => m.kode === k)).filter(Boolean);
          const isOrphan = packMk.length === 0;

          return `
            <tr>
              <td>
                <button type="button" class="bk-head-code" style="cursor:pointer;border:none" data-matrix-bk-info="${esc(b.kode)}">
                  ${esc(b.kode)}
                </button>
              </td>
              <td>
                <div style="font-weight:600;color:var(--text)">${esc(b.nama)}</div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${esc(b.deskripsi || "")}</div>
              </td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  ${reqCpl.length ? reqCpl.map(c => `<span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}" style="cursor:pointer" data-matrix-cpl-info="${esc(c.kode)}">${esc(c.kode)}</span>`).join("") : '<span style="font-size:11px;color:var(--text-muted)">-</span>'}
                </div>
              </td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:5px">
                  ${packMk.length ? packMk.map(m => `<span class="mk-head-code" style="cursor:pointer" data-matrix-mk-info="${esc(m.kode)}">${esc(m.kode)} (S${esc(m.sem)})</span>`).join("") : '<span class="status-pill danger" style="font-size:10.5px">NULL MK (Orphan)</span>'}
                </div>
              </td>
              <td style="text-align:center">
                ${isOrphan 
                  ? '<span class="status-pill danger">Gagal: Null MK</span>'
                  : `<span class="status-pill valid">Lolos (${packMk.length} MK)</span>`
                }
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderTripartitMkView(allMk, allBk, allCpl) {
  const filtered = allMk.filter(m => {
    if (tripartitSearch) {
      const term = (m.kode + " " + (m.nama || "")).toLowerCase();
      if (!term.includes(tripartitSearch)) return false;
    }
    return true;
  });

  return `
    <table class="table" style="min-width:850px">
      <thead>
        <tr>
          <th style="width:110px">Kode MK</th>
          <th>Nama Mata Kuliah</th>
          <th style="width:120px">Kategori / SKS</th>
          <th style="width:240px">Bahan Kajian Pengisi</th>
          <th style="width:240px">CPL yang Dibebankan</th>
          <th style="width:140px;text-align:center">Keterpaduan</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(m => {
          const packBk = allBk.filter(b => (b.mk || []).includes(m.kode));
          const packCpl = allCpl.filter(c => (c.mk || []).includes(m.kode));
          const isComplete = packBk.length > 0 && packCpl.length > 0;

          return `
            <tr>
              <td>
                <button type="button" class="mk-head-code" style="cursor:pointer;border:none" data-matrix-mk-info="${esc(m.kode)}">
                  ${esc(m.kode)}
                </button>
              </td>
              <td>
                <div style="font-weight:600;color:var(--text)">${esc(m.nama)}</div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">Semester ${esc(m.sem)} &bull; ${esc(m.jenis)}</div>
              </td>
              <td>
                <span class="pill-kat ${m.kat === "Umum" ? "umum" : "inti"}">${esc(m.kat)}</span>
                <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-top:2px">${esc(m.sks)} SKS (T:${esc(m.sksTeori || 0)}, P:${esc(m.sksPrak || 0)})</div>
              </td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  ${packBk.length ? packBk.map(b => `<span class="bk-head-code" style="cursor:pointer" data-matrix-bk-info="${esc(b.kode)}">${esc(b.kode)}</span>`).join("") : '<span class="status-pill warn" style="font-size:10.5px">Tanpa BK</span>'}
                </div>
              </td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  ${packCpl.length ? packCpl.map(c => `<span class="tag ${c.jenis === "Hard skill" ? "hard" : "softs"}" style="cursor:pointer" data-matrix-cpl-info="${esc(c.kode)}">${esc(c.kode)}</span>`).join("") : '<span class="status-pill warn" style="font-size:10.5px">Tanpa CPL</span>'}
                </div>
              </td>
              <td style="text-align:center">
                ${isComplete
                  ? '<span class="status-pill valid">Lengkap</span>'
                  : '<span class="status-pill warn">Perlu Perhatian</span>'
                }
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ==========================================================
// 5. SUSUNAN MATA KULIAH (Per Semester, SKS Teori/Praktik)
// ==========================================================
function renderSusunanMk() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Struktur & Organisasi MK / Susunan Mata Kuliah";
  $("title").textContent = "Susunan & Sebaran Mata Kuliah per Semester";
  $("lead").textContent =
    "Struktur kurikulum lengkap yang memuat penempatan semester, kategori (Umum / Inti RPL), jenis pembelajaran (Teori / Praktik), bobot SKS Teori & Praktik, serta alur prasyarat.";
  $("bar").style.display = "none";

  const allMk = db.mk || [];

  let totalSks = 0;
  let totalSksTeori = 0;
  let totalSksPrak = 0;
  allMk.forEach((m) => {
    totalSks += (m.sks || 0);
    totalSksTeori += (m.sksTeori || 0);
    totalSksPrak += (m.sksPrak || 0);
  });

  const prakPct = totalSks ? Math.round((totalSksPrak / totalSks) * 100) : 0;
  const teoriPct = 100 - prakPct;

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
  const activeSemesters = susunanSemFilter === "all" ? semesters : [parseInt(susunanSemFilter, 10)];

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-stats-grid">
        <div class="matrix-stat-card">
          <div class="matrix-stat-icon pl" style="background:#dbeafe;color:#1e40af">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${totalSks} SKS</span>
            <span class="matrix-stat-label">Total Beban Kurikulum</span>
            <span class="matrix-stat-sub">${allMk.length} Mata Kuliah aktif</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon relation" style="background:#f0fdf4;color:#15803d">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${prakPct}% Praktik / ${teoriPct}% Teori</span>
            <span class="matrix-stat-label">Rasio Pembelajaran Vokasi</span>
            <span class="matrix-stat-sub">${totalSksPrak} SKS Praktik &bull; ${totalSksTeori} SKS Teori</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon cpl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">18.0 SKS</span>
            <span class="matrix-stat-label">Rerata Beban Semester</span>
            <span class="matrix-stat-sub">Beban studi seimbang 8 semester (D4)</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon obe pass">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val" style="color:var(--success)">Standar Polman/Astra</span>
            <span class="matrix-stat-label">Struktur Kurikulum D4</span>
            <span class="matrix-stat-sub">Terakreditasi &amp; Link and Match</span>
          </div>
        </div>
      </div>

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left" style="flex-wrap:wrap">
          <div class="tripartit-tabs">
            <button type="button" class="tripartit-tab-btn ${susunanSemFilter === "all" ? "active" : ""}" data-susunan-sem-tab="all">Semua Semester</button>
            ${semesters.map(s => `
              <button type="button" class="tripartit-tab-btn ${susunanSemFilter === String(s) ? "active" : ""}" data-susunan-sem-tab="${s}">Semester ${s}</button>
            `).join("")}
          </div>
          <div class="matrix-search" style="margin-left:6px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="susunan-q" type="search" placeholder="Cari MK / kode..." value="${esc(susunanSearch)}" />
          </div>
        </div>
      </div>

      <div class="susunan-container">
        ${activeSemesters.map(sem => {
          let semMk = allMk.filter(m => m.sem === sem);
          if (susunanSearch) {
            semMk = semMk.filter(m => (m.kode + " " + (m.nama || "")).toLowerCase().includes(susunanSearch));
          }

          let subTeori = 0;
          let subPrak = 0;
          let subTotal = 0;
          semMk.forEach(m => {
            subTeori += (m.sksTeori || 0);
            subPrak += (m.sksPrak || 0);
            subTotal += (m.sks || 0);
          });

          const semNames = {
            1: "Tahap Fondasi: Logika, Algoritma & Rekayasa Dasar",
            2: "Tahap Penguatan: Pemrograman Berorientasi Objek & Basis Data",
            3: "Tahap Penerapan: Web, Mobile, Jaringan & Gudang Data",
            4: "Tahap Lanjutan: DevOps, Keamanan, QA Testing & UI/UX",
            5: "Tahap Keahlian: Kecerdasan Buatan (AI), Big Data & Cloud",
            6: "Tahap Integrasi: NLP, Visi Komputer & Sistem Cerdas",
            7: "Tahap Industri: Magang Terstruktur Industri (Co-op / Internship)",
            8: "Tahap Profesional: Proyek Tingkat Akhir (PTA) & Sertifikasi Profesi"
          };

          return `
            <div class="susunan-sem-card">
              <div class="susunan-sem-header">
                <div class="susunan-sem-title">
                  <span class="susunan-sem-badge">SEMESTER ${sem}</span>
                  <span class="susunan-sem-name">${semNames[sem] || ""}</span>
                </div>
                <div class="susunan-sem-stats">
                  <span class="susunan-stat-chip">${semMk.length} Mata Kuliah</span>
                  <span class="susunan-stat-chip">Teori: ${subTeori} SKS</span>
                  <span class="susunan-stat-chip">Praktik: ${subPrak} SKS</span>
                  <span class="susunan-stat-chip" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe">Total: ${subTotal} SKS</span>
                </div>
              </div>

              <div class="scroll">
                <table class="table" style="min-width:780px">
                  <thead>
                    <tr>
                      <th style="width:50px;text-align:center">No</th>
                      <th style="width:110px">Kode MK</th>
                      <th>Nama Mata Kuliah</th>
                      <th style="width:110px">Kategori</th>
                      <th style="width:100px">Jenis</th>
                      <th style="width:80px;text-align:center">SKS T</th>
                      <th style="width:80px;text-align:center">SKS P</th>
                      <th style="width:80px;text-align:center">Total</th>
                      <th style="width:180px">Mata Kuliah Prasyarat</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${semMk.length ? semMk.map((m, idx) => {
                      const isUmum = m.kat === "Umum";
                      const isPrak = m.jenis === "Praktik";
                      return `
                        <tr>
                          <td style="text-align:center;color:var(--text-muted)">${idx + 1}</td>
                          <td>
                            <button type="button" class="mk-head-code" style="cursor:pointer;border:none" data-matrix-mk-info="${esc(m.kode)}">
                              ${esc(m.kode)}
                            </button>
                          </td>
                          <td>
                            <div style="font-weight:600;color:var(--text)">${esc(m.nama)}</div>
                          </td>
                          <td>
                            <span class="pill-kat ${isUmum ? "umum" : "inti"}">${esc(m.kat)}</span>
                          </td>
                          <td>
                            <span class="pill-jenis ${isPrak ? "prak" : "teori"}">${esc(m.jenis)}</span>
                          </td>
                          <td style="text-align:center;font-weight:500">${esc(m.sksTeori || 0)}</td>
                          <td style="text-align:center;font-weight:500">${esc(m.sksPrak || 0)}</td>
                          <td style="text-align:center;font-weight:700;color:var(--primary)">${esc(m.sks)}</td>
                          <td>
                            ${(m.prasyarat && m.prasyarat.length)
                              ? m.prasyarat.map(p => `<span class="mk-head-code" style="cursor:pointer" data-matrix-mk-info="${esc(p)}">${esc(p)}</span>`).join(" ")
                              : '<span style="color:var(--text-muted);font-size:11.5px">-</span>'
                            }
                          </td>
                        </tr>
                      `;
                    }).join("") : `
                      <tr>
                        <td colspan="9" style="text-align:center;padding:24px 16px;color:var(--text-muted)">
                          Tidak ada mata kuliah yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    `}
                    <tr class="susunan-subtotal-row">
                      <td colspan="5" style="text-align:right">Subtotal Semester ${sem}:</td>
                      <td style="text-align:center">${subTeori}</td>
                      <td style="text-align:center">${subPrak}</td>
                      <td style="text-align:center;color:var(--primary);font-size:14px">${subTotal}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

// ==========================================================
// 6. ORGANISASI MATA KULIAH (Peta Arsitektur & Alur Prasyarat)
// ==========================================================
function renderOrganisasiMk() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Struktur & Organisasi MK / Organisasi Mata Kuliah";
  $("title").textContent = "Peta Arsitektur & Organisasi Mata Kuliah (Curriculum Flowchart)";
  $("lead").textContent =
    "Visualisasi peta pohon kurikulum per semester berbasis alur prasyarat. Klik salah satu mata kuliah untuk menyorot rantai prasyarat (kuning) dan mata kuliah kelanjutan yang dibukanya (hijau).";
  $("bar").style.display = "none";

  const allMk = db.mk || [];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  let selectedPrereqs = [];
  let selectedDependents = [];
  if (orgSelectedMk) {
    const cur = allMk.find(m => m.kode === orgSelectedMk);
    if (cur) {
      selectedPrereqs = cur.prasyarat || [];
      selectedDependents = allMk.filter(m => (m.prasyarat || []).includes(orgSelectedMk)).map(m => m.kode);
    }
  }

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left" style="align-items:center;gap:10px">
          <span style="font-weight:600;font-size:13px;color:var(--text)">Sorotan Alur:</span>
          ${orgSelectedMk ? `
            <span class="mk-head-code" style="font-size:12px;padding:4px 8px">${esc(orgSelectedMk)}</span>
            <span style="font-size:12.5px;color:var(--text-secondary)">
              (${selectedPrereqs.length} Prasyarat Dibutuhkan &bull; ${selectedDependents.length} Mata Kuliah Dibuka)
            </span>
            <button type="button" class="matrix-btn-tool" id="org-btn-clear-select" style="height:32px;padding:0 10px">
              Hapus Sorotan
            </button>
          ` : `
            <span style="font-size:12.5px;color:var(--text-muted)">
              Klik kartu mata kuliah mana saja untuk melihat alur prasyaratnya.
            </span>
          `}
        </div>
        <div class="matrix-toolbar-right">
          <div style="display:flex;align-items:center;gap:12px;font-size:12px">
            <div style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;border-radius:3px;background:#eff6ff;border:1.5px solid #2563eb"></span>
              <span>Terpilih</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;border-radius:3px;background:#fffbeb;border:1.5px solid #f59e0b"></span>
              <span>Prasyarat Dibutuhkan</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px">
              <span style="width:12px;height:12px;border-radius:3px;background:#ecfdf5;border:1.5px solid #10b981"></span>
              <span>Mata Kuliah Lanjutan</span>
            </div>
          </div>
        </div>
      </div>

      <div class="organisasi-board">
        ${semesters.map(s => {
          const semMk = allMk.filter(m => m.sem === s);
          let semSks = 0;
          semMk.forEach(m => semSks += (m.sks || 0));

          return `
            <div class="organisasi-col">
              <div class="organisasi-col-head">
                <h3>Semester ${s}</h3>
                <span class="tag neutral" style="margin:0;font-size:11px">${semSks} SKS (${semMk.length} MK)</span>
              </div>
              <div class="organisasi-col-list">
                ${semMk.map(m => {
                  const isSel = orgSelectedMk === m.kode;
                  const isPre = selectedPrereqs.includes(m.kode);
                  const isDep = selectedDependents.includes(m.kode);
                  let stateCls = "";
                  if (isSel) stateCls = "selected";
                  else if (isPre) stateCls = "is-prerequisite";
                  else if (isDep) stateCls = "is-dependent";

                  return `
                    <div class="org-card ${stateCls}" data-org-select-mk="${esc(m.kode)}">
                      <div class="org-card-top">
                        <span class="mk-head-code">${esc(m.kode)}</span>
                        <span style="font-size:11px;font-weight:700;color:var(--text-secondary)">${esc(m.sks)} SKS</span>
                      </div>
                      <div class="org-card-title">${esc(m.nama)}</div>
                      <div class="org-card-tags">
                        <span class="pill-kat ${m.kat === "Umum" ? "umum" : "inti"}" style="font-size:10.5px;padding:2px 6px">${esc(m.kat)}</span>
                        <span class="pill-jenis ${m.jenis === "Praktik" ? "prak" : "teori"}" style="font-size:10px;padding:1px 5px">${esc(m.jenis)}</span>
                      </div>
                      ${(m.prasyarat && m.prasyarat.length) ? `
                        <div class="org-card-pre">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          <span>Syarat: <b>${m.prasyarat.join(", ")}</b></span>
                        </div>
                      ` : ""}
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="matrix-guide-card">
        <div style="font-size:12px;color:var(--text-muted)">
          Peta arsitektur kurikulum OBE TRPL dirancang terstruktur secara berjenjang. Alur warna membantu penasihat akademik dan dosen dalam meninjau dampak kelulusan mata kuliah prasyarat.
        </div>
      </div>
    </div>
  `;
}

// ==========================================================
// 7. PEMENUHAN CPL (Cross-Tabulation Semester vs CPL)
// ==========================================================
function renderPemenuhanCpl() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Analisis & Pemenuhan CPL / Pemenuhan CPL";
  $("title").textContent = "Matriks Sebaran & Evaluasi Pemenuhan CPL per Semester";
  $("lead").textContent =
    "Matriks gabungan pemetaan CPL–MK dan Susunan MK per semester. Menunjukkan distribusi mata kuliah yang memenuhi setiap butir CPL sepanjang perjalanan studi dari semester 1 hingga semester akhir.";
  $("bar").style.display = "none";

  const allCpl = db.cpl || [];
  const allMk = db.mk || [];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const filteredCpl = allCpl.filter(c => {
    if (pemenuhanSearch) {
      const term = (c.kode + " " + (c.nama || "")).toLowerCase();
      if (!term.includes(pemenuhanSearch)) return false;
    }
    // Filter dropdowns removed
    return true;
  });

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-stats-grid">
        <div class="matrix-stat-card">
          <div class="matrix-stat-icon cpl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allCpl.length} CPL</span>
            <span class="matrix-stat-label">Capaian Lulusan Aktif</span>
            <span class="matrix-stat-sub">100% Terdistribusi</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon pl" style="background:#dbeafe;color:#1e40af">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">Semester 1 &ndash; 2</span>
            <span class="matrix-stat-label">Tahap Fondasi &amp; Logika</span>
            <span class="matrix-stat-sub">Pemenuhan kompetensi dasar</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon relation" style="background:#fef3c7;color:#b45309">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">Semester 3 &ndash; 4</span>
            <span class="matrix-stat-label">Tahap Keahlian Terapan</span>
            <span class="matrix-stat-sub">Web, Cloud, QA &amp; AI</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon obe pass">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">Semester 7 &ndash; 8</span>
            <span class="matrix-stat-label">Tahap Magang &amp; PTA</span>
            <span class="matrix-stat-sub">Magang Industri Co-op &amp; Proyek Akhir</span>
          </div>
        </div>
      </div>

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <div class="matrix-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="pemenuhan-q" type="search" placeholder="Cari CPL..." value="${esc(pemenuhanSearch)}" />
          </div>

        </div>
      </div>

      <div class="matrix-scroll-wrap">
        <table class="matrix-table view-only">
          <thead>
            <tr>
              <th class="th-cpl-code" scope="col">Kode CPL</th>
              <th class="th-cpl-name" scope="col">Capaian Pembelajaran Lulusan (CPL)</th>
              ${semesters.map(s => `
                <th style="min-width:140px;max-width:200px;text-align:center" scope="col">
                  Semester ${s}
                </th>
              `).join("")}
              <th style="width:130px;text-align:center" scope="col">Total MK</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCpl.length ? filteredCpl.map(cpl => {
              const assignedMkCodes = cpl.mk || [];
              const isHard = cpl.jenis === "Hard skill";

              return `
                <tr>
                  <td class="td-cpl-code">
                    <button type="button" class="matrix-cpl-btn ${isHard ? "hard" : "softs"}" data-matrix-cpl-info="${esc(cpl.kode)}">
                      ${esc(cpl.kode)}
                    </button>
                  </td>
                  <td class="td-cpl-name">
                    <div style="font-weight:600;color:var(--text);line-height:1.4">${esc(cpl.nama)}</div>
                    <div style="margin-top:4px">
                      <span class="tag ${isHard ? "hard" : "softs"}" style="font-size:11px;height:20px;line-height:18px">${esc(cpl.jenis || "Hard skill")}</span>
                    </div>
                  </td>
                  ${semesters.map(s => {
                    const semMks = allMk.filter(m => m.sem === s && assignedMkCodes.includes(m.kode));
                    return `
                      <td class="pemenuhan-cell">
                        ${semMks.length ? `
                          <div class="pemenuhan-badges-wrap">
                            ${semMks.map(m => `
                              <span class="pemenuhan-mk-badge" data-matrix-mk-info="${esc(m.kode)}" title="${esc(m.kode)}: ${esc(m.nama)}">
                                ${esc(m.kode)}
                              </span>
                            `).join("")}
                          </div>
                        ` : '<div class="pemenuhan-empty">&mdash;</div>'}
                      </td>
                    `;
                  }).join("")}
                  <td style="text-align:center;font-weight:700">
                    <span class="status-pill valid">${assignedMkCodes.length} MK</span>
                  </td>
                </tr>
              `;
            }).join("") : `
              <tr>
                <td colspan="9" style="text-align:center;padding:48px 16px">
                  <div class="empty"><b>Tidak ada CPL yang sesuai dengan filter</b></div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="matrix-guide-card">
        <div style="font-size:12px;color:var(--text-muted)">
          Matriks ini memastikan pemenuhan CPL dirancang secara bertahap (scaffolding) dari semester awal hingga akhir, tidak terjadi kekosongan pemenuhan, dan tidak menumpuk di satu semester.
        </div>
      </div>
    </div>
  `;
}

// ==========================================================
// 8. MATRIKS RELASI CPL-CPMK-MK (Dekomposisi & Sub-CPMK)
// ==========================================================
function renderCplCpmkMk() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Analisis & Pemenuhan CPL / CPL–CPMK–MK";
  $("title").textContent = "Matriks Dekomposisi CPL – CPMK – Mata Kuliah";
  $("lead").textContent =
    "Penjabaran Capaian Pembelajaran Lulusan (CPL) menjadi Capaian Pembelajaran Mata Kuliah (CPMK) dan Sub-CPMK terstandar. Mengakomodasi relasi 1 CPMK memiliki banyak Sub-CPMK, dan 1 CPMK dapat dibebankan pada beberapa Mata Kuliah.";
  $("bar").style.display = "none";

  const allCpl = db.cpl || [];
  const allCpmk = db.cpmk || [];
  const allMk = db.mk || [];

  let totalSub = 0;
  let multiMkCpmkCount = 0;
  allCpmk.forEach(c => {
    totalSub += ((c.sub_cpmk || []).length);
    if ((c.mk || []).length > 1) multiMkCpmkCount++;
  });

  const filteredCpl = allCpl.filter(c => {
    // Filter dropdowns removed
    return true;
  });

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-stats-grid">
        <div class="matrix-stat-card">
          <div class="matrix-stat-icon cpl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allCpl.length} CPL</span>
            <span class="matrix-stat-label">Capaian Lulusan Induk</span>
            <span class="matrix-stat-sub">Standar kompetensi utama</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon pl" style="background:#e0f2fe;color:#0369a1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${allCpmk.length} CPMK</span>
            <span class="matrix-stat-label">Capaian MK Terstandar</span>
            <span class="matrix-stat-sub">${multiMkCpmkCount} CPMK tersebar di multi-MK</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon relation" style="background:#fef3c7;color:#b45309">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val">${totalSub} Sub-CPMK</span>
            <span class="matrix-stat-label">Indikator Pembelajaran Rinci</span>
            <span class="matrix-stat-sub">Rata-rata ${allCpmk.length ? (totalSub / allCpmk.length).toFixed(1) : 0} per CPMK</span>
          </div>
        </div>

        <div class="matrix-stat-card">
          <div class="matrix-stat-icon obe pass">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="matrix-stat-info">
            <span class="matrix-stat-val" style="color:var(--success)">Standarisasi Baku</span>
            <span class="matrix-stat-label">Format Penomoran Kode</span>
            <span class="matrix-stat-sub">CPMKxx.yy &bull; SubCPMKxx.yy.zz</span>
          </div>
        </div>
      </div>

      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left">
          <div class="matrix-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="cpmk-decomp-q" type="search" placeholder="Cari CPMK / Sub-CPMK / MK..." value="${esc(cpmkSearch)}" />
          </div>

        </div>
      </div>

      <div class="cpl-cpmk-wrap">
        ${filteredCpl.map(cpl => {
          let cpmkList = allCpmk.filter(cp => (Array.isArray(cp.cpl) ? cp.cpl.includes(cpl.kode) : cp.cpl === cpl.kode));
          if (cpmkSearch) {
            const q = cpmkSearch.toLowerCase();
            cpmkList = cpmkList.filter(cp => {
              const str = (cp.kode + " " + cp.nama + " " + (cp.mk || []).join(" ") + " " + (cp.sub_cpmk || []).map(s => s.nama).join(" ")).toLowerCase();
              return str.includes(q);
            });
          }

          if (cpmkList.length === 0 && cpmkSearch) return "";

          return `
            <div class="cpl-cpmk-card">
              <div class="cpl-cpmk-head">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span class="tag ${cpl.jenis === "Hard skill" ? "hard" : "softs"}" style="font-size:12px;font-weight:700">${esc(cpl.kode)}</span>
                    <span class="tag neutral">${cpl.jenis || "Hard skill"}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${cpmkList.length} CPMK Terkait</span>
                  </div>
                  <h3 style="font-size:15px;margin:0;font-weight:600;color:var(--text)">${esc(cpl.nama)}</h3>
                </div>
              </div>

              <div class="cpl-cpmk-body">
                ${cpmkList.length ? cpmkList.map(cp => {
                  const mappedMks = (cp.mk || []).map(k => allMk.find(m => m.kode === k)).filter(Boolean);
                  const subList = cp.sub_cpmk || [];

                  return `
                    <div class="cpmk-item-card">
                      <div class="cpmk-item-header">
                        <div style="flex:1">
                          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                            <span class="cpmk-code-pill">${esc(cp.kode)}</span>
                            <span style="font-size:12px;color:var(--text-muted)">Dibebankan pada ${mappedMks.length} Mata Kuliah</span>
                          </div>
                          <div style="font-size:13.5px;font-weight:600;color:var(--text);line-height:1.4">${esc(cp.nama)}</div>
                        </div>
                      </div>

                      <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Mata Kuliah Pengampu:</span>
                        ${mappedMks.length ? mappedMks.map(m => `
                          <button type="button" class="mk-head-code" style="cursor:pointer;border:none" data-matrix-mk-info="${esc(m.kode)}">
                            ${esc(m.kode)} - ${esc(m.nama)} (Sem ${esc(m.sem)})
                          </button>
                        `).join("") : '<span style="font-size:12px;color:var(--warning)">Belum ada MK penampung</span>'}
                      </div>

                      <div class="subcpmk-drawer">
                        <div class="subcpmk-title">Rincian Sub-CPMK (${subList.length}):</div>
                        <ul class="subcpmk-list">
                          ${subList.map(s => `
                            <li class="subcpmk-row">
                              <span class="subcpmk-code">${esc(s.kode)}:</span>
                              <span>${esc(s.nama || s.deskripsi)}</span>
                              ${s.unit_skkni ? `<span class="tag hard" style="font-size:10px;margin-left:6px">${esc(s.unit_skkni)}</span>` : ""}
                            </li>
                          `).join("")}
                        </ul>
                      </div>
                    </div>
                  `;
                }).join("") : `
                  <div style="color:var(--text-muted);font-size:13px;padding:8px 0">
                    Belum ada CPMK yang diturunkan untuk CPL ini.
                  </div>
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

// ==========================================================
// 9. CPMK PER SEMESTER (Matriks Operasional Sheet 12)
// ==========================================================
function renderCpmkSemester() {
  if ($("log-header-container")) $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";

  $("crumb").textContent = "Analisis & Pemenuhan CPL / CPMK per Semester";
  $("title").textContent = "Distribusi Beban CPMK & Sub-CPMK per Semester";
  $("lead").textContent =
    "Matriks operasional rencana pembelajaran per semester (Sheet 12). Menampilkan daftar mata kuliah yang aktif di semester berjalan beserta seluruh CPMK dan Sub-CPMK yang harus diasesmen.";
  $("bar").style.display = "none";

  const allMk = db.mk || [];
  const allCpmk = db.cpmk || [];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  let semMks = allMk.filter(m => m.sem === cpmkSemActive);
  if (cpmkSemSearch) {
    const q = cpmkSemSearch.toLowerCase();
    semMks = semMks.filter(m => (m.kode + " " + (m.nama || "")).toLowerCase().includes(q));
  }

  let totalCpmkInSem = 0;
  let totalSubInSem = 0;
  semMks.forEach(m => {
    const mCpmks = allCpmk.filter(cp => (cp.mk || []).includes(m.kode));
    totalCpmkInSem += mCpmks.length;
    mCpmks.forEach(cp => {
      totalSubInSem += ((cp.sub_cpmk || []).length);
    });
  });

  $("view-container").innerHTML = `
    <div class="matrix-view-wrap">
      <div class="matrix-toolbar">
        <div class="matrix-toolbar-left" style="flex-wrap:wrap">
          <div class="tripartit-tabs">
            ${semesters.map(s => `
              <button type="button" class="tripartit-tab-btn ${cpmkSemActive === s ? "active" : ""}" data-cpmk-sem-tab="${s}">
                Semester ${s}
              </button>
            `).join("")}
          </div>
          <div class="matrix-search" style="margin-left:6px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="cpmk-sem-q" type="search" placeholder="Cari MK di Semester ${cpmkSemActive}..." value="${esc(cpmkSemSearch)}" />
          </div>
        </div>
        <div class="matrix-toolbar-right">
          <div style="font-size:12.5px;color:var(--text-secondary);display:flex;gap:12px">
            <span><b>${semMks.length}</b> MK Aktif</span>
            <span><b>${totalCpmkInSem}</b> CPMK Diasesmen</span>
            <span><b>${totalSubInSem}</b> Sub-CPMK Terinci</span>
          </div>
        </div>
      </div>

      <div class="cpmk-sem-grid">
        ${semMks.length ? semMks.map(m => {
          const mCpmks = allCpmk.filter(cp => (cp.mk || []).includes(m.kode));
          return `
            <div class="cpmk-sem-card">
              <div class="cpmk-sem-card-head">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                    <button type="button" class="mk-head-code" style="cursor:pointer;border:none" data-matrix-mk-info="${esc(m.kode)}">
                      ${esc(m.kode)}
                    </button>
                    <span class="pill-kat ${m.kat === "Umum" ? "umum" : "inti"}" style="font-size:10.5px;padding:2px 6px">${esc(m.kat)}</span>
                    <span class="pill-jenis ${m.jenis === "Praktik" ? "prak" : "teori"}" style="font-size:10px;padding:1px 5px">${esc(m.jenis)}</span>
                  </div>
                  <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0">${esc(m.nama)}</h4>
                </div>
                <span class="tag neutral" style="margin:0;font-size:11px">${esc(m.sks)} SKS</span>
              </div>

              <div style="display:flex;flex-direction:column;gap:10px">
                <span style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.04em">
                  Capaian MK &bull; CPMK (${mCpmks.length}):
                </span>
                ${mCpmks.length ? mCpmks.map(cp => `
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">
                      <span class="cpmk-code-pill" style="font-size:11px;padding:2px 6px">${esc(cp.kode)}</span>
                      <span style="font-size:11px;color:var(--text-muted)">Induk: ${Array.isArray(cp.cpl) ? cp.cpl.join(", ") : cp.cpl}</span>
                    </div>
                    <div style="font-size:12.5px;font-weight:600;color:var(--text);line-height:1.35;margin-bottom:6px">
                      ${esc(cp.nama)}
                    </div>
                    ${(cp.sub_cpmk && cp.sub_cpmk.length) ? `
                      <div style="font-size:11px;color:var(--text-secondary);border-top:1px dashed #e2e8f0;padding-top:6px;display:flex;flex-direction:column;gap:3px">
                        ${cp.sub_cpmk.map(s => `
                          <div>&bull; <b>${esc(s.kode)}:</b> ${esc(s.nama || s.deskripsi)}${s.unit_skkni ? ` <span class="tag hard" style="font-size:10px;padding:0 4px">${esc(s.unit_skkni)}</span>` : ""}</div>
                        `).join("")}
                      </div>
                    ` : ""}
                  </div>
                `).join("") : `
                  <div style="font-size:12px;color:var(--text-muted)">
                    Belum ada CPMK khusus yang dipetakan pada MK ini.
                  </div>
                `}
              </div>
            </div>
          `;
        }).join("") : `
          <div style="grid-column: 1 / -1;text-align:center;padding:48px 16px;background:#fff;border-radius:12px;border:1px solid var(--border)">
            <div class="empty"><b>Tidak ada mata kuliah aktif di Semester ${cpmkSemActive} yang cocok</b></div>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderMatrixOrSpecialView(id) {
  if ($("log-header-container"))
    $("log-header-container").innerHTML = "";
  if ($("btn-master-log")) $("btn-master-log").style.display = "none";
  const item = getMenuModule(id);
  $("crumb").textContent = `${item.group} / ${item.label}`;
  $("title").textContent = item.label;
  $("lead").textContent = `Modul ${item.label} sedang dalam tahap perancangan dan standarisasi relasi kurikulum OBE.`;
  $("bar").style.display = "none";

  $("view-container").innerHTML = `
    <div class="uc-card">
      <div class="uc-icon-box">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>
      <div class="uc-pill">
        <span class="uc-dot"></span>
        <span>Under Construction</span>
      </div>
      <h2 class="uc-title">${esc(item.label)}</h2>
      <p class="uc-desc">
        Halaman ini sedang dalam proses perancangan dan integrasi dengan sistem kurikulum OBE TRPL Politeknik Astra. Seluruh data master tetap dapat dikelola secara normal.
      </p>
      <div class="uc-grid">
        <div class="uc-item">
          <div class="uc-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <strong>Tahap Desain & Relasi</strong>
            <p>Penyelarasan matriks kompetensi kurikulum OBE</p>
          </div>
        </div>
        <div class="uc-item">
          <div class="uc-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div>
            <strong>Sinkronisasi Master</strong>
            <p>Koneksi langsung dengan PL, CPL, BK, MK, & CPMK</p>
          </div>
        </div>
        <div class="uc-item">
          <div class="uc-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <strong>Validasi Otomatis</strong>
            <p>Memastikan pemenuhan standar aturan akademik OBE</p>
          </div>
        </div>
      </div>
      <button class="btn uc-back-btn" data-t="pl">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Kembali ke Data Master (PL)
      </button>
    </div>
  `;
}

// Modal Form Operations
function open(h) {
  $("modal").innerHTML = h;
  $("ov").classList.add("on");
  const x = $("modal").querySelector("input,select,textarea,button");
  x && x.focus();
}

function close() {
  $("ov").classList.remove("on");
}

function showForm(i) {
  const e = E[tab];
  edit = i;
  const r = i == null ? {} : db[tab][i];
  form = { errors: {} };
  let init = { ...r };

  if (i == null) {
    if (tab === "mk") {
      init.kat = "Inti RPL";
      init.jenis = "Praktik";
      init.sem = 1;
      init.sksTeori = 1;
      init.sksPrak = 2;
      init.sks = 3;
      init.prasyarat = [];
      init.kode = mkCode("Inti RPL");
    } else if (tab === "cpmk") {
      const defaultCpl = db.cpl[0] ? db.cpl[0].kode : "CPL01";
      init.cpl = Array.isArray(r.cpl) ? [...r.cpl] : r.cpl ? [r.cpl] : [defaultCpl];
      init.mk = Array.isArray(r.mk) ? [...r.mk] : r.mk ? [r.mk] : [db.mk[0] ? db.mk[0].kode : "krpl2501"];
      init.kode = nextCPMKCode(init.cpl[0] || defaultCpl);
    } else if (tab === "bk") {
      init.kode = nextCode("bk", "BK");
      init.mk = [];
    } else if (tab === "cpl") {
      init.kode = nextCode("cpl", "CPL");
      init.jenis = "Hard skill";
      init.pl = [];
      init.bk = [];
      init.mk = [];
    } else if (tab === "sub_cpmk") {
      const defaultCpl = db.cpl[0] ? db.cpl[0].kode : "CPL01";
      const relatedCpmk = (db.cpmk || []).find(c => c.cpl === defaultCpl);
      init.cpl = defaultCpl;
      init.cpmk = relatedCpmk ? relatedCpmk.kode : "CPMK.01.1";
      const count = (db.sub_cpmk || []).length + 1;
      init.kode = `Sub-CPMK.${defaultCpl.replace(/\D/g, "")}.1.${count}`;
      init.deskripsi = "";
      init.unit_skkni = "";
    } else {
      init.kode = nextCode(tab, e.pre);
    }
  }
  form.v = init;
  drawForm();
}

function drawForm(err = {}) {
  const e = E[tab],
    v = form.v,
    i = edit;

  const f = e.fields
    .map((d) => {
      let c = "";
      const val = v[d.k] ?? "";

      if (d.t === "area") {
        c = `<textarea name="${d.k}" rows="3">${esc(val)}</textarea>`;
      } else if (d.t === "sel") {
        c = `<select name="${d.k}">${d.o.map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
      } else if (d.t === "sel-cpl") {
        const currentVal = Array.isArray(val) ? val[0] : val;
        c = `<select name="${d.k}" id="sel-cpl">${db.cpl.map((cpl) => `<option value="${esc(cpl.kode)}" ${cpl.kode === currentVal ? "selected" : ""}>${esc(cpl.kode)} - ${esc(cpl.nama)}</option>`).join("")}</select>`;
      } else if (d.t === "sel-mk") {
        c = `<select name="${d.k}">${db.mk.map((mk) => `<option value="${esc(mk.kode)}" ${mk.kode === val ? "selected" : ""}>${esc(mk.kode)} - ${esc(mk.nama)} (Sem ${mk.sem})</option>`).join("")}</select>`;
      } else if (d.t === "multi") {
        const n = (v.pl || []).length;
        c =
          `<div class="gh"><span class="gt">${d.l}</span><span class="cnt" id="cnt">${n} dari ${db.pl.length} dipilih</span></div>` +
          (db.pl.length
            ? `<div class="chk">${db.pl
                .map(
                  (p) => `
    <label class="pick">
      <input type="checkbox" name="pl" value="${esc(p.kode)}" ${(v.pl || []).includes(p.kode) ? "checked" : ""}>
      <span class="box">
        <span class="ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>
        <span class="tx"><b>${esc(p.kode)}</b>${esc(p.nama)}</span>
      </span>
    </label>
  `,
                )
                .join("")}</div>`
            : '<div class="h">Belum ada PL.</div>');
      } else if (d.t === "multi-mk") {
        const n = (v.mk || []).length;
        c =
          `<div class="gh"><span class="gt">${d.l}</span><span class="cnt">${n} MK dipilih</span></div>` +
          `<div class="chk">${db.mk
            .map(
              (m) => `
    <label class="pick">
      <input type="checkbox" name="mk" value="${esc(m.kode)}" ${(v.mk || []).includes(m.kode) ? "checked" : ""}>
      <span class="box">
        <span class="ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>
        <span class="tx"><b>${esc(m.kode)}</b>${esc(m.nama)} (Sem ${m.sem})</span>
      </span>
    </label>
  `,
            )
            .join("")}</div>`;
      } else if (d.t === "multi-prereq") {
        const availableMK = db.mk.filter(
          (m) => !v.kode || m.kode !== v.kode,
        );
        c =
          `<div class="gh"><span class="gt">${d.l}</span></div>` +
          `<div class="chk">${availableMK
            .map(
              (m) => `
    <label class="pick">
      <input type="checkbox" name="prasyarat" value="${esc(m.kode)}" ${(v.prasyarat || []).includes(m.kode) ? "checked" : ""}>
      <span class="box">
        <span class="ck"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>
        <span class="tx"><b>${esc(m.kode)}</b>${esc(m.nama)}</span>
      </span>
    </label>
  `,
            )
            .join("")}</div>`;
      } else {
        c = `<input type="${d.t === "num" ? "number" : "text"}" name="${d.k}" value="${esc(val)}" ${d.min != null ? `min="${d.min}"` : ""} ${d.max != null ? `max="${d.max}"` : ""}>`;
      }

      const isCustomContainer =
        d.t === "multi" || d.t === "multi-mk" || d.t === "multi-prereq";
      return `<div class="fld ${err[d.k] ? "err" : ""}">
${isCustomContainer ? `<div class="grp">${c}</div>` : `<div class="tf">${c}<label>${d.l}${d.opt ? " (opsional)" : ""}</label></div>`}
${err[d.k] ? `<div class="e">${err[d.k]}</div>` : d.h ? `<div class="h">${d.h}</div>` : ""}
</div>`;
    })
    .join("");

  const m =
    i != null
      ? `<div class="meta">Terakhir diubah oleh ${esc(db[tab][i].by)}, ${esc(db[tab][i].at)}. Perubahan ini akan tercatat atas nama ${USER}.</div>`
      : `<div class="meta">Data baru ini akan otomatis tercatat dibuat oleh ${USER}.</div>`;
  open(
    `<h2>${i == null ? e.add : "Ubah " + esc(db[tab][i].kode)}</h2><p class="s">Lengkapi isian data sesuai standar kurikulum TRPL Politeknik Astra.</p><form id="fm" novalidate>${f}</form>${m}<div class="mf"><button class="btn ghost" data-x>Batal</button><button class="btn" id="save" style="margin:0">Simpan Data</button></div>`,
  );
}

function readForm() {
  const o = { ...form.v };
  const fm = $("fm");
  if (!fm) return o;
  [...fm.elements].forEach((el) => {
    if (el.name && el.type !== "checkbox") o[el.name] = el.value.trim();
  });
  if (tab === "cpl") {
    o.pl = [...fm.querySelectorAll("[name=pl]:checked")].map(
      (x) => x.value,
    );
  } else if (tab === "cpmk") {
    o.mk = [...fm.querySelectorAll("[name=mk]:checked")].map(
      (x) => x.value,
    );
    if (o.cpl && !Array.isArray(o.cpl)) {
      o.cpl = [o.cpl];
    }
  } else if (tab === "bk") {
    o.mk = [...fm.querySelectorAll("[name=mk]:checked")].map(
      (x) => x.value,
    );
  } else if (tab === "mk") {
    o.prasyarat = [
      ...fm.querySelectorAll("[name=prasyarat]:checked"),
    ].map((x) => x.value);
    o.sksTeori = +(o.sksTeori || 0);
    o.sksPrak = +(o.sksPrak || 0);
    o.sks = o.sksTeori + o.sksPrak;
    o.sem = +(o.sem || 1);
  }
  return o;
}

function save() {
  const o = readForm(),
    e = E[tab],
    err = {};
  e.fields.forEach((d) => {
    if (
      d.opt ||
      d.t === "multi" ||
      d.t === "multi-mk" ||
      d.t === "multi-prereq"
    )
      return;
    if (!o[d.k] && o[d.k] !== 0) err[d.k] = "Wajib diisi.";
  });

  if (
    !err.kode &&
    db[tab].some(
      (r, j) =>
        r.kode.toLowerCase() === o.kode.toLowerCase() && j !== edit,
    )
  ) {
    err.kode = "Kode " + o.kode + " sudah terdaftar. Gunakan kode lain.";
  }
  if (tab === "cpl" && (!o.pl || !o.pl.length)) {
    err.pl =
      "Pilih minimal satu PL. CPL wajib diturunkan dari Profil Lulusan.";
  }
  if (tab === "bk" && (!o.mk || !o.mk.length)) {
    err.mk =
      "Peringatan Kurikulum: Bahan Kajian tidak boleh null MK. Pilih minimal satu mata kuliah pengampu.";
  }
  if (tab === "cpmk" && !err.kode && !/^CPMK[\.\d]\d{2}\.[\d\.]+$/i.test(o.kode)) {
    err.kode =
      "Format kode CPMK harus terstandarisasi, contoh: CPMK01.01 atau CPMK02.02";
  }

  form.v = o;
  if (Object.keys(err).length) {
    drawForm(err);
    const x = $("modal").querySelector(
      ".fld.err input, .fld.err select, .fld.err textarea",
    );
    x && x.focus();
    return;
  }

  o.by = USER;
  o.at = stamp();

  const isNew = edit == null;
  if (isNew) {
    db[tab].push(o);
    addAuditLog({
      master: tab,
      aksi: "tambah",
      kode: o.kode,
      nama: o.nama || o.kode,
      keterangan: `Menambahkan data baru ${o.kode} - ${o.nama || ""}`,
      changes: Object.keys(o)
        .filter((k) => k !== "by" && k !== "at")
        .map((k) => ({
          field: k,
          label: getFieldLabel(tab, k),
          old: null,
          new: o[k],
        })),
      detail: { ...o },
    });
  } else {
    const prev = db[tab][edit];
    const changes = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(o)]);
    allKeys.forEach((k) => {
      if (k === "by" || k === "at") return;
      const oldVal = prev[k];
      const newVal = o[k];
      if (JSON.stringify(oldVal ?? "") !== JSON.stringify(newVal ?? "")) {
        changes.push({
          field: k,
          label: getFieldLabel(tab, k),
          old: oldVal,
          new: newVal,
        });
      }
    });
    db[tab][edit] = o;
    addAuditLog({
      master: tab,
      aksi: "ubah",
      kode: o.kode,
      nama: o.nama || o.kode,
      keterangan: changes.length
        ? `Memperbarui ${changes.length} atribut: ${changes.map((c) => c.label).join(", ")}`
        : `Menyimpan pembaruan data ${o.kode}`,
      changes,
      detail: { sebelum: { ...prev }, sesudah: { ...o } },
    });
  }

  close();
  render();
}

function askDel(i) {
  const r = db[tab][i];
  let used = 0;
  let reason = "";

  if (tab === "pl") {
    used = db.cpl.filter((c) => (c.pl || []).includes(r.kode)).length;
    reason = `masih dipakai oleh ${used} CPL. Hapus atau alihkan relasi CPL tersebut lebih dahulu agar data tetap konsisten.`;
  } else if (tab === "cpl") {
    used = (db.cpmk || []).filter((c) => c.cpl === r.kode).length;
    reason = `masih menjadi induk dari ${used} CPMK. Hapus CPMK turunannya lebih dahulu.`;
  } else if (tab === "cpmk") {
    used = (db.sub_cpmk || []).filter((s) => s.cpmk === r.kode).length;
    reason = `masih menjadi induk dari ${used} Sub-CPMK. Hapus Sub-CPMK turunannya lebih dahulu.`;
  } else if (tab === "mk") {
    used = db.cpmk.filter((c) => c.mk === r.kode).length;
    reason = `masih mengampu ${used} CPMK. Ubah atau hapus CPMK terkait lebih dahulu.`;
  }

  if (used) {
    open(
      `<h2>${esc(r.kode)} Belum Bisa Dihapus</h2><p class="s">${esc(r.kode)} ${reason}</p><div class="mf"><button class="btn" data-x style="margin:0">Mengerti</button></div>`,
    );
    return;
  }

  open(
    `<h2>Hapus ${esc(r.kode)}?</h2><p class="s">Data <b>${esc(r.nama)}</b> akan dihapus permanen dari kurikulum. Tindakan ini akan tercatat dalam audit log atas nama ${USER}.</p><div class="mf"><button class="btn ghost" data-x>Batal</button><button class="btn danger" data-ok="${i}">Ya, Hapus</button></div>`,
  );
}

function askResetDb() {
  open(`
    <h2>Reset Semua Data Kurikulum?</h2>
    <p class="s">Tindakan ini akan <b>menghapus seluruh perubahan lokal</b> (penambahan, perubahan data master, relasi matriks, dan riwayat audit log) serta mengembalikan kurikulum ke <b>data default awal</b>.</p>
    <div class="mf" style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px">
      <button type="button" class="btn ghost" data-x style="margin:0">Batal</button>
      <button type="button" class="btn danger" id="confirm-reset-db" style="margin:0">Ya, Reset ke Data Awal</button>
    </div>
  `);
}

function confirmResetDb() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Gagal menghapus localStorage:", e);
  }
  location.reload();
}

// Event Listeners
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button, #ov, #sidebar-backdrop");
  if (!b) return;

  if (b.id === "toggle-sidebar") {
    toggleSidebar();
  } else if (b.id === "btn-reset-db") {
    askResetDb();
  } else if (b.id === "confirm-reset-db") {
    confirmResetDb();
  } else if (b.id === "sidebar-backdrop") {
    closeMobileSidebar();
  } else if (b.dataset.logMaster) {
    logMasterFilter = b.dataset.logMaster;
    tab = "log_master";
    render();
  } else if (b.id === "btn-master-log" || b.dataset.targetLogMaster) {
    logMasterFilter = b.dataset.targetLogMaster || "all";
    tab = "log_master";
    render();
  } else if (b.dataset.logId) {
    openLogDetail(b.dataset.logId);
  } else if (b.id === "log-btn-reset" || b.closest("#log-btn-reset")) {
    logActionFilter = "";
    logUserFilter = "";
    logSearchQuery = "";
    logTimeFilter = "all";
    logDateStart = "";
    logDateEnd = "";
    logSortOrder = "desc";
    renderLogPage(tab);
  } else if (b.id === "log-btn-clear-date" || b.closest("#log-btn-clear-date")) {
    logDateStart = "";
    logDateEnd = "";
    const sInp = $("log-date-start");
    const eInp = $("log-date-end");
    if (sInp) sInp.value = "";
    if (eInp) eInp.value = "";
    renderLogTable();
    updateLogResetBtn();
  } else if (b.closest("[data-matrix-mode-toggle]")) {
    const btn = b.closest("[data-matrix-mode-toggle]");
    const mId = btn.dataset.matrixModeToggle;
    matrixState.interactive[mId] = !matrixState.interactive[mId];
    renderMatrix2D(mId);
  } else if (b.closest("[data-matrix-guide]")) {
    const btn = b.closest("[data-matrix-guide]");
    openMatrixGuideModal(btn.dataset.matrixGuide);
  } else if (b.closest("[data-matrix-toggle-row]")) {
    const btn = b.closest("[data-matrix-toggle-row]");
    toggleMatrixRelation(btn.dataset.matrixId, btn.dataset.matrixToggleRow, btn.dataset.matrixToggleCol);
  } else if (b.dataset.matrixPlInfo) {
    openMatrixPlDetail(b.dataset.matrixPlInfo);
  } else if (b.dataset.matrixCplInfo) {
    openMatrixCplDetail(b.dataset.matrixCplInfo);
  } else if (b.dataset.matrixBkInfo) {
    openMatrixBkDetail(b.dataset.matrixBkInfo);
  } else if (b.dataset.matrixMkInfo) {
    openMatrixMkDetail(b.dataset.matrixMkInfo);
  } else if (b.dataset.matrixCpmkInfo) {
    openMatrixCpmkDetail(b.dataset.matrixCpmkInfo);
  } else if (b.dataset.tripartitTab) {
    tripartitView = b.dataset.tripartitTab;
    renderMatrixBkCplMk();
  } else if (b.dataset.susunanSemTab) {
    susunanSemFilter = b.dataset.susunanSemTab;
    renderSusunanMk();
  } else if (b.dataset.orgSelectMk) {
    orgSelectedMk = orgSelectedMk === b.dataset.orgSelectMk ? null : b.dataset.orgSelectMk;
    renderOrganisasiMk();
  } else if (b.id === "org-btn-clear-select") {
    orgSelectedMk = null;
    renderOrganisasiMk();
  } else if (b.dataset.cpmkSemTab) {
    cpmkSemActive = parseInt(b.dataset.cpmkSemTab, 10);
    renderCpmkSemester();
  } else if (b.dataset.t) {
    if (b.dataset.t === "log_master") {
      logMasterFilter = "all";
    }
    tab = b.dataset.t;
    $("q").value = "";
    if ($("flt")) {
      $("flt").value = "";
    }
    render();
    if (isMobile()) {
      closeMobileSidebar();
    }
  } else if (b.id === "add") {
    showForm(null);
  } else if (b.dataset.e != null && b.dataset.e !== "") {
    showForm(+b.dataset.e);
  } else if (b.dataset.d != null && b.dataset.d !== "") {
    askDel(+b.dataset.d);
  } else if (b.id === "save") {
    save();
  } else if (b.dataset.ok != null && b.dataset.ok !== "") {
    const r = db[tab].splice(+b.dataset.ok, 1)[0];
    addAuditLog({
      master: tab,
      aksi: "hapus",
      kode: r.kode,
      nama: r.nama || r.kode,
      keterangan: `Menghapus data ${r.kode} - ${r.nama || ""} dari kurikulum aktif`,
      changes: Object.keys(r)
        .filter((k) => k !== "by" && k !== "at")
        .map((k) => ({
          field: k,
          label: getFieldLabel(tab, k),
          old: r[k],
          new: null,
        })),
      detail: { ...r },
    });
    close();
    render();
  } else if ("x" in b.dataset || ev.target === $("ov")) {
    close();
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    close();
    if (isMobile()) {
      closeMobileSidebar();
    }
  }
});

document.addEventListener("input", (ev) => {
  const matrixInput = ev.target.closest(".matrix-search-input");
  if (matrixInput) {
    const mId = matrixInput.dataset.matrixId;
    matrixState.search[mId] = matrixInput.value.trim().toLowerCase();
    renderMatrix2D(mId);
    return;
  }
  if (ev.target.id === "log-q") {
    logSearchQuery = ev.target.value.trim().toLowerCase();
    renderLogTable();
    updateLogResetBtn();
  } else if (ev.target.id === "log-date-start") {
    logDateStart = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
  } else if (ev.target.id === "log-date-end") {
    logDateEnd = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
  }
});

document.addEventListener("change", (ev) => {
  if (ev.target.id === "matrix-flt-jenis") {
    matrixJenisFilter = ev.target.value;
    renderMatrixCplPl();
    return;
  }
  if (ev.target.id === "matrix-flt-status") {
    matrixStatusFilter = ev.target.value;
    renderMatrixCplPl();
    return;
  }
  if (ev.target.id === "log-flt-action") {
    logActionFilter = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.id === "log-flt-user") {
    logUserFilter = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.id === "log-flt-time") {
    logTimeFilter = ev.target.value;
    const rangeWrap = $("log-date-range-wrap");
    if (rangeWrap) {
      rangeWrap.style.display = logTimeFilter === "custom" ? "inline-flex" : "none";
    }
    if (logTimeFilter !== "custom") {
      logDateStart = "";
      logDateEnd = "";
      const sInp = $("log-date-start");
      const eInp = $("log-date-end");
      if (sInp) sInp.value = "";
      if (eInp) eInp.value = "";
    }
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.id === "log-date-start") {
    logDateStart = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.id === "log-date-end") {
    logDateEnd = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.id === "log-flt-sort") {
    logSortOrder = ev.target.value;
    renderLogTable();
    updateLogResetBtn();
    return;
  }
  if (ev.target.name === "pl") {
    const n = document.querySelectorAll("[name=pl]:checked").length;
    const c = $("cnt");
    if (c) c.textContent = n + " dari " + db.pl.length + " dipilih";
  }
  if (ev.target.name === "kat" && tab === "mk" && edit == null) {
    form.v = readForm();
    form.v.kode = mkCode(form.v.kat);
    drawForm();
  }
  if (ev.target.id === "sel-cpl" && tab === "cpmk" && edit == null) {
    form.v = readForm();
    form.v.kode = nextCPMKCode(form.v.cpl);
    drawForm();
  }
});

// Matrix Crosshair Column Hover (All 4 OBE Matrices)
document.addEventListener("mouseover", (ev) => {
  if (!(tab in MATRIX_CONFIGS)) return;
  const cell = ev.target.closest(".matrix-cell, th[data-col]");
  if (cell) {
    const col = cell.dataset.col;
    if (col && col !== matrixHoverCol) {
      matrixHoverCol = col;
      document.querySelectorAll(`[data-col="${col}"]`).forEach((el) => el.classList.add("col-hover"));
    }
  }
});

document.addEventListener("mouseout", (ev) => {
  if (!(tab in MATRIX_CONFIGS)) return;
  const cell = ev.target.closest(".matrix-cell, th[data-col]");
  if (cell) {
    const relTarget = ev.relatedTarget;
    const nextCell = relTarget ? relTarget.closest(".matrix-cell, th[data-col]") : null;
    const nextCol = nextCell ? nextCell.dataset.col : null;
    if (nextCol !== matrixHoverCol) {
      document.querySelectorAll(".col-hover").forEach((el) => el.classList.remove("col-hover"));
      matrixHoverCol = null;
    }
  }
});

$("q").addEventListener("input", render);
if ($("flt")) $("flt").addEventListener("change", render);
$("modal").addEventListener("submit", (ev) => {
  ev.preventDefault();
  save();
});

window.addEventListener("resize", () => {
  if (!isMobile()) {
    closeMobileSidebar();
  }
});

// Initial boot
initDb();
