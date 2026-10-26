# IB_Chatbot - InBody Knowledge Assistant

A lightweight, **document-grounded** AI chatbot that answers questions strictly from the approved InBody knowledge base, and can be dropped onto **any website** with a single `<script>` tag.

- **Grounded answers** - replies only from the approved InBody documents (OpenAI file-search). No web search, no guessing.
- **Embeddable** - one `widget.js` renders a floating chat bubble on any page, isolated in a Shadow DOM so it never breaks the host site.
- **Secure** - the OpenAI API key stays server-side; optional shared token + rate limiting.
- **Source citations** - shows which documents backed each answer.

> Built as a website widget. This replaces the earlier Streamlit MVP (which was single-user and not embeddable).

---

## ⏱️ Quick start (under 30 minutes)

### 0. Prerequisites

- Python **3.10+**
- Git
- An **OpenAI API key** (https://platform.openai.com)
- 2-5 **approved** InBody documents (PDF, PPTX, DOCX, TXT, or MD)

### 1. Clone & install

```bash
git clone https://github.com/s42962915-png/IB_Chatbot.git
cd IB_Chatbot
python -m venv .venv
```

Activate the environment:
- **Windows:** `.venv\Scripts\activate`
- **macOS/Linux:** `source .venv/bin/activate`

```bash
pip install -r requirements.txt
```

### 2. Configure secrets

```bash
# Windows PowerShell
Copy-Item .env.example .env
notepad .env
```

Edit `.env` and set at minimum:

```env
OPENAI_API_KEY=sk-your-key-here
```

### 3. Build the knowledge base

1. Drop your approved InBody documents into the `knowledge_base/` folder.
2. Run the one-time indexing script:

```bash
python setup_kb.py
```

3. Wait until every file shows `completed`, then copy the printed `vs_...` ID into `.env`:

```env
VECTOR_STORE_ID=vs_your_vector_store_id
```

### 4. Run & test

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

Open:
- http://localhost:8000/demo - try the chat widget
- http://localhost:8000/health - should show `"configured": true`

### 5. Embed on any website

Add one line to any page (swap in your deployed URL):

```html
<script src="https://your-host/widget.js" defer></script>
```

That's it. Done in under 30 minutes.

---

## How it works

```text
Browser (any website)          Your server (FastAPI)              OpenAI
  [widget.js]  --POST /api/chat-->  app.py  --file_search-->  vector store
       ^                            |                            (approved docs)
       +---------- answer + sources <-------------------------------+
```

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | POST | Grounded chat. Body: `{ messages: [...], token }`. Returns `{ answer, sources, configured }`. |
| `/widget.js` | GET | The embeddable widget. |
| `/demo` | GET | Example page with the widget. |
| `/health` | GET | Configuration status. |
| `/` | GET | Landing page with embed instructions. |

---

## Embedding & configuration

Configure the widget inline (optional) before the script tag:

```html
<script>
  window.InBodyChatConfig = {
    title: "InBody Assistant",
    primaryColor: "#0f6fc5",
    position: "right"         // 'right' | 'left'
  };
</script>
<script src="https://your-host/widget.js" defer></script>
```

| Option | Default | Description |
| --- | --- | --- |
| `apiUrl` | auto (script origin) | Base URL of your deployed backend. |
| `token` | `''` | Shared secret matching the server's `WIDGET_TOKEN`. |
| `title` | `InBody Assistant` | Chat header title. |
| `tagline` | `Answers from the approved InBody knowledge base` | Header subtitle. |
| `placeholder` | `Ask about an InBody model, feature, or specification...` | Input placeholder. |
| `greeting` | `Hi! Ask me anything about InBody products...` | First assistant message. |
| `position` | `right` | `right` or `left`. |
| `primaryColor` | `#0f6fc5` | Bubble/button accent colour. |
| `width` / `maxHeight` | `380` / `540` | Panel size (px). |
| `persist` | `true` | Remember the conversation (localStorage). |

Environment variables (in `.env`):

| Variable | Default | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | - | **Required.** OpenAI key. |
| `VECTOR_STORE_ID` | - | **Required.** From `setup_kb.py`. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Chat model. |
| `MAX_RESULTS` | `8` | Retrieval chunk count. |
| `WIDGET_TOKEN` | `''` | Optional shared secret the widget must send. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. |
| `RATE_LIMIT_PER_MINUTE` | `20` | Per-client rate limit. |
| `DEMO_MODE` | `false` | Return canned answers when unconfigured (for preview). |

---

## Deploying

Any host that runs Python works: Render, Railway, Fly.io, a VPS, Azure, etc.

1. Push this repo to GitHub (no secrets committed).
2. Set the environment variables above in your host's dashboard.
3. Start with: `uvicorn app:app --host 0.0.0.0 --port $PORT`.
4. Embed `https://your-host/widget.js` on your sites.

---

## Security checklist

- [x] API key and vector store ID are **server-side only** - the browser never sees them.
- [x] Optional `WIDGET_TOKEN` shared secret + basic rate limiting.
- [x] User text is HTML-escaped before rendering (no raw-HTML injection).
- [ ] **Before going live:** obtain company approval for uploading documents to OpenAI.
- [ ] Set `WIDGET_TOKEN` (and pass it in the widget config) when embedding on public sites.
- [ ] For private deployments, put the app behind your own authentication - a hard-to-guess URL is not access control.
- [ ] Scanned/image-only PDFs may need OCR before indexing.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/health` shows `"configured": false` | Set `OPENAI_API_KEY` and `VECTOR_STORE_ID` in `.env`, restart the server. |
| `setup_kb.py` says "No supported files found" | Add PDF/PPTX/DOCX/TXT/MD files to `knowledge_base/`. |
| A file shows `failed` during indexing | Re-check the file format/content and re-run. |
| Widget shows "assistant is unreachable" | Check the `apiUrl` (must point at your server) and CORS. |
| 401 errors | `WIDGET_TOKEN` is set but the widget isn't sending a matching `token`. |
| 429 errors | Rate limit hit - lower traffic or raise `RATE_LIMIT_PER_MINUTE`. |
| Answers look hallucinated | Grounding is not a guarantee; test with known-answer and missing-answer questions. |

---

## Project structure

```text
IB_Chatbot/
├── app.py              # FastAPI backend (chat API, widget, demo, health)
├── widget.js           # Embeddable chat widget (no build step)
├── demo.html           # Example embedding page
├── setup_kb.py         # One-time: index knowledge_base/ into OpenAI vector store
├── requirements.txt    # Python dependencies
├── .env.example        # Config template (copy to .env)
├── .gitignore          # Excludes .env and knowledge_base/ files
└── knowledge_base/     # Drop approved documents here (not committed)
```

---

## Validate before relying on it

1. Ask a question clearly answered in one catalogue - confirm the answer matches the source.
2. Ask for something **not** in the documents - confirm it declines to guess.
3. Compare two models - verify each claim.
4. Add conflicting document versions - confirm the conflict is surfaced, not silently resolved.
5. Test scanned or image-heavy files for extraction gaps.
