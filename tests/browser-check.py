"""
tests/browser-check.py
Playwright checks that drive the real page (index.html), which loads the
same src/plannerEngine.js that tests/verify.js tests.
Run:  python3 tests/browser-check.py      (expects "0 failed" on the last line)
"""
import functools, http.server, pathlib, threading
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond: passed += 1; print(f"PASS: {name}")
    else: failed += 1; print(f"FAIL: {name}")

class Balance(HTMLParser):
    VOID = {"meta","link","br","input","img","hr","source","wbr","col"}
    def __init__(self): super().__init__(); self.stack, self.errors = [], []
    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID: self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag in self.VOID: return
        if not self.stack or self.stack[-1] != tag: self.errors.append(f"unexpected </{tag}> open {self.stack[-3:]}")
        else: self.stack.pop()

print("0. HTML tag balance")
b = Balance(); b.feed((ROOT / "index.html").read_text())
check("all tags closed and nested", not b.errors and not b.stack)
if b.errors: print(b.errors[:5])

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)); handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
problems = []

with sync_playwright() as pw:
    br = pw.chromium.launch()
    p = br.new_page(viewport={"width": 1366, "height": 950})
    p.on("console", lambda m: problems.append(m.text) if m.type == "error" else None)
    p.on("pageerror", lambda e: problems.append(str(e)))
    p.goto(url); p.wait_for_selector("[data-testid=card]")
    txt = lambda t: p.locator(f"[data-testid={t}]").inner_text()
    col = lambda c: [x.get_attribute("data-id") for x in p.locator(f"[data-testid=col-{c}] [data-testid=card]").all()]

    print("1. Sample week")
    check("14.2 hours back a week, $1,170 build, 1.7 week payback", txt("t-saved") == "14.2" and txt("t-cost") == "$1,170" and txt("t-payback") == "1.7 wk")
    check("week 1 is the social posts task", col("week1") == ["t1"])
    check("supplier negotiation is 'not yet'", col("notYet") == ["t9"])
    check("posts are 'AI drafts, you approve'", "AI drafts, you approve" in p.locator("[data-testid=col-week1] [data-testid=card]").inner_text())
    p.screenshot(path=str(TESTS / "screenshot-default.png"), full_page=False)

    print("\n2. Change inputs")
    p.fill("[data-testid=hours-t1]", "0.5")
    check("posts at half an hour a week drop out of week 1", col("week1") != ["t1"] and txt("t-saved") != "14.2")
    p.click("[data-testid=reset]")
    p.fill("[data-testid=s-rate]", "100")
    check("$100 an hour of your time: payback falls to 0.9 weeks", txt("t-payback") == "0.9 wk")
    p.click("[data-testid=reset]")
    p.check("[data-testid=digital-t5]")
    check("digital receipts: still high fit, saved hours shown", "high" in p.locator("[data-fit=t5]").inner_text())

    print("\n3. Add and remove")
    p.click("[data-testid=add]")
    check("a blank new task is set aside with the reason", "task name missing" in txt("skipped"))
    p.fill("[data-testid=name-new1]", "Book delivery slots"); p.fill("[data-testid=hours-new1]", "2")
    check("named with 2 hours: it joins the plan", p.locator("[data-testid=skipped]").is_hidden() and p.locator("[data-testid=card][data-id=new1]").count() == 1)
    p.fill("[data-testid=hours-new1]", "0")
    check("zero hours is refused with a reason", "hours per week" in txt("skipped"))
    p.click("[data-testid=rm-new1]"); p.click("[data-testid=rm-t9]")
    check("removing supplier negotiation empties 'not yet'", col("notYet") == [] and p.locator("[data-testid=task-t9]").count() == 0)
    p.locator("#app").scroll_into_view_if_needed()
    p.screenshot(path=str(TESTS / "screenshot-app.png"), full_page=False)

    print("\n4. Phone width")
    m = br.new_page(viewport={"width": 390, "height": 844})
    m.on("pageerror", lambda e: problems.append(str(e)))
    m.goto(url); m.wait_for_selector("[data-testid=card]")
    check("no horizontal page scroll at 390px", m.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    m.screenshot(path=str(TESTS / "screenshot-mobile.png"), full_page=False)

    print("\n5. Off disk (file://, fallback data)")
    f = br.new_page(); f.on("pageerror", lambda e: problems.append(str(e)))
    f.goto((ROOT / "index.html").as_uri()); f.wait_for_selector("[data-testid=card]")
    check("file:// copy works on the embedded data", f.locator("[data-testid=t-saved]").inner_text() == "14.2")

    print("\n6. Console")
    check("zero console or page errors", not [x for x in problems if "Failed to fetch" not in x and "ERR_FILE" not in x and "CORS" not in x])
    if problems: print(problems)
    br.close()
srv.shutdown()
print(f"\n{passed} passed, {failed} failed")
