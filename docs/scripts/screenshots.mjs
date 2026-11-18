// The docs' screenshots of the dashboard, taken through Chrome's DevTools
// protocol: read-only (only the UI is opened, never an action button --
// the scan's results are a real scan), every personal value replaced by a
// fake in the page first, never blurred (see MASK: users, pools, IPs, MACs,
// the board's ID, the mail settings), the shot's element alone on the app's
// background, numbered badges laid out by one rule per kind of element.
// usage: node docs/scripts/screenshots.mjs <base url> <out dir> <lang> <shot...>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, outDir, lang = "fr", ...names] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const BG = "#1e1e2a";
const BADGE = 22;
// Every shot is taken in a 1240px window and shown at this scale on the
// docs page: a full-width band (968px of content + 16px each side) fills
// the docs' 736px column -- the app's controls the same size in every shot.
const SCALE = 736 / 1000;
const fr = lang === "fr";

// In the page: helpers every shot uses.
const HELPERS = `
  const B = ${BADGE};
  const leafIn = (root, text) => [...root.querySelectorAll("*")].filter((e) => e.textContent.trim().startsWith(text)).pop();
  const leaf = (text) => leafIn(document.body, text);
  const common = (a, b) => { let x = a; while (x && !x.contains(b)) x = x.parentElement; return x; };
  const cover = (z = 1000) => {
    const c = document.createElement("div");
    Object.assign(c.style, { position: "fixed", inset: 0, background: "${BG}", zIndex: z });
    document.body.appendChild(c);
  };
  // The element above the cover, the rest of the page hidden under it.
  const isolate = (el) => {
    cover();
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.zIndex = 1100;
    return el;
  };
  const rect = (el) => el.getBoundingClientRect();
  const pad = (r, t = 16, right = 16, b = 16, l = 16) => ({ x: r.left - l, y: r.top - t, width: r.width + l + right, height: r.height + t + b });
  const miss = (n) => ({ n, missing: true });
  // On a small element's top-right corner.
  const corner = (el, n) => { if (!el) return miss(n); const r = rect(el); return { n, x: r.right - B / 2, y: r.top - B / 2 }; };
  // Inside a block, at its top-right.
  const inside = (el, n) => { if (!el) return miss(n); const r = rect(el); return { n, x: r.right - B - 10, y: r.top + 10 }; };
  // On a line at y, centered on the element.
  const onLine = (el, n, y) => { if (!el) return miss(n); const r = rect(el); return { n, x: r.left + r.width / 2 - B / 2, y }; };
  // In a column at x, centered on the element's height.
  const inColumn = (el, n, x) => { if (!el) return miss(n); const r = rect(el); return { n, x, y: r.top + r.height / 2 - B / 2 }; };
  // Configuration: the section's card, and only the blocks named (their
  // h6 titles) kept in it -- the others hidden, so the card closes on them.
  const settingsCard = (...titles) => {
    const heads = [...document.querySelectorAll("h6.MuiTypography-subtitle1")].filter((h) => h.offsetWidth > 0);
    const card = heads[0].closest(".MuiPaper-root");
    const inCard = heads.filter((h) => card.contains(h));
    if (inCard.length > 1) {
      const holder = common(inCard[0], inCard[1]);
      const blockOf = (h) => { let e = h; while (e.parentElement !== holder) e = e.parentElement; return e; };
      const keep = inCard.filter((h) => titles.some((t) => h.textContent.trim().startsWith(t))).map(blockOf);
      if (keep.length) [...holder.children].forEach((c) => { if (!keep.includes(c)) c.style.display = "none"; });
    }
    return isolate(card);
  };
  // The app's top bar and menu out of the way.
  const pageOnly = () => {
    document.querySelectorAll(".MuiDrawer-root").forEach((d) => { if (!d.querySelector('[role="presentation"], .MuiBackdrop-root')) d.style.visibility = "hidden"; });
    let top = document.querySelector('button[aria-label="notifications"]');
    while (top && getComputedStyle(top).position !== "sticky") top = top.parentElement;
    if (top) top.style.visibility = "hidden";
  };
  const clickText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(text))?.click();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
`;

// Configuration: open a miner's panel on one of its sections.
const MINER_PANEL = (section) => `
  return (async () => {
    [...document.querySelectorAll("tr, [role='row']")].find((r) => r.textContent.includes("Atchoum"))?.click();
    await wait(1500);
    const panel = [...document.querySelectorAll(".MuiDrawer-paper")].find((p) => p.textContent.includes("${fr ? "Nom affiché" : "Display name"}"));
    [...panel.querySelectorAll("a, button, [role='button']")].find((e) => e.textContent.trim().startsWith("${section}"))?.click();
    await wait(1200);
  })();`;
