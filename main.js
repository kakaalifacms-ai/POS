
// ==========================================
// 1. IMPORT FIREBASE DAN QR CODE
// ==========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  doc,
  collection,
  setDoc,
  onSnapshot,
  runTransaction,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import QRCode from "https://esm.sh/qrcode@1.5.3";

// ==========================================
// 2. KONFIGURASI FIREBASE
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyC_1XwbW-9zcNkRJXIQr4N1GgAyzQr6O2g",
  authDomain: "uasgenap2026-549f7.firebaseapp.com",
  projectId: "uasgenap2026-549f7",
  storageBucket: "uasgenap2026-549f7.firebasestorage.app",
  messagingSenderId: "560108074909",
  appId: "1:560108074909:web:50c7719780334c88bee174"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Referensi database
const saldoRef = doc(db, "pengaturan", "saldoKasir");
const menuRef = collection(db, "menu");
const penjualRef = collection(db, "penjual");

// ==========================================
// 3. VARIABEL GLOBAL
// ==========================================

let semuaMenu = [];
let semuaPenjual = [];

let keranjang = {};
let totalHarga = 0;

let trxIdSekarang = "";
let unsubscribeListener = null;

let prosesSedangBerjalan = false;
let sedangMemprosesSaldo = false;
let suaraDiaktifkan = false;
let notifikasiSudahDitampilkan = false;
let pembayaranLunas = false;

let fileGambarTerpilih = null;

// ==========================================
// 4. FUNGSI BANTUAN
// ==========================================

