<template>
  <div class="relative w-full h-screen overflow-hidden bg-black flex flex-col items-center justify-center text-center">
    <!-- Animated Canvas Background -->
    <canvas ref="canvasRef" class="absolute inset-0 z-0" />

    <!-- Gradient Overlay -->
    <div class="absolute inset-0 bg-linear-to-b from-transparent via-blue-900/20 to-purple-900/40 z-0" />

    <!-- Content -->
    <div class="relative z-10 space-y-8 px-4">
      <!-- Floating Astronaut -->
      <div class="relative mx-auto w-28 h-28 mb-2">
        <div class="absolute inset-0 animate-float">
          <svg viewBox="0 0 200 200" class="w-full h-full drop-shadow-2xl">
            <!-- Helmet -->
            <circle cx="100" cy="70" r="45" fill="#e0e0e0" opacity="0.9"/>
            <circle cx="100" cy="70" r="38" fill="#4a90e2" opacity="0.3"/>
            
            <!-- Visor reflection -->
            <ellipse cx="95" cy="65" rx="15" ry="20" fill="white" opacity="0.4"/>
            
            <!-- Body -->
            <rect x="70" y="110" width="60" height="70" rx="10" fill="#f0f0f0"/>
            
            <!-- Arms -->
            <rect x="40" y="120" width="30" height="15" rx="7" fill="#f0f0f0" transform="rotate(-20 55 127)"/>
            <rect x="130" y="120" width="30" height="15" rx="7" fill="#f0f0f0" transform="rotate(20 145 127)"/>
            
            <!-- Legs -->
            <rect x="75" y="175" width="18" height="30" rx="5" fill="#f0f0f0"/>
            <rect x="107" y="175" width="18" height="30" rx="5" fill="#f0f0f0"/>
            
            <!-- Details -->
            <circle cx="100" cy="140" r="8" fill="#4a90e2"/>
            <rect x="85" y="150" width="30" height="3" fill="#4a90e2"/>
            <rect x="85" y="158" width="30" height="3" fill="#4a90e2"/>
          </svg>
        </div>
        
        <!-- Floating particles -->
        <div class="absolute top-0 left-0 w-2 h-2 bg-cyan-400 rounded-full animate-particle1" />
        <div class="absolute top-10 right-0 w-1.5 h-1.5 bg-purple-400 rounded-full animate-particle2" />
        <div class="absolute bottom-20 left-10 w-2 h-2 bg-pink-400 rounded-full animate-particle3" />
      </div>

      <!-- 404 Text with Glitch Effect -->
      <div class="relative">
        <h1 class="text-8xl md:text-9xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-pulse-glow drop-shadow-[0_0_40px_rgba(0,255,255,0.5)]">
          404
        </h1>
        <!-- Glitch layers -->
        <h1 class="absolute inset-0 text-8xl md:text-9xl font-orbitron font-bold text-red-500 opacity-70 animate-glitch-1" style="clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%)">
          404
        </h1>
        <h1 class="absolute inset-0 text-8xl md:text-9xl font-orbitron font-bold text-cyan-500 opacity-70 animate-glitch-2" style="clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%)">
          404
        </h1>
      </div>

      <!-- Message -->
      <div class="space-y-3">
        <p class="text-2xl md:text-4xl font-exo2 font-bold text-white/90">
          Houston, We Have a Problem
        </p>
        <p class="text-lg md:text-xl font-exo2 text-white/60 max-w-md mx-auto">
          The page you're looking for has drifted into deep space
        </p>
      </div>

      <!-- Buttons -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
        <NuxtLink to="/" class="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full font-bold text-white shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/80 hover:scale-105 transition-all duration-300 overflow-hidden">
          <span class="relative z-10 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Earth
          </span>
          <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </NuxtLink>
        
        <button @click="goBack" class="px-8 py-4 bg-white/10 backdrop-blur-sm rounded-full font-bold text-white border-2 border-white/30 hover:bg-white/20 hover:border-white/50 hover:scale-105 transition-all duration-300">
          Go Back
        </button>
      </div>
    </div>

    <!-- Floating Planets -->
    <div class="absolute w-32 h-32 bg-linear-to-br from-purple-500 to-pink-600 rounded-full top-20 left-10 opacity-30 blur-2xl animate-float-slow" />
    <div class="absolute w-48 h-48 bg-linear-to-br from-cyan-400 to-blue-600 rounded-full bottom-20 right-10 opacity-20 blur-3xl animate-float-slower" />
    <div class="absolute w-24 h-24 bg-linear-to-br from-yellow-400 to-orange-500 rounded-full top-1/3 right-1/4 opacity-25 blur-xl animate-float" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const router = useRouter()

