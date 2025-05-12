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
let chartInitialized = false;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // salesChart 변수 초기화
        window.salesChart = null;
        chartInitialized = false;
        
        // Chart.js 글로벌 설정
        if (window.Chart) {
            // Chart.js 레지스트리 초기화
            initChartJS();
        }
        
        // 차트 컨테이너와 캔버스 확인
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            let canvas = document.getElementById('sales-chart');
            
            // 차트 캔버스가 없으면 생성
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'sales-chart';
                chartContainer.appendChild(canvas);
            }
        }
        
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
            
            // 서비스 이름과 기본 시간 설정
            const service = e.target.dataset.service;
            let duration = 30; // 기본 30분
            
            // 서비스별 기본 시간 설정
            switch (service) {
                case '목욕':
                    duration = 30;
                    break;
                case '부분+목욕':
                    duration = 60;
                    break;
                case '부분+목욕+얼컷':
                    duration = 60;
                    break;
                case '전체미용':
                    duration = 120;
                    break;
                case '스포팅':
                    duration = 180;
                    break;
                case '전체가위컷':
                    duration = 180;
                    break;
                default:
                    duration = 30;
            }
            
            // hidden input에 서비스 이름 저장
            const selectedServiceInput = document.getElementById('selected-service');
            if (selectedServiceInput) {
                selectedServiceInput.value = service;
            }
            
            // 시간 선택 드롭다운에 표시 및 선택
            const durationSelect = document.getElementById('appointment-duration');
            if (durationSelect) {
                durationSelect.value = duration;
                
                // 종료 시간 업데이트
                updateEndTime(duration);
            }
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
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        // API 호출
                        const response = await API.importCustomers(formData);
                        ToastNotification.show('고객 정보가 성공적으로 등록되었습니다.', 'success');
                        renderCustomersTable(); // 테이블 새로고침
                    } catch (error) {
                        console.error('고객 일괄등록 중 오류:', error);
                        ToastNotification.show('고객 정보 등록 중 오류가 발생했습니다.', 'error');
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
                // 날짜 클릭 시 해당 날짜의 예약 모달 바로 표시
                openAppointmentModal(null, null, date);
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
            
            // 날짜 클릭 시 해당 날짜의 예약 모달 바로 표시
            dayElement.addEventListener('click', () => {
                // 날짜 클릭 시 해당 날짜의 예약 모달 바로 표시
                openAppointmentModal(null, null, dayDate);
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
        
        // 보호자 이름 입력 시 검색
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
    for (const type in alimtalkTemplates) {
        const previewEl = document.getElementById(`alimtalk-${type}-preview`);
        if (previewEl) {
            const contentContainer = previewEl.querySelector('.alimtalk-content');
            if (contentContainer) {
                // HTML로 변환하여 표시 (줄바꿈 유지)
                contentContainer.innerHTML = alimtalkTemplates[type]
                    .replace(/\n/g, '</p><p>')
                    .replace(/^<\/p>/, '')
                    .replace(/<p>$/, '');
            }
        }
    }
}

// 알림톡 템플릿 관리 함수
let alimtalkTemplates = {
    default: `고객님,\n▷매장명 입니다.\n\n[예약] 안내드립니다.\n\n▷일시: 예약 날짜\n▷반려동물명: 반려동물명\n▷매장번호: 매장 번호`,
    deposit: `고객님,\n▷매장명 입니다.\n\n[예약금] 안내드립니다.\n\n▷일시: 예약 날짜\n▷반려동물명: 반려동물명\n▷매장번호: 매장 번호\n\n[예약금 안내]\n계좌번호: \n예약금: 20,000원\n\n* 상담 후 30분 이내 입금주셔야 예약이 확정됩니다.\n* 당일 예약 변경, 취소시 예약금 환불이 불가합니다.\n* 예약시간 20분 경과시 자동 취소되며, 예약금 환불이 불가합니다.\n* 미용비 결제는 예약금 차감 후 결제됩니다.\n\n반려견의 건강상태 또는 미용 트라우마가 있으면 미용 전 미리 말씀 부탁드립니다.`
};

// 초기화 시 저장된 템플릿이 있으면 불러오기
function initAlimtalkTemplates() {
    const savedTemplates = localStorage.getItem('alimtalkTemplates');
    if (savedTemplates) {
        try {
            alimtalkTemplates = JSON.parse(savedTemplates);
        } catch (error) {
            console.error('템플릿 로드 중 오류:', error);
        }
    }
    
    // 알림톡 옵션 변경 이벤트 리스너
    document.querySelectorAll('input[name="alimtalk-option"]').forEach(option => {
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
    
    // 미리보기 업데이트
    updateAlimtalkPreviews();
}

// 알림톡 수정 모달 열기
function openAlimtalkEditModal() {
    try {
        const modal = document.getElementById('alimtalk-edit-modal');
        if (!modal) {
            console.error('알림톡 수정 모달을 찾을 수 없습니다');
            return;
        }
        
        // 현재 선택된 템플릿 타입 확인
        const selectedType = document.querySelector('input[name="alimtalk-option"]:checked').value;
        
        // 모달 폼 내 선택된 템플릿 타입 라디오 버튼 체크
        const typeRadio = document.getElementById(`edit-template-${selectedType}`);
        if (typeRadio) {
            typeRadio.checked = true;
        }
        
        // 텍스트 영역에 현재 템플릿 내용 표시
        const templateTextarea = document.getElementById('template-content');
        if (templateTextarea) {
            templateTextarea.value = alimtalkTemplates[selectedType] || '';
        }
        
        // 미리보기 업데이트
        const previewEl = document.getElementById('edit-template-preview');
        if (previewEl) {
            const contentContainer = previewEl.querySelector('.alimtalk-content');
            if (contentContainer) {
                contentContainer.innerHTML = (alimtalkTemplates[selectedType] || '')
                    .replace(/\n/g, '</p><p>')
                    .replace(/^<\/p>/, '')
                    .replace(/<p>$/, '');
            }
        }
        
        // 템플릿 타입 변경 이벤트 리스너
        document.querySelectorAll('input[name="template-type"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const type = this.value;
                const templateContent = alimtalkTemplates[type] || '';
                
                // 텍스트 영역 업데이트
                if (templateTextarea) {
                    templateTextarea.value = templateContent;
                }
                
                // 미리보기 업데이트
                if (previewEl && contentContainer) {
                    contentContainer.innerHTML = templateContent
                        .replace(/\n/g, '</p><p>')
                        .replace(/^<\/p>/, '')
                        .replace(/<p>$/, '');
                }
            });
        });
        
        // 텍스트 영역 변경 이벤트 리스너 (실시간 미리보기)
        if (templateTextarea) {
            templateTextarea.addEventListener('input', function() {
                const previewContent = this.value;
                const contentContainer = previewEl?.querySelector('.alimtalk-content');
                
                if (contentContainer) {
                    contentContainer.innerHTML = previewContent
                        .replace(/\n/g, '</p><p>')
                        .replace(/^<\/p>/, '')
                        .replace(/<p>$/, '');
                }
            });
        }
        
        // 저장 버튼 이벤트 리스너
        const saveBtn = document.getElementById('save-template-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                const selectedType = document.querySelector('input[name="template-type"]:checked').value;
                const templateContent = templateTextarea.value;
                
                // 템플릿 객체 업데이트
                alimtalkTemplates[selectedType] = templateContent;
                
                // 로컬 스토리지에 저장
                try {
                    localStorage.setItem('alimtalkTemplates', JSON.stringify(alimtalkTemplates));
                    
                    // 미리보기 업데이트
                    updateAlimtalkPreviews();
                    
                    // 모달 닫기
                    modal.style.display = 'none';
                    
                    // 알림
                    ToastNotification.show('알림톡 템플릿이 저장되었습니다.', 'success');
                } catch (error) {
                    console.error('템플릿 저장 중 오류:', error);
                    ToastNotification.show('템플릿 저장 중 오류가 발생했습니다.', 'error');
                }
            });
        }
        
        // 취소 버튼 이벤트 리스너
        const cancelBtn = document.getElementById('cancel-template-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                modal.style.display = 'none';
            });
        }
        
        // 모달 표시
        modal.style.display = 'block';
    } catch (error) {
        console.error('알림톡 수정 모달 열기 중 오류:', error);
        ToastNotification.show('알림톡 수정 창을 여는 중 오류가 발생했습니다.', 'error');
    }
}
