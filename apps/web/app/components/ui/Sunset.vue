<template>
  <div class="sunset-sun-container">
    <div class="sun-main">
      <div class="sun-core"></div>
      <div class="sun-glow"></div>
      <div class="sun-outer-glow"></div>
    </div>

    <div class="sun-rays">
      <div class="ray ray-1"></div>
      <div class="ray ray-2"></div>
      <div class="ray ray-3"></div>
      <div class="ray ray-4"></div>
      <div class="ray ray-5"></div>
      <div class="ray ray-6"></div>
      <div class="ray ray-7"></div>
      <div class="ray ray-8"></div>
    </div>
    
    <div class="atmosphere-gradient"></div>
  </div>
</template>

<style scoped>
.sunset-sun-container {
  position: absolute;
  bottom: -10%;
  left: -10%;
  width: 80%;
  height: 50%;
  pointer-events: none;
  z-index: 1;
}

.sun-main {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 300px;
  height: 300px;
  border-radius: 50%;
}

.sun-core {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at center, 
    #FFD700 0%,
    #FF8C00 30%,
    #FF6A00 60%,
    #FF4500 100%
  );
  animation: sunPulse 4s ease-in-out infinite;
}

.sun-glow {
  position: absolute;
  width: 120%;
  height: 120%;
  top: -10%;
  left: -10%;
  border-radius: 50%;
  background: radial-gradient(circle at center,
    rgba(255, 215, 0, 0.4) 0%,
    rgba(255, 140, 0, 0.3) 30%,
    rgba(255, 106, 0, 0.2) 50%,
    rgba(255, 69, 0, 0.1) 70%,
    transparent 100%
  );
  animation: glowPulse 3s ease-in-out infinite;
}

.sun-outer-glow {
  position: absolute;
  width: 150%;
  height: 150%;
  top: -25%;
  left: -25%;
  border-radius: 50%;
  background: radial-gradient(circle at center,
    rgba(255, 140, 0, 0.2) 0%,
    rgba(255, 106, 0, 0.15) 20%,
    rgba(255, 69, 0, 0.1) 40%,
    rgba(255, 0, 0, 0.05) 60%,
    transparent 100%
  );
  animation: outerGlow 5s ease-in-out infinite;
}

.sun-rays {
  position: absolute;
  bottom: 150px;
  left: 150px;
  width: 0;
  height: 0;
  transform-origin: center;
}

.ray {
  position: absolute;
  width: 3px;
  height: 80px;
  background: linear-gradient(to top,
    rgba(255, 215, 0, 0.8) 0%,
    rgba(255, 140, 0, 0.6) 50%,
    transparent 100%
  );
  border-radius: 2px;
  transform-origin: bottom center;
  animation: rayFlicker 2s ease-in-out infinite;
}

.ray-1 { transform: rotate(0deg) translateY(-40px); animation-delay: 0s; }
.ray-2 { transform: rotate(45deg) translateY(-40px); animation-delay: 0.25s; }
.ray-3 { transform: rotate(90deg) translateY(-40px); animation-delay: 0.5s; }
.ray-4 { transform: rotate(135deg) translateY(-40px); animation-delay: 0.75s; }
.ray-5 { transform: rotate(180deg) translateY(-40px); animation-delay: 1s; }
.ray-6 { transform: rotate(225deg) translateY(-40px); animation-delay: 1.25s; }
.ray-7 { transform: rotate(270deg) translateY(-40px); animation-delay: 1.5s; }
.ray-8 { transform: rotate(315deg) translateY(-40px); animation-delay: 1.75s; }

.atmosphere-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top,
    rgba(255, 106, 0, 0.3) 0%,
    rgba(255, 140, 0, 0.2) 20%,
    rgba(255, 69, 0, 0.15) 40%,
    rgba(139, 69, 19, 0.1) 60%,
    transparent 100%
  );
  border-radius: 0 100% 0 0;
}

@keyframes sunPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 50px rgba(255, 140, 0, 0.6);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 80px rgba(255, 140, 0, 0.8);
  }
}

@keyframes glowPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes outerGlow {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1) rotate(2deg);
    opacity: 0.5;
  }
}

@keyframes rayFlicker {
  0%, 100% {
    opacity: 0.7;
    height: 80px;
  }
  25% {
    opacity: 0.9;
    height: 100px;
  }
  75% {
    opacity: 0.5;
    height: 60px;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sunset-sun-container {
    width: 60%;
    height: 40%;
    bottom: -5%;
    left: -5%;
  }
  
  .sun-main {
    width: 200px;
    height: 200px;
  }
  
  .sun-rays {
    bottom: 100px;
    left: 100px;
  }
  
  .ray {
    height: 50px;
  }
}

@media (max-width: 480px) {
  .sunset-sun-container {
    width: 50%;
    height: 30%;
  }
  
  .sun-main {
    width: 150px;
    height: 150px;
  }
  
  .sun-rays {
    bottom: 75px;
    left: 75px;
  }
  
  .ray {
    height: 30px;
    width: 2px;
  }
}
</style>