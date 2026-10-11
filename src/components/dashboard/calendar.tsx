"use client";

import { useState, useSyncExternalStore } from "react";
import type { Task } from "@/types/contracts";

function subscribeDate(callback: () => void) {
  const timer = window.setInterval(callback, 60000);
  return () => window.clearInterval(timer);
}
function currentDate() { return new Date().toDateString(); }

export function Calendar({ tasks, selectedDueDate, onSelectDueDate }: {
  tasks: Task[];
  selectedDueDate: string | null;
  onSelectDueDate: (date: string | null) => void;
}) {
  const today = new Date(useSyncExternalStore(subscribeDate, currentDate, () => "Sun Oct 11 2026"));
  const [selectedMonth, setMonth] = useState<Date | null>(null);
  const month = selectedMonth ?? new Date(today.getFullYear(), today.getMonth(), 1);
  const label = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dueTasks = new Map<number, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const [year, taskMonth, day] = task.dueDate.split("-").map(Number);
    if (year === month.getFullYear() && taskMonth === month.getMonth() + 1) {
      dueTasks.set(day, [...(dueTasks.get(day) ?? []), task]);
    }
  }
  function move(amount: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
    onSelectDueDate(null);
  }

  return <section className="overview-card" aria-labelledby="calendar-heading">
    <div className="section-heading"><div><h2 id="calendar-heading">Calendar</h2><p>{label}</p></div><div className="calendar-controls"><button onClick={() => move(-1)} aria-label="Previous month">←</button><button onClick={() => move(1)} aria-label="Next month">→</button></div></div>
    <div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => { const day = index + 1; const isToday = today && day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear(); const scheduled = dueTasks.get(day) ?? []; const titles = scheduled.map((task) => task.title).join(", "); const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const selected = selectedDueDate === date; return <button type="button" key={day} className={`${isToday ? "calendar-day calendar-today" : "calendar-day"}${scheduled.length ? " calendar-has-tasks" : ""}${selected ? " calendar-selected" : ""}`} aria-current={isToday ? "date" : undefined} aria-pressed={selected} aria-label={scheduled.length ? `${date}: ${titles}` : `${date}: no tasks due`} title={titles || "No tasks due"} onClick={() => onSelectDueDate(selected ? null : date)}>{day}{scheduled.length > 0 && <span className="calendar-task-dot" aria-hidden="true" />}</button>; })}
    </div><p className="sample-caption">Dates with a dot have tasks due.</p>
  </section>;
}
