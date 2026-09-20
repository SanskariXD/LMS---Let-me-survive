'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  SquareCheckBig,
  CheckCircle2,
  Circle,
  Plus,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  Bell,
  Trash2,
  Edit3,
  ExternalLink,
  Tag,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Filter,
  Check,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export type TaskType = 'assignment' | 'todo';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskCategory = 'Personal' | 'Study' | 'College' | 'Project' | 'Other';
export type ReminderOption = 'none' | 'at_deadline' | '10m' | '30m' | '1h' | '3h' | '1d' | '2d' | 'custom';

export interface TaskItem {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  priority: TaskPriority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  reminder: ReminderOption;
  customReminderMinutes?: number;
  // Assignment specific
  courseCode?: string;
  courseName?: string;
  professor?: string;
  slot?: string;
  submissionLink?: string;
  // To-do specific
  category?: TaskCategory;
}

export interface EnrolledCourseInfo {
  code: string;
  name: string;
  slot?: string;
  venue?: string;
}

const STORAGE_KEY = 'slotwise_portal_tasks';

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-init-1',
    type: 'assignment',
    title: 'Design AVL Tree & Red-Black Tree Implementation',
    description: 'Submit source code in Java/C++ along with complexity analysis report.',
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'HIGH',
    dueDate: new Date().toISOString().split('T')[0], // Today
    dueTime: '23:59',
    reminder: '1h',
    courseCode: 'CSE2001',
    courseName: 'Data Structures and Algorithms',
    slot: 'B',
    submissionLink: 'https://amityonline.com/submissions/cse2001',
  },
  {
    id: 'task-init-2',
    type: 'assignment',
    title: 'E-Commerce Database Schema & 3NF Normalization',
    description: 'Design ER diagram and schema for multi-vendor online marketplace.',
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'MEDIUM',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // in 2 days
    dueTime: '17:00',
    reminder: '3h',
    courseCode: 'CSE2007',
    courseName: 'Relational Database Management System',
    slot: 'D',
  },
  {
    id: 'task-init-3',
    type: 'todo',
    title: 'Print Course Registration Confirmation Form',
    description: 'Submit signed hard copy to department coordinator by Friday.',
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'LOW',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    dueTime: '15:00',
    reminder: '1d',
    category: 'College',
  },
  {
    id: 'task-init-4',
    type: 'todo',
    title: 'Review Linux Process Scheduling Algorithms',
    description: 'Read Chapter 5 from Silberschatz OS textbook for quiz.',
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'MEDIUM',
    category: 'Study',
    reminder: 'none',
  },
];

interface TasksViewProps {
  enrolledCourses?: EnrolledCourseInfo[];
  onTasksUpdated?: (tasks: TaskItem[]) => void;
}

