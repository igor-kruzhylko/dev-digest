#!/usr/bin/env python3
"""Windows-compatible driver for the skill-creator description optimizer.

The upstream run_eval.py reads `claude -p` output with select.select() + os.read(),
which on Windows raises OSError [WinError 10093] because select only works on sockets,
not pipes. Every trigger probe then fails silently and all positives look like misses.

This driver swaps ONLY the broken piece: it provides a thread-based stdout reader
(win_run_single_query) and a ThreadPoolExecutor-based win_run_eval, monkeypatches them
into scripts.run_loop, and reuses the upstream train/test split, iteration loop, and
improve_description (which already uses subprocess.run and is Windows-safe).

Each trigger probe runs in its OWN throwaway temp project dir containing exactly one
injected command file, so there is zero cross-talk between parallel probes.
"""

import argparse
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

SKILL_CREATOR = r"C:\Users\ihork\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\395d29f7-67b4-4a4f-89ae-776992f9184f\9fd7aefb-fb12-4bfd-bc4d-d6a3fa522a3b\skills\skill-creator"
sys.path.insert(0, SKILL_CREATOR)

import scripts.run_loop as run_loop_mod  # noqa: E402
from scripts.generate_report import generate_html  # noqa: E402
from scripts.utils import parse_skill_md  # noqa: E402


def win_run_single_query(query, skill_name, skill_description, timeout, project_root, model=None):
    """Probe whether `claude -p` triggers the skill, reading stdout via a thread.

    `project_root` is intentionally ignored: we run claude in a fresh temp dir whose
    only available skill is the single injected command, so detection is unambiguous.
    """
    unique_id = uuid.uuid4().hex[:8]
    clean_name = f"{skill_name}-skill-{unique_id}"
    sandbox = Path(tempfile.mkdtemp(prefix="skilltrig_"))
    commands_dir = sandbox / ".claude" / "commands"
    try:
        commands_dir.mkdir(parents=True, exist_ok=True)
        indented_desc = "\n  ".join(skill_description.split("\n"))
        command_content = (
            f"---\ndescription: |\n  {indented_desc}\n---\n\n"
            f"# {skill_name}\n\nThis skill handles: {skill_description}\n"
        )
        (commands_dir / f"{clean_name}.md").write_text(command_content, encoding="utf-8")

        cmd = ["claude", "-p", query, "--output-format", "stream-json",
               "--verbose", "--include-partial-messages"]
        if model:
            cmd.extend(["--model", model])
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            cwd=str(sandbox), env=env, bufsize=1, text=True,
            encoding="utf-8", errors="replace",
        )

        q: queue.Queue = queue.Queue()

        def reader():
            try:
                for line in process.stdout:
                    q.put(line)
            finally:
                q.put(None)

        threading.Thread(target=reader, daemon=True).start()

        result = False
        pending_tool_name = None
        accumulated_json = ""
        start = time.time()

        while True:
            remaining = timeout - (time.time() - start)
            if remaining <= 0:
                break
            try:
                line = q.get(timeout=min(1.0, remaining))
            except queue.Empty:
                continue
            if line is None:
                break
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            et = event.get("type")
            if et == "stream_event":
                se = event.get("event", {})
                se_type = se.get("type", "")
                if se_type == "content_block_start":
                    cb = se.get("content_block", {})
                    if cb.get("type") == "tool_use":
                        tool_name = cb.get("name", "")
                        if tool_name in ("Skill", "Read"):
                            pending_tool_name = tool_name
                            accumulated_json = ""
                        else:
                            result = False
                            break
                elif se_type == "content_block_delta" and pending_tool_name:
                    delta = se.get("delta", {})
                    if delta.get("type") == "input_json_delta":
                        accumulated_json += delta.get("partial_json", "")
                        if clean_name in accumulated_json:
                            result = True
                            break
                elif se_type in ("content_block_stop", "message_stop"):
                    if pending_tool_name:
                        result = clean_name in accumulated_json
                        break
                    if se_type == "message_stop":
                        result = False
                        break
            elif et == "assistant":
                message = event.get("message", {})
                for item in message.get("content", []):
                    if item.get("type") != "tool_use":
                        continue
                    tn = item.get("name", "")
                    ti = item.get("input", {})
                    if tn == "Skill" and clean_name in ti.get("skill", ""):
                        result = True
                    elif tn == "Read" and clean_name in ti.get("file_path", ""):
                        result = True
                break
            elif et == "result":
                break

        if process.poll() is None:
            process.kill()
            process.wait()
        return result
    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


