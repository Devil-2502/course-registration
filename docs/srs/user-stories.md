# User Stories - Topic 6: University Course Registration & Prerequisite Validation Engine

Tài liệu này là bản tổng hợp backlog. Theo yêu cầu của môn học, **mỗi user story phải được tạo thành một GitHub Issue**
(dùng mẫu `User Story`), gán cho đúng một thành viên và có tiêu chí chấp nhận viết bằng Gherkin.
Khi nội dung Issue và file này khác nhau thì Issue là bản đúng.

- Trạng thái: bản nháp khởi đầu, cả nhóm cần rà soát và chốt các giả định ở mục 4.
- Phần user story viết bằng tiếng Anh theo mẫu của handbook; phần ghi chú cho nhóm viết bằng tiếng Việt.

## 1. Vai trò người dùng

| Vai trò | Mô tả |
|---|---|
| Student | Sinh viên: tìm môn, đăng ký, hủy môn, vào hàng chờ, xem thời khóa biểu |
| Admin | Phòng đào tạo: quản lý môn học, lớp học phần, quan hệ tiên quyết, học kỳ |

Giảng viên không nằm trong phạm vi đề tài.

## 2. Quy tắc nghiệp vụ

Các quy tắc dưới đây là **giả định ban đầu**. Những chỗ đánh dấu (cần chốt) phải được cả nhóm thống nhất trước khi code.

| Mã | Quy tắc |
|---|---|
| BR-01 | Sinh viên chỉ đăng ký được một môn khi đã **đạt** tất cả môn tiên quyết trực tiếp của môn đó. Điểm đạt là từ 5.0 trở lên (cần chốt). |
| BR-02 | Quan hệ tiên quyết không được tạo thành vòng lặp. Một môn không thể là tiên quyết của chính nó. |
| BR-03 | Hai lớp học phần trùng lịch khi có buổi học cùng thứ và khoảng tiết giao nhau. Hai buổi liền kề (tiết 1-3 và tiết 4-6) không tính là trùng. |
| BR-04 | Tổng tín chỉ đã đăng ký trong một học kỳ không vượt quá 24 (cần chốt). |
| BR-05 | Mỗi lớp học phần có sức chứa cố định. Số sinh viên ở trạng thái `ENROLLED` không bao giờ vượt sức chứa, kể cả khi nhiều người đăng ký cùng lúc. |
| BR-06 | Trong một học kỳ, sinh viên chỉ được đăng ký một lớp học phần cho mỗi môn. |
| BR-07 | Chỉ đăng ký và hủy môn được trong thời gian mở đăng ký của học kỳ. |
| BR-08 | Hàng chờ theo thứ tự vào trước ra trước. Khi có chỗ trống, người đứng đầu được xếp vào lớp nếu vẫn thỏa BR-01, BR-03, BR-04; nếu không thỏa thì bị bỏ qua và xét người kế tiếp. |
| BR-09 | Sinh viên không đăng ký lại môn đã đạt (cần chốt: có cho học cải thiện không). |

## 3. Danh sách user story

| ID | Tên | Vai trò | Phụ trách chính | Phối hợp |
|---|---|---|---|---|
| US-01 | Student Login | Student | M3 | M1 |
| US-02 | Browse and Search Course Catalog | Student | M1 | M2 |
| US-03 | View Course Details and Prerequisites | Student | M1 | M2 |
| US-04 | Register for a Course Section | Student | M2 | M1, M3 |
| US-05 | Prerequisite Validation | Student | M2 | M4 |
| US-06 | Schedule Clash Detection | Student | M2 | M1 |
| US-07 | Credit Limit Verification | Student | M3 | M2 |
| US-08 | Concurrent Registration for the Last Seat | Student | M2 | M3, M4 |
| US-09 | Join the Waitlist for a Full Section | Student | M2 | M1 |
| US-10 | Drop a Course and Automatic Waitlist Promotion | Student | M2 | M3 |
| US-11 | Weekly Schedule Builder | Student | M1 | M2 |
| US-12 | Manage Courses and Sections | Admin | M3 | M1 |
| US-13 | Manage Prerequisite Relationships | Admin | M2 | M4 |

