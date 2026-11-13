import { describe, expect, it } from "vitest";
import fixtures from "../../../backend/content/robot_fixtures.json";
import { levelInfo } from "@/lib/progress";
import { countBlocks, simulate, toPython } from "@/lib/robot";
import type { RobotBlock, RobotSpec } from "@/lib/types";
import { evaluate, toPython as logicToPython, type LogicConfig } from "@/components/visuals/LogicPlayground";
import { buildFrames } from "@/components/visuals/LoopSimulator";

describe("robot simulator mirrors the server", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const r = simulate(c.spec as RobotSpec, c.program as RobotBlock[]);
      expect(r.outcome).toBe(c.outcome);
      expect(r.actions).toBe(c.actions);
    });
  }

  it("counts nested blocks and translates to Python", () => {
    const program: RobotBlock[] = [{ cmd: "repeat", times: 3, body: [{ cmd: "forward" }] }, { cmd: "pick" }];
    expect(countBlocks(program)).toBe(3);
    expect(toPython(program)).toBe("for step in range(3):\n    robot.forward()\nrobot.pick()");
  });
});

describe("levels match backend progression.level_info", () => {
  it.each([
    [0, 1], [99, 1], [100, 2], [299, 2], [300, 3], [600, 4], [1000, 5],
  ])("%i XP is level %i", (xp, level) => {
    expect(levelInfo(xp).level).toBe(level);
  });
});

const momo: LogicConfig = {
  inputs: [{ name: "balance", label: "b", min: 0, max: 1, default: 0 }, { name: "amount", label: "a", min: 0, max: 1, default: 0 }],
  branches: [
    { condition: { left: "amount", op: "<=", right: 0 }, result: "Invalid amount" },
    { condition: { left: "amount", op: ">", right: { var: "balance" } }, result: "Insufficient balance" },
  ],
  else: { result: "Approved" },
};

describe("logic playground", () => {
  it("takes the first true branch, top to bottom", () => {
    expect(evaluate(momo, { balance: 5000, amount: 5000 }).taken).toBe(2);
    expect(evaluate(momo, { balance: 5000, amount: 6000 }).taken).toBe(1);
    expect(evaluate(momo, { balance: 5000, amount: -5 }).taken).toBe(0);
  });

  it("generates the equivalent Python program", () => {
    expect(logicToPython(momo, { balance: 1, amount: 2 })).toBe(
      'balance = 1\namount = 2\nif amount <= 0:\n    print("Invalid amount")\nelif amount > balance:\n    print("Insufficient balance")\nelse:\n    print("Approved")',
    );
  });
});

describe("loop simulator", () => {
  it("finishes a correct while loop with the right total", () => {
    const { frames, stopped } = buildFrames(3, 500, false, 25);
    expect(stopped).toBe(false);
    expect(frames.at(-1)).toMatchObject({ total: 1500, delivered: 3, count: 4 });
  });

  it("stops an infinite loop at the iteration limit", () => {
    const { stopped, frames } = buildFrames(3, 500, true, 10);
    expect(stopped).toBe(true);
    expect(frames.at(-1)?.count).toBe(1);
  });
});
