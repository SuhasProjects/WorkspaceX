import { WidgetPage } from "@/components/dashboard/widget-page";

export default async function Page({ params, searchParams }: { params: Promise<{ widgetId: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ widgetId }, query] = await Promise.all([params, searchParams]);
  return <WidgetPage widgetId={widgetId} preview={query.preview === "1"} />;
}
