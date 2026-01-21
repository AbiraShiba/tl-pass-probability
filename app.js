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

const paramContainer = document.getElementById("param-container");
const addParamBtn = document.getElementById("add-param-btn");
let rowCount = 0;

function collectState() {
    const rows = [...document.querySelectorAll(".param-row")];
    const events = rows.map(row => ({
        p: row.querySelector(".input-p").value,
        t: row.querySelector(".input-t").value,
    }));

    const mode = document.querySelector('input[name="th-mode"]:checked')?.value || "hours";

    return {
        events,
        tSuccess: document.getElementById("t-success").value,
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

    paramContainer.innerHTML = "";
    rowCount = 0;

    const events = Array.isArray(state.events) ? state.events : [];
    if (events.length === 0) {
        addParamRow(75, 10);
    } else {
        events.forEach(ev => addParamRow(ev.p ?? "", ev.t ?? ""));
    }

    document.getElementById("t-success").value = state.tSuccess ?? "180";
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

function addParamRow(defaultP = "", defaultT = "") {
    rowCount += 1;

    const row = document.createElement("div");
    row.className = "param-row";

    const label = document.createElement("span");
    label.textContent = `イベント ${rowCount}`;

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
    });

    row.appendChild(label);
    row.appendChild(pLabel);
    row.appendChild(pInput);
    row.appendChild(tLabel);
    row.appendChild(tInput);
    row.appendChild(delBtn);

    paramContainer.appendChild(row);
}

// 「行を追加」ボタン
addParamBtn.addEventListener("click", () => {
    addParamRow();
});

const restored = loadStateFromUrl();
if (!restored) {
    addParamRow(75, 10);
}

makeSelectOnClick(document.getElementById("t-success"));
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

def prob_within_threshold_analytic(p_list, T_list, threshold, fps=30, restart=0):
    p_list = np.array(p_list, dtype=float)
    p_list *= 0.01
    T_list = np.array(T_list, dtype=float)

    T_frames = np.round(T_list * fps).astype(int)
    threshold_f = int(round(threshold * fps))
    restart_f = int(round(restart * fps))

    T_fail = T_frames[:-1] + restart_f
    T_succ = T_frames[-1]

    if threshold_f < T_succ:
        return 0.0

    q_succ = np.prod(p_list)

    q = []
    prefix = 1.0
    for p in p_list:
        q.append(prefix * (1.0 - p))
        prefix *= p
    q.append(q_succ)
    q = np.array(q, dtype=float)

    max_T = threshold_f - T_succ

    x = np.zeros(max_T + 1, dtype=float)
    x[0] = q_succ

    for t in range(1, max_T + 1):
        s = 0.0
        for Tn, qn in zip(T_fail, q):
            if t >= Tn:
                s += qn * x[t - Tn]
        x[t] = s

    return float(x.sum())
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
        const rows = [...document.querySelectorAll(".param-row")];
        if (rows.length === 0) throw new Error("イベント行を追加してください。");

        const pList = [];
        const T_fail = [];

        for (const row of rows) {
            const p = Number(row.querySelector(".input-p").value);
            const t = Number(row.querySelector(".input-t").value);
            if (!Number.isFinite(p) || !Number.isFinite(t))
                throw new Error("成功確率および判定時刻には数値を入力してください。");

            pList.push(p);
            T_fail.push(t);
        }

        const T_succ = Number(document.getElementById("t-success").value);
        if (!Number.isFinite(T_succ)) {
            throw new Error("成功判定時間には数値を入力してください。");
        }

        const restartDelay = Number(document.getElementById("restart-delay").value);
        if (!Number.isFinite(restartDelay) || restartDelay < 0) {
            throw new Error("リスタート時間は 0 以上の数で指定してください。");
        }

        // 成功判定が他のイベント時間より前にならないようにする
        const maxFailTime = Math.max(...T_fail);
        if (T_succ < maxFailTime) {
            throw new Error("成功判定時間は、全てのイベントの判定時刻以上にしてください。");
        }

        // 閾値のモードを確認
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

        const T_list = [...T_fail, T_succ];

        const pyodide = await pyodideReady;
        pyodide.globals.set("p_list_js", pList);
        pyodide.globals.set("T_list_js", T_list);
        pyodide.globals.set("fps_js", fps);
        pyodide.globals.set("restart_js", restartDelay);

        let prob;
        if (mode === "hours") {
            const ticketSeconds = 3600;
            pyodide.globals.set("threshold_js", ticketSeconds);
            const pSingle = await pyodide.runPythonAsync(`
prob_within_threshold_analytic(p_list_js, T_list_js, threshold_js, fps_js, restart_js)
`);
            prob = 1 - Math.pow(1 - pSingle, ticketCount);
        } else {
            pyodide.globals.set("threshold_js", thresholdSeconds);
            prob = await pyodide.runPythonAsync(`
prob_within_threshold_analytic(p_list_js, T_list_js, threshold_js, fps_js, restart_js)
`);
        }

        out.textContent = `成功確率 = ${(prob * 100).toFixed(5)} %`;
        updateUrlState();
    } catch (e) {
        err.textContent = e.message || e;
    }
});
