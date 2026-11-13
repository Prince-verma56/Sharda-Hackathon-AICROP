# AgriSmart inference service (CPU). Build context: repository root.
#   docker build -f ai/services/inference/Dockerfile -t agrismart-inference:local .
# The 344 MB checkpoint is NOT baked in: mount it read-only at /models/model.pt.
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    AGRISMART_MODEL_DIR=/opt/agrismart/model \
    AGRISMART_MODEL_PATH=/models/model.pt \
    AI_INFERENCE_DEVICE=cpu \
    AI_INFERENCE_ENABLE_DOCS=false \
    TORCH_HOME=/tmp/torch \
    HF_HOME=/tmp/hf

WORKDIR /opt/agrismart/service

# CPU-only PyTorch wheels (~200 MB instead of ~2.5 GB CUDA wheels).
RUN pip install torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu
COPY ai/services/inference/requirements.txt /tmp/requirements.txt
RUN grep -v -E '^(torch|torchvision|pytest|httpx)' /tmp/requirements.txt > /tmp/runtime.txt \
    && pip install -r /tmp/runtime.txt \
    && rm /tmp/requirements.txt /tmp/runtime.txt

# Model package: adapter, manifest and upstream evaluation only (no notebooks, datasets or weights).
COPY ai/models/agrismart-india/predict.py ai/models/agrismart-india/weights.json /opt/agrismart/model/
COPY ai/models/agrismart-india/scripts/download_weights.py /opt/agrismart/model/scripts/
COPY ai/models/agrismart-india/reports/upstream_evaluation.json /opt/agrismart/model/reports/
COPY ai/services/inference/app ./app

RUN useradd --system --uid 10001 --no-create-home agrismart
USER agrismart

EXPOSE 8001
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/ready', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
