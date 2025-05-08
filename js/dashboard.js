import { API } from './api.js';
import { LoadingIndicator, ToastNotification, ConfirmDialog, Pagination, SearchFilter, Calendar } from './components.js';

// 전역 변수들
let currentUser = null;
let appointments = [];
let customers = [];
let staffMembers = [];
let sales = [];
let currentDate = new Date();
let currentView = 'day'; // day, week, month
let selectedStaffId = 'all';
let isLoading = false;

// 매출 차트
let salesChart = null;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 인증 확인
        const token = sessionStorage.getItem('token');
        const userJson = sessionStorage.getItem('currentUser');
        
        if (!token || !userJson) {
            // 로그인하지 않은 경우 로그인 페이지로 이동
            window.location.href = 'index.html';
            return;
        }

        currentUser = JSON.parse(userJson);
        
        // 사용자 이름 표시
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('sidebar-user-name').textContent = currentUser.name;
        
        // 로딩 인디케이터 표시
        LoadingIndicator.show('데이터를 불러오는 중...');
        
        // 데이터 초기화
        await initData();
        
        // 이벤트 리스너 등록
        initEventListeners();
        
        // 사이드바 메뉴 활성화
        initSidebar();
        
        // 초기 페이지 로드 (예약관리)
        updateCalendarHeader();
        initCalendarView();
        await loadCalendar();
        
        // 네트워크 상태 감지 초기화
        initNetworkStatus();
        
        // 로딩 인디케이터 숨김
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        ToastNotification.show(`초기화 중 오류가 발생했습니다: ${error.message}`, 'error');
        console.error('초기화 오류:', error);
    }
});

// 네트워크 상태 감지 초기화
function initNetworkStatus() {
    // 온라인/오프라인 상태 배너
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
    
    // 초기 상태 확인
    if (!navigator.onLine) {
        offlineBanner.classList.add('show');
    }
    
    // 네트워크 상태 이벤트
    window.addEventListener('online', () => {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.classList.remove('show');
        }
        ToastNotification.show('인터넷 연결이 복구되었습니다.', 'success');
    });
    
    window.addEventListener('offline', () => {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.classList.add('show');
        }
        ToastNotification.show('인터넷 연결이 끊겼습니다. 연결 상태를 확인해주세요.', 'error');
    });
}

// 데이터 초기화 (API에서 데이터 가져오기)
async function initData() {
    try {
        isLoading = true;
        
        // 직원 데이터 로드
        const staffResponse = await API.getStaff();
        staffMembers = staffResponse.staffMembers || [];
        
        // 고객 데이터 로드 (첫 페이지만)
        const customersResponse = await API.getCustomers(1, 50);
        customers = customersResponse.customers || [];
        
        // 예약 데이터 로드 (오늘 날짜)
        const todayStr = formatDate(new Date());
        const appointmentsResponse = await API.getAppointmentsByDate(todayStr);
        appointments = appointmentsResponse.appointments || [];
        
        // 매출 데이터 로드 (오늘 날짜)
        const salesResponse = await API.getSalesByPeriod(todayStr, todayStr);
        sales = salesResponse.sales || [];
        
        isLoading = false;
    } catch (error) {
        isLoading = false;
        console.error('데이터 초기화 중 오류:', error);
        throw error;
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
    document.getElementById('sale-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveSaleFromForm();
    });
    
    // 매출 등록 취소 버튼
    document.getElementById('cancel-sale-btn').addEventListener('click', () => {
        document.getElementById('sale-modal').style.display = 'none';
    });
}