def win_run_eval(eval_set, skill_name, description, num_workers, timeout,
                 project_root, runs_per_query=1, trigger_threshold=0.5, model=None):
    """Thread-based replacement for scripts.run_eval.run_eval (same return shape)."""
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        future_to_item = {}
        for item in eval_set:
            for _ in range(runs_per_query):
                fut = executor.submit(
                    win_run_single_query, item["query"], skill_name, description,
                    timeout, str(project_root), model,
                )
                future_to_item[fut] = item

        query_triggers: dict = {}
        query_items: dict = {}
        for fut in as_completed(future_to_item):
            item = future_to_item[fut]
            qy = item["query"]
            query_items[qy] = item
            query_triggers.setdefault(qy, [])
            try:
                query_triggers[qy].append(fut.result())
            except Exception as e:
                print(f"Warning: query failed: {e}", file=sys.stderr)
                query_triggers[qy].append(False)

    results = []
    for qy, triggers in query_triggers.items():
        item = query_items[qy]
        rate = sum(triggers) / len(triggers)
        should = item["should_trigger"]
        did_pass = (rate >= trigger_threshold) if should else (rate < trigger_threshold)
        results.append({
            "query": qy, "should_trigger": should, "trigger_rate": rate,
            "triggers": sum(triggers), "runs": len(triggers), "pass": did_pass,
        })

    passed = sum(1 for r in results if r["pass"])
    return {
        "skill_name": skill_name, "description": description, "results": results,
        "summary": {"total": len(results), "passed": passed, "failed": len(results) - passed},
    }


# Monkeypatch the broken eval into the upstream loop module.
run_loop_mod.run_eval = win_run_eval


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["eval", "loop"], default="loop")
    p.add_argument("--eval-set", required=True)
    p.add_argument("--skill-path", required=True)
    p.add_argument("--model", required=True)
    p.add_argument("--num-workers", type=int, default=6)
    p.add_argument("--timeout", type=int, default=60)
    p.add_argument("--runs-per-query", type=int, default=3)
    p.add_argument("--trigger-threshold", type=float, default=0.5)
    p.add_argument("--max-iterations", type=int, default=3)
    p.add_argument("--holdout", type=float, default=0.4)
    p.add_argument("--results-dir", default=None)
    args = p.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))
    skill_path = Path(args.skill_path)
    name, original_description, _ = parse_skill_md(skill_path)

    if args.mode == "eval":
        out = win_run_eval(
            eval_set=eval_set, skill_name=name, description=original_description,
            num_workers=args.num_workers, timeout=args.timeout, project_root=skill_path,
            runs_per_query=args.runs_per_query, trigger_threshold=args.trigger_threshold,
            model=args.model,
        )
        s = out["summary"]
        print(f"\nEVAL: {s['passed']}/{s['total']} passed", file=sys.stderr)
        for r in sorted(out["results"], key=lambda r: (r["should_trigger"], r["pass"])):
            status = "PASS" if r["pass"] else "FAIL"
            print(f"  [{status}] rate={r['triggers']}/{r['runs']} expected={r['should_trigger']}: {r['query'][:64]}", file=sys.stderr)
        print(json.dumps(out, indent=2))
        return

    out = run_loop_mod.run_loop(
        eval_set=eval_set, skill_path=skill_path, description_override=None,
        num_workers=args.num_workers, timeout=args.timeout,
        max_iterations=args.max_iterations, runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold, holdout=args.holdout,
        model=args.model, verbose=True,
    )
    results_dir = Path(args.results_dir) if args.results_dir else skill_path.parent.parent / "skill-workspaces" / "frontend-ui-architecture"
    results_dir.mkdir(parents=True, exist_ok=True)
    (results_dir / "optimize-results.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    (results_dir / "optimize-report.html").write_text(generate_html(out, auto_refresh=False, skill_name=name), encoding="utf-8")
    print(json.dumps(out, indent=2))
    print(f"\nSaved results to: {results_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
