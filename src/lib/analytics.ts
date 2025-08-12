// Lightweight analytics dispatcher (PostHog optional)
export type AnalyticsEvent =
  | { name: 'view_item'; properties: { id: string; title?: string; category?: string } }
  | { name: 'bid_place'; properties: { lotId: string; amount: number } }
  | { name: 'begin_checkout'; properties: { orderId: string; valueCents: number } }
  | { name: 'purchase'; properties: { orderId: string; valueCents: number } }
  | { name: 'show_follow'; properties: { showId: string } };

export function track(event: AnalyticsEvent) {
  try {
    // If PostHog loaded globally, forward; else console log
    const ph = (window as any).posthog;
    if (ph && typeof ph.capture === 'function') {
      ph.capture(event.name, event.properties);
    } else {
      console.debug('[analytics]', event.name, event.properties);
    }
  } catch (e) {
    console.debug('[analytics:error]', e);
  }
}
