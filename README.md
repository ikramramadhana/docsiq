# DocsIQ 🧠

**Chat with your documents using AI.**  
Upload PDF atau TXT, lalu tanya apa saja tentang isinya — DocsIQ akan menjawab berdasarkan isi dokumen kamu, bukan dari pengetahuan umum AI.

🔗 **Live Demo:** [https://docsiq.vercel.app](https://docsiq.vercel.app)

---

## Apa itu RAG?

DocsIQ dibangun menggunakan teknik **RAG (Retrieval-Augmented Generation)** — sebuah arsitektur AI yang menggabungkan dua proses:

1. **Retrieval** — sistem mencari potongan teks (*chunks*) yang paling relevan dari dokumen yang kamu upload, menggunakan *cosine similarity* antara vektor query dan vektor dokumen.
2. **Augmented Generation** — potongan teks relevan tersebut dijadikan *context* yang dikirim ke LLM, sehingga AI menjawab berdasarkan dokumen kamu, bukan "mengarang" dari pengetahuan umum.

Hasilnya: jawaban yang akurat, spesifik, dan bisa dilacak sumbernya.

---

## Cara Kerja Sistem

### Fase 1 — Indexing (saat upload dokumen)

```
Dokumen (PDF/TXT)
      ↓
Ekstraksi teks (pdf-parse)
      ↓
Chunking — dipotong jadi bagian kecil ~600 karakter dengan overlap 80 karakter
      ↓
Embedding — setiap chunk diubah jadi vektor angka (TF-IDF keyword vectors)
      ↓
Disimpan ke Firebase Firestore
```

### Fase 2 — Querying (saat kamu bertanya)

```
Pertanyaan user
      ↓
Embed pertanyaan → vektor
      ↓
Cosine similarity search → ambil 4 chunk paling relevan dari Firestore
      ↓
Chunk relevan + pertanyaan → dikirim ke Groq API sebagai prompt
      ↓
LLM (LLaMA 3.1) generate jawaban berdasarkan context
      ↓
Jawaban ditampilkan + sumber chunk ditampilkan
```

---

## Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | React framework dengan file-based routing |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Backend** | Next.js API Routes | Serverless functions, jalan di Node.js runtime |
| **LLM** | Groq API — `llama-3.1-8b-instant` | Inferensi super cepat, gratis tier tersedia |
| **Embedding** | TF-IDF Keyword Vectors (custom, lokal) | Tidak butuh API eksternal, jalan di server |
| **Vector Search** | Cosine Similarity (custom implementation) | Dihitung saat query, tanpa vector DB khusus |
| **Database** | Firebase Firestore | Simpan chunks + vectors, persistent & scalable |
| **PDF Parsing** | pdf-parse v1.1.1 | Ekstraksi teks dari PDF |
| **Deployment** | Vercel | Serverless hosting, auto-deploy dari GitHub |

---

## Fitur

- 📄 Upload dokumen **PDF, TXT, Markdown**
- 🔍 **RAG pipeline** — jawaban berdasarkan isi dokumen, bukan halusinasi AI
- 📎 Tampilkan **sumber chunk** yang digunakan untuk menjawab + persentase relevansi
- 🗑️ **Hapus per dokumen** — hover dokumen di sidebar, klik ikon trash
- 🧹 **Clear all documents** — hapus semua dokumen sekaligus dengan konfirmasi
- 💬 **History conversation** — konteks percakapan dijaga antar pesan
- 📱 **Responsive** — sidebar bisa di-toggle, mobile-friendly
- ⚡ **Fast** — Groq LLaMA 3.1 8B menjawab dalam < 2 detik
- 🌙 **Dark mode UI** — desain gelap dengan aksen ungu

---

## Struktur Project

```
docsiq/
├── app/
│   ├── page.tsx                  # UI utama — chat, upload, sidebar
│   ├── layout.tsx                # Root layout + metadata
│   └── api/
│       ├── upload/route.ts       # POST — upload & index dokumen
│       ├── chat/route.ts         # POST — RAG pipeline + Groq
│       ├── stats/route.ts        # GET — info dokumen aktif
│       └── delete/route.ts       # POST — hapus dokumen / clear all
├── lib/
│   ├── rag.ts                    # Chunking, embedding, cosine similarity
│   ├── store.ts                  # Persistent store (Firebase / in-memory fallback)
│   └── firebase.ts               # Firebase Admin SDK init
├── public/
│   ├── favicon.ico               # Favicon DocsIQ
│   └── favicon.svg               # Favicon SVG (scalable)
├── .env.local                    # Environment variables (tidak di-commit)
└── vercel.json                   # Konfigurasi Vercel
```

---

## Setup Lokal

### 1. Clone & Install

```bash
git clone https://github.com/ikramramadhana/docsiq.git
cd docsiq
npm install
```

### 2. Buat file `.env.local`

```env
# Groq API — https://console.groq.com (gratis)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx

# Firebase Admin SDK — dari Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxx\n-----END PRIVATE KEY-----\n"
```

### 3. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Setup Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → buat project baru
2. Aktifkan **Firestore Database** → Start in production mode → region `asia-southeast1`
3. Buka **Project Settings** → tab **Service Accounts** → **Generate new private key**
4. Salin nilai `project_id`, `client_email`, dan `private_key` dari file JSON ke `.env.local`

---

## Deploy ke Vercel

```bash
git add .
git commit -m "init: DocsIQ"
git push origin main
```

1. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo `docsiq`
2. Tambahkan **Environment Variables** (isi dari `.env.local` di atas)
3. Klik **Deploy**

---

## Environment Variables

| Variable | Keterangan |
|---|---|
| `GROQ_API_KEY` | API key dari console.groq.com |
| `FIREBASE_PROJECT_ID` | Project ID Firebase |
| `FIREBASE_CLIENT_EMAIL` | Client email dari service account |
| `FIREBASE_PRIVATE_KEY` | Private key dari service account (sertakan `\n`) |

---

## Keterbatasan

- PDF hasil **scan/foto** tidak bisa dibaca (butuh OCR)
- Embedding menggunakan TF-IDF sederhana — untuk akurasi lebih tinggi bisa diganti ke `sentence-transformers` atau OpenAI Embeddings
- Satu sesi Firestore menyimpan semua dokumen secara global (belum ada autentikasi per user)

---

Built with ♥ by [@ikramramadhana](https://github.com/ikramramadhana)