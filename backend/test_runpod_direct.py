import os
import time
from pathlib import Path
from dotenv import load_dotenv
import httpx
import json

load_dotenv(Path(__file__).parent / ".env")

base_url = os.getenv("DEEPSEEK_BASE_URL", "").rstrip("/")
api_key = os.getenv("DEEPSEEK_API_KEY", "")
model = os.getenv("DEEPSEEK_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

prompt = """
Generate a formal Malaysian SME grant application justification in JSON format.
Company: Nusantara Retail Solutions Sdn Bhd (Services, 8 FTEs, Turnover: RM 480k)
Grant: MDEC MSME Digital Grant
Expenditure: CloudTech e-Invoicing POS & ERP (RM 10,000)

Return JSON with exact keys:
{
  "projectTitle": "title",
  "transformationJustification": "2 sentences",
  "roiAndProductivityProjections": "2 sentences",
  "marketOrExportReadiness": ""
}
"""

payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "You are a Malaysian grant consultant. Return JSON with the exact requested keys."},
        {"role": "user", "content": prompt}
    ],
    "temperature": 0.3,
    "max_tokens": 1200
}

start_time = time.time()
print("Sending request to RunPod with max_tokens=1200...")
with httpx.Client(timeout=180.0) as client:
    res = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
    elapsed = time.time() - start_time
    print(f"Elapsed time: {elapsed:.2f} seconds")
    print(f"Status Code: {res.status_code}")
    print("Content:")
    data = res.json()
    print(data["choices"][0]["message"]["content"])
