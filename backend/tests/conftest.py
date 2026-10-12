import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["NANFENG_DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["NANFENG_AGENT_TOKEN"] = ""
os.environ["NANFENG_ALLOW_OPEN_AGENT"] = "true"  # most tests call agent routes without a token
os.environ["NANFENG_ANCHOR_BACKEND"] = "local"  # a developer .env must not reach the tests
os.environ["NANFENG_QUANT_URL"] = "http://127.0.0.1:9"  # nothing listens: proxy must answer 503
os.environ["NANFENG_OWNER_PASSWORD"] = "test-owner-password"
os.environ["NANFENG_DEMO"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth, seed  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402


OWNER_PASSWORD = os.environ["NANFENG_OWNER_PASSWORD"]


@pytest.fixture()
def client():
    """Acts as the signed-in owner (the web cockpit). Agent calls pass their own Authorization header;
    anonymous calls pass {"Authorization": ""} or use the `anon` fixture."""
    with TestClient(app) as c:
        with SessionLocal() as db:
            seed.reset(db)
        auth._failures.clear()
        token = c.post("/auth/login", json={"password": OWNER_PASSWORD}).json()["token"]
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


@pytest.fixture()
def anon(client):
    """Same app and data, no credentials at all."""
    with TestClient(app) as c:
        yield c
