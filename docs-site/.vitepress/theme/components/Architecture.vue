<script setup lang="ts">
// Who talks to whom in the Sepolia trial. Plain HTML boxes, so it follows the
// theme colours and wraps on a phone.
const props = defineProps<{ lang: 'en' | 'ja' }>()
const t =
  props.lang === 'ja'
    ? {
        portal: ['ポータル（画面）', 'cliox.ldas.jp', 'Vercel'],
        node: [
          'ノード（目録・受付・計算）',
          'cliox-node.ldas.jp',
          'mdx の仮想マシン'
        ],
        subgraph: [
          'subgraph（取引の索引）',
          'cliox-subgraph.ldas.jp',
          '同じ仮想マシン'
        ],
        chain: ['公開の台帳', 'Sepolia（試験用）', 'Ethereum のテストネット'],
        reads: '読む',
        asks: '問い合わせる'
      }
    : {
        portal: ['Portal (web app)', 'cliox.ldas.jp', 'Vercel'],
        node: [
          'Ocean Node (catalogue, provider, compute)',
          'cliox-node.ldas.jp',
          'mdx VM'
        ],
        subgraph: [
          'Subgraph (event index)',
          'cliox-subgraph.ldas.jp',
          'same VM'
        ],
        chain: ['Public ledger', 'Sepolia', 'Ethereum test network'],
        reads: 'reads',
        asks: 'queries'
      }
</script>

<template>
  <div class="arch">
    <div class="box">
      <b>{{ t.portal[0] }}</b
      ><code>{{ t.portal[1] }}</code
      ><span>{{ t.portal[2] }}</span>
    </div>
    <div class="arrow">↓ {{ t.asks }}</div>
    <div class="row">
      <div class="box">
        <b>{{ t.node[0] }}</b
        ><code>{{ t.node[1] }}</code
        ><span>{{ t.node[2] }}</span>
      </div>
      <div class="box">
        <b>{{ t.subgraph[0] }}</b
        ><code>{{ t.subgraph[1] }}</code
        ><span>{{ t.subgraph[2] }}</span>
      </div>
    </div>
    <div class="arrow">↓ {{ t.reads }}</div>
    <div class="box chain">
      <b>{{ t.chain[0] }}</b
      ><code>{{ t.chain[1] }}</code
      ><span>{{ t.chain[2] }}</span>
    </div>
  </div>
</template>

<style scoped>
.arch {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin: 20px 0;
  max-width: 560px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.box {
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.92em;
}
.box span {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
.chain {
  border-style: dashed;
}
.arrow {
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 0.88em;
}
@media (max-width: 480px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
