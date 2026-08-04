// Popup Script - منطق الواجهة المنبثقة للإضافة
// تم إزالة جميع أكواد الذكاء الاصطناعي حسب طلب المستخدم

let allCoursesData = [];
let currentScheduleBlocks = [];
const colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7', 'color-8'];

const dayMap = {
    '1': 'الأحد',
    '2': 'الاثنين',
    '3': 'الثلاثاء',
    '4': 'الأربعاء',
    '5': 'الخميس',
    '6': 'الجمعة',
    '7': 'السبت'
};

// تحميل البيانات عند فتح الإضافة
document.addEventListener('DOMContentLoaded', function () {
    loadDataFromStorage();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('filterBtn').addEventListener('click', filterCourses);
    document.getElementById('buildScheduleBtn').addEventListener('click', buildSchedule);

    // تفعيل الفلترة عند الضغط على Enter
    document.getElementById('filterInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') filterCourses();
    });
}

function loadDataFromStorage() {
    chrome.storage.local.get(['coursesData', 'lastUpdate'], function (result) {
        if (result.coursesData && result.coursesData.length > 0) {
            allCoursesData = result.coursesData;
            const updateTime = result.lastUpdate ? new Date(result.lastUpdate).toLocaleString('ar-SA') : 'غير معروف';
            updateStatus(`تم تحميل ${allCoursesData.length} مادة (آخر تحديث: ${updateTime})`, 'success');
            showFilterSection();
            renderTable(allCoursesData, "جميع الشعب المستخرجة");
        } else {
            updateStatus('لم يتم العثور على بيانات. الرجاء فتح صفحة الجدول أولاً.', 'error');
        }
    });
}

function refreshData() {
    updateStatus('جارٍ تحديث البيانات...', 'loading');

    // إرسال رسالة للـ content script لإعادة استخراج البيانات
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('eduportal.iu.edu.sa')) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_DATA' }, function (response) {
                if (chrome.runtime.lastError) {
                    updateStatus('الرجاء فتح صفحة الجدول الجامعي أولاً', 'error');
                } else if (response && response.success) {
                    setTimeout(loadDataFromStorage, 500);
                } else {
                    updateStatus('لم يتم العثور على جدول في الصفحة الحالية', 'error');
                }
            });
        } else {
            updateStatus('الرجاء فتح صفحة الجدول الجامعي (eduportal.iu.edu.sa)', 'error');
        }
    });
}

function updateStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    const statusBar = document.getElementById('statusBar');

    statusMessage.textContent = message;

    // تغيير لون الشريط حسب النوع
    statusBar.className = 'status-bar';
    if (type === 'success') {
        statusBar.style.backgroundColor = '#d1fae5';
        statusBar.style.borderColor = '#6ee7b7';
        statusMessage.style.color = '#065f46';
    } else if (type === 'error') {
        statusBar.style.backgroundColor = '#fee2e2';
        statusBar.style.borderColor = '#fca5a5';
        statusMessage.style.color = '#991b1b';
    } else {
        statusBar.style.backgroundColor = '#dbeafe';
        statusBar.style.borderColor = '#93c5fd';
        statusMessage.style.color = '#1e40af';
    }
}

function showFilterSection() {
    document.getElementById('filterSection').style.display = 'block';
}

function parseTimeSchedule(rawString) {
    if (!rawString || rawString.trim() === "") return "غير محدد";

    const entries = rawString.split('@n');
    let formattedSchedule = [];

    entries.forEach(entry => {
        let cleanEntry = entry.trim();
        if (!cleanEntry) return;

        const parts = cleanEntry.split('@t');
        if (parts.length < 2) return;

        const dayPart = parts[0];
        const rest = parts[1];

        const daysFound = dayPart.match(/\d/g);
        if (!daysFound) return;

        const dayNames = daysFound.map(d => `<span class="day-name">${dayMap[d] || d}</span>`).join('، ');

        const timeStr = rest.split('@r')[0].trim();
        const roomPart = rest.split('@r')[1];
        const roomStr = roomPart ? ` <span class="room-info">(${roomPart.trim()})</span>` : '';

        formattedSchedule.push(`<div class="time-entry">${dayNames}: ${timeStr}${roomStr}</div>`);
    });

    return formattedSchedule.join('');
}

