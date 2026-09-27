import { defineConfig, type DefaultTheme } from 'vitepress'

const repo = 'https://github.com/nakamura196/ClioX-mvg-portal'

function sidebarEn(): DefaultTheme.Sidebar {
  return {
    '/archivists/': [
      {
        text: 'For archivists',
        items: [
          { text: 'Start here', link: '/archivists/' },
          { text: 'Words, in archival terms', link: '/archivists/glossary' },
          { text: 'A first look (video)', link: '/archivists/video' },
          { text: 'Try the trial site', link: '/archivists/try' },
          { text: 'Questions and answers', link: '/archivists/faq' },
          {
            text: 'What is kept where (on-chain / off-chain)',
            link: '/archivists/on-and-off-chain'
          },
          {
            text: 'When the publishing service closes',
            link: '/archivists/when-a-node-closes'
          }
        ]
      }
    ],
    '/developers/': [
      {
        text: 'For developers',
        items: [
          { text: 'Overview', link: '/developers/' },
          { text: 'Self-hosting on Sepolia', link: '/developers/self-hosting' },
          { text: 'API (OpenAPI)', link: '/developers/api' },
          {
            text: 'CLI: publish and free compute',
            link: '/developers/trial-run'
          },
          { text: 'Known problems', link: '/developers/known-problems' },
          {
            text: 'The Gaia-X Service Credential button',
            link: '/developers/gaia-x-credential'
          },
          { text: 'The Verify page', link: '/developers/verify' },
          {
            text: 'Visualizations and Chatbot',
            link: '/developers/usecases'
          }
        ]
      }
    ],
    '/project/': [
      {
        text: 'For the project',
        items: [
          { text: 'Overview', link: '/project/' },
          {
            text: 'Trial check, 26 Sep 2026',
            link: '/project/check-2026-09-26'
          },
          { text: 'Prototypes', link: '/project/prototypes/' },
          { text: 'Open questions', link: '/project/open-questions' }
        ]
      }
    ]
  }
}

function sidebarJa(): DefaultTheme.Sidebar {
  return {
    '/ja/archivists/': [
      {
        text: 'アーキビストの方へ',
        items: [
          { text: 'はじめに', link: '/ja/archivists/' },
          {
            text: '用語をアーカイブズの言葉で',
            link: '/ja/archivists/glossary'
          },
          { text: 'はじめて見る方へ（動画）', link: '/ja/archivists/video' },
          { text: '試用サイトを見てみる', link: '/ja/archivists/try' },
          { text: 'よくある質問', link: '/ja/archivists/faq' },
          {
            text: 'どこに何が記録されるか（チェーンの上と外）',
            link: '/ja/archivists/on-and-off-chain'
          },
          {
            text: '登録に使ったサービスが無くなったとき',
            link: '/ja/archivists/when-a-node-closes'
          }
        ]
      }
    ],
    '/ja/developers/': [
      {
        text: '開発者の方へ',
        items: [
          { text: '概要', link: '/ja/developers/' },
          { text: 'API（OpenAPI）', link: '/ja/developers/api' },
          { text: 'CLI で登録と無償の計算', link: '/ja/developers/trial-run' },
          { text: '分かっている問題', link: '/ja/developers/known-problems' },
          {
            text: 'Gaia-X サービスクレデンシャル',
            link: '/ja/developers/gaia-x-credential'
          },
          { text: '「検証」ページ', link: '/ja/developers/verify' },
          {
            text: '「可視化」と「チャットボット」',
            link: '/ja/developers/usecases'
          },
          { text: '自分で建てる（英語）', link: '/developers/self-hosting' }
        ]
      }
    ],
    '/ja/project/': [
      {
        text: 'プロジェクトの方へ',
        items: [
          { text: '概要', link: '/ja/project/' },
          {
            text: '試用環境の点検（2026-09-26）',
            link: '/ja/project/check-2026-09-26'
          },
          { text: '試作の一覧', link: '/ja/project/prototypes' },
          { text: '相談したいこと', link: '/ja/project/open-questions' }
        ]
      }
    ]
  }
}

export default defineConfig({
  srcDir: 'src',
  // The portal's postcss.config.js (Tailwind) sits one folder up; keep it out.
  vite: { css: { postcss: {} } },
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          ja: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                noResultsText: '見つかりませんでした',
                resetButtonTitle: 'クリア',
                footer: {
                  selectText: '選ぶ',
                  navigateText: '移動',
                  closeText: '閉じる'
                }
              }
            }
          }
        }
      }
    }
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'Clio-X Trial Notes',
      description:
        'Notes from running Clio-X on the Sepolia test network: for archivists, developers and the Clio-X project.',
      themeConfig: {
        nav: [
          {
            text: 'Archivists',
            link: '/archivists/',
            activeMatch: '^/archivists/'
          },
          {
            text: 'Developers',
            link: '/developers/',
            activeMatch: '^/developers/'
          },
          { text: 'Project', link: '/project/', activeMatch: '^/project/' },
          { text: 'Trial site', link: 'https://cliox.ldas.jp' }
        ],
        sidebar: sidebarEn(),
        footer: {
          message:
            'Independent notes by Satoru Nakamura (University of Tokyo; visiting UBC). Not an official Clio-X or Ocean Protocol site.'
        }
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      link: '/ja/',
      title: 'Clio-X 試用の記録',
      description:
        'Clio-X を試験用ネットワーク Sepolia で動かした記録。アーキビスト、開発者、Clio-X プロジェクトの方へ。',
      themeConfig: {
        nav: [
          {
            text: 'アーキビスト',
            link: '/ja/archivists/',
            activeMatch: '^/ja/archivists/'
          },
          {
            text: '開発者',
            link: '/ja/developers/',
            activeMatch: '^/ja/developers/'
          },
          {
            text: 'プロジェクト',
            link: '/ja/project/',
            activeMatch: '^/ja/project/'
          },
          { text: '試用サイト', link: 'https://cliox.ldas.jp/ja' }
        ],
        sidebar: sidebarJa(),
        outline: { label: 'このページの内容' },
        docFooter: { prev: '前へ', next: '次へ' },
        lastUpdated: { text: '最終更新' },
        returnToTopLabel: 'ページの先頭へ',
        sidebarMenuLabel: 'メニュー',
        darkModeSwitchLabel: '表示',
        langMenuLabel: '言語',
        footer: {
          message:
            '中村 覚（東京大学、UBC 滞在中）による個人の記録です。Clio-X や Ocean Protocol の公式サイトではありません。'
        }
      }
    }
  }
})
