<template>
  <div class="blackhole-container">
    <div class="blackhole-main">
      <div class="blackhole-core"></div>
      <div class="blackhole-glow"></div>
      <div class="blackhole-outer-glow"></div>
    </div>

    <div class="blackhole-rays">
      <div class="ray ray-1"></div>
      <div class="ray ray-2"></div>
      <div class="ray ray-3"></div>
      <div class="ray ray-4"></div>
      <div class="ray ray-5"></div>
      <div class="ray ray-6"></div>
      <div class="ray ray-7"></div>
      <div class="ray ray-8"></div>
    </div>
    
    <div class="dark-atmosphere"></div>
  </div>
</template>

<style scoped>
.blackhole-container {
  position: absolute;
  top: -10%;
  right: -10%;
  width: 80%;
  height: 50%;
  pointer-events: none;
  z-index: 0;
}

.blackhole-main {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 300px;
  border-radius: 50%;
}

.blackhole-core {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at center, 
    #000000 0%,
    #1a0033 30%,
    #2d004d 60%,
    #4a0080 100%
  );
  animation: blackholePulse 4s ease-in-out infinite;
}

.blackhole-glow {
  position: absolute;
  width: 120%;
  height: 120%;
  top: -10%;
  left: -10%;
  border-radius: 50%;
  background: radial-gradient(circle at center,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(26, 0, 51, 0.6) 30%,
    rgba(45, 0, 77, 0.4) 50%,
    rgba(74, 0, 128, 0.2) 70%,
    transparent 100%
  );
  animation: darkGlowPulse 3s ease-in-out infinite;
}

.blackhole-outer-glow {
  position: absolute;
  width: 150%;
  height: 150%;
  top: -25%;
  left: -25%;
  border-radius: 50%;
  background: radial-gradient(circle at center,
    rgba(26, 0, 51, 0.4) 0%,
    rgba(45, 0, 77, 0.3) 20%,
    rgba(74, 0, 128, 0.2) 40%,
    rgba(102, 0, 153, 0.1) 60%,
    transparent 100%
  );
  animation: darkOuterGlow 5s ease-in-out infinite;
}

.blackhole-rays {
  position: absolute;
  top: 150px;
  right: 150px;
  width: 0;
  height: 0;
  transform-origin: center;
}

.ray {
  position: absolute;
  width: 3px;
  height: 80px;
  background: linear-gradient(to top,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(45, 0, 77, 0.6) 50%,
    transparent 100%
  );
  border-radius: 2px;
  transform-origin: bottom center;
  animation: darkRayFlicker 2s ease-in-out infinite;
}

.ray-1 { transform: rotate(0deg) translateY(-40px); animation-delay: 0s; }
.ray-2 { transform: rotate(45deg) translateY(-40px); animation-delay: 0.25s; }
.ray-3 { transform: rotate(90deg) translateY(-40px); animation-delay: 0.5s; }
.ray-4 { transform: rotate(135deg) translateY(-40px); animation-delay: 0.75s; }
.ray-5 { transform: rotate(180deg) translateY(-40px); animation-delay: 1s; }
.ray-6 { transform: rotate(225deg) translateY(-40px); animation-delay: 1.25s; }
.ray-7 { transform: rotate(270deg) translateY(-40px); animation-delay: 1.5s; }
.ray-8 { transform: rotate(315deg) translateY(-40px); animation-delay: 1.75s; }

.dark-atmosphere {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom,
    rgba(45, 0, 77, 0.3) 0%,
    rgba(26, 0, 51, 0.2) 20%,
    rgba(74, 0, 128, 0.15) 40%,
    rgba(25, 25, 50, 0.1) 60%,
    transparent 100%
  );
  border-radius: 100% 0 0 0;
}

@keyframes blackholePulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 50px rgba(45, 0, 77, 0.6);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 80px rgba(74, 0, 128, 0.8);
  }
}

@keyframes darkGlowPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes darkOuterGlow {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1) rotate(2deg);
    opacity: 0.5;
  }
}

@keyframes darkRayFlicker {
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

@media (max-width: 768px) {
  .blackhole-container {
    width: 60%;
    height: 40%;
    top: -5%;
    right: -5%;
  }
  
  .blackhole-main {
    width: 200px;
    height: 200px;
  }
  
  .blackhole-rays {
    top: 100px;
    right: 100px;
  }
  
  .ray {
    height: 50px;
  }
}

@media (max-width: 480px) {
  .blackhole-container {
    width: 50%;
    height: 30%;
  }
  
  .blackhole-main {
    width: 150px;
    height: 150px;
  }
  
  .blackhole-rays {
    top: 75px;
    right: 75px;
  }
  
  .ray {
    height: 30px;
    width: 2px;
  }
}
</style>