// 예약관리 페이지 이벤트
function initAppointmentEvents() {
    // 날짜 네비게이션
    document.getElementById('prev-nav').addEventListener('click', () => {
        navigateCalendar(-1);
    });
    
    document.getElementById('next-nav').addEventListener('click', () => {
        navigateCalendar(1);
    });
    
    // 오늘 버튼 이벤트
    document.getElementById('today-btn').addEventListener('click', () => {
        navigateToToday();
    });
    
    // 현재 날짜 클릭 이벤트 (날짜를 클릭하면 데이트피커 표시)
    document.getElementById('current-date').addEventListener('click', function() {
        console.log('현재 날짜 클릭됨');
        
        // 기존 datepicker 제거
        const oldInput = document.getElementById('date-picker-input');
        if (oldInput) {
            oldInput.remove();
        }
        
        // 새로운 date input 생성
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.id = 'date-picker-input';
        dateInput.style.position = 'absolute';
        dateInput.style.top = '70px';
        dateInput.style.left = '50%';
        dateInput.style.transform = 'translateX(-50%)';
        dateInput.style.zIndex = '1000';
        dateInput.style.padding = '10px';
        dateInput.style.border = '1px solid var(--gray-300)';
        dateInput.style.borderRadius = 'var(--border-radius-md)';
        dateInput.style.backgroundColor = 'white';
        dateInput.style.boxShadow = 'var(--shadow-md)';
        
        // 오늘 날짜 설정
        const today = new Date();
        const year = today.getFullYear();
        let month = (today.getMonth() + 1).toString().padStart(2, '0');
        let day = today.getDate().toString().padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
        
        document.body.appendChild(dateInput);
        
        // 포커스 아웃 시 숨김
        dateInput.addEventListener('blur', function() {
            setTimeout(() => {
                dateInput.remove();
            }, 200);
        });
        
        // 날짜 선택 시 해당 날짜로 이동
        dateInput.addEventListener('change', function(e) {
            const selectedDate = new Date(e.target.value);
            console.log('선택된 날짜:', selectedDate);
            
            if (!isNaN(selectedDate.getTime())) {
                currentDate = selectedDate;
                // 일간 뷰로 변경
                currentView = 'day';
                
                // 뷰 버튼 업데이트
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.view === 'day') {
                        btn.classList.add('active');
                    }
                });
                
                updateCalendarHeader();
                loadCalendar();
            }
            
            // 선택 후 숨김
            dateInput.remove();
        });
        
        // 바로 포커스 및 클릭
        setTimeout(() => {
            dateInput.focus();
            dateInput.click();
        }, 100);
    });
    
    // 캘린더 뷰 전환 이벤트
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 기존 활성화된 버튼 비활성화
            viewBtns.forEach(b => b.classList.remove('active'));
            
            // 클릭한 버튼 활성화
            btn.classList.add('active');
            
            // 선택한 뷰 저장 및 캘린더 로드
            currentView = btn.dataset.view;
            updateCalendarHeader();
            loadCalendar();
        });
    });
    
    // 디자이너 필터 이벤트
    document.getElementById('calendar-staff-filter').addEventListener('change', (e) => {
        selectedStaffId = e.target.value;
        loadCalendar();
    });
    
    // 신규 예약 버튼
    document.getElementById('new-appointment-btn').addEventListener('click', () => {
        openAppointmentModal();
    });
    
    // 예약 폼 제출
    const appointmentForm = document.getElementById('appointment-form');
    appointmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAppointment();
    });
    
    // 취소 버튼
    document.getElementById('cancel-appointment-btn').addEventListener('click', () => {
        document.getElementById('appointment-modal').style.display = 'none';
    });
    
    // 서비스 버튼 클릭 이벤트
    const serviceBtns = document.querySelectorAll('.service-btn');
    serviceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 기존 활성화된 버튼 비활성화
            serviceBtns.forEach(b => b.classList.remove('active'));
            
            // 클릭한 버튼 활성화
            btn.classList.add('active');
            
            // 선택한 서비스 저장
            document.getElementById('selected-service').value = btn.dataset.service;
            
            // 종료 시간 자동 계산
            updateEndTime(btn.dataset.duration);
        });
    });
    
    // 반려동물 추가 버튼
    document.getElementById('add-pet-btn').addEventListener('click', addPetForm);
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
    
    // 엑셀 일괄 등록 버튼
    document.getElementById('import-customers-btn').addEventListener('click', () => {
        ToastNotification.show('엑셀 일괄 등록 기능은 곧 추가될 예정입니다.', 'info');
    });
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
    } catch (error) {
        console.error('캘린더 초기화 중 오류:', error);
        ToastNotification.show('캘린더 초기화 중 오류가 발생했습니다.', 'error');
    }
}

// 달력 헤더 날짜 업데이트
function updateCalendarHeader() {
    try {
        let options;
        
        // 뷰에 따라 표시 형식 변경
        if (currentView === 'day') {
            options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            document.getElementById('current-date').textContent = currentDate.toLocaleDateString('ko-KR', options);
        } else if (currentView === 'week') {
            // 주간 뷰는 시작일과 종료일을 표시
            const weekStart = new Date(currentDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 이번 주 일요일
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6); // 이번 주 토요일
            
            const startOptions = { month: 'long', day: 'numeric' };
            const endOptions = { year: 'numeric', month: 'long', day: 'numeric' };
            
            const startStr = weekStart.toLocaleDateString('ko-KR', startOptions);
            const endStr = weekEnd.toLocaleDateString('ko-KR', endOptions);
            
            document.getElementById('current-date').textContent = `${startStr} - ${endStr}`;
        } else if (currentView === 'month') {
            // 월간 뷰는 연월만 표시
            options = { year: 'numeric', month: 'long' };
            document.getElementById('current-date').textContent = currentDate.toLocaleDateString('ko-KR', options);
        }
        
        // 예약 폼의 기본 날짜를 현재 선택된 날짜로 설정
        const dateInput = document.getElementById('appointment-date');
        dateInput.value = formatDate(currentDate);
    } catch (error) {
        console.error('달력 헤더 업데이트 중 오류:', error);
    }
}

// 날짜 포맷 변환 (YYYY-MM-DD)
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
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
        if (isLoading) return; // 로딩 중이면 이벤트 무시
        
        currentDate = new Date();
        updateCalendarHeader();
        await loadCalendar();
    } catch (error) {
        console.error('오늘 날짜로 이동 중 오류:', error);
        ToastNotification.show('오늘 날짜로 이동 중 오류가 발생했습니다.', 'error');
    }
}

