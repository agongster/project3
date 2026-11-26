/**
 * Which findings are bosses (SPEC section F3), checked with the real Ruff:
 * every rule promoted in rules.ts really fires on the code it describes and
 * becomes the boss of its family — a leaked secret (Key Thief), input that
 * becomes code (Eval Serpent), a file Python refuses to compile (Glitch King).
 */
import { describe, expect, it } from "vitest";
import { ruleInfo } from "@/lib/analysis/rules";
import { traitLine } from "@/lib/analysis/traits";
import type { MonsterKind } from "@/lib/types";
import { createNodeLint } from "./nodeLint";

const lint = createNodeLint();

/** Each promoted rule with a snippet that triggers it and the boss it must become. */
const PROMOTED: { code: string; boss: MonsterKind; source: string }[] = [
  { code: "S201", boss: "evalSerpent", source: "from flask import Flask\napp = Flask(__name__)\napp.run(debug=True)\n" },
  { code: "S302", boss: "evalSerpent", source: "import marshal\nmarshal.loads(b'')\n" },
  { code: "S609", boss: "evalSerpent", source: "import subprocess\nsubprocess.Popen('tar cf x *', shell=True)\n" },
  { code: "S612", boss: "evalSerpent", source: "import logging.config\nlogging.config.listen(9999)\n" },
  { code: "S501", boss: "keyThief", source: "import requests\nrequests.get('https://x', verify=False, timeout=3)\n" },
  { code: "S323", boss: "keyThief", source: "import ssl\nssl._create_unverified_context()\n" },
  { code: "S507", boss: "keyThief", source: "import paramiko\nc = paramiko.SSHClient()\nc.set_missing_host_key_policy(paramiko.AutoAddPolicy())\n" },
  { code: "F701", boss: "glitchKing", source: "break\n" },
  { code: "F702", boss: "glitchKing", source: "continue\n" },
  { code: "F704", boss: "glitchKing", source: "yield 1\n" },
  { code: "F706", boss: "glitchKing", source: "return 1\n" },
  { code: "F622", boss: "glitchKing", source: "*a, *b = [1, 2]\n" },
  { code: "F707", boss: "glitchKing", source: "try:\n    pass\nexcept:\n    pass\nexcept ValueError:\n    pass\n" },
  { code: "PLE1142", boss: "glitchKing", source: "async def g():\n    pass\n\n\ndef f():\n    await g()\n" },
  { code: "PLE0118", boss: "glitchKing", source: "def f():\n    print(x)\n    global x\n" },
  { code: "PLE0117", boss: "glitchKing", source: "def f():\n    nonlocal zz\n" },
];

describe("boss rules", () => {
  for (const { code, boss, source } of PROMOTED) {
    it(`${code} fires on real code and becomes a ${boss}`, () => {
      const found = lint(source).find((d) => d.code === code);
      expect(found, `Ruff did not report ${code}`).toBeDefined();
      const info = ruleInfo(code);
      expect(info).toMatchObject({ monster: boss, severity: "boss" });
      expect(traitLine({ code, monster: info.monster, message: found!.message, snippet: [] })).not.toBeNull();
    });
  }

  it("keeps the lower-danger security traps as elites", () => {
    for (const code of ["S103", "S104", "S108", "S113", "S202", "S324", "S701"]) expect(ruleInfo(code).severity, code).toBe("elite");
  });

  it("gives the compile errors the syntax category, like a syntax error", () => {
    for (const { code, boss } of PROMOTED) if (boss === "glitchKing") expect(ruleInfo(code).category).toBe("syntax");
  });
});
