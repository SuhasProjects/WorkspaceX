"use client";

import { useState, useSyncExternalStore } from "react";

function subscribeDate(callback: () => void) {
  const timer = window.setInterval(callback, 60000);
  return () => window.clearInterval(timer);
}
function currentDate() { return new Date().toDateString(); }

export function Calendar() {
  const today = new Date(useSyncExternalStore(subscribeDate, currentDate, () => "Sun Oct 11 2026"));
  const [selectedMonth, setMonth] = useState<Date | null>(null);
  const month = selectedMonth ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const label = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function move(amount: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1)); }

  return <section className="overview-card calendar-panel" aria-labelledby="calendar-heading">
    <div className="section-heading"><div><h2 id="calendar-heading">Calendar</h2><p>{label}</p></div><div className="calendar-controls"><button onClick={() => move(-1)} aria-label="Previous month">←</button><button onClick={() => move(1)} aria-label="Next month">→</button></div></div>
    <div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => { const day = index + 1; const isToday = today && day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear(); return <span key={day} className={isToday ? "calendar-day calendar-today" : "calendar-day"} aria-current={isToday ? "date" : undefined}>{day}</span>; })}
    </div><p className="sample-caption">Calendar overview · event scheduling coming later</p>
  </section>;
}
