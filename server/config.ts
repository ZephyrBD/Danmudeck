import { loadAuth, loadSettings, type AuthData, type AppSettings, type OverlaySettings } from './settings';

// 配置唯一来源：server/data/settings.json + server/data/auth.json（plan §4.4）
// .env 不再读取；PORT 仍来自进程环境变量（部署参数）

export const settings: AppSettings = loadSettings();
export const auth: AuthData = loadAuth();

export type OverlayConfig = OverlaySettings;

const config = {
  roomId: settings.roomId,
  port: Number(process.env.PORT || 3000),
  cookie: auth.cookie,
  uid: auth.uid,
  queueEnterKey: settings.queue.enterKey,
  queueLeaveKey: settings.queue.leaveKey,
  overlay: settings.overlay,
};

export default config;