M4 không giữ user story nào làm chính. Công việc của M4 (kế hoạch test, Playwright, stress test, Docker, CI) được tạo thành Issue loại `Task`, mỗi task liên kết tới user story mà nó kiểm thử.

Dữ liệu mẫu dùng trong các kịch bản:

| Mã môn | Tên | Tín chỉ | Tiên quyết |
|---|---|---|---|
| CS101 | Introduction to Programming | 4 | không |
| CS201 | Data Structures and Algorithms | 4 | CS101 |
| CS301 | Design and Analysis of Algorithms | 4 | CS201 |
| MA101 | Calculus 1 | 3 | không |

---

## US-01: Student Login

**As a** student,
**I want** to sign in with my university account,
**So that** I can access my own registration data securely.

```gherkin
Scenario: Successful login
  Given a student account "std_402@student.edu.vn" exists with a valid password
  When the student sends POST to "/api/v1/auth/login" with the correct email and password
  Then response code should be 200 OK
  And the response sets a session cookie
  And the response body contains role "STUDENT"

Scenario: Login with a wrong password
  Given a student account "std_402@student.edu.vn" exists
  When the student sends POST to "/api/v1/auth/login" with a wrong password
  Then response code should be 401 Unauthorized
  And response body contains code "INVALID_CREDENTIALS"

Scenario: Access a protected endpoint without a session
  Given the client has no session cookie
  When the client sends GET to "/api/v1/registrations"
  Then response code should be 401 Unauthorized
```

## US-02: Browse and Search Course Catalog

**As a** student,
**I want** to search the course catalog by course code or name,
**So that** I can quickly find the courses I plan to take.

```gherkin
Scenario: Search by keyword
  Given the catalog contains course "CS201" named "Data Structures and Algorithms"
  When the student sends GET to "/api/v1/courses?q=data"
  Then response code should be 200 OK
  And the result list contains course "CS201" with its name and credits

Scenario: Search with no matching course
  When the student sends GET to "/api/v1/courses?q=zzzz"
  Then response code should be 200 OK
  And the result list is empty
  And the catalog page shows the message "No courses found"

Scenario: Paginated catalog
  Given the catalog contains 45 courses
  When the student sends GET to "/api/v1/courses?page=2&pageSize=20"
  Then the result list contains 20 courses
  And the response body contains total 45
```

## US-03: View Course Details and Prerequisites

**As a** student,
**I want** to see a course's prerequisites and its open sections,
**So that** I know whether I am eligible and which section fits my week.

```gherkin
Scenario: View course details
  Given course "CS201" has prerequisite "CS101"
  And course "CS201" has 2 sections in the current semester
  When the student sends GET to "/api/v1/courses/{CS201}"
  Then response code should be 200 OK
  And the response body lists prerequisite "CS101"
  And each section shows its schedule, capacity and remaining seats

Scenario: Prerequisite status for the signed-in student
  Given student "std_402" has passed "CS101"
  When the student opens the details page of "CS201"
  Then prerequisite "CS101" is marked as "Passed"

Scenario: Course does not exist
  When the student sends GET to "/api/v1/courses/999999"
  Then response code should be 404 Not Found
```

## US-04: Register for a Course Section

**As a** student,
**I want** to register for a section of a course,
**So that** I have a confirmed seat in that class for the semester.

