<template>
  <section class="rc-featured rc-featured--loading" aria-hidden="true">
    <div class="rc-card rc-featured__main">
      <div class="rc-skel rc-featured__skel-cover"></div>
      <div class="rc-featured__content">
        <div class="rc-skel rc-skel--line rc-skel--w60"></div>
        <div class="rc-skel rc-skel--line"></div>
        <div class="rc-skel rc-skel--line rc-skel--w80"></div>
        <div class="rc-skel rc-skel--button"></div>
      </div>
    </div>
    <div class="rc-featured__list">
      <div class="rc-skel rc-skel--line rc-skel--w40"></div>
      <div class="rc-featured__skel-items">
        <div v-for="n in 3" :key="n" class="rc-skel rc-featured__skel-item"></div>
      </div>
    </div>
  </section>
</template>
