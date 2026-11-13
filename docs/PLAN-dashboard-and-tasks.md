# Plan: Tasks system + Dashboard redesign

This plan covers two staff-side features for the Apex Portal:

- **Part 1: Tasks.** Turn the current "Projects" into a ClickUp-style task system. It becomes the core project-management tool.
- **Part 2: Dashboard.** Rebuild the dashboard so it's clean and readable, and it says in plain English what needs attention.

**Build Part 1 first.** The new dashboard shows task data ("My tasks", overdue, completed this month), so it needs the fields Part 1 adds.

Everything here is staff-side only. Portal clients (`role = 'client'`) must never see tasks, and **sales** users stay locked out of tasks, as they are today with projects.

---

## 0. Read this first (orientation)

### Branches

- Work from **`master`**. That's the live code, and CapRover deploys from `master` (see `DEPLOY.md`). **`main` is an old, stale branch. Ignore it.**
- Create a feature branch: `git checkout -b feature/tasks-and-dashboard master`.
- Note: `origin/claude/practical-albattani-b78pki` has one commit not yet in `master`, "Fix white screen on the first open after a deploy" (touches `client/src/main.tsx`, `client/src/sw.ts` and `server/src/index.ts`). Ask Max whether to merge it first. Don't undo it.

### How the codebase is laid out

| Area | Where | Notes |
|---|---|---|
| Database | `server/prisma/schema.prisma` + `server/prisma/migrations/` | **Prisma** ORM, PostgreSQL. Migrations run automatically on deploy (`npm start` → `prisma migrate deploy`). |
| Server | `server/src/` (Express + TypeScript) | Routes in `routes/`, logic in `controllers/`. Auth middleware: `authenticate`, `requireStaff`, `denyRole('sales')`, `requireAdmin` in `middleware/auth.ts`. |
| Prisma client | `server/src/config/prisma.ts` | `import prisma from '../config/prisma'` |
| Push notifications | `server/src/services/pushService.ts` | `sendPushToUsers(ids, { title, body, url })`. Never throws. |
| Staff list (for assignee pickers) | `GET /api/users` (`routes/staffUsers.ts`) | Returns admin/staff/sales users. |
| Client app | `client/src/` (React 18 + Vite, Tailwind, React Router 6) | Ticket pages are `.tsx` in `pages/`. **Staff pages are `.jsx` in `client/src/staff/`.** Put new staff pages there as `.jsx` too, to match. |
| Staff API calls | `import api from '../api'` (axios, base `/api`) | Staff pages use plain `useEffect` + `api.get`. `@tanstack/react-query` is also installed and may be used. |
| Toasts (staff pages) | `import toast from 'react-hot-toast'` | |
| Modal (staff pages) | `client/src/staff/components/Modal.jsx` | Props: `open`, `onClose`, `title`, `wide`. |
| Current user (staff pages) | `import { useAuth } from '../context/AuthContext'` | `const { user } = useAuth()` → `user.role`, `user.id`, `user.name` |
| Routes | `client/src/App.tsx` | Staff routes sit inside `<ProtectedRoute allowedRoles={['admin','staff','sales']}>` |
| Sidebar nav | `client/src/components/Layout.tsx` | `staffNav` array (~line 102). Items support `hidden: user?.role === 'sales'`. |
| Icons | `lucide-react` (v0.383) | Use lucide everywhere new. Don't add new inline SVG icon sets. |
| Colours | `client/tailwind.config.js` | `brand-700` = `#0D3040` (dark, headings), `brand-600` = `#1A5276`, `brand-100` = `#D6EAF8`. Shared classes in `client/src/index.css`: `.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`. |

### Key naming decision: in code it stays "Project", in the UI it says "Task"

The database table `projects`, the Prisma model `Project` and the API path `/api/projects` **stay as they are**. The calendar, global search and the client detail page already use them, and renaming the table adds risk for no real gain.

Every word the **user sees** changes from "Project" to "Task". New front-end files use "task" in their names (`TasksPage.jsx`, `TaskDetailPage.jsx`) and live at `/staff/tasks`. Add this comment at the top of `projectController.ts` and the new task pages:

```ts
// NOTE: "Project" in the database/API is shown to users as a "Task".
```

### There are no automated tests

Check your work with:

- `cd server && npx prisma migrate dev` (local DB) and `npm run build` (runs `tsc`)
- `cd client && npm run build` (runs `tsc && vite build`)
- The manual checklists at the end of each part

Both builds must pass with no errors before you finish.

---

# PART 1: Tasks (ClickUp-style)

## 1.1 What Max wants

- Create a **task** against a client (e.g. "Website build", "Monthly SEO", "Hosting migration").
- Each task has a **status**, **priority**, **assignees**, **start/due dates**, a **type**, a **description** and **progress**.
- Tasks have **subtasks** (a checklist, each optionally assigned and dated).
- Tasks have an **updates feed**: staff post progress comments, and every change (status, assignee, due date…) is logged automatically. Like ClickUp's activity panel.
- A dedicated **Tasks page** with a **List view** (grouped by status) and a **Board view** (columns by status, drag to change status), plus filters.
- A **clean task detail page**.
- Staff-only. Clients never see any of this.

## 1.2 Fixed values (put these in one place)

