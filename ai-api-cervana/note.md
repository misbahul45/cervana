Perfect, kamu benar — sistem AI Service CERVANA nggak cuma butuh **RAG ingestion dan generation** saja. Berdasarkan isi proposal dan arsitektur pipeline-nya, seluruh AI service bisa dibagi menjadi **7 komponen utama** (masing-masing bisa dijadikan microservice di FastAPI).

Berikut breakdown lengkapnya dalam format tugas markdown supaya bisa langsung kamu pakai sebagai blueprint development:

---

# 🧠 **AI Service Architecture — CERVANA RAG System**

> Fokus: FastAPI-based AI microservices yang menghubungkan pipeline RAG dengan pembelajaran gamifikasi (NestJS backend utama).

---

## 🧩 **1. Knowledge Ingestion Service**

### Tujuan

Mengumpulkan, membersihkan, dan menyimpan sumber pengetahuan (PDF, video, artikel, blog, SKKNI/BNSP doc).

### Modul & Endpoint

* `POST /ingest/pdf` — ekstraksi teks PDF (`pymupdf`, `pdfminer.six`)
* `POST /ingest/video` — ekstraksi transkrip via `whisper` atau `OpenAI ASR`
* `POST /ingest/html` — parsing artikel web (`BeautifulSoup`, `trafilatura`)
* `POST /ingest/embed` — embedding ke vector store (`pgvector` atau `chromadb`)
* `GET /ingest/status/{job_id}` — status ingestion job

### Output

* Chunks + embeddings + metadata disimpan ke `content_embeddings`.
* Status: `PENDING`, `SUCCESS`, `FAILED`.

---

## ⚙️ **2. Knowledge Management & Indexing Service**

### Tujuan

Mengelola database vektor & knowledge base untuk mendukung retrieval yang efisien.

### Modul & Endpoint

* `GET /knowledge/search?query=...` — semantic search by vector similarity.
* `DELETE /knowledge/{id}` — hapus entry konten.
* `GET /knowledge/stats` — jumlah embeddings, average similarity, dsb.
* `POST /knowledge/reindex` — re-embed ulang (untuk model baru).

### Fungsi Internal

* Menggunakan `pgvector` dengan cosine similarity.
* Bisa support multi-domain knowledge (Akuntansi, Perpajakan, Auditing).

---

## 💬 **3. RAG Query & Generation Service**

### Tujuan

Menjawab pertanyaan siswa berbasis retrieval + LLM.

### Modul & Endpoint

* `POST /rag/query`

  * Input: `query`, `user_id`, `context_type` (lesson/quiz/chat)
  * Langkah:

    1. Generate embedding query
    2. Retrieve top-k chunks dari `content_embeddings`
    3. Generate jawaban via LLM (`LangChain`, `Ollama`, `OpenAI`)
  * Output:

    ```json
    {
      "answer": "...",
      "citations": ["source.pdf#page=3"],
      "metadata": { "relevance": 0.92 }
    }
    ```
* `POST /rag/summary` — summarize lesson material (microlearning generator)
* `POST /rag/explain` — generate explanation style (for chatbot)

---

## 🧾 **4. Adaptive Learning & Quiz Generation Service**

### Tujuan

Membuat soal otomatis berdasarkan hasil belajar & materi siswa.

### Modul & Endpoint

* `POST /quiz/generate`

  * Input: `topic_id`, `difficulty`, `num_questions`
  * Output: JSON of quiz items
* `POST /quiz/validate`

  * Mengevaluasi keakuratan soal otomatis (pakai LLM self-check)
* `POST /quiz/feedback`

  * Generate pembahasan otomatis untuk setiap soal.
* `POST /quiz/adaptive`

  * Menyesuaikan tingkat kesulitan berdasarkan progress siswa (`StepProgress`).

### Catatan

* Bisa integrasi ke model seperti `GPT-4o-mini` atau `Mixtral` untuk generatif konten edukatif.
* Relevan dengan komponen **Lesson**, **Step**, dan **QuizAttempt** di Prisma.

---

## 🧠 **5. Personalized Learning Engine**

### Tujuan

