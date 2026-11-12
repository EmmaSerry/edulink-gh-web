/**
 * Step-by-step guides shown on the public site (/guide/district, /guide/school,
 * /guide/teacher). Plain data on purpose: to change a step, edit the text
 * here - no layout code needs touching. There is deliberately no Super Admin
 * guide in this file.
 */
export type GuideSlug = "district" | "school" | "teacher";

export interface GuideSection {
  id: string;
  title: string;
  /** One or two sentences saying what this process is for. */
  intro: string;
  steps: string[];
  tip?: string;
}

export interface Guide {
  slug: GuideSlug;
  label: string;
  title: string;
  tagline: string;
  icon: string;
  sections: GuideSection[];
}

const DISTRICT: Guide = {
  slug: "district",
  label: "District Admin",
  title: "District Administrator guide",
  tagline: "Oversee every school in your district: approvals, accounts, attendance and results.",
  icon: "bi-diagram-3",
  sections: [
    {
      id: "register",
      title: "Register your district",
      intro: "A district registers once. The platform administrator approves it before you can use it fully.",
      steps: [
        "Open the EduLink GH home page and choose Register your district.",
        "Enter the district name and your own details: full name, email address, phone number and a password. Type the password twice.",
        "Submit the form. You are signed in straight away, but the district shows Pending Approval.",
        "Wait for the platform administrator to approve the district. You will then see the full District overview.",
      ],
      tip: "The platform administrator can also add extra district administrators for your district, so colleagues do not need to register again.",
    },
    {
      id: "signin",
      title: "Sign in and find your way around",
      intro: "Your menu is shorter than a school administrator's and focuses on the whole district.",
      steps: [
        "Open the EduLink GH address and choose Sign in.",
        "Type your email address and your password, then press Sign in. You land on the District overview.",
        "Use the left-hand menu: District overview, Accounts, Login credentials, Students, Statistics, Mock Exams, Attendance reports, Sample report, Audit log and Settings.",
        "Use the sun or moon icon at the top to switch between light and dark mode.",
        "When you finish, sign out from the top bar. You are also signed out automatically after a period of no activity.",
      ],
      tip: "Fees, report fees, credits and subscriptions are reserved for the platform administrator and do not appear in your menu.",
    },
    {
      id: "overview",
      title: "Read the District overview",
      intro: "See at a glance which schools are doing well and which need support.",
      steps: [
        "Open District overview from the menu.",
        "Read the district-wide subject averages and the KG skill breakdown at the top of the page.",
        "Scroll to the table of schools. Each row shows the school, its circuit, active learners and how far assessment has progressed (Draft, Completed, Verified, Finalised).",
        "A school with many Draft rows and few Finalised rows is behind. Contact its head teacher.",
        "Choose Upload logo to add the district logo. It appears on the cover of KG report cards across the district.",
      ],
    },
    {
      id: "approve",
      title: "Approve new schools",
      intro: "Schools that register in your district wait for approval before they can work.",
      steps: [
        "On District overview, find the Pending school signups panel.",
        "Open each entry and check the school name, head teacher, circuit and contact details.",
        "Look at the payment indicator. A school can only be approved after its subscription payment is confirmed. Online Paystack payments confirm themselves. Manual payments wait for the platform administrator.",
        "Press Approve. The head teacher receives an SMS and the school receives its school code.",
        "To turn down a registration, use the reject or delete option on that entry.",
      ],
      tip: "A school marked Awaiting payment is not broken. Its payment has simply not been confirmed yet.",
    },
    {
      id: "circuits",
      title: "Set up circuits",
      intro: "Circuits group your schools. Create them before schools pick one.",
      steps: [
        "Open Settings and choose the Circuits tab.",
        "Type a circuit name and press Add.",
        "To rename a circuit, edit its name and save. To remove one, use its remove button and confirm.",
        "Schools choose from this list when they set up their profile, so keep the names clear and consistent.",
      ],
    },
    {
      id: "accounts",
      title: "Manage accounts and passwords",
      intro: "See every user in your district and help people who are locked out.",
      steps: [
        "Open Accounts to list every user in your district with their school and role.",
        "Search by name or school to find the person.",
        "Press Reset password beside the name. A new temporary password appears once on screen. Give it to the person by phone, SMS or in person and ask them to keep it safe.",
        "Open Login credentials to see the login details of every school administrator and teacher in your district in one table. Use Copy, CSV or Print to share or keep a record.",
        "If a password shows Not recorded yet, press Reset beside it to set a new one, or wait until the person signs in once.",
      ],
      tip: "Only share credentials with the person they belong to.",
    },
    {
      id: "learners",
      title: "Find learners and read statistics",
      intro: "District-wide learner lists and charts, with school names and filters.",
      steps: [
        "Open Students. The list shows learners from every school in your district with the school name beside each.",
        "Use the filters (school, class, status) and the search box to narrow the list.",
        "To register a learner against any school in your district, press Register student and choose the school first.",
        "Open Statistics to see animated charts of enrolment and performance. Hover over a chart to see exact numbers.",
      ],
    },
    {
      id: "attendance",
      title: "Analyse attendance",
      intro: "Teachers and school administrators take the registers. You analyse them for the whole district.",
      steps: [
        "Open Attendance reports.",
        "Choose the level: district, a school, or a class.",
        "Choose a date range: Today, Last 7 days, This month, Last 30 days, This term, or exact dates.",
        "Read the Summary tab for present, late, absent and excused counts, boys and girls separately, and the attendance rate. Choose Daily, Weekly, Monthly or Termly.",
        "Open the school breakdown to see boys and girls rates for every school. Rates under 80% are shown in red.",
        "Open Insights for plain-language findings, learners under 80% and learners absent for their last three marked days.",
        "Press Download CSV on any table to open it in Excel.",
      ],
      tip: "A school with no figures usually has not been marking its register. Ask its administrator.",
    },
    {
      id: "mocks",
      title: "Compare mock exams",
      intro: "Compare mock results across your schools and plan support where it is needed.",
      steps: [
        "Open Mock Exams: district.",
        "Choose the mock you want to compare.",
        "Review each school's results side by side and open a school to see subject analysis.",
        "Use the intervention tools to flag schools that need support.",
      ],
    },
    {
      id: "settings",
      title: "District profile, session timeout and sample reports",
      intro: "Housekeeping that applies to your whole district.",
      steps: [
        "Open Settings and choose District profile to update the district name and logo.",
        "On District overview, find Session timeout and set how many minutes of inactivity sign users out in your district.",
        "Open Sample report to preview any report template with sample data. Report cards use each school's own colours.",
        "Open Audit log to see who changed what and when.",
      ],
      tip: "Report templates, classes and subjects belong to each school's own administrator, so you cannot edit them from the district account.",
    },
    {
      id: "faq",
      title: "Common questions",
      intro: "Quick answers.",
      steps: [
        "A school shows Awaiting payment: its subscription payment is not yet confirmed. Online payments confirm themselves; manual payments need the platform administrator.",
        "I forgot my own password: use Forgot password on the sign-in page, or ask the platform administrator to reset it.",
        "I cannot edit a school's settings: those belong to the school's own administrator.",
      ],
    },
  ],
};

