#!/usr/bin/env python3
"""
Builds the diaries seed bundle from the OSRS Wiki.

Usage:
  python3 packages/content/scripts/build-diaries-from-wiki.py

Requires:
  python3 -m pip install --user beautifulsoup4
"""

import json
import re
import urllib.request
from bs4 import BeautifulSoup

WIKI_BASE = "https://oldschool.runescape.wiki"
API_URL = (
    "https://oldschool.runescape.wiki/api.php?"
    "action=parse&page=Achievement_Diary/All_achievements&prop=text&format=json"
)

SKILL_MAP = {
    "Attack": "attack",
    "Strength": "strength",
    "Defence": "defence",
    "Hitpoints": "hitpoints",
    "Ranged": "ranged",
    "Prayer": "prayer",
    "Magic": "magic",
    "Cooking": "cooking",
    "Woodcutting": "woodcutting",
    "Fletching": "fletching",
    "Fishing": "fishing",
    "Firemaking": "firemaking",
    "Crafting": "crafting",
    "Smithing": "smithing",
    "Mining": "mining",
    "Herblore": "herblore",
    "Agility": "agility",
    "Thieving": "thieving",
    "Slayer": "slayer",
    "Farming": "farming",
    "Runecraft": "runecraft",
    "Hunter": "hunter",
    "Construction": "construction",
    "Sailing": "sailing",
}

ALLOWED_DIARIES = {
    "Ardougne",
    "Desert",
    "Falador",
    "Fremennik",
    "Kandarin",
    "Karamja",
    "Kourend & Kebos",
    "Lumbridge & Draynor",
    "Morytania",
    "Varrock",
    "Western Provinces",
    "Wilderness",
}

ALLOWED_TIERS = {"easy", "medium", "hard", "elite"}


def slugify(text):
    if not text:
        return ""
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"^_+|_+$", "", text)


def parse_level(level_str):
    if not level_str:
        return None
    match = re.search(r"\d+", level_str)
    return int(match.group(0)) if match else None


def absolute_url(href):
    if not href:
        return None
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "{}{}".format(WIKI_BASE, href)
    return None


def extract_skill_requirements(cell):
    text = cell.get_text(" ", strip=True)
    scps = cell.find_all("span", class_="scp")
    requirements = []
    unresolved = []
    numbers = [int(value) for value in re.findall(r"\d+", text)]

    skills_in_cell = []
    for scp in scps:
        skill_label = scp.get("data-skill")
        if skill_label in SKILL_MAP:
            skill_value = SKILL_MAP[skill_label]
            if skill_value not in skills_in_cell:
                skills_in_cell.append(skill_value)

    if "+" in text and len(skills_in_cell) >= 2 and numbers:
        total_level = numbers[0]
        combined = {
            "type": "combined-skill-level",
            "skills": skills_in_cell,
            "totalLevel": total_level,
        }
        if "or" in text.lower() and len(numbers) > 1:
            alt_level = numbers[1]
            alternates = [
                {"type": "skill-level", "skill": skill, "level": alt_level}
                for skill in skills_in_cell
            ]
            return [
                {"type": "any-of", "requirements": [combined] + alternates}
            ], None
        return [combined], None

    number_index = 0

    for scp in scps:
        skill_label = scp.get("data-skill")
        level = parse_level(scp.get("data-level"))

        if skill_label == "Combat level":
            used_number = False
            if level is None and number_index < len(numbers):
                level = numbers[number_index]
                number_index += 1
                used_number = True
            if level is not None:
                requirements.append({"type": "combat-level", "level": level})
                if not used_number and number_index < len(numbers):
                    number_index += 1
            else:
                unresolved.append(skill_label)
            continue

        skill = SKILL_MAP.get(skill_label)
        if not skill:
            if skill_label:
                unresolved.append(skill_label)
            continue

        if level is None:
            if number_index < len(numbers):
                level = numbers[number_index]
                number_index += 1
                requirements.append(
                    {"type": "skill-level", "skill": skill, "level": level}
                )
            else:
                unresolved.append(skill)
        else:
            requirements.append(
                {"type": "skill-level", "skill": skill, "level": level}
            )
            if number_index < len(numbers):
                number_index += 1

    unique = {(req.get("skill"), req.get("level")): req for req in requirements}
    requirements = list(unique.values())

    if unresolved:
        return [], text if text else None

    if len(requirements) > 1 and "or" in text.lower():
        return [{"type": "any-of", "requirements": requirements}], None

    return requirements, None


def extract_quest_requirements(cell):
    text = cell.get_text(" ", strip=True)
    quests = []
    for link in cell.find_all("a"):
        title = link.get("title") or link.get_text(" ", strip=True)
        if not title:
            continue
        if "Diary" in title or title.startswith("Achievement Diary"):
            continue
        quests.append(title)

    requirements = []
    for quest in quests:
        quest_id = slugify(quest)
        if quest_id:
            requirements.append({"type": "quest-complete", "questId": quest_id})

    requirements = list({req["questId"]: req for req in requirements}.values())

    if not requirements and text and text.lower() not in {"none", "n/a"}:
        return [], text

    return requirements, None


