#!/usr/bin/env python3
"""Generate src/public/dsp/dsp-connector-{en,ja}.svg. Run: python3 scripts/dsp-diagram.py"""
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "public", "dsp")
T = {
'en': dict(
 b1="ONCE: contract (DSP)", b2="EACH COMPUTE JOB (Ocean, no DSP)",
 prov=["DSP providers", "speak DSP", "news-a, yanesen (ldas-dsp)", "Eclipse EDC", "Clio-X data provider (planned)"],
 ds=["ds.ldas.jp", "portal, not a connector"],
 op=["Clio-X operator", "consumer side, for the node", "agrees: compute only,", "no redistribution"],
 dsp=["DSP: catalog, ODRL policy,", "negotiation, transfer"],
 gath=["gathers", "catalogs"],
 cred=["long-lived credential, put into the DDO"],
 pub=["Publisher", "data holder"], reg=["registers", "dataset"],
 portal=["Clio-X portal", "cliox.ldas.jp", "publish / buy"],
 store=["Data storage", "does not speak DSP", "cliox-files.ldas.jp", "guarded by Cloudflare Access"],
 node=["Ocean node", "no DSP, no dataset", "1. fetch file by URL + headers", "2. run algorithm in isolated", "container, no network", "3. return results only"],
 cons=["Consumer", "gets results only,", "never the file"],
 ddo=["DDO: URL + headers", "(encrypted)"], file=["file, per job"], res=["results only"], buy=["buys, starts a job"],
 l1="File data (storage to node only)", l2="Results only", l3="Metadata, credentials, requests (no file)",
 note="Ocean only fetches by URL + headers. DSP is used once, for the contract. ds.ldas.jp and ldas-dsp implement DSP.",
 font="-apple-system,Segoe UI,Helvetica,Arial,sans-serif"),
'ja': dict(
 b1="最初に 1 回: 契約（DSP）", b2="計算ジョブごと（Ocean、DSP なし）",
 prov=["DSP の提供者", "DSP を話す", "news-a、yanesen（ldas-dsp）", "Eclipse EDC", "Clio-X のデータの提供者（計画中）"],
 ds=["ds.ldas.jp", "ポータル（コネクタではない）"],
 op=["Clio-X の運営者", "ノードのための利用者側", "合意: 計算だけ、", "再配布はしない"],
 dsp=["DSP: カタログ・ODRL ポリシー・", "契約の交渉・転送"],
 gath=["カタログを", "集める"],
 cred=["長期の認証情報を DDO に入れる"],
 pub=["公開する人", "データの持ち主"], reg=["データセットを", "登録"],
 portal=["Clio-X ポータル", "cliox.ldas.jp", "公開 / 購入"],
 store=["データの保管場所", "DSP は話さない", "cliox-files.ldas.jp", "Cloudflare Access が守る"],
 node=["Ocean ノード", "DSP なし・データは持たない", "1. URL とヘッダーで取得", "2. 隔離したコンテナで実行", "（ネットワークなし）", "3. 結果だけを返す"],
 cons=["利用者", "受け取るのは結果だけ", "ファイルは渡らない"],
 ddo=["DDO: URL とヘッダー", "（暗号化）"], file=["ファイル", "（ジョブごと）"], res=["結果だけ"], buy=["購入・ジョブ開始"],
 l1="ファイルのデータ（保管場所からノードだけ）", l2="結果だけ", l3="メタデータ・認証情報・依頼（ファイルなし）",
 note="Ocean は URL とヘッダーで取得するだけ。DSP は最初の契約でだけ使う。ds.ldas.jp と ldas-dsp は DSP を実装している。",
 font="Hiragino Sans,Noto Sans JP,Yu Gothic,sans-serif"),
}
W, H = 1200, 780

