document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНІ ЗМІННІ ТА СТАН ДОДАТКУ ---
    let schedules = [];
    let subjects = [];
    let archive = [];
    let appState = {
        systemStartDate: new Date().toISOString(), // Дата першого запуску або налаштування
        currentScheduleIndex: 0,
        currentDayIndex: 0,
        lastCheckDate: new Date().toISOString().split('T')[0]
    };
    
    // --- DOM ЕЛЕМЕНТИ ---
    const menu = document.getElementById('menu');
    const overlay = document.getElementById('overlay');
    const weekDays = ['понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота', 'неділя'];

    // --- ІНІЦІАЛІЗАЦІЯ ---
    function initializeApp() {
        loadData();
        checkForDailyUpdate();
        setupEventListeners();
        showSection('current');
        startIntervals();
        updateClock();
    }

    function loadData() {
        schedules = JSON.parse(localStorage.getItem('schedules')) || [];
        subjects = JSON.parse(localStorage.getItem('subjects')) || [];
        archive = JSON.parse(localStorage.getItem('archive')) || [];
        const savedState = JSON.parse(localStorage.getItem('appState'));
        if (savedState) {
            appState = savedState;
        } else {
            localStorage.setItem('appState', JSON.stringify(appState));
        }
    }

    function saveData() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
        localStorage.setItem('subjects', JSON.stringify(subjects));
        localStorage.setItem('archive', JSON.stringify(archive));
        localStorage.setItem('appState', JSON.stringify(appState));
        renderMainScreen();
    }

    function setupEventListeners() {
        document.querySelector('.burger').addEventListener('click', toggleMenu);
        overlay.addEventListener('click', () => {
            closeMenu();
            closeAllModals();
        });
        document.getElementById('datePicker').addEventListener('change', handleDateChange);
        document.getElementById('scheduleForm').addEventListener('submit', handleScheduleSave);
        document.getElementById('importSchedulesFile').addEventListener('change', importSchedules);
        document.getElementById('importSubjectsFile').addEventListener('change', importSubjects);
    }

    function startIntervals() {
        setInterval(renderMainScreen, 30000);
        setInterval(updateClock, 1000);
    }

    // --- ОСНОВНА ЛОГІКА СИСТЕМИ ---
    function checkForDailyUpdate() {
        const today = new Date().toISOString().split('T')[0];
        if (today > appState.lastCheckDate) {
            const diffTime = new Date(today) - new Date(appState.lastCheckDate);
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            advanceStateAndArchive(diffDays);
            appState.lastCheckDate = today;
            saveData();
        }
    }

    function advanceStateAndArchive(days) {
        for (let i = 0; i < days; i++) {
            if (schedules.length === 0) break;
            const scheduleBeforeAdvance = schedules[appState.currentScheduleIndex];
            appState.currentDayIndex++;
            if (appState.currentDayIndex >= weekDays.length) {
                appState.currentDayIndex = 0;
                const oldScheduleIndex = appState.currentScheduleIndex;
                appState.currentScheduleIndex++;
                if (appState.currentScheduleIndex >= schedules.length) {
                    appState.currentScheduleIndex = 0;
                }
                if (scheduleBeforeAdvance && scheduleBeforeAdvance.type === 'onetime') {
                    archive.push(scheduleBeforeAdvance);
                    schedules.splice(oldScheduleIndex, 1);
                    if (appState.currentScheduleIndex > oldScheduleIndex) {
                        appState.currentScheduleIndex--;
                    }
                    if (schedules.length === 0 || appState.currentScheduleIndex >= schedules.length) {
                        appState.currentScheduleIndex = 0;
                    }
                }
            }
        }
    }

    function calculateProjectedState(days, initialState = appState) {
        let tempState = JSON.parse(JSON.stringify(initialState));
        let tempSchedules = schedules.filter(s => s.type === 'permanent'); // Розрахунок тільки для постійних
        if (tempSchedules.length === 0) return tempState;

        for (let i = 0; i < days; i++) {
            tempState.currentDayIndex++;
            if (tempState.currentDayIndex >= weekDays.length) {
                tempState.currentDayIndex = 0;
                tempState.currentScheduleIndex = (tempState.currentScheduleIndex + 1) % tempSchedules.length;
            }
        }
        return tempState;
    }

    function getCurrentSchedule() { return schedules[appState.currentScheduleIndex] || null; }
    function getCurrentDayName() { return weekDays[appState.currentDayIndex]; }

    // --- НАВІГАЦІЯ ТА ІНТЕРФЕЙС ---
    function toggleMenu() {
        const isOpen = menu.classList.toggle('open');
        overlay.classList.toggle('hidden', !isOpen);
    }

    function closeMenu() {
        menu.classList.remove('open');
        if (document.querySelectorAll('.modal:not(.hidden)').length === 0) {
            overlay.classList.add('hidden');
        }
    }
    
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        overlay.classList.add('hidden');
    }

    window.showSection = (sectionId) => {
        document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
        document.getElementById(sectionId).classList.remove('hidden');
        closeMenu();
        switch (sectionId) {
            case 'current': renderMainScreen(); break;
            case 'dayView': initializeDayView(); break;
            case 'all': renderAllSchedules(); break;
            case 'settings': renderSettings(); break;
        }
    };

    // --- ГОЛОВНИЙ ЕКРАН ---
    function updateClock() { document.getElementById('live-clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

    function renderMainScreen() {
        const schedule = getCurrentSchedule();
        const dayName = getCurrentDayName();
        const now = new Date();
        const container = document.getElementById('current');

        if (!schedule || !schedule.days || !schedule.days[dayName] || schedule.days[dayName].length === 0) {
            container.innerHTML = `<div class="main-screen-layout"><div class="current-status-container"><h1>Сьогодні уроків немає</h1><p>${schedule ? `Розклад: "${schedule.name}", день: ${dayName}` : "Створіть свій перший розклад"}</p></div></div>`;
            return;
        }

        const lessons = schedule.days[dayName];
        let currentLesson = null, prevLesson = null, nextLesson = null;
        const completedLessons = [];

        lessons.forEach((lesson, index) => {
            if (lesson.subjectName === "— Немає пари —") return;
            const start = new Date(now.toDateString() + ' ' + lesson.startTime);
            const duration = lesson.durationOverride || schedule.defaultDuration;
            const end = new Date(start.getTime() + duration * 60000);

            if (now >= start && now <= end) currentLesson = { ...lesson, start, end, index };
            if (now > end) {
                completedLessons.push({ ...lesson, end });
                if (!prevLesson || end > prevLesson.end) prevLesson = { ...lesson, end, index };
            }
            if (now < start && !nextLesson) nextLesson = { ...lesson, start, index };
        });
        
        if (!currentLesson && !nextLesson) {
            renderAfterHoursView(container, schedule, lessons);
            return;
        }

        container.innerHTML = `
            <div class="main-screen-layout">
                <div class="past-container"><p id="prevLesson" class="info-subtle"></p><div id="completed-lessons-list"></div></div>
                <div class="current-status-container"><h1 id="currentLesson"></h1><p id="timeInfo"></p><button class="join-btn hidden" id="joinBtn">Приєднатись</button></div>
                <div class="next-container"><p id="nextLesson" class="info-subtle"></p></div>
            </div>`;
        
        updatePastUI(prevLesson, completedLessons);
        updateCurrentUI(currentLesson, prevLesson, nextLesson, now);
        updateNextUI(nextLesson);
    }

    function renderAfterHoursView(container, todaySchedule, todayLessons) {
        const tomorrowState = calculateProjectedState(1, appState);
        const tomorrowSchedule = schedules[tomorrowState.currentScheduleIndex] || null;
        const tomorrowDayName = weekDays[tomorrowState.currentDayIndex];
        const tomorrowLessons = tomorrowSchedule?.days?.[tomorrowDayName] || [];

        const todayHtml = todayLessons.map(l => l.subjectName !== "— Немає пари —" ? `<li>${l.startTime} - ${l.subjectName}</li>` : '').join('');
        const tomorrowHtml = tomorrowLessons.map(l => l.subjectName !== "— Немає пари —" ? `<li>${l.startTime} - ${l.subjectName}</li>` : '').join('');

        container.innerHTML = `
            <h1>Уроки на сьогодні закінчились</h1>
            <div class="after-hours-view">
                <div class="day-summary">
                    <h3>Сьогодні (${todaySchedule.name})</h3>
                    <ul>${todayHtml || "<li>Уроків не було</li>"}</ul>
                </div>
                <div class="day-summary">
                    <h3>Завтра (${tomorrowSchedule ? tomorrowSchedule.name : 'N/A'})</h3>
                    <ul>${tomorrowHtml || "<li>Уроків не заплановано</li>"}</ul>
                </div>
            </div>`;
    }

    function updatePastUI(prevLesson, completedLessons) {
        document.getElementById('prevLesson').textContent = prevLesson ? `Попередній: ${prevLesson.subjectName} (закінчився о ${prevLesson.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : '';
        document.getElementById('completed-lessons-list').innerHTML = completedLessons.map(l => `<span>${l.subjectName} ✓</span>`).join(' ');
    }

    function updateCurrentUI(currentLesson, prevLesson, nextLesson, now) {
        const currentLessonElem = document.getElementById('currentLesson');
        const timeInfoElem = document.getElementById('timeInfo');
        const joinBtn = document.getElementById('joinBtn');
        if (currentLesson) {
            const timeLeft = Math.ceil((currentLesson.end - now) / 60000);
            currentLessonElem.textContent = currentLesson.subjectName;
            timeInfoElem.textContent = `До кінця: ${timeLeft} хв.`;
            const subject = subjects.find(s => s.name === currentLesson.subjectName);
            if (subject && subject.link) {
                joinBtn.classList.remove('hidden');
                joinBtn.onclick = () => window.open(subject.link, '_blank');
            } else { joinBtn.classList.add('hidden'); }
        } else {
            joinBtn.classList.add('hidden');
            if (nextLesson) {
                const breakEnd = nextLesson.start;
                const timeToNext = Math.ceil((breakEnd - now) / 60000);
                currentLessonElem.textContent = "Перерва";
                timeInfoElem.textContent = `Наступний урок через ${timeToNext} хв (о ${breakEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
            }
        }
    }

    function updateNextUI(nextLesson) {
        document.getElementById('nextLesson').textContent = nextLesson ? `Наступний: ${nextLesson.subjectName} (о ${nextLesson.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` : '';
    }
    
    // --- ПЕРЕГЛЯД РОЗКЛАДУ НА ДЕНЬ ---
    let dayViewContext = { scheduleIndex: 0, dayIndex: 0 };
    
    function initializeDayView() {
        dayViewContext = { scheduleIndex: appState.currentScheduleIndex, dayIndex: appState.currentDayIndex };
        renderDayView();
    }
    
    window.navigateDay = (direction) => {
        if(schedules.length === 0) return;
        dayViewContext.dayIndex += direction;
        if (dayViewContext.dayIndex >= weekDays.length) {
            dayViewContext.dayIndex = 0;
            dayViewContext.scheduleIndex = (dayViewContext.scheduleIndex + 1) % schedules.length;
        } else if (dayViewContext.dayIndex < 0) {
            dayViewContext.dayIndex = weekDays.length - 1;
            dayViewContext.scheduleIndex--;
            if (dayViewContext.scheduleIndex < 0) dayViewContext.scheduleIndex = schedules.length - 1;
        }
        renderDayView();
    }

    function renderDayView() {
        const schedule = schedules[dayViewContext.scheduleIndex];
        const dayName = weekDays[dayViewContext.dayIndex];
        const isCurrent = dayViewContext.scheduleIndex === appState.currentScheduleIndex && dayViewContext.dayIndex === appState.currentDayIndex;
        document.getElementById('dayViewTitle').textContent = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${isCurrent ? '(Сьогодні)' : ''}`;
        
        const container = document.getElementById('dayViewSchedule');
        if (!schedule || !schedule.days || !schedule.days[dayName] || schedule.days[dayName].length === 0) {
            container.innerHTML = `<div class="schedule-item">На цей день уроків не заплановано.</div>`;
            return;
        }
        container.innerHTML = schedule.days[dayName].map(lesson => {
            const isMissed = lesson.subjectName === "— Немає пари —";
            const duration = lesson.durationOverride || schedule.defaultDuration;
            const name = isMissed ? "Вікно" : lesson.subjectName;
            return `<div class="schedule-item ${isMissed ? 'missed' : ''}"><strong>${name}</strong><span>${lesson.startTime} (${duration} хв)</span></div>`;
        }).join('');
    }

    function handleDateChange(event) {
        const selectedDate = new Date(event.target.value);
        const systemStartDate = new Date(appState.systemStartDate);
        const diffTime = selectedDate.setHours(0,0,0,0) - systemStartDate.setHours(0,0,0,0);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) { alert("Вибір минулих дат ще не реалізовано."); return; }
        const initialState = { currentScheduleIndex: 0, currentDayIndex: 0 };
        const projectedState = calculateProjectedState(diffDays, initialState);
        dayViewContext = projectedState;
        renderDayView();
    }

    // --- УПРАВЛІННЯ РОЗКЛАДАМИ ---
    function renderAllSchedules() {
        const container = document.getElementById('allSchedules');
        if (schedules.length === 0) {
            container.innerHTML = `<p>У вас ще немає створених розкладів.</p>`;
            return;
        }
        container.innerHTML = schedules.map((schedule, index) => `
            <div class="schedule-card">
                <div class="info">
                    <strong>${schedule.name}</strong> ${index === appState.currentScheduleIndex ? ' <span class="type">АКТИВНИЙ</span>' : ''}
                    <span class="type">${schedule.type === 'permanent' ? 'Постійний' : 'Одноразовий'}</span>
                </div>
                <div class="actions">
                    <button class="success" onclick="openScheduleEditor(${index})">Редагувати</button>
                    <button class="danger" onclick="deleteSchedule(${index})">Видалити</button>
                </div>
            </div>
        `).join('');
    }

    window.deleteSchedule = (index) => {
        if (!confirm(`Ви впевнені, що хочете видалити розклад "${schedules[index].name}"?`)) return;
        schedules.splice(index, 1);
        if (appState.currentScheduleIndex === index) {
            appState.currentScheduleIndex = 0;
            appState.currentDayIndex = 0;
        } else if (appState.currentScheduleIndex > index) {
            appState.currentScheduleIndex--;
        }
        saveData();
        renderAllSchedules();
    }

    // --- РЕДАКТОР РОЗКЛАДУ ---


// --- РЕДАКТОР РОЗКЛАДУ ---
    let editingScheduleIndex = -1;
    let activeEditorDay = weekDays[0];

    window.openScheduleEditor = (index = -1) => {
        editingScheduleIndex = index;
        const modal = document.getElementById('scheduleEditorModal');
        const form = document.getElementById('scheduleForm');
        form.reset();

        if (index > -1) {
            const schedule = schedules[index];
            document.getElementById('scheduleEditorTitle').textContent = "Редагувати розклад";
            document.getElementById('scheduleName').value = schedule.name;
            document.getElementById('scheduleType').value = schedule.type;
            document.getElementById('scheduleDuration').value = schedule.defaultDuration;
            renderTimeGrid(schedule.timeGrid || []);
        } else {
            document.getElementById('scheduleEditorTitle').textContent = "Створити розклад";
            renderTimeGrid(['08:00', '09:35', '11:10']);
        }
        activeEditorDay = weekDays[0];
        renderDayTabs();
        renderLessonEditor();
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    window.closeScheduleEditor = () => {
        document.getElementById('scheduleEditorModal').classList.add('hidden');
        closeAllModals();
    }

    function renderTimeGrid(timeGrid) {
        const container = document.getElementById('timeGridContainer');
        container.innerHTML = timeGrid.map((time, i) => `
            <div class="time-grid-item">
                <label>Пара ${i + 1}:</label>
                <input type="time" value="${time}" required>
                <button type="button" class="danger" onclick="removeTimeFromGrid(this)">×</button>
            </div>
        `).join('');
    }

    window.addTimeToGrid = () => {
        document.getElementById('timeGridContainer').insertAdjacentHTML('beforeend', `
            <div class="time-grid-item">
                <label>Пара ${document.querySelectorAll('.time-grid-item').length + 1}:</label>
                <input type="time" value="12:00" required>
                <button type="button" class="danger" onclick="removeTimeFromGrid(this)">×</button>
            </div>
        `);
    }

    window.removeTimeFromGrid = (button) => {
        button.parentElement.remove();
        document.querySelectorAll('.time-grid-item label').forEach((label, i) => {
            label.textContent = `Пара ${i + 1}:`;
        });
    }

    function renderDayTabs() {
        const container = document.querySelector('.day-tabs');
        container.innerHTML = weekDays.map(day => `<div class="day-tab ${day === activeEditorDay ? 'active' : ''}" onclick="switchEditorDay('${day}')">${day.slice(0, 2)}</div>`).join('');
    }

    window.switchEditorDay = (day) => {
        activeEditorDay = day;
        renderDayTabs();
        renderLessonEditor();
    }

    function renderLessonEditor() {
        const container = document.getElementById('lesson-editor-container');
        const timeInputs = document.querySelectorAll('#timeGridContainer input[type="time"]');
        const subjectOptions = `<option value="— Немає пари —">— Немає пари —</option>` + subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        const schedule = editingScheduleIndex > -1 ? schedules[editingScheduleIndex] : null;
        const dayData = schedule?.days?.[activeEditorDay] || [];
        container.innerHTML = Array.from(timeInputs).map((input, i) => `
            <div class="lesson-row">
                <span class="time">${input.value || '??:??'}</span>
                <select>${subjectOptions}</select>
                <input type="number" placeholder="Трив-ть" title="Перевизначити тривалість (хв)">
            </div>
        `).join('');
        container.querySelectorAll('.lesson-row').forEach((row, i) => {
            const lessonData = dayData[i] || {};
            if (lessonData.subjectName) row.querySelector('select').value = lessonData.subjectName;
            if (lessonData.durationOverride) row.querySelector('input').value = lessonData.durationOverride;
        });
    }

    function handleScheduleSave(event) {
        event.preventDefault();
        const name = document.getElementById('scheduleName').value;
        const type = document.getElementById('scheduleType').value;
        const defaultDuration = parseInt(document.getElementById('scheduleDuration').value);
        const timeGrid = Array.from(document.querySelectorAll('#timeGridContainer input[type="time"]')).map(input => input.value);
        let newSchedule = { name, type, defaultDuration, timeGrid, days: {} };
        if (editingScheduleIndex > -1) newSchedule.days = schedules[editingScheduleIndex].days;
        const lessonsForDay = [];
        document.querySelectorAll('#lesson-editor-container .lesson-row').forEach((row, i) => {
            lessonsForDay.push({
                startTime: timeGrid[i],
                subjectName: row.querySelector('select').value,
                durationOverride: parseInt(row.querySelector('input').value) || null
            });
        });
        newSchedule.days[activeEditorDay] = lessonsForDay;
        if (editingScheduleIndex > -1) {
            schedules[editingScheduleIndex] = newSchedule;
        } else {
            schedules.push(newSchedule);
        }
        saveData();
        closeScheduleEditor();
        renderAllSchedules();
    }
    
    // --- АРХІВ ---
    window.openArchiveModal = () => {
        renderArchive();
        document.getElementById('archiveModal').classList.remove('hidden');
        overlay.classList.remove('hidden');
    }
    window.closeArchiveModal = () => {
        document.getElementById('archiveModal').classList.add('hidden');
        closeAllModals();
    }
    function renderArchive() {
        const container = document.getElementById('archiveList');
        if (archive.length === 0) {
            container.innerHTML = `<p>Архів порожній.</p>`;
            return;
        }
        container.innerHTML = archive.map((schedule, index) => `
            <div class="schedule-card">
                <div class="info"><strong>${schedule.name}</strong></div>
                <div class="actions">
                    <button onclick="restoreFromArchive(${index}, 'onetime')">Відновити (1 раз)</button>
                    <button class="success" onclick="restoreFromArchive(${index}, 'permanent')">Зробити постійним</button>
                    <button class="danger" onclick="deleteFromArchive(${index})">Видалити</button>
                </div>
            </div>
        `).join('');
    }
    window.restoreFromArchive = (index, type) => {
        const schedule = archive.splice(index, 1)[0];
        schedule.type = type;
        schedules.push(schedule);
        saveData();
        renderArchive();
        renderAllSchedules();
    }
    window.deleteFromArchive = (index) => {
        if (confirm("Видалити цей розклад назавжди?")) {
            archive.splice(index, 1);
            saveData();
            renderArchive();
        }
    }

    // --- НАЛАШТУВАННЯ ---
    function renderSettings() {
        renderSubjects();
        renderCurrentStateSelectors();
    }
    function renderSubjects() {
        const container = document.getElementById('subjectsList');
        container.innerHTML = subjects.map((sub, i) => `
            <div class="subject-item">
                <div class="info">${sub.name} <br> <small>${sub.link}</small></div>
                <div class="actions">
                    <button onclick="editSubject(${i})">Ред.</button> 
                    <button class="danger" onclick="deleteSubject(${i})">Вид.</button>
                </div>
            </div>`).join('');
    }
    window.addSubject = () => {
        const name = document.getElementById('newSubject').value.trim();
        const link = document.getElementById('newSubjectLink').value.trim();
        if (name && link) {
            subjects.push({name, link});
            document.getElementById('newSubject').value = '';
            document.getElementById('newSubjectLink').value = '';
            saveData();
            renderSubjects();
        }
    }
    window.editSubject = (index) => {
        const sub = subjects[index];
        const newName = prompt("Нова назва:", sub.name);
        const newLink = prompt("Нове посилання:", sub.link);
        if (newName) sub.name = newName;
        if (newLink) sub.link = newLink;
        saveData();
        renderSubjects();
    }
    window.deleteSubject = (index) => {
        if(confirm("Видалити предмет?")){
            subjects.splice(index, 1);
            saveData();
            renderSubjects();
        }
    }
    function renderCurrentStateSelectors() {
        const scheduleSelect = document.getElementById('currentScheduleSelect');
        const daySelect = document.getElementById('currentDaySelect');
        scheduleSelect.innerHTML = schedules.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
        daySelect.innerHTML = weekDays.map((d, i) => `<option value="${i}">${d}</option>`).join('');
        if (schedules.length > 0) {
            scheduleSelect.value = appState.currentScheduleIndex;
            daySelect.value = appState.currentDayIndex;
        }
    }
    window.setCurrentState = () => {
        const newScheduleIndex = parseInt(document.getElementById('currentScheduleSelect').value);
        const newDayIndex = parseInt(document.getElementById('currentDaySelect').value);
        if (!isNaN(newScheduleIndex) && !isNaN(newDayIndex)) {
            appState.currentScheduleIndex = newScheduleIndex;
            appState.currentDayIndex = newDayIndex;
            appState.systemStartDate = new Date().toISOString();
            appState.lastCheckDate = new Date().toISOString().split('T')[0];
            saveData();
            alert("Поточний стан оновлено! Відлік почнеться з цієї точки.");
        }
    }

    // --- ІМПОРТ/ЕКСПОРТ ---
    function exportData(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    window.exportSchedules = () => exportData(schedules, 'schedules.json');
    window.exportSubjects = () => exportData(subjects, 'subjects.json');
    function importData(file, callback) {
        if (!file) { alert("Будь ласка, виберіть файл."); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                callback(data);
            } catch (err) {
                alert("Помилка парсингу файлу. Переконайтесь, що він має правильний формат JSON.");
            }
        };
        reader.readAsText(file);
    }
    window.importSchedules = () => {
        importData(document.getElementById('importSchedulesFile').files[0], (data) => {
            if (Array.isArray(data)) {
                schedules = data;
                saveData();
                renderAllSchedules();
                alert("Розклади успішно імпортовано!");
            } else { alert("Файл розкладів має містити масив (список)."); }
        });
    }
    window.importSubjects = () => {
        importData(document.getElementById('importSubjectsFile').files[0], (data) => {
            if (Array.isArray(data)) {
                subjects = data;
                saveData();
                renderSubjects();
                alert("Предмети успішно імпортовано!");
            } else { alert("Файл предметів має містити масив (список)."); }
        });
    }

    // --- ЗАПУСК ДОДАТКУ ---
    initializeApp();
});
