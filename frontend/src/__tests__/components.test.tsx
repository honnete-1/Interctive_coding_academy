import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/ui/markdown";
import { LoopSimulator } from "@/components/visuals/LoopSimulator";

describe("Markdown", () => {
  it("renders emphasis, code and lists without interpreting HTML", () => {
    const { container } = render(<Markdown text={"Use **print** and `int()`\n\n- one\n- two\n\n<img src=x onerror=alert(1)>"} />);
    expect(container.querySelector("strong")?.textContent).toBe("print");
    expect(container.querySelector("code")?.textContent).toBe("int()");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  it("renders fenced code blocks", () => {
    const { container } = render(<Markdown text={"Try:\n```python\nx = 1\n```"} />);
    expect(container.querySelector("pre")?.textContent).toBe("x = 1");
  });
});

describe("LoopSimulator", () => {
  it("steps through iterations with keyboard-accessible buttons", async () => {
    render(<LoopSimulator config={{ deliveries: { min: 0, max: 5, default: 2 }, pay: { min: 100, max: 1000, default: 500 } }} />);
    const step = screen.getByRole("button", { name: /step$/i });
    await userEvent.click(step); // condition check
    await userEvent.click(step); // first delivery
    expect(screen.getByText("Delivery 1: total grows by 500 to 500.")).toBeInTheDocument();
  });

  it("explains the infinite loop when the bug is enabled", async () => {
    render(<LoopSimulator config={{ deliveries: { min: 0, max: 5, default: 1 }, pay: { min: 100, max: 1000, default: 500 }, max_iterations: 2 }} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /forget to count/i }));
    const step = screen.getByRole("button", { name: /step$/i });
    for (let i = 0; i < 10; i++) if (!step.hasAttribute("disabled")) await userEvent.click(step);
    expect(screen.getByRole("alert")).toHaveTextContent(/infinite loop/);
  });
});
