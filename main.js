// ==========================================
// 1. IMPORT FIREBASE
// ==========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  doc,
  collection,
  setDoc,
  onSnapshot,
  runTransaction
} from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import QRCode from "https://esm.sh/qrcode@1.5.3";


// ==========================================
// 2. FIREBASE CONFIG
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyA6I1Tvw61wzc6-2MVmcWXfZ17IwDYj7u4",
  authDomain: "rpl25-b6db4.firebaseapp.com",
  projectId: "rpl25-b6db4",
  storageBucket: "rpl25-b6db4.firebasestorage.app",
  messagingSenderId: "643920833293",
  appId: "1:643920833293:web:f5ac7fdc746e4e410d5e44"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ==========================================
// 3. REFERENSI FIREBASE
// ==========================================

const saldoRef = doc(db, "pengaturan", "saldoKasir");


// ==========================================
// 4. STATE
// ==========================================

let totalHarga = 0;
let keranjang = {};

let trxIdSekarang = "";
let unsubscribeListener = null;

let prosesSedangBerjalan = false;
let sedangMemprosesSaldo = false;

let suaraDiaktifkan = false;
let notifikasiSudahDitampilkan = false;
let pembayaranLunas = false;


// ==========================================
// 5. FORMAT RUPIAH
// ==========================================

function formatRupiah(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}


// ==========================================
// 6. PANTAU SALDO KASIR
// ==========================================

onSnapshot(
  saldoRef,

  (snapshot) => {

    const data = snapshot.exists()
      ? snapshot.data()
      : { saldo: 0, totalPemasukan: 0 };

    document.getElementById("saldo-kasir").innerText =
      formatRupiah(data.saldo);

    document.getElementById("total-pemasukan").innerText =
      formatRupiah(data.totalPemasukan);

  },

  (error) => {
    console.error("Gagal mengambil saldo:", error);
  }
);


// ==========================================
// 7. SUARA KASIR
// ==========================================

function aktifkanSuara() {

  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();

  suaraDiaktifkan = true;
}


function suaraKasir(teks) {

  if (!("speechSynthesis" in window)) return;
  if (!suaraDiaktifkan) return;

  window.speechSynthesis.cancel();

  const ucapan = new SpeechSynthesisUtterance(teks);

  const daftarSuara = window.speechSynthesis.getVoices();

  const suaraIndonesia = daftarSuara.find(voice =>
    voice.lang.toLowerCase().startsWith("id")
  );

  if (suaraIndonesia) {
    ucapan.voice = suaraIndonesia;
  }

  ucapan.lang = "id-ID";
  ucapan.rate = 0.85;
  ucapan.pitch = 1;
  ucapan.volume = 1;

  window.speechSynthesis.speak(ucapan);
}


// ==========================================
// 8. ID TRANSAKSI MENJADI SUARA
// ==========================================

function ubahIdMenjadiSuara(id) {

  return id
    .replace("TRX-", "T R X ")
    .split("")
    .join(" ")
    .trim();

}


// ==========================================
// 9. NOTIFIKASI PEMBAYARAN
// ==========================================

function notifikasiPembayaran(total, idTransaksi) {

  const notifikasi = document.getElementById("notifikasi-kasir");

  notifikasi.innerHTML = `
    <div style="font-size:40px;">✅</div>

    <h3>PEMBAYARAN BERHASIL!</h3>

    <p>Saldo masuk:</p>

    <h2>${formatRupiah(total)}</h2>

    <p>ID Transaksi:</p>

    <h3>${idTransaksi}</h3>

    <p>Status: <b>LUNAS</b></p>
  `;

  notifikasi.classList.remove("hidden");

  suaraKasir(
    "Pembayaran berhasil. " +
    "Uang masuk sebesar " +
    Number(total).toLocaleString("id-ID") +
    " rupiah. ID transaksi " +
    ubahIdMenjadiSuara(idTransaksi)
  );

  setTimeout(() => {
    notifikasi.classList.add("hidden");
  }, 5000);

}


