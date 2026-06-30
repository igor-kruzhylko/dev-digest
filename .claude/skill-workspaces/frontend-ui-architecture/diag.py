#!/usr/bin/env python3
"""Diagnostic: run `claude -p` in the REAL project root and dump every tool_use
(name + input snippet) so we can see whether/what skill triggers for a query."""
import json, os, queue, subprocess, sys, threading, time

PROJECT_ROOT = r"C:\Users\ihork\OneDrive\Documents\MyProjects\Neoversity\DevDigest\dev-digest"
query = sys.argv[1] if len(sys.argv) > 1 else "how should i organize a react components folder that has 80 files in it"
model = "claude-opus-4-8"

cmd = ["claude", "-p", query, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--model", model]
env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                        cwd=PROJECT_ROOT, env=env, bufsize=1, text=True, encoding="utf-8", errors="replace")
q = queue.Queue()
def rdr():
    try:
        for line in proc.stdout: q.put(line)
    finally: q.put(None)
threading.Thread(target=rdr, daemon=True).start()

tools = []
start = time.time()
while time.time() - start < 90:
    try: line = q.get(timeout=1.0)
    except queue.Empty: continue
    if line is None: break
    line = line.strip()
    if not line: continue
    try: ev = json.loads(line)
    except json.JSONDecodeError: continue
    if ev.get("type") == "assistant":
        for it in ev.get("message", {}).get("content", []):
            if it.get("type") == "tool_use":
                tools.append((it.get("name"), json.dumps(it.get("input", {}))[:120]))
    elif ev.get("type") == "result":
        break
if proc.poll() is None:
    proc.kill(); proc.wait()

print("QUERY:", query)
if not tools:
    print(">>> NO tool_use at all — Claude answered directly (no skill consulted).")
for name, inp in tools:
    print(f">>> tool_use name={name} input={inp}")
