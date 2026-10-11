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
  onCreate: (title: string, description: string, dueDate: string, dueTime: string) => Promise<boolean>;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

export function TaskBoard({ tasks, canEdit, busy, message, onCreate, onStatus, onDelete }: TaskBoardProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate(title, description, dueDate, dueTime)) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
    }
  }

  return <section className="section-block" aria-labelledby="tasks-heading">
    <div className="section-heading"><div><h2 id="tasks-heading">Team tasks <span className="count-badge">{tasks.length}</span></h2></div><span className="section-note">Shared with your team</span></div>
    {canEdit && <form className="task-create" onSubmit={submit}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Add a task" aria-label="Task title" />
      <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Optional details" aria-label="Task description" />
      <input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); if (!event.target.value) setDueTime(""); }} aria-label="Task due date" />
      <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} aria-label="Task due time" disabled={!dueDate} />
      <button type="submit" disabled={busy || !title.trim()}><Icon name="plus" size={14} />{busy ? "Saving…" : "Add task"}</button>
    </form>}
    {message && <p className="feedback error" role="alert">{message}</p>}
    <div className="task-columns">{columns.map(({ status, title: columnTitle }) => {
      const items = tasks.filter((task) => task.status === status);
      return <section key={status} className={`task-column ${status}`} aria-label={columnTitle}><h3><span className="status-dot" />{columnTitle}<span className="column-count">{items.length}</span></h3>
        <div className="task-list">{items.length ? items.map((task) => <article className="task-card" key={task.id}><h4>{task.title}</h4>{task.description && <p>{task.description}</p>}{task.dueDate && <time className="task-due" dateTime={`${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ""}`}>Due {formatDueDate(task.dueDate)}{task.dueTime ? ` at ${formatDueTime(task.dueTime)}` : ""}</time>}<div className="task-footer"><span className="task-avatar">WZ</span>{canEdit ? <span className="task-actions"><select value={task.status} disabled={busy} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} aria-label={`Status for ${task.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><button type="button" disabled={busy} onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>Delete</button></span> : <span>{status === "done" ? <><Icon name="check" size={13} />Complete</> : "Team task"}</span>}</div></article>) : <p className="empty-column">Nothing here yet.</p>}</div>
      </section>;
    })}</div>
  </section>;
}

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatDueTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}
