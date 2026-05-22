import { render, screen, act } from "@testing-library/react";
import { useAnimatedNumber, AnimatedMiles } from "../AnimatedCounter";

// Test component to hook into useAnimatedNumber
function TestComponent({ value, duration }: { value: number; duration?: number }) {
  const display = useAnimatedNumber(value, duration || 100);
  return <span data-testid="counter">{display}</span>;
}

describe("useAnimatedNumber", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at 0 and animates to target value", () => {
    render(<TestComponent value={100} />);
    
    // Should start near 0
    const initial = screen.getByTestId("counter");
    expect(parseFloat(initial.textContent || "0")).toBeLessThan(100);
  });

  it("reaches target value after duration", () => {
    render(<TestComponent value={50} duration={50} />);
    
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByTestId("counter")).toHaveTextContent("50.00");
  });

  it("updates when target value changes", () => {
    const { rerender } = render(<TestComponent value={10} />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender(<TestComponent value={20} />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("counter")).toHaveTextContent("20.00");
  });

  it("formats with correct decimal places", () => {
    render(<TestComponent value={3.14159} duration={50} />);
    
    act(() => {
      jest.advanceTimersByTime(100);
    });

    const counter = screen.getByTestId("counter");
    expect(counter.textContent).toMatch(/^3\.14/);
  });

  it("cancels animation on unmount", () => {
    const cancelAnimationFrameSpy = jest.spyOn(global, "cancelAnimationFrame");
    const { unmount } = render(<TestComponent value={100} />);
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });
});

describe("AnimatedMiles", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders animated miles with correct formatting", () => {
    render(<AnimatedMiles value={5.5} />);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("animated-miles")).toHaveTextContent("5.5 mi");
  });

  it("accepts custom className", () => {
    render(<AnimatedMiles value={10} className="custom-class" />);
    const element = screen.getByTestId("animated-miles");
    expect(element).toHaveClass("custom-class");
  });

  it("animates from 0 to target value", () => {
    render(<AnimatedMiles value={100} />);
    
    // After animation completes
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText((content) => content.includes("100") && content.includes("mi"))).toBeInTheDocument();
  });
});
