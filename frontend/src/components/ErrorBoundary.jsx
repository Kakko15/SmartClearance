import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error("Error caught by boundary:", error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-2xl w-full mx-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-200">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
                Oops! Something went wrong
              </h1>

              <p className="text-gray-600 text-center mb-8 text-lg">
                We're sorry for the inconvenience. The application encountered
                an unexpected error.
              </p>

              {import.meta.env.DEV && this.state.error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm font-bold text-red-900 mb-2">
                    Error Details (Dev Mode):
                  </p>
                  <p className="text-xs text-red-800 font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-700 cursor-pointer hover:text-red-900">
                        Stack Trace
                      </summary>
                      <pre className="text-xs text-red-800 mt-2 overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={this.handleReset}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-green-500/30 transition-all hover:scale-105"
                >
                  Return to Home
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-full transition-all"
                >
                  Refresh Page
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-8">
                If this problem persists, please contact support or try again
                later.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
