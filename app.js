// クリック時に全選択
function makeSelectOnClick(input) {
    input.addEventListener("focus", function () {
        this.select();
    });
    input.addEventListener("mouseup", e => e.preventDefault());
}

// "hh:mm:ss", "mm:ss", "ss", "ss.sss" を秒に変換
function parseTimeToSeconds(str) {
    const s = str.trim();
    if (!s) throw new Error("閾値時間を入力してください。");

    const parts = s.split(":").map(v => v.trim());
    let h = 0, m = 0, sec = 0;

    if (parts.length === 1) {
        // "ss" または "ss.sss"
        sec = Number(parts[0]);
    } else if (parts.length === 2) {
        // "mm:ss"
        m = Number(parts[0]);
        sec = Number(parts[1]);
    } else if (parts.length === 3) {
        // "hh:mm:ss"
        h = Number(parts[0]);
        m = Number(parts[1]);
        sec = Number(parts[2]);
    } else {
        throw new Error("閾値時間は hh:mm:ss / mm:ss / ss 形式で入力してください。");
    }

    if (![h, m, sec].every(x => Number.isFinite(x))) {
        throw new Error("閾値時間に数値以外が含まれています。");
    }
    if (h < 0 || m < 0 || sec < 0) {
        throw new Error("閾値時間は0以上で指定してください。");
    }

    return h * 3600 + m * 60 + sec;
}

const squadTabBar = document.getElementById("squad-tab-bar");
const squadPanels = document.getElementById("squad-panels");
const addSquadBtn = document.getElementById("add-squad-btn") || (() => {
    const btn = document.createElement("button");
    btn.id = "add-squad-btn";
    btn.className = "ghost-btn";
    btn.textContent = "+ 部隊を追加";
    squadTabBar?.appendChild(btn);
    return btn;
})();
let squadCounter = 0;
let activeSquadIndex = 0;

function nextSquadName() {
    squadCounter += 1;
    return `部隊 ${squadCounter}`;
}

function createSquadData(name, events, tSuccess) {
    const safeEvents = Array.isArray(events) ? events : [];
    const safeName = name || nextSquadName();
    return {
        name: safeName,
        events: safeEvents,
        tSuccess: tSuccess ?? "180",
    };
}

function readSquadsFromDOM() {
    const panels = [...document.querySelectorAll(".squad-panel")];
    return panels.map(panel => {
        const events = [...panel.querySelectorAll(".param-row")].map(row => ({
            p: row.querySelector(".input-p").value,
            t: row.querySelector(".input-t").value,
        }));
        return {
            name: panel.dataset.name || "部隊",
            tSuccess: panel.querySelector(".input-t-success")?.value ?? "",
            events,
        };
    });
}

function updateEventLabels(container) {
    const rows = [...container.querySelectorAll(".param-row")];
    rows.forEach((row, index) => {
        const label = row.querySelector(".event-label");
        if (label) label.textContent = `イベント ${index + 1}`;
    });
}

function updateEventControls(container) {
    const rows = [...container.querySelectorAll(".param-row")];
    rows.forEach((row, index) => {
        const upBtn = row.querySelector(".event-move-up");
        const downBtn = row.querySelector(".event-move-down");
        if (upBtn) upBtn.disabled = index === 0;
        if (downBtn) downBtn.disabled = index === rows.length - 1;
    });
}

function addEventRow(container, defaultP = "", defaultT = "") {
    const row = document.createElement("div");
    row.className = "param-row";

    const label = document.createElement("span");
    label.className = "event-label";
    label.textContent = "イベント";

    const pLabel = document.createElement("span");
    pLabel.textContent = "成功確率 [%]";

    const pInput = document.createElement("input");
    pInput.type = "text";
    pInput.inputMode = "decimal";
    pInput.value = defaultP;
    pInput.className = "input-p number-input";
    makeSelectOnClick(pInput);

    const tLabel = document.createElement("span");
    tLabel.textContent = "判定時刻 [秒]";

    const tInput = document.createElement("input");
    tInput.type = "text";
    tInput.inputMode = "decimal";
    tInput.value = defaultT;
    tInput.className = "input-t number-input";
    makeSelectOnClick(tInput);

    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.style.padding = "3px 8px";
    delBtn.addEventListener("click", () => {
        row.remove();
        updateEventLabels(container);
        updateEventControls(container);
    });

    const moveUpBtn = document.createElement("button");
    moveUpBtn.type = "button";
    moveUpBtn.className = "event-move-up";
    moveUpBtn.textContent = "↑";
    moveUpBtn.addEventListener("click", () => {
        const prev = row.previousElementSibling;
        if (prev) {
            container.insertBefore(row, prev);
            updateEventLabels(container);
            updateEventControls(container);
        }
    });

    const moveDownBtn = document.createElement("button");
    moveDownBtn.type = "button";
    moveDownBtn.className = "event-move-down";
    moveDownBtn.textContent = "↓";
    moveDownBtn.addEventListener("click", () => {
        const next = row.nextElementSibling;
        if (next) {
            container.insertBefore(next, row);
            updateEventLabels(container);
            updateEventControls(container);
        }
    });

    row.appendChild(label);
    row.appendChild(pLabel);
    row.appendChild(pInput);
    row.appendChild(tLabel);
    row.appendChild(tInput);
    row.appendChild(moveUpBtn);
    row.appendChild(moveDownBtn);
    row.appendChild(delBtn);

    container.appendChild(row);
    updateEventLabels(container);
    updateEventControls(container);
}