// 캘린더 메인 로드 함수
async function loadCalendar() {
    try {
        if (isLoading) return;
        isLoading = true;
        
        // 로딩 표시 (빠른 로딩을 위해 짧게 표시)
        const loadingTimeout = setTimeout(() => {
            LoadingIndicator.show('캘린더 정보를 불러오는 중...');
        }, 300);
        
        // 모든 캘린더 뷰 숨기기
        document.querySelectorAll('.calendar-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // 선택된 뷰 표시
        if (currentView === 'day') {
            document.getElementById('day-view').classList.add('active');
            await loadDayView();
        } else if (currentView === 'week') {
            document.getElementById('week-view').classList.add('active');
            await loadWeekView();
        } else if (currentView === 'month') {
            document.getElementById('month-view').classList.add('active');
            await loadMonthView();
        }
        
        // 통계 업데이트
        await updateAppointmentStats();
        
        clearTimeout(loadingTimeout);
        LoadingIndicator.hide();
        isLoading = false;
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
        
        // 관련 예약 찾기 (있는 경우)
        let customerId, staffId, date;
        
        if (appointmentId) {
            const appointment = appointments.find(a => a.id === appointmentId);
            if (appointment) {
                customerId = appointment.customer_id;
                staffId = appointment.staff_id;
                date = appointment.date;
            }
        } else {
            // 고객 이름으로 고객 ID 찾기 (간단한 구현)
            const customer = customers.find(c => c.name === customerName);
            if (customer) {
                customerId = customer.id;
            }
            
            // 현재 로그인한 사용자를 담당자로
            staffId = currentUser.id;
            
            // 날짜는 오늘
            date = formatDate(new Date());
        }
        
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
        const staffSchedules = document.getElementById('staff-schedules');
        staffSchedules.innerHTML = '';
        
        // 운영 시간 설정
        const startHour = 9;
        const endHour = 19;
        
        // 선택한 날짜의 예약 데이터 가져오기
        const dateStr = formatDate(currentDate);
        const response = await API.getAppointmentsByDate(dateStr, selectedStaffId);
        const dailyAppointments = response.appointments || [];
        
        // 전역 appointments 업데이트
        appointments = appointments.filter(app => app.date !== dateStr);
        appointments = [...appointments, ...dailyAppointments];
        
        // 전체 보기인지, 특정 디자이너 필터링인지 확인
        if (selectedStaffId === 'all') {
            // 모든 디자이너 일정 표시
            const staffList = staffMembers.filter(staff => staff.role !== 'admin');
            
            staffList.forEach(staff => {
                const staffSchedule = createStaffSchedule(staff, startHour, endHour);
                staffSchedules.appendChild(staffSchedule);
            });
        } else {
            // 선택한 디자이너만 표시
            const staff = staffMembers.find(s => s.id === selectedStaffId);
            if (staff) {
                const staffSchedule = createStaffSchedule(staff, startHour, endHour);
                staffSchedules.appendChild(staffSchedule);
            }
        }
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
            
            // 날짜 클릭 시 해당 날짜의 일간 뷰로 이동
            dayColumn.addEventListener('click', () => {
                currentDate = new Date(date);
                currentView = 'day';
                
                // 뷰 버튼 업데이트
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.view === 'day') {
                        btn.classList.add('active');
                    }
                });
                
                updateCalendarHeader();
                loadCalendar();
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
        
        // 날짜별로 예약 정리
        const appointmentsByDate = {};
        monthAppointments.forEach(app => {
            if (!appointmentsByDate[app.date]) {
                appointmentsByDate[app.date] = [];
            }
            appointmentsByDate[app.date].push(app);
        });
        
        // 월간 달력 생성
        let iterDate = new Date(firstWeekStart);
        const today = new Date();
        
        // 모든 날짜 요소를 한꺼번에 생성
        const dayElements = [];
        
        while (iterDate <= lastWeekEnd) {
            const dayDate = new Date(iterDate);
            const dateStr = formatDate(dayDate);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'month-day';
            
            // 현재 월이 아닌 경우 스타일 변경
            if (dayDate.getMonth() !== currentDate.getMonth()) {
                dayElement.classList.add('other-month');
            }
            
            // 오늘 날짜 강조
            if (dayDate.getDate() === today.getDate() && 
                dayDate.getMonth() === today.getMonth() && 
                dayDate.getFullYear() === today.getFullYear()) {
                dayElement.classList.add('today');
            }
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'month-day-header';
            dayHeader.textContent = dayDate.getDate();
            
            const dayContent = document.createElement('div');
            dayContent.className = 'month-day-content';
            dayContent.dataset.date = dateStr;
            
            dayElement.appendChild(dayHeader);
            dayElement.appendChild(dayContent);
            
            // 날짜 클릭 시 해당 날짜의 일간 뷰로 이동
            dayElement.addEventListener('click', () => {
                currentDate = new Date(dayDate);
                currentView = 'day';
                
                // 뷰 버튼 업데이트
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.view === 'day') {
                        btn.classList.add('active');
                    }
                });
                
                updateCalendarHeader();
                loadCalendar();
            });
            
            dayElements.push({
                element: dayElement,
                date: dayDate,
                dateStr
            });
            
            // 다음 날짜로
            iterDate.setDate(iterDate.getDate() + 1);
        }
        
        // 모든 날짜 요소를 DOM에 한꺼번에 추가
        for (const dayData of dayElements) {
            monthBody.appendChild(dayData.element);
        }
        
        // 각 날짜에 예약 정보 추가 (DOM 추가 후 비동기로 처리)
        setTimeout(() => {
            for (const dayData of dayElements) {
                const { element, dateStr } = dayData;
                const dayContent = element.querySelector('.month-day-content');
                
                // 해당 날짜의 예약이 있는 경우
                const dayAppointments = appointmentsByDate[dateStr] || [];
                
                // 최대 3개까지만 표시
                const maxDisplay = 3;
                
                for (let i = 0; i < Math.min(dayAppointments.length, maxDisplay); i++) {
                    const app = dayAppointments[i];
                    const appointmentElement = document.createElement('div');
                    appointmentElement.className = `month-appointment status-${app.status}`;
                    appointmentElement.textContent = `${app.startTime} ${app.guardian.name}`;
                    
                    // 예약 클릭 이벤트
                    appointmentElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // 날짜 클릭 이벤트 방지
                        openSaleModal(app);
                    });
                    
                    dayContent.appendChild(appointmentElement);
                }
                
                // 추가 예약이 있으면 +N 표시
                if (dayAppointments.length > maxDisplay) {
                    const moreElement = document.createElement('div');
                    moreElement.className = 'month-appointment more';
                    moreElement.textContent = `+${dayAppointments.length - maxDisplay}건 더보기`;
                    
                    // 더보기 클릭 시 일간 뷰로 전환
                    moreElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // 날짜 클릭 이벤트 방지
                        
                        currentDate = new Date(dayData.date);
                        currentView = 'day';
                        
                        // 뷰 버튼 업데이트
                        document.querySelectorAll('.view-btn').forEach(btn => {
                            btn.classList.remove('active');
                            if (btn.dataset.view === 'day') {
                                btn.classList.add('active');
                            }
                        });
                        
                        updateCalendarHeader();
                        loadCalendar();
                    });
                    
                    dayContent.appendChild(moreElement);
                }
            }
            
            LoadingIndicator.hide();
        }, 0);
        
    } catch (error) {
        LoadingIndicator.hide();
        console.error('월간 예약 조회 중 오류:', error);
        ToastNotification.show(`월간 예약 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

// 예약 모달 열기
async function openAppointmentModal(time = null, staffId = null) {
    try {
        const modal = document.getElementById('appointment-modal');
        const form = document.getElementById('appointment-form');
        form.reset();
        
        // 날짜 및 시간 초기화
        document.getElementById('appointment-date').value = formatDate(currentDate);
        
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
                        <input type="number" id="pet-weight-1" class="form-control pet-weight" required>
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
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('예약 모달 열기 중 오류:', error);
        ToastNotification.show('예약 창을 여는 중 오류가 발생했습니다.', 'error');
    }
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
                <input type="number" id="pet-weight-${petCount}" class="form-control pet-weight" required>
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

// 고객 모달 열기
async function openCustomerModal(customerId = null, mode = 'add') {
    try {
        LoadingIndicator.show('데이터를 불러오는 중...');
        
        const modal = document.getElementById('customer-modal');
        const form = document.getElementById('customer-form');
        form.reset();
        
        // 모달 제목 설정
        const modalTitle = document.getElementById('customer-modal-title');
        if (mode === 'view') {
            modalTitle.textContent = '고객 정보 조회';
        } else if (mode === 'edit') {
            modalTitle.textContent = '고객 정보 수정';
        } else {
            modalTitle.textContent = '신규 고객 등록';
        }
        
        // 펫 컨테이너 초기화 (하나만 표시)
        document.getElementById('customer-pet-containers').innerHTML = `
            <div class="pet-container">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="customer-pet-name-1">반려동물명</label>
                        <input type="text" id="customer-pet-name-1" class="form-control customer-pet-name" required>
                    </div>
                    <div class="form-group">
                        <label for="customer-pet-breed-1">품종</label>
                        <input type="text" id="customer-pet-breed-1" class="form-control customer-pet-breed" required>
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="customer-pet-weight-1">몸무게(kg)</label>
                        <input type="number" id="customer-pet-weight-1" class="form-control customer-pet-weight" required>
                    </div>
                    <div class="form-group">
                        <label for="customer-pet-age-1">나이</label>
                        <input type="number" id="customer-pet-age-1" class="form-control customer-pet-age">
                    </div>
                </div>
                <div class="form-group">
                    <label for="customer-pet-memo-1">반려동물 메모</label>
                    <textarea id="customer-pet-memo-1" class="form-control customer-pet-memo"></textarea>
                </div>
            </div>
        `;
        
        // 기존 고객 정보 불러오기
        if (customerId) {
            try {
                const response = await API.getCustomer(customerId);
                const customer = response.customer;
                
                if (customer) {
                    document.getElementById('customer-name').value = customer.name;
                    document.getElementById('customer-phone').value = customer.phone;
                    document.getElementById('customer-memo').value = customer.memo || '';
                    document.getElementById('customer-alimtalk-consent').checked = !!customer.alimtalk_consent;
                    
                    // 반려동물 정보 채우기
                    if (customer.pets && customer.pets.length > 0) {
                        document.getElementById('customer-pet-containers').innerHTML = '';
                        
                        customer.pets.forEach((pet, index) => {
                            const petContainer = document.createElement('div');
                            petContainer.className = 'pet-container';
                            
                            petContainer.innerHTML = `
                                <div class="form-grid">
                                    <div class="form-group">
                                       <label for="customer-pet-name-${index+1}">반려동물명</label>
                                        <input type="text" id="customer-pet-name-${index+1}" class="form-control customer-pet-name" value="${pet.name}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="customer-pet-breed-${index+1}">품종</label>
                                        <input type="text" id="customer-pet-breed-${index+1}" class="form-control customer-pet-breed" value="${pet.breed}" required>
                                    </div>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="customer-pet-weight-${index+1}">몸무게(kg)</label>
                                        <input type="number" id="customer-pet-weight-${index+1}" class="form-control customer-pet-weight" value="${pet.weight || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="customer-pet-age-${index+1}">나이</label>
                                        <input type="number" id="customer-pet-age-${index+1}" class="form-control customer-pet-age" value="${pet.age || ''}">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="customer-pet-memo-${index+1}">반려동물 메모</label>
                                    <textarea id="customer-pet-memo-${index+1}" class="form-control customer-pet-memo">${pet.memo || ''}</textarea>
                                </div>
                                <input type="hidden" class="customer-pet-id" value="${pet.id || ''}">
                            `;
                            
                            document.getElementById('customer-pet-containers').appendChild(petContainer);
                        });
                    }
                    
                    // 조회 모드인 경우 폼 비활성화
                    if (mode === 'view') {
                        const inputs = form.querySelectorAll('input, textarea, button');
                        inputs.forEach(input => {
                            input.disabled = true;
                        });
                        
                        // 취소 버튼만 활성화
                        document.getElementById('cancel-customer-btn').disabled = false;
                    }
                }
            } catch (error) {
                console.error('고객 정보 로드 중 오류:', error);
                ToastNotification.show(`고객 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
            }
        }
        
        // 숨겨진 고객 ID 필드 추가 (수정 모드용)
        let hiddenIdField = document.getElementById('customer-id');
        if (!hiddenIdField) {
            hiddenIdField = document.createElement('input');
            hiddenIdField.type = 'hidden';
            hiddenIdField.id = 'customer-id';
            form.appendChild(hiddenIdField);
        }
        hiddenIdField.value = customerId || '';
        
        // 모드 필드 추가
        let hiddenModeField = document.getElementById('customer-mode');
        if (!hiddenModeField) {
            hiddenModeField = document.createElement('input');
            hiddenModeField.type = 'hidden';
            hiddenModeField.id = 'customer-mode';
            form.appendChild(hiddenModeField);
        }
        hiddenModeField.value = mode;
        
        LoadingIndicator.hide();
        modal.style.display = 'block';
    } catch (error) {
        LoadingIndicator.hide();
        console.error('고객 모달 열기 중 오류:', error);
        ToastNotification.show('고객 정보 창을 여는 중 오류가 발생했습니다.', 'error');
    }
}