// ==========================================
// 10. RENDER KERANJANG
// ==========================================

function renderKeranjang() {

  const area = document.getElementById("daftar-keranjang");

  const daftar = Object.entries(keranjang);

  if (daftar.length === 0) {

    area.innerHTML =
      '<p class="keranjang-kosong">Belum ada pesanan.</p>';

  } else {

    area.innerHTML = "";

    daftar.forEach(([nama, item]) => {

      const subtotal = item.harga * item.jumlah;

      const baris = document.createElement("div");

      baris.className = "item-keranjang";

      const namaItem = document.createElement("span");
      namaItem.textContent = `${nama} × ${item.jumlah}`;

      const kanan = document.createElement("div");
      kanan.className = "item-kanan";

      const harga = document.createElement("strong");
      harga.textContent = formatRupiah(subtotal);

      const satuan = document.createElement("small");
      satuan.textContent = formatRupiah(item.harga) + " / item";

      kanan.append(harga, satuan);
      baris.append(namaItem, kanan);

      area.appendChild(baris);

    });

  }

  document.getElementById("total-harga").innerText =
    formatRupiah(totalHarga);

  document.getElementById("btn-bayar").disabled =
    totalHarga <= 0 || Boolean(trxIdSekarang) || prosesSedangBerjalan;

}


// ==========================================
// 11. TAMBAH MENU
// ==========================================

window.tambahKeKeranjang = function(nama, harga) {

  if (prosesSedangBerjalan || trxIdSekarang) return;

  if (!keranjang[nama]) {

    keranjang[nama] = {
      harga: Number(harga),
      jumlah: 0
    };

  }

  keranjang[nama].jumlah++;

  totalHarga += Number(harga);

  renderKeranjang();

};


// ==========================================
// 12. RESET KERANJANG
// ==========================================

window.resetKeranjang = function() {

  if (prosesSedangBerjalan) return;

  if (trxIdSekarang && !pembayaranLunas) {

    alert("Transaksi masih menunggu pembayaran. Tidak bisa reset.");

    return;
  }

  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }

  totalHarga = 0;
  keranjang = {};

  trxIdSekarang = "";
  pembayaranLunas = false;

  notifikasiSudahDitampilkan = false;

  document.getElementById("qr-section").classList.add("hidden");

  document.getElementById("notifikasi-kasir").classList.add("hidden");

  document.getElementById("tx-id-display").innerText = "-";

  document.getElementById("status-teks").innerText =
    "Menunggu pembayaran...";

  document.getElementById("qr-canvas").style.opacity = "1";

  renderKeranjang();

};


// ==========================================
// 13. MEMBUAT TRANSAKSI QR
// ==========================================

window.buatTransaksiQR = async function() {

  if (prosesSedangBerjalan || totalHarga <= 0 || trxIdSekarang) {
    return;
  }

  prosesSedangBerjalan = true;

  aktifkanSuara();

  const totalTransaksi = totalHarga;

  const itemTransaksi = Object.entries(keranjang).map(
    ([nama, item]) => ({
      nama,
      harga: item.harga,
      jumlah: item.jumlah
    })
  );

  document.getElementById("btn-bayar").disabled = true;

  try {

    // Membuat ID unik dari Firestore
    const dokumenBaru = doc(collection(db, "transaksi"));

    trxIdSekarang = "TRX-" + dokumenBaru.id;

    const refTrx = doc(db, "transaksi", trxIdSekarang);

    document.getElementById("tx-id-display").innerText =
      trxIdSekarang;

    document.getElementById("qr-section").classList.remove("hidden");

    document.getElementById("status-box").className =
      "status-box status-pending";

    document.getElementById("status-teks").innerText =
      "Menunggu pembayaran...";

    document.getElementById("total-harga").innerText =
      formatRupiah(totalTransaksi);

    const canvas = document.getElementById("qr-canvas");

    canvas.style.opacity = "1";

    // Membuat QR
    await QRCode.toCanvas(canvas, trxIdSekarang, {
      width: 180,
      margin: 2,
      errorCorrectionLevel: "H"
    });

    // Simpan transaksi
    await setDoc(refTrx, {

      total: totalTransaksi,

      items: itemTransaksi,

      status: "takterbayar",

      saldoDiproses: false,

      waktuBuat: Date.now()

    });

    pembayaranLunas = false;

    notifikasiSudahDitampilkan = false;

    listenStatusPembayaran(trxIdSekarang);

  } catch (error) {

    console.error("Gagal membuat transaksi:", error);

    alert("Gagal membuat transaksi. Periksa koneksi internet dan Firebase.");

    trxIdSekarang = "";

    document.getElementById("qr-section").classList.add("hidden");

    renderKeranjang();

  } finally {

    prosesSedangBerjalan = false;

    renderKeranjang();

  }

};


