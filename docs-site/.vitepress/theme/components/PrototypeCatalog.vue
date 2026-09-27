<script setup lang="ts">
import { withBase } from 'vitepress'
import list from '../../../data/prototypes.json'

const props = defineProps<{ lang: 'en' | 'ja' }>()
const l = props.lang
const detail = l === 'ja' ? '詳しく' : 'Details'
const base = l === 'ja' ? '/ja/project/prototypes' : '/project/prototypes'
const openLabel = l === 'ja' ? '未決の点' : 'Open point'
</script>

<template>
  <div class="card-grid">
    <div v-for="p in list" :key="p.topic" class="card" :id="p.topic">
      <video
        v-if="p.video"
        :src="withBase(p.video)"
        controls
        preload="none"
        :poster="withBase(`/prototypes/${p.topic}/${p.image[l]}`)"
      />
      <a
        v-else
        :href="withBase(`/prototypes/${p.topic}/${p.image[l]}`)"
        target="_blank"
      >
        <img
          :src="withBase(`/prototypes/${p.topic}/${p.image[l]}`)"
          :alt="p.title[l]"
          loading="lazy"
        />
      </a>
      <h3>({{ p.letter }}) {{ p.title[l] }}</h3>
      <p>{{ p.line[l] }}</p>
      <p v-if="p.open">
        <strong>{{ openLabel }}:</strong> {{ p.open[l] }}
      </p>
      <p class="meta">
        <code>{{ p.branch }}</code> @ <code>{{ p.commit }}</code> ·
        <a :href="withBase(`${base}/${p.topic}`)">{{ detail }}</a>
      </p>
    </div>
  </div>
</template>
