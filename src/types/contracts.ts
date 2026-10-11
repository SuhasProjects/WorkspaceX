/** Browser-safe contracts. Never import server credentials or database records here. */
export type Role = "admin" | "member";
export type Theme = "light" | "dark";
export type TaskStatus = "todo" | "in_progress" | "done";
export type WidgetSize = "small" | "medium" | "large";
/** Gallery footprint in grid units (12 columns wide; rows are fixed-height units). */
export interface WidgetSpan { cols: number; rows: number }
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Plan = "free" | "pro" | "team";
/** Lifecycle as reported by the billing provider. Only "active" unlocks a paid plan. */
export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";
export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  /** Provider-side subscription identifier; absent until checkout completes. */
  externalId?: string;
  updatedAt: string;
}
export interface Workspace { id: string; name: string; role: Role; plan: Plan; subscription: Subscription }
export interface BillingSummary {
  plan: Plan;
  subscription: Subscription;
  widgetLimit: number | null;
  widgetCount: number;
  generationLimit: number;
  generationCount: number;
  /** False while the billing provider is a placeholder. */
  checkoutAvailable: boolean;
}
export interface CheckoutRequest { plan: Exclude<Plan, "free"> }
export interface CheckoutResult { url: string }
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
export interface GeneratedWidget { title: string; html: string; size?: WidgetSize }
export interface Widget extends GeneratedWidget { id: string; size: WidgetSize; span?: WidgetSpan; createdAt: string }
export interface ApiError { code: string; message: string }
export type ApiResponse<T> = { data: T; error?: never } | { error: ApiError; data?: never };

export interface CreateWorkspaceRequest {
  name: string;
  workspaceId?: string;
  adminPassword: string;
  memberPassword: string;
}
export interface LoginRequest { workspaceId: string; password: string }
export interface CreateTaskRequest { title: string; description?: string; dueDate?: string; dueTime?: string; status?: TaskStatus }
export interface UpdateTaskRequest { title?: string; description?: string; dueDate?: string | null; dueTime?: string | null; status?: TaskStatus }
export interface GenerateRequest { prompt: string; baseHtml?: string }
export type SaveWidgetRequest = GeneratedWidget;
export interface UpdateWidgetRequest { size?: WidgetSize; span?: WidgetSpan }
export interface StorageQuery { widgetId: string; key: string }
export interface WriteStorageRequest extends StorageQuery { value: JsonValue }
export interface StorageResult { value: JsonValue; exists: boolean }
export interface SuccessResult { success: true }

/** Values inside ApiResponse.data. Lists deliberately use named fields. */
export interface ApiData {
  workspace: { workspace: Workspace };
  billing: BillingSummary;
  checkout: CheckoutResult;
  tasks: { tasks: Task[] };
  task: { task: Task };
  widgets: { widgets: Widget[] };
  widget: { widget: Widget };
  generation: GeneratedWidget;
  storage: StorageResult;
  success: SuccessResult;
}

export const WIDGET_CHANNEL = "workspacezero.widget.v1" as const;
export type WidgetAction = "getShared" | "setShared" | "getPersonal" | "setPersonal";
export type WidgetRequest = {
  channel: typeof WIDGET_CHANNEL;
  kind: "request";
  requestId: string;
  key: string;
} & (
  | { action: "getShared" | "getPersonal"; value?: never }
  | { action: "setShared" | "setPersonal"; value: JsonValue }
);
export type WidgetResponse = {
  channel: typeof WIDGET_CHANNEL;
  kind: "response";
  requestId: string;
} & ({ ok: true; value: JsonValue } | { ok: false; error: ApiError });
export interface WidgetThemeMessage {
  channel: typeof WIDGET_CHANNEL;
  kind: "theme";
  theme: Theme;
}
/** Proposed renderer boundary; engine/frontend must review before implementation. */
export interface WidgetRendererProps {
  workspaceId: string;
  widgetId: string;
  html: string;
  theme: Theme;
}
export interface WorkspaceSDK {
  getShared(key: string): Promise<JsonValue>;
  setShared(key: string, value: JsonValue): Promise<void>;
  getPersonal(key: string): Promise<JsonValue>;
  setPersonal(key: string, value: JsonValue): Promise<void>;
}
