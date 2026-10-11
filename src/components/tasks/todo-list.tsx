import type { Task } from "@/types/contracts";

export function TodoList({ tasks, canEdit, onToggle }: { tasks: Task[]; canEdit: boolean; onToggle: (id: string) => void }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return <section className="overview-card" aria-labelledby="todo-heading"><div className="section-heading"><div><h2 id="todo-heading">To-do list</h2><p>{done} of {tasks.length} complete · shared tasks</p></div></div>
    <div className="todo-items">{tasks.map((task) => <label className={`todo-item ${task.status === "done" ? "todo-complete" : ""}`} key={task.id}><input type="checkbox" checked={task.status === "done"} disabled={!canEdit} onChange={() => onToggle(task.id)} /><span>{task.title}</span></label>)}</div>
    {!tasks.length && <p className="empty-column">Your list is clear.</p>}<p className="sample-caption">Changes update the shared board for everyone.</p>
  </section>;
}
