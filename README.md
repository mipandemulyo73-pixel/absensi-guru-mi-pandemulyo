# Aplikasi Absensi Guru MI Miftahul Huda Pandemulyo

## Isi paket
- `Code.gs`: backend Google Apps Script, login, absensi, izin/sakit, rekap, ekspor XLSX dan PDF.
- `Index.html`: antarmuka web responsif untuk HP dan komputer.

## Catatan sebelum digunakan
Ini adalah starter yang perlu diuji dengan akun percobaan sebelum digunakan untuk data kehadiran resmi. Jam kerja disimpan sebagai konfigurasi awal; versi ini belum otomatis menolak absen di luar jadwal, belum memiliki alur persetujuan izin, dan belum menghitung rekap hari kerja kosong sebagai alpa. Waktu absensi dicatat oleh server Apps Script. Jam pada layar HP hanya tampilan.

## 1. Buat database
1. Buat Google Sheets baru khusus absensi, misalnya `Database Absensi MI Miftahul Huda`.
2. Buka **Extensions / Ekstensi > Apps Script**.
3. Ganti isi `Code.gs` dengan isi file `Code.gs` dari paket ini.
4. Klik tombol `+` > HTML, beri nama persis `Index`, lalu tempel isi `Index.html`.
5. Simpan proyek.
6. Di dropdown fungsi pilih `setupDatabase`, lalu klik **Run/Jalankan** dan izinkan akses yang diminta.
7. Kembali ke spreadsheet. Empat tab dibuat: `Guru`, `Absensi`, `Izin`, `Pengaturan`.

## 2. Buat akun admin
Di editor Apps Script, pilih fungsi `createAdmin`. Isi parameter pemanggilan dengan kredensial milik madrasah. Cara paling mudah: sementara tambahkan fungsi ini di bagian bawah Code.gs, ubah nilai contoh, lalu jalankan satu kali dan hapus fungsi pembungkusnya sesudah selesai:

```javascript
function buatAdminPertama() {
  return createAdmin('admin', 'GANTI_DENGAN_PASSWORD_UNIK_MINIMAL12', 'Admin Madrasah', 'email-admin-anda');
}
```

Jangan pernah menggunakan password contoh di atas. Jalankan `buatAdminPertama()` sekali saja, lalu hapus fungsi pembungkus dan simpan. Jangan bagikan password di grup atau di spreadsheet.

## 3. Tambahkan akun guru
Gunakan pola serupa dan jalankan sekali per guru, misalnya:
```javascript
function tambahGuruContoh() {
  return addTeacher('guru001', 'PASSWORD_UNIK_MINIMAL12', 'Nama Guru', 'email-guru');
}
```
Ganti seluruh nilai contoh, jalankan sekali, lalu hapus fungsi pembungkus. Atau admin/operator dapat mengisi baris di tab `Guru`, tetapi kolom `passwordHash` dan `salt` harus dibuat dengan fungsi hash; jangan memasukkan password biasa. Lebih aman gunakan `addTeacher()`.

Kolom `aktif` harus berisi `TRUE` atau `FALSE`. `role` harus `admin` atau `guru`. Jangan berikan akses edit database kepada semua guru.

## 4. Publikasikan sebagai Web App
1. Klik **Deploy > New deployment**.
2. Pilih jenis **Web app**.
3. **Execute as / Jalankan sebagai:** akun pemilik/pengelola spreadsheet.
4. **Who has access / Siapa yang memiliki akses:** pilih opsi paling terbatas yang sesuai. Jika tersedia, pilih hanya akun dalam organisasi; jika akun guru berada di luar domain, pengaturan organisasi mungkin membatasi akses. Jangan langsung memilih publik tanpa menimbang risiko data.
5. Klik Deploy, selesaikan otorisasi, lalu salin URL Web App yang berakhiran `/exec`.
6. Uji menggunakan akun admin dan akun guru percobaan pada browser HP.
7. Jika kode diubah, buka **Deploy > Manage deployments > Edit > New version > Deploy**.

## 5. Jam kerja
Pengaturan awal yang diminta:
- Senin–Kamis dan Sabtu: 07.00–14.30
- Jumat: 07.00–11.30
- Zona waktu: Asia/Jakarta

Jam ini menjadi acuan administrasi; starter ini belum otomatis menandai terlambat atau menolak absen di luar jam kerja. Jangan mengubah jam spreadsheet saja dengan asumsi fitur validasi otomatis sudah aktif.

## 6. Ekspor laporan
Login sebagai admin, pilih bulan, klik `TAMPILKAN REKAP`, lalu pilih `EXPORT EXCEL (.XLSX)` atau `EXPORT PDF`. Pertama kali ekspor mungkin meminta izin tambahan Google Drive/Sheets. Uji ekspor dengan data dummy. File sementara ekspor akan dibuat lalu dipindahkan ke sampah.

## 7. Keamanan dan batasan penting
- Gunakan akun Google khusus madrasah sebagai pemilik, aktifkan verifikasi 2 langkah, dan batasi editor spreadsheet.
- Password disimpan sebagai hash SHA-256 dengan salt, bukan teks biasa. Untuk sistem produksi dengan risiko tinggi, pertimbangkan autentikasi Google Workspace/Identity Platform atau backend yang memakai password hashing khusus (misalnya Argon2/bcrypt).
- Token sesi disimpan di CacheService dan berakhir kira-kira setelah 6 jam; cache dapat kedaluwarsa lebih awal.
- Aplikasi ini bukan sistem presensi anti-kecurangan: belum memakai GPS, selfie, verifikasi perangkat, atau tanda tangan digital.
- Periksa aturan akses organisasi Google Apps Script dan kebijakan privasi madrasah sebelum menyimpan data pribadi.
- Buat salinan cadangan spreadsheet secara berkala. Jangan membagikan tab database ke seluruh guru.
- Fitur pengajuan izin/sakit pada starter mencatat pengajuan, tetapi belum membuat persetujuan admin. Admin juga belum memiliki menu untuk menambah/nonaktifkan akun dari antarmuka.
- Selalu uji login, duplikasi absensi, zona waktu, ekspor, dan izin akses dengan data dummy sebelum pemakaian resmi.
