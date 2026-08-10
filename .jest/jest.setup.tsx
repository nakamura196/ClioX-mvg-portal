import '@testing-library/jest-dom/extend-expect'
import { jest } from '@jest/globals'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import './__mocks__/matchMedia'
import './__mocks__/hooksMocks'
import './__mocks__/connectkit'
import en from '../src/i18n/locales/en.json'

// Components call useTranslation() directly rather than going through a
// provider, so tests need the default i18next instance initialized — otherwise
// t() returns the key and every assertion on visible copy fails.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: { en: { common: en } },
  interpolation: { escapeValue: false }
})

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    route: '/',
    pathname: '/'
  }))
}))

// jest.mock('next/head', () => {
//   return {
//     __esModule: true,
//     default: ({ children }: { children: Array<React.ReactElement> }) => {
//       return <>{children}</>
//     }
//   }
// })
