import { API } from './api.js';
import { LoadingIndicator, ToastNotification, ConfirmDialog, Pagination, SearchFilter, Calendar } from './components.js';

// 전역 변수들
let currentUser = null;
let appointments = [];
let customers = [];
let staffMembers = [];
let sales = [];
let currentDate = new Date(); // 현재 날짜로 초기화
let currentView = 'day'; // day, week, month
let selectedStaffId = 'all';
let isLoading = false;

// 매출 차트
let salesChart = null;
let chartInitialized = false;

// 매출 기간 라벨
const periodLabels = {
    'today': '오늘의 시간별 매출',
    'thisMonth': '이번 달 일별 매출',
    'lastMonth': '지난 달 일별 매출',
    'threeMonths': '최근 3개월 월별 매출',
    'sixMonths': '최근 6개월 월별 매출',
    'year': '최근 12개월 월별 매출'
};

// 기본 알림톡 템플릿 정의
let alimtalkTemplates = {
    reservation: '안녕하세요, {{매장명}}입니다.\n{{보호자명}} 고객님, {{예약날짜}}에 {{반려동물명}}의 미용 예약이 완료되었습니다.\n문의사항은 {{매장번호}}로 연락주세요.',
    reminder: '안녕하세요, {{매장명}}입니다.\n{{보호자명}} 고객님, 내일 {{예약날짜}}에 {{반려동물명}}의 미용 예약이 있습니다.\n변경사항이 있으시면 {{매장번호}}로 연락주세요.',
    completed: '안녕하세요, {{매장명}}입니다.\n{{보호자명}} 고객님, {{반려동물명}}의 미용이 완료되었습니다.\n이용해 주셔서 감사합니다.'
};

// 로컬 스토리지에서 알림톡 템플릿 로드
try {
    const savedTemplates = localStorage.getItem('alimtalkTemplates');
    if (savedTemplates) {
        alimtalkTemplates = JSON.parse(savedTemplates);
    }
} catch (error) {
    console.error('알림톡 템플릿 로드 중 오류:', error);
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 로그인 상태 확인
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.log('토큰이 없습니다. 로그인 페이지로 이동합니다.');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('대시보드 초기화 중...');
        
        // 네트워크 상태 확인
        initNetworkStatus();
        
        // 로딩 애니메이션
        LoadingIndicator.show('데이터를 불러오는 중...');
        
        // 현재 사용자 정보 확인
        const currentUserStr = sessionStorage.getItem('currentUser');
        if (!currentUserStr) {
            console.error('사용자 정보가 없습니다. 토큰은 있지만 사용자 정보가 없습니다.');
            // 사용자 정보를 조회하여 업데이트
            try {
                const userResponse = await API.getMe();
                if (!userResponse.success || !userResponse.user) {
                    throw new Error('사용자 정보를 가져올 수 없습니다.');
                }
                
                sessionStorage.setItem('currentUser', JSON.stringify(userResponse.user));
                console.log('사용자 정보를 API에서 가져와 업데이트했습니다.');
            } catch (error) {
                console.error('사용자 정보 조회 오류:', error);
                // 토큰 삭제 및 로그인 페이지로 이동
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('tokenExpires');
                window.location.href = 'index.html';
                return;
            }
        }
        
        // 데이터 초기화
        await initData();
        
        // Chart.js 초기화
        initChartJS();
        
        // 사이드바 초기화
        initSidebar();
        
        // 이벤트 리스너 초기화
        initEventListeners();
        
        // 달력 뷰 초기화
        initCalendarView();
        
        // 로딩 애니메이션 숨기기
        LoadingIndicator.hide();
    } catch (error) {
        console.error('대시보드 초기화 오류:', error);
        LoadingIndicator.hide();
        ToastNotification.show('대시보드를 불러오는 중 오류가 발생했습니다.', 'error');
    }
});

// 네트워크 상태 감지 초기화
function initNetworkStatus() {
    // 오프라인 배너 생성은 유지하되 기능 비활성화
    const offlineBanner = document.createElement('div');
    offlineBanner.id = 'offline-banner';
    offlineBanner.className = 'offline-banner';
    offlineBanner.innerHTML = `
        <div class="offline-content">
            <i class="fas fa-wifi"></i>
            <span>인터넷 연결이 끊겼습니다. 일부 기능이 제한될 수 있습니다.</span>
        </div>
    `;
    
    document.body.appendChild(offlineBanner);
    
    // 초기 상태는 숨김 처리 (오프라인 배너를 완전히 숨김)
    offlineBanner.style.display = 'none';
    offlineBanner.classList.remove('show');
    
    // 오프라인 감지는 실제 네트워크 이벤트에만 의존하도록 수정
    window.addEventListener('offline', () => {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.style.display = 'block';
            banner.classList.add('show');
        }
    });
    
    window.addEventListener('online', () => {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            setTimeout(() => {
                banner.classList.remove('show');
                setTimeout(() => {
                    banner.style.display = 'none';
                }, 300);
            }, 1000);
        }
    });
    
    // 실시간 연결 확인 기능 비활성화
}

// 데이터 초기화 (API에서 데이터 가져오기)
async function initData() {
    try {
        isLoading = true;
        
        // 직원 데이터 로드
        try {
            const staffResponse = await API.getStaff();
            staffMembers = staffResponse.staffMembers || [];
        } catch (error) {
            console.warn('직원 데이터 로드 실패, 기본 데이터 사용:', error);
            // 기본 직원 데이터 설정
            staffMembers = [
                { id: 'staff1', name: '김디자이너', role: 'staff' },
                { id: 'staff2', name: '이디자이너', role: 'staff' },
                { id: 'admin1', name: '관리자', role: 'admin' }
            ];
        }
        
        // 고객 데이터 로드 (첫 페이지만)
        try {
            const customersResponse = await API.getCustomers(1, 50);
            customers = customersResponse.customers || [];
        } catch (error) {
            console.warn('고객 데이터 로드 실패, 기본 데이터 사용:', error);
            // 기본 고객 데이터 설정
            customers = [];
        }
        
        // 예약 데이터 로드 (오늘 날짜)
        const todayStr = formatDate(new Date());
        try {
            const appointmentsResponse = await API.getAppointmentsByDate(todayStr);
            appointments = appointmentsResponse.appointments || [];
        } catch (error) {
            console.warn('예약 데이터 로드 실패, 기본 데이터 사용:', error);
            // 기본 예약 데이터 설정
            appointments = [];
        }
        
        // 매출 데이터 로드 (오늘 날짜)
        try {
            const salesResponse = await API.getSalesByPeriod(todayStr, todayStr);
            sales = salesResponse.sales || [];
        } catch (error) {
            console.warn('매출 데이터 로드 실패, 기본 데이터 사용:', error);
            // 기본 매출 데이터 설정
            sales = [];
        }
        
        isLoading = false;
    } catch (error) {
        isLoading = false;
        console.error('데이터 초기화 중 오류:', error);
        // 오류가 발생해도 기본 데이터로 계속 진행
        console.log('기본 데이터로 계속 진행합니다.');
    }
}

// Chart.js 초기화 함수
function initChartJS() {
    if (window.Chart) {
        // Chart.js 글로벌 설정
        Chart.defaults.color = '#636363';
        Chart.defaults.font.family = "'Noto Sans KR', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        Chart.defaults.font.size = 12;
        
        // 캔버스 픽셀 비율 설정 (레티나 디스플레이 대응)
        Chart.defaults.devicePixelRatio = 2;
        
        // 반응형 설정
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        
        // 툴팁 스타일링
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        Chart.defaults.plugins.tooltip.titleColor = '#333';
        Chart.defaults.plugins.tooltip.bodyColor = '#666';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 0, 0, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 6;
        Chart.defaults.plugins.tooltip.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
        Chart.defaults.plugins.tooltip.displayColors = true;
        Chart.defaults.plugins.tooltip.usePointStyle = true;
        Chart.defaults.plugins.tooltip.position = 'nearest';
        
        // 애니메이션 설정
        Chart.defaults.animation.duration = 800;
        Chart.defaults.animation.easing = 'easeOutQuart';
        
        // 범례 스타일링
        Chart.defaults.plugins.legend.position = 'top';
        Chart.defaults.plugins.legend.align = 'center';
        Chart.defaults.plugins.legend.labels.boxWidth = 16;
        Chart.defaults.plugins.legend.labels.padding = 16;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        
        console.log('Chart.js 초기화 완료');
    } else {
        console.warn('Chart.js가 로드되지 않았습니다.');
    }
}

// 사이드바 이벤트 리스너
function initSidebar() {
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    const pages = document.querySelectorAll('.page');
    const header = document.querySelector('.header-title h1');
    
    menuItems.forEach(item => {
        if (!item.dataset.page) return;
        
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (isLoading) return; // 로딩 중이면 이벤트 무시
            
            // 활성 메뉴 업데이트
            menuItems.forEach(menu => menu.parentElement.classList.remove('active'));
            item.parentElement.classList.add('active');
            
            // 페이지 변경
            const pageName = item.dataset.page;
            pages.forEach(page => {
                if (page.id === `${pageName}-page`) {
                    page.classList.add('active');
                    header.textContent = item.querySelector('.menu-text').textContent.trim();
                } else {
                    page.classList.remove('active');
                }
            });
            
            // 로딩 표시
            LoadingIndicator.show('데이터를 불러오는 중...');
            
            try {
                // 페이지별 초기화
                if (pageName === 'appointments') {
                    await loadCalendar();
                } else if (pageName === 'customers') {
                    await renderCustomersTable();
                } else if (pageName === 'sales') {
                    await renderSalesData('today');
                } else if (pageName === 'settings') {
                    await renderAccountsTable();
                }
            } catch (error) {
                ToastNotification.show(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
            } finally {
                LoadingIndicator.hide();
            }
        });
    });

    // 로그아웃 버튼 이벤트
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    
    // 헤더의 로그아웃 버튼도 동일하게 처리
    const headerLogoutBtn = document.getElementById('header-logout-btn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
}

// 로그아웃 처리
async function handleLogout() {
    const confirmed = await ConfirmDialog.show({
        title: '로그아웃',
        message: '정말 로그아웃하시겠습니까?',
        confirmText: '로그아웃',
        cancelText: '취소',
        type: 'info'
    });
    
    if (confirmed) {
        API.logout();
    }
}