function renderTable(data, title) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    document.getElementById('tableTitle').innerText = title;
    document.getElementById('countBadge').innerText = data.length;
    document.getElementById('resultsContainer').style.display = 'block';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #9ca3af;">لا توجد نتائج</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        const statusClass = item.isClosed ? 'status-closed' : 'status-open';
        const formattedTime = parseTimeSchedule(item.rawTime);

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="course-checkbox" value="${item.id}">
            </td>
            <td style="font-weight: 600;">${item.courseCode}</td>
            <td style="font-size: 0.8rem;">${item.courseName}</td>
            <td style="font-weight: bold; color: #1e40af;">${item.sectionId}</td>
            <td>${item.type}</td>
            <td style="font-size: 0.75rem;">${item.instructor}</td>
            <td class="time-display">${formattedTime}</td>
            <td class="${statusClass}">${item.status}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterCourses() {
    const filterText = document.getElementById('filterInput').value.trim().toLowerCase();
    const keys = filterText ? filterText.split(/[\s,]+/).filter(k => k) : [];

    const filteredData = allCoursesData.filter(item => {
        if (keys.length === 0) return !item.isClosed;
        return keys.some(key =>
            item.sectionId.includes(key) ||
            item.courseCode.toLowerCase().includes(key) ||
            item.courseName.toLowerCase().includes(key)
        );
    });

    renderTable(filteredData, keys.length > 0 ? "نتائج التصفية" : "الشعب المفتوحة");
}

function parseArabicTime(timeStr) {
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*([صم]?)/);
    if (!match) return null;

    let h = parseInt(match[1]);
    let m = parseInt(match[2]);
    let period = match[3];

    if (period === 'م' && h !== 12) h += 12;
    if (period === 'ص' && h === 12) h = 0;

    return h * 60 + m;
}

