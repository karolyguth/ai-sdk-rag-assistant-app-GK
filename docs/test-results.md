# Test report

Developer testing of the Recipe Assistant: functional tests, search accuracy, the effect of the system prompt, tool usage, response times and memory use.

**Setup:** 2026-11-13, MacBook Pro (M2), Postgres 16 + pgvector in Docker, Next.js dev server.
**Data:** the 85 recipes of [jeffThompson/Recipes](https://github.com/jeffThompson/Recipes), one chunk per recipe, embedded with `text-embedding-3-small`.
**Search settings:** top 4 results, cosine similarity > 0.3.
**Chat model:** `gpt-5` unless stated otherwise.

## 1. Functional tests (API)

All endpoints were called with curl, including the edge cases. **18 / 18 passed.**

| Test | HTTP | Response |
|---|---|---|
| Upload valid `.md` | 201 | `{"fileName": "functional-test-pie.md", "status": "uploaded"}` |
| Upload valid `.txt` | 201 | `{"fileName": "functional-notes.txt", "status": "uploaded"}` |
| Upload same file again | 409 | `"functional-test-pie.md" is already in the knowledge base. Delete it first to upload it again.` |
| Upload `.pdf` | 400 | `Unsupported file type ".pdf". Allowed: .md, .txt.` |
| Upload empty file | 400 | `File is empty.` |
| Upload 1.1 MB file | 413 | `File is too large (1100000 bytes). Maximum: 1000000 bytes.` |
| Upload binary content | 400 | `File does not look like a text file.` |
| Upload without `file` field | 400 | `Missing "file" field.` |
| Process `.md` | 200 | `{"status": "processed", "chunkCount": 1}` |
| Process same document again | 200 | `{"status": "processed", "chunkCount": 1}`: old chunks replaced, no duplicates |
| Process `.txt` | 200 | `{"status": "processed", "chunkCount": 1}` |
| Process unknown id | 404 | `Document not found: nope` |
| Process without id | 400 | `Expected a JSON body: { "id": "<document id>" }.` |
| List documents | 200 | test recipe listed as `processed`, 1 chunk, difficulty `easy` |
| Delete document | 200 | `{"deleted": true}` |
| Delete same id again | 404 | `Document not found: …` |
| Delete unknown id | 404 | `Document not found: nope` |
| Chunks left after delete | – | 0 (`ON DELETE CASCADE`) |

The upload panel and the document list in the UI call the same endpoints. The seed script loaded all 85 recipes through the same service layer: 85 processed, 85 chunks, 0 failed, 6.3 s. A second run skipped all 85.

## 2. Search accuracy: the 5 test questions

The assignment's test questions are Hungarian, but the recipes are English. Each question was sent straight to the vector search, with no LLM involved, once in Hungarian and once as English keywords.

| Question | Hungarian query, top hits (similarity) | English query, top hits (similarity) |
|---|---|---|
| Chocolate dessert | Horseradish Soup (0.315) ❌ | Enchilada Sauce (0.349), Chile Colorado (0.324) – no chocolate dessert exists in the collection |
| Chicken breast fillet | **no result** ❌ | **Chicken Schnitzel (0.479)**, Halal Cart Chicken (0.457), Teriyaki Chicken (0.437) ✅ |
| Quick dinner | **no result** ❌ | Thin-Crust (and Quick) Pizza (0.43), Roasted Parsnips and Carrots (0.408) ✅ (weak) |
| Carbonara | Carnitas with Salsa Verde (0.309) ❌ | Homemade Pasta (0.474), Dad's Spaghetti Sauce (0.393) – no carbonara exists in the collection |
| Vegetarian main dishes | Vegetarian Chicken Salad (0.352), Vegetarian Pho (0.323) | Vegetarian Chicken Salad (0.477), Vegetarian Pho (0.455), Masala Green Beans (0.421), Sesame Tofu (0.405) ✅ |

**Finding:** the embedding model is multilingual, but a whole Hungarian sentence matched against English recipes scores too low. Two questions returned nothing, and two returned wrong recipes. Short English keywords score 0.1–0.15 higher and find the right recipes. This led to the rule *"always write the search query in English"* in the system prompt.

## 3. Effect of the system prompt

The same 5 Hungarian questions were sent through `/api/chat` with the original starter prompt and with the recipe assistant prompt.

| Question | Original prompt | Recipe assistant prompt |
|---|---|---|
| Chocolate dessert | 5 searches (mostly Hungarian) → *"Sorry, I don't know."* | Says there is no chocolate dessert in the collection; offers Diner-Style Pancakes, with chocolate ideas marked as general advice |
| Chicken breast fillet | 1 Hungarian search, 0 hits → *"Sorry, I don't know."* | Chicken Schnitzel, Teriyaki Chicken, Halal Cart Chicken, Massaman Curry |
| Quick dinner | 1 Hungarian search, 0 hits → *"Sorry, I don't know."* | Beef Tacos (15 min), Black Bean Enchiladas (15 min), Thai fried rice |
| Carbonara | 4 searches → *"Sorry, I don't know."* | Says there is no carbonara in the collection; offers Homemade Pasta, Dad's Spaghetti Sauce, Mac and Cheese |
| Vegetarian main dishes | 2 recipes | 5 recipes (Channa Masala, Aloo Matar, Tarka Dal, Phat Phrik Khing, Sesame Tofu) |

**Result:** 1 / 5 useful answers with the original prompt, 5 / 5 with the new one. The new prompt also answers in the user's language: Hungarian questions got Hungarian answers, while the searches stayed in English.

## 4. Final assistant: the 5 questions in English

These runs use the final code, after the fix described in section 7.

| Question | First text | Total | Searches | Recommended | Verdict |
|---|---|---|---|---|---|
| What dessert can I make with chocolate? | 25.8 s | 27.9 s | 3 | No chocolate dessert in the collection → Diner-Style Pancakes (+ chocolate chips, marked as a general tip); Enchilada Sauce flagged as savory | ✅ honest, grounded |
| What can I cook if I have chicken breast at home? | 18.4 s | 22.1 s | 2 | Chicken Schnitzel (uses breasts), Teriyaki Chicken, Halal Cart Chicken (thighs, breast works) | ✅ |
| Any quick dinner ideas? | 17.8 s | 20.5 s | 3 | Beef Tacos (15 min), Black Bean Enchiladas (15 min), Pad See Ew; Pad Thai with its 1 h soak mentioned | ✅ times from the recipe metadata |
| How do I make carbonara? | 20.6 s | 24.7 s | 3 | No carbonara in the collection → Homemade Pasta, Dad's Spaghetti Sauce; general technique marked as "not from our recipes" | ✅ / ⚠️ see section 8 |
| Which vegetarian main dishes do you recommend? | 24.8 s | 28.6 s | 3 | Channa Masala, Tarka Dal, Aloo Matar, Sesame Tofu, Phat Phrik Khing, with notes on non-vegetarian ingredients (chicken stock, shrimp paste) | ✅ |

## 5. Tool usage

- **Searched every time:** the model never answered a cooking question without searching first (0 of 20+ answers).
- **Reformulates when results are weak:** typically 2–3 searches per question, e.g. `chocolate dessert` → `brownies` → `chocolate`.
- **English queries only:** all queries were English, including for Hungarian questions.
- **`addResource` is selective:**
  - "Remember that I'm vegetarian." → `addResource({"content": "The user is vegetarian."})`.
  - Questions that only mention ingredients ("I have chicken breast at home") never triggered it.
- **Memory works across conversations:** after saving "The user is vegetarian" and starting a new conversation, "Any quick dinner ideas?" returned only vegetarian dishes (Vegetarian Chicken Salad, Masala Green Beans), and every search included "vegetarian".

## 6. Response times and model comparison

**Response time by request type:**

| Request type | Time |
|---|---|
| Vector search only (embedding call + SQL) | 0.17–0.8 s |
| Upload + process one recipe (one embedding call) | 0.8–1.8 s |
| Seed 85 recipes (5 in parallel) | 6.3 s |
| Chat answer, `gpt-5` | first text 18–26 s, total 20–29 s |
| Chat answer, `gpt-4o-mini` | first text 2–6 s, total 5–13 s |

**`gpt-5` vs `gpt-4o-mini`** (same 5 English questions; switched with `CHAT_MODEL`):

| | gpt-5 | gpt-4o-mini |
|---|---|---|
| Time to first text | 18–26 s | 2.0–5.7 s |
| Total time | 20–29 s | 5.0–12.8 s |
| Searches per question | 2–3, reformulated | always exactly 1 |
| Follows the format rules | yes (plain-text lists) | no (uses Markdown bold, which the prompt forbids) |
| Answer quality | grounded, reformulates weak searches, flags caveats | grounded, but weaker picks (e.g. "Thin-Crust Pizza, about 90 minutes" as a *quick* dinner) |

**Finding:** most of the response time is the LLM, not retrieval. gpt-5's reasoning makes it roughly 4–10× slower to start answering (2–5× in total time), but noticeably better at searching and following instructions. The UI shows a "Searching the recipes and thinking…" indicator during the wait. `gpt-4o-mini` is the better choice when speed matters more than answer quality.

## 7. Memory use and a bigger dataset

**Current data:** 87 chunks. The `embeddings` table is 1.0 MB, and the whole database 9.1 MB. The Postgres container uses 40 MiB of RAM, and the Next.js dev server 116 MB.

To simulate a bigger dataset, the real embeddings were copied into a temporary table, measured, and the table was dropped afterwards. The query was the same similarity search the app runs (an exact search over every row, with no vector index).

| Chunks | Table size | Search time (SQL only) | Postgres RAM |
|---|---|---|---|
| 87 (real) | 1.0 MB | 0.9 ms | 40 MiB |
| 870 | 7.2 MB | 7.2 ms | 54 MiB |
| 8,700 | 69 MB | 72–100 ms | 116 MiB |
| 34,800 | 278 MB | 372–380 ms | 183 MiB |

**Finding:** search time grows linearly, at about 11 µs per chunk. At the current size the database is negligible next to the LLM. At around 10,000+ chunks the search becomes as slow as the embedding call itself. That is the point where an approximate vector index (pgvector HNSW) would be worth adding.

## 8. Bugs found by testing, and limitations

**Found and fixed during testing:**

| Problem | Fix |
|---|---|
| Uploading the same file twice created duplicate search results | `POST /api/upload` returns 409 for an existing file name |
| The original prompt searched with the Hungarian sentence and found nothing | Rule: always search in English, answer in the user's language |
| With a saved preference, gpt-5 used all 6 steps on searches and returned an **empty answer** | The last step is reserved for the answer (`prepareStep` disables tools) |
| gpt-5 did not search for the saved preference, so "vegetarian" was ignored | Saved notes are loaded from the database into the system prompt on every request |
| `pnpm build` failed on 7 type errors in the starter's chat page | Tool parts narrowed with the AI SDK's `isToolUIPart` |

**Known limitations:**
- **Dataset gaps:** the collection has no chocolate dessert and no carbonara. The assistant says so honestly, but cannot answer those two test questions with a real recipe.
- **General advice:** for a missing dish, gpt-5 sometimes adds general cooking technique (e.g. how carbonara is made), clearly marked as "not from our recipes". This is allowed by the prompt's general-advice rule, but stretches the "don't write missing recipes" rule.
- **Latency:** with gpt-5, answers take 20–30 s.
- **Notes compete with recipes:** a saved note can also show up as a search hit and take one of the 4 result slots.
- **Approximate metadata:** difficulty is based only on the number of steps, and the prep time takes the first time value (e.g. "Marinate 1–4 hours, then 45 minutes" → 60 min).

## How to reproduce

- **Functional tests:** the curl commands in the README's API section, plus the edge cases from the table in section 1.
- **Timings:** every chat answer writes a line like the following (wrapped here; it is one line in the log) to the server log (`pnpm dev` terminal, or `docker compose logs web`):
  ```
  [chat] model=gpt-5 firstToken=18383ms total=22121ms steps=3 tokens=…in/…out
    question="…" tools=[getInformation({"question":"chicken breast recipes quick dinner"}), …]
  ```
- **Model comparison:** set `CHAT_MODEL=gpt-4o-mini` in `.env` and restart the server.
