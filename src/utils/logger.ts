// Enhanced logging utility for frontend
export class Logger {
  private static isDev = import.meta.env.DEV;

  static info(message: string, data?: any) {
    if (this.isDev) console.info(`[INFO] ${message}`, data || '');
  }

  static warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || '');
    // In production, send to Sentry here
  }

  static debug(message: string, data?: any) {
    if (this.isDev) console.debug(`[DEBUG] ${message}`, data || '');
  }

  static voice(action: string, data?: any) {
    this.info(`Voice: ${action}`, data);
  }

  static api(endpoint: string, status: number, data?: any) {
    this.info(`API ${endpoint} - ${status}`, data);
  }
}