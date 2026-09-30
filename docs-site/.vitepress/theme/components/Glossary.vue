<script setup lang="ts">
// Renders the archival-terms glossary written for prototype (a)
// (branch proto/glossary, content/archivistGlossary(.ja).json).
import en from '../../../data/archivistGlossary.json'
import ja from '../../../data/archivistGlossary.ja.json'

const props = defineProps<{ lang: 'en' | 'ja' }>()
// The .ja file only overrides texts; term order per group comes from the English
// file, as in the portal.
const tr: any = props.lang === 'ja' ? ja : {}
const g: any = {
  ...en,
  ...tr,
  labels: { ...en.labels, ...tr.labels },
  groups: en.groups.map((gr: any, i: number) => ({
    ...gr,
    title: tr.groups?.[i]?.title ?? gr.title
  })),
  terms: Object.fromEntries(
    Object.entries(en.terms).map(([k, v]: any) => [
      k,
      { ...v, ...tr.terms?.[k] }
    ])
  )
}
const portal =
  props.lang === 'ja' ? 'https://cliox.ldas.jp/ja' : 'https://cliox.ldas.jp'
const interparesUrl = (id: string) =>
  `${portal}/resources?tab=glossary&term=${encodeURIComponent(id)}`
</script>

<template>
  <div class="glossary">
    <!-- intro[1] is about underlined words inside the portal, so only intro[0] here -->
    <p>{{ g.intro[0] }}</p>

    <div class="tip custom-block">
      <p class="custom-block-title">{{ g.reassurance.title }}</p>
      <ul>
        <li v-for="(item, i) in g.reassurance.items" :key="i">{{ item }}</li>
      </ul>
    </div>

    <section v-for="group in g.groups" :key="group.title">
      <h2 :id="group.title">{{ group.title }}</h2>
      <div v-for="id in group.terms" :key="id" class="term" :id="id">
        <h3>{{ g.terms[id].term }}</h3>
        <p class="short">{{ g.terms[id].short }}</p>
        <dl>
          <dt>{{ g.labels.onScreen }}</dt>
          <dd>
            <code v-for="s in g.terms[id].onScreen" :key="s">{{ s }}</code>
          </dd>
          <dt>{{ g.labels.plain }}</dt>
          <dd>{{ g.terms[id].plain }}</dd>
          <dt>{{ g.labels.archival }}</dt>
          <dd>{{ g.terms[id].archival }}</dd>
          <dt>{{ g.labels.limits }}</dt>
          <dd>{{ g.terms[id].limits }}</dd>
          <dt>{{ g.labels.safety }}</dt>
          <dd>{{ g.terms[id].safety }}</dd>
          <template v-if="g.terms[id].interpares">
            <dt>{{ g.labels.interpares }}</dt>
            <dd>
              <a
                :href="interparesUrl(g.terms[id].interpares)"
                target="_blank"
                rel="noopener"
                >{{ g.terms[id].interpares }}</a
              >
            </dd>
          </template>
        </dl>
      </div>
    </section>
  </div>
</template>

<style scoped>
.term {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 4px 18px 10px;
  margin: 16px 0;
}
.term h3 {
  margin-top: 14px;
}
.short {
  font-weight: 600;
}
dl {
  display: grid;
  grid-template-columns: minmax(8em, 11em) 1fr;
  gap: 6px 16px;
  margin: 8px 0;
}
dt {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
dd {
  margin: 0;
}
dd code {
  margin-right: 6px;
}
@media (max-width: 640px) {
  dl {
    grid-template-columns: 1fr;
  }
  dd {
    margin-bottom: 8px;
  }
}
</style>
