// Content Script - الجامعة الإسلامية - بناء الجدول
// يعمل على صفحة البوابة الجامعية

console.log('الجامعة الإسلامية: تم تحميل السكريبت');

let coursesData = [];
let selectedCourses = [];
let registeredSections = []; // الشعب المسجل فيها الطالب

// استخراج الشعب المسجلة من صفحة المقررات المسجلة
function extractRegisteredCourses() {
    const scheduleTable = document.getElementById('scheduleFrm:studScheduleTable');

    if (!scheduleTable) {
        console.log('الجامعة الإسلامية: لم يتم العثور على جدول المقررات المسجلة');
        return [];
    }

    console.log('الجامعة الإسلامية: تم العثور على جدول المقررات المسجلة');

    const rows = scheduleTable.querySelectorAll('tbody tr');
    const registered = [];
    const seenCourses = new Map(); // لتتبع المقررات التي تم معالجتها

    rows.forEach(row => {
        const cells = row.cells;
        if (cells && cells.length >= 4) {
            const courseCode = cells[0]?.innerText.trim() || '';
            const sectionId = cells[3]?.innerText.trim() || '';
            const type = cells[2]?.innerText.trim() || ''; // نظري أو عملي

            if (courseCode && sectionId) {
                // إنشاء مفتاح فريد للمقرر
                const courseKey = `${courseCode}-${sectionId}`;

                // إذا لم نشاهد هذا المقرر من قبل، نضيفه ونتتبعه
                if (!seenCourses.has(courseKey)) {
                    seenCourses.set(courseKey, { theoretical: false, practical: false });
                }

                // تحديث الحالة
                const course = seenCourses.get(courseKey);
                if (type.includes('نظري')) {
                    course.theoretical = true;
                } else if (type.includes('عملي')) {
                    course.practical = true;
                }

                registered.push({
                    courseCode: courseCode,
                    sectionId: sectionId,
                    type: type
                });

                console.log(`الجامعة الإسلامية: شعبة مسجلة - ${courseCode} - ${sectionId} - ${type}`);
            }
        }
    });

    // حفظ في التخزين المحلي
    if (registered.length > 0) {
        chrome.storage.local.set({ registeredSections: registered }, () => {
            console.log(`الجامعة الإسلامية: تم حفظ ${registered.length} صف من الشعب المسجلة`);
        });
    }

    return registered;
}

// استخراج بيانات المقررات من جدول المقررات المطروحة
function extractCourseData() {
    const table = document.getElementById('myForm:offeredCoursesTable');

    if (!table) {
        console.log('الجامعة الإسلامية: لم يتم العثور على جدول المقررات المطروحة');
        return null;
    }

    console.log('الجامعة الإسلامية: تم العثور على جدول المقررات المطروحة');

    const rows = table.querySelectorAll('tr');
    const data = [];

    rows.forEach((row, index) => {
        const sectionInput = row.querySelector('input[name$=":section"]');
        const instructorInput = row.querySelector('input[name$=":instructor"]');

        if (!sectionInput) return;

        const rawSectionTime = sectionInput.value;
        const instructor = instructorInput ? instructorInput.value : "غير معروف";

        const cells = row.cells;
        let courseCode = "", courseName = "", sectionId = "", type = "", statusText = "", isClosed = false;

        if (cells.length >= 6) {
            courseCode = cells[0].innerText.trim();
            courseName = cells[1].innerText.trim();
            sectionId = cells[2].innerText.trim();
            type = cells[3].innerText.trim();
            statusText = cells[5].innerText.trim();
            isClosed = statusText.includes('مغلقة') || cells[5].innerHTML.includes('color:red');
        }

        const status = isClosed ? 'مغلق' : 'مفتوح';

        data.push({
            id: index,
            courseCode,
            courseName,
            sectionId,
            type,
            instructor,
            rawTime: rawSectionTime,
            status,
            isClosed
        });
    });

    console.log(`الجامعة الإسلامية: تم استخراج ${data.length} مقرر`);
    return data;
}

// تحليل أوقات الشعبة
function parseSchedule(rawTime) {
    if (!rawTime || rawTime.trim() === '') {
        console.log('الجامعة الإسلامية: وقت فارغ');
        return [];
    }

    console.log('الجامعة الإسلامية: تحليل الوقت:', rawTime);

    const sessions = rawTime.split('@n').filter(s => s.trim());
    const parsed = sessions.map(session => {
        const parts = session.split('@r');
        const timeDay = parts[0].split('@t');

        const day = timeDay[0]?.trim() || '';
        const time = timeDay[1]?.trim() || '';
        const room = parts[1]?.trim() || '';

        // استخراج الساعة من الوقت
        let hour = null;
        const timeMatch = time.match(/(\d+):(\d+)/);
        if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            // إذا كان الوقت مساءً وليس بنظام 24 ساعة
            if (time.includes('م') && hour < 12) {
                hour += 12;
            }
        }

        console.log(`الجامعة الإسلامية: جلسة - يوم: ${day}, وقت: ${time}, ساعة: ${hour}, قاعة: ${room}`);

        return {
            day: day,
            time: time,
            hour: hour,
            room: room
        };
    });

    return parsed.filter(s => s.day && s.time); // إرجاع فقط الجلسات الصالحة
}