export function TasksView({ enrolledCourses = [], onTasksUpdated }: TasksViewProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<
    'all' | 'assignments' | 'todos' | 'today' | 'upcoming' | 'overdue' | 'completed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('ALL');
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [modalTaskType, setModalTaskType] = useState<TaskType>('assignment');

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCourse, setFormCourse] = useState('');
  const [formProf, setFormProf] = useState('');
  const [formSlot, setFormSlot] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDueTime, setFormDueTime] = useState('23:59');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formReminder, setFormReminder] = useState<ReminderOption>('none');
  const [formCustomMin, setFormCustomMin] = useState('30');
  const [formSubmissionLink, setFormSubmissionLink] = useState('');
  const [formCategory, setFormCategory] = useState<TaskCategory>('College');

  // In-portal toast notice
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Load from localStorage & sync from backend on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
          if (onTasksUpdated) onTasksUpdated(parsed);
        }
      }
    } catch {}

    // Synchronize with server-side tasks database
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.tasks)) {
          if (data.tasks.length > 0) {
            const mapped: TaskItem[] = data.tasks.map((t: any) => ({
              id: t.id,
              type: t.is_assignment ? 'assignment' : 'todo',
              title: t.title,
              description: t.description || undefined,
              completed: !!t.completed,
              createdAt: new Date(t.created_at).toISOString(),
              priority: (t.priority?.toUpperCase() as any) || 'MEDIUM',
              dueDate: t.deadline_date || undefined,
              dueTime: t.deadline_time || undefined,
              reminder: t.reminder_mins ? (`${t.reminder_mins}m` as any) : 'none',
              customReminderMinutes: t.reminder_mins || 30,
              courseCode: t.course || undefined,
              courseName: t.course || undefined,
              professor: t.professor || undefined,
              slot: t.slot || undefined,
              submissionLink: t.submission_url || undefined,
              category: 'College',
            }));
            setTasks(mapped);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
            if (onTasksUpdated) onTasksUpdated(mapped);
          } else {
            // Seed initial sample tasks if account is brand new
            INITIAL_TASKS.forEach((it) => {
              fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: it.id,
                  title: it.title,
                  isAssignment: it.type === 'assignment',
                  course: it.courseCode,
                  professor: it.professor,
                  slot: it.slot,
                  description: it.description,
                  deadlineDate: it.dueDate,
                  deadlineTime: it.dueTime,
                  priority: it.priority?.toLowerCase(),
                  completed: it.completed,
                  submissionUrl: it.submissionLink,
                }),
              }).catch(() => {});
            });
            setTasks(INITIAL_TASKS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TASKS));
            if (onTasksUpdated) onTasksUpdated(INITIAL_TASKS);
          }
        }
      })
      .catch(() => {});
  }, []);

  function saveTasks(updated: TaskItem[]) {
    setTasks(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (onTasksUpdated) onTasksUpdated(updated);
  }

  // Request browser notification permission ONLY when user picks a reminder
  async function ensureNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          showBannerNotice('Browser notifications enabled for your deadlines.');
        }
      } catch {
        // ignore
      }
    }
  }

  function showBannerNotice(msg: string) {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 4000);
  }

  // Toggle completion
  function toggleComplete(id: string) {
    let nextState = false;
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        nextState = nextCompleted;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        };
      }
      return t;
    });
    saveTasks(updated);

    fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: nextState }),
    }).catch(() => {});
  }

  // Delete task
  function deleteTask(id: string) {
    const updated = tasks.filter((t) => t.id !== id);
    saveTasks(updated);

    fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Open modal for new task
  function handleOpenCreate(type: TaskType = 'assignment') {
    setEditingTaskId(null);
    setModalTaskType(type);
    setFormTitle('');
    setFormDesc('');
    setFormCourse(enrolledCourses[0]?.code || '');
    setFormProf('');
    setFormSlot(enrolledCourses[0]?.slot || '');
    setFormDueDate('');
    setFormDueTime('23:59');
    setFormPriority('MEDIUM');
    setFormReminder('none');
    setFormCustomMin('30');
    setFormSubmissionLink('');
    setFormCategory('College');
    setModalOpen(true);
  }

  // Open modal for editing
  function handleOpenEdit(task: TaskItem) {
    setEditingTaskId(task.id);
    setModalTaskType(task.type);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormCourse(task.courseCode || '');
    setFormProf(task.professor || '');
    setFormSlot(task.slot || '');
    setFormDueDate(task.dueDate || '');
    setFormDueTime(task.dueTime || '23:59');
    setFormPriority(task.priority);
    setFormReminder(task.reminder);
    setFormCustomMin(String(task.customReminderMinutes || 30));
    setFormSubmissionLink(task.submissionLink || '');
    setFormCategory(task.category || 'College');
    setModalOpen(true);
  }

  // Save task
  function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (formReminder !== 'none') {
      void ensureNotificationPermission();
    }

    const matchedCourse = enrolledCourses.find((c) => c.code === formCourse);

    if (editingTaskId) {
      // Edit
      let editedTask: TaskItem | null = null;
      const updated = tasks.map((t) => {
        if (t.id === editingTaskId) {
          editedTask = {
            ...t,
            type: modalTaskType,
            title: formTitle.trim(),
            description: formDesc.trim() || undefined,
            priority: formPriority,
            dueDate: formDueDate || undefined,
            dueTime: formDueDate ? formDueTime || '23:59' : undefined,
            reminder: formReminder,
            customReminderMinutes:
              formReminder === 'custom' ? Number(formCustomMin) || 30 : undefined,
            courseCode: modalTaskType === 'assignment' ? formCourse || undefined : undefined,
            courseName:
              modalTaskType === 'assignment'
                ? matchedCourse?.name || t.courseName || formCourse
                : undefined,
            professor: modalTaskType === 'assignment' ? formProf.trim() || undefined : undefined,
            slot: modalTaskType === 'assignment' ? formSlot.trim() || undefined : undefined,
            submissionLink:
              modalTaskType === 'assignment' ? formSubmissionLink.trim() || undefined : undefined,
            category: modalTaskType === 'todo' ? formCategory : undefined,
          };
          return editedTask;
        }
        return t;
      });
      saveTasks(updated);

      if (editedTask) {
        fetch(`/api/tasks/${editingTaskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDesc.trim() || undefined,
            priority: formPriority.toLowerCase(),
            isAssignment: modalTaskType === 'assignment',
            course: modalTaskType === 'assignment' ? formCourse || undefined : undefined,
            professor: modalTaskType === 'assignment' ? formProf.trim() || undefined : undefined,
            slot: modalTaskType === 'assignment' ? formSlot.trim() || undefined : undefined,
            deadlineDate: formDueDate || undefined,
            deadlineTime: formDueDate ? formDueTime || '23:59' : undefined,
            submissionUrl: formSubmissionLink.trim() || undefined,
            reminderMins: formReminder === 'custom' ? Number(formCustomMin) || 30 : (formReminder === '1d' ? 1440 : formReminder === '1h' ? 60 : 30),
          }),
        }).catch(() => {});
      }
    } else {
      // Create new
      const newTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTask: TaskItem = {
        id: newTaskId,
        type: modalTaskType,
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        completed: false,
        createdAt: new Date().toISOString(),
        priority: formPriority,
        dueDate: formDueDate || undefined,
        dueTime: formDueDate ? formDueTime || '23:59' : undefined,
        reminder: formReminder,
        customReminderMinutes:
          formReminder === 'custom' ? Number(formCustomMin) || 30 : undefined,
        courseCode: modalTaskType === 'assignment' ? formCourse || undefined : undefined,
        courseName:
          modalTaskType === 'assignment' ? matchedCourse?.name || formCourse : undefined,
        professor: modalTaskType === 'assignment' ? formProf.trim() || undefined : undefined,
        slot: modalTaskType === 'assignment' ? formSlot.trim() || undefined : undefined,
        submissionLink:
          modalTaskType === 'assignment' ? formSubmissionLink.trim() || undefined : undefined,
        category: modalTaskType === 'todo' ? formCategory : undefined,
      };
      saveTasks([newTask, ...tasks]);

      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newTaskId,
          title: newTask.title,
          isAssignment: modalTaskType === 'assignment',
          course: newTask.courseCode,
          professor: newTask.professor,
          slot: newTask.slot,
          description: newTask.description,
          deadlineDate: newTask.dueDate,
          deadlineTime: newTask.dueTime,
          priority: formPriority.toLowerCase(),
          completed: false,
          submissionUrl: newTask.submissionLink,
          reminderMins: formReminder === 'custom' ? Number(formCustomMin) || 30 : (formReminder === '1d' ? 1440 : formReminder === '1h' ? 60 : 30),
        }),
      }).catch(() => {});
    }

    setModalOpen(false);
  }

  // Course selector helper
  function handleCourseChange(code: string) {
    setFormCourse(code);
    const matched = enrolledCourses.find((c) => c.code === code);
    if (matched?.slot && !formSlot) {
      setFormSlot(matched.slot);
    }
  }

  // Date categorization helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  function getTaskStatus(t: TaskItem): 'overdue' | 'today' | 'upcoming' | 'no_deadline' {
    if (!t.dueDate) return 'no_deadline';
    if (t.dueDate < todayStr) return 'overdue';
    if (t.dueDate === todayStr) return 'today';
    return 'upcoming';
  }

  // Counters for Top Summary
  const summaryCounts = useMemo(() => {
    let dueToday = 0;
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;

    for (const t of tasks) {
      if (t.completed) {
        completed++;
      } else {
        const st = getTaskStatus(t);
        if (st === 'today') dueToday++;
        else if (st === 'upcoming') upcoming++;
        else if (st === 'overdue') overdue++;
      }
    }

    return { dueToday, upcoming, overdue, completed };
  }, [tasks, todayStr]);

  // Unique list of courses present in tasks or enrolled courses
  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    enrolledCourses.forEach((c) => set.add(c.code));
    tasks.forEach((t) => {
      if (t.courseCode) set.add(t.courseCode);
    });
    return Array.from(set);
  }, [enrolledCourses, tasks]);

  // Filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      if (activeTab === 'assignments' && t.type !== 'assignment') return false;
      if (activeTab === 'todos' && t.type !== 'todo') return false;
      if (activeTab === 'completed' && !t.completed) return false;
      if (activeTab !== 'completed' && t.completed && activeTab !== 'all') return false;

      const st = getTaskStatus(t);
      if (activeTab === 'today' && (st !== 'today' || t.completed)) return false;
      if (activeTab === 'upcoming' && (st !== 'upcoming' || t.completed)) return false;
      if (activeTab === 'overdue' && (st !== 'overdue' || t.completed)) return false;

      // Course filter
      if (selectedCourseFilter !== 'ALL' && t.courseCode !== selectedCourseFilter) return false;

      // Priority filter
      if (selectedPriorityFilter !== 'ALL' && t.priority !== selectedPriorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) || false;
        const matchCourse = t.courseCode?.toLowerCase().includes(q) || t.courseName?.toLowerCase().includes(q) || false;
        const matchProf = t.professor?.toLowerCase().includes(q) || false;
        const matchCat = t.category?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchCourse && !matchProf && !matchCat) return false;
      }

      return true;
    });
  }, [tasks, activeTab, selectedCourseFilter, selectedPriorityFilter, searchQuery, todayStr]);

  // Partition filtered tasks into sections
  const sections = useMemo(() => {
    const overdue: TaskItem[] = [];
    const today: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const noDeadline: TaskItem[] = [];
    const completed: TaskItem[] = [];

    for (const t of filteredTasks) {
      if (t.completed) {
        completed.push(t);
      } else {
        const st = getTaskStatus(t);
        if (st === 'overdue') overdue.push(t);
        else if (st === 'today') today.push(t);
        else if (st === 'upcoming') upcoming.push(t);
        else noDeadline.push(t);
      }
    }

    // Sort sections by date
    const dateSort = (a: TaskItem, b: TaskItem) => {
      const dA = `${a.dueDate || '9999'} ${a.dueTime || '00:00'}`;
      const dB = `${b.dueDate || '9999'} ${b.dueTime || '00:00'}`;
      return dA.localeCompare(dB);
    };

    overdue.sort(dateSort);
    today.sort(dateSort);
    upcoming.sort(dateSort);

    return { overdue, today, upcoming, noDeadline, completed };
  }, [filteredTasks]);

  function getPriorityBadge(p: TaskPriority) {
    switch (p) {
      case 'URGENT':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700">Urgent</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">High</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700">Medium</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">Low</span>;
    }
  }

  function renderTaskCard(task: TaskItem) {
    const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
    const isToday = !task.completed && task.dueDate === todayStr;

    return (
      <div
        key={task.id}
        className={`group p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
          task.completed
            ? 'bg-slate-50/50 border-slate-200/50 opacity-70'
            : isOverdue
            ? 'bg-rose-50/20 border-rose-200/80 hover:border-rose-300'
            : isToday
            ? 'bg-amber-50/20 border-amber-200/80 hover:border-amber-300'
            : 'bg-white border-slate-200/80 hover:border-indigo-200 shadow-2xs'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Checkbox */}
          <button
            type="button"
            onClick={() => toggleComplete(task.id)}
            className="mt-0.5 text-slate-300 hover:text-indigo-600 transition-colors flex-shrink-0"
            title={task.completed ? 'Mark incomplete' : 'Mark completed'}
          >
            {task.completed ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <Circle size={18} className="hover:scale-105 transition-transform" />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Type pill */}
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  task.type === 'assignment'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {task.type === 'assignment' ? 'Assignment' : task.category || 'To-Do'}
              </span>

              {/* Course code (if assignment) */}
              {task.courseCode && (
                <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                  {task.courseCode}
                  {task.slot ? ` · ${task.slot}` : ''}
                </span>
              )}

              {/* Priority */}
              {getPriorityBadge(task.priority)}

              {/* Reminder pill */}
              {task.reminder !== 'none' && (
                <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-0.5">
                  <Bell size={10} />
                  <span>{task.reminder}</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h4
              className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                task.completed ? 'line-through text-slate-400' : 'text-slate-900'
              }`}
            >
              {task.title}
            </h4>

            {/* Course Name (if known) */}
            {task.courseName && task.type === 'assignment' && (
              <p className="text-[11px] text-slate-500 font-medium truncate">{task.courseName}</p>
            )}

            {/* Description */}
            {task.description && (
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta row: Due Date & Submission Link */}
            <div className="pt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              {task.dueDate ? (
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    isOverdue
                      ? 'text-rose-600 font-bold'
                      : isToday
                      ? 'text-amber-700 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  <Calendar size={11} />
                  <span>
                    {isToday ? 'Today' : task.dueDate} {task.dueTime ? `· ${task.dueTime}` : ''}
                  </span>
                  {isOverdue && <span>(Overdue)</span>}
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar size={11} /> No deadline
                </span>
              )}

              {task.professor && (
                <span className="truncate max-w-[150px]">Prof. {task.professor}</span>
              )}

              {task.submissionLink && (
                <a
                  href={task.submissionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  <LinkIcon size={10} /> Submission portal
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenEdit(task)}
            className="w-7 h-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            title="Edit Task"
          >
            <Edit3 size={13} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteTask(task.id)}
            className="w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
            title="Delete Task"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {bannerNotice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
          <Bell size={14} className="text-indigo-600 flex-shrink-0" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Tasks & Coursework Manager</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700">
              Personal & Academic
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Keep track of upcoming assignment submissions, lab exercises, and study to-dos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleOpenCreate('assignment')}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add Assignment</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCreate('todo')}
            className="h-8 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add To-Do</span>
          </Button>
        </div>
      </div>

      {/* Small Summary Strip (Clean pill counters as requested) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Due Today</span>
            <span className="text-lg font-black text-slate-900">{summaryCounts.dueToday}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            <Clock size={16} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Upcoming</span>
            <span className="text-lg font-black text-indigo-600">{summaryCounts.upcoming}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            <Calendar size={16} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Overdue</span>
            <span className={`text-lg font-black ${summaryCounts.overdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {summaryCounts.overdue}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
            <AlertCircle size={16} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Completed</span>
            <span className="text-lg font-black text-emerald-600">{summaryCounts.completed}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'assignments', label: 'Assignments' },
              { id: 'todos', label: 'To-Dos' },
              { id: 'today', label: 'Today' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* Secondary dropdown filters: Course & Priority */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Course:</span>
            <Select value={selectedCourseFilter} onValueChange={setSelectedCourseFilter}>
              <SelectTrigger className="h-7 text-[11px] min-w-[130px] bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Courses</SelectItem>
                {courseOptions.map((code) => (
                  <SelectItem key={code} value={code} className="text-xs font-mono">
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Priority:</span>
            <Select value={selectedPriorityFilter} onValueChange={setSelectedPriorityFilter}>
              <SelectTrigger className="h-7 text-[11px] min-w-[110px] bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
                <SelectItem value="URGENT" className="text-xs">Urgent</SelectItem>
                <SelectItem value="HIGH" className="text-xs">High</SelectItem>
                <SelectItem value="MEDIUM" className="text-xs">Medium</SelectItem>
                <SelectItem value="LOW" className="text-xs">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedCourseFilter !== 'ALL' || selectedPriorityFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCourseFilter('ALL');
                setSelectedPriorityFilter('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] font-bold text-indigo-600 hover:underline ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Task Sections */}
      <div className="space-y-6">
        {/* OVERDUE SECTION */}
        {sections.overdue.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600 uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>Overdue ({sections.overdue.length})</span>
            </div>
            <div className="space-y-2">
              {sections.overdue.map((t) => renderTaskCard(t))}
            </div>
          </div>
        )}

        {/* TODAY SECTION */}
        {sections.today.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-700 uppercase tracking-wider">
              <Clock size={14} />
              <span>Due Today ({sections.today.length})</span>
            </div>
            <div className="space-y-2">
              {sections.today.map((t) => renderTaskCard(t))}
            </div>
          </div>
        )}

        {/* UPCOMING SECTION */}
        {sections.upcoming.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              <Calendar size={14} />
              <span>Upcoming ({sections.upcoming.length})</span>
            </div>
            <div className="space-y-2">
              {sections.upcoming.map((t) => renderTaskCard(t))}
            </div>
          </div>
        )}

        {/* NO DEADLINE SECTION */}
        {sections.noDeadline.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              <Tag size={14} />
              <span>No Deadline ({sections.noDeadline.length})</span>
            </div>
            <div className="space-y-2">
              {sections.noDeadline.map((t) => renderTaskCard(t))}
            </div>
          </div>
        )}

        {/* EMPTY STATE IF NO ACTIVE TASKS */}
        {sections.overdue.length === 0 &&
          sections.today.length === 0 &&
          sections.upcoming.length === 0 &&
          sections.noDeadline.length === 0 &&
          activeTab !== 'completed' && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/70 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Check size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">All caught up!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active tasks matching your filter. Click Add Assignment or Add To-Do above to record deadlines.
              </p>
            </div>
          )}

        {/* COMPLETED SECTION (Collapsible) */}
        {sections.completed.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 space-y-3">
            <button
              type="button"
              onClick={() => setCompletedCollapsed(!completedCollapsed)}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              {completedCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span>Completed ({sections.completed.length})</span>
            </button>

            {!completedCollapsed && (
              <div className="space-y-2">
                {sections.completed.map((t) => renderTaskCard(t))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT TASK DIALOG */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingTaskId ? 'Edit Task' : modalTaskType === 'assignment' ? 'New Assignment' : 'New Personal To-Do'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {modalTaskType === 'assignment'
                ? 'Record coursework, submission links and deadline alerts.'
                : 'Manage personal studies, projects and reminders.'}
            </DialogDescription>
          </DialogHeader>

          {/* Type Toggle Switch (only when creating) */}
          {!editingTaskId && (
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTaskType('assignment')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  modalTaskType === 'assignment' ? 'bg-white shadow-2xs text-indigo-600 font-bold' : 'text-slate-600'
                }`}
              >
                Assignment
              </button>
              <button
                type="button"
                onClick={() => setModalTaskType('todo')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  modalTaskType === 'todo' ? 'bg-white shadow-2xs text-indigo-600 font-bold' : 'text-slate-600'
                }`}
              >
                Personal To-Do
              </button>
            </div>
          )}

          <form onSubmit={handleSaveTask} className="space-y-4 mt-2">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {modalTaskType === 'assignment' ? 'Assignment Title' : 'Task Title'}
              </label>
              <Input
                placeholder={
                  modalTaskType === 'assignment'
                    ? 'e.g. Lab Exercise 3: Binary Search Tree'
                    : 'e.g. Renew library books'
                }
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            {/* Assignment-specific: Course & Slot & Professor */}
            {modalTaskType === 'assignment' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Course</label>
                    <Select value={formCourse} onValueChange={handleCourseChange}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {enrolledCourses.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">
                            {c.code} · {c.name.slice(0, 24)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Slot</label>
                    <Input
                      placeholder="e.g. B or L3+L4"
                      value={formSlot}
                      onChange={(e) => setFormSlot(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Professor (Optional)</label>
                  <Input
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={formProf}
                    onChange={(e) => setFormProf(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </>
            )}

            {/* To-Do Category */}
            {modalTaskType === 'todo' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Category</label>
                <Select
                  value={formCategory}
                  onValueChange={(v) => setFormCategory(v as TaskCategory)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal" className="text-xs">Personal</SelectItem>
                    <SelectItem value="Study" className="text-xs">Study</SelectItem>
                    <SelectItem value="College" className="text-xs">College</SelectItem>
                    <SelectItem value="Project" className="text-xs">Project</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description / Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description / Notes</label>
              <textarea
                rows={2}
                placeholder="Details, requirements, guidelines..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Due Date</label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Due Time</label>
                <Input
                  type="time"
                  value={formDueTime}
                  onChange={(e) => setFormDueTime(e.target.value)}
                  disabled={!formDueDate}
                  className="text-xs h-9 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Priority & Reminder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Priority</label>
                <Select
                  value={formPriority}
                  onValueChange={(v) => setFormPriority(v as TaskPriority)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW" className="text-xs">Low</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">Medium</SelectItem>
                    <SelectItem value="HIGH" className="text-xs">High</SelectItem>
                    <SelectItem value="URGENT" className="text-xs font-bold text-rose-600">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Reminder</label>
                <Select
                  value={formReminder}
                  onValueChange={(v) => setFormReminder(v as ReminderOption)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No Reminder</SelectItem>
                    <SelectItem value="at_deadline" className="text-xs">At Deadline</SelectItem>
                    <SelectItem value="10m" className="text-xs">10 minutes before</SelectItem>
                    <SelectItem value="30m" className="text-xs">30 minutes before</SelectItem>
                    <SelectItem value="1h" className="text-xs">1 hour before</SelectItem>
                    <SelectItem value="3h" className="text-xs">3 hours before</SelectItem>
                    <SelectItem value="1d" className="text-xs">1 day before</SelectItem>
                    <SelectItem value="2d" className="text-xs">2 days before</SelectItem>
                    <SelectItem value="custom" className="text-xs">Custom minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formReminder === 'custom' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Custom Alert (Minutes Before)</label>
                <Input
                  type="number"
                  min="5"
                  max="10080"
                  value={formCustomMin}
                  onChange={(e) => setFormCustomMin(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            )}

            {/* Submission Link (Assignment only) */}
            {modalTaskType === 'assignment' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Submission Link (Optional)</label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={formSubmissionLink}
                  onChange={(e) => setFormSubmissionLink(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {editingTaskId ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