function rupiah(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

function aman(teks) {
  return String(teks ?? "").replace(/[&<>"']/g, karakter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[karakter]);
}

function tampilkanPesan(pesan) {
  alert(pesan);
}

// ==========================================
// 5. MENAMPILKAN SALDO KASIR
// ==========================================

onSnapshot(saldoRef, snapshot => {
  const data = snapshot.exists() ? snapshot.data() : {};

  const saldo = Number(data.saldoKasir ?? data.saldo ?? 0);
  const pemasukan = Number(data.totalPemasukan ?? 0);

  const elemenSaldo = document.getElementById("saldo-kasir");
  const elemenPemasukan = document.getElementById("total-pemasukan");

  if (elemenSaldo) {
    elemenSaldo.textContent = rupiah(saldo);
  }

  if (elemenPemasukan) {
    elemenPemasukan.textContent = rupiah(pemasukan);
  }
}, error => {
  console.error("Gagal membaca saldo:", error);
});

// ==========================================
// 6. MEMBACA DATA MENU
// ==========================================

onSnapshot(menuRef, snapshot => {
  semuaMenu = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  tampilkanMenuKasir();
  tampilkanDaftarCrudMenu();
}, error => {
  console.error("Gagal membaca menu:", error);

  const grid = document.getElementById("menu-grid");
  if (grid) {
    grid.innerHTML = '<p class="keranjang-kosong">Gagal memuat menu.</p>';
  }
});

// ==========================================
// 7. MEMBACA DATA PENJUAL
// ==========================================

onSnapshot(penjualRef, snapshot => {
  semuaPenjual = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  tampilkanDaftarPenjual();
  isiPilihanPenjual();
  tampilkanMenuKasir();
  tampilkanDaftarCrudMenu();
}, error => {
  console.error("Gagal membaca penjual:", error);
});

// ==========================================
// 8. MENAMPILKAN MENU DI HALAMAN KASIR
// ==========================================

function tampilkanMenuKasir() {
  const grid = document.getElementById("menu-grid");
  if (!grid) return;

  if (semuaMenu.length === 0) {
    grid.innerHTML =
      '<p class="keranjang-kosong">Belum ada menu. Tambahkan melalui halaman kelola data.</p>';
    return;
  }

  grid.innerHTML = semuaMenu.map((menu, index) => {
    const penjual = semuaPenjual.find(p => p.id === menu.penjualId);
    const namaPenjual = penjual?.nama || "Penjual tidak ditemukan";

    return `
      <div class="menu-card">
        ${
          menu.gambar
            ? `<img src="${menu.gambar}" alt="${aman(menu.nama)}">`
            : `<div class="menu-no-image">Foto belum tersedia</div>`
        }
        <div class="menu-info">
          <h4>${aman(menu.nama)}</h4>
          <p class="harga-menu">${rupiah(menu.harga)}</p>
          <p class="penjual-label">${aman(namaPenjual)}</p>
          <button
            class="btn-tambah"
            type="button"
            data-tambah-menu="${index}">
            + Tambah
          </button>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("menu-grid")?.addEventListener("click", event => {
  const tombol = event.target.closest("[data-tambah-menu]");
  if (!tombol) return;

  const index = Number(tombol.dataset.tambahMenu);
  const menu = semuaMenu[index];

  if (menu) {
    tambahKeKeranjang(menu.nama, Number(menu.harga));
  }
});

// ==========================================
// 9. KERANJANG BELANJA
// ==========================================

function tambahKeKeranjang(nama, harga) {
  if (prosesSedangBerjalan || pembayaranLunas) {
    tampilkanPesan("Transaksi sebelumnya belum selesai.");
    return;
  }

  if (!keranjang[nama]) {
    keranjang[nama] = {
      harga: Number(harga),
      jumlah: 0
    };
  }

  keranjang[nama].jumlah++;

  hitungTotal();
  tampilkanKeranjang();
}

function hitungTotal() {
  totalHarga = 0;

  Object.values(keranjang).forEach(item => {
    totalHarga += item.harga * item.jumlah;
  });

  const elemenTotal = document.getElementById("total-harga");
  if (elemenTotal) {
    elemenTotal.textContent = rupiah(totalHarga);
  }

  const tombolBayar = document.getElementById("btn-bayar");
  if (tombolBayar) {
    tombolBayar.disabled = totalHarga <= 0 || prosesSedangBerjalan;
  }
}

function tampilkanKeranjang() {
  const daftar = document.getElementById("daftar-keranjang");
  if (!daftar) return;

  const namaMenu = Object.keys(keranjang);

  if (namaMenu.length === 0) {
    daftar.innerHTML =
      '<p class="keranjang-kosong">Belum ada pesanan.</p>';
    hitungTotal();
    return;
  }

  daftar.innerHTML = namaMenu.map(nama => {
    const item = keranjang[nama];
    const subtotal = item.harga * item.jumlah;

    return `
      <div class="item-keranjang">
        <div>
          <strong>${aman(nama)}</strong>
          <p>${rupiah(item.harga)} × ${item.jumlah}</p>
        </div>
        <strong>${rupiah(subtotal)}</strong>
      </div>
    `;
  }).join("");

  hitungTotal();
}

window.tambahKeKeranjang = tambahKeKeranjang;

// ==========================================
// 10. RESET KERANJANG
// ==========================================

function resetKeranjang() {
  if (prosesSedangBerjalan || pembayaranLunas) {
    tampilkanPesan("Transaksi sedang berlangsung. Keranjang tidak dapat direset.");
    return;
  }

  keranjang = {};
  totalHarga = 0;
  trxIdSekarang = "";
  notifikasiSudahDitampilkan = false;

  const qrSection = document.getElementById("qr-section");
  const txDisplay = document.getElementById("tx-id-display");
  const statusBox = document.getElementById("status-box");
  const statusTeks = document.getElementById("status-teks");
  const canvas = document.getElementById("qr-canvas");
  const notifikasi = document.getElementById("notifikasi-kasir");

  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }

  if (qrSection) qrSection.classList.add("hidden");
  if (txDisplay) txDisplay.textContent = "-";
  if (statusTeks) statusTeks.textContent = "Menunggu pembayaran...";
  if (statusBox) statusBox.className = "status-box status-pending";
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (notifikasi) notifikasi.classList.add("hidden");

  tampilkanKeranjang();
}

window.resetKeranjang = resetKeranjang;

// ==========================================
// 11. SUARA NOTIFIKASI
// ==========================================

function aktifkanSuara() {
  suaraDiaktifkan = true;
}

function suaraKasir(teks) {
  if (!suaraDiaktifkan || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const ucapan = new SpeechSynthesisUtterance(teks);
  ucapan.lang = "id-ID";
  ucapan.rate = 0.9;

  const suara = window.speechSynthesis.getVoices();
  const suaraIndonesia = suara.find(v =>
    v.lang.toLowerCase().startsWith("id")
  );

  if (suaraIndonesia) {
    ucapan.voice = suaraIndonesia;
  }

  window.speechSynthesis.speak(ucapan);
}

function ubahIdMenjadiSuara(id) {
  return id.split("").join(" ");
}

function notifikasiPembayaran(total, id) {
  const elemen = document.getElementById("notifikasi-kasir");
  if (!elemen) return;

  elemen.textContent =
    "Pembayaran berhasil! Total " + rupiah(total) +
    ". ID transaksi " + id;

  elemen.classList.remove("hidden");

  suaraKasir(
    "Pembayaran berhasil. Total " +
    Number(total).toLocaleString("id-ID") +
    " rupiah. ID transaksi " +
    ubahIdMenjadiSuara(id)
  );

  setTimeout(() => {
    elemen.classList.add("hidden");
  }, 5000);
}

// ==========================================
// 12. MEMBUAT TRANSAKSI QR
// ==========================================

async function buatTransaksiQR() {
  if (prosesSedangBerjalan || pembayaranLunas) return;

  if (totalHarga <= 0) {
    tampilkanPesan("Keranjang masih kosong.");
    return;
  }

  aktifkanSuara();
  prosesSedangBerjalan = true;

  const tombolBayar = document.getElementById("btn-bayar");
  if (tombolBayar) {
    tombolBayar.disabled = true;
    tombolBayar.textContent = "Membuat QR...";
  }

  try {
    const totalTransaksi = totalHarga;

    const items = Object.entries(keranjang).map(([nama, item]) => ({
      nama,
      harga: item.harga,
      jumlah: item.jumlah,
      subtotal: item.harga * item.jumlah
    }));

    const dokumenBaru = doc(collection(db, "transaksi"));
    trxIdSekarang = "TRX-" + dokumenBaru.id;

   const transaksiRef = doc(db, "transaksi", trxIdSekarang);

    await setDoc(transaksiRef, {
      trxId: trxIdSekarang,
      total: totalTransaksi,
      items,
      status: "takterbayar",
      saldoDiproses: false,
      waktuBuat: Date.now()
    });

    const qrSection = document.getElementById("qr-section");
    const txDisplay = document.getElementById("tx-id-display");
    const canvas = document.getElementById("qr-canvas");

    if (qrSection) qrSection.classList.remove("hidden");
    if (txDisplay) txDisplay.textContent = trxIdSekarang;

    if (canvas) {
      await QRCode.toCanvas(canvas, trxIdSekarang, {
        width: 220,
        margin: 2
      });
    }

    listenStatusPembayaran(trxIdSekarang);

  } catch (error) {
    console.error("Gagal membuat transaksi:", error);
    tampilkanPesan("Gagal membuat transaksi. Periksa koneksi internet.");

    prosesSedangBerjalan = false;

    if (tombolBayar) {
      tombolBayar.textContent = "Buat QR";
      tombolBayar.disabled = false;
    }
  }
}

window.buatTransaksiQR = buatTransaksiQR;

// ==========================================
// 13. MEMANTAU STATUS PEMBAYARAN
// ==========================================

function listenStatusPembayaran(trxId) {
  if (unsubscribeListener) {
    unsubscribeListener();
  }

  const transaksiRef = doc(db, "transaksi", trxId);

  let notifikasiDalamProses = false;

  unsubscribeListener = onSnapshot(transaksiRef, async snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (data.status === "terbayar") {
      pembayaranLunas = true;

      const statusBox = document.getElementById("status-box");
      const statusTeks = document.getElementById("status-teks");
      const canvas = document.getElementById("qr-canvas");

      if (statusBox) {
        statusBox.className = "status-box status-success";
      }

      if (statusTeks) {
        statusTeks.textContent = "Pembayaran berhasil!";
      }

      if (canvas) {
        canvas.style.opacity = "0.35";
      }

      if (data.saldoDiproses === true) {
        if (!notifikasiSudahDitampilkan) {
          notifikasiSudahDitampilkan = true;
          notifikasiPembayaran(data.total, trxId);
        }

        prosesSedangBerjalan = false;

        if (unsubscribeListener) {
          unsubscribeListener();
          unsubscribeListener = null;
        }

        return;
      }

      if (sedangMemprosesSaldo || notifikasiDalamProses) return;

      sedangMemprosesSaldo = true;
      notifikasiDalamProses = true;

      try {
        await prosesSaldoTransaksi(transaksiRef);

        if (!notifikasiSudahDitampilkan) {
          notifikasiSudahDitampilkan = true;
          notifikasiPembayaran(data.total, trxId);
        }

        prosesSedangBerjalan = false;

        if (unsubscribeListener) {
          unsubscribeListener();
          unsubscribeListener = null;
        }

      } catch (error) {
        console.error("Gagal memproses saldo:", error);
        tampilkanPesan("Pembayaran terdeteksi, tetapi saldo gagal diproses. Periksa database.");
        notifikasiDalamProses = false;
      } finally {
        sedangMemprosesSaldo = false;
      }
    }
  }, error => {
    console.error("Listener transaksi gagal:", error);
  });
}

// ==========================================
// 14. PROSES SALDO DENGAN TRANSACTION
// ==========================================

async function prosesSaldoTransaksi(transaksiRef) {
  await runTransaction(db, async transaction => {
    const transaksiSnap = await transaction.get(transaksiRef);

    if (!transaksiSnap.exists()) {
      throw new Error("Transaksi tidak ditemukan.");
    }

    const data = transaksiSnap.data();

    if (data.status !== "terbayar") {
      throw new Error("Transaksi belum dibayar.");
    }

    if (data.saldoDiproses === true) {
      return;
    }

    const total = Number(data.total);

    if (!Number.isSafeInteger(total) || total <= 0) {
      throw new Error("Total transaksi tidak valid.");
    }

    const saldoSnap = await transaction.get(saldoRef);
    const saldoData = saldoSnap.exists() ? saldoSnap.data() : {};

    const saldoLama = Number(
      saldoData.saldoKasir ?? saldoData.saldo ?? 0
    );

    const pemasukanLama = Number(
      saldoData.totalPemasukan ?? 0
    );

    if (
      !Number.isSafeInteger(saldoLama) ||
      !Number.isSafeInteger(pemasukanLama) ||
      saldoLama < 0 ||
      pemasukanLama < 0
    ) {
      throw new Error("Data saldo tidak valid.");
    }

    transaction.set(saldoRef, {
  saldo: saldoLama + total,
  totalPemasukan: pemasukanLama + total
}, { merge: true });

    transaction.update(transaksiRef, {
      saldoDiproses: true,
      waktuSaldoMasuk: Date.now()
    });
  });
}

// ==========================================
// 15. UPLOAD FOTO DARI GALERI
// ==========================================

async function ubahFileKeBase64(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar yang benar.");
  }

  const gambar = new Image();
  const url = URL.createObjectURL(file);

  try {
    await new Promise((resolve, reject) => {
      gambar.onload = resolve;
      gambar.onerror = reject;
      gambar.src = url;
    });

    const batasLebar = 400;
    const skala = Math.min(1, batasLebar / gambar.width);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(gambar.width * skala);
    canvas.height = Math.round(gambar.height * skala);

    const ctx = canvas.getContext("2d");
    ctx.drawImage(gambar, 0, 0, canvas.width, canvas.height);

    const hasil = canvas.toDataURL("image/jpeg", 0.65);

    if (hasil.length > 800000) {
      throw new Error("Ukuran foto masih terlalu besar. Pilih foto lain.");
    }

    return hasil;

  } finally {
    URL.revokeObjectURL(url);
  }
}

// ==========================================
// 16. PREVIEW FOTO MENU
// ==========================================

const inputGambar = document.getElementById("crud-gambar-file");

inputGambar?.addEventListener("change", event => {
  const file = event.target.files[0];
  const preview = document.getElementById("crud-preview");
  const container = document.getElementById("preview-container");

  fileGambarTerpilih = file || null;

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    tampilkanPesan("File harus berupa gambar.");
    inputGambar.value = "";
    fileGambarTerpilih = null;
    return;
  }

  const url = URL.createObjectURL(file);

  if (preview) preview.src = url;
  if (container) container.classList.remove("hidden");
});

// ==========================================
// 17. TAMBAH IDENTITAS PENJUAL
// ==========================================

const formPenjual = document.getElementById("form-penjual");

formPenjual?.addEventListener("submit", async event => {
  event.preventDefault();

  const id = document.getElementById("penjual-id-baru").value.trim();
  const nama = document.getElementById("penjual-nama-baru").value.trim();

  if (!id || !nama) {
    tampilkanPesan("Lengkapi ID dan nama penjual.");
    return;
  }

  try {
    const penjualDokumen = doc(db, "penjual", id);
    const dataLama = await getDocs(penjualRef);

    const sudahAda = dataLama.docs.some(item => item.id === id);

    if (sudahAda) {
      tampilkanPesan("ID penjual sudah digunakan.");
      return;
    }

    await setDoc(penjualDokumen, {
      id,
      nama,
      waktuBuat: Date.now()
    });

    formPenjual.reset();
    tampilkanPesan("Penjual berhasil ditambahkan.");

  } catch (error) {
    console.error(error);
    tampilkanPesan("Gagal menambahkan penjual.");
  }
});

// ==========================================
// 18. MENAMPILKAN DATA PENJUAL
// ==========================================

function tampilkanDaftarPenjual() {
  const daftar = document.getElementById("daftar-penjual");
  if (!daftar) return;

  if (semuaPenjual.length === 0) {
    daftar.innerHTML =
      '<p class="loading-text">Belum ada data penjual.</p>';
    return;
  }

  daftar.innerHTML = semuaPenjual.map(penjual => `
    <div class="penjual-row">
      <div class="penjual-info">
        <strong>${aman(penjual.nama)}</strong>
        <p>ID: ${aman(penjual.id)}</p>
      </div>
      <div class="crud-actions">
        <button
          type="button"
          class="btn-delete"
          data-hapus-penjual="${aman(penjual.id)}">
          Hapus
        </button>
      </div>
    </div>
  `).join("");
}

// ==========================================
// 19. HAPUS PENJUAL
// ==========================================

document.getElementById("daftar-penjual")?.addEventListener("click", async event => {
  const tombol = event.target.closest("[data-hapus-penjual]");
  if (!tombol) return;

  const id = tombol.dataset.hapusPenjual;

  if (!confirm("Yakin ingin menghapus penjual ini?")) return;

  try {
    const snapshotMenu = await getDocs(menuRef);

    const masihMemilikiMenu = snapshotMenu.docs.some(item =>
      item.data().penjualId === id
    );

    if (masihMemilikiMenu) {
      tampilkanPesan("Penjual tidak bisa dihapus karena masih memiliki menu.");
      return;
    }

    await deleteDoc(doc(db, "penjual", id));
    tampilkanPesan("Penjual berhasil dihapus.");

  } catch (error) {
    console.error(error);
    tampilkanPesan("Gagal menghapus penjual.");
  }
});

// ==========================================
// 20. PILIHAN PENJUAL DI FORM MENU
// ==========================================

function isiPilihanPenjual() {
  const pilihan = document.getElementById("crud-penjual-id");
  if (!pilihan) return;

  const nilaiLama = pilihan.value;

  pilihan.innerHTML =
    '<option value="">Pilih penjual</option>' +
    semuaPenjual.map(penjual => `
      <option value="${aman(penjual.id)}">
        ${aman(penjual.nama)} (${aman(penjual.id)})
      </option>
    `).join("");

  pilihan.value = nilaiLama;
}

// ==========================================
// 21. SIMPAN MENU BARU ATAU EDIT MENU
// ==========================================

const formMenu = document.getElementById("form-crud-menu");

formMenu?.addEventListener("submit", async event => {
  event.preventDefault();

  const id = document.getElementById("crud-menu-id").value;
  const penjualId = document.getElementById("crud-penjual-id").value;
  const nama = document.getElementById("crud-nama").value.trim();
  const harga = Number(document.getElementById("crud-harga").value);
  const gambarLama = document.getElementById("crud-gambar-lama").value;

  if (!penjualId || !nama || !Number.isSafeInteger(harga) || harga <= 0) {
    tampilkanPesan("Periksa kembali data menu.");
    return;
  }

  if (!semuaPenjual.some(p => p.id === penjualId)) {
    tampilkanPesan("Pilih penjual yang terdaftar.");
    return;
  }

  try {
    let gambar = gambarLama;

    if (fileGambarTerpilih) {
      gambar = await ubahFileKeBase64(fileGambarTerpilih);
    }

    if (!id && !gambar) {
      tampilkanPesan("Pilih foto menu dari galeri terlebih dahulu.");
      return;
    }

    const dataMenu = {
      penjualId,
      nama,
      harga,
      gambar,
      waktuUbah: Date.now()
    };

    if (id) {
      await updateDoc(doc(db, "menu", id), dataMenu);
      tampilkanPesan("Menu berhasil diperbarui.");
    } else {
      await addDoc(menuRef, {
        ...dataMenu,
        waktuBuat: Date.now()
      });
      tampilkanPesan("Menu berhasil ditambahkan.");
    }

    bersihkanFormMenu();

  } catch (error) {
    console.error(error);
    tampilkanPesan("Gagal menyimpan menu: " + error.message);
  }
});

// ==========================================
// 22. MENAMPILKAN DATA MENU CRUD
// ==========================================

function tampilkanDaftarCrudMenu() {
  const daftar = document.getElementById("daftar-crud-menu");
  if (!daftar) return;

  if (semuaMenu.length === 0) {
    daftar.innerHTML =
      '<p class="loading-text">Belum ada menu.</p>';
    return;
  }

  daftar.innerHTML = semuaMenu.map(menu => {
    const penjual = semuaPenjual.find(p => p.id === menu.penjualId);

    return `
      <div class="crud-row">
        <div class="crud-info">
          ${
            menu.gambar
              ? `<img src="${menu.gambar}" alt="${aman(menu.nama)}">`
              : ""
          }
          <div>
            <h4>${aman(menu.nama)}</h4>
            <p>${rupiah(menu.harga)}</p>
            <p>Penjual: ${aman(penjual?.nama || "Tidak ditemukan")}</p>
          </div>
        </div>

        <div class="crud-actions">
          <button
            type="button"
            class="btn-edit"
            data-edit-menu="${aman(menu.id)}">
            Edit
          </button>

          <button
            type="button"
            class="btn-delete"
            data-hapus-menu="${aman(menu.id)}">
            Hapus
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 23. TOMBOL EDIT MENU
// ==========================================

document.getElementById("daftar-crud-menu")?.addEventListener("click", event => {
  const tombol = event.target.closest("[data-edit-menu]");
  if (!tombol) return;

  const id = tombol.dataset.editMenu;
  const menu = semuaMenu.find(item => item.id === id);

  if (!menu) return;

  document.getElementById("crud-menu-id").value = menu.id;
  document.getElementById("crud-penjual-id").value = menu.penjualId;
  document.getElementById("crud-nama").value = menu.nama;
  document.getElementById("crud-harga").value = menu.harga;
  document.getElementById("crud-gambar-lama").value = menu.gambar || "";

  fileGambarTerpilih = null;

  const input = document.getElementById("crud-gambar-file");
  const preview = document.getElementById("crud-preview");
  const container = document.getElementById("preview-container");
  const tombolSimpan = document.getElementById("btn-simpan-crud");

  if (input) input.value = "";

  if (menu.gambar) {
    if (preview) preview.src = menu.gambar;
    if (container) container.classList.remove("hidden");
  } else {
    if (container) container.classList.add("hidden");
  }

  if (tombolSimpan) tombolSimpan.textContent = "Update Menu";

  document.getElementById("crud-nama")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});

// ==========================================
// 24. HAPUS MENU
// ==========================================

document.getElementById("daftar-crud-menu")?.addEventListener("click", async event => {
  const tombol = event.target.closest("[data-hapus-menu]");
  if (!tombol) return;

  const id = tombol.dataset.hapusMenu;

  if (!confirm("Yakin ingin menghapus menu ini?")) return;

  try {
    await deleteDoc(doc(db, "menu", id));
    tampilkanPesan("Menu berhasil dihapus.");

    if (document.getElementById("crud-menu-id")?.value === id) {
      bersihkanFormMenu();
    }

  } catch (error) {
    console.error(error);
    tampilkanPesan("Gagal menghapus menu.");
  }
});

// ==========================================
// 25. BERSIHKAN FORM MENU
// ==========================================

function bersihkanFormMenu() {
  formMenu?.reset();

  const id = document.getElementById("crud-menu-id");
  const gambarLama = document.getElementById("crud-gambar-lama");
  const container = document.getElementById("preview-container");
  const preview = document.getElementById("crud-preview");
  const tombolSimpan = document.getElementById("btn-simpan-crud");

  if (id) id.value = "";
  if (gambarLama) gambarLama.value = "";
  if (container) container.classList.add("hidden");
  if (preview) preview.removeAttribute("src");
  if (tombolSimpan) tombolSimpan.textContent = "Simpan Menu";

  fileGambarTerpilih = null;
}

document.getElementById("btn-batal-edit")?.addEventListener("click", bersihkanFormMenu);

// ==========================================
// 26. KONDISI AWAL
// ==========================================

tampilkanKeranjang();

console.log("Kasir Cemerlang berhasil dijalankan.");
