'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Filter,
  Download,
  Bookmark,
  ThumbsUp,
  AlertTriangle,
  FileText,
  FileCode,
  FileArchive,
  Calendar,
  User,
  CheckCircle2,
  Tag,
  Sparkles,
  ExternalLink,
  Layers,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export type ResourceType =
  | 'Class Notes'
  | 'Assignments'
  | 'Assignment References'
  | 'Open Book Notes'
  | 'Study Material'
  | 'Lab Material'
  | 'Previous Questions'
  | 'Reference Material'
  | 'Other';

export interface AcademicResource {
  id: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  courseCode: string;
  courseName: string;
  professor: string;
  slot: string;
  semester: string;
  sharedBy: string;
  dateAdded: string; // YYYY-MM-DD
  fileType: 'PDF' | 'ZIP' | 'DOCX' | 'PPTX' | 'CODE';
  fileSize: string;
  tags?: string[];
  isOpenBook?: boolean;
  examOrAssessmentName?: string;
  isUserShared?: boolean;
}

const STORAGE_KEY = 'slotwise_shared_resources';
const SAVED_BOOKMARKS_KEY = 'slotwise_saved_resource_ids';
const HELPFUL_VOTES_KEY = 'slotwise_helpful_resource_ids';

const INITIAL_RESOURCES: AcademicResource[] = [
  {
    id: 'res-1',
    title: 'Data Structures & Algorithms — Complete Handwritten Open Book Reference Sheet',
    description:
      'Covers AVL Trees rotation formulas, Red-Black tree insertion cases, Dijkstra step-by-step trace, and Graph traversal cheat sheet for open-book midterm.',
    resourceType: 'Open Book Notes',
    courseCode: 'CSE2001',
    courseName: 'Data Structures and Algorithms',
    professor: 'Dr. Ramesh Kumar',
    slot: 'B',
    semester: 'Summer 2025-26',
    sharedBy: 'Anjan S. (Batch 2024)',
    dateAdded: '2026-09-18',
    fileType: 'PDF',
    fileSize: '4.2 MB',
    isOpenBook: true,
    examOrAssessmentName: 'Mid-Term Exam',
    tags: ['trees', 'graphs', 'dijkstra', 'formula-sheet'],
  },
  {
    id: 'res-2',
    title: 'Relational Database Management System — SQL Normalization & 3NF Proofs Handbook',
    description:
      'Complete functional dependency reduction rules, BCNF vs 3NF decomposition examples, and complex JOIN query templates allowed during the open-book practical.',
    resourceType: 'Open Book Notes',
    courseCode: 'CSE2007',
    courseName: 'Relational Database Management System',
    professor: 'Prof. Sneha Rao',
    slot: 'D',
    semester: 'Summer 2025-26',
    sharedBy: 'Course TA Group',
    dateAdded: '2026-09-17',
    fileType: 'PDF',
    fileSize: '3.1 MB',
    isOpenBook: true,
    examOrAssessmentName: 'Continuous Assessment 2',
    tags: ['sql', '3nf', 'normalization', 'bcnf'],
  },
  {
    id: 'res-3',
    title: 'Operating Systems with Linux Internals — Mid-Term Question Bank & Solved Proofs',
    description:
      'Compilation of previous 3 years questions on Bankers Algorithm, virtual memory paging, translation lookaside buffers (TLB), and IPC socket programming.',
    resourceType: 'Previous Questions',
    courseCode: 'CSE2046',
    courseName: 'Operating Systems with Linux Internals',
    professor: 'Prof. Anand Verma',
    slot: 'F',
    semester: 'Summer 2025-26',
    sharedBy: 'SET Student Council',
    dateAdded: '2026-09-15',
    fileType: 'PDF',
    fileSize: '5.4 MB',
    tags: ['bankers-algorithm', 'paging', 'previous-years'],
  },
  {
    id: 'res-4',
    title: 'Object Oriented Programming with Java — Lab Experiments 1-12 Solutions Manual',
    description:
      'Fully tested code samples covering multithreading, JavaFX event listeners, custom exceptions, and JDBC connection pools for Amity portal lab evaluations.',
    resourceType: 'Lab Material',
    courseCode: 'CSE1018',
    courseName: 'Object Oriented Programming with Java',
    professor: 'Prof. M. Swaminathan',
    slot: 'L3+L4',
    semester: 'Summer 2025-26',
    sharedBy: 'Verified Batchmate',
    dateAdded: '2026-09-12',
    fileType: 'ZIP',
    fileSize: '8.6 MB',
    tags: ['java', 'lab-manual', 'multithreading', 'jdbc'],
  },
  {
    id: 'res-5',
    title: 'Cloud Computing — AWS IAM, EC2 Auto-Scaling & Microservices Architecture Guide',
    description:
      'Reference architecture diagrams and CLI configurations for Cloud Computing semester project submissions.',
    resourceType: 'Assignment References',
    courseCode: 'CSE2008',
    courseName: 'Cloud Computing',
    professor: 'Prof. Priya Nair',
    slot: 'C',
    semester: 'Summer 2025-26',
    sharedBy: 'Priya K.',
    dateAdded: '2026-09-10',
    fileType: 'PDF',
    fileSize: '3.8 MB',
    tags: ['aws', 'iam', 'docker', 'ec2'],
  },
  {
    id: 'res-6',
    title: 'Discrete Mathematics & Graph Theory — Formal Proofs & Propositional Logic Cheat Sheet',
    description:
      'Truth tables, pigeonhole principle applications, Eulerian circuits, and recurrence relations cheat sheet.',
    resourceType: 'Study Material',
    courseCode: 'MAT2002',
    courseName: 'Discrete Mathematics and Graph Theory',
    professor: 'Dr. K. Sharma',
    slot: 'A',
    semester: 'Summer 2025-26',
    sharedBy: 'Math Study Circle',
    dateAdded: '2026-09-08',
    fileType: 'PDF',
    fileSize: '2.1 MB',
    tags: ['logic', 'proofs', 'recurrence', 'trees'],
  },
  {
    id: 'res-7',
    title: 'Computer Architecture & Organization — Cache Mapping & Pipeline Hazard Resolution',
    description:
      'Direct vs set-associative cache hit/miss calculations and structural/data/control hazard forwarding paths.',
    resourceType: 'Class Notes',
    courseCode: 'ECE2006',
    courseName: 'Computer Architecture and Organization',
    professor: 'Dr. Rajesh Iyer',
    slot: 'E',
    semester: 'Summer 2025-26',
    sharedBy: 'Sanjay V.',
    dateAdded: '2026-09-05',
    fileType: 'PDF',
    fileSize: '2.9 MB',
    tags: ['pipeline', 'hazards', 'cache-memory'],
  },
  {
    id: 'res-8',
    title: 'Web Technology — Full Stack MERN Practice Open Book Reference & Boilerplate',
    description:
      'Express routing middleware templates, JWT token verification, and MongoDB aggregation pipelines allowed during open-book coding assessments.',
    resourceType: 'Open Book Notes',
    courseCode: 'CSE2002',
    courseName: 'Web Technology',
    professor: 'Prof. Arun Patel',
    slot: 'B',
    semester: 'Summer 2025-26',
    sharedBy: 'Dev Club',
    dateAdded: '2026-09-02',
    fileType: 'ZIP',
    fileSize: '6.3 MB',
    isOpenBook: true,
    examOrAssessmentName: 'Laboratory Evaluation 2',
    tags: ['mern', 'react', 'express', 'jwt'],
  },
];