def gen(l):
    t = T[l]; o = []
    def tx(x, y, lines, size=15, anchor="middle", fill="#1b2430", lh=20, bold=True):
        for i, s in enumerate(lines):
            b = bold and i == 0
            o.append(f'<text x="{x}" y="{y+i*lh}" text-anchor="{anchor}" font-size="{size+2 if b else size}" font-weight="{600 if b else 400}" fill="{fill}">{s}</text>')
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{t["font"]}" role="img" aria-label="{t["b1"]} / {t["b2"]}">')
    o.append('<defs>' + ''.join(f'<marker id="{n}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="{c}"/></marker>' for n, c in [("ah", "#c2410c"), ("ag", "#15803d"), ("am", "#475569")]) + '</defs>')
    o.append(f'<rect width="{W}" height="{H}" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>')
    def band(y, h, fill, stroke, title):
        o.append(f'<rect x="20" y="{y}" width="1160" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="2 0"/>')
        tx(36, y+24, [title], 13, "start", "#334155")
    band(16, 270, "#f1f5ff", "#a5b4fc", t["b1"])
    band(304, 400, "#f4faf5", "#86efac", t["b2"])
    def box(x, y, w, h, fill, stroke, dash=""):
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2" {dash}/>')
    def line(d, c, m, w=2.5, dash=True):
        ds = ' stroke-dasharray="7 5"' if dash else ''
        o.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" marker-end="url(#{m})"{ds}/>')
    g = "#475569"
    # band 1
    box(40, 56, 380, 170, "#eef2ff", "#6366f1"); tx(230, 86, t["prov"], 14, lh=24)
    box(500, 176, 200, 70, "#ecfeff", "#0e7490"); tx(600, 204, t["ds"], 13, lh=20)
    box(780, 56, 340, 130, "#eef2ff", "#6366f1"); tx(950, 86, t["op"], 14, lh=22)
    line("M422 120 H778", g, "am"); tx(600, 100, t["dsp"], 13, lh=17, fill=g, bold=False)
    line("M498 211 H422", g, "am"); tx(460, 181, t["gath"], 12, lh=15, fill=g, bold=False)
    # credential into DDO (crosses the band border)
    line("M950 186 V294 H480 V348", g, "am"); tx(715, 284, t["cred"], 13, fill=g, bold=False)
    # band 2
    box(40, 346, 200, 84, "#f1f5f9", "#475569"); tx(140, 380, t["pub"], 14, lh=22)
    box(360, 348, 280, 90, "#ecfeff", "#0e7490"); tx(500, 376, t["portal"], 14, lh=20)
    line("M242 400 H358", g, "am"); tx(300, 372, t["reg"], 12, lh=15, fill=g, bold=False)
    box(40, 530, 260, 130, "#fff7ed", "#c2410c", 'stroke-dasharray="6 4"'); tx(170, 562, t["store"], 14, lh=22)
    box(400, 510, 320, 170, "#f0fdf4", "#15803d"); tx(560, 540, t["node"], 14, lh=22)
    box(880, 540, 280, 110, "#f1f5f9", "#475569"); tx(1020, 576, t["cons"], 14, lh=22)
    line("M560 438 V508", g, "am"); tx(572, 468, t["ddo"], 12, "start", g, 16, False)
    line("M300 595 H398", "#c2410c", "ah", 5, False); tx(349, 625, t["file"], 12, lh=15, fill="#c2410c", bold=False)
    line("M720 595 H878", "#15803d", "ag", 5, False); tx(799, 580, t["res"], 13, fill="#15803d", bold=False)
    line("M1020 538 V400 H642", g, "am"); tx(1030, 470, t["buy"], 13, "start", g, bold=False)
    y = 730
    o.append(f'<line x1="40" y1="{y}" x2="80" y2="{y}" stroke="#c2410c" stroke-width="5"/>'); tx(90, y+5, [t["l1"]], 13, "start", bold=False)
    o.append(f'<line x1="440" y1="{y}" x2="480" y2="{y}" stroke="#15803d" stroke-width="5"/>'); tx(490, y+5, [t["l2"]], 13, "start", bold=False)
    o.append(f'<line x1="600" y1="{y}" x2="640" y2="{y}" stroke="{g}" stroke-width="2.5" stroke-dasharray="7 5"/>'); tx(650, y+5, [t["l3"]], 13, "start", bold=False)
    tx(40, 760, [t["note"]], 12, "start", g, bold=False)
    o.append('</svg>')
    return "\n".join(o)

for l in T:
    with open(os.path.join(OUT, f"dsp-connector-{l}.svg"), "w") as f:
        f.write(gen(l))
