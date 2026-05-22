import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastContainer, type ToastMessage } from "../Toast";

describe("ToastContainer", () => {
  const mockDismiss = jest.fn();

  const createToasts = (count: number): ToastMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `toast-${i}`,
      text: `Message ${i}`,
      type: ["milestone", "success", "confetti"][i % 3] as ToastMessage["type"],
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when no toasts provided", () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={mockDismiss} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a single toast with correct text", () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Test message", type: "success" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    const toasts = createToasts(3);
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
    expect(screen.getByText("Message 2")).toBeInTheDocument();
  });

  it("applies correct CSS class for milestone type", () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Milestone!", type: "milestone" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    const toast = screen.getByText("Milestone!").closest(".toast");
    expect(toast).toHaveClass("toast--milestone");
  });

  it("applies correct CSS class for success type", () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Success!", type: "success" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    const toast = screen.getByText("Success!").closest(".toast");
    expect(toast).toHaveClass("toast--success");
  });

  it("applies correct CSS class for confetti type", () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Confetti!", type: "confetti" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    const toast = screen.getByText("Confetti!").closest(".toast");
    expect(toast).toHaveClass("toast--confetti");
  });

  it("displays correct emoji for each type", () => {
    const toasts: ToastMessage[] = [
      { id: "1", text: "Milestone", type: "milestone" },
      { id: "2", text: "Success", type: "success" },
      { id: "3", text: "Confetti", type: "confetti" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    expect(screen.getByText("🎉")).toBeInTheDocument();
    expect(screen.getByText("✅")).toBeInTheDocument();
    expect(screen.getByText("🎊")).toBeInTheDocument();
  });

  it("auto-dismisses toast after timeout", async () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Auto dismiss", type: "success" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalledWith("1");
    });
  });

  it("has correct ARIA role for accessibility", () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Accessible", type: "success" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("applies exiting class during dismissal animation", async () => {
    const toasts: ToastMessage[] = [{ id: "1", text: "Exiting", type: "success" }];
    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);
    
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    const toast = screen.getByText("Exiting").closest(".toast");
    expect(toast).toHaveClass("exiting");
  });
});
