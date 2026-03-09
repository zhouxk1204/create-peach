<template>
  <div class="app-container">
    <div class="app-content">

      <!-- Header -->
      <header class="header">
        <h1 class="header-title">
          欢迎使用你的 Vue 应用
        </h1>

        <p class="header-subtitle">
          Created with <span class="header-highlight">create-peach</span>
        </p>
      </header>

      <!-- Logo -->
      <div class="logo-section">

        <a href="https://vitejs.dev" target="_blank" class="logo-link">
          <img src="/vite.svg" class="logo" alt="Vite logo" />
        </a>

        <a href="https://vuejs.org/" target="_blank" class="logo-link">
          <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
        </a>

      </div>

      <!-- Features -->
      <div class="features-wrapper">
        <div class="features-grid">
          <div v-for="(card, i) in featureCards" :key="i" class="card" :style="{ background: card.bg }">

            <div class="card-icon">
              {{ card.icon }}
            </div>

            <h3 class="card-title" :style="{
              background: card.titleGradient,
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }">
              {{ card.title }}
            </h3>

            <p class="card-text">
              {{ card.desc }}
            </p>

          </div>

        </div>
      </div>

      <HelloWorld msg="开始你的开发之旅" />

      <!-- Footer -->
      <footer class="footer">
        <p class="footer-text">
          由 create-peach 创建 ·
          采用
          <span v-for="(c, i) in featureCards" :key="i">
            {{ c.title }}<span v-if="i < featureCards.length - 1"> · </span>
          </span>
        </p>
      </footer>

    </div>
  </div>
</template>
<script setup>
import HelloWorld from "./components/HelloWorld.vue";

const featureCards = [
  {
    icon: "🍑",
    title: "create-peach",
    desc: "轻量级脚手架，快速创建 Vue 项目",
    bg: "linear-gradient(to bottom right,#ffffff,#fdf2f8)",
    titleGradient: "linear-gradient(to right,#db2777,#ea580c)"
  },
  {
    icon: "⚡",
    title: "Vue 3 + Vite",
    desc: "极速开发体验，HMR 热更新",
    bg: "linear-gradient(to bottom right,#ffffff,#f0fdf4)",
    titleGradient: "linear-gradient(to right,#16a34a,#2563eb)"
  },
]

</script>
<style scoped>
.app-container {
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(to bottom right, #faf5ff, #fce7f3, #eff6ff);
}

@media (prefers-color-scheme: dark) {
  .app-container {
    background: linear-gradient(to bottom right, #111827, #581c87, #1f2937);
  }
}

.app-content {
  padding: 2rem 1rem;
}

/* header */

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header-title {
  font-size: 3rem;
  font-weight: bold;
  background: linear-gradient(to right, #9333ea, #2563eb);
  -webkit-background-clip: text;
  color: transparent;
}

.header-subtitle {
  font-size: 1.25rem;
  color: #4b5563;
}

/* logo */

.logo-section {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 3rem;
}

.logo-link:hover {
  transform: scale(1.1);
}

.logo {
  height: 6em;
  padding: 1.5em;
}

/* features */

.features-wrapper {
  padding: 0 1rem;
  margin: 0 auto 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  max-width: 72rem;
  margin: 0 auto;
}

@media (min-width:768px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width:1024px) {
  .features-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* card */

.card {
  border-radius: .5rem;
  padding: 1.5rem;
  transition: .3s;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, .1);
}

.card:hover {
  transform: scale(1.05);
}

.card-icon {
  font-size: 1.8rem;
  margin-bottom: .5rem;
}

.card-title {
  font-size: 1.2rem;
  font-weight: bold;
}

.card-text {
  color: #4b5563;
}

/* footer */

.footer {
  text-align: center;
  margin-top: 3rem;
}

.footer-text {
  font-size: .875rem;
}
</style>
