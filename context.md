# Buat sebuah sistem README GitHub custom yang menampilkan:
1. Top Languages
2. Contribution Streak

dengan ketentuan berikut:

## Sumber Data
1. Ambil data langsung dari GitHub API resmi (api.github.com)
2. Gunakan username GitHub saya sebagai parameter utama
Data yang digunakan:
- Repository publik
- Bahasa pemrograman per repository
- Riwayat kontribusi harian (commit history)

## Top Languages (Custom Logic)
1. Hitung total penggunaan bahasa berdasarkan:
2. Jumlah byte kode dari endpoint /languages
3. Agregasikan seluruh repository
4. Hitung persentase tiap bahasa
5. Urutkan dari terbesar ke terkecil
6. Tampilkan maksimal 5 bahasa teratas

## Contribution Streak (Custom Logic)
1. Ambil data kontribusi harian menggunakan:
2. GitHub GraphQL API (preferred)
Hitung:
- Current streak (hari berturut-turut hingga hari ini)
- Longest streak
- Tentukan hari aktif jika jumlah kontribusi > 0

## Rendering (WAJIB)
1. TIDAK menggunakan SVG
2. TIDAK embed image dari service pihak ketiga
Gunakan salah satu dari:
- Markdown murni (progress bar berbasis karakter)
- HTML inline sederhana (<table>, <div>, <pre>)
- Semua layout dan visual adalah desain sendiri
- Contoh visual Top Languages dan Contribution Streak pada pasted image (bukan SVG):

## Update Otomatis
1. Sistem harus mendukung auto-update menggunakan:
2. GitHub Actions (cron job)
3. README diperbarui secara otomatis (commit bot)
4. Tidak ada hardcoded data

## Kode
1. Gunakan JavaScript (Node.js) atau Python
Kode harus:
- Modular
- Mudah dikembangkan
- Tidak bergantung pada library visual eksternal

## Prinsip
1. Tidak menyalin atau memodifikasi template orang lain
2. Tidak menggunakan service seperti:
3. github-readme-stats
4. streak-stats
5. shields.io
6. Semua perhitungan dan visual adalah original implementation

# Output akhir:
1. README.md yang sepenuhnya mandiri
2. Script fetch + generate README
3. Workflow GitHub Actions untuk auto update