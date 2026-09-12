<template>
  <div class="w-full mx-auto px-4 py-12 md:py-16 space-y-12 md:space-y-20 overflow-hidden relative">
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-1/4 right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-float"></div>
      <div class="absolute bottom-1/3 left-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl animate-float-delayed"></div>
    </div>

    <div
      v-for="(item, index) in features"
      :key="index"
      v-motion
      ref="featureCards"
      :initial="{ opacity: 0, y: 100, scale: 0.95 }"
      :enter="{ opacity: 1, y: 0, scale: 1 }"
      :transition="{ duration: 1, delay: index * 0.25, type: 'spring', stiffness: 80 }"
      :class="[
        'feature-card relative group',
        'flex flex-col-reverse md:grid md:grid-cols-2 gap-6 md:gap-8 items-center',
        'p-6 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl',
        'bg-linear-to-br from-white/[0.03] to-white/[0.01]',
        'border border-white/10',
        'backdrop-blur-sm',
        'hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10',
        'transition-all duration-700',
        'overflow-hidden',
        index % 2 === 0 ? '' : 'md:direction-rtl'
      ]"
    >
      <div class="shine"></div>
      
      <div class="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

      <div
        v-motion
        :initial="{ opacity: 0, x: index % 2 === 0 ? -80 : 80 }"
        :enter="{ opacity: 1, x: 0 }"
        :transition="{ delay: 0.4 + index * 0.2, duration: 0.8 }"
        :class="['space-y-6 relative z-10', index % 2 === 0 ? '' : 'md:direction-ltr']"
      >
        <Motion
          :initial="{ opacity: 0, scale: 0.8, y: -10 }"
          :enter="{ opacity: 1, scale: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.2 * index, type: 'spring' }"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/40 
                bg-lineart-to-r from-primary/20 via-secondary/10 to-primary/20 
                text-primary font-semibold shadow-md shadow-primary/10
                relative overflow-hidden group cursor-default hover:shadow-primary/30 hover:scale-105
                transition-all duration-500"
        >
          <span class="absolute inset-0 bg-lineart-to-r from-primary/10 via-transparent to-secondary/10 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-700"></span>
          <div class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
          <span class="relative z-10 tracking-wider uppercase text-xs sm:text-sm">
            {{ identity[index] }}
          </span>
        </Motion>
        


        <h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold font-orbitron bg-linear-to-r from-primary via-white to-secondary bg-clip-text text-transparent leading-tight group-hover:scale-[1.02] transition-transform duration-300">
          {{ item.title }}
        </h2>

        <p class="text-sm sm:text-base lg:text-lg text-gray-300/90 leading-relaxed font-light">
          {{ item.desc }}
        </p>

        <div class="flex flex-wrap gap-2 pt-2">
          <span
            v-for="(tag, tagIndex) in item.tags"
            :key="tagIndex"
            class="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:border-primary/30 hover:text-primary transition-colors duration-300"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <div :class="['relative z-10 flex justify-center', index % 2 === 0 ? '' : 'md:direction-ltr']">
        <Motion
          :initial="{ opacity: 0, scale: 0.8, y: 40 }"
          :enter="{ opacity: 1, scale: 1, y: 0 }"
          :transition="{ type: 'spring', stiffness: 120, damping: 12, delay: 0.6 + index * 0.2 }"
          class="relative"
        >
          <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-2xl scale-90 group-hover:scale-100 transition-transform duration-700"></div>
          
          <div class="relative bg-white/[0.02] rounded-2xl p-6 border border-white/5 group-hover:border-primary/20 transition-all duration-700">
            <NuxtImg
              :src="item.img"
              :alt="item.title"
              class="w-full max-w-sm mx-auto object-contain transform group-hover:scale-105 transition-transform duration-700 drop-shadow-2xl"
            />
          </div>
        </Motion>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
const identity = ['INTELLIGENCE', 'PLAYFULNESS', 'FOCUS', 'CHALLENGE', 'INSIGHT']
const features = [
  {
    id: 1,
    title: "AI Agent Learning",
    desc: "Bertemu dengan AI assistant yang memahami cara belajarmu. Menggunakan teknologi RAG untuk memberikan jawaban kontekstual, menjelaskan konsep kompleks dengan sederhana, dan membimbingmu menemukan materi yang tepat saat kamu membutuhkannya.",
    tags: ["Smart AI", "Context-Aware", "Personalized"],
    img: "pictures/home/features/ai.svg"
  },
  {
    id: 2,
    title: "Gamifikasi",
    desc: "Belajar jadi lebih seru dengan sistem reward yang menarik. Kumpulkan poin, jaga streak harianmu, raih achievement badges, dan bersaing di leaderboard. Setiap progress adalah pencapaian yang patut dirayakan.",
    tags: ["Points & Badges", "Leaderboard", "Daily Streak"],
    img: "pictures/home/features/game.svg"
  },
  {
    id: 3,
    title: "Microlearning",
    desc: "Materi dipecah menjadi langkah-langkah kecil yang mudah dicerna. Struktur pembelajaran terorganisir dari kategori hingga konten spesifik, membuatmu belajar secara efektif tanpa merasa overwhelmed.",
    tags: ["Bite-sized", "Structured", "Progressive"],
    img: "pictures/home/features/learn.svg"
  },
  {
    id: 4,
    title: "Quiz With Game",
    desc: "Uji pemahamanmu dengan berbagai format soal: pilihan ganda, upload file, atau studi kasus. Dapatkan feedback real-time dan coba lagi hingga kamu benar-benar paham. Setiap percobaan adalah kesempatan belajar.",
    tags: ["Multiple Formats", "Instant Feedback", "Retake Anytime"],
    img: "pictures/home/features/quiz.svg"
  },
  {
    id: 5,
    title: "Evaluasi & Monitoring",
    desc: "Dashboard lengkap untuk guru dan admin memantau progress siswa secara real-time. Track kemajuan, identifikasi yang perlu bantuan, dan terima notifikasi achievement penting. Data yang actionable untuk pembelajaran yang lebih baik.",
    tags: ["Real-time Dashboard", "Progress Tracking", "Smart Notifications"],
    img: "pictures/home/features/eval.svg"
  }
]

const featureCards = ref<HTMLElement[]>([])

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("shine-once")

          setTimeout(() => {
            entry.target.classList.remove("shine-once")
          }, 1200)

          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.3 }
  )

  featureCards.value.forEach((el) => {
    if (el) observer.observe(el)
  })
})
</script>

<style scoped>
.shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(100, 149, 237, 0.2) 20%, 
    rgba(100, 149, 237, 0.1) 50%,  
    transparent 100%
  );
  transform: skewX(-20deg);
  pointer-events: none;
  z-index: 20;
}

.group:hover .shine {
  animation: shine-move 1s ease forwards;
}

.feature-card.shine-once .shine {
  animation: shine-move 1s ease forwards;
}


@keyframes shine-move {
  0% {
    left: -100%;
  }
  100% {
    left: 120%;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-30px) translateX(15px);
  }
}

@keyframes float-delayed {
  0%, 100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(30px) translateX(-15px);
  }
}

.animate-float {
  animation: float 8s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 10s ease-in-out infinite;
}

.direction-rtl {
  direction: rtl;
}

.direction-ltr {
  direction: ltr;
}
</style>