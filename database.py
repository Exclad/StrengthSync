"""SQLite persistence for confirmed exercise mappings (MAP-01, D-07, D-08).

init_db() must be called explicitly before any read/write operation.
All sqlite3 calls use parameterized queries (?-style) — no string formatting in SQL.
DB_PATH uses pathlib.Path(__file__).parent so it resolves correctly regardless of cwd.
"""
from __future__ import annotations
import pathlib
import sqlite3

DB_PATH: pathlib.Path = pathlib.Path(__file__).parent / "data" / "exercise_mappings.db"


def init_db(db_path: str | pathlib.Path = DB_PATH) -> None:
    """Create confirmed_mappings table if it does not exist. Safe to call multiple times (D-07).

    Args:
        db_path: Path to the SQLite database file. Created on first connect if absent.
    """
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS confirmed_mappings (
                hevy_exercise_name        TEXT PRIMARY KEY,
                garmin_exercise_enum_int  INTEGER NOT NULL,
                garmin_exercise_name      TEXT NOT NULL,
                confirmed_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


def confirm_mapping_db(
    hevy_name: str,
    enum_int: int,
    garmin_name: str,
    db_path: str | pathlib.Path = DB_PATH,
) -> None:
    """Upsert a confirmed mapping. INSERT OR REPLACE is atomic (D-08).

    Args:
        hevy_name: Raw exercise name from Hevy CSV (primary key).
        enum_int: Garmin exercise_enum_int (category_subtype for FIT set message field 8).
        garmin_name: Garmin exercise_name string (e.g. 'barbell_bench_press').
        db_path: Path to the SQLite database file.
    """
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO confirmed_mappings VALUES (?,?,?,CURRENT_TIMESTAMP)",
            (hevy_name, enum_int, garmin_name),
        )


def get_confirmed_mapping_db(
    hevy_name: str,
    db_path: str | pathlib.Path = DB_PATH,
) -> tuple | None:
    """Return (garmin_exercise_enum_int, garmin_exercise_name) tuple or None.

    Args:
        hevy_name: Raw exercise name from Hevy CSV to look up.
        db_path: Path to the SQLite database file.

    Returns:
        (garmin_exercise_enum_int: int, garmin_exercise_name: str) if found, else None.
    """
    with sqlite3.connect(str(db_path)) as conn:
        return conn.execute(
            "SELECT garmin_exercise_enum_int, garmin_exercise_name "
            "FROM confirmed_mappings WHERE hevy_exercise_name=?",
            (hevy_name,),
        ).fetchone()
