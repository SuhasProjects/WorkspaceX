"use client";

import { useState, type FormEvent } from "react";
import type { Task, TaskStatus, UpdateTaskRequest } from "@/types/contracts";
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
  onUpdate: (id: string, updates: UpdateTaskRequest) => Promise<boolean>;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

export function TaskBoard({ tasks, canEdit, busy, message, onCreate, onUpdate, onStatus, onDelete }: TaskBoardProps) {
  const [creating, setCreating] = useState(false);
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
      setCreating(false);
    }
  }

  function cancelCreate() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setDueTime("");
    setCreating(false);
  }

  return <section className="section-block" aria-labelledby="tasks-heading">
    <div className="section-heading"><div><h2 id="tasks-heading">Team tasks <span className="count-badge">{tasks.length}</span></h2></div>{canEdit ? <button type="button" className="task-create-toggle" aria-expanded={creating} aria-controls="task-create-form" onClick={() => setCreating((current) => !current)}><Icon name={creating ? "close" : "plus"} size={14} />{creating ? "Close" : "Create task"}</button> : <span className="section-note">Shared with your team</span>}</div>
    {canEdit && creating && <form id="task-create-form" className="task-create" onSubmit={submit}>
      <label><span className="task-field-label">Task name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="What needs to be done?" autoFocus /></label>
      <label><span className="task-field-label">Details <small>Optional</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="Add context for your team" /></label>
      <div className="task-create-schedule">
        <label><span className="task-field-label">Due date <small>Optional</small></span><input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); if (!event.target.value) setDueTime(""); }} /></label>
        <label><span className="task-field-label">Due time <small>Optional</small></span><input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} /></label>
      </div>
      <div className="task-create-actions"><button type="button" disabled={busy} onClick={cancelCreate}>Cancel</button><button type="submit" disabled={busy || !title.trim()}><Icon name="plus" size={14} />{busy ? "Saving…" : "Create task"}</button></div>
    </form>}
    {message && <p className="feedback error" role="alert">{message}</p>}
    <div className="task-columns">{columns.map(({ status, title: columnTitle }) => {
      const items = tasks.filter((task) => task.status === status);
      return <section key={status} className={`task-column ${status}`} aria-label={columnTitle}><h3><span className="status-dot" />{columnTitle}<span className="column-count">{items.length}</span></h3>
        <div className="task-list">{items.length ? items.map((task) => <TaskCard key={task.id} task={task} canEdit={canEdit} busy={busy} onUpdate={onUpdate} onStatus={onStatus} onDelete={onDelete} />) : <p className="empty-column">Nothing here yet.</p>}</div>
      </section>;
    })}</div>
  </section>;
}

interface TaskCardProps {
  task: Task;
  canEdit: boolean;
  busy: boolean;
  onUpdate: (id: string, updates: UpdateTaskRequest) => Promise<boolean>;
  onStatus: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

function TaskCard({ task, canEdit, busy, onUpdate, onStatus, onDelete }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? "");
  const [editDueTime, setEditDueTime] = useState(task.dueTime ?? "");

  function cancelEdit() {
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditDueDate(task.dueDate ?? "");
    setEditDueTime(task.dueTime ?? "");
    setEditing(false);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onUpdate(task.id, {
      title: editTitle,
      description: editDescription,
      dueDate: editDueDate || null,
      dueTime: editDueDate && editDueTime ? editDueTime : null,
    });
    if (saved) setEditing(false);
  }

  if (editing) {
    return <article className="task-card task-card-editing">
      <form className="task-edit" onSubmit={saveEdit}>
        <label>Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} required autoFocus /></label>
        <label>Details<textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={2000} rows={3} /></label>
        <div className="task-edit-schedule">
          <label>Due date<input type="date" value={editDueDate} onChange={(event) => { setEditDueDate(event.target.value); if (!event.target.value) setEditDueTime(""); }} /></label>
          <label>Due time<input type="time" value={editDueTime} onChange={(event) => setEditDueTime(event.target.value)} disabled={!editDueDate} /></label>
        </div>
        <div className="task-edit-actions"><button type="submit" disabled={busy || !editTitle.trim()}>{busy ? "Saving…" : "Save"}</button><button type="button" disabled={busy} onClick={cancelEdit}>Cancel</button></div>
      </form>
    </article>;
  }

  return <article className="task-card"><h4>{task.title}</h4>{task.description && <p>{task.description}</p>}{task.dueDate && <time className="task-due" dateTime={`${task.dueDate}${task.dueTime ? `T${task.dueTime}` : ""}`}>Due {formatDueDate(task.dueDate)}{task.dueTime ? ` at ${formatDueTime(task.dueTime)}` : ""}</time>}<div className="task-footer"><span className="task-avatar">WZ</span>{canEdit ? <span className="task-actions"><select value={task.status} disabled={busy} onChange={(event) => onStatus(task.id, event.target.value as TaskStatus)} aria-label={`Status for ${task.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><button type="button" disabled={busy} onClick={() => setEditing(true)} aria-label={`Edit ${task.title}`}>Edit</button><button type="button" disabled={busy} onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>Delete</button></span> : <span>{task.status === "done" ? <><Icon name="check" size={13} />Complete</> : "Team task"}</span>}</div></article>;
}

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatDueTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}