Create **`server/src/constants/tasks.ts`**:

```ts
export const TASK_STATUSES = ['to_do', 'in_progress', 'review', 'on_hold', 'complete'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export const TASK_TYPES = ['website', 'maintenance', 'hosting', 'seo', 'design', 'other'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskType = typeof TASK_TYPES[number];
```

Create the matching **`client/src/staff/constants/tasks.js`**, with labels and colours. **This is the only place colours and labels are defined.** Every component imports from here.

```js
export const STATUSES = [
  { value: 'to_do',       label: 'To Do',       dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-700',       hex: '#9ca3af' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700',       hex: '#3b82f6' },
  { value: 'review',      label: 'In Review',   dot: 'bg-violet-500',  pill: 'bg-violet-100 text-violet-700',   hex: '#8b5cf6' },
  { value: 'on_hold',     label: 'On Hold',     dot: 'bg-amber-500',   pill: 'bg-amber-100 text-amber-700',     hex: '#f59e0b' },
  { value: 'complete',    label: 'Complete',    dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
];
export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', text: 'text-red-600' },
  { value: 'high',   label: 'High',   text: 'text-orange-500' },
  { value: 'normal', label: 'Normal', text: 'text-blue-500' },
  { value: 'low',    label: 'Low',    text: 'text-gray-400' },
];
export const TYPES = [
  { value: 'website', label: 'Website' }, { value: 'maintenance', label: 'Maintenance' },
  { value: 'hosting', label: 'Hosting' }, { value: 'seo', label: 'SEO' },
  { value: 'design', label: 'Design' },   { value: 'other', label: 'Other' },
];
export const statusOf   = (v) => STATUSES.find((s) => s.value === v)   ?? STATUSES[0];
export const priorityOf = (v) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[2];
export const typeOf     = (v) => TYPES.find((t) => t.value === v)      ?? TYPES[5];
```

## 1.3 Database changes

### a) Edit `server/prisma/schema.prisma`

**Change the `Project` model** to the following. Keep `milestones`, `client` and `assignedUsers` exactly as they are.

```prisma
model Project {
  id          Int       @id @default(autoincrement())
  clientId    Int       @map("client_id")
  name        String
  description String?
  // to_do | in_progress | review | on_hold | complete  (see server/src/constants/tasks.ts)
  status      String    @default("to_do")
  // urgent | high | normal | low
  priority    String    @default("normal")
  // website | maintenance | hosting | seo | design | other
  taskType    String    @default("other") @map("task_type")
  // 0–100, set by staff with a slider
  progress    Int       @default(0)
  startDate   DateTime? @map("start_date")        // was required → now optional
  endDate     DateTime? @map("end_date")          // shown in UI as "Due date"
  completedAt DateTime? @map("completed_at")      // set when status becomes complete
  createdById Int?      @map("created_by")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  client        Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)
  milestones    Milestone[]
  assignedUsers User[]       @relation("ProjectAssignees")
  createdBy     User?        @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: SetNull)
  subtasks      Subtask[]
  updates       TaskUpdate[]

  @@index([status])
  @@index([endDate])
  @@map("projects")
}

model Subtask {
  id          Int       @id @default(autoincrement())
  projectId   Int       @map("project_id")
  title       String
  isDone      Boolean   @default(false) @map("is_done")
  assigneeId  Int?      @map("assignee_id")
  dueDate     DateTime? @map("due_date")
  position    Int       @default(0)
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee User?   @relation("SubtaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@map("task_subtasks")
}

// One timeline per task: staff comments AND automatic change log entries.
model TaskUpdate {
  id        Int      @id @default(autoincrement())
  projectId Int      @map("project_id")
  userId    Int?     @map("user_id")
  // comment | created | status_changed | priority_changed | assignees_changed
  // | due_date_changed | progress_changed | subtask_completed | subtask_added
  type      String
  body      String
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User?   @relation("TaskUpdateAuthor", fields: [userId], references: [id], onDelete: SetNull)

  @@index([projectId, createdAt])
  @@map("task_updates")
}
```

**Add these relation fields to the `User` model** (next to `assignedProjects`):

```prisma
  createdProjects   Project[]    @relation("ProjectCreator")
  assignedSubtasks  Subtask[]    @relation("SubtaskAssignee")
  taskUpdates       TaskUpdate[] @relation("TaskUpdateAuthor")
```

### b) Create the migration

Run `cd server && npx prisma migrate dev --name tasks_system --create-only`. Then **open the generated `migration.sql` and add the data conversion below at the end** (old status values → new ones). Without it, existing projects end up with statuses the UI doesn't recognise.

```sql
-- Convert old project statuses to the new task statuses
UPDATE "projects" SET "status" = 'in_progress' WHERE "status" = 'active';
UPDATE "projects" SET "status" = 'on_hold'     WHERE "status" = 'on-hold';
UPDATE "projects" SET "completed_at" = "updated_at" WHERE "status" = 'complete' AND "completed_at" IS NULL;
UPDATE "projects" SET "progress" = 100 WHERE "status" = 'complete';
```

Then run `npx prisma migrate dev` to apply it, and `npx prisma generate`.

Check the generated SQL: it must only **add** columns/tables and **drop NOT NULL** on `start_date`. It must not drop or recreate the `projects` table. If it tries to, stop and fix the schema.