function setActiveSquad(index) {
    activeSquadIndex = index;
    const tabs = [...squadTabBar.querySelectorAll(".tab-button")];
    const panels = [...squadPanels.querySelectorAll(".squad-panel")];
    tabs.forEach((tab, i) => tab.classList.toggle("active", i === index));
    panels.forEach((panel, i) => panel.classList.toggle("active", i === index));
}

function renderSquads(squads, activeIndex = 0) {
    const safeSquads = squads.length ? squads : [createSquadData(null, [{ p: "", t: "" }], "180")];
    const tabButtons = [];
    squadPanels.innerHTML = "";

    safeSquads.forEach((squad, index) => {
        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = "tab-button";
        tabBtn.textContent = squad.name;
        tabBtn.addEventListener("click", () => setActiveSquad(index));
        tabButtons.push(tabBtn);

        const panel = document.createElement("div");
        panel.className = "squad-panel";
        panel.dataset.name = squad.name;

        const header = document.createElement("div");
        header.className = "squad-header";

        const title = document.createElement("div");
        title.className = "squad-title";
        title.textContent = squad.name;

        const actions = document.createElement("div");
        actions.className = "squad-actions";

        const moveLeftBtn = document.createElement("button");
        moveLeftBtn.type = "button";
        moveLeftBtn.textContent = "← 入れ替え";
        moveLeftBtn.disabled = index === 0;
        moveLeftBtn.addEventListener("click", () => {
            const data = readSquadsFromDOM();
            if (index > 0) {
                [data[index - 1], data[index]] = [data[index], data[index - 1]];
                renderSquads(data, index - 1);
            }
        });

        const moveRightBtn = document.createElement("button");
        moveRightBtn.type = "button";
        moveRightBtn.textContent = "入れ替え →";
        moveRightBtn.disabled = index === safeSquads.length - 1;
        moveRightBtn.addEventListener("click", () => {
            const data = readSquadsFromDOM();
            if (index < data.length - 1) {
                [data[index], data[index + 1]] = [data[index + 1], data[index]];
                renderSquads(data, index + 1);
            }
        });

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.textContent = "コピー";
        copyBtn.addEventListener("click", () => {
            const data = readSquadsFromDOM();
            const copied = { ...data[index], name: nextSquadName() };
            data.splice(index + 1, 0, copied);
            renderSquads(data, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "削除";
        delBtn.addEventListener("click", () => {
            const data = readSquadsFromDOM();
            if (data.length <= 1) {
                return;
            }
            data.splice(index, 1);
            const nextIndex = Math.max(0, Math.min(index, data.length - 1));
            renderSquads(data, nextIndex);
        });

        actions.appendChild(moveLeftBtn);
        actions.appendChild(moveRightBtn);
        actions.appendChild(copyBtn);
        actions.appendChild(delBtn);
        header.appendChild(title);
        header.appendChild(actions);
        panel.appendChild(header);

        const eventContainer = document.createElement("div");
        eventContainer.className = "param-container";
        panel.appendChild(eventContainer);

        const events = squad.events.length > 0 ? squad.events : [{ p: "", t: "" }];
        events.forEach(ev => addEventRow(eventContainer, ev.p ?? "", ev.t ?? ""));

        const addEventBtn = document.createElement("button");
        addEventBtn.type = "button";
        addEventBtn.className = "add-event-btn";
        addEventBtn.textContent = "+ 行を追加";
        addEventBtn.addEventListener("click", () => addEventRow(eventContainer));
        panel.appendChild(addEventBtn);

        const successWrap = document.createElement("p");
        const successLabel = document.createElement("label");
        successLabel.textContent = "成功判定時間 [秒]:";
        const successInput = document.createElement("input");
        successInput.type = "text";
        successInput.inputMode = "decimal";
        successInput.value = squad.tSuccess ?? "180";
        successInput.className = "input-t-success number-input";
        makeSelectOnClick(successInput);
        successLabel.appendChild(successInput);
        successWrap.appendChild(successLabel);
        panel.appendChild(successWrap);

        squadPanels.appendChild(panel);
    });

    if (squadTabBar) {
        squadTabBar.replaceChildren(...tabButtons, addSquadBtn);
    }
    setActiveSquad(Math.max(0, Math.min(activeIndex, safeSquads.length - 1)));
}

function collectState() {
    const mode = document.querySelector('input[name="th-mode"]:checked')?.value || "hours";

    return {
        squads: readSquadsFromDOM(),
        activeIndex: activeSquadIndex,
        restartDelay: document.getElementById("restart-delay").value,
        mode,
        thresholdHours: document.getElementById("threshold-hours").value,
        thresholdDetail: document.getElementById("threshold-detail").value,
        fps: document.getElementById("fps").value,
    };
}

function updateUrlState() {
    const state = collectState();
    const encoded = encodeURIComponent(JSON.stringify(state));
    const url = new URL(window.location.href);
    url.searchParams.set("state", encoded);
    window.history.replaceState(null, "", url.toString());
}

function applyState(state) {
    if (!state || typeof state !== "object") return false;

    const squads = Array.isArray(state.squads) ? state.squads : [];
    if (squads.length === 0) {
        squadCounter = 0;
        renderSquads([createSquadData(null, [{ p: 75, t: 10 }], "180")], 0);
    } else {
        squadCounter = squads.length;
        renderSquads(
            squads.map(s => createSquadData(s.name, s.events, s.tSuccess)),
            Number.isInteger(state.activeIndex) ? state.activeIndex : 0
        );
    }

    document.getElementById("restart-delay").value = state.restartDelay ?? "0";
    document.getElementById("threshold-hours").value = state.thresholdHours ?? "1";
    document.getElementById("threshold-detail").value = state.thresholdDetail ?? "1:00:00";
    document.getElementById("fps").value = state.fps ?? "1";

    const mode = state.mode === "detail" ? "detail" : "hours";
    const modeInput = document.querySelector(`input[name="th-mode"][value="${mode}"]`);
    if (modeInput) modeInput.checked = true;

    return true;
}

function loadStateFromUrl() {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("state");
    if (!raw) return false;

    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        return applyState(parsed);
    } catch {
        return false;
    }
}

addSquadBtn.addEventListener("click", () => {
    const data = readSquadsFromDOM();
    const newSquad = createSquadData(null, [{ p: "", t: "" }], "180");
    data.push(newSquad);
    renderSquads(data, data.length - 1);
});

const restored = loadStateFromUrl();
if (!restored) {
    renderSquads([createSquadData(null, [{ p: 75, t: 10 }], "180")], 0);
}

makeSelectOnClick(document.getElementById("restart-delay"));
makeSelectOnClick(document.getElementById("threshold-hours"));
makeSelectOnClick(document.getElementById("threshold-detail"));
makeSelectOnClick(document.getElementById("fps"));

/*-----------------------------------
  Pyodide 読み込み & Python 関数
-----------------------------------*/
let pyodideReady = (async () => {
    const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
    });
    await pyodide.loadPackage("numpy");

    const pythonCode = `
import numpy as np

def prob_within_threshold_multi(scenarios, threshold, fps=30, restart=0):
    if not scenarios:
        return 0.0

    stage_params = []
    total_min_frames = 0

    restart_f = int(round(restart * fps))
    for s in scenarios:
        p_list = np.array(s["probs"], dtype=float) * 0.01
        t_fail_list = np.array(s["times"], dtype=float)
        success_time = float(s["success_time"])

        q_succ = np.prod(p_list)
        q_fails = []
        current_p = 1.0
        for p in p_list:
            q_fails.append(current_p * (1.0 - p))
            current_p *= p
        q_fails = np.array(q_fails)

        t_fails = np.round(t_fail_list * fps).astype(int) + restart_f
        stage_succ_frames = int(round(success_time * fps))
        total_min_frames += stage_succ_frames

        stage_params.append({"q_succ": q_succ, "q_fails": q_fails, "t_fails": t_fails})

    threshold_f = int(round(threshold * fps))
    max_waste_frames = threshold_f - total_min_frames
    if max_waste_frames < 0:
        return 0.0

    num_stages = len(stage_params)
    dp = np.zeros((num_stages, max_waste_frames + 1), dtype=float)
    dp[0][0] = stage_params[0]["q_succ"]

    for t in range(max_waste_frames + 1):
        for i in range(num_stages):
            params = stage_params[i]
            for Tn, qn in zip(params["t_fails"], params["q_fails"]):
                if t >= Tn:
                    dp[i][t] += qn * dp[i][t - Tn]
            if i > 0:
                dp[i][t] += dp[i - 1][t] * params["q_succ"]

    return float(dp[-1].sum())
`;
    await pyodide.runPythonAsync(pythonCode);
    return pyodide;
})();

