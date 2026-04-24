# nihongo no dashi - Documentation

This document serves as the Technical Specification and Standard Operating Procedure for the Custom Japanese Spaced Repetition System (SRS). Use this guide to ensure that future updates to the Google Sheet or the HTML code do not break the synchronization or the logic of the app.

---

## 1. Database Structure (Google Sheets)
The application relies on an **8-column** CSV export. The order of these columns is absolute; changing the order will cause the app to display data in the wrong fields or fail to sync progress.

| Column | Header | Content Description | Formatting Notes |
| :--- | :--- | :--- | :--- |
| **A** | **Kanji** | The target word/phrase. | Raw text. |
| **B** | **Reading** | Hiragana/Katakana. | Raw text. |
| **C** | **Meaning** | English translation. | Keep as pure Noun meanings where possible. |
| **D** | **Type** | Grammatical category. | e.g., `Noun`, `Transitive う-Verb`, `い-Adjective`. |
| **E** | **Conjugation**| Specific forms. | Leave EMPTY for Nouns to hide the section in UI. |
| **F** | **Sentence** | Context sentence. | Use `**word**` to highlight the target in pink/bold. |
| **G** | **Level** | SRS Stage (0-9). | Numeric value only. Used for WK logic. |
| **H** | **NextReview**| Timing Timestamp. | Unix timestamp (milliseconds). Do not format as Date. |

---

## 2. SRS Level Logic (WaniKani Style)
The system translates the numeric value in **Column G** into visual feedback using the following mapping:

- **0 - 4: Apprentice** (Color: `#dd0093` / Pink)
- **5 - 6: Guru** (Color: `#882d9e` / Purple)
- **7: Master** (Color: `#294ddb` / Blue)
- **8: Enlightened** (Color: `#0093dd` / Cyan)
- **9+: Burned** (Color: `#434343` / Grey)

**Timing Intervals:**
- Level 1: +4 Hours
- Level 2: +8 Hours
- Level 3: +24 Hours (1 Day)
- Level 4: +48 Hours (2 Days)
- Level 5: +1 Week
- Level 6: +2 Weeks
- Level 7: +1 Month
- Level 8: +4 Months (Approx)

---

## 3. UI Features & Keyboard Shortcuts
To maintain a "fast-review" flow, the app supports the following mapped keys:

| Key | Action |
| :--- | :--- |
| **SPACE** | Flip the card to reveal the answer. |
| **F** | Toggle 'More Details' (Sentence & Conjugation) - *Only when flipped*. |
| **1** | Mark as **CORRECT** (Increases Level, moves NextReview forward). |
| **2** | Mark as **WRONG** (Decreases Level, resets to immediate review). |

---

## 4. Maintenance & Safety Rules for AI
If you ask an AI (like Gemini) to update your sheet or the code in the future, ensure it follows these rules:

1. **Never omit columns:** Even if a cell is empty (like Conjugation for a Noun), the column must exist so the index `[7]` always points to `NextReview`.
2. **Handle Special Characters:** Use `**` for bolding in sentences. The code uses a Regex `/\*\*(.*?)\*\*/g` to find these.
3. **Regex for CSV:** The parser uses `split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)` to ensure that commas inside quotes (if used in meanings) do not break the column alignment.
4. **CORS & Sync:** The `SAVE_URL` must point to the Google Apps Script Web App set to "Execute as Me" and "Access: Anyone."

---

## 5. Deployment Instructions
- **Google Sheet:** Publish to Web -> Format: **CSV**.
- **Apps Script:** Ensure the `doPost(e)` function correctly targets your Sheet ID and matches the 8-column schema.
- **HTML:** The script is standalone and can be run from any local file or hosted on GitHub Pages / Vercel.

---
*Created to ensure consistency between the Cloud Database and the Application Interface.*