```gherkin
Scenario: Successful registration
  Given student "std_402" is authenticated
  And the registration period of the current semester is open
  And student "std_402" has passed all prerequisites of "CS201"
  And section "CS201-01" has 5 remaining seats
  When the student sends POST to "/api/v1/registrations" with payload:
    | sectionId |
    | CS201-01  |
  Then response code should be 201 Created
  And registration status should be "ENROLLED"
  And section "CS201-01" has 4 remaining seats

Scenario: Already enrolled in another section of the same course
  Given student "std_402" is enrolled in section "CS201-01"
  When the student sends POST to "/api/v1/registrations" for section "CS201-02"
  Then response code should be 409 Conflict
  And response body contains code "ALREADY_ENROLLED"

Scenario: Registration period is closed
  Given the registration period of the current semester has ended
  When the student sends POST to "/api/v1/registrations" for section "CS201-01"
  Then response code should be 403 Forbidden
  And response body contains code "REGISTRATION_CLOSED"
```

## US-05: Prerequisite Validation

**As a** student,
**I want** the system to check prerequisites when I register,
**So that** I am not placed in a course I am not prepared for.

```gherkin
Scenario: Missing prerequisite
  Given course "CS201" requires "CS101"
  And student "std_500" has never taken "CS101"
  When the student sends POST to "/api/v1/registrations" for section "CS201-01"
  Then response code should be 422 Unprocessable Entity
  And response body contains code "PREREQUISITE_NOT_MET"
  And response body lists missing course "CS101"

Scenario: Failed prerequisite does not count
  Given student "std_501" took "CS101" with grade 4.0
  When the student sends POST to "/api/v1/registrations" for section "CS201-01"
  Then response code should be 422 Unprocessable Entity
  And response body contains code "PREREQUISITE_NOT_MET"

Scenario: Multi-level prerequisite chain satisfied
  Given course "CS301" requires "CS201" and course "CS201" requires "CS101"
  And student "std_402" has passed "CS101" and "CS201"
  When the student sends POST to "/api/v1/registrations" for section "CS301-01"
  Then response code should be 201 Created
```

## US-06: Schedule Clash Detection

**As a** student,
**I want** the system to reject a section that overlaps my current schedule,
**So that** I never end up with two classes at the same time.

```gherkin
Scenario: Overlapping time slots
  Given student "std_402" is enrolled in section "MA101-01" on Monday periods 1-3
  And section "CS201-01" meets on Monday periods 2-4
  When the student sends POST to "/api/v1/registrations" for section "CS201-01"
  Then response code should be 409 Conflict
  And response body contains code "SCHEDULE_CLASH"
  And response body names the conflicting section "MA101-01"

Scenario: Adjacent time slots do not clash
  Given student "std_402" is enrolled in section "MA101-01" on Monday periods 1-3
  And section "CS201-02" meets on Monday periods 4-6
  When the student sends POST to "/api/v1/registrations" for section "CS201-02"
  Then response code should be 201 Created

Scenario: Same periods on different days do not clash
  Given student "std_402" is enrolled in section "MA101-01" on Monday periods 1-3
  And section "CS201-03" meets on Tuesday periods 1-3
  When the student sends POST to "/api/v1/registrations" for section "CS201-03"
  Then response code should be 201 Created
```

## US-07: Credit Limit Verification

**As a** student,
**I want** the system to enforce the semester credit limit,
**So that** my workload stays within the university regulation.

```gherkin
Scenario: Exceeding the credit limit
  Given the credit limit of the current semester is 24
  And student "std_402" is enrolled in sections totalling 22 credits
  When the student sends POST to "/api/v1/registrations" for a 4-credit course
  Then response code should be 422 Unprocessable Entity
  And response body contains code "CREDIT_LIMIT_EXCEEDED"
  And response body shows current credits 22 and limit 24

Scenario: Reaching exactly the credit limit
  Given student "std_402" is enrolled in sections totalling 20 credits
  When the student sends POST to "/api/v1/registrations" for a 4-credit course
  Then response code should be 201 Created
  And the student's total credits should be 24
```

## US-08: Concurrent Registration for the Last Seat

**As a** student,
**I want** seat allocation to be fair and consistent during registration spikes,
**So that** a section is never overbooked and I get a clear answer immediately.