document.getElementById("calcBtn").addEventListener("click", async () => {
    const err = document.getElementById("error");
    const out = document.getElementById("result");
    err.textContent = "";
    out.textContent = "";

    try {
        const squads = readSquadsFromDOM();
        if (squads.length === 0) throw new Error("部隊を追加してください。");

        const scenarios = squads.map((squad, index) => {
            if (!squad.events.length) {
                throw new Error(`${squad.name} のイベント行を追加してください。`);
            }

            const pList = [];
            const tList = [];

            for (const row of squad.events) {
                const p = Number(row.p);
                const t = Number(row.t);
                if (!Number.isFinite(p) || !Number.isFinite(t)) {
                    throw new Error(`${squad.name} の成功確率および判定時刻には数値を入力してください。`);
                }
                pList.push(p);
                tList.push(t);
            }

            const tSuccess = Number(squad.tSuccess);
            if (!Number.isFinite(tSuccess)) {
                throw new Error(`${squad.name} の成功判定時間には数値を入力してください。`);
            }

            const maxFailTime = Math.max(...tList);
            if (tSuccess < maxFailTime) {
                throw new Error(`${squad.name} の成功判定時間は、全てのイベントの判定時刻以上にしてください。`);
            }

            return { probs: pList, times: tList, success_time: tSuccess };
        });

        const restartDelay = Number(document.getElementById("restart-delay").value);
        if (!Number.isFinite(restartDelay) || restartDelay < 0) {
            throw new Error("リスタート時間は 0 以上の数で指定してください。");
        }

        const mode = document.querySelector('input[name="th-mode"]:checked')?.value;
        let ticketCount = null;
        let thresholdSeconds = null;

        if (mode === "hours") {
            ticketCount = Number(document.getElementById("threshold-hours").value);
            if (!Number.isFinite(ticketCount) || ticketCount < 0) {
                throw new Error("チケット枚数は 0 以上の数で指定してください。");
            }
        } else if (mode === "detail") {
            const thresholdStr = document.getElementById("threshold-detail").value;
            thresholdSeconds = parseTimeToSeconds(thresholdStr);
        } else {
            throw new Error("閾値時間の指定方法を選択してください。");
        }

        const fps = Number(document.getElementById("fps").value);
        if (!(fps >= 1)) {
            throw new Error("fps は 1 より大きい数で指定してください。");
        }

        const pyodide = await pyodideReady;
        pyodide.globals.set("scenarios_js", scenarios);
        pyodide.globals.set("fps_js", fps);
        pyodide.globals.set("restart_js", restartDelay);

        let prob;
        if (mode === "hours") {
            const ticketSeconds = 3600;
            pyodide.globals.set("threshold_js", ticketSeconds);
            const pSingle = await pyodide.runPythonAsync(`
try:
    scenarios = scenarios_js.to_py()
except AttributeError:
    scenarios = scenarios_js
prob_within_threshold_multi(scenarios, threshold_js, fps_js, restart_js)
`);
            prob = 1 - Math.pow(1 - pSingle, ticketCount);
        } else {
            pyodide.globals.set("threshold_js", thresholdSeconds);
            prob = await pyodide.runPythonAsync(`
try:
    scenarios = scenarios_js.to_py()
except AttributeError:
    scenarios = scenarios_js
prob_within_threshold_multi(scenarios, threshold_js, fps_js, restart_js)
`);
        }

        out.textContent = `成功確率 = ${(prob * 100).toFixed(5)} %`;
        updateUrlState();
    } catch (e) {
        err.textContent = e.message || e;
    }
});
