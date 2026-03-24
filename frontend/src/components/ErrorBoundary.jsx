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
      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      return (
        <div
          className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${isDark ? "from-gray-900 to-gray-950" : "from-gray-50 to-gray-100"}`}
        >
          <div className="max-w-2xl w-full mx-4">
            <div
              className={`rounded-3xl shadow-2xl p-8 md:p-12 border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
            >
              <div className="flex justify-center mb-6">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center ${isDark ? "bg-red-500/20" : "bg-red-100"}`}
                >
                  <svg
                    className={`w-10 h-10 ${isDark ? "text-red-400" : "text-red-600"}`}
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

              <h1
                className={`text-3xl md:text-4xl font-bold text-center mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Oops! Something went wrong
              </h1>

              <p
                className={`text-center mb-8 text-lg ${isDark ? "text-gray-300" : "text-gray-600"}`}
              >
                We&apos;re sorry for the inconvenience. The application
                encountered an unexpected error.
              </p>

              {import.meta.env.DEV && this.state.error && (
                <div
                  className={`mb-8 p-4 border rounded-xl ${isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200"}`}
                >
                  <p
                    className={`text-sm font-bold mb-2 ${isDark ? "text-red-300" : "text-red-900"}`}
                  >
                    Error Details (Dev Mode):
                  </p>
                  <p
                    className={`text-xs font-mono break-all ${isDark ? "text-red-200" : "text-red-800"}`}
                  >
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary
                        className={`text-xs cursor-pointer ${isDark ? "text-red-300 hover:text-red-200" : "text-red-700 hover:text-red-900"}`}
                      >
                        Stack Trace
                      </summary>
                      <pre
                        className={`text-xs mt-2 overflow-auto max-h-40 ${isDark ? "text-red-200" : "text-red-800"}`}
                      >
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
                  className={`font-bold py-3 px-8 rounded-full transition-all ${isDark ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                >
                  Refresh Page
                </button>
              </div>

              <p
                className={`text-center text-sm mt-8 ${isDark ? "text-gray-500" : "text-gray-500"}`}
              >
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
