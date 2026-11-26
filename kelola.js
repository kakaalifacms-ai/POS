
 // ==========================================
 // 1. IMPORT FIREBASE
 // ==========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs
} from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


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
// 3. KOLEKSI KHUSUS KAKA
// ==========================================

const menuRef = collection(db, "menu_kaka");
const penjualRef = collection(db, "penjual_kaka");


// ==========================================
// 4. ELEMENT HTML
// ==========================================

const formPenjual = document.getElementById("form-penjual");
const formMenu = document.getElementById("form-crud-menu");

const daftarPenjual = document.getElementById("daftar-penjual");
const daftarMenu = document.getElementById("daftar-crud-menu");

const selectPenjual = document.getElementById("crud-penjual-id");

const inputMenuId = document.getElementById("crud-menu-id");
const inputGambarLama = document.getElementById("crud-gambar-lama");
const inputNama = document.getElementById("crud-nama");
const inputHarga = document.getElementById("crud-harga");
const inputGambar = document.getElementById("crud-gambar-file");

const previewContainer = document.getElementById("preview-container");
const previewGambar = document.getElementById("crud-preview");

const tombolSimpan = document.getElementById("btn-simpan-crud");
const tombolBatal = document.getElementById("btn-batal-edit");


// ==========================================
// 5. STATE
// ==========================================

let daftarPenjualData = [];
let daftarMenuData = [];

let gambarBaru = "";


// ==========================================
// 6. NOTIFIKASI
// ==========================================

function pesan(teks) {
  alert(teks);
}


// ==========================================
// 7. FORMAT RUPIAH
// ==========================================

function rupiah(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}


// ==========================================
// 8. UPLOAD GAMBAR KE BASE64
// ==========================================

function ubahGambarKeBase64(file) {

  return new Promise((resolve, reject) => {

    if (!file) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Ukuran gambar maksimal 5 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {

      const gambar = new Image();

      gambar.onload = () => {

        const canvas = document.createElement("canvas");

        const batas = 400;

        let lebar = gambar.width;
        let tinggi = gambar.height;

        if (lebar > tinggi && lebar > batas) {
          tinggi = Math.round(tinggi * batas / lebar);
          lebar = batas;
        } else if (tinggi >= lebar && tinggi > batas) {
          lebar = Math.round(lebar * batas / tinggi);
          tinggi = batas;
        }

        canvas.width = lebar;
        canvas.height = tinggi;

        const context = canvas.getContext("2d");

        context.drawImage(gambar, 0, 0, lebar, tinggi);

        resolve(canvas.toDataURL("image/jpeg", 0.7));

      };

      gambar.onerror = () => {
        reject(new Error("Gagal membaca gambar."));
      };

      gambar.src = reader.result;

    };

    reader.onerror = () => {
      reject(new Error("Gagal membuka file."));
    };

    reader.readAsDataURL(file);

  });

}


// ==========================================
// 9. PREVIEW GAMBAR
// ==========================================

inputGambar.addEventListener("change", async () => {

  const file = inputGambar.files[0];

  if (!file) return;

  try {

    gambarBaru = await ubahGambarKeBase64(file);

    previewGambar.src = gambarBaru;
    previewContainer.classList.remove("hidden");

  } catch (error) {

    gambarBaru = "";
    inputGambar.value = "";

    pesan(error.message);

  }

});


// ==========================================
// 10. TAMBAH PENJUAL
// ==========================================

formPenjual.addEventListener("submit", async (event) => {

  event.preventDefault();

  const idPenjual =
    document.getElementById("penjual-id-baru").value.trim();

  const namaPenjual =
    document.getElementById("penjual-nama-baru").value.trim();

  if (!idPenjual || !namaPenjual) {
    pesan("Lengkapi data penjual.");
    return;
  }

  const sudahAda = daftarPenjualData.some(
    item => item.idPenjual.toLowerCase() === idPenjual.toLowerCase()
  );

  if (sudahAda) {
    pesan("ID penjual sudah digunakan.");
    return;
  }

  try {

    await addDoc(penjualRef, {

      idPenjual,
      nama: namaPenjual,
      waktuDibuat: Date.now()

    });

    formPenjual.reset();

    pesan("Penjual berhasil ditambahkan!");

  } catch (error) {

    console.error(error);
    pesan("Gagal menambahkan penjual.");

  }

});


