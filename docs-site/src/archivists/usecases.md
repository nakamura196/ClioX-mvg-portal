# The Visualizations and Chatbot pages

The Clio-X portal has a **Use cases** menu with two pages.
Both show the result of an analysis of a set of records in a form you can read.

- **Visualizations** (`/usecases/visualizations`): the words that occur most, how many documents there are per date, and how the tone of the writing changes over time.
- **Chatbot** (`/usecases/chatbot`): ask a question about the records and get an answer built from passages of them, with the documents it came from.

## Before you start

**Neither page reads the records itself.**
First an analysis runs where the records are (a compute job), and then you load its result into the page:

1. On the record's page, choose the prepared analysis and start it. The records do not leave the institution.
2. Wait for it to finish. For the sample below this takes less than a minute.
3. Open Visualizations or Chatbot and **add** the finished analysis.

The pages list **only the analyses started from your own wallet**.
You cannot see results of analyses other people ran.

## What Visualizations shows

| Chart              | What it tells you                                             |
| ------------------ | ------------------------------------------------------------- |
| Word cloud         | The words that occur most; the bigger, the more often         |
| Documents per date | Which periods have the most documents                         |
| Tone over time     | For each date, whether the writing leans positive or negative |
| Summary            | Number of documents and words, date range, and so on          |

The date charts appear only when the documents carry dates.
They suit dated series: correspondence, diaries, minutes, newspapers.

**Treat the tone chart as a rough indication.** It counts words from a short list; it is not a validated method.
Read the documents themselves before relying on it in research.

## What happens with the Chatbot

The Chatbot needs "knowledge" first.
An analysis cuts the records into **passages** of a few hundred words, and those passages are handed to a chat service.
For each question it picks the four passages closest to the question and answers from those alone.

This is the important difference from Visualizations.
**The result of a visualization is counts and words; preparing the Chatbot sends pieces of the text itself out of the institution.**
The passages reach the browser and the chat service.
Use it only for records that may be published or quoted.

Answers are limited to what the chosen passages say.
If nothing matches, it says it found nothing.
A language model can still be wrong: open the source documents listed with the answer and check.

## The sample on the trial site

The trial site has a sample: **The Federalist Papers** (1787–1788, 85 essays), newspaper essays arguing for ratifying the US Constitution.
They are in the public domain and each essay has a publication date, so every chart has something to show.

- Records: [The Federalist Papers (1787-1788), 85 essays](https://cliox.ldas.jp/asset/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c)
- Analysis for Visualizations: [Text analysis for the Visualizations page](https://cliox.ldas.jp/asset/did:op:83879b6695a4aae100753eff91487feafe82d8cf7cbd679afaad9654c1c0f09b)
- Analysis for the Chatbot: [Knowledge passages for the Chatbot page](https://cliox.ldas.jp/asset/did:op:4178768987eb40f3639ca75bb17fa7efd41476cbd957379dde54c6bc6d1b326f)

While preparing the sample we checked each essay's date against the weekday printed with it.
This found one error in the Project Gutenberg text:
No. 26 is dated "Saturday, December 22, 1788", but that day was a Monday.
The essay appeared on Saturday, 22 December 1787.

::: info As of 27 September 2026
The sample records, both analyses and the portal fix are on the trial site.
The chatbot answered questions about the essays there: asked what Madison says about factions, it quoted No. 10 and named it (about 25 seconds).
Two things to know:

- A page shows only analyses you started **on the trial site, in the same browser**. Start the analysis from the record's page, then open the Visualizations or Chatbot page.
- The chatbot finds passages by matching words. Ask in the language of the records (English for this sample). When it finds nothing, it says so rather than guessing.
  :::

## In Clio-X itself

In Clio-X proper (on the Pontus-X network), the portal already names these projects:

- Visualizations: an email collection (_Email Text_) and the _Cameroon Gazette_
- Chatbot: Cameroon, InterPARES, and the University of Lleida (UdL)

On the trial site the sample appears under _Email Text_, with the chart title "Email Count Over Time", because the page is used unchanged from Clio-X.

## More detail

How it works, how the chat service is built, and how to set it up on your own server: [Visualizations and Chatbot](/developers/usecases) for developers.
