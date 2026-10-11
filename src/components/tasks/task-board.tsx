"use client";

import { useState, type FormEvent } from "react";
import type { Task, TaskStatus } from "@/types/contracts";
import { Icon } from "@/components/dashboard/icon";

const columns: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" }, { status: "in_progress", title: "In progress" }, { status: "done", title: "Done" },
];

interface TaskBoardProps {
  tasks: Task[];
  canEdit: boolean;
  busy: boolean;
  message: string;
  onCreate: (title: string, description: string) => Promise<boolean>;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

export function TaskBoard({ tasks, canEdit, busy, message, onCreate, onStatus, onDelete }: TaskBoardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate(title, description)) {
      setTitle("");
      setDescription("");
    }
  }

  return <section className="section-block" aria-labelledby="tasks-heading">
    <div className="section-heading"><div><h2 id="tasks-heading">Team tasks <span className="count-badge">{tasks.length}</span></h2><p>A little structure for your next big idea.</p></div><span className="section-note">Shared with your team</span></div>
    {canEdit && <form className="task-create" onSubmit={submit}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Add a task" aria-label="Task title" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Optional details" aria-label="Task description" />
      <button type="submit" disabled={busy || !title.trim()}><Icon name="plus" size={14} />{busy ? "Saving…" : "Add task"}</button>
    </form>}
    {message && <p className="feedback error" role="alert">{message}</p>}
    <div className="task-columns">{columns.map(({ status, title: columnTitle }) => {
      const items = tasks.filter((task) => task.status === status);
      return <section key={status} className={`task-column ${status}`} aria-label={columnTitle}><h3><span className="status-dot" />{columnTitle}<span className="column-count">{items.length}</span></h3>
        <div className="task-list">{items.length ? items.map((task) => <article className="task-card" key={task.id}><h4>{task.title}</h4>{task.description && <p>{task.description}</p>}<div className="task-footer"><span className="task-avatar">WZ</span>{canEdit ? <span className="task-actions"><select value={task.status} disabled={busy} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} aria-label={`Status for ${task.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><button type="button" disabled={busy} onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>Delete</button></span> : <span>{status === "done" ? <><Icon name="check" size={13} />Complete</> : "Team task"}</span>}</div></article>) : <p className="empty-column">Nothing here yet.</p>}</div>
      </section>;
    })}</div>
  </section>;
}
