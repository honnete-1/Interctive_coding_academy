/**
 * Client mirror of backend/apps/grader/robot.py, used for instant animation.
 * The server re-simulates every submission; this copy never decides grades.
 * Both implementations are tested against backend/content/robot_fixtures.json.
 */
import type { RobotBlock, RobotResult, RobotSpec, RobotTraceStep } from "./types";

const DIRS = ["N", "E", "S", "W"] as const;
const DELTA: Record<string, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const MAX_ACTIONS = 500;

export function countBlocks(program: RobotBlock[]): number {
  return program.reduce((n, b) => n + 1 + (b.cmd === "repeat" ? countBlocks(b.body ?? []) : 0), 0);
}

function find(grid: string[], symbol: string): [number, number] {
  for (let y = 0; y < grid.length; y++) {
    const x = grid[y].indexOf(symbol);
    if (x !== -1) return [x, y];
  }
  throw new Error(`Map has no ${symbol}`);
}

export function simulate(spec: RobotSpec, program: RobotBlock[]): RobotResult {
  const grid = spec.grid;
  const [sx, sy] = find(grid, "S");
  const pkg = find(grid, "P");
  const dest = find(grid, "D");
  const state = { x: sx, y: sy, facing: (spec.facing ?? "E") as RobotTraceStep["facing"], carrying: false, delivered: false };
  const trace: RobotTraceStep[] = [{ action: "start", ...state }];
  const blocks = countBlocks(program);
  let actions = 0;
  const snap = (action: string, ok = true, note = "") => trace.push({ action, ok, note, ...state });

  function exec(list: RobotBlock[]): [string, string] | null {
    for (const block of list) {
      if (block.cmd === "repeat") {
        for (let i = 0; i < (block.times ?? 1); i++) {
          const r = exec(block.body ?? []);
          if (r) return r;
        }
        continue;
      }
      actions++;
      if (actions > MAX_ACTIONS) return ["too_long", "The robot ran out of battery (too many actions)."];
      if (block.cmd === "forward") {
        const [dx, dy] = DELTA[state.facing];
        const nx = state.x + dx;
        const ny = state.y + dy;
        if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length) {
          snap("forward", false, "edge");
          return ["crashed", `Step ${actions}: the robot drove off the map.`];
        }
        if (grid[ny][nx] === "#") {
          snap("forward", false, "wall");
          return ["crashed", `Step ${actions}: the robot bumped into a wall.`];
        }
        state.x = nx;
        state.y = ny;
      } else if (block.cmd === "left") {
        state.facing = DIRS[(DIRS.indexOf(state.facing) + 3) % 4];
      } else if (block.cmd === "right") {
        state.facing = DIRS[(DIRS.indexOf(state.facing) + 1) % 4];
      } else if (block.cmd === "pick") {
        if (state.carrying || state.delivered || state.x !== pkg[0] || state.y !== pkg[1]) {
          snap("pick", false, "nothing");
          return ["invalid_action", `Step ${actions}: there is no package to pick up here.`];
        }
        state.carrying = true;
      } else if (block.cmd === "drop") {
        if (!state.carrying || state.x !== dest[0] || state.y !== dest[1]) {
          snap("drop", false, "wrong_place");
          return ["invalid_action", `Step ${actions}: this is not the delivery point (or the robot has no package).`];
        }
        state.carrying = false;
        state.delivered = true;
      }
      snap(block.cmd);
    }
    return null;
  }

  const failure = exec(program);
  const result = (success: boolean, outcome: string, message: string): RobotResult => ({ success, outcome, message, actions, blocks, trace });
  if (failure) return result(false, failure[0], failure[1]);
  if (state.delivered && spec.max_blocks && blocks > spec.max_blocks)
    return result(false, "too_long", `Delivered! Now make it shorter: use at most ${spec.max_blocks} blocks (you used ${blocks}). Try a repeat block.`);
  if (state.delivered) return result(true, "delivered", "Package delivered!");
  if (state.carrying) return result(false, "incomplete", "The robot has the package but has not delivered it.");
  return result(false, "incomplete", "The program ended before the package was picked up.");
}

/** Python equivalent of a block program (World 0 → World 1 bridge). */
export function toPython(program: RobotBlock[], indent = 0): string {
  const pad = "    ".repeat(indent);
  return program
    .map((b) =>
      b.cmd === "repeat"
        ? `${pad}for step in range(${b.times ?? 1}):\n${(b.body ?? []).length ? toPython(b.body ?? [], indent + 1) : `${pad}    pass`}`
        : `${pad}robot.${b.cmd}()`,
    )
    .join("\n");
}
