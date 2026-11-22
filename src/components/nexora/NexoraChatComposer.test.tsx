import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NexoraChatComposer } from "./NexoraChatComposer";

describe("NexoraChatComposer", () => {
  it("renders a labelled message textarea and keeps send disabled for an empty draft", () => {
    render(
      <form>
        <NexoraChatComposer
          value=""
          onValueChange={vi.fn()}
          placeholder="Write a message..."
          canSend={false}
          sendLabel="Send message"
          leadingAction={<button type="button">Attachments</button>}
        />
      </form>,
    );

    expect(screen.getByRole("textbox", { name: "Write a message..." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("submits on Enter while preserving Shift+Enter for a new line", () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <NexoraChatComposer
          value="Hello"
          onValueChange={vi.fn()}
          placeholder="Write a message..."
          canSend
          sendLabel="Send message"
          leadingAction={<button type="button">Attachments</button>}
        />
      </form>,
    );
    const textarea = screen.getByRole("textbox", { name: "Write a message..." });

    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")).toBeInTheDocument();
  });
});
