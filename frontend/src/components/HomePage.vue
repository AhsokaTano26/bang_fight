<script setup lang="ts">
import { ArrowRight, ArrowUpRight } from '@lucide/vue'
import PageHeader from './PageHeader.vue'
import {
  CARD_FACTIONS,
  CARD_PACK_VERSION,
  CARD_SHOWCASE,
} from '../types/card-pack-summary.generated'
const emit = defineEmits<{ navigate: [page: string] }>()
const development = import.meta.env.DEV
</script>

<template>
  <div class="home-page">
    <PageHeader title="邦邦武斗传" />
    <main class="home-main page-container">
      <section class="home-hero" aria-labelledby="home-title">
        <div class="hero-copy">
          <h1 id="home-title">邦邦<br />武斗传</h1>
          <p class="home-description">
            部署角色、搭配道具，<br
              class="mobile-break"
            />用每一个行动点扭转战局。
          </p>
          <div class="hero-actions">
            <button
              class="button button-primary start-button"
              type="button"
              @click="emit('navigate', 'select')"
            >
              开始对战<ArrowRight :size="24" aria-hidden="true" />
            </button>
            <button
              class="button browse-button"
              type="button"
              @click="emit('navigate', 'gallery')"
            >
              浏览卡牌
            </button>
          </div>
        </div>
        <div
          class="hero-cards"
          role="img"
          aria-label="来自 Afterglow、Roselia 与 Hello, Happy World! 的角色卡牌"
        >
          <img
            v-for="(card, index) in CARD_SHOWCASE"
            :key="card.id"
            :src="'/' + card.imageFile"
            alt=""
            :width="card.width"
            :height="card.height"
            :fetchpriority="index === 2 ? 'high' : 'auto'"
            decoding="async"
            :style="{ '--card-index': index }"
          />
        </div>
      </section>
      <section class="band-section" aria-labelledby="band-title">
        <h2 id="band-title">你的乐队，你的打法</h2>
        <ul class="band-roster" aria-label="图鉴收录的乐队">
          <li v-for="faction in CARD_FACTIONS" :key="faction.id">
            <span
              class="band-dot"
              :style="{ background: faction.color }"
              aria-hidden="true"
            /><abbr :title="faction.name">{{ faction.id }}</abbr>
          </li>
        </ul>
      </section>
    </main>
    <footer class="home-footer">
      <span>卡牌资源 {{ CARD_PACK_VERSION }}</span>
      <div class="footer-links">
        <a v-if="development" href="#/test">开发测试</a
        ><a href="#/gallery?tab=rules"
          >规则速查<ArrowUpRight :size="16" aria-hidden="true"
        /></a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}