// ==========================================
// 11. TAMPILKAN DATA PENJUAL
// ==========================================

onSnapshot(
  penjualRef,
  (snapshot) => {

    daftarPenjualData = [];

    daftarPenjual.innerHTML = "";

    selectPenjual.innerHTML =
      '<option value="">Pilih penjual</option>';

    if (snapshot.empty) {

      daftarPenjual.textContent = "Belum ada data penjual.";

      return;
    }

    snapshot.forEach((dokumen) => {

      const data = dokumen.data();

      daftarPenjualData.push({
        docId: dokumen.id,
        idPenjual: data.idPenjual || "",
        nama: data.nama || ""
      });

    });

    daftarPenjualData.forEach((penjual) => {

      const baris = document.createElement("div");
      baris.className = "data-card";

      const informasi = document.createElement("div");

      const nama = document.createElement("strong");
      nama.textContent = penjual.nama;

      const id = document.createElement("p");
      id.textContent = "ID: " + penjual.idPenjual;

      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.textContent = "Hapus";
      tombol.className = "btn-reset";

      tombol.addEventListener("click", () => {
        hapusPenjual(penjual);
      });

      informasi.append(nama, id);
      baris.append(informasi, tombol);

      daftarPenjual.appendChild(baris);

      const opsi = document.createElement("option");
      opsi.value = penjual.idPenjual;
      opsi.textContent = penjual.nama;

      selectPenjual.appendChild(opsi);

    });

    // Pertahankan pilihan ketika sedang mengedit menu
    const penjualTerpilih = selectPenjual.dataset.selected || "";
    selectPenjual.value = penjualTerpilih;

  },
  (error) => {

    console.error("Gagal membaca penjual:", error);
    daftarPenjual.textContent = "Gagal memuat data penjual.";

  }
);


// ==========================================
// 12. HAPUS PENJUAL
// ==========================================

async function hapusPenjual(penjual) {

  const menuTerkait = daftarMenuData.some(
    menu => menu.penjualId === penjual.idPenjual
  );

  if (menuTerkait) {
    pesan("Penjual masih memiliki menu. Hapus atau pindahkan menu terlebih dahulu.");
    return;
  }

  if (!confirm("Hapus penjual " + penjual.nama + "?")) return;

  try {

    await deleteDoc(doc(db, "penjual_kaka", penjual.docId));

    pesan("Penjual berhasil dihapus.");

  } catch (error) {

    console.error(error);
    pesan("Gagal menghapus penjual.");

  }

}


// ==========================================
// 13. SIMPAN MENU
// ==========================================

formMenu.addEventListener("submit", async (event) => {

  event.preventDefault();

  const id = inputMenuId.value;

  const penjualId = selectPenjual.value;
  const nama = inputNama.value.trim();
  const harga = Number(inputHarga.value);

  if (!penjualId || !nama || !Number.isSafeInteger(harga) || harga <= 0) {
    pesan("Periksa kembali data menu.");
    return;
  }

  const penjualAda = daftarPenjualData.some(
    item => item.idPenjual === penjualId
  );

  if (!penjualAda) {
    pesan("Pilih penjual yang terdaftar.");
    return;
  }

  tombolSimpan.disabled = true;

  try {

    const gambar = gambarBaru || inputGambarLama.value || "";

    const dataMenu = {

      penjualId,
      nama,
      harga,
      gambar,
      diperbarui: Date.now()

    };

    if (id) {

      await updateDoc(
        doc(db, "menu_kaka", id),
        dataMenu
      );

      pesan("Menu berhasil diperbarui!");

    } else {

      await addDoc(menuRef, {

        ...dataMenu,
        waktuDibuat: Date.now()

      });

      pesan("Menu berhasil ditambahkan!");

    }

    bersihkanForm();

  } catch (error) {

    console.error(error);
    pesan("Gagal menyimpan menu. Periksa koneksi dan aturan Firebase.");

  } finally {

    tombolSimpan.disabled = false;

  }

});


