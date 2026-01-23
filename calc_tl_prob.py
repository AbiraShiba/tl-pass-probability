import numpy as np


def calculate_tl_stats_distinct_optimized(
    scenarios: list[dict], threshold_hours: float, fps=1
):
    """
    段階ごとにイベント構成が異なる場合のTL統計計算（ループ統合・高速化版）

    Args:
        scenarios (list of dict): 各段階の設定リスト
            [
                {"probs": [75, 75], "times": [10, 25], "success_time": 90}, # 1凸目
                {"probs": [50, 50], "times": [5, 5],   "success_time": 60}  # 2凸目
            ]
    """

    # --- 前処理: 計算に必要なデータを全て事前計算して配列に格納 ---
    stage_params = []
    total_min_frames = 0
    total_expected_time = 0.0

    for s in scenarios:
        # 確率・時間の変換
        p_list = np.array(s["probs"], dtype=float) * 0.01
        T_fail_list = np.array(s["times"], dtype=float)
        success_time = s["success_time"]

        # 基礎確率
        q_success = np.prod(p_list)

        # 失敗確率分布
        q_fails = []
        current_p = 1.0
        for p in p_list:
            q_fails.append(current_p * (1.0 - p))
            current_p *= p
        q_fails = np.array(q_fails)

        # フレーム変換
        T_fail_frames = np.round(T_fail_list * fps).astype(int)
        stage_succ_frames = int(round(success_time * fps))

        # 期待値加算 (各段階の期待値を合計)
        expected_waste = np.sum(q_fails * T_fail_list)
        total_expected_time += success_time + (expected_waste / q_success)

        total_min_frames += stage_succ_frames

        # パラメータを保存
        stage_params.append(
            {"q_succ": q_success, "q_fails": q_fails, "t_fails": T_fail_frames}
        )

    # --- 制限時間の判定 ---
    threshold_sec = threshold_hours * 3600
    threshold_frame = int(round(threshold_sec * fps))
    max_waste_frames = threshold_frame - total_min_frames

    if max_waste_frames < 0:
        return 0.0, total_expected_time

    # --- DP計算 (ループ統合版) ---
    num_stages = len(scenarios)

    # dp[stage][t]
    dp = np.zeros((num_stages, max_waste_frames + 1), dtype=float)

    # 初期状態: 1段階目(index 0)が無駄時間0でクリアできる確率は q_succ そのもの
    dp[0][0] = stage_params[0]["q_succ"]

    # === 時間 t のループ (1回だけ回す) ===
    for t in range(max_waste_frames + 1):
        # 各段階(ステージ)ごとの処理
        for i in range(num_stages):
            params = stage_params[i]

            # --- リトライ処理 ---
            # 各ステージ固有の失敗時間・確率を使って計算
            # dp[i][t] += dp[i][t - fail_time] * fail_prob
            for Tn, qn in zip(params["t_fails"], params["q_fails"]):
                if t >= Tn:
                    dp[i][t] += qn * dp[i][t - Tn]

            # --- 段階移行 (前のステージ完了 -> 次のステージへ) ---
            # ステージ0には「前のステージ」がないので、i > 0 の時のみ
            if i > 0:
                # 前のステージ(i-1)が今(t)終わった確率 × 今のステージ(i)がストレート成功する確率
                # これを今のステージの完了確率に上乗せ
                prev_finish_prob = dp[i - 1][t]
                current_straight_succ = params["q_succ"]

                dp[i][t] += prev_finish_prob * current_straight_succ

    # 最終段階の累積確率
    prob_within_time = np.sum(dp[-1])

    return prob_within_time, total_expected_time


scenarios = [
    {"probs": [7, 5], "times": [10, 25], "success_time": 90},  # 1凸目
    {"probs": [5, 5], "times": [5, 5], "success_time": 60},  # 2凸目
]
threshold_hours = 1.0
prob, _ = calculate_tl_stats_distinct_optimized(scenarios, threshold_hours)
print(prob * 100)
