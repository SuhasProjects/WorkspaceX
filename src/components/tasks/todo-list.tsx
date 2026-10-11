import type { Task } from "@/types/contracts";

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "done") return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return task.dueDate < today;
}

export function TodoList({ tasks, canEdit, onToggle }: { tasks: Task[]; canEdit: boolean; onToggle: (id: string) => void }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return <section className="overview-card todo-panel" aria-labelledby="todo-heading"><div className="section-heading"><div><h2 id="todo-heading">To-do list</h2><p>{done} of {tasks.length} complete · shared tasks</p></div></div>
    <div className="todo-items">{tasks.map((task) => <label className={`todo-item ${task.status === "done" ? "todo-complete" : ""}`} key={task.id}><input type="checkbox" checked={task.status === "done"} disabled={!canEdit} onChange={() => onToggle(task.id)} /><span className="todo-item-copy"><span>{task.title}</span>{task.dueDate && <time className={`task-due ${isOverdue(task) ? "overdue" : ""}`} dateTime={task.dueDate}>{isOverdue(task) ? "Overdue" : "Due"} {formatDueDate(task.dueDate)}</time>}</span></label>)}</div>
    {!tasks.length && <p className="empty-column">Your list is clear.</p>}<p className="sample-caption">Changes update the shared board for everyone.</p>
  </section>;
}