// ==========================================
// 14. TAMPILKAN DATA MENU
// ==========================================

onSnapshot(
  query(menuRef, orderBy("waktuDibuat", "desc")),
  (snapshot) => {

    daftarMenuData = [];

    daftarMenu.innerHTML = "";

    if (snapshot.empty) {

      daftarMenu.textContent = "Belum ada menu.";

      return;
    }

    snapshot.forEach((dokumen) => {

      const data = dokumen.data();

      daftarMenuData.push({
        docId: dokumen.id,
        ...data
      });

    });

    daftarMenuData.forEach((menu) => {

      const kartu = document.createElement("div");
      kartu.className = "data-card";

      const informasi = document.createElement("div");

      if (menu.gambar) {

        const gambar = document.createElement("img");

        gambar.src = menu.gambar;
        gambar.alt = menu.nama || "Gambar menu";
        gambar.className = "menu-image";

        informasi.appendChild(gambar);

      }

      const nama = document.createElement("strong");
      nama.textContent = menu.nama || "-";

      const harga = document.createElement("p");
      harga.textContent = rupiah(menu.harga);

      const penjual = document.createElement("small");

      const dataPenjual = daftarPenjualData.find(
        item => item.idPenjual === menu.penjualId
      );

      penjual.textContent = "Penjual: " +
        (dataPenjual ? dataPenjual.nama : menu.penjualId || "-");

      const tombolEdit = document.createElement("button");
      tombolEdit.type = "button";
      tombolEdit.textContent = "Edit";
      tombolEdit.className = "btn-primary";

      tombolEdit.addEventListener("click", () => {
        editMenu(menu);
      });

      const tombolHapus = document.createElement("button");
      tombolHapus.type = "button";
      tombolHapus.textContent = "Hapus";
      tombolHapus.className = "btn-reset";

      tombolHapus.addEventListener("click", () => {
        hapusMenu(menu);
      });

      informasi.append(nama, harga, penjual, tombolEdit, tombolHapus);

      kartu.appendChild(informasi);

      daftarMenu.appendChild(kartu);

    });

  },
  (error) => {

    console.error("Gagal membaca menu:", error);
    daftarMenu.textContent = "Gagal memuat menu.";

  }
);


// ==========================================
// 15. EDIT MENU
// ==========================================

function editMenu(menu) {

  inputMenuId.value = menu.docId;

  selectPenjual.dataset.selected = menu.penjualId || "";
  selectPenjual.value = menu.penjualId || "";

  inputNama.value = menu.nama || "";
  inputHarga.value = menu.harga || "";

  inputGambarLama.value = menu.gambar || "";

  gambarBaru = "";

  inputGambar.value = "";

  if (menu.gambar) {

    previewGambar.src = menu.gambar;
    previewContainer.classList.remove("hidden");

  } else {

    previewContainer.classList.add("hidden");

  }

  tombolSimpan.textContent = "Perbarui Menu";

  window.scrollTo({
    top: formMenu.offsetTop,
    behavior: "smooth"
  });

}


// ==========================================
// 16. HAPUS MENU
// ==========================================

async function hapusMenu(menu) {

  if (!confirm("Hapus menu " + menu.nama + "?")) return;

  try {

    await deleteDoc(doc(db, "menu_kaka", menu.docId));

    pesan("Menu berhasil dihapus.");

  } catch (error) {

    console.error(error);
    pesan("Gagal menghapus menu.");

  }

}


// ==========================================
// 17. BERSIHKAN FORM
// ==========================================

function bersihkanForm() {

  formMenu.reset();

  inputMenuId.value = "";
  inputGambarLama.value = "";

  selectPenjual.dataset.selected = "";

  gambarBaru = "";

  previewGambar.removeAttribute("src");
  previewContainer.classList.add("hidden");

  tombolSimpan.textContent = "Simpan Menu";

}


tombolBatal.addEventListener("click", bersihkanForm);