const SCHOOL: Guide = {
  slug: "school",
  label: "School Admin",
  title: "School Administrator guide",
  tagline: "Set up your school, add staff and learners, and run attendance, assessment and report cards.",
  icon: "bi-building",
  sections: [
    {
      id: "register",
      title: "Register your school",
      intro: "One form creates your school, your administrator account and a starter curriculum.",
      steps: [
        "On the EduLink GH home page, choose Register your school.",
        "Pick your district. If it is not listed, ask your district office to register it first.",
        "Enter your school name, circuit and region. Tick private school if you collect your own fees.",
        "Enter your own details (name, email, phone) and a password. Type the password twice.",
        "Submit. You are signed in, but the school stays Pending Approval until its subscription payment is confirmed and the district or platform administrator approves it.",
        "When approved, you receive an SMS and your school code.",
      ],
      tip: "After approval you can sign in with your email address or with your school code (for example WAC0001).",
    },
    {
      id: "signin",
      title: "Sign in",
      intro: "Use your email address or your school code.",
      steps: [
        "Open the EduLink GH address and choose Sign in.",
        "In the first box, type your email address or your school code.",
        "Type your password and press Sign in. You land on your Dashboard.",
        "Use the sun or moon icon to switch between light and dark mode.",
        "If you forget your password, ask your district administrator or the platform administrator to reset it.",
      ],
    },
    {
      id: "setup",
      title: "Set up the school (Settings)",
      intro: "Do this once at the start. Reports cannot be generated until a term is active and its dates are complete.",
      steps: [
        "Open Settings. Start with the School profile tab: school name, address, head teacher, logo and motto. Save.",
        "Open Academic setup. Create the academic year and its three terms. For the active term, enter the opening, closing, vacation and reopening dates and the total school days. Save.",
        "Open Report template. Choose your two school colours. The report card automatically uses readable text on them. Save.",
        "Open Classes. Create each class (KG 1 to JHS 3) and assign a class teacher to each one.",
        "Open Subjects. Check the subjects for each level and add, edit or remove subjects if needed.",
        "Open Sample report from the menu to preview how a report card will look.",
      ],
      tip: "A teacher cannot mark a register or enter marks for a class until you assign that teacher to the class.",
    },
    {
      id: "staff",
      title: "Add staff and share their logins",
      intro: "Create accounts for teachers, bursars and other administrators.",
      steps: [
        "Open Staff and press Add staff.",
        "Enter the person's email address, full name and phone number, and choose the role: Teacher, Bursar or School admin.",
        "Press Create. The system checks for an existing person with the same email, phone or name and asks you to confirm if there is a match.",
        "A temporary password is shown once. Copy it and give it to the person. It is also saved on the Login credentials page.",
        "Use Send login details to text each person their login by SMS.",
        "To change a name, role or phone, press Edit beside the person. To stop someone using the system, press Archive. Reactivate brings them back.",
        "Open Settings, then Classes, and assign each teacher to their class.",
      ],
      tip: "Open Login credentials any time to see your teachers' login details. Press Reset beside a name to issue a new password.",
    },
    {
      id: "credentials",
      title: "Find a teacher's login details",
      intro: "The Login credentials page lists the logins of the people in your school.",
      steps: [
        "Open Login credentials from the menu.",
        "Search for the teacher by name, or filter by role.",
        "Press Show passwords at the top, or the eye beside one row, to reveal the password.",
        "Press Copy beside a row to copy the login and password, or use Copy, CSV or Print at the top for the whole list.",
        "If the password shows Not recorded yet, press Reset to create a new one. Share it with the teacher.",
      ],
      tip: "Do not leave the page open on a shared screen.",
    },
    {
      id: "learners",
      title: "Register and manage learners",
      intro: "Add learners one by one, or many at once from Excel.",
      steps: [
        "Open Students and press Register student.",
        "Enter the learner's details and a parent or guardian name and phone number.",
        "Add a passport photo if you have one. Crop it on screen.",
        "Choose the class and press Save. The learner appears in the class at once.",
        "To add many learners, use the bulk upload on the Students page: download the Excel template, fill one row per learner, upload it, review the checks and confirm. Suspected duplicates in a class are skipped and you choose whether to include or exclude them.",
        "To change a learner, open Students, press Edit, change the details and save. To move one learner to another class, use the transfer option on their edit screen.",
        "To remove a learner from active lists, press Archive. Reactivate brings them back.",
      ],
    },
    {
      id: "attendance",
      title: "Daily attendance",
      intro: "Class teachers take their own registers. You can open any class and see which are still outstanding.",
      steps: [
        "Open Daily attendance. The School today table shows every class with how many learners are marked and a status of Not marked, Partly marked or Done.",
        "Open a class and pick the date (today by default).",
        "Tap Present, Late, Absent or Excused beside each learner. Tap Mark everyone present to start from a full class and change only the absentees.",
        "Type a short reason in the Note box if you wish.",
        "Press Save register. Nothing is saved until you press Save.",
        "Present and Late count as days present. The system copies each learner's term total to their report card automatically.",
        "Open Attendance reports for Summary, per class, Raw register and Insights. Press Download CSV to open a table in Excel.",
      ],
      tip: "Check that the term's total school days is set under Settings, then Academic setup.",
    },
    {
      id: "assessment",
      title: "Assessment, remarks and report cards",
      intro: "Scores and remarks go in first. Then reports are generated for the whole class.",
      steps: [
        "Open Assessment entry and choose the class. For scored classes, enter each learner's SBA and Exam scores, each out of 50. Totals, grades and positions are worked out for you. For KG classes, rate each skill instead.",
        "Open Remarks & attendance and choose the class. Pick the class teacher's, conduct, interest, attitude and head teacher's remarks from the drop-downs, or type your own. For KG, write one general comment per learner.",
        "To save time, tick Use one learner's entries for every learner, fill one learner, then change only the ones that differ. Press Save all learners.",
        "In Term 3, also choose the Promoted to or progression decision. It is not needed in Term 1 or Term 2.",
        "Open Reports. Choose the class first, then one learner, or generate the whole class at once.",
        "Print or download the report as PDF. The first report in each class and term is free. The others show Pay to unlock until the report fee is paid.",
      ],
      tip: "Corrected scores never destroy an earlier version. Reports are versioned.",
    },
    {
      id: "unlock",
      title: "Unlock the rest of a class's reports",
      intro: "Pay the report fee once per class and term.",
      steps: [
        "Open Report fees.",
        "Choose the class and term you want to unlock.",
        "Pay online with Paystack, or report a manual payment with its reference.",
        "Online payments unlock the reports at once. Manual payments unlock after the platform administrator approves them.",
      ],
    },
    {
      id: "promote",
      title: "Promote a class at the end of the year",
      intro: "Move a whole class up, repeat learners, or graduate them.",
      steps: [
        "Open Settings, then Classes, and choose Promote beside the class.",
        "For each learner, choose Promote, Repeat or Graduate.",
        "Check the destination class.",
        "Confirm. Learners move to their new classes for the next year.",
      ],
      tip: "To move a single learner to another class at any time, use the transfer option on their edit screen.",
    },
    {
      id: "mocks",
      title: "Mock exams",
      intro: "Set up a mock for your candidates and review the results.",
      steps: [
        "Open Mock Exams and create a mock.",
        "Choose the subjects and the grading.",
        "Let teachers enter marks on the web or offline in the Capture app.",
        "Review the broadsheet and subject analysis.",
        "Print a result slip for each candidate.",
      ],
    },
    {
      id: "money",
      title: "Fees, SMS and subscription",
      intro: "Money and messaging for your school.",
      steps: [
        "Fees (private schools): set fee structures and record payments.",
        "SMS to parents: choose one parent or the whole class and send a typed message or a ready-made term report summary.",
        "SMS & WhatsApp credits: top up the messaging credit.",
        "Subscription: pay the termly subscription online with Paystack, or report a manual payment for approval. A school that lapses loses access until renewed.",
      ],
    },
    {
      id: "offline",
      title: "Working with no internet (Capture app)",
      intro: "The Capture app keeps working offline and sends everything later.",
      steps: [
        "Open the Capture app while you have internet and install it with Add to Home Screen.",
        "On the Home screen, tap Refresh reference data so classes and learners are stored on the phone.",
        "Without a signal you can register learners, enter assessments and remarks, take the daily register and enter mock marks.",
        "Everything waits on the phone and sends itself when the connection returns. The strip at the top shows Online or Offline and how many items are waiting.",
      ],
    },
    {
      id: "faq",
      title: "Common questions",
      intro: "Quick answers.",
      steps: [
        "Why are some reports locked: the first report in each class is free; the rest unlock when the report fee is paid.",
        "A report says progression is missing: that only applies in Term 3.",
        "A teacher cannot see their class on Daily attendance: assign them as class teacher under Settings, then Classes.",
        "A teacher forgot their password: open Login credentials and press Reset beside their name.",
      ],
    },
  ],
};

