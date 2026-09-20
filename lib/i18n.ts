export type Language = 'en' | 'genz';

export interface Dictionary {
  // Brand & Slogans
  brandName: string;
  brandTagline: string;
  subTagline: string;

  // Nav
  navOverview: string;
  navAttendance: string;
  navMarks: string;
  navTimetable: string;
  navAcademics: string;
  navTasks: string;
  navResources: string;
  navProfile: string;

  // Greetings & Header
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  headerSub: string;

  // Dashboard Cards
  todayScheduleTitle: string;
  todayScheduleSub: string;
  noClassesToday: string;
  attendanceOverviewTitle: string;
  attendanceOverviewSub: string;
  overallAttendance: string;
  onTrack: string;
  needsAttention: string;
  quickActionsTitle: string;
  quickActionsSub: string;
  upcomingDeadlinesTitle: string;
  upcomingDeadlinesSub: string;
  viewAll: string;
  noDeadlines: string;
  realityCheckTitle: string;
  openSlotwise: string;

  // Quick Action Buttons
  actionTimetable: string;
  actionAttendance: string;
  actionMarks: string;
  actionTasks: string;

  // Timetable
  timetableTitle: string;
  timetableSub: string;
  twoSlotLabBadge: string;

  // Tasks
  tasksTitle: string;
  tasksSub: string;
  addTask: string;
  allTasks: string;
  assignmentsOnly: string;
  todosOnly: string;
  dueToday: string;
  upcoming: string;
  overdue: string;
  completed: string;

  // Resource Hub
  resourcesTitle: string;
  resourcesSub: string;
  openBookTag: string;
  shareResource: string;

  // Profile
  profileTitle: string;
  basicInfoTitle: string;
  academicSnapshotTitle: string;
  preferencesTitle: string;
  offlineDataTitle: string;

  // Common
  retry: string;
  offlineNotice: string;
}

export const translations: Record<Language, Dictionary> = {
  en: {
    brandName: 'LMS²',
    brandTagline: 'Let me survive.',
    subTagline: 'Plan · Track · Stay Ahead',

    navOverview: 'Dashboard',
    navAttendance: 'Attendance',
    navMarks: 'Marks',
    navTimetable: 'Timetable',
    navAcademics: 'Academics',
    navTasks: 'Tasks',
    navResources: 'Resource Hub',
    navProfile: 'Profile',

    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    headerSub: 'Stay on top of your schedule and coursework.',

    todayScheduleTitle: "Today's Schedule",
    todayScheduleSub: 'Live slot progression & venue locations',
    noClassesToday: 'No classes scheduled for today. Enjoy your day!',
    attendanceOverviewTitle: 'Attendance Overview',
    attendanceOverviewSub: 'Semester lecture & lab attendance tracking',
    overallAttendance: 'Overall Attendance',
    onTrack: 'On Track (≥75%)',
    needsAttention: 'Needs Attention (<75%)',
    quickActionsTitle: 'Quick Actions',
    quickActionsSub: 'Direct workspace navigation',
    upcomingDeadlinesTitle: 'Upcoming Deadlines',
    upcomingDeadlinesSub: 'Pending tasks & coursework',
    viewAll: 'View All',
    noDeadlines: 'All caught up! No pending deadlines.',
    realityCheckTitle: 'Reality Check',
    openSlotwise: 'Open Slotwise Planner',

    actionTimetable: 'Timetable',
    actionAttendance: 'Attendance',
    actionMarks: 'Marks',
    actionTasks: 'My Tasks',

    timetableTitle: 'Class Timetable',
    timetableSub: 'Weekly schedule & clash-free slot allocation',
    twoSlotLabBadge: '2-Slot Practical Lab',

    tasksTitle: 'Tasks & Deadlines',
    tasksSub: 'Manage academic assignments and personal to-dos',
    addTask: 'Add Task',
    allTasks: 'All Tasks',
    assignmentsOnly: 'Assignments',
    todosOnly: 'To-Dos',
    dueToday: 'Due Today',
    upcoming: 'Upcoming',
    overdue: 'Overdue',
    completed: 'Completed',

    resourcesTitle: 'Resource Hub',
    resourcesSub: 'Curated peer notes, question banks & open-book references',
    openBookTag: 'Open Book Approved',
    shareResource: 'Share Resource',

    profileTitle: 'Student Profile',
    basicInfoTitle: 'Basic Information',
    academicSnapshotTitle: 'Academic Snapshot',
    preferencesTitle: 'Preferences',
    offlineDataTitle: 'Offline & Local Data',

    retry: 'Retry',
    offlineNotice: 'University services are currently offline. Showing your last saved data.',
  },

  genz: {
    brandName: 'LMS²',
    brandTagline: 'Let me survive.',
    subTagline: 'Same Chaos · Just Easier',

    navOverview: 'Vibe Check',
    navAttendance: 'Bunk Tracker',
    navMarks: 'Damage Report',
    navTimetable: 'Where Do I Be',
    navAcademics: 'Degree Lore',
    navTasks: 'Side Quests',
    navResources: 'Cheat Codes',
    navProfile: 'The Victim',

    greetingMorning: 'Rise and grind',
    greetingAfternoon: 'Surviving yet',
    greetingEvening: 'Yo',
    headerSub: 'No cap, 75% attendance is a canon event.',

    todayScheduleTitle: "Today's Lineup",
    todayScheduleSub: 'Where you gotta drag yourself today',
    noClassesToday: 'Zero lectures today. Go touch grass fr.',
    attendanceOverviewTitle: 'Attendance Vibes',
    attendanceOverviewSub: 'How cooked are you actually',
    overallAttendance: 'Total Standing',
    onTrack: 'Safe to Bunk (≥75%)',
    needsAttention: 'Cooked Zone (<75%)',
    quickActionsTitle: 'Fast Travel',
    quickActionsSub: 'Hop straight into the action',
    upcomingDeadlinesTitle: 'Doom Clocks',
    upcomingDeadlinesSub: 'Stuff due before you crash',
    viewAll: 'See Chaos',
    noDeadlines: 'Zero panics right now. You are chilling fr.',
    realityCheckTitle: 'Daily Reality Slap',
    openSlotwise: 'Open Clash Fixer',

    actionTimetable: 'The Grid',
    actionAttendance: 'Bunk Meter',
    actionMarks: 'Expose Scores',
    actionTasks: 'Avoid Panic',

    timetableTitle: 'Weekly Survival Map',
    timetableSub: 'Clash-free schedule so you do not cry',
    twoSlotLabBadge: '2-Hour Lab Marathon',

    tasksTitle: 'Quests & Avoidances',
    tasksSub: 'Assignments and to-dos you swore you would do yesterday',
    addTask: 'Log Quest',
    allTasks: 'All Quests',
    assignmentsOnly: 'Uni Homework',
    todosOnly: 'Personal Stuff',
    dueToday: 'Due RN',
    upcoming: 'Future Panic',
    overdue: 'RIP (Late)',
    completed: 'Crushed It',

    resourcesTitle: 'Academic Cheat Codes',
    resourcesSub: 'Notes, question banks and materials saving your GPA',
    openBookTag: 'Open Book Gold 📖',
    shareResource: 'Drop Your Notes',

    profileTitle: 'Student Dossier',
    basicInfoTitle: 'Uni Registry Lore',
    academicSnapshotTitle: 'Season Stats',
    preferencesTitle: 'Vibe Settings',
    offlineDataTitle: 'Offline Vault',

    retry: 'Hit it again',
    offlineNotice: 'Uni server took a nap. Showing saved data fr.',
  },
};