// 반려동물 폼 추가 (고객 모달용)
function addCustomerPetForm() {
    const petContainers = document.getElementById('customer-pet-containers');
    const petCount = petContainers.childElementCount + 1;
    
    const newPetContainer = document.createElement('div');
    newPetContainer.className = 'pet-container';
    newPetContainer.innerHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label for="customer-pet-name-${petCount}">반려동물명</label>
                <input type="text" id="customer-pet-name-${petCount}" class="form-control customer-pet-name" required>
            </div>
            <div class="form-group">
                <label for="customer-pet-breed-${petCount}">품종</label>
                <input type="text" id="customer-pet-breed-${petCount}" class="form-control customer-pet-breed" required>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="customer-pet-weight-${petCount}">몸무게(kg)</label>
                <input type="number" id="customer-pet-weight-${petCount}" class="form-control customer-pet-weight" required>
            </div>
            <div class="form-group">
                <label for="customer-pet-age-${petCount}">나이</label>
                <input type="number" id="customer-pet-age-${petCount}" class="form-control customer-pet-age">
            </div>
        </div>
        <div class="form-group">
            <label for="customer-pet-memo-${petCount}">반려동물 메모</label>
            <textarea id="customer-pet-memo-${petCount}" class="form-control customer-pet-memo"></textarea>
        </div>
    `;
    
    petContainers.appendChild(newPetContainer);
}

// 고객 정보 저장 (폼에서)
async function saveCustomerFromForm() {
    try {
        LoadingIndicator.show('고객 정보 저장 중...');
        
        const customerId = document.getElementById('customer-id').value;
        const mode = document.getElementById('customer-mode').value;
        
        // 조회 모드인 경우 저장하지 않음
        if (mode === 'view') {
            document.getElementById('customer-modal').style.display = 'none';
            LoadingIndicator.hide();
            return;
        }
        
        // 폼 데이터 수집
        const name = document.getElementById('customer-name').value;
        const phone = document.getElementById('customer-phone').value;
        const memo = document.getElementById('customer-memo').value;
        const alimtalkConsent = document.getElementById('customer-alimtalk-consent').checked;
        
        // 반려동물 정보 수집
        const petContainers = document.querySelectorAll('#customer-pet-containers .pet-container');
        const pets = Array.from(petContainers).map(container => {
            const petId = container.querySelector('.customer-pet-id')?.value || null;
            
            return {
                id: petId,
                name: container.querySelector('.customer-pet-name').value,
                breed: container.querySelector('.customer-pet-breed').value,
                weight: parseFloat(container.querySelector('.customer-pet-weight').value),
                age: container.querySelector('.customer-pet-age').value || null,
                memo: container.querySelector('.customer-pet-memo').value || ''
            };
        });
        
        // API 데이터 객체
        const customerData = {
            id: customerId,
            name,
            phone,
            memo,
            pets,
            alimtalkConsent
        };
        
        // API 호출
        await API.saveCustomer(customerData);
        
        // 고객 목록 다시 로드
        const response = await API.getCustomers();
        customers = response.customers || [];
        
        // 모달 닫기
        document.getElementById('customer-modal').style.display = 'none';
        
        // 고객 목록 다시 렌더링 (현재 고객 관리 페이지가 활성화 상태인 경우)
        const customersPage = document.getElementById('customers-page');
        if (customersPage.classList.contains('active')) {
            await renderCustomersTable();
        }
        
        // 성공 메시지
        ToastNotification.show(
            customerId ? '고객 정보가 업데이트되었습니다.' : '새 고객이 추가되었습니다.',
            'success'
        );
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('고객 정보 저장 중 오류:', error);
        ToastNotification.show(`고객 정보 저장에 실패했습니다: ${error.message}`, 'error');
    }
}

// 고객 검색
async function searchCustomers(searchTerm) {
    try {
        if (!searchTerm) {
            await renderCustomersTable();
            return;
        }
        
        LoadingIndicator.show('고객 검색 중...');
        
        const response = await API.getCustomers(1, 50, searchTerm);
        const filteredCustomers = response.customers || [];
        
        // 테이블 업데이트
        await renderCustomersTableWithData(filteredCustomers, response.pagination);
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('고객 검색 중 오류:', error);
        ToastNotification.show(`고객 검색 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

// 고객 목록 테이블 렌더링
async function renderCustomersTable(page = 1, limit = 20) {
    try {
        LoadingIndicator.show('고객 정보를 불러오는 중...');
        
        const response = await API.getCustomers(page, limit);
        customers = response.customers || [];
        
        await renderCustomersTableWithData(customers, response.pagination);
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('고객 목록 로드 중 오류:', error);
        ToastNotification.show(`고객 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

// 고객 테이블 데이터 렌더링 헬퍼 함수
async function renderCustomersTableWithData(customerData, pagination) {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    if (customerData.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" class="text-center">조회된 고객이 없습니다.</td>';
        tbody.appendChild(tr);
        return;
    }
    
    customerData.forEach(customer => {
        const tr = document.createElement('tr');
        
        // 최근 방문일
        let lastVisit = '없음';
        if (customer.last_visit) {
            const visitDate = new Date(customer.last_visit);
            lastVisit = visitDate.toLocaleDateString('ko-KR');
        }
        
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${(customer.pets || []).map(p => p.name).join(', ')}</td>
            <td>${lastVisit}</td>
            <td>${customer.visits || 0}</td>
            <td>
                <button class="btn btn-sm btn-primary view-customer" data-id="${customer.id}" aria-label="보기">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-secondary edit-customer" data-id="${customer.id}" aria-label="수정">
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
    
    // 페이지네이션 추가
    if (pagination) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        
        document.querySelector('.customers-table-container').appendChild(paginationContainer);
        
        Pagination.render(paginationContainer, {
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            onPageChange: (page) => {
                renderCustomersTable(page, pagination.limit);
            }
        });
    }
}

// 계정 모달 열기
async function openAccountModal(userId = null) {
    try {
        LoadingIndicator.show('계정 정보 불러오는 중...');
        
        const modal = document.getElementById('account-modal');
        const form = document.getElementById('account-form');
        form.reset();
        
        // 모달 제목 설정
        document.getElementById('account-modal-title').textContent = userId ? '계정 수정' : '계정 추가';
        
        // 기존 계정 정보 불러오기
        if (userId) {
            try {
                // 사용자 목록에서 해당 사용자 찾기
                const user = staffMembers.find(u => u.id === userId);
                
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
                    document.getElementById('account-password').required = false;
                    document.getElementById('password-group').querySelector('label').textContent = '비밀번호 (변경시에만 입력)';
                }
            } catch (error) {
                console.error('계정 정보 로드 중 오류:', error);
                ToastNotification.show(`계정 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
            }
        } else {
            // 신규 계정인 경우 비밀번호 필수
            document.getElementById('account-password').required = true;
            document.getElementById('password-group').querySelector('label').textContent = '비밀번호';
            document.getElementById('account-id').value = '';
        }
        
        LoadingIndicator.hide();
        modal.style.display = 'block';
    } catch (error) {
        LoadingIndicator.hide();
        console.error('계정 모달 열기 중 오류:', error);
        ToastNotification.show('계정 정보 창을 여는 중 오류가 발생했습니다.', 'error');
    }
}

