/** `/v1/me/devices` — a phone the signed-in account uses the app on. */
export interface MyDevice {
  id: string;
  platform: 'ios' | 'android';
  /** The app's bundle id / package name, when the app sent it. */
  appId: string | null;
  /** e.g. `bg`, `en`; what notifications to it should be written in. */
  locale: string | null;
  /** ISO timestamps. */
  createdAt: string;
  lastSeenAt: string;
}