```gherkin
Scenario: One hundred students compete for the last seat
  Given section "CS201-01" has capacity 40 and 39 enrolled students
  And 100 eligible students are authenticated
  When all 100 students send POST to "/api/v1/registrations" for section "CS201-01" at the same time
  Then exactly 1 response should be 201 Created
  And exactly 99 responses should be 409 Conflict with code "SECTION_FULL"
  And section "CS201-01" has exactly 40 enrolled students

Scenario: A student double-clicks the register button
  Given section "CS201-01" has 5 remaining seats
  When student "std_402" sends the same registration request twice at the same time
  Then exactly 1 response should be 201 Created
  And the other response should be 409 Conflict with code "ALREADY_ENROLLED"
  And section "CS201-01" has 4 remaining seats
```

## US-09: Join the Waitlist for a Full Section

**As a** student,
**I want** to join the waitlist of a full section,
**So that** I can get a seat automatically if someone drops.

```gherkin
Scenario: Join the waitlist
  Given section "CS201-01" is full
  And student "std_402" has passed all prerequisites of "CS201"
  When the student sends POST to "/api/v1/waitlist" for section "CS201-01"
  Then response code should be 201 Created
  And waitlist status should be "WAITING"
  And the response body shows the student's position in the queue

Scenario: Join the same waitlist twice
  Given student "std_402" is already waiting for section "CS201-01"
  When the student sends POST to "/api/v1/waitlist" for section "CS201-01"
  Then response code should be 409 Conflict
  And response body contains code "ALREADY_ON_WAITLIST"

Scenario: Section still has seats
  Given section "CS201-02" has 3 remaining seats
  When the student sends POST to "/api/v1/waitlist" for section "CS201-02"
  Then response code should be 409 Conflict
  And response body contains code "SECTION_NOT_FULL"

Scenario: Leave the waitlist
  Given student "std_402" is waiting for section "CS201-01"
  When the student sends DELETE to "/api/v1/waitlist/{entryId}"
  Then response code should be 204 No Content
  And the students behind move up one position
```

## US-10: Drop a Course and Automatic Waitlist Promotion

**As a** student,
**I want** to drop a section I registered for,
**So that** I can adjust my plan and free the seat for someone else.

```gherkin
Scenario: Drop a section
  Given student "std_402" is enrolled in section "CS201-01"
  When the student sends DELETE to "/api/v1/registrations/{registrationId}"
  Then response code should be 204 No Content
  And registration status should be "DROPPED"

Scenario: First student on the waitlist is promoted
  Given section "CS201-01" is full
  And student "std_610" is first on the waitlist of section "CS201-01"
  When an enrolled student drops section "CS201-01"
  Then student "std_610" is enrolled in section "CS201-01"
  And the waitlist entry of "std_610" has status "PROMOTED"
  And section "CS201-01" is still full

Scenario: A waiting student who is no longer eligible is skipped
  Given student "std_610" is first and student "std_611" is second on the waitlist of section "CS201-01"
  And student "std_610" has since enrolled in a section that clashes with "CS201-01"
  When an enrolled student drops section "CS201-01"
  Then the waitlist entry of "std_610" has status "SKIPPED"
  And student "std_611" is enrolled in section "CS201-01"

Scenario: Drop someone else's registration
  Given registration "R-77" belongs to student "std_101"
  When student "std_402" sends DELETE to "/api/v1/registrations/R-77"
  Then response code should be 403 Forbidden
```

## US-11: Weekly Schedule Builder

**As a** student,
**I want** to see my registered sections on a weekly timetable,
**So that** I can understand my week at a glance and plan the remaining courses.

