(function () {
    var SESSION_KEY = 'con_exam_student';
    var RESULT_KEY = 'con_exam_result';
    var START_KEY = 'con_exam_started_at';
    var DURATION_SECONDS = 90 * 60;
    var isSubmitting = false;
    var currentQuestionIndex = 0;
    var examStarted = false;

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

    function getTotalQuestions() {
        return window.EXAM_QUESTIONS ? window.EXAM_QUESTIONS.length : 0;
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

        var totalEl = byId('totalQuestionsCount');
        if (totalEl) {
            totalEl.textContent = String(getTotalQuestions());
        }

        byId('logoutLink').addEventListener('click', function (event) {
            event.preventDefault();
            logout();
        });
    }

    function questionMarkup(question, index) {
        var html = '<div class="question-card' + (index === 0 ? ' active' : ' hidden') + '" data-index="' + index + '">';
        html += '<strong class="question-title">';
        html += '<span class="question-number">Q' + (index + 1) + '</span>';
        html += escapeHtml(question.question);
        html += '</strong>';

        ['A', 'B', 'C', 'D'].forEach(function (letter) {
            html += '<label class="option">';
            html += '<input type="radio" name="q' + question.id + '" value="' + letter + '">';
            html += '<span><strong>' + letter + '.</strong> ' + escapeHtml(question.options[letter]) + '</span>';
            html += '</label>';
        });

        html += '</div>';
        return html;
    }

    function updateProgress() {
        var total = getTotalQuestions();
        var current = currentQuestionIndex + 1;
        var progressLabel = byId('progressLabel');
        var progressFill = byId('progressFill');

        if (progressLabel) {
            progressLabel.textContent = 'Question ' + current + ' of ' + total;
        }

        if (progressFill) {
            progressFill.style.width = total > 0 ? ((current / total) * 100) + '%' : '0%';
        }
    }

    function showQuestion(index) {
        var cards = document.querySelectorAll('.question-card');
        cards.forEach(function (card, i) {
            card.classList.toggle('hidden', i !== index);
            card.classList.toggle('active', i === index);
        });

        currentQuestionIndex = index;
        updateProgress();
        updateNavButtons();
    }

    function updateNavButtons() {
        var prevBtn = byId('prevBtn');
        var nextBtn = byId('nextBtn');
        var submitBtn = byId('submitBtn');
        var total = getTotalQuestions();
        var isLast = currentQuestionIndex === total - 1;

        if (prevBtn) {
            prevBtn.disabled = currentQuestionIndex === 0;
        }

        if (nextBtn) {
            nextBtn.classList.toggle('hidden', isLast);
        }

        if (submitBtn) {
            submitBtn.classList.toggle('hidden', !isLast);
        }
    }

    function startExam() {
        examStarted = true;

        if (!sessionStorage.getItem(START_KEY)) {
            sessionStorage.setItem(START_KEY, String(Date.now()));
        }

        byId('startScreen').classList.add('hidden');
        byId('examScreen').classList.remove('hidden');
        byId('examToolbar').classList.remove('hidden');

        showQuestion(0);
        startTimer();
    }

    function initTest() {
        var student = requireLogin();
        if (!student) {
            return;
        }

        byId('studentName').textContent = student.name;
        byId('questions').innerHTML = window.EXAM_QUESTIONS.map(questionMarkup).join('');

        var startTotal = byId('startTotalQuestions');
        if (startTotal) {
            startTotal.textContent = String(getTotalQuestions());
        }

        byId('startExamBtn').addEventListener('click', startExam);

        byId('prevBtn').addEventListener('click', function () {
            if (currentQuestionIndex > 0) {
                showQuestion(currentQuestionIndex - 1);
            }
        });

        byId('nextBtn').addEventListener('click', function () {
            if (currentQuestionIndex < getTotalQuestions() - 1) {
                showQuestion(currentQuestionIndex + 1);
            }
        });

        byId('examForm').addEventListener('submit', function (event) {
            event.preventDefault();
            var autoSubmit = event.submitter && event.submitter.dataset.autoSubmit === 'true';
            if (!autoSubmit && !window.confirm('Are you sure you want to submit your examination?')) {
                return;
            }
            submitExam();
        });
    }

    function startTimer() {
        var timerDisplay = byId('timer');

        function tick() {
            if (!examStarted) {
                return;
            }

            var startedAt = Number(sessionStorage.getItem(START_KEY));
            var elapsed = Math.floor((Date.now() - startedAt) / 1000);
            var timeLeft = Math.max(DURATION_SECONDS - elapsed, 0);
            var minutes = Math.floor(timeLeft / 60);
            var seconds = timeLeft % 60;
            timerDisplay.textContent = minutes + ':' + String(seconds).padStart(2, '0');

            if (timeLeft <= 0) {
                window.alert("Time's up! Your examination is being submitted automatically.");
                submitExam(true);
                return;
            }

            window.setTimeout(tick, 1000);
        }

        tick();
    }

    function buildAnswerReview(answers) {
        return window.EXAM_QUESTIONS.map(function (question, index) {
            var selected = answers['q' + question.id] || '';
            var correct = question.correct || '';
            var status = 'Unscored';

            if (correct) {
                if (!selected) {
                    status = 'Unanswered';
                } else if (selected === correct) {
                    status = 'Correct';
                } else {
                    status = 'Wrong';
                }
            }

            return {
                number: index + 1,
                questionId: question.id,
                question: question.question,
                selected: selected,
                selectedText: selected ? question.options[selected] : 'Not answered',
                correct: correct,
                correctText: correct ? question.options[correct] : 'Not available',
                status: status
            };
        });
    }

    function calculateScore() {
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

        return {
            score: score,
            total: scoredTotal,
            totalQuestions: getTotalQuestions(),
            percentage: percentage,
            unscoredQuestions: unscoredQuestions,
            answers: answers,
            review: buildAnswerReview(answers)
        };
    }

    async function submitExam(isAuto) {
        if (isSubmitting) {
            return;
        }

        if (!examStarted && !isAuto) {
            window.alert('Please start the examination first.');
            return;
        }

        isSubmitting = true;

        var student = getStudent();
        var resultData = calculateScore();
        var submittedAt = new Date().toISOString();

        var result = {
            studentName: student ? student.name : '',
            username: student ? student.username : '',
            score: resultData.score,
            total: resultData.total,
            totalQuestions: resultData.totalQuestions,
            percentage: resultData.percentage,
            unscoredQuestions: resultData.unscoredQuestions,
            answers: resultData.answers,
            review: resultData.review,
            submittedAt: submittedAt
        };

        sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));

        try {
            var firebaseReady = window.ExamFirebase;
            var attempts = 0;
            while (!firebaseReady && attempts < 30) {
                await new Promise(function (resolve) {
                    window.setTimeout(resolve, 100);
                });
                firebaseReady = window.ExamFirebase;
                attempts++;
            }

            if (firebaseReady && typeof firebaseReady.saveResult === 'function') {
                await firebaseReady.saveResult(
                    result.studentName,
                    result.score,
                    result.total
                );
                window.alert('Your result has been submitted and saved successfully.');
            } else {
                window.alert('Result saved in browser, but Firebase could not be reached.');
            }
        } catch (error) {
            console.error('Firestore save failed:', error);
            window.alert('Result saved in browser, but cloud save failed. Please contact the administrator.');
        }

        sessionStorage.removeItem(START_KEY);
        window.location.href = 'result.html';
    }

    function downloadResultReport() {
        var result;
        try {
            result = JSON.parse(sessionStorage.getItem(RESULT_KEY));
        } catch (error) {
            result = null;
        }

        if (!result) {
            window.alert('No result data available to download.');
            return;
        }

        var lines = [];
        lines.push('ONLINE EXAMINATION SYSTEM - RESULT REPORT');
        lines.push('=========================================');
        lines.push('');
        lines.push('Student Name   : ' + (result.studentName || 'N/A'));
        lines.push('Username       : ' + (result.username || 'N/A'));
        lines.push('Score          : ' + result.score + ' / ' + result.total);
        lines.push('Percentage     : ' + result.percentage + '%');
        lines.push('Total Questions: ' + (result.totalQuestions || result.total));
        lines.push('Submitted At   : ' + (result.submittedAt || new Date().toISOString()));
        lines.push('');
        lines.push('DETAILED QUESTION REVIEW');
        lines.push('------------------------');

        (result.review || []).forEach(function (item) {
            lines.push('');
            lines.push('Q' + item.number + '. ' + item.question);
            lines.push('Your Answer    : ' + (item.selected ? item.selected + ') ' + item.selectedText : 'Not answered'));
            lines.push('Correct Answer : ' + (item.correct ? item.correct + ') ' + item.correctText : 'N/A'));
            lines.push('Status         : ' + item.status);
        });

        lines.push('');
        lines.push('--- End of Report ---');

        var blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        var safeName = (result.studentName || 'student').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');

        link.href = url;
        link.download = safeName + '_exam_result.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
        byId('percentage').textContent = percentage + '%';

        if (byId('totalQuestions')) {
            byId('totalQuestions').textContent = result.totalQuestions || result.total;
        }

        if (byId('correctCount') && result.review) {
            var correct = result.review.filter(function (item) { return item.status === 'Correct'; }).length;
            var wrong = result.review.filter(function (item) { return item.status === 'Wrong'; }).length;
            byId('correctCount').textContent = String(correct);
            byId('wrongCount').textContent = String(wrong);
        }

        if (byId('unscoredNote') && result.unscoredQuestions && result.unscoredQuestions.length) {
            byId('unscoredNote').textContent = 'Note: ' + result.unscoredQuestions.length + ' question(s) had no answer key and were not counted in scoring.';
        }

        var status = byId('status');
        var badge = byId('resultBadge');

        if (percentage >= 50) {
            status.textContent = 'Congratulations! You have passed the examination.';
            status.className = 'pass';
            if (badge) {
                badge.textContent = 'Passed';
                badge.className = 'result-badge pass';
            }
        } else {
            status.textContent = 'You did not meet the passing criteria. Better luck next time.';
            status.className = 'fail';
            if (badge) {
                badge.textContent = 'Not Passed';
                badge.className = 'result-badge fail';
            }
        }

        var downloadBtn = byId('downloadResultBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadResultReport);
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
        initLogout: initLogout,
        downloadResultReport: downloadResultReport
    };

    window.getAllResults = function () {
        if (window.ExamFirebase && typeof window.ExamFirebase.getAllResults === 'function') {
            return window.ExamFirebase.getAllResults();
        }
        console.warn('Firebase module not loaded. Open a page that includes firebase.js first.');
        return Promise.resolve();
    };
}());
