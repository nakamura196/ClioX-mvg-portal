#!/usr/bin/env python3
"""Generate src/public/dsp/dsp-connector-{en,ja}.svg. Run: python3 scripts/dsp-diagram.py

Three columns: users (left) | the two portals (middle) | DSP providers (right).
Arrow styles: indigo solid = DSP, orange thick = file data, green = results,
grey dashed = a person's request or metadata, grey dotted = Cloudflare Access login (staff).
"""
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "public", "dsp")
T = {
'en': dict(
 h_users="Users", h_portals="Two portals (entry points)", h_prov="DSP providers",
 cons=["Consumer", "researcher, student"],
 staff=["Provider's staff", "checks own files"],
 ds=["ds.ldas.jp", "catalog of the DSP providers,", "contract, yen payment (pay.ldas.jp)", "login: LDAS ID (VC), no wallet"],
 portal=["cliox.ldas.jp", "Clio-X portal (Ocean)", "buy, start compute", "needs a wallet"],
 op=["Clio-X operator", "consumer side for the node", "compute only,", "no redistribution"],
 node=["Ocean node", "no DSP, holds no dataset", "fetch → run isolated", "→ return results only"],
 pa=["news-a, yanesen", "ldas-dsp provider nodes", "control + data plane in one"],
 pb="Clio-X data provider",
 cp=["Control plane (planned)", "cliox-dsp.ldas.jp, ldas-dsp", "catalog, ODRL, contract"],
 dp=["Data plane (live)", "cliox-files.ldas.jp", "behind Cloudflare Access", "no negotiation"],
 a_ds=["browse, contract,", "view / download"], a_cx=["buy,", "start compute"],
 a_dsp=["DSP, on every", "request"], a_dsp2=["DSP"], a_once=["once:", "DSP contract"],
 a_cred=["credential", "→ DDO"], a_ddo=["DDO: URL + headers", "(encrypted)"],
 a_file=["file, per job", "(Access service token)"], a_res=["results only"],
 a_direct="(1) data straight from the provider: DSP data plane, short-lived pass after a contract on ds.ldas.jp (news-a: 20 min)",
 a_staff="(2) Cloudflare Access email login: the provider's own staff only (admin, not a consumer path)",
 l1="File data", l2="Results only", l3="DSP", l4="Request, metadata", l5="Access login (staff)",
 note="ds.ldas.jp talks DSP to the providers on every request. cliox.ldas.jp does not: the Ocean node fetches from the data plane per job; DSP is used once, for the node's contract.",
 font="-apple-system,Segoe UI,Helvetica,Arial,sans-serif"),
'ja': dict(
 h_users="利用者", h_portals="2 つのポータル（入口）", h_prov="DSP の提供者",
 cons=["利用者", "研究者・学生"],
 staff=["提供者の担当者", "自分のファイルを確認"],
 ds=["ds.ldas.jp", "DSP の提供者のカタログ、", "契約、円での支払い（pay.ldas.jp）", "ログイン: LDAS ID（VC）、財布不要"],
 portal=["cliox.ldas.jp", "Clio-X ポータル（Ocean）", "購入・計算の開始", "財布が要る"],
 op=["Clio-X の運営者", "ノードのための利用者側", "計算だけ、", "再配布はしない"],
 node=["Ocean ノード", "DSP なし・データは持たない", "取得 → 隔離して実行", "→ 結果だけを返す"],
 pa=["news-a、yanesen", "ldas-dsp の提供者ノード", "制御とデータの面が一体"],
 pb="Clio-X のデータの提供者",
 cp=["制御の面（計画中）", "cliox-dsp.ldas.jp、ldas-dsp", "カタログ・ODRL・契約"],
 dp=["データの面（稼働中）", "cliox-files.ldas.jp", "Cloudflare Access が守る", "交渉はしない"],
 a_ds=["カタログを見る・契約・", "閲覧 / ダウンロード"], a_cx=["購入・", "計算の開始"],
 a_dsp=["DSP、依頼の", "たびに"], a_dsp2=["DSP"], a_once=["1 回だけ", "DSP で契約"],
 a_cred=["認証情報", "→ DDO"], a_ddo=["DDO: URL とヘッダー", "（暗号化）"],
 a_file=["ファイル、ジョブごと", "（Access のサービストークン）"], a_res=["結果だけ"],
 a_direct="(1) 提供者から直接データ: DSP のデータの受け渡し。ds.ldas.jp で契約した後の短期の通行証（news-a は 20 分）",
 a_staff="(2) Cloudflare Access のメールでのログイン: 提供者自身の担当者だけ（管理用。利用者の道ではない）",
 l1="ファイルのデータ", l2="結果だけ", l3="DSP", l4="依頼・メタデータ", l5="Access のログイン（担当者）",
 note="ds.ldas.jp は依頼のたびに DSP で提供者とやり取りする。cliox.ldas.jp は DSP を話さず、Ocean ノードがジョブごとにデータの面から取得する。DSP はノードの契約で 1 回だけ。",
 font="Hiragino Sans,Noto Sans JP,Yu Gothic,sans-serif"),
}
W, H = 1200, 860
INK, GREY, IND, ORA, GRN = "#1b2430", "#475569", "#4f46e5", "#c2410c", "#15803d"


