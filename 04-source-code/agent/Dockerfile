FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY pyproject.toml ./
COPY nanfeng_agent ./nanfeng_agent
RUN pip install --no-cache-dir ".[service]"

RUN useradd --create-home nanfeng
USER nanfeng

EXPOSE 8200
CMD ["uvicorn", "nanfeng_agent.service:app", "--host", "0.0.0.0", "--port", "8200"]
