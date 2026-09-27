<script setup lang="ts">
// The 20 prepared answers of prototype (g) (branch proto/archivist-qa,
// content/archivistQa/qa(.ja).json). They are drafts, not reviewed.
import en from '../../../data/archivistQa.json'
import ja from '../../../data/archivistQa.ja.json'
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{ lang: 'en' | 'ja' }>()
const qa: any = props.lang === 'ja' ? ja : en
const byId = Object.fromEntries(qa.entries.map((e: any) => [e.id, e]))
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  const el = id && document.getElementById(id)
  if (el instanceof HTMLDetailsElement) el.open = true
}
onMounted(() => {
  openFromHash()
  window.addEventListener('hashchange', openFromHash)
})
onUnmounted(() => window.removeEventListener('hashchange', openFromHash))

const relatedLabel = props.lang === 'ja' ? '関連する質問' : 'Related'
</script>

<template>
  <p class="draft-note">{{ qa.status }}</p>
  <details v-for="e in qa.entries" :key="e.id" :id="e.id" class="qa">
    <summary>{{ e.question }}</summary>
    <p v-for="(para, i) in e.answer.split('\n\n')" :key="i">{{ para }}</p>
    <p v-if="e.related?.length" class="related">
      {{ relatedLabel }}:
      <template v-for="(r, i) in e.related" :key="r">
        <a :href="'#' + r">{{ byId[r]?.question ?? r }}</a
        ><span v-if="i < e.related.length - 1"> / </span>
      </template>
    </p>
  </details>
</template>

<style scoped>
.qa {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px 16px;
  margin: 10px 0;
}
.qa summary {
  cursor: pointer;
  font-weight: 600;
}
.related {
  font-size: 0.88em;
  color: var(--vp-c-text-2);
}
</style>
