import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Glossary from './components/Glossary.vue'
import QaList from './components/QaList.vue'
import PrototypeCatalog from './components/PrototypeCatalog.vue'
import Architecture from './components/Architecture.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Glossary', Glossary)
    app.component('QaList', QaList)
    app.component('PrototypeCatalog', PrototypeCatalog)
    app.component('Architecture', Architecture)
  }
} satisfies Theme
