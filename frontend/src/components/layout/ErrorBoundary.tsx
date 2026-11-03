import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the pathname) resets the boundary after navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Catches render errors in the page area so the header/footer stay usable. */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <section role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
          <h1 className="text-2xl text-parchment-50">Something went wrong</h1>
          <p className="text-parchment-400">
            An unexpected error occurred while showing this page.
          </p>
          <button
            type="button"
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-400"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