const MINER_PANEL_RUN = `
  pageOnly();
  document.querySelectorAll(".MuiBackdrop-root").forEach((b) => (b.style.visibility = "hidden"));
  const panel = [...document.querySelectorAll(".MuiDrawer-paper")].find((p) => p.textContent.includes("${fr ? "Nom affiché" : "Display name"}"));
  Object.assign(panel.style, { top: "16px", right: "16px", height: "auto", maxHeight: "calc(100vh - 32px)", borderRadius: "12px" });
  cover(1250);
  panel.closest(".MuiDrawer-root, .MuiModal-root").style.zIndex = 1300;
  return { clip: pad(rect(panel)), badges: [] };`;

const SHOTS = {
  // The Home page's overview: the whole app window, 16px of the app's
  // background around it, no badges. The window is the shots' 1240px plus
  // the margin; the app is held in it by a transform on #root, which also
  // holds its fixed parts (the menu).
  home: {
    width: 1272,
    height: 1400,
    settle: 2000,
    // The window ends under the miners' list, with the room the app leaves
    // on its right side.
    run: `
      document.documentElement.style.background = "${BG}";
      document.body.style.background = "${BG}";
      const root = document.getElementById("root");
      Object.assign(root.style, { position: "relative", transform: "translate(0, 0)", width: "1240px", margin: "16px", overflow: "hidden", borderRadius: "12px" });
      const ips = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^\\d+\\.\\d+\\.\\d+\\.\\d+/.test(e.textContent.trim()));
      let row = ips[ips.length - 1];
      while (row && rect(row).height < 50) row = row.parentElement;
      const top = rect(root).top;
      const end = rect(row.parentElement).bottom - top;
      const card = rect(leaf("${fr ? "Hashrate de la flotte" : "Fleet hashrate"}").closest(".MuiPaper-root") || root);
      const side = rect(root).right - card.right;
      const h = Math.round(end + side);
      Object.assign(root.style, { height: h + "px", minHeight: h + "px", maxHeight: h + "px" });
      return { clip: { x: 0, y: 0, width: 1272, height: h + 32 }, badges: [] };`,
  },

  // The menu, its badges in a column right of it.
  sidebar: {
    width: 1240,
    height: 500,
    run: `
      const paper = [...document.querySelectorAll(".MuiDrawer-paper")].find((p) => p.offsetWidth > 0 && p.textContent.includes("${fr ? "plateforme" : "Platform"}"));
      Object.assign(paper.style, { top: "16px", left: "16px", height: "calc(100vh - 32px)", border: "none" });
      const box = rect(paper);
      const gutter = document.createElement("div");
      Object.assign(gutter.style, { position: "fixed", top: 0, bottom: 0, left: box.right + "px", right: 0, background: "${BG}", zIndex: 1300 });
      document.body.appendChild(gutter);
      const buttons = [...paper.querySelectorAll("button")];
      const x = box.right + 14;
      const items = [
        paper.querySelector('a[href="/"]'),
        leafIn(paper, "•"),
        paper.querySelectorAll('a[href="/"]')[1],
        paper.querySelector('a[href="/alerts"]'),
        paper.querySelector('a[href="/settings"]'),
        paper.querySelector('a[href="/backups"]'),
        paper.querySelector('a[href="/audit"]'),
        leafIn(paper, "${fr ? "État plateforme" : "Platform status"}"),
        buttons[buttons.length - 1],
      ];
      return { clip: { x: 0, y: 0, width: box.right + 50, height: window.innerHeight }, badges: items.map((el, i) => inColumn(el, i + 1, x)) };`,
  },

  // The top bar, its badges on a line under it.
  topbar: {
    width: 1240,
    height: 200,
    run: `
      document.querySelectorAll(".MuiDrawer-root").forEach((d) => (d.style.visibility = "hidden"));
      let bar = document.querySelector('button[aria-label="notifications"]');
      while (bar && getComputedStyle(bar).position !== "sticky") bar = bar.parentElement;
      cover();
      bar.style.zIndex = 1100;
      bar.style.transform = "translateY(16px)";
      const box = rect(bar);
      const y = box.bottom + 10;
      const items = [
        leafIn(bar, "${fr ? "Tableau de bord" : "Dashboard"}")?.parentElement?.parentElement,
        bar.querySelector('a[href*="github.io"]'),
        bar.querySelector("button[aria-pressed]"),
        bar.querySelector('button[aria-label="notifications"]'),
        bar.querySelector(".MuiFormControl-root"),
      ];
      return { clip: { x: box.left - 16, y: 0, width: box.width + 32, height: box.bottom + 44 }, badges: items.map((el, i) => onLine(el, i + 1, y)) };`,
  },

  // The fleet card: small elements by their corner, blocks inside.
  fleet: {
    width: 1240,
    height: 1200,
    run: `
      const title = leaf("${fr ? "Hashrate de la flotte" : "Fleet hashrate"}");
      const card = isolate(common(title, leaf("${fr ? "Température" : "Temperature"}")));
      const cell = (t) => { let e = leafIn(card, t); while (e && e.parentElement && rect(e.parentElement).width < rect(card).width / 3) e = e.parentElement; return e; };
      // The time of the last poll: the leaf reading hh:mm, right of the chip.
      const chip = card.querySelector("button");
      const clock = [...card.querySelectorAll("*")].filter((e) => /^\\d{2}:\\d{2}$/.test(e.textContent.trim()) && Math.abs(rect(e).top - rect(chip).top) < 20).pop();
      // The big number's line: from the number to the 24 h average.
      const now = leafIn(card, "${fr ? "Moyenne" : "24 h average"}");
      const items = [
        corner(title, 1),
        corner(card.querySelector("button"), 2),
        corner(clock, 3),
        corner(now, 4),
        inside(card.querySelector(".recharts-wrapper"), 5),
        inside(cell("${fr ? "Puissance" : "Power"}"), 6),
        inside(cell("${fr ? "Efficacité" : "Efficiency"}"), 7),
        inside(cell("${fr ? "Électricité" : "Electricity"}"), 8),
        inside(cell("${fr ? "Parts" : "Shares"}"), 9),
        inside(cell("${fr ? "Meilleure diff" : "Best diff"}"), 10),
        inside(cell("${fr ? "Température" : "Temperature"}"), 11),
      ];
      return { clip: pad(rect(card), 24), badges: items };`,
  },

  // The miners' state and the pools: a badge by each card's title.
  breakdowns: {
    width: 1240,
    height: 1200,
    run: `
      const state = leaf("${fr ? "État des mineurs" : "Miner status"}");
      const pools = leaf("Pools");
      const row = isolate(common(state, pools));
      return { clip: pad(rect(row), 24), badges: [corner(state, 1), corner(pools, 2)] };`,
  },

  // Search, filters and sort: a line of badges under the row.
  toolbar: {
    width: 1240,
    height: 1200,
    run: `
      const search = document.querySelector('input[placeholder*="temp>"]').closest(".MuiFormControl-root, .MuiTextField-root");
      const counter = leaf("5 ${fr ? "sur" : "of"}");
      const row = isolate(common(search, counter));
      const box = rect(row);
      const selects = [...row.querySelectorAll(".MuiFormControl-root")].filter((f) => f !== search);
      const y = box.bottom + 10;
      const items = [
        onLine(search, 1, y),
        onLine(search.querySelector("button, svg[data-testid*='Info']")?.closest("button") || search.querySelector("svg:last-of-type"), 2, y),
        onLine(selects[0], 3, y),
        onLine(selects[1], 4, y),
        onLine(selects[2], 5, y),
        onLine(row.querySelector('[role="group"]') || row.querySelector(".MuiToggleButtonGroup-root"), 6, y),
        onLine(counter, 7, y),
      ];
      return { clip: { x: box.left - 16, y: box.top - 16, width: box.width + 32, height: box.height + 60 }, badges: items };`,
  },

  // The list: a line of badges over the column headers, the first row's
  // stripe and chevron.
  list: {
    width: 1240,
    height: 1200,
    run: `
      document.querySelectorAll(".MuiDrawer-root").forEach((d) => (d.style.visibility = "hidden"));
      const head = leaf("${fr ? "Mineur" : "Miner"}");
      const table = isolate(head.closest(".MuiPaper-root") || common(head, leaf("Firmware")).parentElement);
      // Room for the gutters' badges on both sides: the page's own padding.
      table.style.transform = "translateX(-24px)";
      const box = rect(table);
      const y = box.top - 34;
      const headers = ["${fr ? "Mineur" : "Miner"}", "Hashrate", "${fr ? "Temp. puce" : "Chip temp"}", "${fr ? "Ventilateur" : "Fan"}", "${fr ? "Conso" : "Power"}", "Pool", "Firmware"];
      const items = headers.map((h, i) => onLine(leafIn(table, h), i + 1, y));
      // The first row's stripe and chevron: badges in gutters left and right
      // of the table, on that row.
      const rows = [...table.querySelectorAll('[role="button"], a, button')].filter((e) => rect(e).height > 50);
      const r = rect(rows[0]);
      const ry = r.top + r.height / 2 - B / 2;
      items.push({ n: 8, x: box.left - B - 12, y: ry });
      items.push({ n: 9, x: box.right + 12, y: ry });
      return { clip: { x: box.left - 46, y: box.top - 46, width: box.width + 92, height: box.height + 62 }, badges: items };`,
  },

  // Two tiles, no badges.
  tiles: {
    width: 1240,
    height: 1200,
    before: `document.querySelector('button[aria-label="${fr ? "Tuiles" : "Tiles"}"]')?.click();`,
    run: `
      // A tile: the smallest box holding a miner's IP and its hashrate.
      const ips = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^\\d+\\.\\d+\\.\\d+\\.\\d+/.test(e.textContent.trim()));
      const tileOf = (el) => { let e = el; while (e && !(e.textContent.includes("TH/s") && rect(e).height > 150)) e = e.parentElement; return e; };
      const tiles = ips.map(tileOf).filter(Boolean);
      const a = rect(tiles[0]), b = rect(tiles[1]);
      isolate(common(tiles[0], tiles[1]));
      const r = { left: a.left, top: Math.min(a.top, b.top), width: b.right - a.left, height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) };
      return { clip: pad(r), badges: [] };`,
  },

  // The miners unfolded under the health chip, no badges.
  health: {
    width: 1240,
    height: 1200,
    before: `[...document.querySelectorAll("button")].find((b) => /${fr ? "mineurs OK|mineurs" : "miners"}/.test(b.textContent))?.click();`,
    run: `
      cover(1250);
      const pop = document.querySelector(".MuiPopover-paper, .MuiPopper-root, .MuiCollapse-entered");
      return { clip: pad(rect(pop)), badges: [] };`,
  },

  // Every service's state, no badges.
  services: {
    width: 1240,
    height: 1200,
    before: `[...document.querySelectorAll("button, [role='button']")].find((b) => b.textContent.includes("${fr ? "État plateforme" : "Platform status"}"))?.click();`,
    run: `
      document.querySelectorAll(".MuiBackdrop-root").forEach((b) => (b.style.visibility = "hidden"));
      cover(1250);
      const dialog = document.querySelector(".MuiDialog-paper, .MuiPopover-paper");
      return { clip: pad(rect(dialog)), badges: [] };`,
  },

  // A miner's panel, its badges in a column left of it.
  drawer: {
    width: 1240,
    height: 1700,
    before: `[...document.querySelectorAll("[role='button'], tr, a")].find((e) => e.textContent.includes("192.168.1.") && e.getBoundingClientRect().height > 50)?.click();`,
    run: `
      document.querySelectorAll(".MuiBackdrop-root").forEach((b) => (b.style.visibility = "hidden"));
      const panel = [...document.querySelectorAll(".MuiDrawer-paper")].find((p) => p.textContent.includes("Session"));
      Object.assign(panel.style, { top: "16px", right: "16px", height: "auto", maxHeight: "calc(100vh - 32px)" });
      cover(1250);
      panel.closest(".MuiDrawer-root, .MuiModal-root").style.zIndex = 1300;
      const box = rect(panel);
      const block = (t) => { let e = leafIn(panel, t); while (e && e.parentElement && e.parentElement !== panel && rect(e.parentElement).width < box.width - 4) e = e.parentElement; return e; };
      const x = box.left - B - 14;
      const ip = panel.querySelector('a[href^="http://192.168"]');
      const items = [
        inColumn(ip?.parentElement?.previousElementSibling || panel.querySelector("h6, h5"), 1, x),
        inColumn(ip, 2, x),
        inColumn(block("Hashrate"), 3, x),
        inColumn(block("${fr ? "Dernières 24 h" : "Last 24 h"}"), 4, x),
        // Pools and its user, one block in the app: one badge each, on their
        // own part of it.
        inColumn(leafIn(panel, "${fr ? "Principal" : "Primary"}")?.closest("button, [role='button']") || leafIn(panel, "${fr ? "Principal" : "Primary"}"), 5, x),
        inColumn(leafIn(panel, "${fr ? "Utilisateur" : "User"}")?.parentElement, 6, x),
        inColumn(block("Session"), 7, x),
        inColumn(block("${fr ? "Depuis le début" : "Since tracking began"}"), 8, x),
        inColumn(block("${fr ? "Appareil" : "Device"}"), 9, x),
        inColumn(leafIn(panel, "${fr ? "Redémarrer" : "Restart"}")?.closest("button"), 10, x),
      ];
      return { clip: { x: box.left - 50, y: 0, width: box.width + 66, height: box.bottom + 16 }, badges: items };`,
  },

  // The Alerts page on a day with alerts (the date isn't in the URL: "Jour
  // précédent" clicked back to it): the filters' badges on a line above the
  // bar, a raised and a cleared alert's in a gutter on the left.
  alerts: {
    path: "/alerts",
    width: 1240,
    height: 1100,
    daysBack: 16,
    before: `
      const previous = () => document.querySelector('button[aria-label="${fr ? "Jour précédent" : "Previous day"}"]');
      return (async () => {
        for (let i = 0; i < DAYS_BACK; i++) {
          previous().click();
          await new Promise((r) => setTimeout(r, 400));
        }
        await new Promise((r) => setTimeout(r, 2500));
      })();`,
    run: `
      document.querySelectorAll(".MuiDrawer-root").forEach((d) => (d.style.visibility = "hidden"));
      // The app's top bar sits above the cover: hidden, the shot is the page.
      let top = document.querySelector('button[aria-label="notifications"]');
      while (top && getComputedStyle(top).position !== "sticky") top = top.parentElement;
      if (top) top.style.visibility = "hidden";
      const rows = [...document.querySelectorAll('[data-testid="alert-row"]')];
      const bar = document.querySelector('button[aria-label="${fr ? "Jour précédent" : "Previous day"}"]').closest(".MuiPaper-root") || common(rows[0], document.querySelector('[aria-label="${fr ? "Jour précédent" : "Previous day"}"]'));
      const content = isolate(common(bar, rows[rows.length - 1]));
      const box = rect(content);
      const y = rect(bar).top - B - 10;
      const field = (id) => document.getElementById(id)?.closest(".MuiFormControl-root");
      const x = box.left - B - 12;
      const raised = rows.find((r) => !r.textContent.includes("→"));
      const cleared = rows.find((r) => r.textContent.includes("→"));
      const items = [
        onLine(field("ip") || bar.querySelectorAll(".MuiFormControl-root")[0], 1, y),
        onLine(field("type") || bar.querySelectorAll(".MuiFormControl-root")[1], 2, y),
        onLine(field("date") || bar.querySelectorAll(".MuiFormControl-root")[2], 3, y),
        onLine(leafIn(bar, "${fr ? "Aujourd" : "Today"}")?.closest("button"), 4, y),
        inColumn(bar.querySelector(".MuiChip-root"), 5, x),
        inColumn(raised, 6, x),
        inColumn(cleared, 7, x),
      ];
      return { clip: { x: box.left - 46, y: rect(bar).top - B - 26, width: box.width + 62, height: box.bottom - rect(bar).top + B + 42 }, badges: items };`,
  },

  // The Audit page on a day (its period is in the URL): the filters'
  // badges on a line above the bar, three kinds of entry in a gutter on the
  // left, the copy icon by its corner.
  audit: {
    path: "/audit?from=2026-11-03T00:00:00Z&to=2026-11-04T00:00:00Z",
    width: 1240,
    height: 1100,
    run: `
      pageOnly();
      const rows = [...document.querySelectorAll('[data-testid="audit-row"]')];
      const exportButton = leaf("${fr ? "Exporter" : "Export"}").closest("button");
      const bar = common(exportButton, leaf("${fr ? "7 événements" : "7 events"}"));
      const content = isolate(common(bar, rows[rows.length - 1]));
      const box = rect(content);
      const y = rect(bar).top - B - 10;
      const x = box.left - B - 12;
      const fields = [...bar.querySelectorAll(".MuiFormControl-root")];
      const api = rows.find((r) => r.textContent.includes("Dashboard"));
      const scheduler = rows.find((r) => r.textContent.includes("${fr ? "Planificateur" : "Scheduler"}"));
      const backup = rows.find((r) => r.textContent.includes("${fr ? "Sauvegarde de chaque nuit" : "Nightly backup"}"));
      const items = [
        onLine(fields[0], 1, y),
        onLine(fields[1], 2, y),
        onLine(fields[2], 3, y),
        onLine(exportButton, 4, y),
        inColumn(scheduler, 5, x),
        corner(scheduler && scheduler.querySelector("button"), 6),
        inColumn(api, 7, x),
        inColumn(backup, 8, x),
      ];
      return { clip: { x: box.left - 46, y: rect(bar).top - B - 26, width: box.width + 62, height: box.bottom - rect(bar).top + B + 42 }, badges: items };`,
  },

  // The Backups page: badges on the corner of each control.
  backups: {
    path: "/backups",
    width: 1240,
    height: 1100,
    run: `
      pageOnly();
      const download = leaf("${fr ? "Télécharger" : "Download"}").closest("button");
      const rows = [...document.querySelectorAll("tbody tr")];
      const pager = [...document.querySelectorAll("button")].filter((b) => rect(b).top > rect(rows[rows.length - 1]).bottom).pop();
      const page = isolate(common(download, pager));
      const items = [
        corner(download, 1),
        corner(document.querySelector('thead input[type="checkbox"]')?.parentElement, 2),
        corner(leafIn(page, "${fr ? "en cours" : "in progress"}"), 3),
        corner([...rows[1].querySelectorAll("button, a")].pop(), 4),
        corner(pager.parentElement, 5),
      ];
      return { clip: pad(rect(page), 24), badges: items };`,
  },

  // Configuration, the section menu next to the Miners section.
  settings: {
    path: "/settings/miners",
    width: 1240,
    height: 1100,
    run: `
      pageOnly();
      const menu = leaf("${fr ? "Dernière modification" : "Last modified"}").closest(".MuiPaper-root");
      const card = document.querySelector("h6.MuiTypography-subtitle1").closest(".MuiPaper-root");
      const both = isolate(common(menu, card));
      return { clip: pad(rect(both)), badges: [] };`,
  },
  "settings-scan-before": {
    path: "/settings/miners",
    width: 1240,
    height: 1100,
    run: `
      pageOnly();
      const card = settingsCard("${fr ? "Détection" : "Automatic"}", "${fr ? "Ajouter par IP" : "Add by IP"}");
      return { clip: pad(rect(card)), badges: [] };`,
  },
  // A real scan of the network: an action, recorded in the audit.
  "settings-scan-results": {
    path: "/settings/miners",
    width: 1240,
    height: 1800,
    before: `return (async () => { clickText("button", "${fr ? "Lancer la détection" : "Start"}"); await wait(25000); })();`,
    run: `
      pageOnly();
      const card = settingsCard("${fr ? "Détection" : "Automatic"}", "${fr ? "Ajouter par IP" : "Add by IP"}", "${fr ? "Mineurs trouvés" : "Miners found"}");
      return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-configured-miners": {
    path: "/settings/miners",
    width: 1240,
    height: 1100,
    run: `
      pageOnly();
      const card = settingsCard("${fr ? "Mineurs configurés" : "Configured miners"}");
      return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-miners-actions": {
    path: "/settings/miners",
    width: 1240,
    height: 1100,
    before: `return (async () => { clickText("button", "${fr ? "Actions" : "Actions"}"); await wait(1200); })();`,
    run: `
      pageOnly();
      const card = settingsCard("${fr ? "Mineurs configurés" : "Configured miners"}");
      // The miners' table hidden: the card ends under the actions.
      card.querySelectorAll("table").forEach((t) => ((t.closest(".MuiTableContainer-root") || t).style.display = "none"));
      return { clip: pad(rect(card)), badges: [] };`,
  },
  // Reads every miner's pools off the device: writes nothing.
  "settings-miners-check": {
    path: "/settings/miners",
    width: 1240,
    height: 1300,
    before: `return (async () => { clickText("button", "${fr ? "Actions" : "Actions"}"); await wait(1200); clickText("button", "${fr ? "Vérifier" : "Check"}"); await wait(8000); })();`,
    run: `
      document.querySelectorAll(".MuiBackdrop-root").forEach((b) => (b.style.visibility = "hidden"));
      cover(1250);
      const dialog = document.querySelector(".MuiDialog-paper");
      return { clip: pad(rect(dialog)), badges: [] };`,
  },
  "settings-alias-pools": { path: "/settings/miners", width: 1240, height: 1100, before: MINER_PANEL("Pool"), run: MINER_PANEL_RUN },
  "settings-miner-alert-thresholds": { path: "/settings/miners", width: 1240, height: 1100, before: MINER_PANEL(fr ? "Seuils" : "Alert"), run: MINER_PANEL_RUN },
  "settings-schedule": { path: "/settings/miners", width: 1240, height: 1100, before: MINER_PANEL(fr ? "Planificateur" : "Scheduler"), run: MINER_PANEL_RUN },
  "settings-electricity": {
    path: "/settings/electricity",
    width: 1240,
    height: 1100,
    run: `pageOnly(); const card = settingsCard(); return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-notifications": {
    path: "/settings/notifications",
    width: 1240,
    height: 1600,
    run: `pageOnly(); const card = settingsCard(); return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-remote": {
    path: "/settings/remote",
    width: 1240,
    height: 1600,
    run: `pageOnly(); const card = settingsCard(); return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-alert-thresholds": {
    path: "/settings/system",
    width: 1240,
    height: 1100,
    run: `pageOnly(); const card = settingsCard("${fr ? "Seuils d'alerte" : "Alert thresholds"}"); return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-pools": {
    path: "/settings/system",
    width: 1240,
    height: 1100,
    run: `pageOnly(); const card = settingsCard("${fr ? "Dashboards des pools" : "Pool dashboards"}"); return { clip: pad(rect(card)), badges: [] };`,
  },
  "settings-firmware": {
    path: "/settings/system",
    width: 1240,
    height: 1100,
    run: `pageOnly(); const card = settingsCard("${fr ? "Repos firmware" : "Firmware repos"}"); return { clip: pad(rect(card)), badges: [] };`,
  },

  // The top bar on a phone, its "More" unfolded, the badges on a line above.
  mobile: {
    width: 390,
    height: 300,
    mobile: true,
    before: `document.querySelector('button[aria-expanded]')?.click();`,
    run: `
      let bar = document.querySelector('button[aria-label="notifications"]');
      while (bar && getComputedStyle(bar).position !== "sticky") bar = bar.parentElement;
      cover();
      bar.style.zIndex = 1100;
      bar.style.transform = "translateY(44px)";
      const box = rect(bar);
      const y = box.top - 32;
      // The bar's own bottom line stays out: the unfolded row ends the shot.
      const lang = bar.querySelector(".MuiFormControl-root");
      const end = lang ? rect(lang).bottom : box.bottom;
      const items = [
        onLine(bar.querySelector('button[aria-label="open navigation menu"]'), 1, y),
        onLine(leafIn(bar, "${fr ? "Tableau de bord" : "Dashboard"}"), 2, y),
        onLine(bar.querySelector("button[aria-pressed]"), 3, y),
        onLine(bar.querySelector('button[aria-label="notifications"]'), 4, y),
        onLine(bar.querySelector("button[aria-expanded]"), 5, y),
      ];
      return { clip: { x: 0, y: 0, width: window.innerWidth, height: end + 12 }, badges: items };`,
  },
};

const port = 9335;
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.CLAUDE_JOB_DIR}/tmp/capture/shots-${Date.now()}`, "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

// The app's language: the browser's own (navigator.language, what the app
// detects when it has none stored) and the stored one.
await send("Page.enable");
const { userAgent } = await send("Browser.getVersion");
await send("Emulation.setUserAgentOverride", { userAgent, acceptLanguage: lang === "fr" ? "fr-FR" : "en-US" });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `try { localStorage.setItem("i18nextLng", ${JSON.stringify(lang)}); localStorage.removeItem("axeos.sidebarCollapsed"); } catch (e) {}`,
});

// Every personal value replaced, in the page, by a made-up one before the
// shot -- never shown, blurred or not: the board's ID by dots; the stratum
// users, the pools, the IPs and MACs, the mail settings by fakes, the same
// for a miner in every shot (miners ordered by IP). IPs and MACs are the
// documentation ranges (RFC 5737, RFC 7042).
const MASK = `(async () => {
  const miners = ((await (await fetch("/api/miners")).json()).miners || []).slice()
    .sort((a, b) => String(a.ip).localeCompare(String(b.ip), undefined, { numeric: true }));
  let board = {};
  try { board = await (await fetch("/api/remote/board")).json(); } catch (e) {}
  const fakes = [];
  const add = (real, fake) => { if (real && String(real) !== fake) fakes.push([String(real), fake]); };
  const hex = (n) => n.toString(16).padStart(2, "0");
  miners.forEach((m, i) => {
    const n = i + 1;
    add(m.stratumUser, "wallet.worker" + n);
    add(m.fallbackStratumUser, "wallet.worker" + n);
    add(m.stratumURL, "pool.example.com");
    add(m.fallbackStratumURL, "fallback.example.com");
    add(m.ip, "192.0.2." + (10 + n));
    const mac = String(m.macAddr || "").replace(/[^0-9a-f]/gi, "");
    if (mac.length === 12) {
      const fake = ["00", "00", "5e", "00", "53", hex(n)];
      const parts = mac.match(/../g);
      for (const sep of [":", "-", ""]) {
        add(parts.join(sep).toLowerCase(), fake.join(sep));
        add(parts.join(sep).toUpperCase(), fake.join(sep).toUpperCase());
      }
    }
  });
  if (board.boardId) add(board.boardId, "•".repeat(16));
  // The mail settings: the SMTP server, its user, the sender, the recipients.
  try {
    const n = (await (await fetch("/api/config/settings")).json()).notifications || {};
    const smtp = (n.mail && n.mail.smtp) || {};
    add(smtp.host, "smtp.example.com");
    add(smtp.username, "axeos@example.com");
    add(smtp.from, "axeos@example.com");
    ((n.mail && n.mail.to) || []).forEach((to, i) => add(to, i ? "moi" + (i + 1) + "@example.com" : "moi@example.com"));
    if (n.dashboardURL) add(n.dashboardURL, "http://192.0.2.1");
  } catch (e) {}
  // Longest first: a pool's host inside a longer value goes with it.
  fakes.sort((a, b) => b[0].length - a[0].length);
  // Any other LAN address (the browser of an audit entry...).
  const lan = /\\b(?:192\\.168|10\\.\\d{1,3}|172\\.(?:1[6-9]|2\\d|3[01]))\\.\\d{1,3}\\.\\d{1,3}\\b/g;
  const swap = (text) => {
    let out = text;
    for (const [real, fake] of fakes) if (out.includes(real)) out = out.split(real).join(fake);
    return out.replace(lan, "192.0.2.100");
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue || "";
    const out = swap(text);
    if (out !== text) node.nodeValue = out;
  }
  for (const input of document.querySelectorAll("input")) {
    const out = swap(input.value || "");
    if (out !== input.value) input.value = out;
  }
})()`;

for (const name of names) {
  const shot = SHOTS[name];
  await send("Emulation.setDeviceMetricsOverride", { width: shot.width, height: shot.height, deviceScaleFactor: 2, mobile: Boolean(shot.mobile) });
  await send("Page.navigate", { url: base + (shot.path || "/") });
  await sleep(7000);
  if (shot.before) {
    await evaluate(`(() => { ${HELPERS} const DAYS_BACK = ${shot.daysBack || 0}; ${shot.before} })()`);
    await sleep(1500);
  }
  await evaluate(MASK);
  let layout;
  try {
    layout = await evaluate(`(() => { ${HELPERS} ${shot.run} })()`);
  } catch (e) {
    console.log(name, "FAILED:", e.message.split("\n")[0]);
    continue;
  }
  // A shot that resized the app waits for it to lay itself out again.
  if (shot.settle) await sleep(shot.settle);
  const missing = layout.badges.filter((b) => b.missing).map((b) => b.n);
  if (missing.length) console.log(name, "badges not found:", missing.join(", "));
  await evaluate(`(() => {
    for (const b of ${JSON.stringify(layout.badges.filter((b) => !b.missing))}) {
      const d = document.createElement("div");
      d.textContent = b.n;
      Object.assign(d.style, { position: "fixed", left: b.x + "px", top: b.y + "px", width: "${BADGE}px", height: "${BADGE}px", borderRadius: "50%", background: "#00b4ff", color: "#fff", font: "700 12px Roboto, Helvetica, Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 });
      document.body.appendChild(d);
    }
  })()`);
  await sleep(300);
  const png = await send("Page.captureScreenshot", { format: "png", clip: { ...layout.clip, scale: 1 } });
  const out = `${outDir}/${name}.png`;
  writeFileSync(out, Buffer.from(png.data, "base64"));
  console.log("written", out, "css", Math.round(layout.clip.width) + "x" + Math.round(layout.clip.height), "show at width", Math.round(layout.clip.width * SCALE));
}
ws.close();
chrome.kill();