// 모든 이벤트 리스너 초기화
function initEventListeners() {
    // 예약 관리 페이지 이벤트
    initAppointmentEvents();
    
    // 고객 관리 페이지 이벤트
    initCustomerEvents();
    
    // 매출 관리 페이지 이벤트
    initSalesEvents();
    
    // 설정 페이지 이벤트
    initSettingsEvents();
    
    // 캘린더 네비게이션 버튼 이벤트
    const prevNavBtn = document.getElementById('prev-nav');
    const nextNavBtn = document.getElementById('next-nav');
    const todayBtn = document.getElementById('today-btn');
    
    if (prevNavBtn) {
        prevNavBtn.addEventListener('click', () => navigateCalendar(-1));
    }
    
    if (nextNavBtn) {
        nextNavBtn.addEventListener('click', () => navigateCalendar(1));
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', navigateToToday);
        console.log('오늘 버튼 이벤트 리스너 등록 완료');
    }
    
    // 모달 닫기 버튼
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // 매출 등록 폼 제출
    document.getElementById('sale-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // 고객 목록이 비어있는 경우 다시 로드
            if (!customers || customers.length === 0) {
                LoadingIndicator.show('고객 정보를 불러오는 중...');
                const customersResponse = await API.getCustomers(1, 100);
                customers = customersResponse.customers || [];
                LoadingIndicator.hide();
            }
            
            saveSaleFromForm();
        } catch (error) {
            console.error('고객 정보 로드 중 오류:', error);
            ToastNotification.show('고객 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    });
    
    // 매출 등록 취소 버튼
    document.getElementById('cancel-sale-btn').addEventListener('click', () => {
        document.getElementById('sale-modal').style.display = 'none';
    });
}

// 예약관리 페이지 이벤트
function initAppointmentEvents() {
    // 예약 저장
    const appointmentForm = document.getElementById('appointment-form');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const formData = new FormData(appointmentForm);
                const appointmentData = Object.fromEntries(formData.entries());
                
                // 서비스 선택 처리
                const selectedServices = Array.from(document.querySelectorAll('.service-btn.active'))
                    .map(btn => btn.dataset.service);
                appointmentData.services = selectedServices;
                
                // 반려동물 정보 처리
                const pets = Array.from(document.querySelectorAll('.pet-container')).map(container => {
                    return {
                        name: container.querySelector('[name^="pet_name"]').value,
                        breed: container.querySelector('[name^="pet_breed"]').value,
                        age: container.querySelector('[name^="pet_age"]').value,
                        weight: container.querySelector('[name^="pet_weight"]').value
                    };
                });
                appointmentData.pets = pets;
                
                await API.saveAppointment(appointmentData);
                ToastNotification.show('예약이 저장되었습니다.', 'success');
                closeModal('appointment-modal');
                await loadCalendar();
            } catch (error) {
                console.error('예약 저장 실패:', error);
                ToastNotification.show('예약 저장에 실패했습니다.', 'error');
            }
        });
    }

    // 예약 상태 변경
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.appointment-status-btn')) {
            try {
                const appointmentId = e.target.dataset.id;
                const newStatus = e.target.dataset.status;
                await API.updateAppointmentStatus(appointmentId, newStatus);
                ToastNotification.show('예약 상태가 변경되었습니다.', 'success');
                await loadCalendar();
            } catch (error) {
                console.error('예약 상태 변경 실패:', error);
                ToastNotification.show('예약 상태 변경에 실패했습니다.', 'error');
            }
        }
    });

    // 예약 삭제
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.appointment-delete-btn')) {
            try {
                const appointmentId = e.target.dataset.id;
                const confirmed = await ConfirmDialog.show('예약 삭제', '정말로 이 예약을 삭제하시겠습니까?');
                
                if (confirmed) {
                    await API.deleteAppointment(appointmentId);
                    ToastNotification.show('예약이 삭제되었습니다.', 'success');
                    await loadCalendar();
                }
            } catch (error) {
                console.error('예약 삭제 실패:', error);
                ToastNotification.show('예약 삭제에 실패했습니다.', 'error');
            }
        }
    });

    // 서비스 버튼 토글 및 종료시간 자동 계산
    document.addEventListener('click', (e) => {
        if (e.target.matches('.service-btn')) {
            // 기존 모든 버튼 비활성화
            document.querySelectorAll('.service-btn').forEach(btn => btn.classList.remove('active'));
            
            // 클릭한 버튼 활성화
            e.target.classList.add('active');
            
            // 서비스 이름과 duration 속성 가져오기
            const service = e.target.dataset.service;
            const duration = parseInt(e.target.dataset.duration) || 30; // 기본값 30분
            
            // hidden input에 서비스 이름 저장
            const selectedServiceInput = document.getElementById('selected-service');
            if (selectedServiceInput) {
                selectedServiceInput.value = service;
            }
            
            // 종료 시간 업데이트
            updateEndTime(duration);
        }
    });

    // 시간 선택 처리
    const startTimeInput = document.getElementById('appointment-start-time');
    const endTimeInput = document.getElementById('appointment-end-time');
    const durationSelect = document.getElementById('appointment-duration');

    if (startTimeInput && endTimeInput && durationSelect) {
        startTimeInput.addEventListener('change', () => {
            updateEndTime(parseInt(durationSelect.value));
        });

        durationSelect.addEventListener('change', () => {
            updateEndTime(parseInt(durationSelect.value));
        });
    }
    
    // 알림톡 옵션 변경 이벤트
    const alimtalkOptions = document.querySelectorAll('input[name="alimtalk-option"]');
    alimtalkOptions.forEach(option => {
        option.addEventListener('change', function() {
            // 모든 미리보기 숨기기
            document.querySelectorAll('.alimtalk-preview').forEach(preview => {
                preview.style.display = 'none';
            });
            
            // 선택된 옵션의 미리보기만 표시
            if (this.value !== 'none') {
                const previewEl = document.getElementById(`alimtalk-${this.value}-preview`);
                if (previewEl) {
                    previewEl.style.display = 'block';
                }
            }
        });
    });
    
    // 알림톡 수정 버튼 이벤트
    const editAlimtalkBtn = document.getElementById('edit-alimtalk-btn');
    if (editAlimtalkBtn) {
        editAlimtalkBtn.addEventListener('click', openAlimtalkEditModal);
    }
    
    // 신규 예약 버튼
    const newAppointmentBtn = document.getElementById('new-appointment-btn');
    if (newAppointmentBtn) {
        newAppointmentBtn.addEventListener('click', () => {
            openAppointmentModal(null, null, currentDate);
        });
    }
    
    // 반려동물 추가 버튼
    const addPetBtn = document.getElementById('add-pet-btn');
    if (addPetBtn) {
        addPetBtn.addEventListener('click', addPetForm);
    }
    
    // 예약 취소 버튼
    const cancelAppointmentBtn = document.getElementById('cancel-appointment-btn');
    if (cancelAppointmentBtn) {
        cancelAppointmentBtn.addEventListener('click', () => {
            document.getElementById('appointment-modal').style.display = 'none';
        });
    }
}

// 고객관리 페이지 이벤트
function initCustomerEvents() {
    // 신규 고객 등록 버튼
    document.getElementById('new-customer-btn').addEventListener('click', () => {
        openCustomerModal();
    });
    
    // 고객 폼 제출
    document.getElementById('customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCustomerFromForm();
    });
    
    // 취소 버튼
    document.getElementById('cancel-customer-btn').addEventListener('click', () => {
        document.getElementById('customer-modal').style.display = 'none';
    });
    
    // 반려동물 추가 버튼
    document.getElementById('customer-add-pet-btn').addEventListener('click', addCustomerPetForm);
    
    // 고객 검색 이벤트
    document.getElementById('search-btn').addEventListener('click', () => {
        const searchTerm = document.getElementById('customer-search').value;
        searchCustomers(searchTerm);
    });
    
    // 엔터키 검색 지원
    document.getElementById('customer-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('search-btn').click();
        }
    });
    
    // 엑셀 양식 다운로드 버튼 이벤트
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadCustomerTemplate);
    }
    
    // 엑셀 일괄등록 버튼 이벤트
    const importCustomersBtn = document.getElementById('import-customers-btn');
    if (importCustomersBtn) {
        importCustomersBtn.addEventListener('click', () => {
            // 파일 업로드 다이얼로그 표시
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv,.xlsx,.xls';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        LoadingIndicator.show('고객 데이터를 업로드 중입니다...');
                        
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        // API 호출
                        const response = await API.importCustomers(formData);
                        
                        if (response && response.success) {
                            // 고객 데이터를 로컬 스토리지에 저장
                            if (response.customers && response.customers.length > 0) {
                                // 기존 고객 데이터 가져오기
                                const existingCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
                                
                                // 새 고객 데이터 병합 (중복 제거)
                                const mergedCustomers = [...existingCustomers];
                                
                                response.customers.forEach(newCustomer => {
                                    // 중복 고객 확인 (전화번호로 비교)
                                    const existingIndex = mergedCustomers.findIndex(c => c.phone === newCustomer.phone);
                                    
                                    if (existingIndex !== -1) {
                                        // 기존 고객 정보 업데이트
                                        mergedCustomers[existingIndex] = {
                                            ...mergedCustomers[existingIndex],
                                            ...newCustomer,
                                            updatedAt: new Date().toISOString()
                                        };
                                    } else {
                                        // 새 고객 추가
                                        mergedCustomers.push({
                                            ...newCustomer,
                                            id: newCustomer.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString()
                                        });
                                    }
                                });
                                
                                // 로컬 스토리지에 저장
                                localStorage.setItem('customers', JSON.stringify(mergedCustomers));
                            }
                            
                            ToastNotification.show(`${response.customers ? response.customers.length : 0}명의 고객 정보가 성공적으로 등록되었습니다.`, 'success');
                            
                            // 테이블 새로고침
                            renderCustomersTable();
                        } else {
                            ToastNotification.show('고객 정보 등록 중 오류가 발생했습니다.', 'error');
                        }
                    } catch (error) {
                        console.error('고객 일괄등록 중 오류:', error);
                        ToastNotification.show('고객 정보 등록 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'), 'error');
                    } finally {
                        LoadingIndicator.hide();
                    }
                }
                document.body.removeChild(fileInput);
            });

            fileInput.click();
        });
    }
}

// 매출관리 페이지 이벤트
function initSalesEvents() {
    // 기간 선택 버튼
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 기존 활성화된 버튼 비활성화
            periodBtns.forEach(b => b.classList.remove('active'));
            
            // 클릭한 버튼 활성화
            btn.classList.add('active');
            
            // 선택한 기간의 매출 데이터 렌더링
            renderSalesData(btn.dataset.period);
        });
    });
    
    // 담당자 선택 드롭다운
    document.getElementById('staff-select').addEventListener('change', () => {
        const activeBtn = document.querySelector('.period-btn.active');
        renderSalesData(activeBtn.dataset.period);
    });
}

// 설정 페이지 이벤트
function initSettingsEvents() {
    // 계정 추가 버튼
    document.getElementById('new-account-btn').addEventListener('click', () => {
        openAccountModal();
    });
    
    // 계정 폼 제출
    document.getElementById('account-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveAccountFromForm();
    });
    
    // 취소 버튼
    document.getElementById('cancel-account-btn').addEventListener('click', () => {
        document.getElementById('account-modal').style.display = 'none';
    });
    
    // 매장 설정 폼 제출
    const shopSettingsForm = document.getElementById('shop-settings-form');
    if (shopSettingsForm) {
        shopSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // 매장 설정 저장
            ToastNotification.show('매장 설정이 저장되었습니다.', 'success');
        });
    }
    
    // 알림 설정 폼 제출
    const notificationSettingsForm = document.getElementById('notification-settings-form');
    if (notificationSettingsForm) {
        notificationSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // 알림 설정 저장
            ToastNotification.show('알림 설정이 저장되었습니다.', 'success');
        });
    }
}

// 캘린더 초기화 함수
function initCalendarView() {
    try {
        // 디자이너(스태프) 선택 드롭다운 초기화
        const staffSelect = document.getElementById('calendar-staff-filter');
        staffSelect.innerHTML = '<option value="all">전체</option>';
        
        // 담당자 목록 추가
        staffMembers.forEach(staff => {
            if (staff.role !== 'admin') { // 관리자 제외
                const option = document.createElement('option');
                option.value = staff.id;
                option.textContent = staff.name;
                staffSelect.appendChild(option);
            }
        });
        
        // 뷰 전환 버튼 이벤트 리스너 추가
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // 기존 버튼 모두 비활성화
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                
                // 클릭한 버튼 활성화
                this.classList.add('active');
                
                // 뷰 변경
                currentView = this.dataset.view;
                
                // 캘린더 헤더 업데이트 및 캘린더 다시 로드
                updateCalendarHeader();
                loadCalendar();
            });
        });
    } catch (error) {
        console.error('캘린더 초기화 중 오류:', error);
        ToastNotification.show('캘린더 초기화 중 오류가 발생했습니다.', 'error');
    }
}

// 달력 헤더 날짜 업데이트
function updateCalendarHeader() {
    try {
        const currentDateElement = document.getElementById('current-date');
        if (!currentDateElement) {
            console.error('current-date 요소를 찾을 수 없습니다.');
            return;
        }
        
        if (!currentDate || isNaN(currentDate.getTime())) {
            console.warn('유효하지 않은 currentDate가 사용됨. 새로운 날짜로 초기화합니다.');
            currentDate = new Date();
        }
        
        // 날짜를 한국어로 표시 (YYYY년 MM월 DD일 요일)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[currentDate.getDay()];
        
        // 날짜 형식을 명확하게 지정
        const formattedDate = `${year}년 ${month}월 ${day}일 (${weekday})`;
        currentDateElement.textContent = formattedDate;
        
        console.log('캘린더 헤더 업데이트 완료:', formattedDate);
    } catch (error) {
        console.error('날짜 표시 업데이트 중 오류:', error);
    }
}

// 날짜 포맷 변환 (YYYY-MM-DD)
function formatDate(date) {
    try {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            console.error('유효하지 않은 날짜:', date);
            return formatDate(new Date()); // 현재 날짜로 대체
        }
        
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        const formatted = [year, month, day].join('-');
        return formatted;
    } catch (error) {
        console.error('날짜 포맷 변환 중 오류:', error);
        return formatDate(new Date()); // 오류 발생 시 현재 날짜로 대체
    }
}

