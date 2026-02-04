#!/usr/bin/env python3
"""
Build a BRUHsailer guide from the provided HTML export.

This parser extracts:
- Steps with structured instructions (split by sentence/action)
- Items needed with quantities
- Stats needed with levels
- GP stack info
- Alternative routes

Usage:
  python3 packages/content/scripts/build-bruhsailer-guide.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import TypedDict, NotRequired

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[3]
SOURCE_HTML = ROOT / "bruhsailer.html"
OUTPUT = (
    ROOT / "packages" / "content" / "src" / "guides" / "bruhsailer-parsed.json"
)


# Type definitions for the output structure
class GuideInstruction(TypedDict):
    text: str
    imageUrl: NotRequired[str]
    imageAlt: NotRequired[str]
    note: NotRequired[str]


class ItemNeeded(TypedDict):
    name: str
    qty: int
    consumed: NotRequired[bool]
    note: NotRequired[str]


class StatNeeded(TypedDict):
    skill: str
    level: int
    note: NotRequired[str]


class AlternativeRoute(TypedDict):
    title: NotRequired[str]
    text: str


class GpStack(TypedDict):
    note: NotRequired[str]
    min: NotRequired[int]
    max: NotRequired[int]


class StepMeta(TypedDict):
    gpStack: NotRequired[GpStack]
    itemsNeeded: list[ItemNeeded]
    statsNeeded: list[StatNeeded]
    alternativeRoutes: list[AlternativeRoute]


class GuideSection(TypedDict):
    id: str
    title: str
    description: str
    chapterTitle: str


class GuideStep(TypedDict):
    stepNumber: int
    title: str
    description: str
    instructions: list[GuideInstruction]
    requirements: list
    optionalRequirements: NotRequired[list]
    section: GuideSection
    meta: StepMeta


# Skill name mappings (lowercase) for detection
SKILLS = {
    "attack", "defence", "defense", "strength", "hitpoints", "hp", "ranged",
    "range", "prayer", "magic", "cooking", "woodcutting", "wc", "fletching",
    "fishing", "firemaking", "fm", "crafting", "smithing", "mining",
    "herblore", "agility", "thieving", "slayer", "farming", "runecraft",
    "runecrafting", "rc", "hunter", "construction"
}

# Normalize skill names to canonical form
SKILL_CANONICAL = {
    "defence": "Defence",
    "defense": "Defence",
    "hp": "Hitpoints",
    "range": "Ranged",
    "wc": "Woodcutting",
    "fm": "Firemaking",
    "rc": "Runecraft",
    "runecrafting": "Runecraft",
    "attack": "Attack",
    "strength": "Strength",
    "hitpoints": "Hitpoints",
    "ranged": "Ranged",
    "prayer": "Prayer",
    "magic": "Magic",
    "cooking": "Cooking",
    "woodcutting": "Woodcutting",
    "fletching": "Fletching",
    "fishing": "Fishing",
    "firemaking": "Firemaking",
    "crafting": "Crafting",
    "smithing": "Smithing",
    "mining": "Mining",
    "herblore": "Herblore",
    "agility": "Agility",
    "thieving": "Thieving",
    "slayer": "Slayer",
    "farming": "Farming",
    "runecraft": "Runecraft",
    "hunter": "Hunter",
    "construction": "Construction",
}


def to_ascii(value: str) -> str:
    """Normalize unicode and whitespace to clean ASCII."""
    text = value.strip()
    text = (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2026", "...")
    )
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", text).strip()


def normalize_rich_text(container) -> str:
    """Extract plain text from rich HTML, preserving structure."""
    for span in list(container.find_all("span")):
        style = (span.get("style") or "").lower()
        if "font-weight: bold" in style:
            span.name = "strong"
        elif "font-style: italic" in style:
            span.name = "em"
        elif "text-decoration: line-through" in style:
            span.name = "s"
        elif "color: rgb(255, 56, 56)" in style:
            span["class"] = ["guide-warn"]
        span.attrs.pop("style", None)

    for tag in container.find_all(True):
        tag.attrs.pop("style", None)
        if tag.name == "input":
            tag.decompose()

    return container.decode_contents().strip()


def strip_html_tags(html_text: str) -> str:
    """Remove HTML tags and get plain text."""
    soup = BeautifulSoup(html_text, "html.parser")
    return to_ascii(soup.get_text(" "))


def extract_items_from_text(text: str) -> list[ItemNeeded]:
    """
    Extract items with quantities from description text.

    Patterns matched:
    - "110 logs" -> qty=110, name="logs"
    - "a knife" -> qty=1, name="knife"
    - "two buckets" -> qty=2, name="buckets"
    - "grab 5 ashes" -> qty=5, name="ashes"
    """
    items: list[ItemNeeded] = []
    seen_items: set[str] = set()

    # Number words mapping
    number_words = {
        "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4,
        "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
        "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
        "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50
    }

    # Extended skip words - common non-items in guide text
    skip_words = {
        "gp", "gold", "coins", "times", "minutes", "seconds", "steps", "tiles",
        "worlds", "world", "swag", "look", "female", "character", "male",
        "account", "step", "authenticator", "guide", "quest", "quests",
        "diary", "diaries", "task", "tasks", "level", "levels", "xp", "exp",
        "experience", "chapter", "section", "more", "point", "points",
        "lap", "laps", "run", "runs", "trip", "trips", "kill", "kills",
        "time", "hour", "hours", "day", "days", "week", "weeks",
        "north", "south", "east", "west", "northwest", "northeast",
        "southwest", "southeast", "way", "path", "route", "spot",
        "place", "location", "area", "room", "floor", "total",
        "required", "optional", "recommended", "extra", "spare"
    }

    # Pattern for numeric quantities: "110 logs", "5 ashes"
    # More restrictive: item name should be 1-3 words max
    numeric_pattern = r'\b(\d+)\s+([a-zA-Z][a-zA-Z\-\']{1,20}(?:\s+[a-zA-Z\-\']{1,15})?)(?=\s*[,.\(\)]|\s+(?:and|then|to|from|for|in|on|at|with|if|or|but|you|the|your)|$)'

    for match in re.finditer(numeric_pattern, text, re.IGNORECASE):
        qty = int(match.group(1))
        name = match.group(2).strip().lower()

        # Skip quantities over 1000 (probably not items)
        if qty > 1000:
            continue

        # Skip if it's a skill level pattern (e.g., "15 firemaking")
        first_word = name.split()[0]
        if first_word in SKILLS:
            continue

        # Skip common non-items
        if first_word in skip_words or name in skip_words:
            continue

        # Skip if any word in the name is a skip word
        name_words = name.split()
        if any(w in skip_words for w in name_words):
            continue

        # Skip if name is too long (more than 3 words)
        if len(name_words) > 3:
            continue

        # Normalize name - remove trailing 's' for plurals
        if name.endswith("s") and len(name) > 3 and not name.endswith("ss"):
            name = name.rstrip("s")

        name_key = name.lower()

        if name_key not in seen_items and qty > 0 and len(name) > 1:
            seen_items.add(name_key)
            items.append({"name": name.title(), "qty": qty})

    # Pattern for word quantities: "a knife", "two buckets"
    # Action verb context pattern
    action_context = r'(?:grab|take|get|buy|bring|collect|gather|pick|steal|use|equip|wear)\s+'
    word_pattern = rf'{action_context}(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+([a-zA-Z][a-zA-Z\-\']+?)(?=\s*[,.\(\)]|\s+(?:and|then|to|from|for|in|on|at|with|if|or|but)|$)'

    for match in re.finditer(word_pattern, text, re.IGNORECASE):
        qty_word = match.group(1).lower()
        qty = number_words.get(qty_word, 1)
        name = match.group(2).strip().lower()

        # Skip skills and common non-items
        if name.split()[0] in SKILLS:
            continue

        if name in skip_words or any(sw in name for sw in skip_words):
            continue

        name_key = name.lower()

        if name_key not in seen_items and qty > 0 and len(name) > 1:
            seen_items.add(name_key)
            items.append({"name": name.title(), "qty": qty})

    return items


def extract_stats_from_text(text: str) -> list[StatNeeded]:
    """
    Extract skill requirements from description text.

    Patterns matched:
    - "15 firemaking" -> skill=Firemaking, level=15
    - "level 35 woodcutting" -> skill=Woodcutting, level=35
    - "35 woodcutting" -> skill=Woodcutting, level=35
    """
    stats: list[StatNeeded] = []
    seen_stats: set[str] = set()

    # Build skill pattern
    skill_names = "|".join(sorted(SKILLS, key=len, reverse=True))

    # Pattern: "15 firemaking", "level 35 woodcutting"
    pattern = rf'\b(?:level\s+)?(\d+)\s+({skill_names})\b'

    for match in re.finditer(pattern, text, re.IGNORECASE):
        level = int(match.group(1))
        skill_raw = match.group(2).lower()
        skill = SKILL_CANONICAL.get(skill_raw, skill_raw.title())

        if skill not in seen_stats and 1 <= level <= 99:
            seen_stats.add(skill)
            stats.append({"skill": skill, "level": level})

    return stats


def split_into_instructions(plain_text: str) -> list[GuideInstruction]:
    """
    Split description text into individual instruction items.

    Splits on:
    - Periods followed by space and capital letter
    - Commas followed by action verbs (grab, talk, run, go, etc.)
    """
    instructions: list[GuideInstruction] = []

    if not plain_text.strip():
        return instructions

    # Action verbs that typically start new instructions
    action_verbs = {
        "grab", "talk", "run", "go", "head", "walk", "teleport", "buy", "sell",
        "bank", "deposit", "withdraw", "use", "open", "close", "click", "enter",
        "exit", "return", "continue", "complete", "finish", "start", "begin",
        "pick", "pickpocket", "steal", "take", "bring", "drop", "destroy",
        "equip", "wear", "wield", "remove", "unequip", "eat", "drink", "cook",
        "burn", "cut", "chop", "mine", "fish", "fletch", "smith", "craft",
        "make", "create", "light", "read", "speak", "ask", "tell", "give",
        "receive", "get", "collect", "gather", "dig", "search", "examine",
        "check", "restore", "recharge", "fill", "empty"
    }

    # First, split on sentence boundaries (period + space + capital)
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', plain_text)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Further split on commas before action verbs
        parts = []
        current = ""

        # Simple comma split with action verb detection
        segments = sentence.split(", ")
        for i, segment in enumerate(segments):
            segment = segment.strip()
            if not segment:
                continue

            first_word = segment.split()[0].lower() if segment else ""

            # If starts with action verb, it's a new instruction
            if i > 0 and first_word in action_verbs:
                if current:
                    parts.append(current.strip())
                current = segment
            else:
                if current:
                    current += ", " + segment
                else:
                    current = segment

        if current:
            parts.append(current.strip())

        for part in parts:
            part = part.strip()
            if part:
                # Clean up trailing punctuation issues
                part = re.sub(r'\s+', ' ', part)
                instructions.append({"text": part})

    return instructions


def parse_gp_stack(gp_text: str) -> GpStack:
    """Parse GP stack text into structured format."""
    result: GpStack = {}

    # Try to extract min/max values
    # Patterns: "0 gp", "100-500 gp", "100 - 500", "0"
    range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', gp_text)
    single_match = re.search(r'(\d+)\s*(?:gp|gold)?', gp_text)

    if range_match:
        result["min"] = int(range_match.group(1))
        result["max"] = int(range_match.group(2))
    elif single_match:
        val = int(single_match.group(1))
        result["min"] = val
        result["max"] = val
    else:
        result["min"] = 0
        result["max"] = 0

    # Check for notes (text after the number)
    note_match = re.search(r'\d+\s*(?:gp|gold)?\s*[-–]?\s*(.+)', gp_text, re.IGNORECASE)
    if note_match:
        note = note_match.group(1).strip()
        if note and not note.isdigit():
            result["note"] = note

    return result


def parse_guide():
    """Parse the BRUHsailer HTML guide into structured JSON."""
    soup = BeautifulSoup(SOURCE_HTML.read_text(), "html.parser")
    chapters = []
    step_counter = 1

    for chapter in soup.select(".guide-chapter"):
        chapter_title_el = chapter.select_one(".chapter-title")
        chapter_title = to_ascii(chapter_title_el.get_text(" ")) if chapter_title_el else ""
        chapter_entry = {
            "title": chapter_title,
            "sections": [],
        }

        for section in chapter.select(".guide-section"):
            section_header = section.select_one(".section-header")
            section_id = section_header.get("data-section") if section_header else ""
            section_title_el = section.select_one(".section-title")
            section_title = to_ascii(section_title_el.get_text(" ")) if section_title_el else ""

            section_entry = {
                "id": section_id or section_title,
                "title": section_title,
                "description": "",
                "chapterTitle": chapter_title,
                "steps": [],
            }

            for step in section.select(".step"):
                step_number_el = step.select_one(".step-number")
                step_number_label = to_ascii(step_number_el.get_text(" ")) if step_number_el else f"Step {step_counter}"

                step_time_el = step.select_one(".step-time")
                step_time = to_ascii(step_time_el.get_text(" ")) if step_time_el else ""

                step_desc_el = step.select_one(".step-description")
                step_description_html = normalize_rich_text(step_desc_el) if step_desc_el else ""
                step_description_plain = strip_html_tags(step_description_html)

                # Extract structured data from description
                instructions = split_into_instructions(step_description_plain)
                items_needed = extract_items_from_text(step_description_plain)
                stats_needed = extract_stats_from_text(step_description_plain)

                # Parse metadata from step
                gp_stack: GpStack = {"min": 0, "max": 0}
                items_from_meta: list[ItemNeeded] = []
                alternative_routes: list[AlternativeRoute] = []

                meta_el = step.select_one(".step-meta")
                if meta_el:
                    for meta_item in meta_el.select(".meta-item"):
                        label = to_ascii(meta_item.get_text(" "))
                        value_el = meta_item.find("span")
                        value = to_ascii(value_el.get_text(" ")) if value_el else ""

                        if "gp stack" in label.lower():
                            gp_stack = parse_gp_stack(value)
                        elif "items needed" in label.lower():
                            items_from_meta = extract_items_from_text(value)

                # Merge items from meta with items from description
                seen_item_names = {item["name"].lower() for item in items_needed}
                for item in items_from_meta:
                    if item["name"].lower() not in seen_item_names:
                        items_needed.append(item)
                        seen_item_names.add(item["name"].lower())

                step_entry: GuideStep = {
                    "stepNumber": step_counter,
                    "title": step_number_label,
                    "description": step_description_plain,
                    "instructions": instructions,
                    "requirements": [],
                    "section": {
                        "id": section_entry["id"],
                        "title": section_entry["title"],
                        "description": section_entry["description"],
                        "chapterTitle": chapter_title,
                    },
                    "meta": {
                        "gpStack": gp_stack,
                        "itemsNeeded": items_needed,
                        "statsNeeded": stats_needed,
                        "alternativeRoutes": alternative_routes,
                    },
                }

                section_entry["steps"].append(step_entry)
                step_counter += 1

            chapter_entry["sections"].append(section_entry)

        chapters.append(chapter_entry)

    # Flatten steps for the output
    steps = []
    for chapter in chapters:
        for section in chapter["sections"]:
            steps.extend(section["steps"])

    payload = {
        "title": "BRUHsailer",
        "description": (
            "Comprehensive OSRS Ironman guide. Parsed from the HTML export "
            "with structured instructions, items, and skill requirements."
        ),
        "version": 3,
        "status": "published",
        "recommendedModes": ["ironman", "hardcore-ironman", "ultimate-ironman"],
        "tags": ["ironman", "efficient", "comprehensive", "bruhsailer"],
        "steps": steps,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    # Print statistics
    total_instructions = sum(len(s.get("instructions", [])) for s in steps)
    total_items = sum(len(s.get("meta", {}).get("itemsNeeded", [])) for s in steps)
    total_stats = sum(len(s.get("meta", {}).get("statsNeeded", [])) for s in steps)

    print(f"Wrote {OUTPUT}")
    print(f"  Steps: {len(steps)}")
    print(f"  Total instructions: {total_instructions}")
    print(f"  Total items extracted: {total_items}")
    print(f"  Total stat requirements: {total_stats}")


if __name__ == "__main__":
    parse_guide()