// 계정 정보 저장 (폼에서)
async function saveAccountFromForm() {
    try {
        LoadingIndicator.show('계정 정보 저장 중...');
        
        // 폼 데이터 수집
        const id = document.getElementById('account-id').value;
        const email = document.getElementById('account-email').value;
        const password = document.getElementById('account-password').value;
        const name = document.getElementById('account-name').value;
        const phone = document.getElementById('account-phone').value;
        const memo = document.getElementById('account-memo').value;
        const role = document.querySelector('input[name="role"]:checked').value;
        
        // API 데이터 객체
        const userData = {
            id,
            email,
            password,
            name,
            phone,
            memo,
            role
        };
        
        // API 호출
        await API.saveUser(userData);
        
        // 직원 목록 다시 로드
        const staffResponse = await API.getStaff();
        staffMembers = staffResponse.staffMembers || [];
        
        // 모달 닫기
        document.getElementById('account-modal').style.display = 'none';
        
        // 계정 목록 다시 렌더링 (현재 설정 페이지가 활성화 상태인 경우)
        const settingsPage = document.getElementById('settings-page');
        if (settingsPage.classList.contains('active')) {
            await renderAccountsTable();
        }
        
        // 성공 메시지
        ToastNotification.show(
            id ? '계정 정보가 업데이트되었습니다.' : '새 계정이 추가되었습니다.',
            'success'
        );
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('계정 정보 저장 중 오류:', error);
        ToastNotification.show(`계정 정보 저장에 실패했습니다: ${error.message}`, 'error');
    }
}

