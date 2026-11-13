"""
Delivery-robot simulator (World 0). Programs are plain data, not code, so they are
safe to simulate in-process. The frontend has a mirror implementation for animation
(frontend/src/lib/robot.ts); both are tested against content/robot_fixtures.json.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

DIRS = ["N", "E", "S", "W"]
DELTA = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
MAX_ACTIONS = 500
MAX_BLOCKS = 80
MAX_DEPTH = 3
MAX_REPEAT = 20


class ProgramError(ValueError):
    pass


@dataclass
class RobotState:
    x: int
    y: int
    facing: str
    carrying: bool = False
    delivered: bool = False


@dataclass
class RobotResult:
    success: bool
    outcome: str  # delivered | crashed | invalid_action | incomplete | too_long
    message: str
    actions: int
    blocks: int
    trace: list[dict] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


def parse_program(program, allowed: set[str], depth: int = 0) -> int:
    """Validates structure; returns block count."""
    if not isinstance(program, list):
        raise ProgramError("Program must be a list of blocks.")
    if depth > MAX_DEPTH:
        raise ProgramError("Repeat blocks are nested too deeply.")
    count = 0
    for block in program:
        if not isinstance(block, dict) or "cmd" not in block:
            raise ProgramError("Every block needs a command.")
        cmd = block["cmd"]
        if cmd not in allowed:
            raise ProgramError(f"The '{cmd}' block is not available in this mission.")
        count += 1
        if cmd == "repeat":
            times = block.get("times")
            if not isinstance(times, int) or not 1 <= times <= MAX_REPEAT:
                raise ProgramError(f"Repeat needs a count between 1 and {MAX_REPEAT}.")
            count += parse_program(block.get("body", []), allowed, depth + 1)
    if count > MAX_BLOCKS:
        raise ProgramError("This program has too many blocks.")
    return count


def _find(grid, symbol):
    for y, row in enumerate(grid):
        x = row.find(symbol)
        if x != -1:
            return x, y
    raise ProgramError(f"Map has no '{symbol}'")


def simulate(spec: dict, program: list) -> RobotResult:
    grid = spec["grid"]
    allowed = set(spec.get("allowed", ["forward", "left", "right", "pick", "drop", "repeat"]))
    blocks = parse_program(program, allowed)
    sx, sy = _find(grid, "S")
    package, dest = _find(grid, "P"), _find(grid, "D")
    state = RobotState(sx, sy, spec.get("facing", "E"))
    trace: list[dict] = [{"action": "start", **asdict(state)}]
    actions = 0

    def snapshot(action, ok=True, note=""):
        trace.append({"action": action, "ok": ok, "note": note, **asdict(state)})

    def execute(blocks_):
        nonlocal actions
        for block in blocks_:
            cmd = block["cmd"]
            if cmd == "repeat":
                for _ in range(block["times"]):
                    result = execute(block.get("body", []))
                    if result:
                        return result
                continue
            actions += 1
            if actions > MAX_ACTIONS:
                return ("too_long", "The robot ran out of battery (too many actions).")
            if cmd == "forward":
                dx, dy = DELTA[state.facing]
                nx, ny = state.x + dx, state.y + dy
                if not (0 <= ny < len(grid) and 0 <= nx < len(grid[0])):
                    snapshot(cmd, False, "edge")
                    return ("crashed", f"Step {actions}: the robot drove off the map.")
                if grid[ny][nx] == "#":
                    snapshot(cmd, False, "wall")
                    return ("crashed", f"Step {actions}: the robot bumped into a wall.")
                state.x, state.y = nx, ny
            elif cmd == "left":
                state.facing = DIRS[(DIRS.index(state.facing) - 1) % 4]
            elif cmd == "right":
                state.facing = DIRS[(DIRS.index(state.facing) + 1) % 4]
            elif cmd == "pick":
                if state.carrying or state.delivered or (state.x, state.y) != package:
                    snapshot(cmd, False, "nothing")
                    return ("invalid_action", f"Step {actions}: there is no package to pick up here.")
                state.carrying = True
            elif cmd == "drop":
                if not state.carrying or (state.x, state.y) != dest:
                    snapshot(cmd, False, "wrong_place")
                    return ("invalid_action", f"Step {actions}: this is not the delivery point (or the robot has no package).")
                state.carrying, state.delivered = False, True
            snapshot(cmd)
        return None

    failure = execute(program)
    if failure:
        outcome, message = failure
        return RobotResult(False, outcome, message, actions, blocks, trace)
    max_blocks = spec.get("max_blocks")
    if state.delivered and max_blocks and blocks > max_blocks:
        return RobotResult(False, "too_long", f"Delivered! Now make it shorter: use at most {max_blocks} blocks (you used {blocks}). Try a repeat block.", actions, blocks, trace)
    if state.delivered:
        return RobotResult(True, "delivered", "Package delivered!", actions, blocks, trace)
    if state.carrying:
        return RobotResult(False, "incomplete", "The robot has the package but has not delivered it.", actions, blocks, trace)
    return RobotResult(False, "incomplete", "The program ended before the package was picked up.", actions, blocks, trace)