interface Star {
  x: number
  y: number
  radius: number
  speed: number
  opacity: number
}

interface ShootingStar {
  x: number
  y: number
  length: number
  speed: number
  opacity: number
}

let animationId: number | null = null
let shootingStarInterval: number | null = null

const goBack = () => {
  router.back()
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  // Stars
  const stars: Star[] = []
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.1,
      opacity: Math.random()
    })
  }

  // Shooting stars
  const shootingStars: ShootingStar[] = []
  
  const createShootingStar = () => {
    shootingStars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height / 2,
      length: Math.random() * 80 + 20,
      speed: Math.random() * 10 + 5,
      opacity: 1
    })
  }

  shootingStarInterval = window.setInterval(createShootingStar, 2000)

  const animate = () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw stars
    stars.forEach(star => {
      star.y += star.speed
      if (star.y > canvas.height) {
        star.y = 0
        star.x = Math.random() * canvas.width
      }

      star.opacity = Math.sin(Date.now() * 0.001 + star.x) * 0.5 + 0.5
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
      ctx.fill()
    })

    // Draw shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const star = shootingStars[i]
      if (!star) continue
      
      star.x += star.speed
      star.y += star.speed * 0.5
      star.opacity -= 0.01

      if (star.opacity <= 0) {
        shootingStars.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.moveTo(star.x, star.y)
      ctx.lineTo(star.x - star.length, star.y - star.length * 0.5)
      ctx.strokeStyle = `rgba(100, 200, 255, ${star.opacity})`
      ctx.lineWidth = 2
      ctx.stroke()
    }

    animationId = requestAnimationFrame(animate)
  }

  animate()

  const handleResize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  window.addEventListener('resize', handleResize)
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    if (animationId) cancelAnimationFrame(animationId)
    if (shootingStarInterval) clearInterval(shootingStarInterval)
  })
})
</script>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@keyframes float-slow {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -30px) scale(1.1); }
}

@keyframes float-slower {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-40px, 20px) scale(0.95); }
}

@keyframes particle1 {
  0%, 100% { transform: translate(0, 0); opacity: 0; }
  50% { transform: translate(100px, -100px); opacity: 1; }
}

@keyframes particle2 {
  0%, 100% { transform: translate(0, 0); opacity: 0; }
  50% { transform: translate(-80px, 120px); opacity: 1; }
}

@keyframes particle3 {
  0%, 100% { transform: translate(0, 0); opacity: 0; }
  50% { transform: translate(60px, 80px); opacity: 1; }
}

@keyframes glitch-1 {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(-3px, 3px); }
  40% { transform: translate(-3px, -3px); }
  60% { transform: translate(3px, 3px); }
  80% { transform: translate(3px, -3px); }
}

@keyframes glitch-2 {
  0%, 100% { transform: translate(0); }
  20% { transform: translate(3px, -3px); }
  40% { transform: translate(3px, 3px); }
  60% { transform: translate(-3px, -3px); }
  80% { transform: translate(-3px, 3px); }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-slow {
  animation: float-slow 20s ease-in-out infinite;
}

.animate-float-slower {
  animation: float-slower 25s ease-in-out infinite;
}

.animate-particle1 {
  animation: particle1 4s ease-in-out infinite;
}

.animate-particle2 {
  animation: particle2 5s ease-in-out infinite;
}

.animate-particle3 {
  animation: particle3 4.5s ease-in-out infinite;
}

.animate-glitch-1 {
  animation: glitch-1 0.3s infinite;
}

.animate-glitch-2 {
  animation: glitch-2 0.3s infinite;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
</style>