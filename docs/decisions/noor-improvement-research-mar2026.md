# Noor Improvement Research — March 2026

Research-only evaluation across 6 areas. No code changes.

---

## 1. LLM Choice

**Current: Gemini 2.5 Pro ($1.25/M in, $10/M out)**

| Model | Input $/M | Output $/M | Tool Calling | Hinglish | Notes |
|-------|-----------|------------|-------------|----------|-------|
| Gemini 2.5 Pro | $1.25 | $10.00 | Good | Good multilingual, Hindi native support | Current choice, solid all-rounder |
| **Gemini 2.5 Flash** | **$0.30** | **$2.50** | Good | Same multilingual stack | **4x cheaper, 1M context, recommended swap** |
| Claude Sonnet 4 | ~$3 | ~$15 | Best-in-class agentic | Weaker on Indic languages | Overkill for chat; best for complex tool chains |
| GPT-4.1 | ~$2 | ~$8 | Good | Decent Hindi | Middle ground, no clear advantage |

**Recommendation: Switch to Gemini 2.5 Flash (Priority: HIGH)**
- 4x cost reduction with same tool calling and multilingual stack
- 1M token context window (vs 200K for Pro)
- Same native Hindi/multilingual support from Google's training data
- Reserve Pro for future complex reasoning tasks only

**On Hinglish specifically:** Research (LREC 2026, ACL 2025) shows all major LLMs still struggle with code-switched text vs monolingual. Google models have an edge on Indic languages due to training data volume. No model is definitively "best" at Hinglish — quality depends more on system prompt engineering than model choice.

---

## 2. Memory Architecture

**Current: Flat table, 5 categories, 200-row limit, 5000-word cap, no semantic search**

### pgvector Embeddings — Worth Adding (Priority: MEDIUM)

- Neon Postgres already supports pgvector (no new infra)
- Enables semantic recall: "what moisturizer did she like?" retrieves relevant memories even without exact keyword match
- Embedding cost is negligible (~$0.02/M tokens with text-embedding-3-small)
- Implementation: Add a `vector(1536)` column to memories table, embed on save, cosine similarity on recall

### Memory Framework Comparison

| Framework | Architecture | LoCoMo Score | Fit for Noor |
|-----------|-------------|-------------|--------------|
| **Current (flat table)** | Simple SQL queries | N/A | Works but no semantic recall |
| **Mem0** | Bolt-on memory layer, passive extraction | 67% | Good fit — similar to current approach but with embeddings + graph |
| **Letta (MemGPT)** | Full agent runtime, 3-tier memory (core/recall/archival) | 74% | Overkill — requires rearchitecting the entire agent |
| **Zep** | Managed memory service | ~65% | Adds vendor dependency |

**Recommendation: Add pgvector to existing table + adopt Mem0-style extraction (Priority: MEDIUM)**
- Don't migrate to Mem0/Letta — too much architectural change for marginal gain
- Add vector column to existing memories table
- Use embedding similarity for recall instead of category-based SQL
- Keep the 200-row limit but make it per-category (40 per category) with LRU eviction
- 5000-word cap is reasonable; no change needed

---

## 3. Safety Net Evolution

**Current: Regex-based post-hoc fact extraction**

### DistilBERT Classifier Option

Research confirms DistilBERT fine-tuned on Hinglish code-mixed data significantly outperforms regex for:
- Preference detection ("mujhe ye pasand nahi")
- Sentiment/context signals
- Intent classification

**However, deployment cost matters:**
- DistilBERT needs a GPU or CPU inference endpoint (~$15-30/month minimum)
- Cold start on serverless = 2-5s latency (bad for Telegram UX)
- Regex is free, instant, and good enough for structured patterns

**Recommendation: Hybrid approach (Priority: LOW)**
- Keep regex for structured patterns (dates, product names, skin type mentions)
- Use the LLM itself (Gemini Flash) as the classifier — add a second lightweight prompt that extracts facts from each message
- This is cheaper than hosting DistilBERT and handles Hinglish natively
- Only consider dedicated classifier if extraction accuracy drops below 80%

