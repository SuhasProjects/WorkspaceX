import type { Task, TaskStatus } from "@/types/contracts";
import { Icon } from "@/components/dashboard/icon";

const columns: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" }, { status: "in_progress", title: "In progress" }, { status: "done", title: "Done" },
];

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return <section className="section-block" aria-labelledby="tasks-heading">
    <div className="section-heading"><div><h2 id="tasks-heading">Team tasks <span className="count-badge">{tasks.length}</span></h2><p>A little structure for your next big idea.</p></div><span className="section-note">Sample board</span></div>
    <div className="task-columns">{columns.map(({ status, title }) => {
      const items = tasks.filter((task) => task.status === status);
      return <section key={status} className={`task-column ${status}`} aria-label={title}><h3><span className="status-dot" />{title}<span className="column-count">{items.length}</span></h3>
        <div className="task-list">{items.length ? items.map((task) => <article className="task-card" key={task.id}><h4>{task.title}</h4><p>{task.description}</p><div className="task-footer"><span className="task-avatar">LT</span><span>{status === "done" ? <><Icon name="check" size={13} />Complete</> : "Launch team"}</span></div></article>) : <p className="empty-column">Nothing here yet.</p>}</div>
      </section>;
    })}</div>
  </section>;
}