// التحقق من أن الشعبة مسجلة
function isRegisteredSection(course) {
    return registeredSections.some(reg =>
        reg.courseCode === course.courseCode && reg.sectionId === course.sectionId
    );
}

// إضافة الواجهة فوق الجدول
function injectUI() {
    const table = document.getElementById('myForm:offeredCoursesTable');
    if (!table) return;

    const container = document.createElement('div');
    container.id = 'schedule-builder-container';
    container.innerHTML = `
        <div class="schedule-header">
            <h2>📅 الجامعة الإسلامية - بناء الجدول</h2>
            <div class="header-actions">
                <span class="developer-credit">المطور: DAMMAJ <a href="https://www.linkedin.com/in/abdulrahman-dammaj-31b058289" target="_blank" class="linkedin-link">🔗 LinkedIn</a></span>
                <button type="button" id="toggle-schedule-btn" class="primary-btn">عرض بناء الجدول</button>
            </div>
        </div>
        <div id="schedule-panel" class="schedule-panel" style="display:none;">
            <div class="panel-content">
                <div class="filters-section">
                    <div class="search-container">
                        <input type="text" id="search-course" placeholder="🔍 ابحث عن مقرر، دكتور، أو شعبة..." class="search-input">
                        <select id="filter-type" class="filter-dropdown">
                            <option value="all">الكل</option>
                            <option value="course">المقرر</option>
                            <option value="instructor">الدكتور</option>
                            <option value="section">الشعبة</option>
                            <option value="day">اليوم</option>
                            <option value="time">الوقت</option>
                        </select>
                    </div>
                    <label class="checkbox-label">
                        <input type="checkbox" id="hide-closed"> إخفاء الشعب المغلقة
                    </label>
                    <button type="button" id="check-conflicts-btn" class="conflicts-check-btn">⚠️ فحص التعارضات</button>
                </div>
                <div class="courses-list-container">
                    <h3>المقررات المتاحة (<span id="available-count">0</span>)</h3>
                    <div id="courses-list"></div>
                </div>
                <div class="selected-section">
                    <h3>المقررات المختارة (<span id="selected-count">0</span>)</h3>
                    <div id="selected-list"></div>
                    <div id="conflicts-alert" class="conflicts-alert" style="display:none;"></div>
                </div>
                <div class="schedule-table-container">
                    <h3>الجدول الأسبوعي</h3>
                    <div id="weekly-schedule"></div>
                </div>
            </div>
        </div>
    `;

    table.parentNode.insertBefore(container, table);

    setupEventListeners();

    // تحميل الشعب المسجلة ثم عرض المقررات
    chrome.storage.local.get(['registeredSections'], (result) => {
        if (result.registeredSections) {
            registeredSections = result.registeredSections;
            console.log(`الجامعة الإسلامية: تم تحميل ${registeredSections.length} شعبة مسجلة من التخزين`);

            // اختيار الشعب المسجلة تلقائياً
            autoSelectRegisteredCourses();
        }
        renderCourses();
        renderSelected();
        checkConflicts();
        renderWeeklySchedule();
    });
}

// اختيار الشعب المسجلة تلقائياً
function autoSelectRegisteredCourses() {
    coursesData.forEach(course => {
        if (isRegisteredSection(course) && !isSelected(course)) {
            selectedCourses.push(course);
            console.log(`الجامعة الإسلامية: تم اختيار الشعبة المسجلة تلقائياً - ${course.courseCode} - ${course.sectionId}`);
        }
    });
}

// إعداد المستمعين
function setupEventListeners() {
    const toggleBtn = document.getElementById('toggle-schedule-btn');
    const searchInput = document.getElementById('search-course');
    const hideClosedCheckbox = document.getElementById('hide-closed');
    const checkConflictsBtn = document.getElementById('check-conflicts-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
            return false;
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderCourses);
    }

    const filterDropdown = document.getElementById('filter-type');
    if (filterDropdown) {
        filterDropdown.addEventListener('change', renderCourses);
    }

    if (hideClosedCheckbox) {
        hideClosedCheckbox.addEventListener('change', renderCourses);
    }

    if (checkConflictsBtn) {
        checkConflictsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            checkConflicts();
            // إظهار التنبيه بشكل واضح
            const alert = document.getElementById('conflicts-alert');
            if (alert && alert.style.display !== 'none') {
                alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
}

// إظهار/إخفاء اللوحة
function togglePanel() {
    const panel = document.getElementById('schedule-panel');
    const btn = document.getElementById('toggle-schedule-btn');

    if (!panel || !btn) return;

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.textContent = 'إخفاء بناء الجدول';
    } else {
        panel.style.display = 'none';
        btn.textContent = 'عرض بناء الجدول';
    }
}

