document.addEventListener('DOMContentLoaded', () => {
    // Глобальні змінні та DOM елементи
    const burger = document.querySelector('.burger');
    const menu = document.getElementById('menu');
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('lessonModal');
    const closeModalBtn = document.querySelector('.close-btn');
    const lessonForm = document.getElementById('lessonForm');
    const lessonSubjectSelect = document.getElementById('lessonSubject');

    let schedules = JSON.parse(localStorage.getItem('schedules')) || [];
    let subjects = JSON.parse(localStorage.getItem('subjects')) || [];
    let currentScheduleIndex = parseInt(localStorage.getItem('currentScheduleIndex')) || 0;
    let oneTimeSchedule = JSON.parse(localStorage.getItem('oneTimeSchedule')) || null;
    let settings = JSON.parse(localStorage.getItem('settings')) || { defaultDuration: 80, defaultPairs: 5 };
    
    // Змінні для редагування уроку
    let editingLesson = { day: null, index: -1 };

    // Збереження даних в localStorage
    function saveData() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
        localStorage.setItem('subjects', JSON.stringify(subjects));
        localStorage.setItem('settings', JSON.stringify(settings));
        localStorage.setItem('currentScheduleIndex', currentScheduleIndex);
        localStorage.setItem('oneTimeSchedule', JSON.stringify(oneTimeSchedule));
    }

    // --- Меню ---
    function toggleMenu() {
        const isOpen = menu.classList.toggle('open');
        overlay.classList.toggle('hidden', !isOpen);
    }

    function closeMenu() {
        menu.classList.remove('open');
        overlay.classList.add('hidden');
    }
    
    burger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', () => {
        closeMenu();
        hideModal();
    });

    // --- Навігація між секціями ---
    window.showSection = (sectionId) => {
        document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
        document.getElementById(sectionId).classList.remove('hidden');
        closeMenu();
        if (sectionId === 'week') renderWeekSchedule();
        if (sectionId === 'all') renderAllSchedules();
        if (sectionId === 'settings') renderSettings();
    };

    // --- Логіка розкладу ---
    function getCurrentSchedule() {
        if (oneTimeSchedule) return oneTimeSchedule;
        if (schedules.length === 0) return { days: {} };
        const now = new Date();
        // Логіка зміни тижнів, можна вдосконалити
        const weekNumber = Math.floor((now.getTime() / (1000 * 60 * 60 * 24 * 7)) % schedules.length);
        return schedules[currentScheduleIndex] || schedules[weekNumber];
    }

    function calculateLessonStatus() {
        const now = new Date();
        const day = now.toLocaleString('uk', { weekday: 'long' }).toLowerCase();
        const schedule = getCurrentSchedule();
        if (!schedule || !schedule.days) return;
        const lessons = schedule.days[day] || [];
        let currentLesson = null, prevLesson = null, nextLesson = null;

        lessons.forEach((lesson, i) => {
            const start = new Date(now.toDateString() + ' ' + lesson.startTime);
            const end = new Date(start.getTime() + lesson.duration * 60 * 1000);

            if (now >= start && now <= end) currentLesson = { ...lesson, index: i, endTime: end };
            if (now > end && (!prevLesson || end > prevLesson.endTime)) prevLesson = { ...lesson, endTime: end };
            if (now < start && (!nextLesson || start < nextLesson.startTimeDate)) nextLesson = { ...lesson, startTimeDate: start };
        });

        updateUI(currentLesson, prevLesson, nextLesson);
    }

    function updateUI(currentLesson, prevLesson, nextLesson) {
        const now = new Date();
        const joinBtn = document.getElementById('joinBtn');

        if (currentLesson) {
            const timeLeft = Math.floor((currentLesson.endTime - now) / 60000);
            document.getElementById('currentLesson').textContent = currentLesson.name;
            document.getElementById('timeInfo').textContent = `До кінця: ${timeLeft} хв. Початок: ${currentLesson.startTime}`;
            joinBtn.classList.remove('hidden');
            joinBtn.onclick = () => window.open(getSubjectLink(currentLesson.name), '_blank');
        } else {
            document.getElementById('currentLesson').textContent = 'Перерва';
            if (nextLesson) {
                const timeToNext = Math.floor((nextLesson.startTimeDate - now) / 60000);
                document.getElementById('timeInfo').textContent = `Наступний урок через ${timeToNext} хв.`;
            } else {
                document.getElementById('timeInfo').textContent = 'Сьогодні уроків немає';
            }
            joinBtn.classList.add('hidden');
        }
        document.getElementById('prevLesson').textContent = prevLesson ? `Попередній: ${prevLesson.name} (закінчився о ${prevLesson.endTime.toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })})` : '';
        document.getElementById('nextLesson').textContent = nextLesson ? `Наступний: ${nextLesson.name} (початок о ${nextLesson.startTime})` : '';
    }
    
    function getSubjectLink(subjectName) {
        const subject = subjects.find(s => s.name === subjectName);
        return subject ? subject.link : '';
    }

    // --- Рендеринг ---
    function renderWeekSchedule() {
        const schedule = getCurrentSchedule();
        const div = document.getElementById('weekSchedule');
        div.innerHTML = '';
        ['понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота', 'неділя'].forEach(day => {
            const dayLessons = schedule.days && schedule.days[day] ? schedule.days[day] : [];
            let dayHtml = `<h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>`;
            dayLessons.forEach((lesson, i) => {
                dayHtml += `<div class="schedule-item">
                    <span>${lesson.name} (${lesson.startTime}, ${lesson.duration} хв)</span>
                    <div>
                        <button onclick="window.editLessonModal('${day}', ${i})">Редагувати</button>
                        <button onclick="window.deleteLesson('${day}', ${i})">Видалити</button>
                    </div>
                </div>`;
            });
            dayHtml += `<button onclick="window.addLessonModal('${day}')">Додати урок</button>`;
            div.innerHTML += `<div class="schedule">${dayHtml}</div>`;
        });
    }

    window.renderAllSchedules = () => {
        const div = document.getElementById('allSchedules');
        div.innerHTML = '';
        schedules.forEach((schedule, i) => {
            div.innerHTML += `<div class="schedule"><h3>Розклад ${i + 1} 
                <button onclick="moveSchedule(${i}, -1)">↑</button> 
                <button onclick="moveSchedule(${i}, 1)">↓</button> 
                <button onclick="applyOneTime(${i})">Одноразово</button> 
                <button onclick="deleteSchedule(${i})">Видалити</button></h3>
            </div>`;
        });
    }

    // --- Модальне вікно для уроків ---
    function showModal() {
        populateSubjectsDropdown();
        updateLinkField();
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    function hideModal() {
        modal.classList.add('hidden');
        if (!menu.classList.contains('open')) {
            overlay.classList.add('hidden');
        }
        lessonForm.reset();
        editingLesson = { day: null, index: -1 };
    }
    
    closeModalBtn.addEventListener('click', hideModal);

    function populateSubjectsDropdown() {
        const select = lessonSubjectSelect;
        select.innerHTML = '';
        if (subjects.length === 0) {
            select.innerHTML = '<option disabled>Спочатку додайте предмети в налаштуваннях</option>';
            return;
        }
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.name;
            option.textContent = subject.name;
            select.appendChild(option);
        });
    }
    
    function updateLinkField() {
        const selectedSubjectName = lessonSubjectSelect.value;
        document.getElementById('lessonLink').value = getSubjectLink(selectedSubjectName);
    }
    
    lessonSubjectSelect.addEventListener('change', updateLinkField);

    window.addLessonModal = (day) => {
        document.getElementById('modalTitle').textContent = 'Додати урок';
        editingLesson = { day, index: -1 };
        document.getElementById('lessonDuration').value = settings.defaultDuration;
        showModal();
    }

    window.editLessonModal = (day, index) => {
        document.getElementById('modalTitle').textContent = 'Редагувати урок';
        editingLesson = { day, index };
        const schedule = getCurrentSchedule();
        const lesson = schedule.days[day][index];

        document.getElementById('lessonSubject').value = lesson.name;
        document.getElementById('lessonStartTime').value = lesson.startTime;
        document.getElementById('lessonDuration').value = lesson.duration;
        
        showModal();
    }
    
    lessonForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (subjects.length === 0) {
            alert('Будь ласка, додайте хоча б один предмет у налаштуваннях.');
            return;
        }
        
        const { day, index } = editingLesson;
        const schedule = getCurrentSchedule();
        if (!schedule.days) schedule.days = {};
        if (!schedule.days[day]) schedule.days[day] = [];

        const lessonData = {
            name: document.getElementById('lessonSubject').value,
            startTime: document.getElementById('lessonStartTime').value,
            duration: parseInt(document.getElementById('lessonDuration').value),
        };

        if (index === -1) {
            schedule.days[day].push(lessonData);
        } else {
            schedule.days[day][index] = lessonData;
        }
        
        schedule.days[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        saveData();
        renderWeekSchedule();
        hideModal();
    });

    window.deleteLesson = (day, index) => {
        if (confirm('Ви впевнені, що хочете видалити цей урок?')) {
            const schedule = getCurrentSchedule();
            schedule.days[day].splice(index, 1);
            saveData();
            renderWeekSchedule();
        }
    }


    // --- Керування розкладами ---
    window.addNewSchedule = () => {
        schedules.push({ days: {} });
        saveData();
        renderAllSchedules();
    }

    window.moveSchedule = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < schedules.length) {
            [schedules[index], schedules[newIndex]] = [schedules[newIndex], schedules[index]];
            saveData();
            renderAllSchedules();
        }
    }

    window.applyOneTime = (index) => {
        oneTimeSchedule = JSON.parse(JSON.stringify(schedules[index]));
        saveData();
        alert('Розклад застосовано одноразово');
    }

    window.deleteSchedule = (index) => {
        if (confirm('Видалити розклад?')) {
            schedules.splice(index, 1);
            if (currentScheduleIndex >= schedules.length) currentScheduleIndex = 0;
            saveData();
            renderAllSchedules();
        }
    }

    // --- Налаштування ---
    function renderSettings() {
        document.getElementById('defaultDuration').value = settings.defaultDuration;
        document.getElementById('defaultPairs').value = settings.defaultPairs;
        const div = document.getElementById('subjectsList');
        div.innerHTML = '';
        subjects.forEach((subject, i) => {
            div.innerHTML += `<div>${subject.name} (${subject.link}) <button onclick="editSubject(${i})">Редагувати</button> <button onclick="deleteSubject(${i})">Видалити</button></div>`;
        });
    }

    window.addSubject = () => {
        const nameInput = document.getElementById('newSubject');
        const linkInput = document.getElementById('newSubjectLink');
        const name = nameInput.value.trim();
        const link = linkInput.value.trim();
        if (name && link) {
            subjects.push({ name, link });
            nameInput.value = '';
            linkInput.value = '';
            saveData();
            renderSettings();
        }
    }

    window.editSubject = (index) => {
        const name = prompt('Назва предмету:', subjects[index].name) || subjects[index].name;
        const link = prompt('Посилання:', subjects[index].link) || subjects[index].link;
        subjects[index] = { name, link };
        saveData();
        renderSettings();
    }

    window.deleteSubject = (index) => {
        if (confirm('Видалити предмет?')) {
            subjects.splice(index, 1);
            saveData();
            renderSettings();
        }
    }
    
    document.getElementById('defaultDuration').addEventListener('change', (e) => {
        settings.defaultDuration = parseInt(e.target.value);
        saveData();
    });
    document.getElementById('defaultPairs').addEventListener('change', (e) => {
        settings.defaultPairs = parseInt(e.target.value);
        saveData();
    });

    // --- Експорт/Імпорт ---
    window.exportAllSchedules = () => {
        const data = JSON.stringify(schedules, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schedules.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    window.exportSelectedSchedule = () => {
        const data = JSON.stringify([getCurrentSchedule()], null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schedule.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    window.importSchedule = () => {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (Array.isArray(imported)) {
                        schedules.push(...imported);
                        saveData();
                        renderAllSchedules();
                        alert('Розклади успішно імпортовано!');
                    } else {
                        alert('Помилка: файл має містити масив розкладів.');
                    }
                } catch (error) {
                    alert('Помилка читання файлу. Переконайтесь, що це правильний JSON файл.');
                }
            };
            reader.readAsText(file);
        }
    }
    
    // --- Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // --- Ініціалізація ---
    setInterval(calculateLessonStatus, 30000);
    calculateLessonStatus();
    showSection('current'); // Показати головний екран при запуску
});
