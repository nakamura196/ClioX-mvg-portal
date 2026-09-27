# 試作 (a): 用語をアーカイブズの言葉で

ブランチ `proto/glossary`。一言でいうと、Clio-X の画面に出てくる専門用語に点線の下線か「?」を付け、アーカイブズの言葉で説明する試作です（日英）。
一覧のページ `/glossary` もあり、InterPARES Trust AI に定義がある語はそこへリンクします。

- `/glossary`、`/ja/glossary` — 4 つのまとまりに 13 語。各語に、ふつうの意味、アーカイブズでのたとえ、たとえが当てはまらなくなるところ、押しても安全かどうか、を書いています。
- 資料のページ: 所有者（Owner）、DID、資料の状態（Asset State）、Docker イメージ、データトークンの行。
- ヘッダー: 「ウォレットを接続」の隣の「?」（未接続のときだけ）。
- 文章は `content/archivistGlossary.json` / `.ja.json` にあります。

画面: `glossary-ja-top.png`、`wallet-hint-ja.png`、`asset-owner-ja.png`、`asset-datatoken-ja.png`、`glossary-en-datatoken.png`。
