// ==========================================
// 1. IMPORT FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp, 
  setDOC
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import QRCode from "https://esm.sh/qrcode@1.5.3"
// ==========================================
// 2. CONFIG FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA6I1Tvw61wzc6-2MVmcWXfZ17IwDYj7u4",
    authDomain: "rpl25-b6db4.firebaseapp.com",
    projectId: "rpl25-b6db4",
    storageBucket: "rpl25-b6db4.firebasestorage.app",
    messagingSenderId: "643920833293",
    appId: "1:643920833293:web:f5ac7fdc746e4e410d5e44"
}

// 3. inisialsaisi firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// kondisi/state
let totalHarga = 0
let trxIdSekarang = ""
let unsubscribeListener = null

//fungsi tambah item ke keranjang
window.tambahkeKeranjang = function (nama, harga) {
  //updatetotal harga
  totalHarga += harga
  document.getElementById('total-harga').innerText = `Rp. ${totalHarga}`

 
 //mengaktifkan
 document.getElementById('btn-bayar').disabled = false
 }
 
 //funsi reset keranjang
 window.resetKeranjang = function (){
   totalHarga = 0
   document.getElementById('total-harga').innerText = 'Rp. 0'
   document.getElementById('btn-bayar').disabled = true 
   document.getElementById('qr-section').classList.add('hidden')
 }
 
 //funsi membuat id transki dan qr code
 window.buatTransaksiQR = async function () {
   //megecah trasksiki 0 rupiah
   if (totalHarga ===0 ) return
   
   //buat identitsas transaksi unik
   trxIdSekarang = "TRX-" + Math.floor(1000 + Math.random() * 9000)
   
   //tampilanidetitas
   document.getElementById('tx-id-display').innerText = trxIdSekarang
   //tampilanqr
   document.getElementById('qr-section').classList.remove ('hidden')
   
   //reset tampilan status qr
   const statusbox = document.getElementById('status-box')
   statusbox.getElementById('status-teks').innerText = "Menunggu scan...."
   
   //membuatqrcode jelas terlihat
   document.getElementById('qr-canvas').style.opacity = 1
   
   //render qr code ke canvas
   const elemencanvas = document. getElementById('qr-canvas')
   try{
     await QRcode.toCanvas(elemencanvas, trxIdSekarang, {
       width: 140,
       margin: 1
       
    } )
    
   } catch (error){
     console.log("Gagal membuat QR")
   }
   
   //simpan dokumen transkaki ke firebase
   const refTrx = doc(db, "transaksi", trxIdSekarang)
   try{
     await setDOC(refTrx, {
       total: totalHarga, 
       status: 'takterbayar', 
       waktuBuat: Date.now()
     }) 
     
   } catch (error){
     console.log("gagal menyimpan transaksi ke firestore")
   }
 }