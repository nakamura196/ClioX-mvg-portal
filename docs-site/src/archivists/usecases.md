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

## Step by step on the trial site

This section walks through the screens one at a time, for a first visit.
From starting the analysis to seeing the charts can take up to an hour (step 2 explains why).

### What you need

- A browser on a computer (Chrome, for example) with the **MetaMask** extension (a wallet).
- MetaMask switched to the **Sepolia** network. Sepolia is a test network; no real money is involved.
- An address that is **allowed to run analyses**. Only a few addresses are allowed for now; with any other address the order button stays disabled. If you would like to try, contact the author of this site.

### Japanese screens

The trial site opens in English.
Switch with "EN / 日本語" at the top right, or add `ja/` after `cliox.ldas.jp/` in the address.
The Visualizations and Chatbot pages themselves are still in English.

### 1. Start the analysis

1. Open the records' page: [The Federalist Papers (1787-1788), 85 essays](https://cliox.ldas.jp/asset/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c)
2. Connect MetaMask with the button at the top right.
3. Under "Select a Compute Environment", choose the environment shown (there is only one).
4. Under "Select an algorithm to start a compute job", pick **Text analysis for the Visualizations page**.
   For the Chatbot, pick **Knowledge passages for the Chatbot page** here instead.
5. Check that the page says "You can order this Compute Job for free".
6. Tick the two agreement boxes (portal terms and the asset's licence).
7. Press **Order Compute Job**. When MetaMask asks for a signature, approve it. Signing costs nothing.
8. "Your Compute job started." means it is running.

### 2. Wait for it to finish

The job's status appears lower on the same page.
It moves roughly through:

"Job queued" → "Pulling algorithm image" → "Running algorithm" → "Publishing results" → "Job settling" → "Job finished"

The analysis itself takes less than a minute.
After that it **stays at "Job settling" for up to 5 minutes**.
Nothing is wrong.
The service settles payments every 5 minutes and marks jobs finished only then; free analyses wait for that run too.
You may close the page meanwhile. Come back later **in the same browser**.

### 3. Load it into Visualizations

1. When the status is "Job finished", open the [Visualizations page](https://cliox.ldas.jp/usecases/visualizations). Keep MetaMask on the address you started the analysis with.
2. Under "Projects" on the left, choose **Email Text** (the name comes unchanged from Clio-X).
3. The finished analysis appears in the "Compute Jobs" table. If it does not, press **Refresh**.
4. Press **Add**. MetaMask asks for another signature, to hand you the result. Approve it.
5. The charts appear below.

### 4. Ask the Chatbot

1. Start an analysis with **Knowledge passages for the Chatbot page** (step 1) and wait for it to finish (step 2).
2. Open the [Chatbot page](https://cliox.ldas.jp/usecases/chatbot) and choose **Trial samples (Sepolia)** on the left.
3. Add the finished analysis (approve the MetaMask signature).
4. Ask **in English**. The records are in English, so a question in another language matches no words and finds nothing.
   For example: _What does Madison say about factions?_

### If the table stays empty ("No results found")

- **Is the job still at "Job settling"?** Check the status on the records' page. It is not listed until it is finished.
- **Are you on a different address or browser from the one you started with?** Only analyses started on the trial site, from the same browser, with the same address, are listed.
- **Is MetaMask on Sepolia?**

::: info As of 30 September 2026
The sample records, both analyses and the portal fix are on the trial site.
The chatbot answered questions about the essays there: asked what Madison says about factions, it quoted No. 10 and named it (about 25 seconds).
Starting an analysis from the screen was also checked (it finished in 13 seconds, then waited at "Job settling" for the settlement run, which was hourly then and every 5 minutes since 30 September).
On 30 September the finished job was added on the Visualizations page: after one MetaMask signature, all four charts appeared (dates from November 1787 to May 1788; the word cloud led by "government", "states", "people", "power").
:::

## In Clio-X itself

In Clio-X proper (on the Pontus-X network), the portal already names these projects:

- Visualizations: an email collection (_Email Text_) and the _Cameroon Gazette_
- Chatbot: Cameroon, InterPARES, and the University of Lleida (UdL)

On the trial site the sample appears under _Email Text_, with the chart title "Email Count Over Time", because the page is used unchanged from Clio-X.

## More detail

How it works, how the chat service is built, and how to set it up on your own server: [Visualizations and Chatbot](/developers/usecases) for developers.
