declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
  };
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp || null;
}

export function getTelegramUser() {
  const wa = getTelegramWebApp();
  return wa?.initDataUnsafe?.user || null;
}

export function initTelegramApp() {
  const wa = getTelegramWebApp();
  if (wa) {
    wa.ready();
    wa.expand();
  }
}

export function hapticFeedback(type: "light" | "medium" | "heavy" = "light") {
  const wa = getTelegramWebApp();
  wa?.HapticFeedback?.impactOccurred(type);
}

export function hapticNotification(type: "success" | "warning" | "error" = "success") {
  const wa = getTelegramWebApp();
  wa?.HapticFeedback?.notificationOccurred(type);
}

export function isTelegramContext(): boolean {
  return !!window.Telegram?.WebApp?.initData;
}
