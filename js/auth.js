// 로컬 스토리지 함수들
function saveUser(user) {
    const users = getUsers();
    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));
}

function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}

function findUser(email) {
    const users = getUsers();
    return users.find(user => user.email === email);
}

function isValidPhone(phone) {
    // 하이픈이 있든 없든 상관없는 유효성 검사
    return /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 관리자 계정 초기화
function initAdmin() {
    if (!findUser('admin')) {
        saveUser({
            email: 'admin',
            password: 'admin123',
            name: '관리자',
            phone: '010-0000-0000',
            role: 'admin'
        });
    }
}

// 소스코드 로드 함수
async function loadSourceCode() {
    const sourceCodeArea = document.getElementById('source-code');
    if (sourceCodeArea) {
        sourceCodeArea.value = "로딩 중...";
        
        try {
            // 모든 파일 경로
            const files = [
                // HTML 파일
                { path: 'index.html', type: '-- HTML --' },
                { path: 'dashboard.html', type: '-- HTML --' },
                
                // CSS 파일
                { path: 'css/style.css', type: '-- CSS --' },
                { path: 'css/dashboard.css', type: '-- CSS --' },
                
                // JavaScript 파일
                { path: 'js/auth.js', type: '-- JavaScript --' },
                { path: 'js/dashboard.js', type: '-- JavaScript --' },
                
                // 백엔드 파일
                { path: 'worker/index.js', type: '-- Backend (Cloudflare Worker) --' },
                { path: 'worker/wrangler.toml', type: '-- Config --' }
            ];
            
            let allCode = '';
            
            for (const file of files) {
                try {
                    const response = await fetch(file.path);
                    const content = await response.text();
                    
                    allCode += `\n\n/* ==================== ${file.type} ${file.path} ==================== */\n\n`;
                    allCode += content;
                } catch (err) {
                    allCode += `\n\n/* Error loading ${file.path}: ${err.message} */\n\n`;
                }
            }
            
            sourceCodeArea.value = allCode;
        } catch (error) {
            sourceCodeArea.value = `소스코드 로딩 오류: ${error.message}`;
        }
    }
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initAdmin();
    
    // 탭 전환 기능
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    // 코드 탭 관련 요소 (있는 경우에만)
    const codeTab = document.getElementById('code-tab');
    const codeForm = document.getElementById('code-form');
    
    // 소스코드 영역이 있으면 자동으로 소스코드 로드
    const sourceCodeArea = document.getElementById('source-code');
    if (sourceCodeArea) {
        loadSourceCode();
    }
    
    // 로그인 탭 클릭
    loginTab.addEventListener('click', function() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        
        if (codeTab) {
            codeTab.classList.remove('active');
            if (codeForm) codeForm.classList.remove('active');
        }
    });
    
    // 회원가입 탭 클릭
    registerTab.addEventListener('click', function() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        
        if (codeTab) {
            codeTab.classList.remove('active');
            if (codeForm) codeForm.classList.remove('active');
        }
    });
    
    // 코드 탭 클릭 (있는 경우에만)
    if (codeTab && codeForm) {
        codeTab.addEventListener('click', function() {
            codeTab.classList.add('active');
            loginTab.classList.remove('active');
            registerTab.classList.remove('active');
            codeForm.classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.remove('active');
            
            // 소스코드 로드
            loadSourceCode();
        });
    }
    
    // 로그인 기능
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    
    loginBtn.addEventListener('click', function() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (loginError) loginError.style.display = 'none';
        
        if (!email || !password) {
            if (loginError) {
                loginError.textContent = '모든 필드를 입력해주세요.';
                loginError.style.display = 'block';
            }
            return;
        }
        
        const user = findUser(email);
        
        if (!user || user.password !== password) {
            if (loginError) {
                loginError.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
                loginError.style.display = 'block';
            }
            return;
        }
        
        // 로그인 성공 시 세션 스토리지에 사용자 정보 저장
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        // 대시보드로 리디렉션
        window.location.href = 'dashboard.html';
    });
    
    // 회원가입 기능
    const registerBtn = document.getElementById('register-btn');
    const registerError = document.getElementById('register-error');
    
    registerBtn.addEventListener('click', function() {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const name = document.getElementById('register-name').value;
        const phone = document.getElementById('register-phone').value;
        const agreeTerms = document.getElementById('agree-terms').checked;
        
        if (registerError) registerError.style.display = 'none';
        
        // 유효성 검사
        if (!email || !password || !name || !phone) {
            if (registerError) {
                registerError.textContent = '모든 필드를 입력해주세요.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        if (!isValidEmail(email)) {
            if (registerError) {
                registerError.textContent = '유효한 이메일 주소를 입력해주세요.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        if (password.length < 6) {
            if (registerError) {
                registerError.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        if (!isValidPhone(phone)) {
            if (registerError) {
                registerError.textContent = '유효한 전화번호를 입력해주세요.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        if (!agreeTerms) {
            if (registerError) {
                registerError.textContent = '개인정보 수집 및 이용에 동의해주세요.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        // 이메일 중복 확인
        if (findUser(email)) {
            if (registerError) {
                registerError.textContent = '이미 사용 중인 이메일입니다.';
                registerError.style.display = 'block';
            }
            return;
        }
        
        // 사용자 등록
        saveUser({
            email,
            password,
            name,
            phone,
            role: 'user'
        });
        
        // 성공 시 로그인 폼으로 전환
        loginTab.click();
        document.getElementById('login-email').value = email;
        
        if (loginError) {
            loginError.textContent = '회원가입이 완료되었습니다. 로그인해주세요.';
            loginError.style.color = 'green';
            loginError.style.display = 'block';
        }
    });
});
