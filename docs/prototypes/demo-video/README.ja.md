# 試作 (c): 英語字幕つきの短い紹介動画

ブランチ `proto/demo-video`。一言でいうと、98 秒の音声なしの動画「Clio-X: a first look for archivists」です。
データセットのページを 1 つ見ていき、英語の字幕が話している場所をオレンジの枠で囲みます。
取り上げるのは、記録を保管しているのは誰か、永続的な識別子、変更の記録、「計算のみ」、データルーム、ネットワーク手数料、そしてウォレットが分析を動かすときにだけ要る理由です。

- ナレーションは無く、字幕だけです。英語の字幕は映像に焼き込んであります。英語と日本語の字幕は、MP4 の中の切り替えられるトラック（既定は非表示）と、`captions.en.vtt` / `captions.ja.vtt` にもあります。
- `demo/ocr-i18n` のポータルをそのまま録画しました（このブランチでは画面を変えていません）。見本は InterPARES Indexed Archival Dataset、`did:op:65e78d53…f43d`（Pontus-X の開発用ネットワーク）で、案内ツアーと同じです。
- 台本は文字のファイルです: `scripts/demo-video/script.json`（字幕 13 本。各英文の隣に日本語）。これを直し、ポート 8140 で開発サーバを動かした状態で `zsh scripts/demo-video/build.zsh` を実行すると、`docs/prototypes/demo-video/out/` に新しい動画ができます（コミットしていません。約 4 MB）。
- 読み込み待ちの時間は切り取っています。コマはブラウザ自身が描いた時刻から取るので、字幕はずれません（Playwright に付いている録画機能では 1〜4 秒ずれました）。

分かっている限界: ページにはアルゴリズムの欄に「No assets found」、「No file info available」と出ています（開発用のデータのため）。動画ではそこを指していません。
字幕は Claude の下書きです。たとえ（目録の記述、参照コード、監査証跡）は、動画を外に見せる前にアーキビストに確かめていただく必要があります。

静止画: `title.png`、`custodian.png`、`compute-tag.png`、`data-room.png`。