// عرض المقررات كجدول
function renderCourses() {
    const searchTerm = document.getElementById('search-course').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    const hideClosed = document.getElementById('hide-closed').checked;

    const filtered = coursesData.filter(course => {
        let matchSearch = true;

        if (searchTerm) {
            switch (filterType) {
                case 'course':
                    matchSearch = course.courseCode.toLowerCase().includes(searchTerm) ||
                        course.courseName.toLowerCase().includes(searchTerm);
                    break;
                case 'instructor':
                    matchSearch = course.instructor.toLowerCase().includes(searchTerm);
                    break;
                case 'section':
                    matchSearch = course.sectionId.toLowerCase().includes(searchTerm);
                    break;
                case 'day':
                    matchSearch = course.rawTime.toLowerCase().includes(searchTerm);
                    break;
                case 'time':
                    matchSearch = course.rawTime.toLowerCase().includes(searchTerm);
                    break;
                case 'all':
                default:
                    matchSearch = course.courseCode.toLowerCase().includes(searchTerm) ||
                        course.courseName.toLowerCase().includes(searchTerm) ||
                        course.instructor.toLowerCase().includes(searchTerm) ||
                        course.sectionId.toLowerCase().includes(searchTerm);
                    break;
            }
        }

        const matchStatus = !hideClosed || !course.isClosed;
        return matchSearch && matchStatus;
    });

    const container = document.getElementById('courses-list');
    const countElement = document.getElementById('available-count');

    if (countElement) {
        countElement.textContent = filtered.length;
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-message">لا توجد مقررات تطابق البحث</p>';
        return;
    }

    let html = `
        <table class="courses-table">
            <thead>
                <tr>
                    <th>رمز المقرر</th>
                    <th>اسم المقرر</th>
                    <th>الشعبة</th>
                    <th>النوع</th>
                    <th>المحاضر</th>
                    <th>الموعد</th>
                    <th>الحالة</th>
                    <th>اختيار</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(course => {
        const selected = isSelected(course);
        const registered = isRegisteredSection(course);

        // تنسيق الوقت لعرضه في الجدول
        const scheduleDisplay = formatScheduleForDisplay(course.rawTime);

        html += `
            <tr class="course-row ${selected ? 'selected-row' : ''} ${registered ? 'registered-row' : ''}" data-course-id="${course.id}">
                <td><strong>${course.courseCode}</strong></td>
                <td>${course.courseName}</td>
                <td>${course.sectionId} ${registered ? '<span class="registered-badge-inline">✓ مسجل</span>' : ''}</td>
                <td>${course.type}</td>
                <td>${course.instructor}</td>
                <td class="schedule-col">${scheduleDisplay}</td>
                <td><span class="status-badge ${course.isClosed ? 'closed' : 'open'}">${course.status}</span></td>
                <td>
                    <button type="button" class="table-select-btn ${selected ? 'selected' : ''}" data-course-id="${course.id}">
                        ${selected ? '✓ مختار' : 'اختيار'}
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // إضافة معالجات الأحداث للأزرار
    container.querySelectorAll('.table-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const courseId = parseInt(btn.getAttribute('data-course-id'));
            toggleCourse(courseId);
        });
    });
}

// تنسيق الوقت للعرض في الجدول
function formatScheduleForDisplay(rawTime) {
    if (!rawTime || rawTime.trim() === '') return '—';

    const dayNames = {
        '1': 'الأحد',
        '2': 'الاثنين',
        '3': 'الثلاثاء',
        '4': 'الأربعاء',
        '5': 'الخميس',
        '6': 'الجمعة',
        '7': 'السبت'
    };

    const sessions = rawTime.split('@n').filter(s => s.trim());

    return sessions.map(session => {
        const parts = session.split('@r');
        const timeDay = parts[0].split('@t');

        const day = timeDay[0]?.trim() || '';
        const time = timeDay[1]?.trim() || '';
        const room = parts[1]?.trim() || '';

        const dayName = dayNames[day] || day;

        return `<div class="schedule-entry">
            <span class="day-badge">${dayName}</span>
            <span class="time-text">${time}</span>
            ${room ? `<span class="room-text">${room}</span>` : ''}
        </div>`;
    }).join('');
}

// التحقق من الاختيار
function isSelected(course) {
    return selectedCourses.some(c => c.id === course.id);
}

// إضافة/إزالة مقرر
function toggleCourse(courseId) {
    const course = coursesData.find(c => c.id === courseId);
    if (!course) {
        console.log('الجامعة الإسلامية: مقرر غير موجود', courseId);
        return;
    }

    const index = selectedCourses.findIndex(c => c.id === courseId);
    if (index >= 0) {
        selectedCourses.splice(index, 1);
        console.log('الجامعة الإسلامية: تم إلغاء اختيار', course.courseCode, course.sectionId);
    } else {
        selectedCourses.push(course);
        console.log('الجامعة الإسلامية: تم اختيار', course.courseCode, course.sectionId);
    }

    // تحديث القوائم فقط (بدون عرض الجدول)
    renderCourses();
    renderSelected();

    console.log('الجامعة الإسلامية: إجمالي المقررات المختارة:', selectedCourses.length);
}

// عرض المقررات المختارة
function renderSelected() {
    const container = document.getElementById('selected-list');
    document.getElementById('selected-count').textContent = selectedCourses.length;

    if (selectedCourses.length === 0) {
        container.innerHTML = '<p class="empty-message">لم تختر أي مقررات بعد</p>';
        return;
    }

    container.innerHTML = selectedCourses.map(course => {
        const registered = isRegisteredSection(course);
        return `
        <div class="selected-item ${registered ? 'registered' : ''}">
            <span>${course.courseCode} - شعبة ${course.sectionId} ${registered ? '<span class="registered-badge">✓</span>' : ''}</span>
            <button type="button" class="remove-btn" data-course-id="${course.id}">✕</button>
        </div>
    `;
    }).join('');

    // إضافة معالجات الأحداث لأزرار الحذف
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const courseId = parseInt(btn.getAttribute('data-course-id'));
            toggleCourse(courseId);
        });
    });
}

