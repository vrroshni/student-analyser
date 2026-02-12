from __future__ import annotations

from sqlalchemy import text
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATABASE_URL = "sqlite:///./student_performance.db"


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Lightweight migrations for existing DBs
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(prediction_records)"))
        existing = {row[1] for row in cols.fetchall()}

        if "name" not in existing:
            conn.execute(
                text("ALTER TABLE prediction_records ADD COLUMN name VARCHAR DEFAULT ''")
            )

        if "photo" not in existing:
            conn.execute(text("ALTER TABLE prediction_records ADD COLUMN photo BLOB"))

        if "photo_content_type" not in existing:
            conn.execute(
                text("ALTER TABLE prediction_records ADD COLUMN photo_content_type VARCHAR")
            )

        if "photo_filename" not in existing:
            conn.execute(text("ALTER TABLE prediction_records ADD COLUMN photo_filename VARCHAR"))