// 매출 등록 모달 열기
function openSaleModal(appointment = null) {
    try {
        const modal = document.getElementById('sale-modal');
        const form = document.getElementById('sale-form');
        form.reset();
        
        if (appointment) {
            // 예약 ID 설정
            document.getElementById('appointment-id').value = appointment.id;
            
            // 고객 정보 설정
            document.getElementById('sale-customer-name').value = appointment.guardian.name;
            document.getElementById('sale-pet-name').value = appointment.pets.map(p => p.name).join(', ');
            document.getElementById('sale-service').value = appointment.service;
            
            // 기본 금액 설정 (서비스별 금액 예시)
            let defaultAmount = 0;
            switch (appointment.service) {
                case '목욕':
                    defaultAmount = 30000;
                    break;
                case '부분+목욕':
                    defaultAmount = 40000;
                    break;
                case '부분+목욕+얼컷':
                    defaultAmount = 50000;
                    break;
                case '전체미용':
                    defaultAmount = 55000;
                    break;
                case '스포팅':
                    defaultAmount = 65000;
                    break;
                case '전체가위컷':
                    defaultAmount = 70000;
                    break;
                default:
                    defaultAmount = 0;
            }
            
            document.getElementById('sale-amount').value = defaultAmount;
        }
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('매출 모달 열기 중 오류:', error);
        ToastNotification.show('매출 정보 창을 여는 중 오류가 발생했습니다.', 'error');
    }
}

