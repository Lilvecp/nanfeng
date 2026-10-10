import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["NANFENG_DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["NANFENG_AGENT_TOKEN"] = ""
os.environ["NANFENG_QUANT_URL"] = "http://127.0.0.1:9"  # nothing listens: proxy must answer 503

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import seed  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import approvals  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        with SessionLocal() as db:
            seed.reset(db)
        approvals._kill_switch["on"] = False
        yield c
