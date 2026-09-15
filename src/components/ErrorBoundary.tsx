import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("SpotiYen crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;

    return (
      <div className="min-h-dvh clay-bg flex items-center justify-center px-6">
        <div className="clay max-w-md w-full p-6 text-center" style={{ background: "white" }}>
          <h1 className="text-xl font-extrabold" style={{ color: "var(--ink)" }}>
            SpotiYen hit a snag
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--soft-ink)" }}>
            {this.state.message}
          </p>
          <button
            type="button"
            className="clay-btn mt-5 min-h-12 px-6 text-sm font-bold text-white"
            style={{ background: "var(--clay-rose)" }}
            onClick={() => {
              this.setState({ message: "" });
              window.location.assign("/library");
            }}
          >
            Open library
          </button>
        </div>
      </div>
    );
  }
}