// 대시보드 통계 업데이트
async function updateAppointmentStats() {
    try {
        const today = formatDate(new Date());
        const dateStr = formatDate(currentDate);
        
        // 오늘 예약 개수
        const todayAppointmentsResponse = await API.getAppointmentsByDate(today);
        const todayAppointments = todayAppointmentsResponse.appointments || [];
        document.getElementById('today-appointments').textContent = `${todayAppointments.length}건`;
        
        // 오늘의 다음 예약 계산
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        const upcomingAppointments = todayAppointments
            .filter(app => app.status === 'reserved' && app.startTime > currentTime)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        if (upcomingAppointments.length > 0) {
            const next = upcomingAppointments[0];
            const [nextHour, nextMinute] = next.startTime.split(':').map(Number);
            const nextDate = new Date();
            nextDate.setHours(nextHour, nextMinute);
            
            // 대기 시간 계산
            let diffMinutes = Math.floor((nextDate - now) / (1000 * 60));
            const diffHours = Math.floor(diffMinutes / 60);
            diffMinutes = diffMinutes % 60;
            
            let waitTime = '';
            if (diffHours > 0) {
                waitTime = `${diffHours}시간 ${diffMinutes}분 후`;
            } else {
                waitTime = `${diffMinutes}분 후`;
            }
            
            document.getElementById('next-appointment').textContent = `${waitTime} (${next.guardian.name}님)`;
        } else {
            document.getElementById('next-appointment').textContent = '없음';
        }
        
        // 완료된 예약
        const completedToday = todayAppointments.filter(app => app.status === 'completed').length;
        document.getElementById('completed-appointments').textContent = `${completedToday}건 / ${todayAppointments.length}건`;
        
        // 취소된 예약
        const canceledToday = todayAppointments.filter(app => app.status === 'canceled' || app.status === 'no_show').length;
        document.getElementById('canceled-appointments').textContent = `${canceledToday}건`;
    } catch (error) {
        console.error('예약 통계 업데이트 중 오류:', error);
        // 대시보드의 작은 오류는 조용히 로깅하고 사용자에게 알리지 않음
    }
}

// 매출 데이터 가져오기 및 렌더링
async function renderSalesData(period) {
    try {
        LoadingIndicator.show('매출 데이터를 불러오는 중...');
        
        // 기간에 따른 시작일, 종료일 계산
        const today = new Date();
        let startDate, endDate;
        
        switch (period) {
            case 'today':
                startDate = formatDate(today);
                endDate = formatDate(today);
                break;
            case 'thisMonth':
                startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                endDate = formatDate(today);
                break;
            case 'lastMonth':
                const lastMonth = new Date(today);
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                startDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
                endDate = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`;
                break;
            case 'threeMonths':
                const threeMonthsAgo = new Date(today);
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                startDate = formatDate(threeMonthsAgo);
                endDate = formatDate(today);
                break;
            case 'sixMonths':
                const sixMonthsAgo = new Date(today);
                sixMonthsAgo.setMonth(today.getMonth() - 6);
                startDate = formatDate(sixMonthsAgo);
                endDate = formatDate(today);
                break;
            case 'year':
                const oneYearAgo = new Date(today);
                oneYearAgo.setFullYear(today.getFullYear() - 1);
                startDate = formatDate(oneYearAgo);
                endDate = formatDate(today);
                break;
            default:
                startDate = formatDate(today);
                endDate = formatDate(today);
        }
        
        // 담당자 필터
        const selectedStaffId = document.getElementById('staff-select').value;
        
        // API로 매출 데이터 가져오기
        const salesResponse = await API.getSalesByPeriod(startDate, endDate, selectedStaffId);
        
        // 매출 데이터 및 통계
        const filteredSales = salesResponse.sales || [];
        const summary = salesResponse.summary || { totalAmount: 0, count: 0 };
        
        // 통계 표시
        document.getElementById('total-sales').textContent = summary.totalAmount.toLocaleString() + '원';
        document.getElementById('total-appointments').textContent = summary.count + '건';
        
        // 취소된 예약 수 조회 (별도 API가 필요할 수 있음)
        document.getElementById('total-canceled').textContent = '0건'; // 추후 API로 가져오기
        
        // 매출 데이터 테이블 렌더링
        const tbody = document.querySelector('#sales-table tbody');
        tbody.innerHTML = '';
        
        if (filteredSales.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="7" class="text-center">해당 기간에 매출 데이터가 없습니다.</td>';
            tbody.appendChild(tr);
        } else {
            filteredSales.forEach(sale => {
                const tr = document.createElement('tr');
                
                const date = new Date(sale.date).toLocaleDateString('ko-KR');
                
                tr.innerHTML = `
                    <td>${date}</td>
                    <td>${sale.customer.name}</td>
                    <td>${(sale.pets || []).map(p => p.name).join(', ')}</td>
                    <td>${sale.service}</td>
                    <td>${sale.staff.name}</td>
                    <td>${sale.payment_method}</td>
                    <td>${sale.amount.toLocaleString()}원</td>
                `;
                
                tbody.appendChild(tr);
            });
        }
        
        // 매출 차트 업데이트
        updateSalesChart(filteredSales, period);
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('매출 데이터 렌더링 중 오류:', error);
        ToastNotification.show(`매출 데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

// 매출 차트 업데이트
function updateSalesChart(salesData, period) {
    try {
        const ctx = document.getElementById('sales-chart').getContext('2d');
        
        // 기존 차트 제거
        if (window.salesChart) {
            window.salesChart.destroy();
        }
        
        let labels = [];
        let data = [];
        
        if (salesData.length === 0) {
            // 데이터가 없는 경우 빈 차트 표시
            window.salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['데이터 없음'],
                    datasets: [{
                        label: '매출',
                        data: [0],
                        borderColor: '#4e73df',
                        backgroundColor: 'rgba(78, 115, 223, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `매출: ${context.parsed.y.toLocaleString()}원`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString() + '원';
                                }
                            }
                        }
                    }
                }
            });
            
            return;
        }
        
        // 기간에 따라 데이터 그룹화
        if (period === 'today') {
            // 시간대별로 그룹화
            const salesByHour = Array(24).fill(0);
            
            salesData.forEach(sale => {
                const saleDate = new Date(sale.date);
                const saleHour = parseInt(sale.created_at.split('T')[1].split(':')[0]);
                salesByHour[saleHour] += sale.amount;
            });
            
            labels = Array.from({ length: 24 }, (_, i) => `${i}시`);
            data = salesByHour;
            
        } else if (period === 'thisMonth' || period === 'lastMonth') {
            // 일별로 그룹화
            const salesByDay = {};
            
            salesData.forEach(sale => {
                const day = sale.date.split('-')[2]; // DD
                if (!salesByDay[day]) {
                    salesByDay[day] = 0;
                }
                salesByDay[day] += sale.amount;
            });

                // 정렬된 날짜로 변환
            const sortedDays = Object.keys(salesByDay).sort((a, b) => parseInt(a) - parseInt(b));
            
            labels = sortedDays.map(day => `${day}일`);
            data = sortedDays.map(day => salesByDay[day]);
            
        } else {
            // 월별로 그룹화
            const salesByMonth = {};
            
            salesData.forEach(sale => {
                const monthYear = sale.date.substring(0, 7); // YYYY-MM
                if (!salesByMonth[monthYear]) {
                    salesByMonth[monthYear] = 0;
                }
                salesByMonth[monthYear] += sale.amount;
            });
            
            // 정렬된 월로 변환
            const sortedMonths = Object.keys(salesByMonth).sort();
            
            labels = sortedMonths.map(month => {
                const [year, monthNum] = month.split('-');
                return `${year}년 ${monthNum}월`;
            });
            data = sortedMonths.map(month => salesByMonth[month]);
        }
        
        // 차트 생성
        window.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '매출',
                    data: data,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `매출: ${context.parsed.y.toLocaleString()}원`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + '원';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('매출 차트 업데이트 중 오류:', error);
        // 차트 오류는 UI를 해치지 않도록 조용히 처리
    }
}