// 캘린더 네비게이션 함수
function navigateCalendar(direction) {
    try {
        if (isLoading) return; // 로딩 중이면 이벤트 무시
        
        if (currentView === 'day') {
            // 일간 뷰에서는 하루씩 이동
            currentDate.setDate(currentDate.getDate() + direction);
        } else if (currentView === 'week') {
            // 주간 뷰에서는 일주일씩 이동
            currentDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (currentView === 'month') {
            // 월간 뷰에서는 한 달씩 이동
            currentDate.setMonth(currentDate.getMonth() + direction);
        }
        
        updateCalendarHeader();
        loadCalendar();
    } catch (error) {
        console.error('캘린더 네비게이션 중 오류:', error);
        ToastNotification.show('날짜 이동 중 오류가 발생했습니다.', 'error');
    }
}

// 오늘 날짜로 이동하는 함수
async function navigateToToday() {
    try {
        if (isLoading) {
            console.log('이미 로딩 중이므로 오늘 날짜 이동을 건너뜁니다.');
            return;
        }
        
        console.log('오늘 날짜로 이동 시작');
        LoadingIndicator.show('오늘 날짜로 이동 중...');
        
        // 현재 시스템 날짜로 설정 (깊은 복사가 아닌 새 객체 생성)
        currentDate = new Date();
        console.log('현재 날짜로 재설정:', currentDate);
        
        // 캘린더 헤더 먼저 업데이트
        updateCalendarHeader();
        
        // 캘린더 렌더링
        console.log('오늘 날짜 캘린더 로드 시작');
        await loadCalendar();
        
        LoadingIndicator.hide();
        console.log('오늘 날짜로 이동 완료');
    } catch (error) {
        LoadingIndicator.hide();
        console.error('오늘 날짜로 이동 중 오류:', error);
        ToastNotification.show('오늘 날짜로 이동 중 오류가 발생했습니다.', 'error');
    }
}

// 캘린더 메인 로드 함수
async function loadCalendar() {
    try {
        if (isLoading) {
            console.log('이미 로딩 중이므로 캘린더 로드를 건너뜁니다.');
            return;
        }
        
        isLoading = true;
        console.log('캘린더 로드 시작 - 현재 날짜:', currentDate);
        
        // 현재 날짜가 유효한지 확인
        if (!currentDate || isNaN(currentDate.getTime())) {
            console.warn('유효하지 않은 currentDate가 사용됨. 새로운 날짜로 초기화합니다.');
            currentDate = new Date();
        }
        
        console.log('포맷된 날짜:', formatDate(currentDate));
        
        // 로딩 표시 보이기
        LoadingIndicator.show('캘린더 정보를 불러오는 중...');
        
        // 캘린더 헤더 업데이트
        updateCalendarHeader();
        
        // 모든 캘린더 뷰 숨기기
        document.querySelectorAll('.calendar-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // 선택된 뷰 표시 및 데이터 로드
        console.log('현재 선택된 뷰:', currentView);
        
        if (currentView === 'day') {
            const dayView = document.getElementById('day-view');
            if (dayView) {
                dayView.classList.add('active');
                await loadDayView();
            } else {
                console.error('day-view 요소를 찾을 수 없습니다');
            }
        } else if (currentView === 'week') {
            const weekView = document.getElementById('week-view');
            if (weekView) {
                weekView.classList.add('active');
                await loadWeekView();
            } else {
                console.error('week-view 요소를 찾을 수 없습니다');
            }
        } else if (currentView === 'month') {
            const monthView = document.getElementById('month-view');
            if (monthView) {
                monthView.classList.add('active');
                await loadMonthView();
            } else {
                console.error('month-view 요소를 찾을 수 없습니다');
            }
        } else {
            console.warn('지원되지 않는 캘린더 뷰:', currentView);
        }
        
        // 통계 업데이트
        try {
            await updateAppointmentStats();
        } catch (statsError) {
            console.error('통계 업데이트 중 오류:', statsError);
        }
        
        LoadingIndicator.hide();
        isLoading = false;
        console.log('캘린더 로드 완료');
    } catch (error) {
        LoadingIndicator.hide();
        isLoading = false;
        console.error('캘린더 로드 중 오류:', error);
        ToastNotification.show('캘린더 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 예약 저장
async function saveAppointment() {
    try {
        LoadingIndicator.show('예약을 처리 중입니다...');
        
        // 폼 데이터 수집 및 형식화
        const date = document.getElementById('appointment-date').value;
        const startTime = document.getElementById('appointment-start-time').value;
        const endTime = document.getElementById('appointment-end-time').value;
        const guardianName = document.getElementById('guardian-name').value;
        const guardianPhone = document.getElementById('guardian-phone').value;
        const service = document.getElementById('selected-service').value;
        const staffId = document.getElementById('staff-assigned').value;
        
        // 반려동물 정보 수집
        const petContainers = document.querySelectorAll('#pet-containers .pet-container');
        const pets = Array.from(petContainers).map((container) => {
            return {
                name: container.querySelector('.pet-name').value,
                breed: container.querySelector('.pet-breed').value,
                weight: parseFloat(container.querySelector('.pet-weight').value),
                age: container.querySelector('.pet-age').value || null,
                memo: container.querySelector('.pet-memo').value || ''
            };
        });
        
        // 알림톡 옵션 확인
        const alimtalkOption = document.querySelector('input[name="alimtalk-option"]:checked').value;
        
        // 동의서 확인
        const defaultAgreement = document.getElementById('agreement-default').checked;
        const seniorAgreement = document.getElementById('agreement-senior').checked;
        
        // 기타 정보
        const guardianMemo = document.getElementById('guardian-memo').value || '';
        const appointmentMemo = document.getElementById('appointment-memo').value || '';
        const alimtalkConsent = document.getElementById('alimtalk-consent').checked;
        
        // 스태프 객체 찾기
        const staffMember = staffMembers.find(s => s.id === staffId);

        // API 호출을 위한 데이터 객체 생성
        const appointmentData = {
            date,
            startTime,
            endTime,
            guardian: {
                name: guardianName,
                phone: guardianPhone,
                memo: guardianMemo,
                alimtalkConsent: alimtalkConsent
            },
            pets,
            service,
            staff: staffMember,
            status: 'reserved',
            memo: appointmentMemo,
            alimtalk: alimtalkOption,
            agreements: {
                default: defaultAgreement,
                senior: seniorAgreement
            }
        };
        
        // 예약 저장 API 호출
        const response = await API.saveAppointment(appointmentData);
        
        // 새 예약 ID 설정 (새 예약의 경우)
        const appointmentId = response.id;
        
        // 알림톡 발송
        if (alimtalkOption !== 'none' && alimtalkConsent) {
            const alimtalkResult = await sendAlimtalk({
                ...appointmentData,
                id: appointmentId
            });
            
            if (!alimtalkResult.success) {
                console.warn('알림톡 발송 실패:', alimtalkResult.reason);
            }
        }
        
        // 예약 목록 업데이트
        if (date === formatDate(currentDate)) {
            const updatedAppointmentsResponse = await API.getAppointmentsByDate(date);
            appointments = updatedAppointmentsResponse.appointments || [];
        }
        
        // 모달 닫기
        document.getElementById('appointment-modal').style.display = 'none';
        
        // 캘린더 새로고침
        await loadCalendar();
        
        // 성공 메시지
        ToastNotification.show('예약이 정상적으로 등록되었습니다.', 'success');
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('예약 저장 중 오류:', error);
        ToastNotification.show(`예약 저장에 실패했습니다: ${error.message}`, 'error');
    }
}

// 매출 등록 (폼에서)
async function saveSaleFromForm() {
    try {
        LoadingIndicator.show('매출을 등록 중입니다...');
        
        // 폼 데이터 수집
        const appointmentId = document.getElementById('appointment-id').value;
        const customerName = document.getElementById('sale-customer-name').value;
        const petName = document.getElementById('sale-pet-name').value;
        const service = document.getElementById('sale-service').value;
        const amount = parseInt(document.getElementById('sale-amount').value);
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
        const memo = document.getElementById('sale-memo').value;
        
        // 현재 사용자 정보 가져오기
        let currentUser;
        try {
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        } catch (e) {
            // 사용자 정보가 없거나 파싱 오류가 발생한 경우 처리
            console.warn('세션에 사용자 정보가 없습니다:', e);
        }
        
        // 직원 목록이 비어있는 경우 다시 로드
        if (!staffMembers || staffMembers.length === 0) {
            const staffResponse = await API.getStaff();
            staffMembers = staffResponse.staffMembers || [];
        }
        
        // 관련 예약 찾기 (있는 경우)
        let customerId, staffId, date;
        
        if (appointmentId) {
            const appointment = appointments.find(a => a.id === appointmentId);
            if (appointment) {
                // 예약 객체에서 customer_id 또는 customer.id 를 사용
                customerId = appointment.customer_id || (appointment.customer ? appointment.customer.id : null);
                staffId = appointment.staff_id || (appointment.staff ? appointment.staff.id : null);
                date = appointment.date;
            }
            
            // 예약 정보에서 ID를 찾지 못한 경우 API를 통해 예약 정보 가져오기 시도
            if (!customerId || !staffId) {
                try {
                    const appointmentResponse = await API.getAppointments({ page: 1, limit: 1, id: appointmentId });
                    if (appointmentResponse && appointmentResponse.appointments && appointmentResponse.appointments.length > 0) {
                        const appointmentData = appointmentResponse.appointments[0];
                        customerId = appointmentData.customer_id || (appointmentData.customer ? appointmentData.customer.id : null);
                        staffId = appointmentData.staff_id || (appointmentData.staff ? appointmentData.staff.id : null);
                        date = appointmentData.date;
                    }
                } catch (err) {
                    console.warn('예약 정보를 가져오는 중 오류:', err);
                }
            }
        } else {
            // 고객 이름으로 고객 ID 찾기
            const customer = customers.find(c => c.name === customerName);
            if (customer) {
                customerId = customer.id;
            } else {
                // 고객을 찾지 못한 경우 오류 표시
                throw new Error('고객 정보를 찾을 수 없습니다. 유효한 고객을 선택해주세요.');
            }
            
            // 현재 로그인한 사용자를 담당자로
            if (currentUser && currentUser.id) {
                staffId = currentUser.id;
            } else {
                // 현재 로그인한 사용자 정보가 없는 경우 첫 번째 스태프를 사용
                const firstStaff = staffMembers.find(s => s.role === 'staff');
                if (firstStaff) {
                    staffId = firstStaff.id;
                } else {
                    throw new Error('직원 정보를 찾을 수 없습니다. 로그인 후 다시 시도해주세요.');
                }
            }
            
            // 날짜는 오늘
            date = formatDate(new Date());
        }
        
        // 필수 필드 검증
        if (!customerId) throw new Error('고객 정보가 누락되었습니다.');
        if (!staffId) throw new Error('담당자 정보가 누락되었습니다.');
        if (!date) throw new Error('날짜 정보가 누락되었습니다.');
        if (!service) throw new Error('서비스 정보가 누락되었습니다.');
        if (!amount || isNaN(amount)) throw new Error('유효한 금액을 입력해주세요.');
        if (!paymentMethod) throw new Error('결제 방식을 선택해주세요.');
        
        // 매출 데이터 객체
        const saleData = {
            appointmentId,
            customerId,
            staffId,
            date,
            service,
            amount,
            paymentMethod,
            memo
        };
        
        console.log('매출 등록 데이터:', saleData);
        
        // 매출 등록 API 호출
        await API.saveSale(saleData);
        
        // 매출 데이터 다시 로드
        if (date === formatDate(new Date())) {
            const salesResponse = await API.getSalesByPeriod(date, date);
            sales = salesResponse.sales || [];
        }
        
        // 예약 목록도 갱신 (상태가 변경될 수 있으므로)
        if (appointmentId) {
            const appointmentsResponse = await API.getAppointmentsByDate(date);
            appointments = appointmentsResponse.appointments || [];
        }
        
        // 모달 닫기
        document.getElementById('sale-modal').style.display = 'none';
        
        // 캘린더 새로고침 (현재 예약관리 페이지에 있는 경우)
        const appointmentsPage = document.getElementById('appointments-page');
        if (appointmentsPage.classList.contains('active')) {
            await loadCalendar();
        }
        
        // 매출관리 페이지 새로고침 (현재 매출관리 페이지에 있는 경우)
        const salesPage = document.getElementById('sales-page');
        if (salesPage.classList.contains('active')) {
            const activeBtn = document.querySelector('.period-btn.active');
            await renderSalesData(activeBtn ? activeBtn.dataset.period : 'today');
        }
        
        // 성공 메시지
        ToastNotification.show('매출이 정상적으로 등록되었습니다.', 'success');
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('매출 등록 중 오류:', error);
        ToastNotification.show(`매출 등록에 실패했습니다: ${error.message}`, 'error');
    }
}

// 날짜별 예약 조회
async function loadDayView() {
    try {
        console.log('일간 뷰 로드 시작');
        const staffSchedules = document.getElementById('staff-schedules');
        
        if (!staffSchedules) {
            console.error('staff-schedules 요소를 찾을 수 없습니다.');
            return;
        }
        
        staffSchedules.innerHTML = '';
        
        // 유효한 날짜 확인
        if (!currentDate || isNaN(currentDate.getTime())) {
            console.warn('일간 뷰: 유효하지 않은 currentDate가 사용됨. 새로운 날짜로 초기화합니다.');
            currentDate = new Date();
        }
        
        // 운영 시간 설정
        const startHour = 9;
        const endHour = 19;
        
        // 선택한 날짜의 예약 데이터 가져오기
        const dateStr = formatDate(currentDate);
        console.log('일간 뷰 날짜:', dateStr, '스태프:', selectedStaffId);
        
        const response = await API.getAppointmentsByDate(dateStr, selectedStaffId);
        console.log('일간 뷰 API 응답:', response);
        
        const dailyAppointments = response.appointments || [];
        
        // 전역 appointments 업데이트
        appointments = appointments.filter(app => app.date !== dateStr);
        appointments = [...appointments, ...dailyAppointments];
        
        // 전체 보기인지, 특정 디자이너 필터링인지 확인
        if (selectedStaffId === 'all') {
            // 모든 디자이너 일정 표시
            const staffList = staffMembers.filter(staff => staff.role !== 'admin');
            
            if (staffList.length === 0) {
                console.warn('표시할 스태프가 없습니다. API를 통해 스태프 정보를 다시 가져옵니다.');
                try {
                    const staffResponse = await API.getStaff();
                    staffMembers = staffResponse.staffMembers || [];
                    const newStaffList = staffMembers.filter(staff => staff.role !== 'admin');
                    
                    if (newStaffList.length === 0) {
                        console.error('스태프 정보를 가져왔지만 표시할 스태프가 없습니다.');
                        const noStaffMsg = document.createElement('div');
                        noStaffMsg.className = 'no-staff-message';
                        noStaffMsg.textContent = '등록된 디자이너가 없습니다. 설정 메뉴에서 디자이너를 추가해주세요.';
                        staffSchedules.appendChild(noStaffMsg);
                        return;
                    }
                    
                    newStaffList.forEach(staff => {
                        const staffSchedule = createStaffSchedule(staff, startHour, endHour);
                        staffSchedules.appendChild(staffSchedule);
                    });
                } catch (staffError) {
                    console.error('스태프 정보 가져오기 실패:', staffError);
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = '디자이너 정보를 불러오는 중 오류가 발생했습니다.';
                    staffSchedules.appendChild(errorMsg);
                }
            } else {
                // 정상적으로 스태프 목록이 있는 경우
                staffList.forEach(staff => {
                    const staffSchedule = createStaffSchedule(staff, startHour, endHour);
                    staffSchedules.appendChild(staffSchedule);
                });
            }
        } else {
            // 선택한 디자이너만 표시
            const staff = staffMembers.find(s => s.id === selectedStaffId);
            if (staff) {
                const staffSchedule = createStaffSchedule(staff, startHour, endHour);
                staffSchedules.appendChild(staffSchedule);
            } else {
                console.error('선택한 디자이너 정보를 찾을 수 없습니다:', selectedStaffId);
                const notFoundMsg = document.createElement('div');
                notFoundMsg.className = 'not-found-message';
                notFoundMsg.textContent = '선택한 디자이너 정보를 찾을 수 없습니다.';
                staffSchedules.appendChild(notFoundMsg);
            }
        }
        
        console.log('일간 뷰 로드 완료');
    } catch (error) {
        console.error('일간 예약 조회 중 오류:', error);
        ToastNotification.show(`예약 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
        throw error;
    }
}

// 스태프별 일간 일정 생성
function createStaffSchedule(staff, startHour, endHour) {
    const staffSchedule = document.createElement('div');
    staffSchedule.className = 'staff-schedule';
    
    // 스태프 헤더
    const staffHeader = document.createElement('div');
    staffHeader.className = 'staff-header';
    staffHeader.textContent = staff.name;
    staffSchedule.appendChild(staffHeader);
    
    // 일정 컨테이너
    const dailySchedule = document.createElement('div');
    dailySchedule.className = 'daily-schedule';
    
    // 시간 슬롯 생성
    for (let hour = startHour; hour < endHour; hour++) {
        // 정시
        createTimeSlot(dailySchedule, hour, 0, staff.id);
        
        // 30분
        createTimeSlot(dailySchedule, hour, 30, staff.id);
    }
    
    staffSchedule.appendChild(dailySchedule);
    
    // 해당 스태프의 예약 표시
    renderAppointmentsForStaff(dailySchedule, staff.id);
    
    return staffSchedule;
}

// 시간 슬롯 생성
function createTimeSlot(container, hour, minute, staffId = null) {
    const timeSlot = document.createElement('div');
    timeSlot.className = 'time-slot';

    const timeLabel = document.createElement('div');
    timeLabel.className = 'time-label';
    
    const formattedHour = hour.toString().padStart(2, '0');
    const formattedMinute = minute.toString().padStart(2, '0');
    timeLabel.textContent = `${formattedHour}:${formattedMinute}`;

    const appointmentSlot = document.createElement('div');
    appointmentSlot.className = 'appointment-slot';
    appointmentSlot.dataset.time = `${formattedHour}:${formattedMinute}`;
    if (staffId) {
        appointmentSlot.dataset.staffId = staffId;
    }
    
    // 슬롯 클릭 시 예약 추가 (특정 스태프 선택되었으면 해당 스태프로 자동 선택)
    appointmentSlot.addEventListener('click', () => {
        openAppointmentModal(`${formattedHour}:${formattedMinute}`, staffId);
    });

    timeSlot.appendChild(timeLabel);
    timeSlot.appendChild(appointmentSlot);
    container.appendChild(timeSlot);
}

// 스태프별 예약 렌더링
function renderAppointmentsForStaff(container, staffId) {
    // 선택된 날짜의 예약만 필터링
    const dateStr = formatDate(currentDate);
    let dailyAppointments = appointments.filter(app => app.date === dateStr);
    
    // 스태프 ID가 지정된 경우 해당 스태프의 예약만 필터링
    if (staffId && staffId !== 'all') {
        dailyAppointments = dailyAppointments.filter(app => app.staff.id === staffId);
    }
    
    // 예약을 시간대별 슬롯에 표시
    dailyAppointments.forEach(app => {
        const slot = container.querySelector(`[data-time="${app.startTime}"]${staffId ? `[data-staff-id="${staffId}"]` : ''}`);
        if (!slot) return;
        
        const appointmentItem = document.createElement('div');
        appointmentItem.className = `appointment-item status-${app.status || 'reserved'}`;
        appointmentItem.dataset.id = app.id;
        
        appointmentItem.innerHTML = `
            <div class="time">${app.startTime} ~ ${app.endTime}</div>
            <div class="name">${app.guardian.name}</div>
            <div class="pet">${app.pets.map(p => p.name).join(', ')}</div>
            <div class="service">${app.service}</div>
        `;
        
        // 예약 클릭 시 상세 정보 및 상태 변경 모달
        appointmentItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 부모 요소 클릭 이벤트 방지
            openSaleModal(app);
        });
        
        slot.appendChild(appointmentItem);
    });
}

// 주간 뷰 로드
async function loadWeekView() {
    try {
        const weekHeader = document.getElementById('week-header');
        const weekBody = document.getElementById('week-body');
        
        weekHeader.innerHTML = '';
        weekBody.innerHTML = '';
        
        // 주간 시작일 (일요일)
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        // 주간 종료일 (토요일)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // 한 번에 주간 데이터 가져오기
        const startDateStr = formatDate(weekStart);
        const endDateStr = formatDate(weekEnd);
        
        // 로딩 표시
        const weekLoading = document.createElement('div');
        weekLoading.className = 'week-loading';
        weekLoading.textContent = '주간 일정을 불러오는 중...';
        weekBody.appendChild(weekLoading);
        
        // 7일간의 헤더 미리 생성
        const dayHeaders = [];
        const dayColumns = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = formatDate(date);
            
            // 요일 헤더 추가
            const dayHeader = document.createElement('div');
            dayHeader.className = 'week-day-header';
            
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][i];
            const dayOfMonth = date.getDate();
            dayHeader.textContent = `${dayOfWeek} (${dayOfMonth}일)`;
            
            // 오늘 날짜 강조
            const today = new Date();
            if (date.getDate() === today.getDate() && 
                date.getMonth() === today.getMonth() && 
                date.getFullYear() === today.getFullYear()) {
                dayHeader.style.backgroundColor = 'var(--primary)';
                dayHeader.style.color = 'white';
            }
            
            dayHeaders.push(dayHeader);
            weekHeader.appendChild(dayHeader);
            
            // 날짜 열 추가
            const dayColumn = document.createElement('div');
            dayColumn.className = 'week-day';
            dayColumn.dataset.date = dateStr;
            
            // 날짜 클릭 시 해당 날짜의 예약 모달 바로 표시
            dayColumn.addEventListener('click', (e) => {
                if (e.target === dayColumn) {  // 날짜 영역 자체를 클릭했을 때만
                    const clickDate = new Date(dateStr);
                    openAppointmentModal(null, null, clickDate);
                }
            });
            
            dayColumns.push(dayColumn);
            weekBody.appendChild(dayColumn);
        }
        
        // 한 번의 API 호출로 주간 데이터 가져오기
        try {
            // 월간 데이터를 가져와서 필터링하는 방식으로 최적화
            const year = weekStart.getFullYear();
            const month = weekStart.getMonth() + 1;
            
            const response = await API.getAppointmentsByMonth(year, month, selectedStaffId);
            const weekAppointments = response.appointments || [];
            
            // 로딩 표시 제거
            weekBody.removeChild(weekLoading);
            
            // 주별로 필터링 (같은 달이 아닌 날짜도 고려)
            const startTime = weekStart.getTime();
            const endTime = weekEnd.getTime() + 86400000; // 하루 추가
            
            // 날짜별로 예약 데이터 그룹화
            const appointmentsByDate = {};
            
            weekAppointments.forEach(app => {
                const appDate = new Date(app.date);
                const appTime = appDate.getTime();
                
                if (appTime >= startTime && appTime < endTime) {
                    if (!appointmentsByDate[app.date]) {
                        appointmentsByDate[app.date] = [];
                    }
                    appointmentsByDate[app.date].push(app);
                }
            });
            
            // 예약 데이터 렌더링
            dayColumns.forEach((dayColumn, index) => {
                const dateStr = dayColumn.dataset.date;
                const dayAppointments = appointmentsByDate[dateStr] || [];
                
                dayAppointments.forEach(app => {
                    const appointmentElement = document.createElement('div');
                    appointmentElement.className = `week-appointment status-${app.status}`;
                    appointmentElement.innerHTML = `
                        <div>${app.startTime} - ${app.endTime}</div>
                        <div>${app.guardian.name} (${app.pets.map(p => p.name).join(', ')})</div>
                        <div>${app.service}</div>
                    `;
                    
                    // 예약 클릭 이벤트
                    appointmentElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // 날짜 클릭 이벤트 방지
                        openSaleModal(app);
                    });
                    
                    dayColumn.appendChild(appointmentElement);
                });
            });
            
        } catch (error) {
            console.error(`주간 예약 로드 중 오류:`, error);
            weekBody.removeChild(weekLoading);
            
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = '주간 일정을 불러오는 중 오류가 발생했습니다.';
            weekBody.appendChild(errorMsg);
        }
    } catch (error) {
        console.error('주간 예약 조회 중 오류:', error);
        ToastNotification.show(`주간 예약 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
        throw error;
    }
}

// 월간 뷰 로드
async function loadMonthView() {
    try {
        const monthBody = document.getElementById('month-body');
        monthBody.innerHTML = '';
        
        // currentDate가 아직 초기화되지 않았다면 현재 날짜로 설정
        if (!currentDate || isNaN(currentDate.getTime())) {
            console.warn('월간 뷰 로드 중 currentDate가 초기화되지 않았습니다. 현재 날짜로 설정합니다.');
            currentDate = new Date();
        }
        
        // 현재 월의 첫날
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        // 현재 월의 마지막 날
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        // 첫 주 시작일 (이전 달의 일요일부터)
        const firstWeekStart = new Date(firstDay);
        firstWeekStart.setDate(firstWeekStart.getDate() - firstWeekStart.getDay());
        
        // 마지막 주 종료일 (다음 달 토요일까지)
        const lastWeekEnd = new Date(lastDay);
        const daysToAdd = 6 - lastWeekEnd.getDay();
        lastWeekEnd.setDate(lastWeekEnd.getDate() + daysToAdd);
        
        LoadingIndicator.show('달력 데이터를 불러오는 중...');
        
        // 한 번에 월 데이터 불러오기
        const startDateStr = formatDate(firstDay);
        const endDateStr = formatDate(lastDay);
        
        // 월간 데이터 한 번에 불러오기
        let monthAppointments = [];
        try {
            const response = await API.getAppointmentsByMonth(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,  // API에서는 1-12 월을 사용
                selectedStaffId
            );
            monthAppointments = response.appointments || [];
            
            // 월간 appointments 업데이트
            const thisMonthDatePrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            appointments = appointments.filter(app => !app.date.startsWith(thisMonthDatePrefix));
            appointments = [...appointments, ...monthAppointments];
        } catch (error) {
            console.error('월간 예약 조회 실패:', error);
            ToastNotification.show(`월간 예약 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
        }
        
        // 날짜별로 예약 그룹화
        const appointmentsByDate = {};
        monthAppointments.forEach(app => {
            if (!appointmentsByDate[app.date]) {
                appointmentsByDate[app.date] = [];
            }
            appointmentsByDate[app.date].push(app);
        });
        
        // 날짜 그리드 생성
        let currentDateLoop = new Date(firstWeekStart);
        
        // 주 단위로 그리드 생성
        while (currentDateLoop <= lastWeekEnd) {
            const weekRow = document.createElement('div');
            weekRow.className = 'month-week';
            
            // 일주일의 각 날짜
            for (let i = 0; i < 7; i++) {
                const dateCell = document.createElement('div');
                dateCell.className = 'month-day';
                
                const dateStr = formatDate(currentDateLoop);
                dateCell.dataset.date = dateStr;
                
                // 해당 월이 아닌 날짜는 흐리게 표시
                if (currentDateLoop.getMonth() !== firstDay.getMonth()) {
                    dateCell.classList.add('other-month');
                }
                
                // 오늘 날짜 강조
                const today = new Date();
                if (currentDateLoop.getDate() === today.getDate() && 
                    currentDateLoop.getMonth() === today.getMonth() && 
                    currentDateLoop.getFullYear() === today.getFullYear()) {
                    dateCell.classList.add('today');
                }
                
                // 날짜 표시
                const dateHeader = document.createElement('div');
                dateHeader.className = 'day-header';
                dateHeader.textContent = currentDateLoop.getDate();
                dateCell.appendChild(dateHeader);
                
                // 해당 날짜의 예약 표시
                const dayAppointments = appointmentsByDate[dateStr] || [];
                
                // 예약 컨테이너 생성
                const appointmentsContainer = document.createElement('div');
                appointmentsContainer.className = 'day-appointments';
                
                // 최대 3개까지만 직접 표시
                const visibleAppointments = dayAppointments.slice(0, 3);
                visibleAppointments.forEach(app => {
                    const appointmentElement = document.createElement('div');
                    appointmentElement.className = `month-appointment status-${app.status}`;
                    appointmentElement.innerHTML = `${app.startTime} ${app.guardian.name}`;
                    
                    appointmentElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openSaleModal(app);
                    });
                    
                    appointmentsContainer.appendChild(appointmentElement);
                });
                
                // 추가 예약이 있는 경우 표시
                if (dayAppointments.length > 3) {
                    const moreElement = document.createElement('div');
                    moreElement.className = 'more-appointments';
                    moreElement.textContent = `외 ${dayAppointments.length - 3}건`;
                    appointmentsContainer.appendChild(moreElement);
                }
                
                dateCell.appendChild(appointmentsContainer);
                
                // 날짜 클릭 시 신규 예약 모달 오픈
                dateCell.addEventListener('click', () => {
                    // 날짜를 Date 객체로 변환
                    const clickDate = new Date(dateStr);
                    
                    // 날짜 페이지에서는 바로 모달을 열고
                    openAppointmentModal(null, null, clickDate);
                });
                
                weekRow.appendChild(dateCell);
                
                // 다음 날짜로 이동
                currentDateLoop.setDate(currentDateLoop.getDate() + 1);
            }
            
            monthBody.appendChild(weekRow);
        }
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('월간 캘린더 로드 중 오류:', error);
        ToastNotification.show(`월간 캘린더를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

// 예약 모달 열기
async function openAppointmentModal(time = null, staffId = null, date = null) {
    try {
        const modal = document.getElementById('appointment-modal');
        const form = document.getElementById('appointment-form');
        form.reset();
        
        // 날짜 및 시간 초기화
        if (date) {
            // 전달받은 날짜가 있으면 해당 날짜로 설정
            document.getElementById('appointment-date').value = formatDate(date);
        } else {
            document.getElementById('appointment-date').value = formatDate(currentDate);
        }
        
        if (time) {
            document.getElementById('appointment-start-time').value = time;
            
            // 기본 서비스 선택 (목욕 - 30분)
            const bathBtn = document.querySelector('[data-service="목욕"]');
            if (bathBtn) bathBtn.click();
            else document.getElementById('selected-service').value = '목욕';
        }
        
        // 담당자 목록 초기화
        const staffSelect = document.getElementById('staff-assigned');
        staffSelect.innerHTML = '';
        
        // 직원 목록이 없으면 API 호출
        if (staffMembers.length === 0) {
            try {
                const staffResponse = await API.getStaff();
                staffMembers = staffResponse.staffMembers || [];
            } catch (error) {
                console.error('직원 목록 조회 실패:', error);
            }
        }
        
        staffMembers.forEach(staff => {
            // 관리자가 아닌 직원만 표시
            if (staff.role !== 'admin') {
                const option = document.createElement('option');
                option.value = staff.id;
                option.textContent = staff.name;
                staffSelect.appendChild(option);
                
                // 지정된 staffId가 있으면 해당 직원 선택
                if (staffId && staff.id === staffId) {
                    option.selected = true;
                }
            }
        });
        
        // 펫 컨테이너 초기화 (하나만 표시)
        document.getElementById('pet-containers').innerHTML = `
            <div class="pet-container">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="pet-name-1">반려동물명</label>
                        <input type="text" id="pet-name-1" class="form-control pet-name" required>
                    </div>
                    <div class="form-group">
                        <label for="pet-breed-1">품종</label>
                        <input type="text" id="pet-breed-1" class="form-control pet-breed" required>
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="pet-weight-1">몸무게(kg)</label>
                        <input type="number" id="pet-weight-1" class="form-control pet-weight" step="0.1" required>
                    </div>
                    <div class="form-group">
                        <label for="pet-age-1">나이</label>
                        <input type="number" id="pet-age-1" class="form-control pet-age">
                    </div>
                </div>
                <div class="form-group">
                    <label for="pet-memo-1">반려동물 메모</label>
                    <textarea id="pet-memo-1" class="form-control pet-memo"></textarea>
                </div>
            </div>
        `;
        
        // 고객 검색 기능 추가
        const guardianNameInput = document.getElementById('guardian-name');
        const guardianPhoneInput = document.getElementById('guardian-phone');
        
        // 검색 결과 표시 컨테이너 추가
        let searchResultsContainer = document.getElementById('customer-search-results');
        if (!searchResultsContainer) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'customer-search-results';
            searchResultsContainer.className = 'search-results-container';
            searchResultsContainer.style.display = 'none';
            searchResultsContainer.style.position = 'absolute';
            searchResultsContainer.style.zIndex = '9999';
            searchResultsContainer.style.width = '100%';
            searchResultsContainer.style.top = '100%';
            searchResultsContainer.style.left = '0';
            
            // 검색 결과 컨테이너를 보호자 이름 입력 필드 아래에 배치
            guardianNameInput.parentNode.style.position = 'relative';
            guardianNameInput.parentNode.appendChild(searchResultsContainer);
        }
        
        // 반려동물명 입력 시 검색 기능 추가
        const petNameInput = document.getElementById('pet-name-1');
        if (petNameInput) {
            petNameInput.addEventListener('input', debounce(async function() {
                const searchTerm = petNameInput.value.trim();
                if (searchTerm.length < 2) return;
                
                try {
                    // 반려동물 이름으로 고객 검색
                    const customerResponse = await API.getCustomers(1, 5, searchTerm);
                    const customers = customerResponse.customers || [];
                    
                    // 반려동물 이름이 일치하는 고객 찾기
                    const matchingCustomers = customers.filter(customer => 
                        customer.pets && customer.pets.some(pet => 
                            pet.name && pet.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                    );
                    
                    if (matchingCustomers.length === 1) {
                        const customer = matchingCustomers[0];
                        // 고객 정보 자동 입력
                        guardianNameInput.value = customer.name || '';
                        guardianPhoneInput.value = customer.phone || '';
                        
                        // 일치하는 반려동물 찾기
                        const matchingPet = customer.pets.find(pet => 
                            pet.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        
                        if (matchingPet) {
                            // 반려동물 정보 자동 입력
                            petNameInput.value = matchingPet.name || '';
                            document.getElementById('pet-breed-1').value = matchingPet.breed || '';
                            document.getElementById('pet-weight-1').value = matchingPet.weight || '';
                            document.getElementById('pet-age-1').value = matchingPet.age || '';
                            document.getElementById('pet-memo-1').value = matchingPet.memo || '';
                        }
                    }
                } catch (error) {
                    console.error('반려동물 이름으로 고객 검색 중 오류:', error);
                }
            }, 500));
        }
        
        // 보호자 이름 입력 시 검색 (기존 코드 유지)
        guardianNameInput.addEventListener('input', debounce(async function() {
            const searchTerm = guardianNameInput.value.trim();
            if (searchTerm.length < 2) {
                searchResultsContainer.style.display = 'none';
                return;
            }
            
            try {
                const response = await API.getCustomers(1, 5, searchTerm);
                const searchResults = response.customers || [];
                
                if (searchResults.length > 0) {
                    searchResultsContainer.innerHTML = '';
                    
                    searchResults.forEach(customer => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'search-result-item';
                        resultItem.innerHTML = `
                            <div class="customer-name">${customer.name}</div>
                            <div class="customer-phone">${customer.phone}</div>
                            <div class="customer-pets">${(customer.pets || []).map(p => p.name).join(', ')}</div>
                        `;
                        
                        resultItem.addEventListener('click', () => {
                            // 선택한 고객 정보로 폼 채우기
                            guardianNameInput.value = customer.name;
                            guardianPhoneInput.value = customer.phone;
                            
                            // 고객의 반려동물이 2마리 이상인 경우 선택 UI 표시
                            if (customer.pets && customer.pets.length > 1) {
                                // 기존 반려동물 컨테이너 초기화
                                document.getElementById('pet-containers').innerHTML = '';
                                
                                // 기존 선택 UI가 있으면 제거
                                const existingSelectionContainer = document.querySelector('.pet-selection-container');
                                if (existingSelectionContainer) {
                                    existingSelectionContainer.remove();
                                }
                                
                                // 반려동물 선택 UI 생성
                                const petSelectionContainer = document.createElement('div');
                                petSelectionContainer.className = 'pet-selection-container';
                                petSelectionContainer.innerHTML = `
                                    <p>선택할 반려동물:</p>
                                    <div class="pet-selection-list"></div>
                                `;
                                
                                // 각 반려동물에 대한 옵션 추가
                                const petSelectionList = petSelectionContainer.querySelector('.pet-selection-list');
                                
                                customer.pets.forEach((pet, index) => {
                                    const petOption = document.createElement('div');
                                    petOption.className = 'pet-option';
                                    petOption.innerHTML = `
                                        <input type="checkbox" id="pet-select-${index}" class="pet-select-checkbox" value="${index}" ${index === 0 ? 'checked' : ''}>
                                        <label for="pet-select-${index}">
                                            ${pet.name} (${pet.breed}, ${pet.weight}kg${pet.age ? ', ' + pet.age + '세' : ''})
                                        </label>
                                    `;
                                    
                                    petSelectionList.appendChild(petOption);
                                });
                                
                                // 선택 완료 버튼 추가
                                const confirmSelectionBtn = document.createElement('button');
                                confirmSelectionBtn.type = 'button';
                                confirmSelectionBtn.className = 'btn primary-btn pet-select-confirm';
                                confirmSelectionBtn.textContent = '선택 완료';
                                
                                // 선택 완료 버튼 클릭 이벤트
                                confirmSelectionBtn.addEventListener('click', () => {
                                    // 선택된 반려동물 인덱스 가져오기
                                    const selectedPetIndexes = Array.from(
                                        petSelectionContainer.querySelectorAll('.pet-select-checkbox:checked')
                                    ).map(checkbox => parseInt(checkbox.value));
                                    
                                    // 선택된 반려동물이 없는 경우
                                    if (selectedPetIndexes.length === 0) {
                                        ToastNotification.show('최소 한 마리 이상의 반려동물을 선택해주세요.', 'error');
                                        return;
                                    }
                                    
                                    // 선택된 반려동물 정보만 추가
                                    document.getElementById('pet-containers').innerHTML = '';
                                    selectedPetIndexes.forEach((petIndex, i) => {
                                        const selectedPet = customer.pets[petIndex];
                                        addPetForm();
                                        const petContainers = document.querySelectorAll('#pet-containers .pet-container');
                                        const container = petContainers[i];
                                        
                                        container.querySelector('.pet-name').value = selectedPet.name || '';
                                        container.querySelector('.pet-breed').value = selectedPet.breed || '';
                                        container.querySelector('.pet-weight').value = selectedPet.weight || '';
                                        container.querySelector('.pet-age').value = selectedPet.age || '';
                                        container.querySelector('.pet-memo').value = selectedPet.memo || '';
                                    });
                                    
                                    // 선택 UI 제거
                                    petSelectionContainer.remove();
                                });
                                
                                petSelectionContainer.appendChild(confirmSelectionBtn);
                                
                                // 폼에 선택 UI 추가
                                const guardianInfoContainer = guardianPhoneInput.closest('.form-group').parentElement;
                                guardianInfoContainer.parentElement.insertBefore(petSelectionContainer, guardianInfoContainer.nextSibling);
                            } else if (customer.pets && customer.pets.length === 1) {
                                // 반려동물이 한 마리인 경우 기존 방식으로 표시
                                document.getElementById('pet-containers').innerHTML = '';
                                
                                addPetForm();
                                const petContainers = document.querySelectorAll('#pet-containers .pet-container');
                                const container = petContainers[0];
                                
                                container.querySelector('.pet-name').value = customer.pets[0].name || '';
                                container.querySelector('.pet-breed').value = customer.pets[0].breed || '';
                                container.querySelector('.pet-weight').value = customer.pets[0].weight || '';
                                container.querySelector('.pet-age').value = customer.pets[0].age || '';
                                container.querySelector('.pet-memo').value = customer.pets[0].memo || '';
                            }
                            
                            // 검색 결과 숨기기
                            searchResultsContainer.style.display = 'none';
                        });
                        
                        searchResultsContainer.appendChild(resultItem);
                    });
                    
                    searchResultsContainer.style.display = 'block';
                } else {
                    searchResultsContainer.style.display = 'none';
                }
            } catch (error) {
                console.error('고객 검색 중 오류:', error);
                searchResultsContainer.style.display = 'none';
            }
        }, 300)); // 300ms 디바운스
        
        // 전화번호 입력 시 검색
        guardianPhoneInput.addEventListener('input', debounce(async function() {
            const phone = guardianPhoneInput.value.trim();
            if (phone.length < 4) return;
            
            try {
                // 전화번호로 고객 조회 API 호출
                const response = await API.getCustomerByPhone(phone);
                
                if (response.exists && response.customer) {
                    const customer = response.customer;
                    
                    // 고객 정보로 폼 채우기
                    guardianNameInput.value = customer.name;
                    
                    // 고객의 반려동물이 2마리 이상인 경우 선택 UI 표시
                    if (customer.pets && customer.pets.length > 1) {
                        // 기존 반려동물 컨테이너 초기화
                        document.getElementById('pet-containers').innerHTML = '';
                        
                        // 반려동물 선택 UI 생성
                        const petSelectionContainer = document.createElement('div');
                        petSelectionContainer.className = 'pet-selection-container';
                        petSelectionContainer.innerHTML = `
                            <p>선택할 반려동물:</p>
                            <div class="pet-selection-list"></div>
                        `;
                        
                        // 각 반려동물에 대한 옵션 추가
                        const petSelectionList = petSelectionContainer.querySelector('.pet-selection-list');
                        
                        customer.pets.forEach((pet, index) => {
                            const petOption = document.createElement('div');
                            petOption.className = 'pet-option';
                            petOption.innerHTML = `
                                <input type="checkbox" id="pet-select-${index}" class="pet-select-checkbox" value="${index}" ${index === 0 ? 'checked' : ''}>
                                <label for="pet-select-${index}">
                                    ${pet.name} (${pet.breed}, ${pet.weight}kg${pet.age ? ', ' + pet.age + '세' : ''})
                                </label>
                            `;
                            
                            petSelectionList.appendChild(petOption);
                        });
                        
                        // 선택 완료 버튼 추가
                        const confirmSelectionBtn = document.createElement('button');
                        confirmSelectionBtn.type = 'button';
                        confirmSelectionBtn.className = 'btn primary-btn pet-select-confirm';
                        confirmSelectionBtn.textContent = '선택 완료';
                        
                        // 선택 완료 버튼 클릭 이벤트
                        confirmSelectionBtn.addEventListener('click', () => {
                            // 선택된 반려동물 인덱스 가져오기
                            const selectedPetIndexes = Array.from(
                                petSelectionContainer.querySelectorAll('.pet-select-checkbox:checked')
                            ).map(checkbox => parseInt(checkbox.value));
                            
                            // 선택된 반려동물이 없는 경우
                            if (selectedPetIndexes.length === 0) {
                                ToastNotification.show('최소 한 마리 이상의 반려동물을 선택해주세요.', 'error');
                                return;
                            }
                            
                            // 선택된 반려동물 정보만 추가
                            document.getElementById('pet-containers').innerHTML = '';
                            selectedPetIndexes.forEach((petIndex, i) => {
                                const selectedPet = customer.pets[petIndex];
                                addPetForm();
                                const petContainers = document.querySelectorAll('#pet-containers .pet-container');
                                const container = petContainers[i];
                                
                                container.querySelector('.pet-name').value = selectedPet.name || '';
                                container.querySelector('.pet-breed').value = selectedPet.breed || '';
                                container.querySelector('.pet-weight').value = selectedPet.weight || '';
                                container.querySelector('.pet-age').value = selectedPet.age || '';
                                container.querySelector('.pet-memo').value = selectedPet.memo || '';
                            });
                            
                            // 선택 UI 제거
                            petSelectionContainer.remove();
                        });
                        
                        petSelectionContainer.appendChild(confirmSelectionBtn);
                        
                        // 폼에 선택 UI 추가
                        const guardianInfoContainer = guardianPhoneInput.closest('.form-group').parentElement;
                        guardianInfoContainer.parentElement.insertBefore(petSelectionContainer, guardianInfoContainer.nextSibling);
                    } else if (customer.pets && customer.pets.length === 1) {
                        // 반려동물이 한 마리인 경우 기존 방식으로 표시
                        document.getElementById('pet-containers').innerHTML = '';
                        
                        addPetForm();
                        const petContainers = document.querySelectorAll('#pet-containers .pet-container');
                        const container = petContainers[0];
                        
                        container.querySelector('.pet-name').value = customer.pets[0].name || '';
                        container.querySelector('.pet-breed').value = customer.pets[0].breed || '';
                        container.querySelector('.pet-weight').value = customer.pets[0].weight || '';
                        container.querySelector('.pet-age').value = customer.pets[0].age || '';
                        container.querySelector('.pet-memo').value = customer.pets[0].memo || '';
                    }
                }
            } catch (error) {
                console.error('전화번호로 고객 검색 중 오류:', error);
            }
        }, 500)); // 500ms 디바운스
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('예약 모달 열기 중 오류:', error);
        ToastNotification.show('예약 창을 여는 중 오류가 발생했습니다.', 'error');
    }
}

// 디바운스 함수 (입력이 끝난 후 일정 시간이 지나면 실행)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 종료 시간 자동 계산
function updateEndTime(durationMinutes) {
    const startTimeInput = document.getElementById('appointment-start-time');
    const endTimeInput = document.getElementById('appointment-end-time');
    
    if (!startTimeInput.value) return;
    
    const [hours, minutes] = startTimeInput.value.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0);
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + parseInt(durationMinutes));
    
    const endHours = endDate.getHours().toString().padStart(2, '0');
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    
    endTimeInput.value = `${endHours}:${endMinutes}`;
}

// 반려동물 폼 추가
function addPetForm() {
    const petContainers = document.getElementById('pet-containers');
    const petCount = petContainers.childElementCount + 1;
    
    const newPetContainer = document.createElement('div');
    newPetContainer.className = 'pet-container';
    newPetContainer.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label for="pet-name-${petCount}">반려동물명</label>
                <input type="text" id="pet-name-${petCount}" class="form-control pet-name" required>
            </div>
            <div class="form-group">
                <label for="pet-breed-${petCount}">품종</label>
                <input type="text" id="pet-breed-${petCount}" class="form-control pet-breed" required>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="pet-weight-${petCount}">몸무게(kg)</label>
                <input type="number" id="pet-weight-${petCount}" class="form-control pet-weight" step="0.1" required>
            </div>
            <div class="form-group">
                <label for="pet-age-${petCount}">나이</label>
                <input type="number" id="pet-age-${petCount}" class="form-control pet-age">
            </div>
        </div>
        <div class="form-group">
            <label for="pet-memo-${petCount}">반려동물 메모</label>
            <textarea id="pet-memo-${petCount}" class="form-control pet-memo"></textarea>
        </div>
    `;
    
    petContainers.appendChild(newPetContainer);
}

// 알림톡 미리보기 업데이트
function updateAlimtalkPreviews() {
    try {
        // 미리보기에 사용할 데이터
        let previewData = {
            shopName: '',
            shopPhone: '',
            appointmentDate: '',
            guardianName: '',
            petNames: '',
            serviceName: ''
        };
        
        // 매장 정보 가져오기 (설정에서)
        const shopNameInput = document.getElementById('shop-name');
        const shopPhoneInput = document.getElementById('shop-phone');
        
        if (shopNameInput && shopNameInput.value) {
            previewData.shopName = shopNameInput.value;
        } else {
            // 로컬 스토리지에서 매장 정보 가져오기
            const shopSettings = JSON.parse(localStorage.getItem('shopSettings') || '{}');
            previewData.shopName = shopSettings.name || '딥펫 미용실';
        }
        
        if (shopPhoneInput && shopPhoneInput.value) {
            previewData.shopPhone = shopPhoneInput.value;
        } else {
            // 로컬 스토리지에서 매장 정보 가져오기
            const shopSettings = JSON.parse(localStorage.getItem('shopSettings') || '{}');
            previewData.shopPhone = shopSettings.phone || '02-1234-5678';
        }
        
        // 예약 정보 가져오기
        const appointmentDateInput = document.getElementById('appointment-date');
        const appointmentStartTimeInput = document.getElementById('appointment-start-time');
        const guardianNameInput = document.getElementById('guardian-name');
        const selectedServiceInput = document.getElementById('selected-service');
        
        if (appointmentDateInput && appointmentDateInput.value) {
            let dateStr = appointmentDateInput.value;
            
            if (appointmentStartTimeInput && appointmentStartTimeInput.value) {
                dateStr += ' ' + appointmentStartTimeInput.value;
            }
            
            // 날짜 형식 변환 (yyyy-MM-dd HH:mm -> yyyy년 MM월 dd일 HH시 mm분)
            try {
                const dateParts = dateStr.split('-');
                const year = dateParts[0];
                const month = dateParts[1];
                const dayParts = dateParts[2].split(' ');
                const day = dayParts[0];
                
                let formattedDate = `${year}년 ${month}월 ${day}일`;
                
                if (dayParts[1]) {
                    const timeParts = dayParts[1].split(':');
                    formattedDate += ` ${timeParts[0]}시`;
                    if (timeParts[1]) {
                        formattedDate += ` ${timeParts[1]}분`;
                    }
                }
                
                previewData.appointmentDate = formattedDate;
            } catch (e) {
                console.warn('날짜 형식 변환 실패:', e);
                previewData.appointmentDate = dateStr;
            }
        } else {
            // 날짜가 없는 경우 오늘 날짜 사용
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            previewData.appointmentDate = `${year}년 ${month}월 ${day}일`;
        }
        
        if (guardianNameInput && guardianNameInput.value) {
            previewData.guardianName = guardianNameInput.value;
        } else {
            previewData.guardianName = '고객';
        }
        
        // 반려동물 이름 가져오기
        const petNameInputs = document.querySelectorAll('.pet-name');
        let petNames = [];
        
        petNameInputs.forEach(input => {
            if (input.value) {
                petNames.push(input.value);
            }
        });
        
        previewData.petNames = petNames.join(', ') || '반려동물';
        
        // 선택된 서비스 가져오기
        if (selectedServiceInput && selectedServiceInput.value) {
            previewData.serviceName = selectedServiceInput.value;
        } else {
            // 선택된 서비스 버튼에서 가져오기
            const selectedServiceBtn = document.querySelector('.service-btn.selected');
            if (selectedServiceBtn) {
                previewData.serviceName = selectedServiceBtn.dataset.service || '미용';
            } else {
                previewData.serviceName = '미용';
            }
        }
        
        // 미리보기 업데이트
        updatePreviewWithData('alimtalk-default-preview', previewData);
        updatePreviewWithData('alimtalk-deposit-preview', previewData);
        
        // 선택된 알림톡 옵션에 따라 미리보기 표시
        const selectedOption = document.querySelector('input[name="alimtalk-option"]:checked').value;
        
        document.querySelectorAll('.alimtalk-preview').forEach(preview => {
            preview.style.display = 'none';
        });
        
        if (selectedOption === 'default') {
            document.getElementById('alimtalk-default-preview').style.display = 'block';
        } else if (selectedOption === 'deposit') {
            document.getElementById('alimtalk-deposit-preview').style.display = 'block';
        }
    } catch (error) {
        console.error('알림톡 미리보기 업데이트 중 오류:', error);
    }
}

// 시간별 차트 데이터 준비
function prepareHourlyChartData(salesData) {
    // 시간별 매출 합계 계산
    const hourlyData = Array(24).fill(0);
    
    salesData.forEach(sale => {
        if (sale.time) {
            const hour = parseInt(sale.time.split(':')[0]);
            hourlyData[hour] += sale.amount || 0;
        }
    });
    
    // 차트용 데이터 포맷
    const labels = Array(24).fill().map((_, i) => `${i}시`);
    
    return {
        labels,
        datasets: [{
            label: '시간별 매출',
            data: hourlyData,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };
}

// 일별/월별 차트 데이터 준비
function prepareDailyChartData(salesData, startDate, endDate, period) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 일별/월별 선택
    let groupBy = 'day'; // 기본은 일별
    
    // 기간이 3개월 이상이면 월별로 그룹화
    if (['threeMonths', 'sixMonths', 'year'].includes(period)) {
        groupBy = 'month';
    }
    
    let labels = [];
    let data = [];
    
    if (groupBy === 'day') {
        // 일별 데이터
        const dailyData = {};
        
        // 날짜 범위의 모든 날짜에 대해 초기값 0 설정
        let current = new Date(start);
        while (current <= end) {
            const dateStr = formatDate(current);
            dailyData[dateStr] = 0;
            current.setDate(current.getDate() + 1);
        }
        
        // 매출 데이터로 합계 계산
        salesData.forEach(sale => {
            if (sale.date && dailyData.hasOwnProperty(sale.date)) {
                dailyData[sale.date] += sale.amount || 0;
            }
        });
        
        // 차트 데이터 포맷
        labels = Object.keys(dailyData);
        data = Object.values(dailyData);
    } else {
        // 월별 데이터
        const monthlyData = {};
        
        // 월별 범위 설정
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
            const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthStr] = 0;
            current.setMonth(current.getMonth() + 1);
        }
        
        // 매출 데이터로 합계 계산
        salesData.forEach(sale => {
            if (sale.date) {
                const dateParts = sale.date.split('-');
                const monthStr = `${dateParts[0]}-${dateParts[1]}`;
                if (monthlyData.hasOwnProperty(monthStr)) {
                    monthlyData[monthStr] += sale.amount || 0;
                }
            }
        });
        
        // 차트 데이터 포맷
        labels = Object.keys(monthlyData).map(monthStr => {
            const [year, month] = monthStr.split('-');
            return `${year}년 ${month}월`;
        });
        data = Object.values(monthlyData);
    }
    
    return {
        labels,
        datasets: [{
            label: groupBy === 'day' ? '일별 매출' : '월별 매출',
            data: data,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    };
}

// 매출 차트 렌더링
function renderSalesChart(chartData, period) {
    try {
        // 차트 컨테이너와 캔버스 확인
        const chartContainer = document.querySelector('.chart-container');
        if (!chartContainer) {
            console.error('차트 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 캔버스 확인 및 생성
        let canvas = document.getElementById('sales-chart');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'sales-chart';
            chartContainer.appendChild(canvas);
        }
        
        // 기존 차트 제거 (메모리 누수 방지)
        if (window.salesChart) {
            window.salesChart.destroy();
        }
        
        // 차트 설정
        const chartConfig = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${periodLabels[period] || '기간별'} 매출 현황`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    // 만원 단위로 표시
                                    const value = context.parsed.y;
                                    if (value >= 10000) {
                                        label += Math.round(value / 10000).toLocaleString() + '만원';
                                    } else {
                                        label += value.toLocaleString() + '원';
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                // 만원 단위로 표시
                                if (value >= 10000) {
                                    return Math.round(value / 10000).toLocaleString() + '만원';
                                }
                                return value.toLocaleString() + '원';
                            }
                        }
                    }
                }
            }
        };
        
        // 차트 생성
        const ctx = canvas.getContext('2d');
        window.salesChart = new Chart(ctx, chartConfig);
        
        console.log('매출 차트 렌더링 완료:', period);
    } catch (error) {
        console.error('매출 차트 렌더링 중 오류:', error);
        ToastNotification.show('매출 차트를 생성하는 중 오류가 발생했습니다.', 'error');
    }
}

// 고객 테이블 렌더링 함수
function renderCustomersTable() {
    try {
        const tbody = document.querySelector('#customers-table tbody');
        if (!tbody) {
            console.error('고객 테이블을 찾을 수 없습니다.');
            return;
        }
        
        tbody.innerHTML = '';
        
        // 로컬 스토리지에서 고객 데이터 가져오기
        const customers = JSON.parse(localStorage.getItem('customers') || '[]');
        
        if (customers.length === 0) {
            // 고객 데이터가 없는 경우 메시지 표시
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="text-center">등록된 고객이 없습니다.</td>';
            tbody.appendChild(tr);
            return;
        }
        
        customers.forEach(customer => {
            const tr = document.createElement('tr');
            
            // 최근 방문일
            let lastVisit = '없음';
            if (customer.lastVisit) {
                lastVisit = new Date(customer.lastVisit).toLocaleDateString('ko-KR');
            }
            
            // 반려동물 이름 목록
            const petNames = customer.pets ? customer.pets.map(p => p.name).join(', ') : '-';
            
            tr.innerHTML = `
                <td>${customer.name || '-'}</td>
                <td>${customer.phone || '-'}</td>
                <td>${petNames}</td>
                <td>${lastVisit}</td>
                <td>${customer.visits || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary view-customer" data-id="${customer.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary edit-customer" data-id="${customer.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // 버튼 이벤트 추가
        document.querySelectorAll('.view-customer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const customerId = btn.dataset.id;
                // 고객 상세 보기 모달 열기
                openCustomerModal(customerId, 'view');
            });
        });
        
        document.querySelectorAll('.edit-customer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const customerId = btn.dataset.id;
                // 고객 수정 모달 열기
                openCustomerModal(customerId, 'edit');
            });
        });
    } catch (error) {
        console.error('고객 테이블 렌더링 중 오류:', error);
        ToastNotification.show('고객 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 고객 검색 함수
function searchCustomers(searchTerm) {
    try {
        if (!searchTerm || searchTerm.trim() === '') {
            renderCustomersTable();
            return;
        }
        
        const searchTermLower = searchTerm.toLowerCase();
        const customers = JSON.parse(localStorage.getItem('customers') || '[]');
        
        const filteredCustomers = customers.filter(customer => {
            return (
                (customer.name && customer.name.toLowerCase().includes(searchTermLower)) ||
                (customer.phone && customer.phone.includes(searchTerm)) ||
                (customer.pets && customer.pets.some(pet => 
                    pet.name && pet.name.toLowerCase().includes(searchTermLower)
                ))
            );
        });
        
        const tbody = document.querySelector('#customers-table tbody');
        if (!tbody) {
            console.error('고객 테이블을 찾을 수 없습니다.');
            return;
        }
        
        tbody.innerHTML = '';
        
        if (filteredCustomers.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="text-center">검색 결과가 없습니다.</td>';
            tbody.appendChild(tr);
            return;
        }
        
        filteredCustomers.forEach(customer => {
            const tr = document.createElement('tr');
            
            // 최근 방문일
            let lastVisit = '없음';
            if (customer.lastVisit) {
                lastVisit = new Date(customer.lastVisit).toLocaleDateString('ko-KR');
            }
            
            // 반려동물 이름 목록
            const petNames = customer.pets ? customer.pets.map(p => p.name).join(', ') : '-';
            
            tr.innerHTML = `
                <td>${customer.name || '-'}</td>
                <td>${customer.phone || '-'}</td>
                <td>${petNames}</td>
                <td>${lastVisit}</td>
                <td>${customer.visits || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary view-customer" data-id="${customer.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary edit-customer" data-id="${customer.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // 버튼 이벤트 추가
        document.querySelectorAll('.view-customer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const customerId = btn.dataset.id;
                openCustomerModal(customerId, 'view');
            });
        });
        
        document.querySelectorAll('.edit-customer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const customerId = btn.dataset.id;
                openCustomerModal(customerId, 'edit');
            });
        });
    } catch (error) {
        console.error('고객 검색 중 오류:', error);
        ToastNotification.show('고객 검색 중 오류가 발생했습니다.', 'error');
    }
}

// 계정 모달 열기
function openAccountModal(email = null) {
    try {
        const modal = document.getElementById('account-modal');
        const form = document.getElementById('account-form');
        
        if (!modal || !form) {
            console.error('계정 모달 또는 폼을 찾을 수 없습니다.');
            return;
        }
        
        form.reset();
        
        // 모달 제목 설정
        const modalTitle = document.getElementById('account-modal-title');
        if (modalTitle) {
            modalTitle.textContent = email ? '계정 수정' : '계정 추가';
        }
        
        // 기존 계정 정보 불러오기
        if (email) {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.email === email);
            
            if (user) {
                document.getElementById('account-id').value = user.id || '';
                document.getElementById('account-email').value = user.email;
                document.getElementById('account-name').value = user.name;
                document.getElementById('account-phone').value = user.phone || '';
                document.getElementById('account-memo').value = user.memo || '';
                
                // 권한 설정
                if (user.role === 'admin') {
                    document.getElementById('role-admin').checked = true;
                } else {
                    document.getElementById('role-staff').checked = true;
                }
                
                // 수정 시에는 비밀번호 필드를 선택사항으로 변경
                const passwordInput = document.getElementById('account-password');
                const passwordLabel = document.querySelector('#password-group label');
                
                if (passwordInput) passwordInput.required = false;
                if (passwordLabel) passwordLabel.textContent = '비밀번호 (변경시에만 입력)';
            }
        } else {
            // 신규 계정인 경우 비밀번호 필수
            const passwordInput = document.getElementById('account-password');
            const passwordLabel = document.querySelector('#password-group label');
            
            if (passwordInput) passwordInput.required = true;
            if (passwordLabel) passwordLabel.textContent = '비밀번호';
            document.getElementById('account-id').value = '';
        }
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('계정 모달 열기 중 오류:', error);
        ToastNotification.show('계정 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 계정 목록 테이블 렌더링 함수
function renderAccountsTable() {
    try {
        const tbody = document.querySelector('#accounts-table tbody');
        if (!tbody) {
            console.error('계정 테이블을 찾을 수 없습니다.');
            return;
        }
        
        tbody.innerHTML = '';
        
        // 로컬 스토리지에서 사용자 목록 가져오기
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        if (users.length === 0) {
            // 사용자 데이터가 없는 경우 메시지 표시
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="text-center">등록된 계정이 없습니다.</td>';
            tbody.appendChild(tr);
            return;
        }
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${user.role === 'admin' ? '관리자' : '직원'}</td>
                <td>${user.email || '-'}</td>
                <td>${user.name || '-'}</td>
                <td>${user.phone || '-'}</td>
                <td>${user.memo || '-'}</td>
                <td>
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-sm btn-secondary edit-account" data-id="${user.email}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-account" data-id="${user.email}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '-'}
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // 계정 수정/삭제 버튼 이벤트 추가
        document.querySelectorAll('.edit-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const userEmail = btn.dataset.id;
                openAccountModal(userEmail);
            });
        });
        
        document.querySelectorAll('.delete-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const userEmail = btn.dataset.id;
                if (confirm(`"${userEmail}" 계정을 삭제하시겠습니까?`)) {
                    deleteAccount(userEmail);
                }
            });
        });
    } catch (error) {
        console.error('계정 테이블 렌더링 중 오류:', error);
        ToastNotification.show('계정 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 계정 삭제 함수
function deleteAccount(email) {
    try {
        if (!email) return;
        
        // 로컬 스토리지에서 사용자 목록 가져오기
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        // 해당 이메일의 계정 제외하고 새 배열 생성
        const updatedUsers = users.filter(user => user.email !== email);
        
        // 로컬 스토리지에 저장
        localStorage.setItem('users', JSON.stringify(updatedUsers));
        
        // 테이블 다시 렌더링
        renderAccountsTable();
        
        ToastNotification.show('계정이 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('계정 삭제 중 오류:', error);
        ToastNotification.show('계정 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 계정 정보 저장 (폼에서)
function saveAccountFromForm() {
    try {
        // 폼 데이터 수집
        const accountId = document.getElementById('account-id').value;
        const email = document.getElementById('account-email').value;
        const password = document.getElementById('account-password').value;
        const name = document.getElementById('account-name').value;
        const phone = document.getElementById('account-phone').value;
        const memo = document.getElementById('account-memo').value;
        const role = document.querySelector('input[name="role"]:checked').value;
        
        // 로컬 스토리지에서 사용자 목록 가져오기
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        // 이메일 중복 확인 (신규 계정인 경우)
        if (!accountId) {
            const existingUser = users.find(user => user.email === email);
            if (existingUser) {
                ToastNotification.show('이미 등록된 이메일 주소입니다.', 'error');
                return;
            }
        }
        
        // 기존 계정 수정 또는 신규 계정 추가
        if (accountId) {
            // 기존 계정 수정
            const userIndex = users.findIndex(user => user.id === accountId);
            
            if (userIndex !== -1) {
                users[userIndex] = {
                    ...users[userIndex],
                    email,
                    name,
                    phone,
                    memo,
                    role,
                    updatedAt: new Date().toISOString()
                };
                
                // 비밀번호가 입력된 경우에만 업데이트
                if (password) {
                    users[userIndex].password = password; // 실제로는 암호화 필요
                }
                
                ToastNotification.show('계정 정보가 수정되었습니다.', 'success');
            } else {
                ToastNotification.show('계정을 찾을 수 없습니다.', 'error');
                return;
            }
        } else {
            // 신규 계정 추가
            const newUser = {
                id: Date.now().toString(),
                email,
                password, // 실제로는 암호화 필요
                name,
                phone,
                memo,
                role,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            users.push(newUser);
            ToastNotification.show('새 계정이 추가되었습니다.', 'success');
        }
        
        // 로컬 스토리지에 저장
        localStorage.setItem('users', JSON.stringify(users));
        
        // 모달 닫기
        document.getElementById('account-modal').style.display = 'none';
        
        // 계정 목록 다시 렌더링
        renderAccountsTable();
    } catch (error) {
        console.error('계정 저장 중 오류:', error);
        ToastNotification.show('계정 정보 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 고객 정보 저장 (폼에서)
function saveCustomerFromForm() {
    try {
        // 폼 데이터 수집
        const customerId = document.getElementById('customer-id')?.value;
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const memo = document.getElementById('customer-memo').value;
        const alimtalkConsent = document.getElementById('customer-alimtalk-consent').checked;
        
        // 반려동물 정보 수집
        const petContainers = document.querySelectorAll('#customer-pet-containers .pet-container');
        const pets = Array.from(petContainers).map((container, index) => {
            // 인덱스 번호를 사용하여 ID 생성 (1부터 시작)
            const petIndex = index + 1;
            
            // 명확한 ID로 요소 찾기
            const petName = document.getElementById(`customer-pet-name-${petIndex}`)?.value || '';
            const petBreed = document.getElementById(`customer-pet-breed-${petIndex}`)?.value || '';
            const petWeight = parseFloat(document.getElementById(`customer-pet-weight-${petIndex}`)?.value) || 0;
            const petAge = parseInt(document.getElementById(`customer-pet-age-${petIndex}`)?.value) || null;
            const petMemo = document.getElementById(`customer-pet-memo-${petIndex}`)?.value || '';
            
            return {
                id: Date.now().toString() + index,
                name: petName,
                breed: petBreed,
                weight: petWeight,
                age: petAge,
                memo: petMemo
            };
        });
        
        // 로컬 스토리지에서 고객 목록 가져오기
        const customers = JSON.parse(localStorage.getItem('customers') || '[]');
        
        // 기존 고객 수정 또는 신규 고객 추가
        if (customerId) {
            // 기존 고객 수정
            const customerIndex = customers.findIndex(c => c.id === customerId);
            
            if (customerIndex !== -1) {
                customers[customerIndex] = {
                    ...customers[customerIndex],
                    name,
                    phone,
                    memo,
                    alimtalkConsent,
                    pets,
                    updatedAt: new Date().toISOString()
                };
                
                ToastNotification.show('고객 정보가 수정되었습니다.', 'success');
            } else {
                ToastNotification.show('고객을 찾을 수 없습니다.', 'error');
                return;
            }
        } else {
            // 신규 고객 추가
            const newCustomer = {
                id: Date.now().toString(),
                name,
                phone,
                memo,
                alimtalkConsent,
                pets,
                visits: 0,
                lastVisit: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            customers.push(newCustomer);
            ToastNotification.show('새 고객이 등록되었습니다.', 'success');
        }
        
        // 로컬 스토리지에 저장
        localStorage.setItem('customers', JSON.stringify(customers));
        
        // 모달 닫기
        document.getElementById('customer-modal').style.display = 'none';
        
        // 고객 목록 다시 렌더링
        renderCustomersTable();
    } catch (error) {
        console.error('고객 저장 중 오류:', error);
        ToastNotification.show('고객 정보 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 엑셀 양식 다운로드 함수
function downloadExcelTemplate() {
    try {
        // CSV 데이터 생성
        const headers = ['이름', '전화번호', '반려동물명', '품종', '몸무게(kg)', '나이', '반려동물 메모', '보호자 메모', '알림톡 수신동의'];
        const sampleData = [
            ['김고객', '010-1234-5678', '쿠키', '말티즈', '3.5', '4', '털이 긴 편입니다', '첫 방문시 긴장함', 'O'],
            ['이고객', '010-8765-4321', '몽이', '푸들', '4.2', '3', '귀 청소 필요', '예민함', 'X'],
            ['박고객', '010-5555-6666', '초코', '비숑', '2.8', '2', '발톱이 검은색', '', 'O']
        ];
        
        // 행 생성
        let csv = headers.join(',') + '\n';
        
        // 샘플 데이터 행 추가
        sampleData.forEach(row => {
            csv += row.join(',') + '\n';
        });
        
        // 파일 다운로드
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', '고객정보_양식.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        ToastNotification.show('고객정보 엑셀 양식이 다운로드되었습니다.', 'success');
    } catch (error) {
        console.error('엑셀 양식 다운로드 중 오류:', error);
        ToastNotification.show('엑셀 양식 다운로드 중 오류가 발생했습니다.', 'error');
    }
}

// 엑셀 양식 다운로드 기능
function downloadCustomerTemplate() {
    try {
        // CSV 파일의 헤더와 샘플 데이터
        const csvHeader = "보호자명,휴대폰번호,알림톡수신동의,메모,반려동물명,품종,몸무게,나이,반려동물메모";
        const sampleData = "홍길동,010-1234-5678,O,VIP고객,초코,말티즈,3.5,5,목욕만 가능";
        
        // CSV 파일 내용 생성 (BOM 포함하여 UTF-8로 인코딩)
        const csvContent = "\uFEFF" + csvHeader + "\n" + sampleData;
        
        // Blob 생성 (UTF-8로 인코딩)
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        
        // 파일 다운로드 링크 생성
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "고객등록_양식.csv";
        
        // 링크 클릭하여 다운로드
        document.body.appendChild(link);
        link.click();
        
        // 리소스 정리
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        ToastNotification.show('엑셀 양식이 다운로드되었습니다.', 'success');
    } catch (error) {
        console.error('엑셀 양식 다운로드 중 오류:', error);
        ToastNotification.show('엑셀 양식 다운로드 중 오류가 발생했습니다.', 'error');
    }
}

// 이벤트 초기화 함수
function initEvents() {
    // ... existing code ...
    
    // 엑셀 양식 다운로드 버튼 이벤트
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadCustomerTemplate);
    }
    
    // ... existing code ...
}

// 모바일 최적화 기능
function initMobileOptimization() {
    // 화면 너비 확인하는 함수
    function checkMobileView() {
        const isMobile = window.innerWidth < 768;
        const wrapper = document.querySelector('.wrapper');
        
        if (isMobile) {
            // 모바일 화면일 때 적용할 변경사항
            wrapper.classList.add('mobile-view');
            
            // 모바일에서는 기본적으로 사이드바 접기
            wrapper.classList.add('sidebar-collapsed');
            
            // 모바일에서 달력 보기 최적화
            document.querySelectorAll('.view-btn').forEach(btn => {
                if (btn.dataset.view === 'day') {
                    // 모바일에서는 기본 일간 뷰로 설정
                    btn.click();
                }
            });
            
            // 고객 테이블에서 일부 열 숨기기
            const customerTable = document.getElementById('customers-table');
            if (customerTable) {
                // 방문횟수 열 숨기기 (모바일에서는 필수 정보만 표시)
                const visitsColumn = customerTable.querySelectorAll('th:nth-child(5), td:nth-child(5)');
                visitsColumn.forEach(cell => {
                    cell.style.display = 'none';
                });
            }
        } else {
            // 데스크톱 화면으로 돌아갔을 때
            wrapper.classList.remove('mobile-view');
            
            // 숨겨진 열 다시 표시
            const customerTable = document.getElementById('customers-table');
            if (customerTable) {
                const visitsColumn = customerTable.querySelectorAll('th:nth-child(5), td:nth-child(5)');
                visitsColumn.forEach(cell => {
                    cell.style.display = '';
                });
            }
        }
    }
    
    // 초기 로드 시 체크
    checkMobileView();
    
    // 화면 크기 변경 시 체크
    window.addEventListener('resize', checkMobileView);
    
    // 모달 크기 조정
    function adjustModalSize() {
        const modals = document.querySelectorAll('.modal');
        const isMobile = window.innerWidth < 768;
        
        modals.forEach(modal => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                if (isMobile) {
                    // 모바일에서는 모달이 화면을 거의 다 차지하도록
                    modalContent.style.width = '95%';
                    modalContent.style.maxWidth = '95%';
                    modalContent.style.maxHeight = '90vh';
                    modalContent.style.margin = '5vh auto';
                } else {
                    // 데스크톱에서는 기본 스타일로
                    modalContent.style.width = '';
                    modalContent.style.maxWidth = '';
                    modalContent.style.maxHeight = '';
                    modalContent.style.margin = '';
                }
            }
        });
    }
    
    // 초기 로드 시 모달 크기 조정
    adjustModalSize();
    
    // 화면 크기 변경 시 모달 크기 조정
    window.addEventListener('resize', adjustModalSize);
}

// 문서 로드 완료 시 추가 모바일 최적화 적용
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    
    // 모바일 최적화 초기화
    initMobileOptimization();
    
    // ... existing code ...
});

// 알림톡 편집 모달 열기
function openAlimtalkEditModal() {
    try {
        const modal = document.getElementById('alimtalk-edit-modal');
        if (!modal) {
            console.error('알림톡 편집 모달을 찾을 수 없습니다.');
            ToastNotification.show('알림톡 편집 모달을 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 현재 선택된 알림톡 템플릿 가져오기
        const selectedOption = document.querySelector('input[name="alimtalk-option"]:checked').value;
        
        // 선택된 옵션이 없거나 'none'인 경우 처리
        if (!selectedOption || selectedOption === 'none') {
            ToastNotification.show('먼저 알림톡 옵션을 선택해주세요.', 'warning');
            return;
        }
        
        // 현재 템플릿 내용 가져오기
        let templateContent = '';
        if (selectedOption === 'default') {
            templateContent = alimtalkTemplates.reservation;
        } else if (selectedOption === 'reminder') {
            templateContent = alimtalkTemplates.reminder;
        } else if (selectedOption === 'completed') {
            templateContent = alimtalkTemplates.completed;
        } else {
            templateContent = '안녕하세요, {{매장명}}입니다.\n{{보호자명}} 고객님, {{예약날짜}}에 {{반려동물명}}의 {{서비스명}} 예약이 완료되었습니다.\n문의사항은 {{매장번호}}로 연락주세요.';
        }
        
        // 템플릿 내용을 모달에 설정
        const templateTextarea = document.getElementById('alimtalk-template-text');
        if (templateTextarea) {
            templateTextarea.value = templateContent;
        }
        
        // 사용 가능한 변수 안내 업데이트
        updateAvailableVariables();
        
        // 모달 표시
        modal.style.display = 'block';
    } catch (error) {
        console.error('알림톡 편집 모달 열기 중 오류:', error);
        ToastNotification.show('알림톡 편집 모달을 여는 중 오류가 발생했습니다.', 'error');
    }
}

// 사용 가능한 변수 목록 업데이트
function updateAvailableVariables() {
    const variablesContainer = document.getElementById('alimtalk-variables');
    if (!variablesContainer) return;
    
    // 사용 가능한 변수 목록
    const variables = [
        { name: '{{매장명}}', description: '미용실 이름' },
        { name: '{{매장번호}}', description: '미용실 전화번호' },
        { name: '{{보호자명}}', description: '고객 이름' },
        { name: '{{예약날짜}}', description: '예약 날짜와 시간' },
        { name: '{{반려동물명}}', description: '반려동물 이름' },
        { name: '{{서비스명}}', description: '예약한 서비스' }
    ];
    
    // 변수 목록 렌더링
    variablesContainer.innerHTML = '';
    variables.forEach(variable => {
        const variableElement = document.createElement('div');
        variableElement.className = 'alimtalk-variable';
        variableElement.innerHTML = `
            <span class="variable-name">${variable.name}</span>
            <span class="variable-description">${variable.description}</span>
        `;
        
        // 변수 클릭 시 템플릿에 추가
        variableElement.addEventListener('click', () => {
            const templateTextarea = document.getElementById('alimtalk-template-text');
            if (templateTextarea) {
                const currentPosition = templateTextarea.selectionStart;
                const currentContent = templateTextarea.value;
                
                // 현재 커서 위치에 변수 삽입
                const newContent = 
                    currentContent.substring(0, currentPosition) + 
                    variable.name + 
                    currentContent.substring(currentPosition);
                
                templateTextarea.value = newContent;
                
                // 커서 위치 업데이트
                const newPosition = currentPosition + variable.name.length;
                templateTextarea.setSelectionRange(newPosition, newPosition);
                templateTextarea.focus();
            }
        });
        
        variablesContainer.appendChild(variableElement);
    });
}

// 알림톡 템플릿 저장
function saveAlimtalkTemplate() {
    try {
        const selectedOption = document.querySelector('input[name="alimtalk-option"]:checked').value;
        const templateText = document.getElementById('alimtalk-template-text').value;
        
        // 템플릿이 비어있는지 확인
        if (!templateText.trim()) {
            ToastNotification.show('템플릿 내용을 입력해주세요.', 'error');
            return;
        }
        
        // 템플릿 저장
        if (selectedOption === 'default') {
            alimtalkTemplates.reservation = templateText;
        } else if (selectedOption === 'reminder') {
            alimtalkTemplates.reminder = templateText;
        } else if (selectedOption === 'completed') {
            alimtalkTemplates.completed = templateText;
        }
        
        // 로컬 스토리지에 템플릿 저장
        localStorage.setItem('alimtalkTemplates', JSON.stringify(alimtalkTemplates));
        
        // 미리보기 업데이트
        updateAlimtalkPreviews();
        
        // 모달 닫기
        document.getElementById('alimtalk-edit-modal').style.display = 'none';
        
        ToastNotification.show('알림톡 템플릿이 저장되었습니다.', 'success');
    } catch (error) {
        console.error('알림톡 템플릿 저장 중 오류:', error);
        ToastNotification.show('알림톡 템플릿 저장 중 오류가 발생했습니다.', 'error');
    }
}

// 고객 관리 폼에 반려동물 정보 추가
function addCustomerPetForm() {
    try {
        const petContainers = document.getElementById('customer-pet-containers');
        if (!petContainers) {
            console.error('반려동물 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        const petCount = petContainers.querySelectorAll('.pet-container').length + 1;
        
        const newPetContainer = document.createElement('div');
        newPetContainer.className = 'pet-container';
        newPetContainer.innerHTML = `
            <div class="form-header">
                <h4>반려동물 #${petCount}</h4>
                <button type="button" class="btn btn-sm btn-danger remove-pet-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="customer-pet-name-${petCount}">반려동물명</label>
                    <input type="text" id="customer-pet-name-${petCount}" class="form-control pet-name" required>
                </div>
                <div class="form-group">
                    <label for="customer-pet-breed-${petCount}">품종</label>
                    <input type="text" id="customer-pet-breed-${petCount}" class="form-control pet-breed" required>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="customer-pet-weight-${petCount}">몸무게(kg)</label>
                    <input type="number" id="customer-pet-weight-${petCount}" class="form-control pet-weight" step="0.1" required>
                </div>
                <div class="form-group">
                    <label for="customer-pet-age-${petCount}">나이</label>
                    <input type="number" id="customer-pet-age-${petCount}" class="form-control pet-age">
                </div>
            </div>
            <div class="form-group">
                <label for="customer-pet-memo-${petCount}">반려동물 메모</label>
                <textarea id="customer-pet-memo-${petCount}" class="form-control pet-memo"></textarea>
            </div>
        `;
        
        // 삭제 버튼 이벤트 추가
        const removeBtn = newPetContainer.querySelector('.remove-pet-btn');
        removeBtn.addEventListener('click', function() {
            petContainers.removeChild(newPetContainer);
            
            // 남은 반려동물 컨테이너들의 번호 다시 매기기
            const remainingContainers = petContainers.querySelectorAll('.pet-container');
            remainingContainers.forEach((container, index) => {
                const petNumber = index + 1;
                container.querySelector('.form-header h4').textContent = `반려동물 #${petNumber}`;
            });
        });
        
        petContainers.appendChild(newPetContainer);
    } catch (error) {
        console.error('반려동물 폼 추가 중 오류:', error);
        ToastNotification.show('반려동물 정보 폼을 추가하는 중 오류가 발생했습니다.', 'error');
    }
}

// 예약 통계 업데이트
async function updateAppointmentStats() {
    try {
        // 현재 날짜에 대한 예약 통계 계산
        const dateStr = formatDate(currentDate);
        
        // 예약 데이터가 없는 경우 API에서 가져오기
        if (appointments.filter(app => app.date === dateStr).length === 0) {
            console.log('통계: 현재 날짜의 예약 데이터가 없어 API에서 가져옵니다.');
            try {
                const response = await API.getAppointmentsByDate(dateStr);
                if (response && response.appointments) {
                    // 기존 다른 날짜의 데이터는 유지
                    appointments = appointments.filter(app => app.date !== dateStr);
                    appointments = [...appointments, ...response.appointments];
                }
            } catch (error) {
                console.error('예약 데이터 조회 오류:', error);
            }
        }
        
        // 현재 날짜의 예약만 필터링
        const todayAppointments = appointments.filter(app => app.date === dateStr);
        
        // 상태별 카운트
        const reserved = todayAppointments.filter(app => app.status === 'reserved').length;
        const completed = todayAppointments.filter(app => app.status === 'completed').length;
        const cancelled = todayAppointments.filter(app => app.status === 'cancelled').length;
        const total = todayAppointments.length;
        
        // 통계 요소 업데이트
        const statsElements = {
            'total-appointments': total,
            'reserved-count': reserved,
            'completed-count': completed,
            'cancelled-count': cancelled
        };
        
        // 각 통계 요소 업데이트
        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // 다음 예약 정보 업데이트
        updateNextAppointment(todayAppointments);
        
        console.log('예약 통계 업데이트 완료');
    } catch (error) {
        console.error('예약 통계 업데이트 중 오류:', error);
    }
}

// 다음 예약 정보 업데이트
function updateNextAppointment(appointments) {
    const nextAppointmentElement = document.getElementById('next-appointment');
    if (!nextAppointmentElement) return;
    
    // 현재 시간 이후의 예약 중 가장 빠른 예약 찾기
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    // 예약 중 현재 시간 이후의 것만 필터링하고 시간순 정렬
    const upcomingAppointments = appointments
        .filter(app => app.status === 'reserved' && app.startTime >= currentTimeString)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    if (upcomingAppointments.length > 0) {
        // 다음 예약 가져오기
        const nextAppointment = upcomingAppointments[0];
        
        // 다음 예약 정보 표시
        nextAppointmentElement.innerHTML = `
            <div class="time">${nextAppointment.startTime}</div>
            <div class="customer-info">
                <span class="name">${nextAppointment.guardian.name}</span>
                <span class="pet">${nextAppointment.pets.map(p => p.name).join(', ')}</span>
            </div>
            <div class="service">${nextAppointment.service}</div>
        `;
        nextAppointmentElement.style.display = 'flex';
    } else {
        // 다음 예약이 없는 경우
        nextAppointmentElement.innerHTML = '<div class="no-appointment">오늘 남은 예약이 없습니다.</div>';
        nextAppointmentElement.style.display = 'flex';
    }
}