interface ResourceHubProps {
  enrolledCourses?: Array<{ code: string; name: string; slot?: string }>;
}

export function ResourcesView({ enrolledCourses = [] }: ResourceHubProps) {
  const [resources, setResources] = useState<AcademicResource[]>(INITIAL_RESOURCES);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-filters
  const [filterCourse, setFilterCourse] = useState('ALL');
  const [filterProfessor, setFilterProfessor] = useState('ALL');
  const [filterSlot, setFilterSlot] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [openBookOnly, setOpenBookOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');

  // Local bookmarks & helpful status
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDesc, setShareDesc] = useState('');
  const [shareType, setShareType] = useState<ResourceType>('Open Book Notes');
  const [shareCourse, setShareCourse] = useState('');
  const [shareProf, setShareProf] = useState('');
  const [shareSlot, setShareSlot] = useState('');
  const [shareSemester, setShareSemester] = useState('Summer 2025-26');
  const [shareExamName, setShareExamName] = useState('');
  const [shareFileName, setShareFileName] = useState('');
  const [shareFileSize, setShareFileSize] = useState('');
  const [shareTags, setShareTags] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load custom shared resources & bookmarks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userResources = JSON.parse(stored);
        if (Array.isArray(userResources)) {
          setResources([...userResources, ...INITIAL_RESOURCES]);
        }
      }

      const bookmarks = localStorage.getItem(SAVED_BOOKMARKS_KEY);
      if (bookmarks) {
        setSavedIds(new Set(JSON.parse(bookmarks)));
      }

      const helpful = localStorage.getItem(HELPFUL_VOTES_KEY);
      if (helpful) {
        setHelpfulIds(new Set(JSON.parse(helpful)));
      }
    } catch {
      // ignore
    }
  }, []);

  function triggerNotice(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Toggle bookmark
  function toggleSave(id: string) {
    const next = new Set(savedIds);
    if (next.has(id)) {
      next.delete(id);
      triggerNotice('Removed from saved bookmarks.');
    } else {
      next.add(id);
      triggerNotice('Saved to your local bookmarks.');
    }
    setSavedIds(next);
    try {
      localStorage.setItem(SAVED_BOOKMARKS_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  }

  // Toggle helpful
  function toggleHelpful(id: string) {
    const next = new Set(helpfulIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      triggerNotice('Marked as helpful. Thank you for your feedback!');
    }
    setHelpfulIds(next);
    try {
      localStorage.setItem(HELPFUL_VOTES_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  }

  // Handle Share form submit
  function handleShareSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shareTitle.trim() || !shareCourse.trim()) return;

    const matchedCourse = enrolledCourses.find((c) => c.code === shareCourse);
    const isOb = shareType === 'Open Book Notes';

    const newRes: AcademicResource = {
      id: `user-res-${Date.now()}`,
      title: shareTitle.trim(),
      description: shareDesc.trim() || 'Uploaded by student.',
      resourceType: shareType,
      courseCode: shareCourse.trim().toUpperCase(),
      courseName: matchedCourse?.name || shareCourse.trim(),
      professor: shareProf.trim() || 'Department Faculty',
      slot: shareSlot.trim() || 'Campus',
      semester: shareSemester,
      sharedBy: 'You (Student)',
      dateAdded: new Date().toISOString().split('T')[0],
      fileType: shareFileName.endsWith('.zip') ? 'ZIP' : 'PDF',
      fileSize: shareFileSize || '2.5 MB',
      isOpenBook: isOb,
      examOrAssessmentName: isOb ? shareExamName || 'Assessment Reference' : undefined,
      tags: shareTags
        ? shareTags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      isUserShared: true,
    };

    const updated = [newRes, ...resources];
    setResources(updated);

    // Save user shares to localStorage
    try {
      const userOnly = updated.filter((r) => r.isUserShared);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    } catch {
      // ignore
    }

    triggerNotice('Resource shared successfully!');
    setShareModalOpen(false);
    // Reset form
    setShareTitle('');
    setShareDesc('');
    setShareFileName('');
    setShareTags('');
    setShareExamName('');
  }

  // Dynamic filter options
  const filterOptions = useMemo(() => {
    const courses = new Set<string>();
    const professors = new Set<string>();
    const slots = new Set<string>();
    const semesters = new Set<string>();

    resources.forEach((r) => {
      courses.add(r.courseCode);
      if (r.professor && r.professor !== 'Department Faculty') professors.add(r.professor);
      if (r.slot && r.slot !== 'Campus') slots.add(r.slot);
      if (r.semester) semesters.add(r.semester);
    });

    return {
      courses: Array.from(courses),
      professors: Array.from(professors),
      slots: Array.from(slots),
      semesters: Array.from(semesters),
    };
  }, [resources]);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      if (openBookOnly && !r.isOpenBook) return false;
      if (filterCourse !== 'ALL' && r.courseCode !== filterCourse) return false;
      if (filterProfessor !== 'ALL' && r.professor !== filterProfessor) return false;
      if (filterSlot !== 'ALL' && r.slot !== filterSlot) return false;
      if (filterSemester !== 'ALL' && r.semester !== filterSemester) return false;
      if (filterType !== 'ALL' && r.resourceType !== filterType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchCourse =
          r.courseCode.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q);
        const matchProf = r.professor.toLowerCase().includes(q);
        const matchTags = r.tags?.some((t) => t.toLowerCase().includes(q)) || false;
        if (!matchTitle && !matchDesc && !matchCourse && !matchProf && !matchTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return b.dateAdded.localeCompare(a.dateAdded);
    });
  }, [
    resources,
    openBookOnly,
    filterCourse,
    filterProfessor,
    filterSlot,
    filterSemester,
    filterType,
    searchQuery,
    sortBy,
  ]);

  function getFileIcon(type: string) {
    if (type === 'ZIP') return <FileArchive size={16} className="text-amber-600" />;
    if (type === 'CODE') return <FileCode size={16} className="text-indigo-600" />;
    return <FileText size={16} className="text-rose-600" />;
  }

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={15} className="text-indigo-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Academic Resource Hub</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700">
              Community & Course Repository
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Discover verified class notes, open-book examination references, and previous question banks by course and slot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShareModalOpen(true)}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span>Share Resource</span>
          </Button>
        </div>
      </div>

      {/* Search & Coordinated Multi-Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search notes, formula sheets, previous questions, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          {/* Quick Highlight: Open Book Notes Pill Toggle */}
          <button
            type="button"
            onClick={() => setOpenBookOnly(!openBookOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
              openBookOnly
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <Sparkles size={13} />
            <span>Open Book Notes Only</span>
          </button>
        </div>

        {/* Multi-Filters Grid (Course, Professor, Slot, Type) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
          {/* Course */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Course</span>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Courses</SelectItem>
                {filterOptions.courses.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs font-mono">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Professor */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Professor</span>
            <Select value={filterProfessor} onValueChange={setFilterProfessor}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Professors</SelectItem>
                {filterOptions.professors.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Slot */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Slot</span>
            <Select value={filterSlot} onValueChange={setFilterSlot}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Slots</SelectItem>
                {filterOptions.slots.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs font-mono">
                    Slot {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resource Type */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Type</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                <SelectItem value="Open Book Notes" className="text-xs font-bold text-amber-700">Open Book Notes</SelectItem>
                <SelectItem value="Class Notes" className="text-xs">Class Notes</SelectItem>
                <SelectItem value="Previous Questions" className="text-xs">Previous Questions</SelectItem>
                <SelectItem value="Lab Material" className="text-xs">Lab Material</SelectItem>
                <SelectItem value="Assignments" className="text-xs">Assignments</SelectItem>
                <SelectItem value="Assignment References" className="text-xs">Assignment References</SelectItem>
                <SelectItem value="Study Material" className="text-xs">Study Material</SelectItem>
                <SelectItem value="Reference Material" className="text-xs">Reference Material</SelectItem>
                <SelectItem value="Other" className="text-xs">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Sort</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent" className="text-xs">Recently Added</SelectItem>
                <SelectItem value="title" className="text-xs">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Summary / Reset */}
        {(filterCourse !== 'ALL' ||
          filterProfessor !== 'ALL' ||
          filterSlot !== 'ALL' ||
          filterType !== 'ALL' ||
          openBookOnly ||
          searchQuery) && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredResources.length} of {resources.length} resources
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterCourse('ALL');
                setFilterProfessor('ALL');
                setFilterSlot('ALL');
                setFilterType('ALL');
                setOpenBookOnly(false);
                setSearchQuery('');
              }}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Resource Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.map((res) => {
          const isBookmarked = savedIds.has(res.id);
          const isHelpful = helpfulIds.has(res.id);

          return (
            <div
              key={res.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-sm ${
                res.isOpenBook
                  ? 'bg-amber-50/25 border-amber-200/80 hover:border-amber-300'
                  : 'bg-white border-slate-200/80 hover:border-indigo-200'
              }`}
            >
              <div className="space-y-3">
                {/* Header pills */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Open Book Badge */}
                    {res.isOpenBook && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} />
                        <span>Open Book</span>
                      </span>
                    )}

                    {/* Resource Type */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.isOpenBook
                          ? 'bg-amber-100/70 text-amber-900 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}
                    >
                      {res.resourceType}
                    </span>

                    {/* Course Code */}
                    <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      {res.courseCode} · Slot {res.slot}
                    </span>
                  </div>

                  {/* File type & size */}
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1 flex-shrink-0">
                    {getFileIcon(res.fileType)}
                    <span>{res.fileSize}</span>
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {res.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {res.courseName} · Prof. {res.professor}
                  </p>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {res.description}
                </p>

                {/* Assessment / Exam target badge if applicable */}
                {res.examOrAssessmentName && (
                  <div className="p-2 rounded-lg bg-amber-100/50 border border-amber-200/60 text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                    <BookOpen size={13} className="text-amber-700 flex-shrink-0" />
                    <span>Target: {res.examOrAssessmentName}</span>
                  </div>
                )}

                {/* Tags */}
                {res.tags && res.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {res.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Metadata & Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px]">
                <div className="text-slate-400 leading-tight">
                  <span className="block font-medium text-slate-600 truncate max-w-[140px]">
                    {res.sharedBy}
                  </span>
                  <span className="text-[10px]">{res.dateAdded}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Bookmark Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleSave(res.id)}
                    className={`w-7 h-7 rounded-lg ${
                      isBookmarked ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title={isBookmarked ? 'Saved' : 'Save bookmark'}
                  >
                    <Bookmark size={13} className={isBookmarked ? 'fill-current' : ''} />
                  </Button>

                  {/* Helpful Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleHelpful(res.id)}
                    className={`w-7 h-7 rounded-lg ${
                      isHelpful ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title={isHelpful ? 'Marked helpful' : 'Helpful'}
                  >
                    <ThumbsUp size={13} className={isHelpful ? 'fill-current' : ''} />
                  </Button>

                  {/* View / Download Button */}
                  <Button
                    size="sm"
                    onClick={() => triggerNotice(`Opening preview for "${res.title}"...`)}
                    className="h-7 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 flex items-center gap-1"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResources.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/70 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No matching materials found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your filters or be the first to upload reference material for this course!
          </p>
          <Button
            size="sm"
            onClick={() => setShareModalOpen(true)}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Share Study Material
          </Button>
        </div>
      )}

      {/* SHARE RESOURCE DIALOG */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-lg bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Share Academic Resource
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Contribute class notes, assignment solutions, or open-book study references for your batchmates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleShareSubmit} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Resource Title</label>
              <Input
                placeholder="e.g. Data Structures Mid-Term Formula & Cheat Sheet"
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Resource Type</label>
                <Select value={shareType} onValueChange={(v) => setShareType(v as ResourceType)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open Book Notes" className="text-xs font-bold text-amber-700">Open Book Notes</SelectItem>
                    <SelectItem value="Class Notes" className="text-xs">Class Notes</SelectItem>
                    <SelectItem value="Assignments" className="text-xs">Assignments</SelectItem>
                    <SelectItem value="Assignment References" className="text-xs">Assignment References</SelectItem>
                    <SelectItem value="Study Material" className="text-xs">Study Material</SelectItem>
                    <SelectItem value="Lab Material" className="text-xs">Lab Material</SelectItem>
                    <SelectItem value="Previous Questions" className="text-xs">Previous Questions</SelectItem>
                    <SelectItem value="Reference Material" className="text-xs">Reference Material</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Course Code</label>
                <Input
                  placeholder="e.g. CSE2001"
                  value={shareCourse}
                  onChange={(e) => setShareCourse(e.target.value.toUpperCase())}
                  className="text-xs h-9 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Professor</label>
                <Input
                  placeholder="e.g. Dr. Ramesh Kumar"
                  value={shareProf}
                  onChange={(e) => setShareProf(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Slot</label>
                <Input
                  placeholder="e.g. B or L3+L4"
                  value={shareSlot}
                  onChange={(e) => setShareSlot(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {shareType === 'Open Book Notes' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-800">
                  Target Assessment / Exam Name (Optional)
                </label>
                <Input
                  placeholder="e.g. Mid-Term Open Book Assessment"
                  value={shareExamName}
                  onChange={(e) => setShareExamName(e.target.value)}
                  className="text-xs h-9 border-amber-200 bg-amber-50/40"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Short Description</label>
              <textarea
                rows={2}
                placeholder="What topics or formulas are included? Any tips for studying?"
                value={shareDesc}
                onChange={(e) => setShareDesc(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-input bg-transparent outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40"
              />
            </div>

            {/* File Dropzone / Picker */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Attachment (PDF / ZIP)</label>
              <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.zip,.docx,.pptx,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setShareFileName(f.name);
                      setShareFileSize(`${(f.size / (1024 * 1024)).toFixed(1)} MB`);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-1">
                  <Upload size={18} className="mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold text-slate-700">
                    {shareFileName || 'Choose file or drag & drop here'}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF, ZIP, DOCX up to 50MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tags (Comma-separated)</label>
              <Input
                placeholder="e.g. unit-2, trees, formula-sheet"
                value={shareTags}
                onChange={(e) => setShareTags(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShareModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Publish Resource
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
