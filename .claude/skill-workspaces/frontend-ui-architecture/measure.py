#!/usr/bin/env python3
"""Baseline trigger measurement against the REAL installed skill.

Runs each eval query via `claude -p` from the actual project root (where the skill
is installed), and detects whether Claude consults `frontend-ui-architecture`
(Skill tool with that name, or Read of that skill's files). Early-kills the process
as soon as a trigger is detected to save tokens. Windows-safe (thread reader, no select).
"""
import json, os, queue, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SKILL_NAME = "frontend-ui-architecture"
MODEL = "claude-opus-4-8"
EVAL_SET = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("trigger-eval.json")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name("optimize-baseline.json")
RUNS = 3
WORKERS = 6
TIMEOUT = 75

_print_lock = threading.Lock()


def probe(query: str) -> bool:
    cmd = ["claude", "-p", query, "--output-format", "stream-json",
           "--verbose", "--include-partial-messages", "--model", MODEL]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            cwd=PROJECT_ROOT, env=env, bufsize=1, text=True,
                            encoding="utf-8", errors="replace")
    q: queue.Queue = queue.Queue()

    def rdr():
        try:
            for line in proc.stdout:
                q.put(line)
        finally:
            q.put(None)

    threading.Thread(target=rdr, daemon=True).start()

    result = False
    pending = None          # current Skill/Read tool block being accumulated
    acc = ""
    start = time.time()
    try:
        while time.time() - start < TIMEOUT:
            try:
                line = q.get(timeout=1.0)
            except queue.Empty:
                continue
            if line is None:
                break
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            et = ev.get("type")
            if et == "stream_event":
                se = ev.get("event", {})
                t = se.get("type", "")
                if t == "content_block_start":
                    cb = se.get("content_block", {})
                    if cb.get("type") == "tool_use" and cb.get("name") in ("Skill", "Read"):
                        pending, acc = cb.get("name"), ""
                    else:
                        pending = None  # some other tool; ignore, keep scanning
                elif t == "content_block_delta" and pending:
                    d = se.get("delta", {})
                    if d.get("type") == "input_json_delta":
                        acc += d.get("partial_json", "")
                        if SKILL_NAME in acc:
                            result = True
                            break
                elif t in ("content_block_stop",) and pending:
                    if SKILL_NAME in acc:
                        result = True
                        break
                    pending = None
            elif et == "assistant":
                for it in ev.get("message", {}).get("content", []):
                    if it.get("type") == "tool_use" and it.get("name") in ("Skill", "Read"):
                        if SKILL_NAME in json.dumps(it.get("input", {})):
                            result = True
                if result:
                    break
            elif et == "result":
                break
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
    return result


def measure_query(item: dict) -> dict:
    triggers = [probe(item["query"]) for _ in range(RUNS)]
    rate = sum(triggers) / len(triggers)
    should = item["should_trigger"]
    did_pass = (rate >= 0.5) if should else (rate < 0.5)
    rec = {"query": item["query"], "should_trigger": should,
           "triggers": sum(triggers), "runs": len(triggers),
           "trigger_rate": rate, "pass": did_pass}
    with _print_lock:
        status = "PASS" if did_pass else "FAIL"
        print(f"[{status}] {sum(triggers)}/{len(triggers)} exp={should}: {item['query'][:58]}", flush=True)
    return rec


def main():
    eval_set = json.loads(EVAL_SET.read_text(encoding="utf-8"))
    print(f"Measuring {len(eval_set)} queries x {RUNS} runs against real '{SKILL_NAME}'...", flush=True)
    results = []
    # Parallelize across the run-units (query repeated RUNS times) for speed.
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(measure_query, it): it for it in eval_set}
        for f in as_completed(futs):
            results.append(f.result())

    pos = [r for r in results if r["should_trigger"]]
    neg = [r for r in results if not r["should_trigger"]]
    tp = sum(r["triggers"] for r in pos); pos_runs = sum(r["runs"] for r in pos)
    fp = sum(r["triggers"] for r in neg); neg_runs = sum(r["runs"] for r in neg)
    fn = pos_runs - tp; tn = neg_runs - fp
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 1.0
    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) else 0.0
    pass_count = sum(1 for r in results if r["pass"])

    summary = {
        "skill": SKILL_NAME, "runs_per_query": RUNS,
        "queries_passed": pass_count, "queries_total": len(results),
        "precision": round(precision, 3), "recall": round(recall, 3),
        "accuracy": round(accuracy, 3),
        "false_triggers": [r for r in neg if not r["pass"]],
        "missed_triggers": [r for r in pos if not r["pass"]],
        "results": sorted(results, key=lambda r: (not r["should_trigger"], r["pass"])),
    }
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("\n==== BASELINE ====", flush=True)
    print(f"Queries passed: {pass_count}/{len(results)}", flush=True)
    print(f"Precision={precision:.0%}  Recall={recall:.0%}  Accuracy={accuracy:.0%}", flush=True)
    print(f"Saved: {OUT}", flush=True)


if __name__ == "__main__":
    main()