def main():
    html = json.loads(urllib.request.urlopen(API_URL).read())["parse"]["text"]["*"]
    soup = BeautifulSoup(html, "html.parser")

    diaries = {}
    seen_tasks = set()

    def ensure_diary(diary_name, diary_href):
        diary_id = slugify(diary_name)
        if diary_id not in diaries:
            diaries[diary_id] = {
                "id": diary_id,
                "name": (
                    "{} Diary".format(diary_name)
                    if not diary_name.lower().endswith("diary")
                    else diary_name
                ),
                "region": diary_name,
                "tiers": {},
                "wikiUrl": absolute_url(diary_href),
            }
        return diaries[diary_id]

    def ensure_tier(diary, tier_name, tier_href):
        tier_id = slugify(tier_name)
        tiers = diary["tiers"]
        if tier_id not in tiers:
            tiers[tier_id] = {
                "tier": tier_id,
                "name": tier_name,
                "requirements": [],
                "tasks": [],
                "wikiUrl": absolute_url(tier_href),
            }
        return tiers[tier_id]

    for headline in soup.find_all("span", class_="mw-headline"):
        skill_label = headline.get("id")
        if not skill_label or skill_label not in SKILL_MAP:
            continue
        table = headline.find_parent("h3").find_next_sibling("table")
        if not table:
            continue

        for row in table.find_all("tr")[1:]:
            cols = row.find_all("td")
            if len(cols) < 6:
                continue
            level_cell, other_cell, quest_cell, diary_cell, diff_cell, task_cell = (
                cols[:6]
            )

            diary_link = diary_cell.find("a")
            diary_name = (
                diary_link.get_text(" ", strip=True)
                if diary_link
                else diary_cell.get_text(" ", strip=True)
            )
            if not diary_name or diary_name not in ALLOWED_DIARIES:
                continue

            diff_link = diff_cell.find("a")
            difficulty = (
                diff_link.get_text(" ", strip=True)
                if diff_link
                else diff_cell.get_text(" ", strip=True)
            )
            if not difficulty:
                continue
            tier_id = slugify(difficulty)
            if tier_id not in ALLOWED_TIERS:
                continue

            task_desc = task_cell.get_text(" ", strip=True)
            if not task_desc:
                continue

            diary = ensure_diary(
                diary_name, diary_link.get("href") if diary_link else None
            )
            tier = ensure_tier(
                diary, difficulty, diff_link.get("href") if diff_link else None
            )

            requirements = []
            level_reqs, level_manual = extract_skill_requirements(level_cell)
            requirements.extend(level_reqs)
            if level_manual:
                requirements.append({"type": "manual-check", "label": level_manual})

            other_reqs, other_manual = extract_skill_requirements(other_cell)
            requirements.extend(other_reqs)
            if other_manual:
                requirements.append({"type": "manual-check", "label": other_manual})

            quest_reqs, quest_manual = extract_quest_requirements(quest_cell)
            requirements.extend(quest_reqs)
            if quest_manual:
                requirements.append({"type": "manual-check", "label": quest_manual})

            base_id = slugify(task_desc) or "task"
            existing_ids = {task["id"] for task in tier["tasks"]}
            task_id = base_id
            suffix = 2
            while task_id in existing_ids:
                task_id = "{}_{}".format(base_id, suffix)
                suffix += 1

            task_key = "{}|{}|{}".format(diary["id"], tier["tier"], task_desc)
            if task_key in seen_tasks:
                continue
            seen_tasks.add(task_key)

            task = {"id": task_id, "description": task_desc, "requirements": requirements}
            if tier.get("wikiUrl"):
                task["wikiUrl"] = tier["wikiUrl"]
            tier["tasks"].append(task)

    tier_order = {"easy": 0, "medium": 1, "hard": 2, "elite": 3}
    result_diaries = []
    for diary in diaries.values():
        tiers = list(diary["tiers"].values())
        tiers.sort(key=lambda t: tier_order.get(t["tier"], 99))
        diary_obj = {
            "id": diary["id"],
            "name": diary["name"],
            "region": diary["region"],
            "tiers": tiers,
        }
        if diary.get("wikiUrl"):
            diary_obj["wikiUrl"] = diary["wikiUrl"]
        result_diaries.append(diary_obj)

    result_diaries.sort(key=lambda d: d["name"])

    output_path = "packages/content/src/bundles/diaries-2026-01-22.json"
    with open(output_path, "w") as handle:
        json.dump(result_diaries, handle, indent=2)

    print("diaries", len(result_diaries))
    print("tasks", sum(len(t["tasks"]) for d in result_diaries for t in d["tiers"]))


if __name__ == "__main__":
    main()
