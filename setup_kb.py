import os
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Put approved files (PDF, PPTX, DOCX, TXT, MD) in ./knowledge_base first.
# Run this script once to create and populate the hosted document index.

ROOT = Path(__file__).parent
KB_DIR = ROOT / "knowledge_base"
ALLOWED = {".pdf", ".pptx", ".docx", ".txt", ".md"}

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    raise SystemExit(
        "Set OPENAI_API_KEY (in the environment or a .env file) before running this script."
    )

files = [p for p in KB_DIR.rglob("*") if p.is_file() and p.suffix.lower() in ALLOWED]
if not files:
    raise SystemExit(
        "No supported files found. Add PDF/PPTX/DOCX/TXT/MD files to the knowledge_base folder."
    )

from openai import OpenAI

client = OpenAI(api_key=api_key)
store = client.vector_stores.create(name="InBody Approved Knowledge Base")
print("Created vector store:", store.id)

for path in files:
    print("Uploading:", path.name)
    with path.open("rb") as f:
        uploaded = client.files.create(file=f, purpose="assistants")
    client.vector_stores.files.create(vector_store_id=store.id, file_id=uploaded.id)

# Wait for indexing to finish.
deadline = time.time() + 900
while time.time() < deadline:
    items = client.vector_stores.files.list(vector_store_id=store.id)
    statuses = [(item.id, item.status) for item in items.data]
    print("Index status:", statuses)
    if statuses and all(status == "completed" for _, status in statuses):
        break
    if any(status == "failed" for _, status in statuses):
        raise SystemExit("At least one file failed to index. Check file format/content and retry.")
    time.sleep(3)
else:
    raise SystemExit(
        "Timed out while waiting for indexing. Check the vector store in your API dashboard."
    )

print("")
print("SUCCESS. Add these to your .env file:")
print("VECTOR_STORE_ID=" + store.id)
print("OPENAI_API_KEY=your-api-key")
print("")
print("Do not commit your API key or .env to Git.")
