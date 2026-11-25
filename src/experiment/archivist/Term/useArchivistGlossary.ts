import glossaryEn from '../../../../content/archivistGlossary.json'
import glossaryJa from '../../../../content/archivistGlossary.ja.json'
import useLocaleContent from '../../../i18n/useLocaleContent'

export type ArchivistGlossary = typeof glossaryEn
export type ArchivistTermId = keyof ArchivistGlossary['terms']
export type ArchivistTermEntry = ArchivistGlossary['terms'][ArchivistTermId]

export default function useArchivistGlossary(): ArchivistGlossary {
  return useLocaleContent(glossaryEn, glossaryJa)
}