// 계정 목록 조회 및 렌더링
async function renderAccountsTable() {
    try {
        LoadingIndicator.show('계정 정보를 불러오는 중...');
        
        // 직원 목록 API 호출
        const staffResponse = await API.getStaff();
        staffMembers = staffResponse.staffMembers || [];
        
        const tbody = document.querySelector('#accounts-table tbody');
        tbody.innerHTML = '';
        
        if (staffMembers.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="text-center">등록된 계정이 없습니다.</td>';
            tbody.appendChild(tr);
        } else {
            staffMembers.forEach(user => {
                const tr = document.createElement('tr');
                
                tr.innerHTML = `
                    <td>${user.role === 'admin' ? '관리자' : '직원'}</td>
                    <td>${user.email}</td>
                    <td>${user.name}</td>
                    <td>${user.phone || '-'}</td>
                    <td>${user.memo || '-'}</td>
                    <td>
                        ${(user.role !== 'admin' || currentUser.role === 'admin') ? `
                            <button class="btn btn-sm btn-secondary edit-account" data-id="${user.id}" aria-label="수정">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${user.email !== 'admin' ? `
                                <button class="btn btn-sm btn-danger delete-account" data-id="${user.id}" aria-label="삭제">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        ` : '-'}
                    </td>
                `;
                
                tbody.appendChild(tr);
            });
        }
        
        // 계정 수정/삭제 버튼 이벤트 추가
        document.querySelectorAll('.edit-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.id;
                openAccountModal(userId);
            });
        });
        
        document.querySelectorAll('.delete-account').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const user = staffMembers.find(u => u.id === userId);
                
                const confirmed = await ConfirmDialog.show({
                    title: '계정 삭제',
                    message: `"${user?.name || '이 계정'}" 계정을 삭제하시겠습니까?`,
                    confirmText: '삭제',
                    cancelText: '취소',
                    type: 'danger'
                });
                
                if (confirmed) {
                    try {
                        LoadingIndicator.show('계정을 삭제하는 중...');
                        await API.deleteUser(userId);
                        await renderAccountsTable(); // 테이블 다시 로드
                        ToastNotification.show('계정이 삭제되었습니다.', 'success');
                        LoadingIndicator.hide();
                    } catch (error) {
                        LoadingIndicator.hide();
                        ToastNotification.show(`계정 삭제 중 오류가 발생했습니다: ${error.message}`, 'error');
                    }
                }
            });
        });
        
        LoadingIndicator.hide();
    } catch (error) {
        LoadingIndicator.hide();
        console.error('계정 목록 로드 중 오류:', error);
        ToastNotification.show(`계정 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`, 'error');
    }
}

export default {
    // 필요한 경우 외부에서 접근할 함수 노출
};
        