---

## 4. Skincare Knowledge Sources

### Available APIs and Databases

| Source | Type | Access | Data |
|--------|------|--------|------|
| **Cosmethics API** | REST API | Paid, Europe's largest non-scraped DB | Ingredient labels, safety ratings |
| **skincareapi.dev** | REST API | Developer-friendly | 30K+ ingredients, safety ratings, allergen detection |
| **EU CosIng Database** | Open data | Free | Official EU cosmetic ingredient database |
| **EWG Skin Deep** | Web only | No public API, would need scraping | 130K products, 8.9K ingredients, hazard scores |
| **INCIDecoder** | Web only | No API | Comedogenic ratings, ingredient analysis |
| **CosDNA** | Web only | No API | Ingredient safety/irritancy scores |
| **Open Beauty Facts** | Open API | Free | Community-contributed product data |

**Recommendation (Priority: MEDIUM):**
1. Integrate **skincareapi.dev** as a tool — gives ingredient safety + comedogenic ratings via REST
2. Build a static lookup table from **CosIng** open data for INCI name resolution
3. Scrape and cache **INCIDecoder** comedogenic ratings (one-time, ~5K ingredients) into a local DB table
4. Add a `checkIngredient` tool to Noor's tool set that queries this data

---

## 5. User Experience & Retention

### Learnings from Wysa, Replika, Haptik

| App | Memory Strategy | Retention Insight |
|-----|----------------|-------------------|
| **Wysa** | Session-based, resets often (privacy-first) | FDA Breakthrough Device 2025; bond scores comparable to human CBT therapists within 5 days |
| **Replika** | Persistent memory, remembers name/conversations/triggers | Strongest relationship-building; ML-driven personalization |
| **Woebot** | Session-based, structured protocols | Clinical evidence strongest; less personal |

**Key findings for Noor:**
- **Replika's approach is closest to Noor's** — persistent memory + relationship building
- Wysa research shows users form therapeutic-level bonds within 5 days if the bot demonstrates recall
- A "more profound bond was considered necessary for alleviating loneliness" (Wysa study) — memory recall is the mechanism
- **Proactive memory surfacing** ("last time you mentioned your skin was dry during winters...") drives retention more than passive storage

**Recommendation (Priority: HIGH):**
- Add proactive memory callbacks in system prompt — instruct Noor to reference past conversations naturally
- Track "days since first interaction" and adjust intimacy/familiarity level
- Implement a "memory highlight" mechanism: periodically surface a relevant old memory in conversation

### Hinglish Code-Switching Research
- LREC 2026 paper confirms code-switching is an implicit cultural/ethnicity indicator
- ACL 2025 shows code-switching in training data is "key to multilingual capabilities"
- **Practical implication:** Noor should mirror the user's code-switching level, not force pure Hindi or English

---

## 6. Cycle-Skin Connection

### Clinical Evidence (Well-Established)

| Cycle Phase | Days | Hormones | Skin Behavior |
|-------------|------|----------|---------------|
| **Menstrual** | 1-5 | Low estrogen + progesterone | Dull, dry, sensitive; inflammation peaks |
| **Follicular** | 6-14 | Rising estrogen | Skin clears, barrier strengthens, glow returns |
| **Ovulatory** | 14-16 | Peak estrogen | Best skin days; plump, hydrated |
| **Luteal (early)** | 17-22 | Rising progesterone | Oil production increases, pores enlarge |
| **Luteal (late)** | 23-28 | Progesterone drops, androgens dominate | Acne flares (60-70% of women), max sebum |

### Datasets and APIs

**No dedicated cycle-skin API exists.** However:
- A 2025 ScienceDirect paper ("Menstrual cycle phases and acne flares: retrospective analysis in Indian women") provides India-specific clinical data
- British Journal of Dermatology global study (17,009 women) confirms skin condition changes with irregular cycles
- Google SCIN dataset (10K+ dermatology images) could support skin analysis features

