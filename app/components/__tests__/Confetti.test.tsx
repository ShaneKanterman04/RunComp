import { render, screen } from "@testing-library/react";
import { Confetti } from "../Confetti";

describe("Confetti", () => {
  // Mock canvas getContext to avoid jsdom errors
  const mockGetContext = jest.fn(() => ({
    clearRect: jest.fn(),
    save: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    globalAlpha: 1,
    fillStyle: "",
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - mocking canvas for jsdom
    HTMLCanvasElement.prototype.getContext = mockGetContext;
  });

  afterEach(() => {
    // @ts-expect-error - restoring canvas prototype
    delete HTMLCanvasElement.prototype.getContext;
  });

  it("renders a canvas element", () => {
    const { container } = render(<Confetti />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas?.tagName.toLowerCase()).toBe("canvas");
  });

  it("has correct CSS class for positioning", () => {
    const { container } = render(<Confetti />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveClass("confettiCanvas");
  });

  it("is hidden from screen readers", () => {
    const { container } = render(<Confetti />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with custom duration and particle count", () => {
    const { container } = render(<Confetti duration={2000} particleCount={200} />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("cleans up animation frame on unmount", () => {
    const cancelAnimationFrameSpy = jest.spyOn(global, "cancelAnimationFrame");
    const { unmount } = render(<Confetti />);
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });
});
