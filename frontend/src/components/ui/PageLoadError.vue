<script setup lang="ts">
defineProps<{ error?: Error }>()
function reload() {
  window.location.reload()
}
</script>

<template>
  <div class="page-load-error" role="alert">
    <h1>页面暂时没能加载</h1>
    <p>请检查网络后重试。</p>
    <button class="button button-primary" type="button" @click="reload">
      重新加载
    </button>
    <a class="button button-quiet" href="#/">返回首页</a>
  </div>
</template>
