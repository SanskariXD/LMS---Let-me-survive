export interface CurriculumCourse {
  code: string;
  name: string;
  credits: number;
  theory: number;
  practical: number;
  category: 'SCHOOL_CORE' | 'PROGRAM_CORE' | 'DISCIPLINE_ELECTIVE' | 'OPEN_ELECTIVE';
  basket?: string;
  mandatory?: boolean;
}

export interface BasketProgress {
  basketId: string;
  basketName: string;
  minCredits: number;
  earnedCredits: number;
  courses: Array<{ code: string; name: string; credits: number; semester?: string }>;
  satisfied: boolean;
}

export interface DegreeProgressAudit {
  totalTargetCredits: number;
  totalEarnedCredits: number;
  completionPercentage: number;
  categories: {
    schoolCore: { target: number; earned: number; percentage: number };
    programCore: { target: number; earned: number; percentage: number };
    disciplineElective: { target: number; earned: number; percentage: number };
    openElective: { target: number; earned: number; percentage: number };
  };
  specializedBaskets: BasketProgress[];
  completedCoursesCount: number;
}

export interface RecommendedCourse {
  code: string;
  name: string;
  credits: number;
  category: string;
  basket: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'ELECTIVE';
}

// 1. SCHOOL CORE COURSES (Target: 58 credits)
export const SCHOOL_CORE_COURSES: CurriculumCourse[] = [
  { code: 'CSE1018', name: 'Object Oriented Programming with Java', credits: 4, theory: 2, practical: 4, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE1017', name: 'Programming in C and C++', credits: 4, theory: 2, practical: 4, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE2001', name: 'Data Structures and Algorithms', credits: 4, theory: 3, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'MAT1001', name: 'Linear Algebra and Calculus', credits: 3, theory: 3, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'MAT1002', name: 'Differential Equations and Transform Techniques', credits: 3, theory: 3, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'MAT1013', name: 'Statistics and Probability', credits: 3, theory: 2, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'MAT1012', name: 'Numerical Techniques', credits: 3, theory: 2, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'MGT1101', name: 'Digital Entrepreneurship', credits: 2, theory: 2, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'BIT1002', name: 'Basic Human Nutrition', credits: 2, theory: 2, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'ECE1008', name: 'Innovation Project Using Arduino', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'ECE1009', name: 'Innovation Project Using Raspberry Pi', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'ECE1002', name: 'Elements of Electronics Engineering', credits: 4, theory: 3, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'ECE1001', name: 'Fundamentals of Electrical and Electronics Engineering', credits: 4, theory: 3, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'PHY1001', name: 'Physics of Opto-electronic Devices', credits: 3, theory: 2, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'PHY1002', name: 'Semiconductor Physics', credits: 3, theory: 2, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'ENG1002', name: 'Communicative English', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'ENG1003', name: 'Professional English', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'FRE1001', name: 'Basic French', credits: 2, theory: 2, practical: 0, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'GER1001', name: 'Basic German', credits: 2, theory: 2, practical: 0, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'PSY1001', name: 'Understanding Self for Effectiveness', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'PSY1002', name: 'Dynamics of Human Behaviour', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'SSK2002', name: 'Being Corporate Ready', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'SSK3001', name: 'Problem Solving through Aptitude', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE3050', name: 'Programming Skills for Employment', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE1005', name: 'Programming in Python', credits: 2, theory: 0, practical: 4, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'CSE1037', name: 'Programming in Python', credits: 3, theory: 2, practical: 2, category: 'SCHOOL_CORE', mandatory: false },
  { code: 'KAN1005', name: 'Kannada Kali', credits: 1, theory: 0, practical: 2, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CHE1001', name: 'Environmental Studies', credits: 0, theory: 2, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE4001', name: 'B.Tech. Capstone Project', credits: 4, theory: 0, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
  { code: 'CSE4002', name: 'B.Tech. Internship', credits: 6, theory: 0, practical: 0, category: 'SCHOOL_CORE', mandatory: true },
];

// 2. PROGRAM CORE COURSES (Target: 42 credits, All Mandatory)
export const PROGRAM_CORE_COURSES: CurriculumCourse[] = [
  { code: 'CSE1006', name: 'Software Engineering', credits: 3, theory: 3, practical: 0, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2002', name: 'Web Technology', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2045', name: 'Algorithmic Design and Analysis', credits: 4, theory: 3, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'ECE2006', name: 'Computer Architecture and Organization', credits: 3, theory: 3, practical: 0, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2046', name: 'Operating Systems with Linux Internals', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2006', name: 'Communication Networks', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2007', name: 'Relational Database Management System', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2008', name: 'Cloud Computing', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2009', name: 'Data Analytics and Visualization', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE1035', name: 'Fundamentals of Artificial Intelligence and Machine Learning', credits: 3, theory: 2, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'MAT2002', name: 'Discrete Mathematics and Graph Theory', credits: 3, theory: 3, practical: 0, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE2015', name: 'Source Code Management', credits: 1, theory: 0, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'CSE3003', name: 'Cryptography and Network Security', credits: 3, theory: 3, practical: 0, category: 'PROGRAM_CORE', mandatory: true },
  { code: 'ECE1003', name: 'Digital Design, Microprocessors and Microcontrollers', credits: 4, theory: 3, practical: 2, category: 'PROGRAM_CORE', mandatory: true },
];

// 3. SPECIALIZED ELECTIVE BASKETS (Target: 24 credits, min 3 credits per basket)
export const SPECIALIZED_BASKETS: Record<string, { name: string; minCredits: number; courses: CurriculumCourse[] }> = {
  aiml: {
    name: 'Artificial Intelligence & Machine Learning',
    minCredits: 3,
    courses: [
      { code: 'CSE3010', name: 'AI & ML Applications', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE3011', name: 'Machine Learning Techniques', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE3015', name: 'Natural Language Processing', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE3013', name: 'Deep Neural Networks', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE3012', name: 'Optimization Techniques in Machine Learning', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE3014', name: 'Reinforcement Learning Techniques', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
      { code: 'CSE4005', name: 'Industrial Applications of AI & ML', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'aiml' },
    ],
  },
  cyber: {
    name: 'Cyber Security',
    minCredits: 3,
    courses: [
      { code: 'CSE3022', name: 'Intrusion Detection and Prevention System', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3021', name: 'Ethical Hacking', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3025', name: 'Networking and System Administration', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3020', name: 'Social Media Privacy and Security', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3023', name: 'Fundamentals of Cloud Security', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3024', name: 'Penetration Testing and Incident Response', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE3026', name: 'Blockchain and Distributed Ledger Technology', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
      { code: 'CSE4009', name: 'Industrial Applications of Cyber Security', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cyber' },
    ],
  },
  data: {
    name: 'Data Analytics',
    minCredits: 3,
    courses: [
      { code: 'CSE1008', name: 'Statistical Foundations of Data Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE1012', name: 'R Programming for Data Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE1013', name: 'Exploratory Data Analysis', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2024', name: 'Web Data Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2025', name: 'Predictive Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2026', name: 'Social Media Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2027', name: 'Healthcare Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2028', name: 'Big Data Analytics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE2029', name: 'Business Analytics Fundamentals', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
      { code: 'CSE4010', name: 'Industrial Applications of Data Analytics', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'data' },
    ],
  },
  iot: {
    name: 'Internet of Things (IoT)',
    minCredits: 3,
    courses: [
      { code: 'ECE2004', name: 'Sensor Technology, Embedded Systems and UI', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'ECE2002', name: 'IoT Platforms and Application Development', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'CSE2031', name: 'Wireless Communication in IoT', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'ECE2001', name: 'IoT Architecture and Protocols', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'CSE2032', name: 'Mobile Application for IoT', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'CSE2033', name: 'Cloud Computing for IoT', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'CSE2030', name: 'Big Data Analytics for IoT', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
      { code: 'ECE2003', name: 'Industrial Internet of Things', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'iot' },
    ],
  },
  cloud: {
    name: 'Cloud Computing',
    minCredits: 3,
    courses: [
      { code: 'CSE2037', name: 'Database and Network Management', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE2036', name: 'Cloud Services and APIs', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE2034', name: 'Design and Operation of Data Center', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE2076', name: 'System Provisioning and Monitoring', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE2038', name: 'Cloud Computing Platforms', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE3028', name: 'Edge Computing Paradigms', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
      { code: 'CSE4003', name: 'Industrial Applications of Cloud Computing', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'cloud' },
    ],
  },
  robotics: {
    name: 'Robotics',
    minCredits: 3,
    courses: [
      { code: 'ECE5002', name: 'Principles of Robotics and RoS', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'ECE2037', name: 'Drone Technology', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'CSE5096', name: 'Robotic Process Automation', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'CSE5099', name: 'Robot Motion Planning', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'ECE3026', name: 'Building Robots', credits: 3, theory: 0, practical: 6, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'CSE3031', name: 'Autonomous Mobile Robots', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
      { code: 'CSE4004', name: 'Industrial Applications of Robotics', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'robotics' },
    ],
  },
  bigdata: {
    name: 'Big Data',
    minCredits: 3,
    courses: [
      { code: 'CSE3019', name: 'Big Data Security and Privacy', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'bigdata' },
      { code: 'CSE1011', name: 'Information Visualization', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'bigdata' },
      { code: 'CSE2080', name: 'Data Engineering Pipelines', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'bigdata' },
      { code: 'CSE3034', name: 'Data Ingestion Techniques', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'bigdata' },
      { code: 'CSE4011', name: 'Industrial Applications of BigData', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'bigdata' },
    ],
  },
  fullstack: {
    name: 'Full Stack Development',
    minCredits: 3,
    courses: [
      { code: 'CSE2022', name: 'Front End Engineering', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE2023', name: 'Backend Engineering', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE2041', name: 'NoSQL Data Bases and RAG', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE3017', name: 'Java, Springboot and Microservices', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE3018', name: 'MEAN/ MERN Stack', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE4008', name: 'Industrial Applications of Full Stack', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
      { code: 'CSE4013', name: 'Full Stack AI', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'fullstack' },
    ],
  },
  devops: {
    name: 'DevOps',
    minCredits: 3,
    courses: [
      { code: 'CSE2035', name: 'DevOps', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE2042', name: 'Development Automation', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE2043', name: 'Advanced Linux and Shell Scripting', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE2040', name: 'Continuous Integration and CD', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE2048', name: 'Microservices and SOA', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE2079', name: 'Containerization and Orchestration', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
      { code: 'CSE4007', name: 'Industrial Applications of DevOps', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE', basket: 'devops' },
    ],
  },
};

// 4. COMMON ELECTIVES BASKET (Target: 18 credits)
export const COMMON_ELECTIVES: CurriculumCourse[] = [
  { code: 'CSE1007', name: 'Programming in C# and .NET Framework', credits: 2, theory: 0, practical: 4, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE1009', name: 'Linux Internals', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2044', name: 'Computer Graphics with OpenGL', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2011', name: 'Advanced Java', credits: 2, theory: 0, practical: 4, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2012', name: 'Advanced Database Management System', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2014', name: 'Compiler Design', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2016', name: 'Software Quality Assurance', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE2017', name: 'UI/UX', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE3004', name: 'Parallel and Distributed Computing', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE3001', name: 'Theory of Computation', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'CSE3016', name: 'Object Oriented Modelling and Design using UML', credits: 3, theory: 3, practical: 0, category: 'DISCIPLINE_ELECTIVE' },
  { code: 'MAT2001', name: 'Advanced Statistics', credits: 3, theory: 2, practical: 2, category: 'DISCIPLINE_ELECTIVE' },
];

/**
 * Maps course code to its official curriculum definition
 */
const ALL_CURRICULUM_COURSES = new Map<string, CurriculumCourse>();
for (const c of SCHOOL_CORE_COURSES) ALL_CURRICULUM_COURSES.set(c.code, c);
for (const c of PROGRAM_CORE_COURSES) ALL_CURRICULUM_COURSES.set(c.code, c);
for (const basket of Object.values(SPECIALIZED_BASKETS)) {
  for (const c of basket.courses) ALL_CURRICULUM_COURSES.set(c.code, c);
}
for (const c of COMMON_ELECTIVES) ALL_CURRICULUM_COURSES.set(c.code, c);

export function getCurriculumCourse(code: string): CurriculumCourse | undefined {
  return ALL_CURRICULUM_COURSES.get(code);
}

/**
 * Audits student courses across all semesters against B.Tech. CSE 2024 targets
 */
export function auditDegreeProgress(enrolledList: Array<{ course_code: string; course_name: string; credits?: number; semester?: string }>): DegreeProgressAudit {
  // Deduplicate courses by course_code (retaking/different components shouldn't double-count degree credits)
  const uniqueCourses = new Map<string, { code: string; name: string; credits: number; semester?: string }>();
  for (const item of enrolledList) {
    if (!item.course_code) continue;
    if (!uniqueCourses.has(item.course_code)) {
      const cur = getCurriculumCourse(item.course_code);
      const credits = Number(item.credits) || cur?.credits || 3;
      uniqueCourses.set(item.course_code, {
        code: item.course_code,
        name: cur?.name || item.course_name,
        credits,
        semester: item.semester,
      });
    }
  }

  let schoolCoreEarned = 0;
  let programCoreEarned = 0;
  let disciplineEarned = 0;
  let openEarned = 0;

  // Initialize specialized baskets
  const basketMap: Record<string, BasketProgress> = {};
  for (const [key, b] of Object.entries(SPECIALIZED_BASKETS)) {
    basketMap[key] = {
      basketId: key,
      basketName: b.name,
      minCredits: b.minCredits,
      earnedCredits: 0,
      courses: [],
      satisfied: false,
    };
  }

  for (const [code, c] of uniqueCourses.entries()) {
    const cur = getCurriculumCourse(code);
    if (!cur) {
      // If course is not in curriculum (e.g. JMC2033 or outside dept), treat as Open Elective
      openEarned += c.credits;
      continue;
    }

    if (cur.category === 'SCHOOL_CORE') {
      schoolCoreEarned += c.credits;
    } else if (cur.category === 'PROGRAM_CORE') {
      programCoreEarned += c.credits;
    } else if (cur.category === 'DISCIPLINE_ELECTIVE') {
      disciplineEarned += c.credits;
      if (cur.basket && basketMap[cur.basket]) {
        basketMap[cur.basket].earnedCredits += c.credits;
        basketMap[cur.basket].courses.push(c);
        if (basketMap[cur.basket].earnedCredits >= basketMap[cur.basket].minCredits) {
          basketMap[cur.basket].satisfied = true;
        }
      }
    } else {
      openEarned += c.credits;
    }
  }

  const totalEarned = schoolCoreEarned + programCoreEarned + disciplineEarned + openEarned;
  const totalTarget = 160;

  return {
    totalTargetCredits: totalTarget,
    totalEarnedCredits: totalEarned,
    completionPercentage: Math.min(100, Math.round((totalEarned / totalTarget) * 100)),
    categories: {
      schoolCore: {
        target: 58,
        earned: schoolCoreEarned,
        percentage: Math.min(100, Math.round((schoolCoreEarned / 58) * 100)),
      },
      programCore: {
        target: 42,
        earned: programCoreEarned,
        percentage: Math.min(100, Math.round((programCoreEarned / 42) * 100)),
      },
      disciplineElective: {
        target: 42,
        earned: disciplineEarned,
        percentage: Math.min(100, Math.round((disciplineEarned / 42) * 100)),
      },
      openElective: {
        target: 18,
        earned: openEarned,
        percentage: Math.min(100, Math.round((openEarned / 18) * 100)),
      },
    },
    specializedBaskets: Object.values(basketMap),
    completedCoursesCount: uniqueCourses.size,
  };
}

/**
 * Intelligent recommendation engine for the student's next semester
 */
export function getRecommendedCourses(enrolledCourseCodes: string[]): RecommendedCourse[] {
  const enrolledSet = new Set(enrolledCourseCodes.map((c) => c.trim().toUpperCase()));
  const recommendations: RecommendedCourse[] = [];

  // Priority 1: Missing Mandatory Program Core Courses (Must be completed for B.Tech)
  for (const pc of PROGRAM_CORE_COURSES) {
    if (!enrolledSet.has(pc.code)) {
      recommendations.push({
        code: pc.code,
        name: pc.name,
        credits: pc.credits,
        category: 'Program Core',
        basket: 'Core Graduation Requirement',
        reason: 'Mandatory program requirement for B.Tech. degree completion.',
        priority: 'HIGH',
      });
    }
  }

  // Priority 2: Missing Mandatory School Core Courses
  for (const sc of SCHOOL_CORE_COURSES) {
    if (sc.mandatory && !enrolledSet.has(sc.code)) {
      // Don't recommend Capstone or Internship early
      if (sc.code === 'CSE4001' || sc.code === 'CSE4002') continue;
      recommendations.push({
        code: sc.code,
        name: sc.name,
        credits: sc.credits,
        category: 'School Core',
        basket: 'School Core Requirement',
        reason: 'Mandatory foundation requirement for engineering degree.',
        priority: 'HIGH',
      });
    }
  }

  // Priority 3: Elective Baskets that have 0 credits earned so far (min 3 credits required)
  for (const [basketKey, basket] of Object.entries(SPECIALIZED_BASKETS)) {
    const hasTakenInBasket = basket.courses.some((c) => enrolledSet.has(c.code));
    if (!hasTakenInBasket) {
      // Pick the primary introductory course from this basket
      const firstAvailable = basket.courses.find((c) => !enrolledSet.has(c.code));
      if (firstAvailable) {
        recommendations.push({
          code: firstAvailable.code,
          name: firstAvailable.name,
          credits: firstAvailable.credits,
          category: 'Discipline Elective',
          basket: basket.name,
          reason: `Specialized Basket requirement: zero credits earned yet in ${basket.name} (min 3 required).`,
          priority: 'ELECTIVE',
        });
      }
    }
  }

  return recommendations;
}
