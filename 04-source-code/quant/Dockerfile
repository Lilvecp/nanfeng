FROM python:3.12-slim

WORKDIR /quant
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Editable install: the API finds data/ and results/ next to the package (ROOT = package/..)
COPY pyproject.toml ./
COPY nanfeng_quant ./nanfeng_quant
COPY api ./api
COPY data ./data
COPY results ./results
RUN pip install --no-cache-dir -e ".[api]"

RUN useradd --create-home nanfeng
USER nanfeng

EXPOSE 8100
# "::" listens on IPv4 and IPv6 (Railway's private network is IPv6)
CMD ["uvicorn", "nanfeng_quant.api:app", "--host", "::", "--port", "8100"]
