/**
 * next-i18next v16 publishes its Pages Router entry point only through the
 * package `exports` map. Webpack resolves that fine, but this project's
 * TypeScript `moduleResolution: "node"` predates `exports` and cannot see it.
 *
 * Mapping the subpath through tsconfig `paths` is not an option: Next.js feeds
 * tsconfig paths into webpack too, which would make the bundler try to parse
 * the `.d.cts` declaration file as runtime code. So declare the small surface
 * we actually use instead.
 */
declare module 'next-i18next/pages' {
  import type { AppProps } from 'next/app'
  import type { ComponentType } from 'react'

  export const appWithTranslation: <Props extends AppProps>(
    WrappedComponent: ComponentType<Props>,
    configOverride?: unknown
  ) => ComponentType<Props>
}
