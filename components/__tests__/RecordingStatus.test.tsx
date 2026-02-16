import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecordingStatus } from "../voice/RecordingStatus";

describe("RecordingStatus", () => {
  it("renders nothing when not recording", () => {
    const { container } = render(
      <RecordingStatus isRecording={false} isPaused={false} duration={0} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders duration when recording", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={false} duration={45} />
    );
    expect(screen.getByText("0:45")).toBeInTheDocument();
  });

  it("formats duration with zero-padded seconds", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={false} duration={5} />
    );
    expect(screen.getByText("0:05")).toBeInTheDocument();
  });

  it("formats minutes correctly", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={false} duration={90} />
    );
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("shows max duration indicator", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={false} duration={0} />
    );
    expect(screen.getByText("/ 2:00")).toBeInTheDocument();
  });

  it("shows 'Paused' label when paused", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={true} duration={30} />
    );
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("does not show 'Paused' label when actively recording", () => {
    render(
      <RecordingStatus isRecording={true} isPaused={false} duration={30} />
    );
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });
});
