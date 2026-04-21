"""One-time script: extract exercise enums from garmin_fit_sdk Profile → data/garmin_exercises.csv.

Run once from project root:
    .venv/bin/python scripts/extract_garmin_exercises.py

Output: data/garmin_exercises.csv (~1,846 rows, 4 columns)
Commit the CSV; never run this script at runtime.
Columns: exercise_name, exercise_enum_int, exercise_category, exercise_category_enum_int
"""
import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / ".venv" / "lib" / "python3.11" / "site-packages"))
from garmin_fit_sdk.profile import Profile

types = Profile["types"]
cat_map = types["exercise_category"]
cat_by_name = {v: int(k) for k, v in cat_map.items() if k.isdigit()}

rows = []
for category_name, cat_enum in cat_by_name.items():
    ex_key = f"{category_name}_exercise_name"
    if ex_key in types:
        for k, v in types[ex_key].items():
            if k.isdigit():
                rows.append((v, int(k), category_name, cat_enum))

out = pathlib.Path(__file__).parent.parent / "data" / "garmin_exercises.csv"
out.parent.mkdir(exist_ok=True)
with open(out, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["exercise_name", "exercise_enum_int", "exercise_category", "exercise_category_enum_int"])
    writer.writerows(rows)

print(f"Wrote {len(rows)} exercises to {out}")
