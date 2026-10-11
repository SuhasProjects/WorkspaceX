import type { Task } from "@/types/contracts";

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function formatDueTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "done") return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return task.dueDate < today;
}

export function TodoList({ tasks, canEdit, selectedDueDate, onClearDate, onToggle }: { tasks: Task[]; canEdit: boolean; selectedDueDate: string | null; onClearDate: () => void; onToggle: (id: string) => void }) {
  const visibleTasks = selectedDueDate ? tasks.filter((task) => task.dueDate === selectedDueDate) : tasks;
  const done = visibleTasks.filter((task) => task.status === "done").length;
  const dateLabel = selectedDueDate ? formatDueDate(selectedDueDate) : null;
  return <section className="overview-card" aria-labelledby="todo-heading"><div className="section-heading"><div><h2 id="todo-heading">{dateLabel ? `Due ${dateLabel}` : "To-do list"}</h2><p>{done} of {visibleTasks.length} complete · shared tasks</p></div>{selectedDueDate && <button type="button" className="todo-clear-filter" onClick={onClearDate}>Show all</button>}</div>
    <div className="todo-items">{visibleTasks.map((task) => <label className={`todo-item ${task.status === "done" ? "todo-complete" : ""}`} key={task.id}><input type="checkbox" checked={task.status === "done"} disabled={!canEdit} onChange={() => onToggle(task.id)} /><span className="todo-item-copy"><span>{task.title}</span>{task.dueDate && <time className={`task-due ${isOverdue(task) ? "overdue" : ""}`} dateTime={`${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ""}`}>{isOverdue(task) ? "Overdue" : "Due"} {formatDueDate(task.dueDate)}{task.dueTime ? ` at ${formatDueTime(task.dueTime)}` : ""}</time>}</span></label>)}</div>
    {!visibleTasks.length && <p className="empty-column">{selectedDueDate ? "No tasks are due on this date." : "Your list is clear."}</p>}<p className="sample-caption">{selectedDueDate ? "Choose another date or show all tasks." : "Click a calendar date to filter by due date."}</p>
  </section>;
}
