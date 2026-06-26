Netlify upload instructions:

1. Open https://app.netlify.com/drop
2. Drag and drop the full con_nursing_exam folder.
3. Open the Netlify site URL and go to /student/login.html

Results:
After students submit the test, open:
Netlify Dashboard > Your Site > Forms > exam-results

There you will see student name, username, score, percentage, status, submitted time, and answers_json.

Old PHP-style links are also mapped:
/student/login.php opens /student/login.html
/student/dashboard.php opens /student/dashboard.html
/student/test.php opens /student/test.html
/student/result.php opens /student/result.html

Important:
Netlify free hosting does not run PHP or MySQL. This version is static HTML/CSS/JavaScript and uses Netlify Forms to collect results. Because it is static, credentials and answer keys are inside JavaScript files and can be inspected by advanced users. For a secure real exam, use PHP hosting with a database or a server backend.
