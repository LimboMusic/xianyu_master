---
name: tiktok-influencer-research
description: "This skill should be used when the user wants to research, analyze, or collect data on TikTok influencers/creators. It controls the user's local Chrome browser via AppleScript to visit each creator's TikTok profile page, extracts key metrics (followers, following, likes, bio), auto-categorizes the creator by content type, and exports the results as a formatted Excel file. Trigger phrases include: research TikTok influencers, collect TikTok data, analyze TikTok creators, scrape TikTok profiles, TikTok达人分析, 采集TikTok数据, TikTok达人数据."
---

# TikTok Influencer Research Skill

## Overview

Collect TikTok profile data for a list of creators by controlling the user's local
Chrome browser. No API keys or logins are required — the skill reads the rendered
page directly via JavaScript. Results are saved as a formatted Excel file.

**Collected fields per creator:**
| Field | Description |
|-------|-------------|
| Username | TikTok @handle |
| Display Name | Name shown on profile |
| Followers | Follower count |
| Following | Following count |
| Likes | Total likes received |
| TikTok Link | Direct profile URL |
| Bio | Profile bio text |
| Analysis | Auto-detected content category + bio summary |

**Auto-detected content categories:** 时尚穿搭, 美妆护肤, 好物推荐/购物分享, 美食,
家庭/母婴, 健身/健康, 旅行, 科技/评测, 球星卡/收藏, 信仰/生活, 搞笑娱乐, 健康养生,
家居/装修, 香水/香氛, 生活方式

---

## Prerequisites

- macOS only (uses AppleScript to control Chrome)
- Google Chrome must be installed and **already open** before running
- Python 3 with `openpyxl`: `pip install openpyxl`

---

## Workflow

### Step 1 — Collect the username list

Ask the user to provide a list of TikTok usernames (with or without `@`).
Accept any of these formats:
- Pasted directly in chat (one per line)
- A `.txt` file with one username per line
- A comma-separated string

Write usernames to a `.txt` file (one per line, no `@`) in the output directory.

### Step 2 — Run the scraper

Use `scripts/tiktok_scraper.py` to collect data. This script uses:
- **Smart polling** — moves on as soon as data appears (no fixed sleep)
- **Parallel tabs** — opens multiple Chrome tabs concurrently (default: 4)
- **Auto retry** — retries once per creator on failure
- **Periodic pause** — pauses every 20 creators to avoid rate-limiting

```bash
python3 <skill_dir>/scripts/tiktok_scraper.py \
  --input  usernames.txt \
  --output <output_dir>/
```

With inline list:
```bash
python3 <skill_dir>/scripts/tiktok_scraper.py \
  --usernames "user1,user2,user3" \
  --output <output_dir>/
```

Control parallelism with `--tabs` (default 4, max recommended 5):
```bash
python3 <skill_dir>/scripts/tiktok_scraper.py \
  --input usernames.txt --output <output_dir>/ --tabs 5
```

**For large batches**, run in background:
```bash
nohup python3 <skill_dir>/scripts/tiktok_scraper.py \
  --input usernames.txt --output <output_dir>/ --tabs 4 \
  > <output_dir>/stdout.log 2>&1 &
echo "PID: $!"
```

Monitor progress in real time:
```bash
tail -f <output_dir>/tiktok_scraper.log
```

### Step 3 — Convert CSV to Excel

After the scraper finishes, convert the CSV to a formatted Excel file:

```bash
python3 <skill_dir>/scripts/to_excel.py \
  --input  <output_dir>/tiktok_influencers.csv \
  --output <output_dir>/tiktok_influencers.xlsx
```

The Excel file includes:
- Frozen header row with dark styling
- Alternating row colors
- Clickable TikTok links (hyperlinks)
- Auto-filter on all columns
- Wrapped text with adjusted column widths

### Step 4 — Deliver the result

Open the Excel file for the user using `open_result_view`.

---

## Timing Estimates

| Batch size | v1 (single tab, fixed sleep) | v2 (4 tabs, polling) |
|------------|------------------------------|----------------------|
| 50         | ~5 min                       | ~1.5 min             |
| 200        | ~18 min                      | ~5 min               |
| 500        | ~45 min                      | ~12 min              |

v2 is **3–4x faster** due to parallel tabs + smart polling (no fixed wait).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `missing value` from AppleScript | Chrome tab isn't on TikTok page yet; increase `--wait` |
| All rows show "FAILED" | TikTok may be showing a CAPTCHA; open Chrome manually and solve it, then re-run |
| Too many failures      | Reduce `--tabs` to 2-3; TikTok may be throttling parallel requests |
| Chrome not responding  | Make sure Chrome is open and not minimized |
| Duplicate log entries  | Multiple scraper processes running; kill extras with `pkill -f tiktok_scraper.py` |
| `openpyxl` not found   | Run `pip install openpyxl` |

---

## Notes

- **macOS only**: AppleScript is used to control Chrome; not compatible with Windows/Linux.
- **No login required**: TikTok public profiles are accessible without being logged in.
- **Rate limiting**: The built-in pause (every 15 creators) helps avoid temporary blocks.
  For very large batches (500+), consider increasing `--wait` to 7-8 seconds.
- **Data accuracy**: Counts are scraped from the live rendered page, so they reflect
  the current state at scrape time.