Menyesuaikan rekomendasi materi dan kuis berdasarkan kemampuan individu (learning profile).

### Modul & Endpoint

* `GET /recommend/next-step?user_id=...`

  * Menganalisis performa siswa → merekomendasikan step selanjutnya.
* `POST /recommend/material`

  * Menentukan materi belajar tambahan (blog, PDF) dari vector store.
* `GET /profile/{user_id}`

  * Menghasilkan profil kognitif siswa (learning speed, retention, streak, dll).

### Logika Adaptasi

* Gunakan reinforcement signals dari progress (`LessonProgress`, `QuizAttempt`).
* Simpan hasil rekomendasi di `DailyActivityLog`.

---

## 🕹️ **6. Gamification AI Service**

### Tujuan

Mengelola logika AI yang berhubungan dengan reward, streak, badge, dan leaderboard dinamis.

### Modul & Endpoint

* `POST /game/points` — update poin otomatis berdasarkan hasil kuis/aktivitas.
* `POST /game/achievement` — check kondisi dan generate badge baru.
* `GET /game/leaderboard`
* `GET /game/streak-status/{user_id}`

### Fitur Lanjutan

* Model rule-based + AI-based suggestion (e.g. “kamu butuh latihan topik A agar streak berlanjut”).
* Dapat terintegrasi ke **Notification** di NestJS.

---

## 🧩 **7. Evaluation & Analytics Service (AI Metrics)**

### Tujuan

Mengukur performa pembelajaran dan AI (retrieval, relevansi, feedback siswa).

### Modul & Endpoint

* `POST /evaluate/retrieval` — precision@k, recall@k dari RAG retrieval
* `POST /evaluate/llm` — evaluasi kualitas jawaban LLM (manual + automatic)
* `GET /analytics/usage` — token count, waktu response, frekuensi chat
* `GET /analytics/learning` — insight peningkatan nilai (pre-test vs post-test)
* `POST /feedback/analyze` — analisis sentimen pengguna terhadap pengalaman belajar

### Output

* Statistik diolah untuk tabel `DailyStats` dan `LeaderboardScore`.

---

## 🧩 **8. (Opsional) Content Augmentation & Authoring AI**

### Tujuan

Membantu guru membuat konten pembelajaran baru dengan bantuan LLM.

### Modul & Endpoint

* `POST /author/lesson-outline` — generate outline topik dari standar SKKNI.
* `POST /author/slide` — generate materi PowerPoint/Markdown otomatis.
* `POST /author/video-script` — menulis skrip video pembelajaran dari topik tertentu.
* `POST /author/rephrase` — memperhalus bahasa konten edukasi.

---

## 📦 **9. Inter-service Coordination (NestJS ↔ FastAPI)**

| Fungsi               | NestJS Module        | FastAPI Endpoint                    |
| -------------------- | -------------------- | ----------------------------------- |
| Chat pembelajaran    | `ChatModule`         | `/rag/query`, `/rag/explain`        |
| Ingest konten        | `ResourceModule`     | `/ingest/pdf`, `/ingest/video`      |
| Kuis dinamis         | `QuizModule`         | `/quiz/generate`, `/quiz/adaptive`  |
| Progress user        | `ProgressModule`     | `/recommend/next-step`              |
| Leaderboard & Reward | `GamificationModule` | `/game/points`, `/game/achievement` |

---

## 📊 **Kesimpulan Hierarki Pipeline**

```
[Ingestion Service]
     ↓
[Indexing + Vector Store]
     ↓
[RAG Query + Generation]
     ↓
[Quiz Generator + Personalized Learning]
     ↓
[Gamification Engine + Evaluation]
     ↓
[NestJS Backend Integration]
```

---

Kalau kamu mau, aku bisa bantu lanjutkan ke:

1. 📁 Struktur folder FastAPI untuk semua service di atas (dengan modular pattern per domain, misal `/rag/`, `/quiz/`, `/recommend/`, dll).
2. ✨ Contoh implementasi `rag/query_service.py` + `quiz/generator.py` pakai LangChain + pgvector.

Mau lanjut ke (1) struktur folder dulu, atau langsung (2) implementasi tiap service utamanya?
