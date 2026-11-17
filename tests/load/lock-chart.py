"""Vẽ biểu đồ cho thí nghiệm so sánh cách khóa (cải tiến 3).

Cách chạy (ở thư mục tests, cần Python có matplotlib):
    python load/lock-chart.py load/results/lock-compare-pool10-....json load/results/lock-compare-pool20-....json
Ảnh lưu vào docs/improvements/06-lock-comparison.png.
"""
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

SCENARIOS = ["last-seat", "empty-section", "spread"]
SCENARIO_LABELS = ["Giành chỗ cuối\n(39/40, 100 người)", "Lớp trống\n(0/40, 100 người)", "Ít tranh chấp\n(10 lớp, 100 người)"]
STRATEGIES = ["none", "for-update", "serializable"]
STRATEGY_LABELS = {"none": "Không khóa", "for-update": "FOR UPDATE (đang dùng)", "serializable": "SERIALIZABLE + thử lại"}
COLORS = {"none": "#c0392b", "for-update": "#1f6fb2", "serializable": "#e0a800"}


def load(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = {(s["scenario"], s["strategy"]): s for s in data["summary"]}
    return data["settings"]["poolSize"], rows


def bars(ax, rows, field, title, ylabel):
    width = 0.26
    for i, strategy in enumerate(STRATEGIES):
        values = [rows[(scenario, strategy)][field] for scenario in SCENARIOS]
        positions = [x + (i - 1) * width for x in range(len(SCENARIOS))]
        drawn = ax.bar(positions, values, width, label=STRATEGY_LABELS[strategy], color=COLORS[strategy])
        ax.bar_label(drawn, fmt="%g", fontsize=8, padding=2)
    ax.set_xticks(range(len(SCENARIOS)), SCENARIO_LABELS, fontsize=8)
    ax.set_title(title, fontsize=10)
    ax.set_ylabel(ylabel, fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)


def main():
    results = dict(load(path) for path in sys.argv[1:])
    low, high = min(results), max(results)
    fig, axes = plt.subplots(2, 2, figsize=(12, 8.5))
    bars(axes[0][0], results[low], "oversoldAvg", f"(a) Số sinh viên vượt sức chứa – {low} kết nối", "người (trung bình 5 lần)")
    bars(axes[0][1], results[high], "oversoldAvg", f"(b) Số sinh viên vượt sức chứa – {high} kết nối", "người (trung bình 5 lần)")
    bars(axes[1][0], results[low], "avgMs", f"(c) Thời gian xử lý trung bình – {low} kết nối", "mili giây")
    bars(axes[1][1], results[high], "retriesAvg", f"(d) Số lần thử lại do xung đột – {high} kết nối", "lần / 100 yêu cầu")
    handles, labels = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", ncol=3, frameon=False, fontsize=10)
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    out = Path(__file__).resolve().parents[2] / "docs" / "improvements" / "06-lock-comparison.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=150)
    print(f"Đã lưu {out}")


if __name__ == "__main__":
    main()
