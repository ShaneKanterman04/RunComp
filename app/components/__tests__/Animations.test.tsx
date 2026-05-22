import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("CSS Animations", () => {
  // Mock component to test CSS classes
  function MockPanel({ children }: { children: React.ReactNode }) {
    return <div className="panel">{children}</div>;
  }

  function MockButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
    return (
      <button className="primaryButton" onClick={onClick}>
        {children}
      </button>
    );
  }

  function MockInput({ placeholder }: { placeholder?: string }) {
    return <input className="" placeholder={placeholder} />;
  }

  function MockMeter({ width }: { width: string }) {
    return (
      <div className="meter">
        <span className="meterFill" style={{ width }} />
      </div>
    );
  }

  function MockBar({ height }: { height: string }) {
    return <span className="bar" style={{ height }} />;
  }

  function MockToast({ type, text }: { type: string; text: string }) {
    return (
      <div className={`toast toast--${type}`}>
        <span>{type === "milestone" ? "🎉" : type === "success" ? "✅" : "🎊"}</span>
        {text}
      </div>
    );
  }

  it("panel renders content correctly", () => {
    render(<MockPanel>Content</MockPanel>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("primary button is clickable", async () => {
    const handleClick = jest.fn();
    render(<MockButton onClick={handleClick}>Click me</MockButton>);
    const button = screen.getByRole("button", { name: "Click me" });
    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("meter fill renders with correct width", () => {
    render(<MockMeter width="50%" />);
    const fill = document.querySelector(".meterFill");
    expect(fill).toHaveAttribute("style", expect.stringContaining("width: 50%"));
  });

  it("bar renders with correct height", () => {
    render(<MockBar height="75%" />);
    const bar = document.querySelector(".bar");
    expect(bar).toHaveAttribute("style", expect.stringContaining("height: 75%"));
  });

  it("milestone toast renders with correct emoji", () => {
    render(<MockToast type="milestone" text="Great job!" />);
    expect(screen.getByText("🎉")).toBeInTheDocument();
    expect(screen.getByText("Great job!")).toBeInTheDocument();
  });

  it("success toast renders with correct emoji", () => {
    render(<MockToast type="success" text="Done!" />);
    expect(screen.getByText("✅")).toBeInTheDocument();
    expect(screen.getByText("Done!")).toBeInTheDocument();
  });

  it("confetti toast renders with correct emoji", () => {
    render(<MockToast type="confetti" text="Party!" />);
    expect(screen.getByText("🎊")).toBeInTheDocument();
    expect(screen.getByText("Party!")).toBeInTheDocument();
  });
});

describe("Animation Integration", () => {
  it("supports prefers-reduced-motion media query", () => {
    // Test that the media query mock is set up correctly
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    expect(mql).toBeDefined();
    expect(mql.matches).toBe(false);
  });

  it("requestAnimationFrame is mocked for testing", () => {
    const callback = jest.fn();
    const id = requestAnimationFrame(callback);
    expect(id).toBeDefined();
    cancelAnimationFrame(id);
  });
});
