# AI automation planner (live preview)

A working planner for a business owner who wants AI across the business. List the weekly tasks; it scores how well AI and automation fit each one, estimates hours saved, build cost and payback, decides where a person must approve the output, and orders everything into a roadmap (week 1, weeks 2 to 4, later, not yet). The example week is invented.

## Try it
Open `index.html`. Cut the posts task to half an hour; raise "Your time" to $100; add a task with no name; tick receipts as digital; remove supplier negotiation.

## Files
```
index.html               the page (Notion-style table + roadmap)
src/plannerEngine.js     the engine (UMD: browser + node)
data/sample.json         an invented week
tests/verify.js          21 node tests
tests/browser-check.py   15 Playwright checks
```

## Run the tests
```
node tests/verify.js            # 21 passed, 0 failed
python3 tests/browser-check.py  # 15 passed, 0 failed
```
The page and the tests load the same `src/plannerEngine.js`.

## How the logic works
| Step | Rule |
|---|---|
| Check | name, category, hours (0 to 60), repetitive and judgment (1 to 5), risk (low, medium, high); bad rows are set aside with reasons |
| Fit score | repetitive x 2 + (6 - judgment) x 2 + 3 if the inputs are digital - risk (0 / 2 / 5). High at 14+, medium at 9+, low below |
| Hours saved | 60% / 35% / 10% of the task's weekly hours for high / medium / low fit (editable) |
| Cost and payback | typical build hours per task type x build rate; payback = cost / (hours saved x value of your time) |
| Approval | content, inbox and anything above low risk: AI drafts, you approve; the rest runs on its own and alerts on errors |
| Roadmap | sorted by payback; low fit or payback over 26 weeks goes to "not yet" |

## What the delivered version adds
A short call to fill the planner with the real week, then the automations themselves (Zapier, Make or n8n, the CRM, Claude or ChatGPT for drafting), each with an approval step where it touches customers, and a Notion playbook.
