<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <div class="hello-container">
    <h1>{{ msg }}</h1>

    <div class="card card-button">
      <button type="button" @click="count++">
        count is {{ count }}
      </button>
    </div>

    <div class="info-section">
      <p>
        Edit
        <code>components/HelloWorld.vue</code> to test HMR
      </p>

      <p>
        了解更多关于
        <a href="https://github.com/zhouxk1204/create-peach" target="_blank">create-peach</a> 的信息，快速搭建现代化 Vue 项目
      </p>
      <p>
        查看
        <a href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support" target="_blank">Vue 官方文档</a> 了解更多开发工具支持
      </p>
      <p class="read-the-docs">点击上方 Logo 了解 Vite 和 Vue 的更多信息</p>
    </div>
  </div>
</template>

<style scoped>
.hello-container {
  text-align: center;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;

  &:hover {
    color: #535bf2;
  }
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #ff6b35;
  color: white;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    background-color: #ff8555;
    border-color: #ff6b35;
  }

  &:focus,
  &:focus-visible {
    outline: 4px auto -webkit-focus-ring-color;
  }
}

.card {
  padding: 2em;
}

.card-button {
  display: flex;
  justify-content: center;
}

.info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.read-the-docs {
  color: #888;
}

@media (prefers-color-scheme: light) {
  a:hover {
    color: #747bff;
  }

  button {
    background-color: #ff6b35;

    &:hover {
      background-color: #ff8555;
    }
  }
}
</style>
