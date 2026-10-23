# RunPod

SME GrantFlow uses RunPod as its **GPU inference tier**. There is no custom `handler.py`: the endpoint is a
RunPod Serverless **vLLM worker**, which exposes an OpenAI-compatible API, so the backend calls it directly.

| Item | Value |
| ---- | ----- |
| Model | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` (`RUNPOD_MODEL`) |
| Call | `POST {RUNPOD_BASE_URL}/chat/completions` with `Authorization: Bearer $RUNPOD_API_KEY` |
| Used for | Parsing unstructured invoice text and drafting grant justification narratives |
| Client code | `_dispatch_chat_completion()` in `backend/app/services/llm_service.py` |

Quantitative eligibility (equity, tenure, size caps, amounts) is never sent to a model. It is decided by the
deterministic rules in `backend/app/rules/`.

<!-- TODO(team): add the endpoint's worker image, GPU type, min/max workers and idle timeout from the RunPod console. -->