function formatMinToTime(minutes) {
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    let p = 'ص';
    if (h >= 12) { p = 'م'; if (h > 12) h -= 12; }
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, '0')} ${p}`;
}

function buildSchedule() {
    const checkboxes = document.querySelectorAll('.course-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (selectedIds.length === 0) {
        alert("الرجاء اختيار شعبة واحدة على الأقل لإنشاء الجدول.");
        return;
    }

    const selectedCourses = allCoursesData.filter(c => selectedIds.includes(c.id));

    currentScheduleBlocks = [];
    let hasConflict = false;

    selectedCourses.forEach((course, index) => {
        const colorClass = colors[index % colors.length];
        if (!course.rawTime) return;

        const entries = course.rawTime.split('@n');
        entries.forEach(entry => {
            const cleanEntry = entry.trim();
            if (!cleanEntry) return;

            const parts = cleanEntry.split('@t');
            if (parts.length < 2) return;

            const dayPart = parts[0];
            const timePartFull = parts[1];

            const dayMatches = dayPart.match(/\d/g);
            if (!dayMatches) return;

            const timeStr = timePartFull.split('@r')[0].trim();
            const [startStr, endStr] = timeStr.split('-');

            const startMin = parseArabicTime(startStr);
            const endMin = parseArabicTime(endStr);

            if (startMin !== null && endMin !== null) {
                dayMatches.forEach(dayDigit => {
                    const dayNum = parseInt(dayDigit);

                    currentScheduleBlocks.push({
                        courseName: course.courseName,
                        courseCode: course.courseCode,
                        sectionId: course.sectionId,
                        instructor: course.instructor,
                        day: dayNum,
                        dayName: dayMap[dayNum],
                        start: startMin,
                        end: endMin,
                        startTimeStr: startStr,
                        endTimeStr: endStr,
                        color: colorClass
                    });
                });
            }
        });
    });

    // مسح الجدول السابق
    document.querySelectorAll('.course-block').forEach(el => el.remove());
    currentScheduleBlocks.sort((a, b) => a.start - b.start);

    // كشف التعارضات
    let conflictMsg = "";
    for (let i = 0; i < currentScheduleBlocks.length; i++) {
        for (let j = i + 1; j < currentScheduleBlocks.length; j++) {
            const b1 = currentScheduleBlocks[i];
            const b2 = currentScheduleBlocks[j];
            if (b1.day === b2.day) {
                if (b1.start < b2.end && b2.start < b1.end) {
                    hasConflict = true;
                    b1.isConflict = true;
                    b2.isConflict = true;
                    conflictMsg = `يوجد تعارض بين ${b1.courseName} و ${b2.courseName} في يوم ${b1.dayName}`;
                }
            }
        }
    }

    const tooltip = document.getElementById('customTooltip');

    currentScheduleBlocks.forEach(block => {
        const dayCol = document.getElementById(`day-${block.day}`);
        if (!dayCol) return;

        const gridStartMin = 8 * 60;
        const topPos = block.start - gridStartMin + 40; // +40 for header
        const height = block.end - block.start;

        const instructorParts = (block.instructor || "").trim().split(/\s+/);
        const lastName = instructorParts.length > 0 ? instructorParts[instructorParts.length - 1] : "";

        const div = document.createElement('div');
        div.className = `course-block ${block.isConflict ? 'conflict-block' : block.color}`;
        div.style.top = `${topPos}px`;
        div.style.height = `${height}px`;

        div.innerHTML = `
            <div class="course-name" title="${block.courseName}">${block.courseName}</div>
            <div class="course-info">${block.sectionId} - ${lastName}</div>
            <div class="course-info">${formatMinToTime(block.start)} - ${formatMinToTime(block.end)}</div>
        `;

        // Tooltip
        div.addEventListener('mouseenter', (e) => {
            tooltip.innerHTML = `
                <div class="tooltip-title">${block.courseName}</div>
                <div class="tooltip-row"><span class="tooltip-label">👨‍🏫 المحاضر:</span> ${block.instructor || 'غير محدد'}</div>
                <div class="tooltip-row"><span class="tooltip-label">🔢 الشعبة:</span> ${block.sectionId}</div>
                <div class="tooltip-row"><span class="tooltip-label">⏰ الوقت:</span> ${formatMinToTime(block.start)} - ${formatMinToTime(block.end)}</div>
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

        dayCol.appendChild(div);
    });

    // عرض النتائج
    const alertBox = document.getElementById('conflictAlert');
    const scheduleSec = document.getElementById('scheduleSection');
    const summaryDiv = document.getElementById('successSummary');
    const summaryGrid = document.getElementById('summaryGrid');

    scheduleSec.style.display = 'block';
    alertBox.style.display = 'block';

    if (hasConflict) {
        alertBox.className = "alert alert-error";
        alertBox.innerHTML = `⚠️ تنبيه: ${conflictMsg}`;
        summaryDiv.style.display = 'none';
    } else {
        alertBox.className = "alert alert-success";
        alertBox.innerHTML = `✅ جدول سليم! لا يوجد أي تعارض.`;

        // إنشاء بطاقات الملخص
        summaryGrid.innerHTML = '';
        selectedCourses.forEach((course, index) => {
            const card = document.createElement('div');
            card.className = "summary-card";
            card.style.borderRightColor = getComputedStyle(document.documentElement).getPropertyValue(`--color-${(index % colors.length) + 1}`) || '#3b82f6';

            card.innerHTML = `
                <div class="summary-card-title">
                    <span>📖</span>
                    <span>${course.courseName}</span>
                </div>
                <div class="summary-card-info">
                    <span style="color: #2563eb; font-weight: bold;">#</span>
                    <span>الشعبة: <strong>${course.sectionId}</strong></span>
                </div>
                <div class="summary-card-info">
                    <span>👨‍🏫</span>
                    <span>الدكتور: <strong>${course.instructor || 'غير محدد'}</strong></span>
                </div>
            `;
            summaryGrid.appendChild(card);
        });

        summaryDiv.style.display = 'block';
    }

    scheduleSec.scrollIntoView({ behavior: 'smooth' });
}

// الاستماع لرسائل من الـ content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'DATA_EXTRACTED') {
        loadDataFromStorage();
    }
});
