# ACTRS Future Roadmap

**Amenfi Central Terminal Report System (ACTRS)** — beyond Version 1.0

Everything in this document is **explicitly out of scope for Version
1.0** — none of it has been built, and Version 1.0 does not depend on
any of it. This is a recommendation of what could reasonably come next,
for the Directorate's consideration, not a commitment or a partially-
started feature. Each item below would be its own dedicated phase of
work, scoped and reviewed the same way Phases 0-7 were.

## Multi-school deployment

Version 1.0 is designed for **one school, one independent installation**
(`docs/ARCHITECTURE.md` "Single-device design"). A future phase could
add school-selection at setup time and the ability for one Directorate-
level installation to hold multiple schools' data side by side —
meaningfully different from simply installing several separate copies,
since it would need shared configuration (e.g. a common grade-band
policy) alongside genuinely separate student/assessment data per school.

## User authentication and role-based access

Version 1.0 has no login system — it assumes one trusted device, used
by whoever the school designates. A future phase could add named user
accounts and role-based permissions (e.g. a class teacher who can only
enter scores for their own class, versus a headteacher who can archive
terms and view every class). This is a substantial architectural
addition, not a small setting — it would touch the audit trail (already
present in Version 1.0's `auditLogs`/`systemLogs`), every mutating
service, and the UI's navigation/permissions model.

## Cloud synchronization

Version 1.0 stores everything locally, per device, with manual file-based
backup/restore as the only way to move data between devices. A future
phase could add optional, deliberately-opt-in cloud sync — for a school
with reliable internet access that wants automatic multi-device
consistency or off-site backup without a USB drive. This is a genuinely
new capability, not an extension of anything in Version 1.0's
architecture (which is built around having no server at all), and would
need careful design around conflict resolution (what happens if the same
student is edited on two devices before they sync).

## EMIS integration

Ghana's Education Management Information System (EMIS) could, in a
future phase, exchange student/enrollment data directly with ACTRS
(Version 1.0 already stores an `emisNumber` field per student, ready for
this), removing a school's need to enter the same student information
in two separate systems.

## SMS and email notifications

A future phase could notify a parent/guardian by SMS or email when a
report card is ready, using the guardian contact fields Version 1.0
already collects (`phone`, `email`) — this requires a notification
delivery mechanism, which itself requires *some* form of network/service
integration, a deliberate departure from Version 1.0's fully offline
design for this one specific feature.

## Attendance management

Version 1.0's report cards include a simple attendance summary
(days present / total days) entered directly on a student's report
record. A dedicated Attendance Management module — daily register
taking, automatic attendance-percentage calculation, absence patterns
over a term — is a natural, clearly-scoped future addition building on
top of the existing `Enrollment`/class-roster data model.

## Continuous assessment integration

Version 1.0's assessment model is per-term (SBA + Exam, or per-term
skill ratings). A future phase could add finer-grained continuous
assessment tracking within a term (individual assignments/quizzes rolling
up into the term's SBA figure, for example), if a school's actual
practice needs that level of detail beyond the current single SBA score
per subject per term.

## Parent portal

A future phase could let a parent/guardian view their own child's report
cards and attendance directly (read-only), likely requiring both
authentication (see above) and either cloud access or a distributed
read-only export mechanism, since Version 1.0's data lives on a
school-side device a parent has no direct access to.

## Teacher portal

Similarly, a future phase could give individual teachers their own
scoped view (their classes only) rather than the current single shared
installation — this overlaps significantly with "user authentication and
role-based access" above and would likely be designed together with it.

## Mobile companion application

A future phase could offer a dedicated mobile app (as opposed to
ACTRS's existing installable Progressive Web App, which already runs
reasonably well on a tablet's browser) for a more native mobile
experience — for example, offline attendance-taking or score entry from
a phone during a lesson, syncing back to the main installation later.

---

None of the above should be started as an extension of Version 1.0's
existing codebase without its own dedicated planning phase — several of
these (authentication, cloud sync, multi-school) are significant
architectural additions that deserve the same scoped, reviewed,
phase-by-phase approach Version 1.0 itself was built with, not an
ad-hoc addition to a certified production release.
