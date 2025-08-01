import { API } from './api.js';
import { LoadingIndicator, ToastNotification } from './components.js';

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async function() {
    // 현재 페이지가 로그인 페이지인지 확인
    const isLoginPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname.endsWith('/') || 
                        window.location.pathname === '';
    
    // 관리자 계정 초기화 (첫 실행 시에만 필요)
    try {
        await initAdmin();
    } catch (error) {
        console.log('관리자 계정이 이미 존재합니다.');
    }
    
    // 로그인 페이지일 때만 로그인 관련 UI 코드 실행
    if (isLoginPage) {
        // 탭 전환 기능
        const loginTab = document.getElementById('login-tab');
        const registerTab = document.getElementById('register-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const codeTab = document.getElementById('code-tab');
        const codeForm = document.getElementById('code-form');
        
        if (loginTab && registerTab && loginForm && registerForm) {
            // 로그인 탭 클릭
            loginTab.addEventListener('click', function() {
                loginTab.classList.add('active');
                registerTab.classList.remove('active');
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            });
            
            // 회원가입 탭 클릭
            registerTab.addEventListener('click', function() {
                registerTab.classList.add('active');
                loginTab.classList.remove('active');
                registerForm.classList.add('active');
                loginForm.classList.remove('active');
                
                if (codeTab && codeTab.classList) {
                    codeTab.classList.remove('active');
                    if (codeForm) codeForm.classList.remove('active');
                }
            });
            
            // 로그인 기능
            const loginBtn = document.getElementById('login-btn');
            const loginError = document.getElementById('login-error');
            
            // 로그인 처리 함수
            async function handleLogin() {
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
                
                try {
                    LoadingIndicator.show('로그인 중...');
                    const response = await API.login(email, password);
                    
                    console.log('로그인 성공, 토큰 확인:', sessionStorage.getItem('token'));
                    console.log('사용자 정보 확인:', sessionStorage.getItem('currentUser'));
                    
                    // API.login 함수에서 이미 토큰과 사용자 정보를 저장했으므로 여기서는 확인만 합니다
                    if (!sessionStorage.getItem('token')) {
                        console.error('토큰이 저장되지 않았습니다. 로그인에 실패했습니다.');
                        throw new Error('로그인 처리 중 오류가 발생했습니다.');
                    }
                    
                    // 대시보드로 리디렉션 전 잠시 대기 (세션 스토리지 저장 완료를 위해)
                    setTimeout(() => {
                        // 대시보드로 리디렉션
                        console.log('대시보드로 이동합니다.');
                        window.location.href = 'dashboard.html';
                    }, 500);
                } catch (error) {
                    LoadingIndicator.hide();
                    console.error('로그인 오류:', error);
                    
                    if (loginError) {
                        loginError.textContent = error.message || '로그인에 실패했습니다.';
                        loginError.style.display = 'block';
                    }
                }
            }
            
            // 로그인 버튼 클릭 이벤트
            if (loginBtn) {
                loginBtn.addEventListener('click', handleLogin);
            }
            
            // 로그인 폼에서 엔터키 입력 시 로그인 처리
            const loginEmailInput = document.getElementById('login-email');
            const loginPasswordInput = document.getElementById('login-password');
            
            function handleEnterKeyOnLogin(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleLogin();
                }
            }
            
            if (loginEmailInput) loginEmailInput.addEventListener('keypress', handleEnterKeyOnLogin);
            if (loginPasswordInput) loginPasswordInput.addEventListener('keypress', handleEnterKeyOnLogin);
            
            // 회원가입 기능
            const registerBtn = document.getElementById('register-btn');
            const registerError = document.getElementById('register-error');
            
            if (registerBtn) {
                registerBtn.addEventListener('click', async function() {
                    const email = document.getElementById('register-email').value;
                    const password = document.getElementById('register-password').value;
                    const name = document.getElementById('register-name').value;
                    const phone = document.getElementById('register-phone').value;
                    const agreeTerms = document.getElementById('agree-terms') ? document.getElementById('agree-terms').checked : false;
                    
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
                    
                    if (password.length < 8) {
                        if (registerError) {
                            registerError.textContent = '비밀번호는 최소 8자 이상이어야 합니다.';
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
                    
                    try {
                        LoadingIndicator.show('회원가입 진행 중...');
                        await API.register({ email, password, name, phone });
                        LoadingIndicator.hide();
                        
                        // 성공 시 로그인 폼으로 전환
                        loginTab.click();
                        document.getElementById('login-email').value = email;
                        
                        if (loginError) {
                            loginError.textContent = '회원가입이 완료되었습니다. 로그인해주세요.';
                            loginError.style.color = 'green';
                            loginError.style.display = 'block';
                        }
                        
                        ToastNotification.show('회원가입이 성공적으로 완료되었습니다.', 'success');
                    } catch (error) {
                        LoadingIndicator.hide();
                        if (registerError) {
                            registerError.textContent = error.message || '회원가입에 실패했습니다.';
                            registerError.style.display = 'block';
                        }
                    }
                });
            }
        }
    }
});

// 관리자 계정 초기화
async function initAdmin() {
    try {
        return await API.initAdmin();
    } catch (error) {
        console.log('관리자 계정 초기화 중 오류:', error);
        throw error;
    }
}

// 유효성 검사 함수
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    // 하이픈이 있든 없든 상관없는 유효성 검사
    return /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone);
}