```gherkin
Scenario: View the weekly timetable
  Given student "std_402" is enrolled in "MA101-01" on Monday periods 1-3 and "CS201-02" on Wednesday periods 4-6
  When the student opens the weekly schedule page
  Then the timetable shows "MA101-01" in the Monday column covering periods 1-3
  And the timetable shows "CS201-02" in the Wednesday column covering periods 4-6
  And the page shows the total registered credits

Scenario: Preview a section before registering
  Given student "std_402" is enrolled in "MA101-01" on Monday periods 1-3
  When the student previews section "CS201-01" which meets on Monday periods 2-4
  Then the timetable highlights the overlapping slot
  And the register button is disabled with the reason "Schedule clash with MA101-01"

Scenario: Empty timetable
  Given student "std_700" has no registrations in the current semester
  When the student opens the weekly schedule page
  Then the page shows an empty timetable with a link to the course catalog
```

## US-12: Manage Courses and Sections

**As an** admin,
**I want** to create and update courses and their sections,
**So that** the catalog is ready before the registration period opens.

```gherkin
Scenario: Create a course
  Given an admin is authenticated
  When the admin sends POST to "/api/v1/courses" with code "CS401", a name and 3 credits
  Then response code should be 201 Created

Scenario: Duplicate course code
  Given course "CS201" already exists
  When the admin sends POST to "/api/v1/courses" with code "CS201"
  Then response code should be 409 Conflict
  And response body contains code "COURSE_CODE_EXISTS"

Scenario: Create a section with a schedule
  When the admin sends POST to "/api/v1/sections" for course "CS201" with capacity 40 and a slot on Monday periods 1-3
  Then response code should be 201 Created
  And the section appears in the details of course "CS201"

Scenario: Reduce capacity below the number of enrolled students
  Given section "CS201-01" has 35 enrolled students
  When the admin sends PUT to "/api/v1/sections/{sectionId}" with capacity 30
  Then response code should be 409 Conflict
  And response body contains code "CAPACITY_BELOW_ENROLLED"

Scenario: A student calls an admin endpoint
  Given student "std_402" is authenticated
  When the student sends POST to "/api/v1/courses"
  Then response code should be 403 Forbidden
```

## US-13: Manage Prerequisite Relationships

**As an** admin,
**I want** to define which courses are prerequisites of another course,
**So that** the registration engine can validate student eligibility.

```gherkin
Scenario: Add a prerequisite
  Given courses "CS201" and "CS301" exist
  When the admin sends POST to "/api/v1/courses/{CS301}/prerequisites" with prerequisite "CS201"
  Then response code should be 201 Created
  And the details of "CS301" list prerequisite "CS201"

Scenario: Reject a relationship that creates a cycle
  Given "CS201" requires "CS101" and "CS301" requires "CS201"
  When the admin sends POST to "/api/v1/courses/{CS101}/prerequisites" with prerequisite "CS301"
  Then response code should be 409 Conflict
  And response body contains code "PREREQUISITE_CYCLE"

Scenario: A course cannot require itself
  When the admin sends POST to "/api/v1/courses/{CS201}/prerequisites" with prerequisite "CS201"
  Then response code should be 409 Conflict
  And response body contains code "PREREQUISITE_CYCLE"

Scenario: Remove a prerequisite
  Given "CS301" requires "CS201"
  When the admin sends DELETE to "/api/v1/courses/{CS301}/prerequisites/{CS201}"
  Then response code should be 204 No Content
```

---

## 4. Các điểm cần cả nhóm chốt

1. Điểm đạt để tính là đã qua môn tiên quyết (đang giả định 5.0).
2. Giới hạn tín chỉ mỗi học kỳ (đang giả định 24) và có giới hạn tối thiểu hay không.
3. Sinh viên có được đăng ký lại môn đã đạt để cải thiện điểm không (BR-09).
4. Môn "học trước" và môn "song hành" có nằm trong phạm vi không, hay chỉ làm môn tiên quyết.
5. Khi người đầu hàng chờ bị bỏ qua, có thông báo cho họ không và bằng cách nào.
6. Một ngày có bao nhiêu tiết (đang giả định 15) và lịch học có theo tuần chẵn, lẻ hay không.
