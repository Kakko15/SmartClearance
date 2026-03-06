const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

class Logger {
  log(...args) {
    if (isDevelopment) {
      console.log("[LOG]", new Date().toISOString(), ...args);
    }
  }

  error(...args) {
    if (isDevelopment) {
      console.error("[ERROR]", new Date().toISOString(), ...args);
    }

    if (isProduction) {
      this.sendToErrorService("error", args);
    }
  }

  warn(...args) {
    if (isDevelopment) {
      console.warn("[WARN]", new Date().toISOString(), ...args);
    }

    if (isProduction) {
      this.sendToErrorService("warn", args);
    }
  }

  info(...args) {
    if (isDevelopment) {
      console.info("[INFO]", new Date().toISOString(), ...args);
    }
  }

  debug(...args) {
    if (isDevelopment) {
      console.debug("[DEBUG]", new Date().toISOString(), ...args);
    }
  }

  api(method, url, data = null) {
    if (isDevelopment) {
      console.log(`[API] ${method.toUpperCase()} ${url}`, data ? data : "");
    }
  }

  apiError(method, url, error) {
    if (isDevelopment) {
      console.error(`[API ERROR] ${method.toUpperCase()} ${url}`, error);
    }

    if (isProduction) {
      this.sendToErrorService("api_error", { method, url, error });
    }
  }

  sendToErrorService(level, data) {
    try {
      const logs = JSON.parse(localStorage.getItem("error_logs") || "[]");
      logs.push({
        level,
        data: JSON.stringify(data),
        timestamp: new Date().toISOString(),
      });

      if (logs.length > 50) {
        logs.shift();
      }

      localStorage.setItem("error_logs", JSON.stringify(logs));
    } catch (_e) {}
  }

  getErrorLogs() {
    try {
      return JSON.parse(localStorage.getItem("error_logs") || "[]");
    } catch (_e) {
      return [];
    }
  }

  clearErrorLogs() {
    try {
      localStorage.removeItem("error_logs");
    } catch (_e) {}
  }
}

export default new Logger();
