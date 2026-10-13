import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/kit/Blocks";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        className="py-24"
        icon={AlertCircle}
        title="This screen could not be shown"
        action={<button className="btn btn-primary" onClick={() => this.setState({ failed: false })}>Try again</button>}
      />
    );
  }
}
