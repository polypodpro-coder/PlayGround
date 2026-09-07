import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="not-found panel"><h1 className="page-heading">Something interrupted this view.</h1><p className="body-copy">Your browser has not sent a payment. Reload the preview to start again.</p><button className="button" style={{marginTop:20}} onClick={() => window.location.reload()}>Reload preview</button></main>;
    return this.props.children;
  }
}