// ==========================================
// 14. PROSES SALDO KASIR
// ==========================================

async function prosesSaldoKasir(trxId) {

  const refTrx = doc(db, "transaksi", trxId);

  return await runTransaction(db, async (transaction) => {

    const trxSnapshot = await transaction.get(refTrx);

    if (!trxSnapshot.exists()) return false;

    const dataTrx = trxSnapshot.data();

    // Hanya transaksi lunas yang diproses
    if (dataTrx.status !== "terbayar") return false;

    // Mencegah saldo masuk dua kali
    if (dataTrx.saldoDiproses === true) return false;

    const jumlah = Number(dataTrx.total);

    if (!Number.isSafeInteger(jumlah) || jumlah <= 0) {
      throw new Error("Nominal transaksi tidak valid.");
    }

    const saldoSnapshot = await transaction.get(saldoRef);

    const saldoLama = saldoSnapshot.exists()
      ? Number(saldoSnapshot.data().saldo || 0)
      : 0;

    const pemasukanLama = saldoSnapshot.exists()
      ? Number(saldoSnapshot.data().totalPemasukan || 0)
      : 0;

    if (
      !Number.isSafeInteger(saldoLama) ||
      !Number.isSafeInteger(pemasukanLama)
    ) {
      throw new Error("Data saldo tidak valid.");
    }

    // Tambahkan saldo
    transaction.set(saldoRef, {

      saldo: saldoLama + jumlah,

      totalPemasukan: pemasukanLama + jumlah,

      diperbarui: Date.now()

    }, { merge: true });

    // Tandai sudah diproses
    transaction.update(refTrx, {

      saldoDiproses: true,

      waktuSaldoMasuk: Date.now()

    });

    return true;

  });

}


// ==========================================
// 15. PANTAU STATUS PEMBAYARAN
// ==========================================

function listenStatusPembayaran(trxId) {

  const refTrx = doc(db, "transaksi", trxId);

  let notifikasiDalamProses = false;

  unsubscribeListener = onSnapshot(

    refTrx,

    async (snapshot) => {

      if (!snapshot.exists()) return;

      const data = snapshot.data();

      if (data.status !== "terbayar") return;

      // Tampilkan status lunas
      document.getElementById("status-box").className =
        "status-box status-success";

      document.getElementById("status-teks").innerText =
        "🥳 PEMBAYARAN LUNAS";

      document.getElementById("qr-canvas").style.opacity = "0.2";

      pembayaranLunas = true;

      // Jika sudah diproses sebelumnya
      if (data.saldoDiproses === true) {

        if (!notifikasiSudahDitampilkan) {

          notifikasiSudahDitampilkan = true;

          notifikasiPembayaran(data.total, trxId);

        }

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

        const berhasil = await prosesSaldoKasir(trxId);

        if (berhasil && !notifikasiSudahDitampilkan) {

          notifikasiSudahDitampilkan = true;

          notifikasiPembayaran(data.total, trxId);

        }

      } catch (error) {

        console.error("Gagal memproses saldo:", error);

      } finally {

        sedangMemprosesSaldo = false;
        notifikasiDalamProses = false;

      }

    },

    (error) => {

      console.error("Listener pembayaran gagal:", error);

    }

  );

}