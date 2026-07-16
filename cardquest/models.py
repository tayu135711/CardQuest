from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List


@dataclass(slots=True)
class Character:
    id: int
    name: str
    sprite: str
    fishing_profile: Dict[str, Any]


@dataclass(slots=True)
class Fish:
    id: int
    name: str
    rarity: str
    sprite: str


@dataclass(slots=True)
class CatchRecord:
    character_id: int
    fish_id: int
    caught_at: str

    @classmethod
    def create(cls, character_id: int, fish_id: int) -> "CatchRecord":
        return cls(
            character_id=character_id,
            fish_id=fish_id,
            caught_at=datetime.now(timezone.utc).isoformat(),
        )


def dataclass_list(items: List[Any]) -> List[Dict[str, Any]]:
    return [asdict(item) for item in items]

