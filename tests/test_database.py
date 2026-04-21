"""Tests for database.py: SQLite CRUD for confirmed exercise mappings (MAP-01, D-07, D-08).

RED state: database.py does not yet exist.
Tests will fail with ImportError until Task 2 creates database.py.
"""
import pathlib
import pytest


def test_database_importable():
    """database module must export init_db, confirm_mapping_db, get_confirmed_mapping_db, DB_PATH."""
    from database import init_db, confirm_mapping_db, get_confirmed_mapping_db, DB_PATH
    assert init_db is not None
    assert confirm_mapping_db is not None
    assert get_confirmed_mapping_db is not None


def test_db_path_is_pathlib(tmp_path):
    """DB_PATH must be a pathlib.Path instance (not a plain string)."""
    from database import DB_PATH
    assert isinstance(DB_PATH, pathlib.Path), f"DB_PATH is {type(DB_PATH)}, expected pathlib.Path"


def test_init_db_creates_table(tmp_path):
    """init_db() creates the confirmed_mappings table; safe to call multiple times (D-07)."""
    import sqlite3
    from database import init_db
    db = tmp_path / "test.db"
    init_db(db)
    init_db(db)  # idempotent — must not raise
    with sqlite3.connect(str(db)) as conn:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='confirmed_mappings'"
        ).fetchall()
    assert len(tables) == 1, "confirmed_mappings table must exist after init_db"


def test_confirm_and_retrieve(tmp_path):
    """confirm_mapping_db + get_confirmed_mapping_db round-trip (MAP-01)."""
    from database import init_db, confirm_mapping_db, get_confirmed_mapping_db
    db = tmp_path / "test.db"
    init_db(db)
    confirm_mapping_db("Bench Press", 1, "barbell_bench_press", db)
    result = get_confirmed_mapping_db("Bench Press", db)
    assert result == (1, "barbell_bench_press"), f"Expected (1, 'barbell_bench_press'), got {result}"


def test_get_missing_returns_none(tmp_path):
    """get_confirmed_mapping_db returns None for unknown exercise names."""
    from database import init_db, get_confirmed_mapping_db
    db = tmp_path / "test.db"
    init_db(db)
    result = get_confirmed_mapping_db("NonExistent Exercise", db)
    assert result is None


def test_confirm_upsert(tmp_path):
    """confirm_mapping_db INSERT OR REPLACE updates existing row (D-08)."""
    from database import init_db, confirm_mapping_db, get_confirmed_mapping_db
    db = tmp_path / "test.db"
    init_db(db)
    confirm_mapping_db("Squat", 10, "barbell_squat", db)
    confirm_mapping_db("Squat", 11, "goblet_squat", db)  # overwrite
    result = get_confirmed_mapping_db("Squat", db)
    assert result == (11, "goblet_squat"), f"Upsert failed, got {result}"


def test_no_sql_injection_in_queries(tmp_path):
    """Parameterized queries must handle special characters safely."""
    from database import init_db, confirm_mapping_db, get_confirmed_mapping_db
    db = tmp_path / "test.db"
    init_db(db)
    # Exercise name with SQL injection attempt — must be stored and retrieved safely
    evil_name = "'; DROP TABLE confirmed_mappings; --"
    confirm_mapping_db(evil_name, 99, "safe_exercise", db)
    result = get_confirmed_mapping_db(evil_name, db)
    assert result == (99, "safe_exercise"), f"Parameterized query failed, got {result}"
