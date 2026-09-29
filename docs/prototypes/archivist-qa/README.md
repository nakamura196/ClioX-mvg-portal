# Prototype (g): archivist Q&A

Branch `proto/archivist-qa`. One line: archivists ask about Clio-X in their own
words (ja/en) and get a prepared answer with its source shown. Nothing is
generated, so no answer can be made up.

- `/archivist-qa`, `/ja/archivist-qa`. No wallet, no backend, no LLM. Not linked
  from the menu yet (URL only).
- 20 prepared questions aimed at fear of IT ("Will I break something?", "Does it
  cost money?", "Do my records leave my institution?", "Can I delete what I
  published?", "Can others see what I accessed?"). Wording and facts follow
  prototype (a) glossary.
- Matching: BM25 in the browser over the prepared questions and the InterPARES
  Trust AI terminology already bundled for Resources (588 terms). Japanese uses
  character bigrams, no dictionary. Low match → "closest prepared question" note;
  no match → says so and offers 3 questions instead of guessing.
- InterPARES definitions are quoted in the English original with links to the
  site's glossary and to interparestrustai.org. Where InterPARES has no own
  definition (wallet, transaction, smart contract…) the page says so and quotes
  the cited outside definition.
- Every answer is badged by source: "Clio-X archivist guide (draft, not
  reviewed)" and/or "InterPARES Trust AI Terminology".
- Link to the existing RAG chatbot: the same text downloads as knowledge chunks
  in the format `@utils/chatbot` uploads (`toKnowledgeChunks`). Its backend
  (`CHATBOT_API_URL`, Ollama) is not available now, so this was not tried.
- Text in `content/archivistQa/{qa,ui}(.ja).json`; logic in
  `src/@utils/archivistQa/` (tests: 35 cases incl. 30 sample questions).

Files: `ja-start.png`, `ja-wallet.png`, `ja-wallet-and-term.png`,
`en-interpares-terms.png`, `ja-not-found.png`, `ja-phone.png`.

Open points: the 20 answers are Claude's drafts and need review by Vicki's
group. Japanese questions reach InterPARES only through 13 hand-made aliases
(来歴 → provenance etc.). Whether to add a generated (LLM) answer on top is a
decision for later; the prepared-answer version is the safe baseline.
