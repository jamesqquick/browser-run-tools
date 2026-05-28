export interface BrowserBinding {
  quickAction(action: string, options: Record<string, unknown>): Promise<Response>;
}