def gen(l):
    t = T[l]; o = []

    def tx(x, y, lines, size=14, anchor="middle", fill=INK, lh=20, bold=True):
        if isinstance(lines, str):
            lines = [lines]
        for i, s in enumerate(lines):
            b = bold and i == 0
            o.append(f'<text x="{x}" y="{y+i*lh}" text-anchor="{anchor}" font-size="{size+2 if b else size}" font-weight="{600 if b else 400}" fill="{fill}">{s}</text>')

    def box(x, y, w, h, fill, stroke, dash=""):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"{d}/>')

    def line(d, c, m, w=2.5, dash="", start=False):
        ds = f' stroke-dasharray="{dash}"' if dash else ''
        ms = f' marker-start="url(#{m}s)"' if start else ''
        o.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" marker-end="url(#{m})"{ms}{ds}/>')

    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{t["font"]}" role="img" aria-label="{t["h_users"]} | {t["h_portals"]} | {t["h_prov"]}">')
    marks = [("am", GREY), ("ah", ORA), ("ag", GRN), ("ai", IND)]
    o.append('<defs>' + ''.join(
        f'<marker id="{n}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="{c}"/></marker>'
        f'<marker id="{n}s" viewBox="0 0 10 10" refX="1" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M10 0L0 5L10 10z" fill="{c}"/></marker>'
        for n, c in marks) + '</defs>')
    o.append(f'<rect width="{W}" height="{H}" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>')

    # column backgrounds and headings
    for x, w, h in [(20, 250, t["h_users"]), (300, 530, t["h_portals"]), (860, 320, t["h_prov"])]:
        o.append(f'<rect x="{x}" y="70" width="{w}" height="660" rx="10" fill="#ffffff" stroke="#e2e8f0"/>')
        tx(x + w / 2, 96, h, 14, fill="#334155")

    # left: users
    box(40, 160, 160, 220, "#f1f5f9", GREY); tx(120, 262, t["cons"], 14, lh=22)
    box(40, 600, 200, 80, "#f1f5f9", GREY); tx(140, 632, t["staff"], 14, lh=22)

    # middle: portals, operator, node
    box(330, 120, 470, 120, "#ecfeff", "#0e7490"); tx(565, 148, t["ds"], 13, lh=22)
    box(330, 300, 220, 120, "#ecfeff", "#0e7490"); tx(440, 328, t["portal"], 13, lh=22)
    box(610, 300, 190, 120, "#eef2ff", "#6366f1"); tx(705, 328, t["op"], 13, lh=22)
    box(330, 500, 300, 120, "#f0fdf4", GRN); tx(480, 530, t["node"], 13, lh=22)

    # right: providers
    box(880, 120, 280, 120, "#eef2ff", "#6366f1"); tx(1020, 152, t["pa"], 13, lh=24)
    o.append(f'<rect x="872" y="270" width="296" height="350" rx="12" fill="#faf5ff" stroke="#7c3aed" stroke-width="2"/>')
    tx(1020, 294, t["pb"], 14, fill="#5b21b6")
    box(890, 310, 260, 100, "#eef2ff", "#6366f1", "6 4"); tx(1020, 336, t["cp"], 13, lh=22)
    box(890, 470, 260, 130, "#fff7ed", ORA); tx(1020, 498, t["dp"], 13, lh=24)

    # consumer -> both portals (same style)
    line("M202 200 H328", GREY, "am", dash="7 5"); tx(208, 220, t["a_ds"], 11, "start", GREY, 14, False)
    line("M202 340 H328", GREY, "am", dash="7 5"); tx(208, 360, t["a_cx"], 11, "start", GREY, 14, False)
    # ds.ldas.jp <-> providers: DSP on every request
    line("M802 160 H878", IND, "ai", 3, start=True); tx(840, 138, t["a_dsp"], 11, fill=IND, lh=13, bold=False)
    line("M802 215 H840 V330 H888", IND, "ai", 3, start=True); tx(846, 262, t["a_dsp2"], 11, "start", IND, bold=False)
    # operator <-> control plane: once
    line("M802 380 H888", IND, "ai", 3, start=True); tx(836, 400, t["a_once"], 11, fill=IND, lh=14, bold=False)
    # operator -> cliox portal: credential into DDO
    line("M608 360 H552", GREY, "am", dash="7 5"); tx(580, 338, t["a_cred"], 11, fill=GREY, lh=13, bold=False)
    # portal -> node: DDO
    line("M420 422 V498", GREY, "am", dash="7 5"); tx(430, 452, t["a_ddo"], 11, "start", GREY, 14, False)
    # data plane -> node: file per job
    line("M888 540 H632", ORA, "ah", 5); tx(760, 568, t["a_file"], 11, fill=ORA, lh=14, bold=False)
    # node -> consumer: results only
    line("M328 580 H120 V382", GRN, "ag", 5); tx(220, 572, t["a_res"], 12, fill=GRN, bold=False)
    # (1) consumer -> news-a data plane directly
    line("M60 158 V48 H1120 V118", ORA, "ah", 5); tx(140, 40, t["a_direct"], 12, "start", ORA, bold=False)
    # (2) staff -> data plane: Access email login
    line("M242 660 H300 V710 H1020 V602", GREY, "am", 2.5, "2 4"); tx(320, 700, t["a_staff"], 12, "start", GREY, bold=False)

    # legend
    y = 770
    items = [(ORA, 5, "", t["l1"]), (GRN, 5, "", t["l2"]), (IND, 3, "", t["l3"]), (GREY, 2.5, "7 5", t["l4"]), (GREY, 2.5, "2 4", t["l5"])]
    x = 40
    for c, w, d, label in items:
        ds = f' stroke-dasharray="{d}"' if d else ''
        o.append(f'<line x1="{x}" y1="{y}" x2="{x+36}" y2="{y}" stroke="{c}" stroke-width="{w}"{ds}/>')
        tx(x + 44, y + 5, label, 12, "start", bold=False)
        x += 44 + len(label) * (7 if l == 'en' else 13) + 40
    tx(40, 816, t["note"], 12, "start", GREY, bold=False)
    o.append('</svg>')
    return "\n".join(o)


for l in T:
    with open(os.path.join(OUT, f"dsp-connector-{l}.svg"), "w") as f:
        f.write(gen(l))
