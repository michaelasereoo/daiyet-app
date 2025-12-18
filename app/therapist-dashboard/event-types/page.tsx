import EventTypesClient from "./EventTypesClient";

// Middleware already handles authentication
// We'll let the client component fetch data via API route to avoid cookie issues in server components
export default function EventTypesPage() {
  // Return empty initial state - client will fetch via API route
  return <EventTypesClient initialEventTypes={[]} />;
}