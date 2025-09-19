document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНІ ЗМІННІ ТА СТАН ДОДАТКУ ---
    let schedules = [];
    let subjects = [];
    let archive = [];
    let appState = {
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
    }

    function loadData() {
        schedules = JSON.parse(localStorage.getItem('schedules')) || [];
        subjects = JSON.parse(localStorage.getItem('subjects')) || [];
        archive = JSON.parse(localStorage.getItem('archive')) || [];
        const savedState = JSON.parse(localStorage.getItem('appState'));
        if (savedState) {
            appState = savedState;
        }
    }

    function saveData() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
        localStorage.setItem('subjects', JSON.stringify(subjects));
        localStorage.setItem('archive', JSON.stringify(archive));
        localStorage.setItem('appState', JSON.stringify(appState));
        // Після будь-якого збереження оновлюємо головний екран
        renderMainScreen();
    }

    function setupEventListeners() {
        document.querySelector('.burger').addEventListener('click', toggleMenu);
        overlay.addEventListener('click', () => {
            closeMenu();
            closeAllModals();
        });
        document.getElementById('scheduleForm').addEventListener('submit', handleScheduleSave);
    }

    function startIntervals() {
        setInterval(renderMainScreen, 30000);
    }

    // --- ОСНОВНА ЛОГІКА СИСТЕМИ ---
    function checkForDailyUpdate() {
        const today = new Date().toISOString().split('T')[0];
        if (today > appState.lastCheckDate) {
            advanceDay();
            appState.lastCheckDate = today;
            saveData();
        }
    }

    function advanceDay() {
        if (schedules.length === 0) return;

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
                if (schedules.length === 0) {
                     appState.currentScheduleIndex = 0;
                } else if (appState.currentScheduleIndex >= schedules.length) {
                    appState.currentScheduleIndex = 0;
                }
            }
        }
    }

    function getCurrentSchedule() {
        return schedules[appState.currentScheduleIndex] || null;
    }

    function getCurrentDayName() {
        return weekDays[appState.currentDayIndex];
    }

    // --- НАВІГАЦІЯ ---
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

    function toggleMenu() {
        const isOpen = menu.classList.toggle('open');
        overlay.classList.toggle('hidden', isOpen);
    }

    function closeMenu() {
        menu.classList.remove('open');
        if (document.querySelector('.modal:not(.hidden)') === null) {
            overlay.classList.add('hidden');
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        overlay.classList.add('hidden');
    }

    // --- ГОЛОВНИЙ ЕКРАН ---
    function renderMainScreen() {
        const schedule = getCurrentSchedule();
        const dayName = getCurrentDayName();
        const now = new Date();

        if (!schedule || !schedule.days || !schedule.days[dayName] || schedule.days[dayName].length === 0) {
            document.getElementById('currentLesson').textContent = "Сьогодні уроків немає";
            document.getElementById('timeInfo').textContent = schedule ? `Розклад: "${schedule.name}", день: ${dayName}` : "Створіть свій перший розклад";
            document.getElementById('prevLesson').textContent = "";
            document.getElementById('nextLesson').textContent = "";
            document.getElementById('completed-lessons-list').innerHTML = "";
            document.getElementById('joinBtn').classList.add('hidden');
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

            if (now >= start && now <= end) {
                currentLesson = { ...lesson, start, end, index };
            }
            if (now > end) {
                completedLessons.push({ ...lesson, end });
                if (!prevLesson || end > prevLesson.end) {
                    prevLesson = { ...lesson, end, index };
                }
            }
            if (now < start && !nextLesson) {
                nextLesson = { ...lesson, start, index };
            }
        });
        
        updatePastUI(prevLesson, completedLessons);
        updateCurrentUI(currentLesson, prevLesson, nextLesson, now);
        updateNextUI(nextLesson);
    }

    function updatePastUI(prevLesson, completedLessons) {
        document.getElementById('prevLesson').textContent = prevLesson 
            ? `Попередній: ${prevLesson.subjectName} (${prevLesson.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`
            : '';
        document.getElementById('completed-lessons-list').innerHTML = completedLessons
            .map(l => `<span>${l.subjectName} ✓</span>`)
            .join(' ');
    }
    
    function updateCurrentUI(currentLesson, prevLesson, nextLesson, now) {
        const currentLessonElem = document.getElementById('currentLesson');
        const timeInfoElem = document.getElementById('timeInfo');
        const joinBtn = document.getElementById('joinBtn');

        if (currentLesson) {
            const timeLeft = Math.ceil((currentLesson.end - now) / 60000);
            currentLessonElem.textContent = currentLesson.subjectName;
            timeInfoElem.textContent = `До кінця: ${timeLeft} хв`;
            const subject = subjects.find(s => s.name === currentLesson.subjectName);
            if (subject && subject.link) {
                joinBtn.classList.remove('hidden');
                joinBtn.onclick = () => window.open(subject.link, '_blank');
            } else {
                joinBtn.classList.add('hidden');
            }
        } else {
            joinBtn.classList.add('hidden');
            if (nextLesson) {
                const breakStart = prevLesson ? prevLesson.end : now;
                const breakEnd = nextLesson.start;
                const breakDuration = Math.ceil((breakEnd - breakStart) / 60000);
                currentLessonElem.textContent = "Перерва";
                timeInfoElem.textContent = `~${breakDuration} хв (до ${breakEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
            } else {
                currentLessonElem.textContent = "Уроки закінчились";
                timeInfoElem.textContent = "Гарного відпочинку!";
            }
        }
    }

    function updateNextUI(nextLesson) {
        document.getElementById('nextLesson').textContent = nextLesson
            ? `Наступний: ${nextLesson.subjectName} (о ${nextLesson.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`
            : '';
    }

    // --- ПЕРЕГЛЯД РОЗКЛАДУ НА ДЕНЬ ---
    let dayViewContext = { scheduleIndex: 0, dayIndex: 0 };

    function initializeDayView() {
        dayViewContext = { scheduleIndex: appState.currentScheduleIndex, dayIndex: appState.currentDayIndex };
        renderDayView();
    }

    window.navigateDay = (direction) => {
        dayViewContext.dayIndex += direction;
        if (dayViewContext.dayIndex >= weekDays.length) dayViewContext.dayIndex = 0;
        if (dayViewContext.dayIndex < 0) dayViewContext.dayIndex = weekDays.length - 1;
        renderDayView();
    }

    function renderDayView() {
        const schedule = schedules[dayViewContext.scheduleIndex];
        const dayName = weekDays[dayViewContext.dayIndex];
        const isCurrent = dayViewContext.scheduleIndex === appState.currentScheduleIndex && dayViewContext.dayIndex === appState.currentDayIndex;
        document.getElementById('dayViewTitle').textContent = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${isCurrent ? '(Сьогодні)' : ''}`;
        
        const container = document.getElementById('dayViewSchedule');
        if (!schedule || !schedule.days || !schedule.days[dayName]) {
            container.innerHTML = `<p>На цей день уроків не заплановано.</p>`;
            return;
        }

        container.innerHTML = schedule.days[dayName].map(lesson => {
            const isMissed = lesson.subjectName === "— Немає пари —";
            const duration = lesson.durationOverride || schedule.defaultDuration;
            const name = isMissed ? "Вікно" : lesson.subjectName;

            return `<div class="schedule-item ${isMissed ? 'missed' : ''}">
                        <strong>${name}</strong>
                        <span>${lesson.startTime} (${duration} хв)</span>
                    </div>`;
        }).join('');
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
        // Оновити мітки
        document.querySelectorAll('.time-grid-item label').forEach((label, i) => {
            label.textContent = `Пара ${i + 1}:`;
        });
    }

    function renderDayTabs() {
        const container = document.querySelector('.day-tabs');
        container.innerHTML = weekDays.map(day => `
            <div class="day-tab ${day === activeEditorDay ? 'active' : ''}" onclick="switchEditorDay('${day}')">
                ${day.slice(0, 2)}
            </div>
        `).join('');
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

        container.innerHTML = Array.from(timeInputs).map((input, i) => {
            const lessonData = dayData[i] || {};
            return `
            <div class="lesson-row">
                <span class="time">${input.value || '??:??'}</span>
                <select>${subjectOptions}</select>
                <input type="number" placeholder="Трив-ть" title="Перевизначити тривалість (хв)">
            </div>
        `}).join('');
        
        // Встановлення значень для селектів і інпутів
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
        
        // Збираємо дані з поточного стану редактора (потрібно пройтись по всіх днях)
        // Для простоти, ми збережемо дані тільки з відкритого дня, якщо це новий розклад.
        // У повноцінному додатку тут потрібно було б тимчасово зберігати дані для кожного дня.
        if (editingScheduleIndex > -1) {
            newSchedule.days = schedules[editingScheduleIndex].days; // Копіюємо старі дні
        }

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
    window.closeArchiveModal = () => document.getElementById('archiveModal').classList.add('hidden');
    
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
            <div>${sub.name} (${sub.link}) 
                <button onclick="editSubject(${i})">Ред.</button> 
                <button class="danger" onclick="deleteSubject(${i})">Вид.</button>
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

        scheduleSelect.value = appState.currentScheduleIndex;
        daySelect.value = appState.currentDayIndex;
    }
    
    window.setCurrentState = () => {
        appState.currentScheduleIndex = parseInt(document.getElementById('currentScheduleSelect').value);
        appState.currentDayIndex = parseInt(document.getElementById('currentDaySelect').value);
        saveData();
        alert("Поточний стан оновлено!");
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
            } else {
                alert("Файл розкладів має містити масив (список).");
            }
        });
    }
    window.importSubjects = () => {
        importData(document.getElementById('importSubjectsFile').files[0], (data) => {
            if (Array.isArray(data)) {
                subjects = data;
                saveData();
                renderSubjects();
                alert("Предмети успішно імпортовано!");
            } else {
                alert("Файл предметів має містити масив (список).");
            }
        });
    }

    // --- ЗАПУСК ДОДАТКУ ---
    initializeApp();
});