## 1.4 Server: API

All routes stay in **`server/src/routes/projects.ts`**, which already has `authenticate, requireStaff, denyRole('sales')`. Keep that.

### Validation helper

Write a small helper at the top of `projectController.ts` (or in `constants/tasks.ts`):

```ts
function pick<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as string)) throw new AppError(`Invalid ${field}`, 400);
  return value as T[number];
}
```

(`AppError` is in `middleware/errorHandler.ts`.) Use it for status, priority and taskType. Clamp `progress` to an integer between 0 and 100.

### Endpoints

| Method & path | What it does |
|---|---|
| `GET /api/projects` | List tasks. **New query filters:** `clientId`, `status` (comma-separated allowed, e.g. `to_do,in_progress`), `priority`, `taskType`, `assignedUserId`, `mine=1` (= assigned to `req.user.userId`), `q` (name contains, case-insensitive), `includeComplete=0` (exclude `complete`). Keep the existing filters working. |
| `GET /api/projects/:id` | One task with everything (see "detail include" below). |
| `POST /api/projects` | Create. **Required: `clientId`, `name`.** `startDate` is now optional. Accepts `description, status, priority, taskType, progress, startDate, endDate, assignedUserIds, milestones`. Set `createdById = req.user.userId`. Write a `TaskUpdate` `{ type: 'created', body: 'created this task' }`. Push-notify assignees (not the creator). |
| `PUT /api/projects/:id` | Update. Already partial (fields left `undefined` aren't changed). Keep that. **Add change logging + side effects** (see below). |
| `DELETE /api/projects/:id` | Unchanged. |
| `POST /api/projects/:id/updates` | Body `{ body }`. Adds a comment (`type: 'comment'`). Reject empty or whitespace-only text. Max 5,000 chars. Push-notify the task's assignees except the author. |
| `DELETE /api/projects/:id/updates/:updateId` | Only for `type = 'comment'`, and only by its author or an admin. Otherwise 403. |
| `POST /api/projects/:id/subtasks` | Body `{ title, assigneeId?, dueDate? }`. `position` = current max + 1. Log `subtask_added`. |
| `PUT /api/projects/:id/subtasks/:subtaskId` | Body any of `{ title, isDone, assigneeId, dueDate, position }`. When `isDone` flips to true, set `completedAt = now` and log `subtask_completed` ("completed subtask "X""). When it flips back, clear `completedAt`. Check the subtask belongs to `:id`, otherwise 404. |
| `DELETE /api/projects/:id/subtasks/:subtaskId` | Delete (check it belongs to `:id`). |

Remember to register each new handler in `routes/projects.ts`.

### Includes

```ts
// list view — keep it light
const listInclude = {
  client: { select: { id: true, name: true, company: true } },
  assignedUsers: { select: { id: true, name: true } },
  subtasks: { select: { id: true, isDone: true } },   // front end counts done/total
};

// detail view
const detailInclude = {
  client: { select: { id: true, name: true, company: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  milestones: { orderBy: { date: 'asc' } },
  subtasks: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { assignee: { select: { id: true, name: true } } } },
  updates: { orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true } } } },
} satisfies Prisma.ProjectInclude;
```

List ordering: `orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]`. The front end handles grouping and sorting by priority.

### Change logging inside `PUT /api/projects/:id`

1. Load the existing task **first** (with `assignedUsers`). If it doesn't exist, return 404.
2. Build the update data as today, plus `priority`, `taskType` and `progress`.
3. **Status rules:**
   - If the new status is `complete` and the old one wasn't, set `completedAt = new Date()` and `progress = 100`.
   - If the old status was `complete` and the new one isn't, set `completedAt = null`.
4. Compare old vs new and collect `TaskUpdate` rows (with `userId = req.user.userId`). The `body` is shown as-is in the feed, so write it as a readable sentence. Use the labels, not the raw values:
   - status → `changed status from In Progress to In Review`
   - priority → `set priority to Urgent`
   - assignees → `assigned Jo, Sam` / `unassigned Alex` (compare id sets)
   - endDate → `changed due date to 14 Nov 2026` / `removed the due date` (format with `toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })`)
   - progress → `updated progress to 60%` (only log if it changed by 10 or more, or reached 100, so dragging the slider doesn't spam the feed)
5. Do the project update, the milestone replacement (existing logic) and `prisma.taskUpdate.createMany(...)` inside **one `prisma.$transaction`**.
6. After the transaction, **push-notify newly added assignees**: `sendPushToUsers(newIds, { title: 'New task assigned', body: `${task.name} (${clientName})`, url: `/staff/tasks/${id}` })`. Don't `await` it in a way that can fail the request. It already never throws, but add `.catch(() => {})`.
7. Return the task using `detailInclude`.

Put the label maps the server needs for these sentences in `constants/tasks.ts` (`STATUS_LABELS`, `PRIORITY_LABELS`).

### Other server files that read `projects` (update them)

- **`server/src/controllers/staffDashboardController.ts`** counts `'active'` and `'on-hold'`. Part 2 replaces this file, but if you ship Part 1 alone, change those to `'in_progress'` and `'on_hold'`.
- **`server/src/controllers/searchController.ts`** (~line 101): change the project result `url` to `` `/staff/tasks/${p.id}` ``, and the subtitle to `` `${p.client.name} · ${label}` ``, using the status label.
- **`server/src/controllers/clientController.ts` `getById`** (~line 79): change the `projects` include so it also returns `subtasks: { select: { id: true, isDone: true } }`, and order by `[{ endDate: { sort: 'asc', nulls: 'last' } }]`.

## 1.5 Client: pages and components

### File list (new)

```
client/src/staff/constants/tasks.js            (from 1.2)
client/src/staff/components/tasks/
  StatusPill.jsx        – coloured pill; optional dropdown to change status
  PriorityFlag.jsx      – lucide <Flag> icon coloured by priority + label
  AssigneeAvatars.jsx   – overlapping initial circles (max 3, then "+2"); tooltip with names
  AssigneePicker.jsx    – multi-select of staff from GET /api/users (checkbox list in a popover)
  DueDate.jsx           – "14 Nov"; red "Overdue" if past & not complete; amber if within 3 days; grey "No date"
  ProgressBar.jsx       – thin bar + "%"
  TaskFormModal.jsx     – create/edit form (moved from ClientDetailPage's ProjectFormModal, extended)
  TaskRow.jsx           – one row in list view
  TaskCard.jsx          – one card in board view
client/src/staff/pages/TasksPage.jsx
client/src/staff/pages/TaskDetailPage.jsx
```

### Routes and nav

- **`client/src/App.tsx`**: import both pages and add them inside the staff `ProtectedRoute` block:
  ```tsx
  <Route path="/staff/tasks" element={<StaffTasksPage />} />
  <Route path="/staff/tasks/:id" element={<StaffTaskDetailPage />} />
  ```
- **`client/src/components/Layout.tsx`**: add to `staffNav` **as the first item** (it's the core tool):
  `{ to: '/staff/tasks', label: 'Tasks', icon: <ListChecks className="w-4 h-4" />, hidden: user?.role === 'sales' }`
  Import `ListChecks` from `lucide-react`.
- In both task pages, if `user.role === 'sales'`, render `<Navigate to="/staff" replace />` (the API already returns 403).

### `TaskFormModal.jsx`

Move `ProjectFormModal` out of `ClientDetailPage.jsx` into this file and extend it. Props: `open, task, clientId (optional preset), onClose, onSaved`.

Fields, in this order:

1. **Task name*** (text)
2. **Client*** (select from `GET /api/clients`). Hide it when `clientId` is passed in.
3. **Type** (select, `TYPES`) and **Priority** (4 pill buttons using `PRIORITIES`), side by side
4. **Status** (pill buttons, `STATUSES`)
5. **Assignees** (`AssigneePicker`)
6. **Start date** and **Due date** (date inputs), side by side. Both optional.
7. **Description** (textarea, 5 rows)
8. **Milestones** (keep the existing add/remove UI)

On create, POST `/projects`. On edit, PUT `/projects/:id`. Toast "Task created" / "Task updated". Leave progress out of this form. It's set on the detail page.

### `TasksPage.jsx` (the main hub)

Header: **"Tasks"**, with the subtitle "Everything the team is working on". On the right, a `+ New Task` button (`btn-primary`) that opens `TaskFormModal`.

**Toolbar** (one row, wraps on mobile):

- Search box (filters by name, debounced 300ms, sent as `q`)
- `My tasks` toggle chip
- Filter selects: Client, Assignee, Priority, Type
- `Show completed` toggle (off by default → `includeComplete=0`)
- View switch: **List | Board** (lucide `List` / `Columns3` icons). Remember the choice in `localStorage` key `tasks.view`, wrapped in try/catch.
- Read the initial filters from the URL query string (`?clientId=5&mine=1`) using `useSearchParams`, and keep the URL updated, so links like "View all tasks for this client" work.

**List view** (default):

- One collapsible group per status, in `STATUSES` order. The group header shows a coloured dot, the label and the count, e.g. "● In Progress 4". Hide empty groups. When "Show completed" is off, the Complete group is hidden.
- Inside each group, sort by priority (urgent→low), then due date (soonest first, no date last).
- Columns for `TaskRow`, on desktop: **Name** (bold; underneath, small grey text: client name · type) | **Assignees** | **Due** | **Priority** | **Progress** | **Subtasks** ("3/5", lucide `CheckSquare`). On mobile, show only name, due and avatars.
- Click a row → navigate to `/staff/tasks/:id`.
- The status dot at the left of each row is a small dropdown (`StatusPill` in compact mode). Changing it does `PUT /projects/:id { status }` and updates the row in place (optimistic update, revert + error toast on failure).
- At the bottom of each group, an inline "+ Add task" link that opens `TaskFormModal` with that status preset.

**Board view**:

- One column per status (horizontal scroll on small screens; each column `w-72 shrink-0`). The column header shows the dot, label and count.
- `TaskCard`: name, client, `PriorityFlag`, `DueDate`, `AssigneeAvatars`, a small `ProgressBar`, and the subtask count.
- **Drag and drop between columns using native HTML5 drag events** (`draggable`, `onDragStart` sets `dataTransfer` with the task id, the column's `onDragOver` calls `preventDefault`, `onDrop` → `PUT { status }`). No new library. Highlight the column on drag-over (`ring-2 ring-brand-300`). Optimistic update.

**Empty state** (no tasks match): lucide `ListChecks` icon, "No tasks here yet", and a `+ New Task` button.

**Loading**: show 5 grey pulse skeleton rows, not a spinner.

### `TaskDetailPage.jsx` (clean single-task view)

Fetch `GET /projects/:id`. Layout: `grid lg:grid-cols-3 gap-6`.

**Top bar** (full width):

- Breadcrumb: `Tasks › {client name}`. "Tasks" links to `/staff/tasks`, the client name links to `/staff/clients/:clientId`.
- **Task name** as a large heading. Click to edit inline (input; save on Enter/blur; Esc cancels).
- On the right: `•••` menu with **Edit details** (opens `TaskFormModal`) and **Delete task** (confirm, then DELETE, toast, navigate to `/staff/tasks`).

**Left column (`lg:col-span-2`):**

1. **Properties card**, laid out as a 2-column grid of label → value rows like ClickUp. Every value is editable in place and saves straight away with `PUT`:
   - Status → `StatusPill` dropdown
   - Priority → `PriorityFlag` dropdown
   - Assignees → `AssigneeAvatars` + `AssigneePicker` popover
   - Type → select
   - Start date / Due date → date inputs
   - Created → "by Max on 3 Nov 2026" (read-only)
2. **Progress card**: big "%" number, `ProgressBar`, and a range slider (step 5) that saves on release (`onMouseUp`/`onTouchEnd`/`onKeyUp`), not on every move. If there are subtasks, show the hint "3 of 5 subtasks done" underneath.
3. **Description card**: shows the text with line breaks kept (`whitespace-pre-wrap`). An "Edit" button turns it into a textarea with Save/Cancel. Placeholder when empty: "Add a description: scope, links, logins needed…"
4. **Subtasks card**:
   - Header "Subtasks" with "2/5" and a mini progress bar.
   - Each row: checkbox (toggle → `PUT subtask { isDone }`, done items get a line through and grey text), title (click to edit inline), small assignee avatar (click to pick one person), due date chip, and a delete icon on hover.
   - An input at the bottom: "Add a subtask and press Enter" → POST.
5. **Milestones card**: only if any exist. Read-only list (date + title). They're edited in the modal.

**Right column: "Updates" panel** (sticky on desktop, `lg:sticky lg:top-6`):

- Comment box at the top: textarea "Post an update…", `Post` button (`Ctrl/Cmd+Enter` also posts). POST `/projects/:id/updates`, then add it to the top of the list.
- The feed, newest first:
  - **Comments**: avatar initial, **name**, relative time ("2h ago"; full date on hover via `title`), and the text in a light grey bubble (`bg-gray-50 rounded-lg p-3 whitespace-pre-wrap`). A delete icon shows for the author or admins.
  - **System entries** (every other type): one compact grey line with a small lucide icon. E.g. *"Max changed status from To Do to In Progress · 3h ago"*. Icons: status → `CircleDot`, priority → `Flag`, assignees → `UserPlus`, due date → `CalendarClock`, progress → `TrendingUp`, subtask → `CheckSquare`, created → `Sparkles`.
- Relative time helper: add `timeAgo(date)` to `client/src/utils/formatters.ts` ("just now", "5m ago", "3h ago", "yesterday", otherwise "14 Nov").

After any change on this page, refetch the task (or merge the response, since `PUT` returns the full task), so the Updates feed shows the new system entry.

### Update existing pages

- **`client/src/staff/pages/ClientDetailPage.jsx`**:
  - Rename the "Projects" section to **"Tasks"** and the button to "+ Add Task".
  - Use the new `TaskFormModal` (with `clientId` preset). Delete the old `ProjectFormModal` and `ProjectCard` from this file.
  - Show tasks as compact `TaskRow`s (name, status pill, due, avatars, progress). Clicking one navigates to `/staff/tasks/:id`.
  - Add a link under the list: "View all tasks for this client →" to `/staff/tasks?clientId={id}&includeComplete=1`.
  - Update the `data.projects = data.projects.map(...)` normaliser to also default `subtasks` to `[]`.
- **`client/src/staff/pages/CalendarPage.jsx`**:
  - Replace `STATUS_COLORS` and the status `<option>`s (~lines 20, 114, 174) with values from `constants/tasks.js` (use `hex`).
  - Rename "Project" to "Task" in labels.
  - In the side panel for a selected task, add an "Open task →" link to `/staff/tasks/:id`.
  - Replace its local `StatusBadge` with `StatusPill`.
  - Tasks with no `startDate` should use `createdAt` as the calendar start.
- **`client/src/components/GlobalSearch.tsx`**: change the group label `projects: 'Projects'` to `'Tasks'` and the placeholder text to "Search clients, tickets, notes, tasks…".

## 1.6 Part 1 manual test checklist

Run server + client locally. Then:

- [ ] Migration applied. Old "active" projects now show as **In Progress**, "on-hold" as **On Hold**.
- [ ] Sidebar shows **Tasks** for admin and staff, **not** for sales. A sales user visiting `/staff/tasks` is redirected, and `GET /api/projects` returns 403.
- [ ] Create a task from the Tasks page (pick a client) and from a client's page (client preset).
- [ ] List view groups by status; filters, search, "My tasks" and "Show completed" all work and are reflected in the URL.
- [ ] Changing status from a list row updates it without a page reload.
- [ ] Board view: dragging a card to another column changes its status, and it stays changed after a refresh.
- [ ] Detail page: edit every property in place; each change appears in the Updates feed as a readable sentence.
- [ ] Marking Complete sets progress to 100%; moving it back out clears `completedAt`.
- [ ] Subtasks: add, tick, untick, rename, assign, delete. The count updates.
- [ ] Post a comment, delete own comment; a staff user can't delete someone else's comment (API returns 403).
- [ ] Assigning someone sends them a push notification (if push is set up), and it opens the task.
- [ ] Calendar still shows tasks and milestones with the new colours.
- [ ] Global search finds a task and opens its detail page.
- [ ] Log in as a **portal client**: nothing task-related is visible anywhere.
- [ ] `npm run build` passes in both `server/` and `client/`.

---

# PART 2: Dashboard redesign

## 2.1 What's wrong today

- **Admins** see `/admin` → `client/src/pages/admin/AdminDashboard.tsx`. It's a ticket stats block with **the whole staff dashboard embedded underneath** (`<StaffDashboard embedded />`). That makes two dashboards stacked, in two different visual styles (lucide icons + `.card` on top, inline SVG icons + coloured borders below).
- **Staff/sales** see `/staff` → `client/src/staff/pages/DashboardPage.jsx`.
- The stats are raw counts with no context ("12": good or bad?). The priority mini bar chart and the donut chart are hard to read. Nothing tells you *what to do next*.
- Bug: the ticket "last 6 months" trend (`adminController.getDashboardStats`) leaves out months with zero tickets, so the chart can show 3 bars instead of 6.

## 2.2 Goal

**One dashboard component for every staff role** (admin, staff, sales). It shows or hides sections by role, reads top to bottom, and answers in order:

1. *Does anything need me right now?*
2. *How are we doing?* (a few numbers, each with context)
3. *What am I working on?*
4. *What's coming up?*
5. *How's the workload spread?*

Keep the language plain, numbers big, labels short and colours calm. Every number links to the page that explains it.

## 2.3 Layout (top to bottom)

```
┌───────────────────────────────────────────────────────────────┐
│ Good morning, Max                    [+ New task] [+ Client]   │
│ Thursday 13 November                                           │
├───────────────────────────────────────────────────────────────┤
│ ⚠ Needs attention                                              │
│  • 2 tasks are overdue                       → View            │
│  • 3 tickets are waiting for a reply         → View  (admin)   │
│  • 1 task is due today                       → View            │
│  (or ✓ "All clear. Nothing needs you right now.")              │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│ Open tickets │ Active tasks │ Done this    │ Clients          │
│     5        │    12        │ month   8    │    24            │
│ 2 new this   │ 3 due this   │ ↑ 2 vs last  │ +2 this month    │
│ week         │ week         │ month        │                  │
├──────────────────────────────┬────────────────────────────────┤
│ My tasks (6)        View all │ Coming up (next 14 days)        │
│  ● Homepage rebuild  Due Fri │  Fri 14  Task due: SEO audit    │
│  ● Fix contact form  Overdue │  Mon 17  Milestone: Launch      │
│  …                           │  Today   Meeting 10:00 – Jo Ltd │
├──────────────────────────────┴────────────────────────────────┤
│ Task pipeline   [■■■■■■■■□□□□▤▤▤■■]  To Do 4 · In Progress 6 … │
├──────────────────────────────┬────────────────────────────────┤
│ Team workload                │ Tickets (admin only)            │
│  Max   ██████ 6 open         │  status bar + 6-month bars      │
│  Jo    ███ 3 open            │  Oldest waiting: #41 (9 days)   │
├──────────────────────────────┴────────────────────────────────┤
│ Recently added clients (5)                                     │
└───────────────────────────────────────────────────────────────┘
```

**Sections by role:**

| Section | admin | staff | sales |
|---|---|---|---|
| Greeting + quick actions | ✓ (New task, Add client) | ✓ (New task, Add client) | ✓ (Add client) |
| Needs attention | tasks + tickets | tasks | — (hide) |
| KPI tiles | Open tickets, Active tasks, Done this month, Clients | Active tasks, My open tasks, Done this month, Clients | My referred clients, Total clients, Commission rate (10%) |
| My tasks | ✓ | ✓ | — |
| Coming up (14 days) | tasks, milestones, my meetings | same | my meetings only |
| Task pipeline | ✓ | ✓ | — |
| Team workload | ✓ | ✓ | — |
| Tickets | ✓ | — | — |
| My referred clients list | — | — | ✓ |
| Recently added clients | ✓ | ✓ | ✓ (their own only) |

## 2.4 Server: one new endpoint

Add **`GET /api/dashboard/overview`** in `server/src/routes/staffDashboard.ts` (already behind `authenticate, requireStaff`), with the handler `overview` in `server/src/controllers/staffDashboardController.ts`. Run the queries with `Promise.all`. Skip queries the role can't see (return `null` for those sections).

Response shape. Define it as a TypeScript interface in the controller file so it's documented:

```ts
interface DashboardOverview {
  role: 'admin' | 'staff' | 'sales';
  userName: string;
  attention: {                        // null for sales
    overdueTasks: number;            // endDate < start of today, status != complete
    dueTodayTasks: number;           // endDate is today, status != complete
    ticketsWaiting: number | null;   // admin only: tickets with status 'pending'
  } | null;
  kpis: Array<{
    key: string;                     // 'openTickets' | 'activeTasks' | 'myOpenTasks' | 'doneThisMonth' | 'clients' | 'referred' | 'totalClients' | 'commission'
    label: string;                   // e.g. "Open tickets"
    value: number | string;
    context: string;                 // e.g. "2 new this week" — already written as a sentence on the server
    trend?: 'up' | 'down' | 'flat';  // optional arrow, only for doneThisMonth
    href: string;                    // where clicking the tile goes
  }>;
  myTasks: Array<{ id; name; status; priority; endDate; clientName }> | null;   // assigned to me, not complete, soonest due first (nulls last), take 6
  myTasksTotal: number | null;
  comingUp: Array<{ kind: 'task' | 'milestone' | 'meeting'; id: number; date: string; time?: string; title: string; subtitle: string; href: string }>;
  pipeline: Array<{ status: string; count: number }> | null;   // all 5 statuses, zero-filled, in STATUSES order
  workload: Array<{ userId: number; name: string; open: number; overdue: number }> | null;  // every admin/staff user, sorted by open desc
  tickets: {                                                   // admin only, else null
    byStatus: Array<{ status: string; count: number }>;        // pending, in_progress, complete, out_of_scope
    monthly: Array<{ label: string; count: number }>;          // EXACTLY 6 entries, zero-filled, oldest first ("Jun", "Jul", …)
    oldestWaiting: Array<{ id: number; title: string; clientName: string; daysWaiting: number }>; // 3 oldest pending
  } | null;
  recentClients: Array<{ id; name; company; createdAt }>;      // take 5; sales: only salesPersonId = me
  referredClients: Array<{ id; name; company }> | null;        // sales only
}
```

How each number is worked out:

- "Start of today" / "end of today": build these from server-local time with `new Date()` + `setHours(0,0,0,0)`.
- **Open tickets**: `status in ('pending','in_progress')`. Context: "`N` new this week" (created in the last 7 days).
- **Active tasks**: `status != 'complete'`. Context: "`N` due this week" (endDate within the next 7 days).
- **My open tasks**: `status != 'complete'`, assigned to me. Context: "`N` overdue" or "none overdue".
- **Done this month**: tasks with `completedAt >= start of this month`. Context: compare with last month's full count → "↑ 2 vs last month" / "↓ 1 vs last month" / "same as last month". Set `trend` to match.
- **Clients**: `client.count()`. Context: "+`N` this month".
- **Coming up**: tasks with `endDate` in [today, today+14d] and not complete, + milestones with `date` in range whose project isn't complete, + meetings with `staffUserId = me` and `date` in range. Merge, sort by date (then `startTime`), take 8. Hrefs: task/milestone → `/staff/tasks/:projectId`, meeting → `/staff/meetings`. Sales: meetings only.
- **Workload**: one `groupBy` isn't possible across the implicit many-to-many, so load `prisma.user.findMany({ where: { role: { in: ['admin','staff'] } }, select: { id, name, assignedProjects: { where: { status: { not: 'complete' } }, select: { endDate: true } } } })` and count in JS (`open` = length, `overdue` = those with endDate < today).
- **Tickets monthly**: build the 6 month buckets first (the same way `stats` already does for `monthlyClients`), then fill them. This fixes the missing-months bug.

**Keep the old `GET /api/dashboard/stats` and `GET /api/admin/stats` working** until the new front end is switched over. Then delete `stats` from `staffDashboardController.ts` and its route. Leave `/api/admin/stats` in place unless nothing uses it anymore. Grep for `admin-stats` / `getStats` first.

## 2.5 Client: components and page

### New files

```
client/src/staff/components/dashboard/
  SectionCard.jsx      – white card: title (left), optional "View all →" link (right), children. Uses the `.card` class + p-5.
  KpiTile.jsx          – label (small grey), value (text-3xl font-bold text-brand-700), context line (text-xs, green/red if trend), whole tile is a <Link>.
  AttentionPanel.jsx   – list of alert lines or the "All clear" state.
  TaskListMini.jsx     – compact rows: status dot, name, client (grey), DueDate chip. Reuse components/tasks/DueDate + constants.
  ComingUpList.jsx     – rows: date block (e.g. "FRI / 14", or "Today" in brand colour), title, subtitle, small kind icon.
  StackedBar.jsx       – one horizontal bar split into coloured segments by count + legend chips underneath ("● To Do 4").
  WorkloadBars.jsx     – per person: name, thin bar (width relative to max), "6 open · 1 overdue".
  MonthBars.jsx        – 6 small vertical bars with month labels and the value above each (pure CSS/flex, no SVG library).
  DashboardSkeleton.jsx – grey pulse blocks in the same layout while loading.
```

### Rewrite `client/src/staff/pages/DashboardPage.jsx`

- Drop the `embedded` prop and the "redirect admin" logic. It's now the one dashboard for everyone.
- Fetch with React Query: `useQuery({ queryKey: ['dashboard-overview'], queryFn: () => api.get('/dashboard/overview').then(r => r.data), refetchOnWindowFocus: true, staleTime: 60_000 })`. `@tanstack/react-query` is already set up app-wide.
- **Greeting**: "Good morning/afternoon/evening, {first name}" (before 12 / before 18 / after) + the full date (`en-GB`, e.g. "Thursday 13 November").
- **Quick actions**: `+ New task` opens the `TaskFormModal` from Part 1 (client picker shown); `+ Add client` links to `/staff/clients`.
- **Needs attention**: only show lines with count > 0. Each line is a link:
  - overdue → `/staff/tasks?mine=0&overdue=1` (add an `overdue=1` filter to `GET /api/projects`: `endDate < today AND status != complete`)
  - due today → `/staff/tasks?dueToday=1` (likewise add `dueToday=1`)
  - tickets → `/admin/tickets?status=pending`
  - Use singular/plural correctly ("1 task is overdue" / "2 tasks are overdue"). Overdue lines use red text with lucide `AlertCircle`; others amber with `Clock`. If every count is 0, show a green lucide `CheckCircle2` with "All clear. Nothing needs you right now."
- **KPI tiles**: `grid grid-cols-2 lg:grid-cols-4 gap-4`, rendered straight from `kpis` (sales gets 3, so use `lg:grid-cols-3` when `kpis.length === 3`).
- The rest follows the layout and role table in 2.3. When a section is `null`, don't render it. When a list is empty, show a one-line grey message ("No tasks assigned to you", "Nothing due in the next two weeks").

### Point the routes at it

- **`client/src/pages/admin/AdminDashboard.tsx`**: replace its contents so it just renders the shared dashboard:
  ```tsx
  import StaffDashboard from '../../staff/pages/DashboardPage';
  export default function AdminDashboard() { return <StaffDashboard />; }
  ```
  (The `/admin` route and sidebar link stay as they are.)
- `/staff` already renders `DashboardPage`. Nothing to change there.

### Visual rules (so it feels clean)

- Page background stays `bg-gray-50`; all sections are white `.card`s with `p-5`, gap `gap-6` between sections, `space-y-6` vertically.
- Section titles: `text-sm font-semibold text-brand-700`. "View all" links: `text-xs text-brand-600 hover:underline`.
- Only colour things that carry meaning: status colours (from `constants/tasks.js`), red for overdue, amber for due-soon, green for good trends. Everything else is grey/brand.
- No chart wider than its card. Everything must work at 375px (stack to one column, KPI tiles 2×2).
- Use lucide icons only, `w-4 h-4`, `text-gray-400` unless they carry meaning.
- Numbers: big and bold. Labels: short, sentence case ("Open tickets", not "OPEN TICKETS").

### Clean up

- Delete the old helpers no longer used in `DashboardPage.jsx` (`BarChart`, `DonutChart`, inline SVG `ic(...)` icons, the old `StatCard`/`StatusBadge`).
- Remove the unused `AdminDashboard.tsx` helpers (`StatCard`, `BreakdownRow`) and imports.
- Check that nothing else imports `DashboardPage` with `embedded` (`grep -rn "embedded" client/src`).

## 2.6 Part 2 manual test checklist

- [ ] Admin `/admin`: one dashboard, every section from the role table shown, tickets section shows **6** month bars (including zero months).
- [ ] Staff `/staff`: no tickets section, no ticket numbers anywhere.
- [ ] Sales `/staff`: only greeting, 3 sales tiles, coming-up meetings, referred clients, their recent clients. No task data, and no failed task API calls in the network tab.
- [ ] Every KPI tile and attention line links to the right page with the right filter applied.
- [ ] Make a task overdue (due date yesterday). It appears in "Needs attention", "My tasks" (if assigned to you) and the workload "overdue" count.
- [ ] Complete a task. "Done this month" goes up by 1.
- [ ] Empty database / brand-new user: no crashes, friendly empty messages everywhere.
- [ ] Mobile width (375px): single column, no horizontal scroll.
- [ ] Loading shows the skeleton, not a blank page or a spinner.
- [ ] `npm run build` passes in both `server/` and `client/`.

---

## 3. Order of work (suggested commits)

1. `Add task fields, subtasks and updates to the schema` (schema + migration + constants)
2. `Task API: filters, change log, subtasks, comments, push on assign`
3. `Update search, client detail and dashboard stats for new task statuses`
4. `Add Tasks page with list and board views`
5. `Add task detail page with subtasks and updates feed`
6. `Use task components on client detail page and calendar`
7. `Add dashboard overview endpoint`
8. `Rebuild the dashboard as one role-aware page`
9. `Remove old dashboard code`

Keep each commit building (`npm run build` in both folders). Open one PR into `master` when done. **Don't push to `master` directly.** Merging deploys to production, and the migration runs on deploy.

## 4. Out of scope (don't build now, but don't block later)

- File attachments on tasks (later: copy the pattern from `client_files` / `fileController.ts`).
- Time tracking, recurring tasks, task templates, custom statuses per client.
- Dragging to reorder within a board column (the `position` field exists on subtasks only; add it to tasks later if needed).
- Email notifications for task changes (push only for now).
- Showing anything task-related to portal clients.