.home-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.home-hero {
  display: grid;
  grid-template-columns: 0.9fr 1.65fr;
  align-items: center;
  gap: 40px;
  min-height: 610px;
  flex: 1;
  padding: 64px 0;
}
.hero-copy {
  position: relative;
  z-index: 1;
}
.hero-copy h1 {
  font-size: clamp(64px, 6.2vw, 96px);
  font-weight: 850;
  letter-spacing: -4px;
  line-height: 1.1;
  margin: 0 0 28px;
}
.home-description {
  color: var(--text-dim);
  font-size: 17px;
  line-height: 1.9;
  margin: 0 0 36px;
  white-space: nowrap;
}
.mobile-break {
  display: none;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.start-button,
.browse-button {
  min-height: 64px;
  padding: 14px 26px;
  font-size: 20px;
}
.start-button {
  gap: 20px;
}
.hero-cards {
  position: relative;
  height: 400px;
  min-width: 0;
  isolation: isolate;
}
.hero-cards img {
  position: absolute;
  left: calc(50% + (var(--card-index) - 2) * 16%);
  top: calc(28px + (var(--card-index) - 2) * (var(--card-index) - 2) * 7px);
  width: 29%;
  max-width: 240px;
  height: auto;
  aspect-ratio: 869 / 1213;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 12px 20px rgb(41 38 34 / 15%);
  transform: translateX(-50%) rotate(calc((var(--card-index) - 2) * 6deg));
  z-index: calc(5 - var(--card-index));
}
.band-section {
  border-top: 1px solid var(--border);
  padding: 36px 0 56px;
}
.band-section h2 {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.7px;
  text-align: center;
  margin: 0 0 30px;
}
.band-roster {
  padding: 0;
  margin: 0;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.band-roster li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-inline: 18px;
  border-left: 1px solid var(--border);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}
.band-roster li:first-child {
  border-left: 0;
  padding-left: 0;
}
.band-roster li:last-child {
  padding-right: 0;
}
.band-roster abbr {
  text-decoration: none;
}
.band-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.home-footer {
  min-height: 64px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px clamp(16px, 3.5vw, 56px);
  color: var(--text-dim);
  font-size: 12px;
}
.footer-links,
.footer-links a {
  display: flex;
  align-items: center;
  gap: 6px;
}
.footer-links {
  gap: 24px;
}
.footer-links a {
  min-height: 32px;
}
.footer-links a:hover {
  color: var(--accent);
}
@media (min-width: 1500px) {
  .home-hero {
    min-height: 650px;
  }
}
@media (max-width: 1100px) {
  .home-hero {
    grid-template-columns: 0.9fr 1.35fr;
    gap: 24px;
    min-height: 550px;
  }
  .home-description {
    white-space: normal;
    max-width: 330px;
  }
  .hero-cards {
    height: 330px;
  }
  .band-roster li {
    padding-inline: 10px;
    gap: 7px;
    font-size: 14px;
  }
  .band-dot {
    width: 10px;
    height: 10px;
  }
  .start-button,
  .browse-button {
    font-size: 17px;
    padding: 12px 20px;
    min-height: 56px;
  }
}
@media (max-width: 767px) {
  .home-hero {
    grid-template-columns: 1fr;
    padding: 48px 0 32px;
    gap: 20px;
    min-height: auto;
  }
  .hero-copy h1 {
    font-size: 68px;
    letter-spacing: -3px;
  }
  .hero-copy h1 br {
    display: none;
  }
  .hero-copy {
    text-align: center;
  }
  .home-description {
    margin: 0 auto 24px;
    max-width: none;
    font-size: 15px;
  }
  .hero-actions {
    justify-content: center;
  }
  .hero-cards {
    width: 92%;
    max-width: 600px;
    height: 310px;
    margin-inline: auto;
  }
  .hero-cards img {
    max-width: 180px;
  }
  .band-section {
    padding: 28px 0 32px;
  }
  .band-section h2 {
    font-size: 23px;
    margin-bottom: 24px;
  }
  .band-roster {
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px 0;
  }
  .band-roster li {
    width: 20%;
    padding-inline: 4px;
    border: 0;
    font-size: 13px;
  }
}
@media (max-width: 480px) {
  .home-hero {
    padding-top: 38px;
    gap: 18px;
  }
  .hero-copy h1 {
    font-size: 54px;
    letter-spacing: -2px;
    margin-bottom: 20px;
  }
  .hero-cards {
    height: 250px;
    width: 100%;
  }
  .hero-cards img {
    width: 30%;
    top: calc(18px + (var(--card-index) - 2) * (var(--card-index) - 2) * 5px);
  }
  .start-button,
  .browse-button {
    min-height: 52px;
    font-size: 16px;
    padding: 10px 20px;
  }
  .hero-actions {
    gap: 12px;
  }
  .home-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .footer-links {
    width: 100%;
    justify-content: space-between;
  }
}
@media (max-width: 359px) {
  .hero-copy h1 {
    font-size: 47px;
  }
  .hero-cards {
    height: 220px;
  }
  .home-description {
    font-size: 14px;
  }
  .band-roster li {
    font-size: 12px;
    gap: 5px;
  }
}
</style>
