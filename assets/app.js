(function () {
    var SESSION_KEY = 'con_exam_student';
    var RESULT_KEY = 'con_exam_result';
    var START_KEY = 'con_exam_started_at';
    var DURATION_SECONDS = 90 * 60;
    var isSubmitting = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function getStudent() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch (error) {
            return null;
        }
    }

    function setStudent(student) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            name: student.name,
            username: student.username
        }));
    }

    function requireLogin() {
        var student = getStudent();
        if (!student) {
            window.location.replace('login.html');
            return null;
        }
        return student;
    }

    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(RESULT_KEY);
        sessionStorage.removeItem(START_KEY);
        window.location.replace('../index.html');
    }

    function initLogin() {
        var form = byId('loginForm');
        var message = byId('loginError');

        if (getStudent()) {
            window.location.replace('dashboard.html');
            return;
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var username = byId('username').value.trim();
            var password = byId('password').value.trim();
            var student = window.EXAM_STUDENTS.find(function (item) {
                return item.username === username && item.password === password;
            });

            if (!student) {
                message.textContent = 'Invalid username or password.';
                return;
            }

            setStudent(student);
            sessionStorage.removeItem(RESULT_KEY);
            sessionStorage.removeItem(START_KEY);
            window.location.href = 'dashboard.html';
        });
    }

    function initDashboard() {
        var student = requireLogin();
        if (!student) {
            return;
        }

        byId('studentName').textContent = student.name;
        byId('studentUsername').textContent = student.username;
        byId('logoutLink').addEventListener('click', function (event) {
            event.preventDefault();
            logout();
        });
    }

    function questionMarkup(question, index) {
        var html = '<div class="question">';
        html += '<strong class="question-title">Q' + (index + 1) + '. ' + escapeHtml(question.question) + '</strong>';
        ['A', 'B', 'C', 'D'].forEach(function (letter) {
            html += '<label class="option">';
            html += '<input type="radio" name="q' + question.id + '" value="' + letter + '" required>';
            html += '<span>' + letter + ') ' + escapeHtml(question.options[letter]) + '</span>';
            html += '</label>';
        });
        html += '</div>';
        return html;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[character];
        });
    }

    function initTest() {
        var student = requireLogin();
        if (!student) {
            return;
        }

        byId('studentName').textContent = student.name;
        byId('questions').innerHTML = window.EXAM_QUESTIONS.map(questionMarkup).join('');

        if (!sessionStorage.getItem(START_KEY)) {
            sessionStorage.setItem(START_KEY, String(Date.now()));
        }

        startTimer();

        byId('examForm').addEventListener('submit', function (event) {
            event.preventDefault();
            var autoSubmit = event.submitter && event.submitter.dataset.autoSubmit === 'true';
            if (!autoSubmit && !window.confirm('Are you sure you want to submit?')) {
                return;
            }
            submitExam();
        });
    }

    function startTimer() {
        var timerDisplay = byId('timer');

        function tick() {
            var startedAt = Number(sessionStorage.getItem(START_KEY));
            var elapsed = Math.floor((Date.now() - startedAt) / 1000);
            var timeLeft = Math.max(DURATION_SECONDS - elapsed, 0);
            var minutes = Math.floor(timeLeft / 60);
            var seconds = timeLeft % 60;
            timerDisplay.textContent = 'Time Left: ' + minutes + ':' + String(seconds).padStart(2, '0');

            if (timeLeft <= 0) {
                window.alert("Time's up! Your test is being submitted automatically.");
                submitExam();
                return;
            }

            window.setTimeout(tick, 1000);
        }

        tick();
    }

    async function submitExam() {
        if (isSubmitting) {
            return;
        }
        isSubmitting = true;

        var student = getStudent();
        var score = 0;
        var answers = {};
        var unscoredQuestions = [];
        var scoredTotal = 0;

        window.EXAM_QUESTIONS.forEach(function (question) {
            var selected = document.querySelector('input[name="q' + question.id + '"]:checked');
            answers['q' + question.id] = selected ? selected.value : '';

            if (!question.correct) {
                unscoredQuestions.push(question.id);
                return;
            }

            scoredTotal++;
            if (selected && selected.value === question.correct) {
                score++;
            }
        });

        var percentage = scoredTotal > 0 ? Math.round((score / scoredTotal) * 10000) / 100 : 0;
        var submittedAt = new Date().toISOString();
        var result = {
            score: score,
            total: scoredTotal,
            totalQuestions: window.EXAM_QUESTIONS.length,
            percentage: percentage,
            unscoredQuestions: unscoredQuestions,
            submittedAt: submittedAt
        };

        sessionStorage.setItem(RESULT_KEY, JSON.stringify({
            score: score,
            total: scoredTotal,
            totalQuestions: window.EXAM_QUESTIONS.length,
            percentage: percentage,
            unscoredQuestions: unscoredQuestions,
            submittedAt: submittedAt
        }));

        await submitResultToNetlify(student, result, answers);
        sessionStorage.removeItem(START_KEY);
        window.location.href = 'result.html';
    }

    async function submitResultToNetlify(student, result, answers) {
        var status = result.percentage >= 50 ? 'Pass' : 'Fail';
        var payload = {
            'form-name': 'exam-results',
            student_name: student ? student.name : '',
            username: student ? student.username : '',
            score: String(result.score),
            scored_total: String(result.total),
            total_questions: String(result.totalQuestions),
            percentage: String(result.percentage),
            status: status,
            unscored_questions: result.unscoredQuestions.join(', '),
            submitted_at: result.submittedAt,
            answers_json: JSON.stringify(answers)
        };

        Object.keys(answers).forEach(function (key) {
            payload[key] = answers[key];
        });

        try {
            await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(payload).toString()
            });
        } catch (error) {
            sessionStorage.setItem('con_exam_netlify_error', 'Result saved in browser, but Netlify submission failed.');
        }
    }

    function initResult() {
        var student = requireLogin();
        if (!student) {
            return;
        }

        var result;
        try {
            result = JSON.parse(sessionStorage.getItem(RESULT_KEY));
        } catch (error) {
            result = null;
        }

        if (!result) {
            window.location.replace('dashboard.html');
            return;
        }

        var percentage = typeof result.percentage === 'number'
            ? result.percentage
            : (result.total > 0 ? Math.round((result.score / result.total) * 10000) / 100 : 0);
        byId('studentName').textContent = student.name;
        byId('score').textContent = result.score + ' / ' + result.total;
        byId('percentage').textContent = percentage + ' %';

        if (byId('totalQuestions')) {
            byId('totalQuestions').textContent = result.totalQuestions || result.total;
        }

        if (byId('unscoredNote') && result.unscoredQuestions && result.unscoredQuestions.length) {
            byId('unscoredNote').textContent = 'Note: ' + result.unscoredQuestions.length + ' questions had no correct option in the provided answer key, so they were not counted in scoring.';
        }

        var status = byId('status');
        if (percentage >= 50) {
            status.textContent = 'Congratulations! You Passed';
            status.className = 'pass';
        } else {
            status.textContent = 'Better Luck Next Time';
            status.className = 'fail';
        }

        byId('logoutLink').addEventListener('click', function (event) {
            event.preventDefault();
            logout();
        });
    }

    function initLogout() {
        logout();
    }

    window.ExamApp = {
        initLogin: initLogin,
        initDashboard: initDashboard,
        initTest: initTest,
        initResult: initResult,
        initLogout: initLogout
    };
}());