**Recommendation (Priority: MEDIUM):**
1. **Build a static phase-skin mapping table** from clinical literature (the table above is a good start)
2. Encode this as a tool or system prompt context — when `getCycleContext` returns a phase, Noor gets the corresponding skin expectations
3. Add phase-specific skincare routine suggestions (e.g., "luteal phase = add salicylic acid, reduce heavy moisturizers")
4. Reference the Indian-specific study for culturally relevant advice

---

## Priority Summary

| # | Area | Priority | Effort | Impact | Status |
|---|------|----------|--------|--------|--------|
| 1 | Switch to Gemini 2.5 Flash | **HIGH** | Low (config change) | 4x cost reduction | **DEFERRED** — staying on Pro for stronger reasoning during behavior tuning |
| 5 | Proactive memory surfacing | **HIGH** | Low (prompt engineering) | Retention boost | **DONE** (2026-03-22) — added "tumne bataya tha" framing to v4 prompt |
| 6 | Cycle-skin phase mapping | **MEDIUM** | Low (static data + prompt) | More precise advice | **DONE** (2026-03-22) — enhanced cycle-utils.ts with 5-phase mapping + staleness safeguard |
| 2 | Add pgvector to memories | **MEDIUM** | Medium (schema + embed logic) | Better recall accuracy | **SKIPPED** — only 10 memories currently, revisit at 100+ per user |
| 4 | Integrate skincare ingredient API | **MEDIUM** | Medium (new tool) | Better product advice | **PARKED** — Indian brand coverage unverified (Mamaearth, Minimalist, Plum etc may not be in Western DBs). Verify skincareapi.dev coverage before implementing. Add as optional enrichment tool, not blocking. |
| 3 | Replace regex safety net | **LOW** | High (if DistilBERT) / Low (if LLM) | Marginal improvement | **DEFERRED** — regex expanded with preference patterns instead |

---

## Sources

- [Gemini 2.5 Flash vs Pro Pricing](https://langcopilot.com/gemini-2.5-flash-vs-gemini-2.5-pro-pricing)
- [March 2026 AI Model Showdown](https://medium.com/@techtidetv/gpt-5-4-vs-claude-sonnet-4-6-vs-gemini-3-1-pro-the-march-2026-ai-model-showdown-5c9e7dc4cf4b)
- [Mem0 vs Letta Comparison](https://vectorize.io/articles/mem0-vs-letta)
- [5 AI Memory Systems Benchmarked](https://dev.to/varun_pratapbhardwaj_b13/5-ai-agent-memory-systems-compared-mem0-zep-letta-supermemory-superlocalmemory-2026-benchmark-59p3)
- [Code-Switching as Bias Indicator (LREC 2026)](https://inria.hal.science/hal-05529786/)
- [Code-Switching for Multilingual Pre-Training (ACL 2025)](https://aclanthology.org/2025.findings-acl.575/)
- [Survey: Code-Switched NLP in LLM Era](https://arxiv.org/html/2510.07037v5)
- [DistilBERT for Hinglish Hate Speech](https://link.springer.com/article/10.1007/s43621-025-02190-w)
- [Cost-Aware Model Selection (2025)](https://arxiv.org/html/2602.06370)
- [Cosmethics API](https://cosmethics.com/api/)
- [skincareapi.dev](https://skincareapi.dev)
- [EWG Skin Deep Database](https://www.ewg.org/skindeep/)
- [INCIDecoder](https://incidecoder.com/)
- [pgvector 2026 Guide](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/)
- [Wysa Therapeutic Alliance Study](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2022.847991/full)
- [Wysa Clinical Evidence](https://www.wysa.com/clinical-evidence)
- [AI Companion Market 2025](https://mktclarity.com/blogs/news/ai-companion-market)
- [Menstrual Cycle & Acne in Indian Women (ScienceDirect 2025)](https://www.sciencedirect.com/science/article/pii/S2950306X2500041X)
- [Global Study: Skin & Irregular Cycles (BJD)](https://academic.oup.com/bjd/article/192/5/935/8008528)
- [Google SCIN Dermatology Dataset](https://github.com/google-research-datasets/scin)