// فحص التعارضات
let detectedConflicts = []; // متغير عام لتخزين التعارضات

function checkConflicts() {
    console.log('════════════════════════════════════════');
    console.log('الجامعة الإسلامية: بدء فحص التعارضات');
    console.log('عدد المقررات المختارة:', selectedCourses.length);
    console.log('════════════════════════════════════════');

    const conflicts = [];
    const conflictingBlocks = new Set();

    // رسم الجدول أولاً
    renderWeeklySchedule();

    // فحص كل مقرر مع الآخر
    for (let i = 0; i < selectedCourses.length; i++) {
        for (let j = i + 1; j < selectedCourses.length; j++) {
            const course1 = selectedCourses[i];
            const course2 = selectedCourses[j];

            console.log(`\n📝 مقارنة: ${course1.courseCode} (${course1.sectionId}) مع ${course2.courseCode} (${course2.sectionId})`);

            const schedule1 = parseSchedule(course1.rawTime);
            const schedule2 = parseSchedule(course2.rawTime);

            schedule1.forEach(s1 => {
                schedule2.forEach(s2 => {
                    const day1 = parseInt(s1.day);
                    const day2 = parseInt(s2.day);

                    console.log(`  يوم ${day1} vs يوم ${day2}: ${s1.time} vs ${s2.time}`);

                    // مقارنة الأيام
                    if (day1 === day2) {
                        console.log(`  ✓ نفس اليوم! فحص الأوقات...`);

                        // تحويل الأوقات إلى دقائق
                        const timeParts1 = s1.time.split('-');
                        const timeParts2 = s2.time.split('-');

                        const s1Start = parseArabicTimeToMinutes(timeParts1[0]?.trim());
                        const s1End = parseArabicTimeToMinutes(timeParts1[1]?.trim());
                        const s2Start = parseArabicTimeToMinutes(timeParts2[0]?.trim());
                        const s2End = parseArabicTimeToMinutes(timeParts2[1]?.trim());

                        console.log(`  المحاضرة 1: ${s1Start} دقيقة → ${s1End} دقيقة (مدة: ${s1End - s1Start} دقيقة)`);
                        console.log(`  المحاضرة 2: ${s2Start} دقيقة → ${s2End} دقيقة (مدة: ${s2End - s2Start} دقيقة)`);

                        if (s1Start !== null && s1End !== null && s2Start !== null && s2End !== null) {
                            // فحص التداخل: هل يتداخل الوقتان؟
                            // A يبدأ قبل B ينتهي AND B يبدأ قبل A ينتهي = تداخل
                            const hasOverlap = (s1Start < s2End && s2Start < s1End);

                            console.log(`  فحص التداخل: ${s1Start} < ${s2End} AND ${s2Start} < ${s1End} = ${hasOverlap}`);

                            if (hasOverlap) {
                                const dayName = getDayName(day1);
                                console.log(`  ⚠️ ⚠️ ⚠️ تعارض مكتشف!`);

                                conflicts.push({
                                    course1: course1,
                                    course2: course2,
                                    day: s1.day,
                                    dayName: dayName,
                                    time1: s1.time,
                                    time2: s2.time,
                                    overlap: {
                                        start: Math.max(s1Start, s2Start),
                                        end: Math.min(s1End, s2End)
                                    }
                                });

                                // تمييز الـblocks المتعارضة
                                conflictingBlocks.add(`${course1.id}-${s1.day}-${s1.time}`);
                                conflictingBlocks.add(`${course2.id}-${s2.day}-${s2.time}`);
                            } else {
                                console.log(`  ✓ لا تعارض`);
                            }
                        } else {
                            console.log(`  ⚠️ فشل تحليل الأوقات`);
                        }
                    }
                });
            });
        }
    }

    console.log('\n════════════════════════════════════════');
    console.log(`نتيجة الفحص: ${conflicts.length} تعارض`);
    console.log('════════════════════════════════════════\n');

    // حفظ التعارضات عالمياً
    detectedConflicts = conflicts;

    // إعادة رسم الجدول مع التعارضات
    if (conflicts.length > 0) {
        console.log('🔴 إعادة رسم الجدول مع تمييز التعارضات...');
        renderWeeklySchedule();
    }

    const alert = document.getElementById('conflicts-alert');
    if (!alert) return;

    if (conflicts.length > 0) {
        alert.className = 'conflicts-alert error';
        alert.style.display = 'block';

        // عرض كل تعارض في مربع منفصل
        let conflictsHTML = conflicts.map((c, index) => {
            const overlapMin = c.overlap.end - c.overlap.start;
            return `
                <div class="conflict-box">
                    <div class="conflict-header">
                        <span class="conflict-badge">#${index + 1}</span>
                        <span class="conflict-day">📅 ${c.dayName}</span>
                    </div>
                    <div class="conflict-body">
                        <div class="conflict-course">
                            <strong>${c.course1.courseCode}</strong> 
                            <span class="section-label">شعبة ${c.course1.sectionId}</span>
                        </div>
                        <div class="conflict-vs">⚔️</div>
                        <div class="conflict-course">
                            <strong>${c.course2.courseCode}</strong> 
                            <span class="section-label">شعبة ${c.course2.sectionId}</span>
                        </div>
                    </div>
                    <div class="conflict-footer">
                        ⏰ تداخل ${overlapMin} دقيقة
                    </div>
                </div>
            `;
        }).join('');

        alert.innerHTML = `
            <div class="conflicts-header">
                <strong>⚠️ تحذير: يوجد ${conflicts.length} تعارض في الجدول</strong>
            </div>
            <div class="conflicts-grid">${conflictsHTML}</div>
        `;

        // إخفاء الملخص عند وجود تعارض
        hideSummarySection();

    } else if (selectedCourses.length > 0) {
        alert.className = 'conflicts-alert success';
        alert.style.display = 'block';
        alert.innerHTML = `
            <strong>✅ ممتاز! لا توجد تعارضات في الجدول</strong>
            <p>جميع المقررات المختارة (${selectedCourses.length}) لا تتعارض مع بعضها البعض</p>
        `;

        // لا نعرض قسم الملخص
        hideSummarySection();

    } else {
        alert.style.display = 'block';
        alert.className = 'conflicts-alert';
        alert.style.background = '#fef3c7';
        alert.style.borderColor = '#fbbf24';
        alert.innerHTML = '<strong>⚠️ الرجاء اختيار مقررات أولاً</strong>';

        hideSummarySection();
    }

    // التمرير إلى الجدول
    const scheduleSection = document.getElementById('schedule-panel');
    if (scheduleSection && scheduleSection.style.display !== 'none') {
        alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// تحميل الجدول كصورة
function downloadScheduleImage() {
    const scheduleContainer = document.getElementById('weekly-schedule');
    if (!scheduleContainer) {
        alert('عذراً، لم يتم العثور على الجدول');
        return;
    }

    // استخدام dom-to-image للتقاط الجدول كما هو
    domtoimage.toPng(scheduleContainer, {
        quality: 1,
        bgcolor: '#ffffff'
    })
        .then(function (dataUrl) {
            const link = document.createElement('a');
            const date = new Date().toLocaleDateString('ar-SA').replace(/\//g, '-');
            link.download = `جدول_DAMMAJ_${date}.png`;
            link.href = dataUrl;
            link.click();
            alert('✅ تم تحميل الصورة بنجاح!');
        })
        .catch(function (error) {
            console.error('فشل التقاط الصورة:', error);
            alert('عذراً، فشل تحميل الصورة');
        });
}

// إنشاء جدول HTML للتحميل كصورة
function generateScheduleTable() {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const hours = [];
    for (let h = 8; h <= 17; h++) {
        hours.push(h < 12 ? `${h}:00 ص` : h === 12 ? '12:00 م' : `${h - 12}:00 م`);
    }

    // إنشاء مصفوفة للجدول
    const grid = {};
    days.forEach((day, dayIndex) => {
        grid[dayIndex + 1] = {};
        hours.forEach((hour, hourIndex) => {
            grid[dayIndex + 1][8 + hourIndex] = [];
        });
    });

    // ملء الجدول بالمقررات
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

    selectedCourses.forEach((course, courseIndex) => {
        const schedule = parseSchedule(course.rawTime);
        const color = colors[courseIndex % colors.length];

        schedule.forEach(session => {
            const dayNum = parseInt(session.day);
            const timeParts = session.time.split('-');
            const startMin = parseArabicTimeToMinutes(timeParts[0]?.trim());
            const endMin = parseArabicTimeToMinutes(timeParts[1]?.trim());

            if (startMin !== null && endMin !== null) {
                const startHour = Math.floor(startMin / 60);
                const endHour = Math.floor(endMin / 60);

                for (let h = startHour; h < endHour; h++) {
                    if (grid[dayNum] && grid[dayNum][h] !== undefined) {
                        grid[dayNum][h].push({
                            code: course.courseCode,
                            section: course.sectionId,
                            color: color
                        });
                    }
                }
            }
        });
    });

    // بناء HTML
    let html = `
        <div style="text-align:center;margin-bottom:15px;">
            <h2 style="color:#015b90;margin:0;">📅 الجدول الأسبوعي</h2>
            <p style="color:#666;font-size:12px;">المطور: DAMMAJ</p>
        </div>
        <table style="border-collapse:collapse;width:100%;font-size:11px;">
            <tr style="background:#f3f4f6;">
                <th style="border:1px solid #d1d5db;padding:8px;width:60px;">الوقت</th>
    `;

    days.forEach(day => {
        html += `<th style="border:1px solid #d1d5db;padding:8px;background:#015b90;color:white;">${day}</th>`;
    });
    html += '</tr>';

    hours.forEach((hour, hourIndex) => {
        html += `<tr>
            <td style="border:1px solid #d1d5db;padding:5px;text-align:center;background:#f9fafb;font-weight:bold;">${hour}</td>`;

        days.forEach((day, dayIndex) => {
            const courses = grid[dayIndex + 1][8 + hourIndex] || [];
            if (courses.length > 0) {
                const course = courses[0];
                html += `<td style="border:1px solid #d1d5db;padding:5px;text-align:center;background:${course.color};color:white;font-weight:bold;">
                    ${course.code}<br><small>${course.section}</small>
                </td>`;
            } else {
                html += `<td style="border:1px solid #d1d5db;padding:5px;"></td>`;
            }
        });

        html += '</tr>';
    });

    html += '</table>';
    return html;
}

// طباعة الجدول
window.printSchedule = function () {
    window.print();
}

// عرض ملخص المقررات المعتمدة
function renderCourseSummary() {
    // إنشاء قسم الملخص إذا لم يكن موجوداً
    let summarySection = document.getElementById('courses-summary-section');
    if (!summarySection) {
        summarySection = document.createElement('div');
        summarySection.id = 'courses-summary-section';
        summarySection.className = 'courses-summary-section';

        const scheduleContainer = document.querySelector('.schedule-table-container');
        if (scheduleContainer) {
            scheduleContainer.parentNode.insertBefore(summarySection, scheduleContainer);
        }
    }

    summarySection.style.display = 'block';

    const colors = [
        '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
        '#6366f1', '#ec4899', '#14b8a6', '#f97316'
    ];

    let cardsHTML = selectedCourses.map((course, index) => {
        const color = colors[index % colors.length];
        const registered = isRegisteredSection(course);
        const schedule = parseSchedule(course.rawTime);

        let scheduleHTML = schedule.map(s => {
            const dayName = getDayName(parseInt(s.day));
            return `<div class="summary-time-entry">📅 ${dayName}: ${s.time}</div>`;
        }).join('');

        return `
            <div class="summary-card" style="border-left-color: ${color}">
                <div class="summary-card-header" style="background: ${color}">
                    <div class="summary-card-title">${course.courseName}</div>
                    ${registered ? '<span class="summary-registered-badge">✓ مسجل</span>' : ''}
                </div>
                <div class="summary-card-body">
                    <div class="summary-row">
                        <span class="summary-label">رمز المقرر:</span>
                        <span class="summary-value">${course.courseCode}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">الشعبة:</span>
                        <span class="summary-value">${course.sectionId}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">المحاضر:</span>
                        <span class="summary-value">${course.instructor || 'غير محدد'}</span>
                    </div>
                    <div class="summary-schedule">
                        ${scheduleHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    summarySection.innerHTML = `
        <div class="summary-header">
            <h3 class="summary-section-title">
                <span class="summary-icon">📚</span>
                ملخص المقررات المعتمدة (${selectedCourses.length})
            </h3>
            <button type="button" id="copy-summary-btn" class="copy-summary-btn">
                📋 نسخ الملخص
            </button>
        </div>
        <div class="summary-cards-grid">
            ${cardsHTML}
        </div>
    `;

    // إضافة معالج حدث لزر النسخ
    const copyBtn = document.getElementById('copy-summary-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copySummaryToClipboard);
    }
}

// نسخ الملخص إلى الحافظة
function copySummaryToClipboard() {
    let summaryText = '═══════════════════════════════════════\n';
    summaryText += '   📚 أرقام الشعب المعتمدة\n';
    summaryText += `   الجامعة الإسلامية - ${selectedCourses.length} مقرر\n`;
    summaryText += '═══════════════════════════════════════\n\n';

    selectedCourses.forEach((course, index) => {
        const schedule = parseSchedule(course.rawTime);
        const registered = isRegisteredSection(course);

        // تنسيق مبسط: (اسم المقرر | رقم الشعبة | اليوم الوقت | الدكتور)
        summaryText += `${index + 1}. ${course.courseName} | ${course.sectionId}`;

        if (registered) {
            summaryText += ' ✓ (مسجل)';
        }

        summaryText += '\n';

        schedule.forEach(s => {
            const dayName = getDayName(parseInt(s.day));
            summaryText += `   ${dayName} ${s.time} | ${course.instructor || 'غير محدد'}\n`;
        });

        summaryText += '\n';
    });

    summaryText += '═══════════════════════════════════════\n';
    summaryText += 'تم الإنشاء بواسطة: الجامعة الإسلامية - بناء الجدول\n';

    // نسخ إلى الحافظة
    navigator.clipboard.writeText(summaryText).then(() => {
        alert('✅ تم نسخ أرقام الشعب بنجاح!');
    }).catch(err => {
        console.error('فشل النسخ:', err);
        alert('عذراً، فشل نسخ الملخص. الرجاء المحاولة مرة أخرى.');
    });
}

// إخفاء قسم الملخص
function hideSummarySection() {
    const summarySection = document.getElementById('courses-summary-section');
    if (summarySection) {
        summarySection.style.display = 'none';
    }
}

// الحصول على اسم اليوم
function getDayName(dayNum) {
    const days = {
        1: 'الأحد',
        2: 'الاثنين',
        3: 'الثلاثاء',
        4: 'الأربعاء',
        5: 'الخميس',
        6: 'الجمعة',
        7: 'السبت'
    };
    return days[dayNum] || dayNum;
}

// عرض الجدول الأسبوعي باستخدام Grid Layout
function renderWeeklySchedule() {
    console.log('الجامعة الإسلامية: بدء رسم الجدول Grid Layout');

    const container = document.getElementById('weekly-schedule');
    if (!container) return;

    // إنشاء Grid Container مع الأزرار
    const showButtons = selectedCourses.length > 0;

    container.innerHTML = `
        ${showButtons ? `
        <div class="schedule-actions">
            <h3>الجدول الأسبوعي</h3>
            <div class="schedule-buttons">
                <button type="button" id="copy-sections-btn" class="action-btn copy-btn">
                    📋 نسخ أرقام الشعب
                </button>
                <button type="button" id="download-schedule-btn" class="action-btn download-btn">
                    📥 تحميل كصورة
                </button>
            </div>
        </div>
        ` : '<h3>الجدول الأسبوعي</h3>'}
        <div id="custom-tooltip" class="schedule-tooltip"></div>
        <div class="schedule-grid-container">
            <div class="schedule-grid">
                <!-- عمود الوقت -->
                <div class="time-column">
                    <div class="day-header-spacer"></div>
                    ${generateTimeSlots()}
                </div>

                <!-- أعمدة الأيام -->
                ${generateDayColumns()}
            </div>
        </div>
    `;

    // عرض المقررات كblocks
    renderCourseBlocks();

    // إضافة event listeners للأزرار
    const copyBtn = document.getElementById('copy-sections-btn');
    const downloadBtn = document.getElementById('download-schedule-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copySummaryToClipboard();
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            downloadScheduleImage();
        });
    }

    console.log('الجامعة الإسلامية: تم رسم الجدول بنجاح');
}

// توليد خانات الوقت
function generateTimeSlots() {
    let html = '';
    for (let hour = 8; hour <= 17; hour++) {
        const displayHour = hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? 'م' : 'ص';
        html += `<div class="time-slot">${displayHour}:00 ${period}</div>`;
    }
    return html;
}

// توليد أعمدة الأيام
function generateDayColumns() {
    const days = [
        { num: 1, name: 'الأحد' },
        { num: 2, name: 'الاثنين' },
        { num: 3, name: 'الثلاثاء' },
        { num: 4, name: 'الأربعاء' },
        { num: 5, name: 'الخميس' }
    ];

    return days.map(day => `
        <div class="day-column" id="day-${day.num}">
            <div class="day-header">${day.name}</div>
            <div class="day-content"></div>
        </div>
    `).join('');
}

// رسم مقررات كـ blocks
function renderCourseBlocks() {
    console.log('الجامعة الإسلامية: رسم مقررات على الجدول:', selectedCourses.length);

    if (selectedCourses.length === 0) return;

    const colors = [
        '#3b82f6', // blue
        '#10b981', // green
        '#8b5cf6', // purple
        '#f59e0b', // amber
        '#6366f1', // indigo
        '#ec4899', // pink
        '#14b8a6', // teal
        '#f97316'  // orange
    ];

    const courseBlocks = [];

    selectedCourses.forEach((course, courseIndex) => {
        const schedule = parseSchedule(course.rawTime);
        const color = colors[courseIndex % colors.length];

        schedule.forEach(session => {
            const startMin = parseArabicTimeToMinutes(session.time.split('-')[0]?.trim());
            const endMin = parseArabicTimeToMinutes(session.time.split('-')[1]?.trim());

            if (startMin === null || endMin === null) {
                console.log('⚠️ فشل تحليل الوقت:', session.time);
                return;
            }

            const dayNum = parseInt(session.day);
            if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) return;

            courseBlocks.push({
                course: course,
                session: session,
                day: dayNum,
                startMin: startMin,
                endMin: endMin,
                color: color
            });
        });
    });

    // رسم كل block
    courseBlocks.forEach(block => {
        createCourseBlock(block);
    });
}

// إنشاء block المقرر
function createCourseBlock(block) {
    const dayColumn = document.querySelector(`#day-${block.day} .day-content`);
    if (!dayColumn) return;

    const gridStartMin = 8 * 60; // 8:00 AM
    const gridEndMin = 18 * 60;   // 6:00 PM

    const topPos = block.startMin - gridStartMin;
    const height = block.endMin - block.startMin;

    const registered = isRegisteredSection(block.course);

    // فحص إذا كان هذا الـblock متعارض
    let isConflicted = false;
    detectedConflicts.forEach(conflict => {
        const conflictDay = parseInt(conflict.day);

        // فحص المقرر الأول
        if (conflict.course1.id === block.course.id && conflictDay === block.day) {
            const timeParts = conflict.time1.split('-');
            const conflictStart = parseArabicTimeToMinutes(timeParts[0]?.trim());
            const conflictEnd = parseArabicTimeToMinutes(timeParts[1]?.trim());
            if (block.startMin === conflictStart && block.endMin === conflictEnd) {
                isConflicted = true;
            }
        }

        // فحص المقرر الثاني
        if (conflict.course2.id === block.course.id && conflictDay === block.day) {
            const timeParts = conflict.time2.split('-');
            const conflictStart = parseArabicTimeToMinutes(timeParts[0]?.trim());
            const conflictEnd = parseArabicTimeToMinutes(timeParts[1]?.trim());
            if (block.startMin === conflictStart && block.endMin === conflictEnd) {
                isConflicted = true;
            }
        }
    });

    const div = document.createElement('div');
    div.className = `course-block ${registered ? 'registered-block' : ''} ${isConflicted ? 'conflict-block' : ''}`;
    div.setAttribute('data-block-id', block.blockId);
    div.setAttribute('data-course-id', block.course.id);
    div.getAttribute('data-day', block.day);
    div.setAttribute('data-start', block.startMin);
    div.setAttribute('data-end', block.endMin);
    div.style.top = `${topPos}px`;
    div.style.height = `${height}px`;
    div.style.backgroundColor = isConflicted ? '#dc2626' : block.color;

    if (isConflicted) {
        console.log('🔴 Block متعارض:', block.course.courseCode, 'يوم', block.day);
    }

    // اسم المحاضر الأخير
    const instructorParts = (block.course.instructor || "").trim().split(/\s+/);
    const lastName = instructorParts[instructorParts.length - 1] || "";

    div.innerHTML = `
        <div class="course-block-title">${block.course.courseCode}</div>
        <div class="course-block-section">${block.course.sectionId}${registered ? ' ✓' : ''}</div>
        <div class="course-block-instructor">${lastName}</div>
    `;

    // Tooltip
    const tooltip = document.getElementById('custom-tooltip');
    div.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = `
            <div class="tooltip-title">${block.course.courseName}</div>
            <div class="tooltip-row">👨‍🏫 ${block.course.instructor || 'غير محدد'}</div>
            <div class="tooltip-row">🔢 الشعبة: ${block.course.sectionId}</div>
            <div class="tooltip-row">⏰ ${block.session.time}</div>
            <div class="tooltip-row">📍 ${block.session.room || 'غير محدد'}</div>
        `;
        tooltip.style.display = 'block';
    });

    div.addEventListener('mousemove', (e) => {
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    });

    div.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    dayColumn.appendChild(div);
}

// تحويل الوقت العربي إلى دقائق
function parseArabicTimeToMinutes(timeStr) {
    if (!timeStr) return null;

    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*([صم]?)/);
    if (!match) return null;

    let h = parseInt(match[1]);
    let m = parseInt(match[2]);
    const period = match[3];

    if (period === 'م' && h !== 12) h += 12;
    if (period === 'ص' && h === 12) h = 0;

    return h * 60 + m;
}

// إيجاد المقررات في وقت معين
function findCoursesAtTime(day, hour) {
    const results = [];

    console.log(`الجامعة الإسلامية: البحث عن مقررات في اليوم ${day} الساعة ${hour}`);

    selectedCourses.forEach(course => {
        const schedule = parseSchedule(course.rawTime);

        schedule.forEach(session => {
            // تحويل اليوم للمقارنة
            const sessionDay = parseInt(session.day);

            if (sessionDay === day) {
                let matches = false;
                let sessionHour = null;

                // استخراج الساعة من الوقت
                const timeMatch = session.time.match(/(\d+):(\d+)/);
                if (timeMatch) {
                    sessionHour = parseInt(timeMatch[1]);

                    // معالجة نظام 12 ساعة - التحويل لنظام 24 ساعة
                    if (session.time.includes('م')) {
                        // إذا كان مساءً (PM)
                        if (sessionHour !== 12) {
                            sessionHour += 12;
                        }
                    } else if (session.time.includes('ص')) {
                        // إذا كان صباحاً (AM)
                        if (sessionHour === 12) {
                            sessionHour = 0;
                        }
                    }

                    // المقارنة
                    matches = (sessionHour === hour);

                    console.log(`  - ${course.courseCode} (${course.sectionId}): يوم ${sessionDay}, وقت ${session.time}, ساعة محسوبة ${sessionHour}, يطابق؟ ${matches}`);
                }

                if (matches) {
                    const registered = isRegisteredSection(course);
                    results.push(`
                        <div class="schedule-item ${registered ? 'registered-item' : ''}">
                            <strong>${course.courseCode}</strong><br>
                            شعبة ${course.sectionId}${registered ? ' ✓' : ''}<br>
                            ${session.room || 'غير محدد'}
                        </div>
                    `);
                }
            }
        });
    });

    if (results.length > 0) {
        console.log(`  ✓ وجد ${results.length} مقرر(ات)`);
    }

    return results.join('');
}

// تهيئة عند التحميل
setTimeout(() => {
    // التحقق من نوع الصفحة
    const scheduleTable = document.getElementById('scheduleFrm:studScheduleTable');
    const offeredTable = document.getElementById('myForm:offeredCoursesTable');

    if (scheduleTable) {
        // صفحة المقررات المسجلة - استخراج الشعب المسجلة
        registeredSections = extractRegisteredCourses();
        console.log('الجامعة الإسلامية: تم استخراج الشعب المسجلة');
    } else if (offeredTable) {
        // صفحة المقررات المطروحة - عرض الواجهة
        coursesData = extractCourseData() || [];
        if (coursesData.length > 0) {
            injectUI();
            console.log('الجامعة الإسلامية: تم تفعيل الواجهة بنجاح');
        }
    }
}, 1500);
