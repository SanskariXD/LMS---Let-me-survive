# LMS² — Daily Quotes, Language Pack & Tone Breakdown

This document provides a full inventory of the **Daily Sarcastic Quotes** and the comprehensive **English vs. Gen-Z Language Pack** implemented in the LMS² platform, along with suggestions for tone and feature improvements.

---

## 1. Daily Sarcastic Quotes Data (`SARCASTIC_QUOTES`)

These quotes rotate in the **Reality Check** / **Daily Reality Slap** card on the student dashboard ([app/portal.tsx](file:///x:/TIIMETABLE/app/portal.tsx#L83-L128)). Students can read them daily or shuffle them with the refresh button.

| # | Quote | Author / Persona |
|---|---|---|
| **1** | *"Due tomorrow? Do tomorrow. You've survived worse crises created entirely by your own terrible decisions."* | The Art of Procrastination |
| **2** | *"Attendance doesn't measure intelligence, but it definitely measures your tolerance for PowerPoint being read aloud word-for-word."* | 8:30 AM Lecture Victim |
| **3** | *"College is where you pay lakhs of rupees to teach yourself the entire syllabus in 47 minutes from an Indian guy on YouTube."* | Final Exam Preparation Guide |
| **4** | *"They say hard work pays off in the future. But laziness pays off right now. Choose your regrets wisely."* | Bedtime Rationalizations |
| **5** | *"Your degree will look magnificent framed above the desk where you frantically Google 'how to center a div'."* | Computer Science Reality Check |
| **6** | *"Nothing haunts a human soul like the sleep they sacrificed to procrastinate until 4 AM without doing any actual work."* | Midnight Regrets, Vol. 4 |
| **7** | *"Remember: 75% attendance doesn't make you educated, it just makes you legally present."* | The Biometric Machine |
| **8** | *"The syllabus said '10 hours of self-study per week' with a completely straight face."* | Academic Fiction Weekly |
| **9** | *"God gives his toughest battles to his sleepiest soldiers who spent 5 hours watching reels about restoring rusty knives."* | Morning Lecture Chronicles |
| **10** | *"A deadline is merely a polite recommendation until exactly 23 minutes before the submission portal locks you out."* | Adrenaline & Caffeine Dept. |
| **11** | *"Attending class purely to avoid an attendance debarment is the purest form of character development."* | Campus Matrix Survivor |

---

## 2. English vs. Gen-Z Language Dictionary (`lib/i18n.ts`)

The portal supports instant language switching between formal **English** and unfiltered **Gen-Z** college humor via the sidebar switcher or profile preferences.

### A. Brand & Identity
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `brandName` | LMS² | LMS² |
| `brandTagline` | Let me survive. | Let me survive. |
| `subTagline` | Plan · Track · Stay Ahead | Same Chaos · Just Easier |

---

### B. Navigation Menu
| Feature Key | English (`en`) | Gen-Z (`genz`) | Notes |
|---|---|---|---|
| `navOverview` | Dashboard | Vibe Check | Main student dashboard |
| `navAttendance` | Attendance | Bunk Tracker | Percentage & margin tracking |
| `navMarks` | Marks | Damage Report | Exam & internal assessments |
| `navTimetable` | Timetable | Where Do I Be | Weekly schedule |
| `navAcademics` | Academics | Degree Lore | Degree progress & credits |
| `navTasks` | Tasks | Side Quests | Assignments & reminders |
| `navResources` | Resource Hub | Cheat Codes | Notes & question papers |
| `navProfile` | Profile | The Victim | Student profile & settings |

---

### C. Greetings & Dashboard Header
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `greetingMorning` | Good morning | Rise and grind |
| `greetingAfternoon` | Good afternoon | Surviving yet |
| `greetingEvening` | Good evening | Yo |
| `headerSub` | Stay on top of your schedule and coursework. | No cap, 75% attendance is a canon event. |

---

### D. Dashboard Cards & Bento Grid
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `todayScheduleTitle` | Today's Schedule | Today's Lineup |
| `todayScheduleSub` | Live slot progression & venue locations | Where you gotta drag yourself today |
| `noClassesToday` | No classes scheduled for today. Enjoy your day! | Zero lectures today. Go touch grass fr. |
| `attendanceOverviewTitle` | Attendance Overview | Attendance Vibes |
| `attendanceOverviewSub` | Semester lecture & lab attendance tracking | How cooked are you actually |
| `overallAttendance` | Overall Attendance | Total Standing |
| `onTrack` | On Track (≥75%) | Safe to Bunk (≥75%) |
| `needsAttention` | Needs Attention (<75%) | Cooked Zone (<75%) |
| `quickActionsTitle` | Quick Actions | Fast Travel |
| `quickActionsSub` | Direct workspace navigation | Hop straight into the action |
| `upcomingDeadlinesTitle` | Upcoming Deadlines | Doom Clocks |
| `upcomingDeadlinesSub` | Pending tasks & coursework | Stuff due before you crash |
| `viewAll` | View All | See Chaos |
| `noDeadlines` | All caught up! No pending deadlines. | Zero panics right now. You are chilling fr. |
| `realityCheckTitle` | Reality Check | Daily Reality Slap |
| `openSlotwise` | Open Slotwise Planner | Open Clash Fixer |

---

### E. Quick Action Buttons
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `actionTimetable` | Timetable | The Grid |
| `actionAttendance` | Attendance | Bunk Meter |
| `actionMarks` | Marks | Expose Scores |
| `actionTasks` | My Tasks | Avoid Panic |

---

### F. Timetable View
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `timetableTitle` | Class Timetable | Weekly Survival Map |
| `timetableSub` | Weekly schedule & clash-free slot allocation | Clash-free schedule so you do not cry |
| `twoSlotLabBadge` | 2-Slot Practical Lab | 2-Hour Lab Marathon |

---

### G. Tasks & Assignments View
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `tasksTitle` | Tasks & Deadlines | Quests & Avoidances |
| `tasksSub` | Manage academic assignments and personal to-dos | Assignments and to-dos you swore you would do yesterday |
| `addTask` | Add Task | Log Quest |
| `allTasks` | All Tasks | All Quests |
| `assignmentsOnly` | Assignments | Uni Homework |
| `todosOnly` | To-Dos | Personal Stuff |
| `dueToday` | Due Today | Due RN |
| `upcoming` | Upcoming | Future Panic |
| `overdue` | Overdue | RIP (Late) |
| `completed` | Completed | Crushed It |

---

### H. Resource Hub View
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `resourcesTitle` | Resource Hub | Academic Cheat Codes |
| `resourcesSub` | Curated peer notes, question banks & open-book references | Notes, question banks and materials saving your GPA |
| `openBookTag` | Open Book Approved | Open Book Gold 📖 |
| `shareResource` | Share Resource | Drop Your Notes |

---

### I. Student Profile & Settings
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `profileTitle` | Student Profile | Student Dossier |
| `basicInfoTitle` | Basic Information | Uni Registry Lore |
| `academicSnapshotTitle` | Academic Snapshot | Season Stats |
| `preferencesTitle` | Preferences | Vibe Settings |
| `offlineDataTitle` | Offline & Local Data | Offline Vault |

---

### J. Common / Status Modals
| Feature Key | English (`en`) | Gen-Z (`genz`) |
|---|---|---|
| `retry` | Retry | Hit it again |
| `offlineNotice` | University services are currently offline. Showing your last saved data. | Uni server took a nap. Showing saved data fr. |

---

## 3. Potential Improvements & Ideas for Future Updates

1. **Gen-Z Variations for Sarcastic Quotes**:
   - Currently, quotes are shared between both modes. We can create a dedicated Gen-Z pool of sarcastic quotes with campus-specific humor (e.g., *"Amizone crashed 2 minutes before course registration? Classic."*, *"Main gate guards checking ID cards like it's international border control"*).
2. **Attendance Advice Slang**:
   - In `attendanceAdvice()`, instead of just *"3 classes buffer above 75%"*, Gen-Z mode could output *"You can bunk 3 lectures and still survive fr"*, or *"Cooked. Attend next 5 classes with zero skips"*.
3. **Daily Quote Rotation by Date Hash**:
   - Instead of starting from quote 0 on every page refresh, calculate index based on `dayOfYear % quotes.length` so every student gets a synchronized "Quote of the Day" with shuffle option.