const TEACHER: Guide = {
  slug: "teacher",
  label: "Teacher",
  title: "Class Teacher guide",
  tagline: "Take the register, enter marks and remarks, and print report cards for your class.",
  icon: "bi-person-workspace",
  sections: [
    {
      id: "signin",
      title: "Sign in",
      intro: "Your school administrator gives you an email address and a password.",
      steps: [
        "Open your school's EduLink GH address and choose Sign in.",
        "Type your email address and your password, then press Sign in.",
        "Your Dashboard shows charts for your own class.",
        "Use the sun or moon icon to switch between light and dark mode.",
        "A yellow TRAINING MODE strip means you are on a practice account. Nothing you enter is real.",
        "If you forget your password, ask your school administrator. They can issue a new one.",
      ],
    },
    {
      id: "menu",
      title: "Your menu",
      intro: "What each menu item does.",
      steps: [
        "Dashboard: charts for your own class.",
        "Students: your class list. Register a new learner or edit details.",
        "Daily attendance: the class register.",
        "Assessment entry: scores for scored classes, or skill ratings for KG.",
        "Remarks & attendance: remarks for each report card.",
        "Reports: view and print report cards.",
        "Mock Exams: enter mock marks for your class.",
        "SMS to parents: message one parent or the whole class.",
      ],
      tip: "Settings, Fees and Staff belong to school administrators and bursars.",
    },
    {
      id: "register-learner",
      title: "Register a new learner",
      intro: "Add a learner to your class.",
      steps: [
        "Open Students, then press Register student.",
        "Enter the learner's details and a parent or guardian name and phone number.",
        "Add a passport photo if you have one. Crop it on screen.",
        "Choose your class and press Save. The learner appears in your register at once.",
      ],
    },
    {
      id: "attendance",
      title: "Take the daily register",
      intro: "Do this every school day. It takes about a minute.",
      steps: [
        "Open Daily attendance in the left-hand menu.",
        "Choose your class (if you have only one, it is chosen for you) and the date (today by default).",
        "Tap Mark everyone present to start from a full class.",
        "Tap Absent, Late or Excused beside the learners who need it. The counts at the top update as you go.",
        "Type a short reason in the Note box if you want to.",
        "Press Save register. Nothing is stored until you press Save.",
        "To correct an earlier day, choose that date and save again. You cannot mark a future date.",
      ],
      tip: "Present and Late count as days present. The total is copied to each report card automatically, so you do not need to type Days present again.",
    },
    {
      id: "assessment",
      title: "Enter scores (Basic 1 to JHS 3)",
      intro: "Each learner has an SBA score and an Exam score, each out of 50.",
      steps: [
        "Open Assessment entry.",
        "Choose your class and the subject.",
        "Type each learner's SBA score and Exam score.",
        "The total, grade, subject position and class position are worked out for you.",
        "Save your entries when you finish the subject, then move to the next subject.",
      ],
    },
    {
      id: "kg",
      title: "Rate skills (KG)",
      intro: "KG reports use skill ratings instead of marks.",
      steps: [
        "Open Assessment entry and choose your KG class.",
        "For each learner, rate each skill: Outstanding, Good, Satisfactory, Beginning or Not yet assessed.",
        "Save when you finish.",
        "KG report cards have no totals or positions.",
      ],
    },
    {
      id: "remarks",
      title: "Enter remarks for report cards",
      intro: "Fill these in before generating reports.",
      steps: [
        "Open Remarks & attendance and choose your class.",
        "For each learner, choose the class teacher's, conduct, interest and attitude remarks from the drop-downs, or type your own. For KG, write one general comment.",
        "To save time, tick Use one learner's entries for every learner, fill one learner, then change only the ones that differ.",
        "Press Save all learners (or Save on a single row).",
        "In Term 3, also choose the Promoted to or progression decision. It is not needed in Term 1 or Term 2.",
      ],
      tip: "Days present comes from your daily register. Use one method for a class.",
    },
    {
      id: "reports",
      title: "View and print reports",
      intro: "A report can be generated once scores are finalised, remarks are in and the term dates are set.",
      steps: [
        "Open Reports.",
        "Choose your class first, then a learner.",
        "Check the scores, remarks, attendance and photo.",
        "Press Print or Download PDF.",
        "If a score changes later, regenerate the report. The old version is kept.",
      ],
      tip: "The first report in a class is free to open. The rest show Pay to unlock until the school's report fee is paid. Ask your school administrator or bursar.",
    },
    {
      id: "mocks",
      title: "Enter mock exam marks",
      intro: "For JHS 3 mock exams.",
      steps: [
        "Open Mock Exams and choose the open mock for your class.",
        "Type each candidate's mark per subject in the grid.",
        "Grades and aggregates are worked out for you.",
        "When marks are in, print result slips.",
      ],
    },
    {
      id: "sms",
      title: "Send an SMS to parents",
      intro: "Message one parent or the whole class.",
      steps: [
        "Open SMS to parents.",
        "Choose the learner or the whole class.",
        "Type your message or choose a ready-made option such as a term report summary.",
        "Check the recipients and press Send.",
      ],
    },
    {
      id: "offline",
      title: "Working with no internet (Capture app)",
      intro: "The Capture app keeps working with no signal.",
      steps: [
        "While online, open the Capture app and install it with Add to Home Screen.",
        "On the Home screen, tap Refresh reference data so your classes and learners are stored on the phone.",
        "With no signal you can register learners, enter assessments and remarks, take the daily register and enter mock marks.",
        "For the register, tap Daily attendance, choose the class and date, tap P, L, A or E for each learner and press Save on phone.",
        "When the connection returns, everything sends itself. The strip at the top shows Online or Offline and how many items are waiting.",
      ],
    },
    {
      id: "faq",
      title: "Common questions",
      intro: "Quick answers.",
      steps: [
        "I marked the register but the report still shows old days present: refresh Remarks & attendance. If the report was already generated, regenerate it.",
        "I cannot pick a class on Daily attendance: ask your school administrator to assign you under Settings, then Classes.",
        "I cannot find Settings, Fees or Staff: those belong to school administrators and bursars.",
      ],
    },
  ],
};

export const GUIDES: Record<GuideSlug, Guide> = { district: DISTRICT, school: SCHOOL, teacher: TEACHER };
export const GUIDE_ORDER: GuideSlug[] = ["district", "school", "teacher"];
