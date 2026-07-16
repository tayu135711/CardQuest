from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List

from cardquest.models import CatchRecord, Character, Fish


DEFAULT_CHARACTERS = [
    Character(
        id=0,
        name="Starter",
        sprite="assets/characters/starter.png",
        fishing_profile={"style": "steady", "catch_bonus": 0.0, "rare_bonus": 0.0},
    ),
    Character(
        id=1,
        name="Wave Runner",
        sprite="assets/characters/wave_runner.png",
        fishing_profile={"style": "fast", "catch_bonus": 0.05, "rare_bonus": 0.01},
    ),
    Character(
        id=2,
        name="Lucky Reel",
        sprite="assets/characters/lucky_reel.png",
        fishing_profile={"style": "lucky", "catch_bonus": 0.02, "rare_bonus": 0.05},
    ),
]

DEFAULT_FISH = [
    Fish(id=0, name="Minnow", rarity="common", sprite="assets/fish/minnow.png"),
    Fish(id=1, name="Carp", rarity="common", sprite="assets/fish/carp.png"),
    Fish(id=2, name="Trout", rarity="rare", sprite="assets/fish/trout.png"),
    Fish(id=3, name="King Salmon", rarity="epic", sprite="assets/fish/king_salmon.png"),
]


def get_data_dir(base_dir: str | None = None) -> Path:
    root = Path(base_dir) if base_dir else Path.cwd()
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_state_path(base_dir: str | None = None) -> Path:
    return get_data_dir(base_dir) / "cardquest_state.json"


def build_default_state() -> Dict[str, Any]:
    return {
        "characters": [asdict(item) for item in DEFAULT_CHARACTERS],
        "fish": [asdict(item) for item in DEFAULT_FISH],
        "catches": [],
    }


def load_state(base_dir: str | None = None) -> Dict[str, Any]:
    state_path = get_state_path(base_dir)
    if not state_path.exists():
        state = build_default_state()
        save_state(state, base_dir=base_dir)
        return state

    with state_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_state(state: Dict[str, Any], base_dir: str | None = None) -> None:
    state_path = get_state_path(base_dir)
    with state_path.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2)


def add_catch(state: Dict[str, Any], catch: CatchRecord) -> Dict[str, Any]:
    updated = dict(state)
    catches = list(updated.get("catches", []))
    catches.append(asdict(catch))
    updated["catches"] = catches
    return updated

