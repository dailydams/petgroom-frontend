// 전역 변수들
let currentUser = null;
let appointments = [];
let customers = [];
let staffMembers = [];
let sales = [];
let currentDate = new Date();
let currentView = 'day'; // day, week, month
let selectedStaffId = 'all';

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', () => {
    // 현재 로그인 사용자 확인
    const userJson = sessionStorage.getItem('currentUser');
    if (!userJson) {
        // 로그인하지 않은 경우 로그인 페이지로 이동
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(userJson);
    
    // 사용자 이름 표시
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('sidebar-user-name').textContent = currentUser.name;
    
    // 데이터 초기화
    initData();
    
    // 이벤트 리스너 등록
    initEventListeners();
    
    // 사이드바 메뉴 활성화
    initSidebar();
    
    // 초기 페이지 로드 (예약관리)
    updateCalendarHeader();
    initCalendarView();
    loadCalendar();
    
    // 디버깅용 로그
    console.log('초기 currentView:', currentView);
});

// 데이터 초기화
function initData() {
    // 더미 데이터 로드 (실제 구현에서는 서버에서 데이터를 불러옴)
    loadAppointments();
    loadCustomers();
    loadStaffMembers();
    loadSales();
}

// 사이드바 이벤트 리스너
function initSidebar() {
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    const pages = document.querySelectorAll('.page');
    const header = document.querySelector('.header-title h1');
    
    menuItems.forEach(item => {
        if (!item.dataset.page) return;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
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
            
            // 페이지별 초기화
            if (pageName === 'appointments') {
                loadCalendar();
            } else if (pageName === 'customers') {
                renderCustomersTable();
            } else if (pageName === 'sales') {
                renderSalesData('today');
            } else if (pageName === 'settings') {
                renderAccountsTable();
            }
        });
    });

    // 로그아웃 버튼 이벤트
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        performLogout();
    });
    
    // 헤더의 로그아웃 버튼도 동일하게 처리
    const headerLogoutBtn = document.getElementById('header-logout-btn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performLogout();
        });
    }
}

// 로그아웃 처리
function performLogout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
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
        
        // 새로운 date input 생성 (visible로 설정)
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
            
            console.log('View changed to:', currentView); // 디버깅용
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
        const searchTerm = document.getElementById('customer-search').value.toLowerCase();
        filterCustomers(searchTerm);
    });
    
    // 엔터키 검색 지원
    document.getElementById('customer-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('search-btn').click();
        }
    });
    
    // 엑셀 일괄 등록 버튼
    document.getElementById('import-customers-btn').addEventListener('click', () => {
        // 엑셀 일괄 등록 기능 구현 - 여기서는 알림만 표시
        alert('엑셀 일괄 등록 기능은 아직 구현되지 않았습니다.');
    });
}

// 매출관리 페이지 이벤트
function initSalesEvents() {
    // 기간 선택 버튼
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 기존 활성화된 버튼 비활성화
            periodBtns.forEach(b => b. classList.remove('active'));
            
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
            alert('매장 설정이 저장되었습니다.');
        });
    }
    
    // 알림 설정 폼 제출
    const notificationSettingsForm = document.getElementById('notification-settings-form');
    if (notificationSettingsForm) {
        notificationSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // 알림 설정 저장
            alert('알림 설정이 저장되었습니다.');
        });
    }
}

// 달력 헤더 날짜 업데이트
function updateCalendarHeader() {
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

// 캘린더 초기화 함수
function initCalendarView() {
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
}

// 캘린더 네비게이션 함수
function navigateCalendar(direction) {
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
}

// 오늘 날짜로 이동하는 함수
function navigateToToday() {
    currentDate = new Date();
    updateCalendarHeader();
    loadCalendar();
}

// 캘린더 메인 로드 함수
function loadCalendar() {
    // 모든 캘린더 뷰 숨기기
    document.querySelectorAll('.calendar-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // 선택된 뷰 표시
    if (currentView === 'day') {
        document.getElementById('day-view').classList.add('active');
        loadDayView();
    } else if (currentView === 'week') {
        document.getElementById('week-view').classList.add('active');
        loadWeekView();
    } else if (currentView === 'month') {
        document.getElementById('month-view').classList.add('active');
        loadMonthView();
    }
    
    // 통계 업데이트
    updateAppointmentStats();
}

// 일간 캘린더 로드
function loadDayView() {
    const staffSchedules = document.getElementById('staff-schedules');
    staffSchedules.innerHTML = '';
    
    // 운영 시간 설정
    const startHour = 9;
    const endHour = 19;
    
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

// 예약 모달 열기
function openAppointmentModal(time = null, staffId = null) {
    const modal = document.getElementById('appointment-modal');
    const form = document.getElementById('appointment-form');
    form.reset();
    
    // 날짜 및 시간 초기화
    document.getElementById('appointment-date').value = formatDate(currentDate);
    
    if (time) {
        document.getElementById('appointment-start-time').value = time;
        
        // 기본 서비스 선택 (목욕 - 30분)
        const bathBtn = document.querySelector('[data-service="목욕"]');
        bathBtn.click();
    }
    
    // 담당자 목록 초기화
    const staffSelect = document.getElementById('staff-assigned');
    staffSelect.innerHTML = '';
    
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
function openCustomerModal(customerId = null, mode = 'add') {
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
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            document.getElementById('customer-name').value = customer.name;
            document.getElementById('customer-phone').value = customer.phone;
            document.getElementById('customer-memo').value = customer.memo || '';
            
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
                                <input type="number" id="customer-pet-weight-${index+1}" class="form-control customer-pet-weight" value="${pet.weight}" required>
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
    
    modal.style.display = 'block';
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
function saveCustomerFromForm() {
    const customerId = document.getElementById('customer-id').value;
    const mode = document.getElementById('customer-mode').value;
    
    // 조회 모드인 경우 저장하지 않음
    if (mode === 'view') {
        document.getElementById('customer-modal').style.display = 'none';
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
        return {
            name: container.querySelector('.customer-pet-name').value,
            breed: container.querySelector('.customer-pet-breed').value,
            weight: parseFloat(container.querySelector('.customer-pet-weight').value),
            age: container.querySelector('.customer-pet-age').value || null,
            memo: container.querySelector('.customer-pet-memo').value || ''
        };
    });
    
    // 기존 고객 정보 업데이트 또는 신규 고객 추가
    if (customerId && mode === 'edit') {
        // 기존 고객 찾기
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            // 기존 정보 유지 (방문 기록 등)
            const existingCustomer = customers[customerIndex];
            customers[customerIndex] = {
                ...existingCustomer,
                name,
                phone,
                memo,
                alimtalkConsent,
                pets,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // 신규 고객 추가
        const newCustomer = {
            id: Date.now().toString(),
            name,
            phone,
            pets,
            memo,
            alimtalkConsent,
            visits: 0,
            lastVisit: null,
            status: {
                completed: 0,
                canceled: 0,
                noShow: 0
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        customers.push(newCustomer);
    }
    
    // 고객 정보 저장
    localStorage.setItem('customers', JSON.stringify(customers));
    
    // 모달 닫기
    document.getElementById('customer-modal').style.display = 'none';
    
    // 고객 목록 다시 렌더링
    renderCustomersTable();
}

// 계정 모달 열기
function openAccountModal(email = null) {
    const modal = document.getElementById('account-modal');
    const form = document.getElementById('account-form');
    form.reset();
    
    // 모달 제목 설정
    document.getElementById('account-modal-title').textContent = email ? '계정 수정' : '계정 추가';
    
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
            document.getElementById('account-password').required = false;
            document.getElementById('password-group').querySelector('label').textContent = '비밀번호 (변경시에만 입력)';
        }
    } else {
        // 신규 계정인 경우 비밀번호 필수
        document.getElementById('account-password').required = true;
        document.getElementById('password-group').querySelector('label').textContent = '비밀번호';
        document.getElementById('account-id').value = '';
    }
    
    modal.style.display = 'block';
}

// 계정 정보 저장 (폼에서)
function saveAccountFromForm() {
    // 폼 데이터 수집
    const id = document.getElementById('account-id').value;
    const email = document.getElementById('account-email').value;
    const password = document.getElementById('account-password').value;
    const name = document.getElementById('account-name').value;
    const phone = document.getElementById('account-phone').value;
    const memo = document.getElementById('account-memo').value;
    const role = document.querySelector('input[name="role"]:checked').value;
    
    // 사용자 목록 가져오기
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // 이메일 중복 확인 (신규 계정인 경우)
    if (!id) {
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            alert('이미 사용 중인 이메일 주소입니다.');
            return;
        }
    }
    
    // 기존 계정 수정 또는 신규 계정 추가
    if (id) {
        // 기존 계정 찾기
        const userIndex = users.findIndex(u => u.id === id);
        
        if (userIndex !== -1) {
            // 기존 정보 업데이트
            const updatedUser = {
                ...users[userIndex],
                email,
                name,
                phone,
                memo,
                role,
                updatedAt: new Date().toISOString()
            };
            
            // 비밀번호가 입력된 경우만 업데이트
            if (password) {
                updatedUser.password = password;
            }
            
            users[userIndex] = updatedUser;
        }
    } else {
        // 신규 계정 추가
        const newUser = {
            id: Date.now().toString(),
            email,
            password,
            name,
            phone,
            memo,
            role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        users.push(newUser);
    }
    
    // 계정 정보 저장
    localStorage.setItem('users', JSON.stringify(users));
    
    // 모달 닫기
    document.getElementById('account-modal').style.display = 'none';
    
    // 계정 목록 다시 렌더링
    renderAccountsTable();
    
    // staffMembers 배열 업데이트 (직원 리스트에 추가)
    loadStaffMembers();
}

// 매출 등록 모달 열기
function openSaleModal(appointment = null) {
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
}

// 매출 정보 저장 (폼에서)
function saveSaleFromForm() {
    // 폼 데이터 수집
    const appointmentId = document.getElementById('appointment-id').value;
    const customerName = document.getElementById('sale-customer-name').value;
    const petName = document.getElementById('sale-pet-name').value;
    const service = document.getElementById('sale-service').value;
    const amount = parseInt(document.getElementById('sale-amount').value);
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const memo = document.getElementById('sale-memo').value;
    
    // 관련 예약 찾기
    const appointment = appointmentId ? appointments.find(a => a.id === appointmentId) : null;
    
    // 신규 매출 객체 생성
    const newSale = {
        id: Date.now().toString(),
        date: appointment ? appointment.date : formatDate(new Date()),
        customer: {
            id: appointment ? appointment.guardian.phone : 'unknown',
            name: customerName
        },
        pets: petName.split(',').map(name => ({ name: name.trim() })),
        service,
        amount,
        paymentMethod,
        staff: appointment ? appointment.staff : { id: currentUser.id, name: currentUser.name },
        appointmentId,
        memo,
        createdAt: new Date().toISOString()
    };
    
    // 매출 저장
    sales.push(newSale);
    localStorage.setItem('sales', JSON.stringify(sales));
    
    // 예약 상태 업데이트
    if (appointment) {
        const appointmentIndex = appointments.findIndex(a => a.id === appointmentId);
        
        if (appointmentIndex !== -1) {
            appointments[appointmentIndex].status = 'completed';
            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            // 고객 방문 기록 업데이트
            updateCustomerVisitRecord(appointment.guardian.phone);
        }
    }
    
    // 모달 닫기
    document.getElementById('sale-modal').style.display = 'none';
    
    // 캘린더 새로고침 (현재 예약관리 페이지에 있는 경우)
    const appointmentsPage = document.getElementById('appointments-page');
    if (appointmentsPage.classList.contains('active')) {
        loadCalendar();
    }
    
    // 매출관리 페이지 새로고침 (현재 매출관리 페이지에 있는 경우)
    const salesPage = document.getElementById('sales-page');
    if (salesPage.classList.contains('active')) {
        const activeBtn = document.querySelector('.period-btn.active');
        renderSalesData(activeBtn ? activeBtn.dataset.period : 'today');
    }
}

// 고객 방문 기록 업데이트
function updateCustomerVisitRecord(phone) {
    // 고객 찾기
    const customerIndex = customers.findIndex(c => c.phone === phone);
    
    if (customerIndex !== -1) {
        customers[customerIndex].visits = (customers[customerIndex].visits || 0) + 1;
        customers[customerIndex].lastVisit = formatDate(new Date());
        customers[customerIndex].status.completed = (customers[customerIndex].status.completed || 0) + 1;
        
        localStorage.setItem('customers', JSON.stringify(customers));
    }
}

// 예약 저장
function saveAppointment() {
    // 폼 데이터 수집
    const date = document.getElementById('appointment-date').value;
    const startTime = document.getElementById('appointment-start-time').value;
    const endTime = document.getElementById('appointment-end-time').value;
    const guardianName = document.getElementById('guardian-name').value;
    const guardianPhone = document.getElementById('guardian-phone').value;
    const service = document.getElementById('selected-service').value;
    const staffId = document.getElementById('staff-assigned').value;
    
    // 반려동물 정보 수집
    const petContainers = document.querySelectorAll('#pet-containers .pet-container');
    const pets = Array.from(petContainers).map((container, index) => {
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
    
    // 새 예약 객체 생성
    const newAppointment = {
        id: Date.now().toString(),
        date: date,
        startTime: startTime,
        endTime: endTime,
        guardian: {
            name: guardianName,
            phone: guardianPhone,
            memo: guardianMemo,
            alimtalkConsent: alimtalkConsent
        },
        pets: pets,
        service: service,
        staff: staffMembers.find(s => s.id === staffId) || staffMembers[0],
        status: 'reserved',
        memo: appointmentMemo,
        alimtalk: alimtalkOption,
        agreements: {
            default: defaultAgreement,
            senior: seniorAgreement
        },
        createdAt: new Date().toISOString()
    };
    
    // 예약 저장
    appointments.push(newAppointment);
    localStorage.setItem('appointments', JSON.stringify(appointments));
    
    // 고객 정보도 저장 (신규 고객인 경우)
    saveCustomer(guardianName, guardianPhone, pets, guardianMemo);
    
    // 모달 닫기
    document.getElementById('appointment-modal').style.display = 'none';
    
    // 현재 활성화된 뷰에 따라 캘린더 새로고침
    loadCalendar();
}

// 고객 정보 저장
function saveCustomer(name, phone, pets, memo = '') {
    // 기존 고객 확인
    const existingCustomer = customers.find(c => c.phone === phone);
    
    if (existingCustomer) {
        // 기존 고객이 있으면 반려동물 정보 업데이트/추가
        pets.forEach(pet => {
            const existingPet = existingCustomer.pets.find(p => p.name === pet.name);
            if (existingPet) {
                // 기존 반려동물 정보 업데이트
                Object.assign(existingPet, pet);
                existingPet.updatedAt = new Date().toISOString();
            } else {
                // 새 반려동물 추가
                existingCustomer.pets.push({
                    ...pet,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        });
        
        // 메모가 있는 경우 업데이트
        if (memo) {
            existingCustomer.memo = memo;
        }
        
        existingCustomer.updatedAt = new Date().toISOString();
    } else {
        // 신규 고객 추가
        const newCustomer = {
            id: Date.now().toString(),
            name: name,
            phone: phone,
            pets: pets.map(pet => ({
                ...pet,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })),
            memo: memo,
            visits: 0,
            lastVisit: null,
            status: {
                completed: 0,
                canceled: 0,
                noShow: 0
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        customers.push(newCustomer);
    }
    
    // 고객 정보 저장
    localStorage.setItem('customers', JSON.stringify(customers));
}

// 대시보드 통계 업데이트
function updateAppointmentStats() {
    const today = formatDate(new Date());
    const dateStr = formatDate(currentDate);
    
    // 오늘 예약 건수
    const todayAppointments = appointments.filter(app => app.date === today);
    document.getElementById('today-appointments').textContent = `${todayAppointments.length}건`;
    
    // 오늘의 다음 예약
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
}

// 주간 뷰 로드
function loadWeekView() {
    const weekHeader = document.getElementById('week-header');
    const weekBody = document.getElementById('week-body');
    
    weekHeader.innerHTML = '';
    weekBody.innerHTML = '';
    
    // 주간 시작일 (일요일)
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    // 7일 표시
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        
        // 요일 헤더 추가
        const dayHeader = document.createElement('div');
        dayHeader.className = 'week-day-header';
        
        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][i];
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        dayHeader.textContent = `${dayOfWeek} (${dateStr})`;
        
        // 오늘 날짜 강조
        const today = new Date();
        if (date.getDate() === today.getDate() && 
            date.getMonth() === today.getMonth() && 
            date.getFullYear() === today.getFullYear()) {
            dayHeader.style.backgroundColor = 'var(--primary)';
            dayHeader.style.color = 'white';
        }
        
        weekHeader.appendChild(dayHeader);
        
        // 일별 컬럼 추가
        const dayColumn = document.createElement('div');
        dayColumn.className = 'week-day';
        dayColumn.dataset.date = formatDate(date);
        
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
        
        weekBody.appendChild(dayColumn);
    }
    
    // 예약 표시
    renderWeekAppointments();
}

// 월간 뷰 로드
function loadMonthView() {
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
    
    // 월간 달력 생성
    let iterDate = new Date(firstWeekStart);
    const today = new Date();
    
    while (iterDate <= lastWeekEnd) {
        const dayDate = new Date(iterDate); // 현재 반복 중인 날짜를 복사
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
        
        // 날짜 헤더
        const dayHeader = document.createElement('div');
        dayHeader.className = 'month-day-header';
        dayHeader.textContent = dayDate.getDate();
        
        // 날짜 내용 (예약 표시 영역)
        const dayContent = document.createElement('div');
        dayContent.className = 'month-day-content';
        dayContent.dataset.date = formatDate(dayDate);
        
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
        
        dayElement.appendChild(dayHeader);
        dayElement.appendChild(dayContent);
        monthBody.appendChild(dayElement);
        
        // 다음 날짜로
        iterDate.setDate(iterDate.getDate() + 1);
    }
    
    // 예약 표시
    renderMonthAppointments();
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
        appointmentItem.className = `appointment-item status-${app.status}`;
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

// 주간 예약 렌더링
function renderWeekAppointments() {
    // 현재 보고 있는 주의 시작일과 종료일
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // 해당 주 동안의 모든 예약 필터링
    let weekAppointments = appointments.filter(app => {
        const appDate = new Date(app.date);
        return appDate >= weekStart && appDate <= weekEnd;
    });
    
    // 스태프 필터링
    if (selectedStaffId !== 'all') {
        weekAppointments = weekAppointments.filter(app => app.staff.id === selectedStaffId);
    }
    
    // 일자별로 예약 표시
    weekAppointments.forEach(app => {
        const dayColumn = document.querySelector(`.week-day[data-date="${app.date}"]`);
        if (!dayColumn) return;
        
        const appointmentItem = document.createElement('div');
        appointmentItem.className = `week-appointment status-${app.status}`;
        appointmentItem.dataset.id = app.id;
        
        appointmentItem.innerHTML = `
            <div>${app.startTime} - ${app.endTime}</div>
            <div>${app.guardian.name} (${app.pets.map(p => p.name).join(', ')})</div>
            <div>${app.service}</div>
        `;
        
        // 예약 클릭 이벤트
        appointmentItem.addEventListener('click', () => {
            openSaleModal(app);
        });
        
        dayColumn.appendChild(appointmentItem);
    });
}

// 월간 예약 렌더링
function renderMonthAppointments() {
    // 현재 표시되는 모든 날짜 요소 가져오기
    const dayContents = document.querySelectorAll('.month-day-content');
    
    // 월간 뷰에 표시된 모든 날짜에 대한 예약 표시
    dayContents.forEach(dayContent => {
        const dateStr = dayContent.dataset.date;
        
        // 해당 날짜의 예약 필터링
        let dayAppointments = appointments.filter(app => app.date === dateStr);
        
        // 스태프 필터링
        if (selectedStaffId !== 'all') {
            dayAppointments = dayAppointments.filter(app => app.staff.id === selectedStaffId);
        }
        
        // 예약 개수 제한 (공간 제약 때문에)
        const maxAppointments = 3;
        const totalAppointments = dayAppointments.length;
        
        // 최대 3개까지만 표시하고 나머지는 +N으로 표시
        dayAppointments.slice(0, maxAppointments).forEach(app => {
            const appointmentItem = document.createElement('div');
            appointmentItem.className = `month-appointment status-${app.status}`;
            appointmentItem.textContent = `${app.startTime} ${app.guardian.name} ${app.service}`;
            
            appointmentItem.addEventListener('click', (e) => {
                e.stopPropagation(); // 부모 이벤트 방지
                openSaleModal(app);
            });
            
            dayContent.appendChild(appointmentItem);
        });
        
        // 더 많은 예약이 있을 경우 +N 표시
        if (totalAppointments > maxAppointments) {
            const moreItem = document.createElement('div');
            moreItem.className = 'month-appointment more';
            moreItem.textContent = `+ ${totalAppointments - maxAppointments}개 더 보기`;
            
            // 더 보기 클릭 시 해당 날짜의 일간 뷰로 전환
            moreItem.addEventListener('click', (e) => {
                e.stopPropagation(); // 부모 이벤트 방지
                
                // 해당 날짜로 이동
                currentDate = new Date(dateStr);
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
            
            dayContent.appendChild(moreItem);
        }
    });
}

// 고객 목록 테이블 렌더링
function renderCustomersTable() {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    customers.forEach(customer => {
        const tr = document.createElement('tr');
        
        // 최근 방문일
        let lastVisit = '없음';
        if (customer.lastVisit) {
            lastVisit = new Date(customer.lastVisit).toLocaleDateString('ko-KR');
        }
        
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.pets.map(p => p.name).join(', ')}</td>
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
}

// 고객 필터링
function filterCustomers(searchTerm) {
    if (!searchTerm) {
        renderCustomersTable();
        return;
    }
    
    const filteredCustomers = customers.filter(customer => {
        return (
            customer.name.toLowerCase().includes(searchTerm) ||
            customer.phone.includes(searchTerm) ||
            customer.pets.some(pet => pet.name.toLowerCase().includes(searchTerm))
        );
    });
    
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    filteredCustomers.forEach(customer => {
        const tr = document.createElement('tr');
        
        // 최근 방문일
        let lastVisit = '없음';
        if (customer.lastVisit) {
            lastVisit = new Date(customer.lastVisit).toLocaleDateString('ko-KR');
        }
        
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.pets.map(p => p.name).join(', ')}</td>
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
}

// 매출 데이터 렌더링
function renderSalesData(period) {
    // 기간에 따른 시작일, 종료일 계산
    const today = new Date();
    let startDate, endDate;
    
    switch (period) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            break;
        case 'thisMonth':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'threeMonths':
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
            endDate = new Date(today);
            break;
        case 'sixMonths':
            startDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
            endDate = new Date(today);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), today.getMonth() - 12, today.getDate());
            endDate = new Date(today);
            break;
        default:
            startDate = new Date(today);
            endDate = new Date(today);
    }
    
    // 날짜를 YYYY-MM-DD 형식으로 변환
    const formatDateString = (date) => {
        return formatDate(date);
    };
    
    startDate = formatDateString(startDate);
    endDate = formatDateString(endDate);
    
    // 담당자 필터
    const selectedStaffId = document.getElementById('staff-select').value;
    
    // 매출 필터링
    let filteredSales = sales.filter(sale => {
        const saleDate = sale.date;
        return saleDate >= startDate && saleDate <= endDate;
    });
    
    if (selectedStaffId !== 'all') {
        filteredSales = filteredSales.filter(sale => sale.staff.id === selectedStaffId);
    }
    
    // 통계 데이터 계산
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalAppointments = filteredSales.length;
    
    // 취소된 예약 수 (해당 기간 내)
    const canceledAppointments = appointments.filter(app => 
        (app.status === 'canceled' || app.status === 'noShow') && 
        app.date >= startDate && 
        app.date <= endDate
    ).length;
    
    // 통계 표시
    document.getElementById('total-sales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('total-appointments').textContent = totalAppointments + '건';
    document.getElementById('total-canceled').textContent = canceledAppointments + '건';
    
    // 매출 데이터 테이블 렌더링
    const tbody = document.querySelector('#sales-table tbody');
    tbody.innerHTML = '';
    
    filteredSales.forEach(sale => {
        const tr = document.createElement('tr');
        
        const date = new Date(sale.date).toLocaleDateString('ko-KR');
        
        tr.innerHTML = `
            <td>${date}</td>
            <td>${sale.customer.name}</td>
            <td>${sale.pets.map(p => p.name).join(', ')}</td>
            <td>${sale.service}</td>
            <td>${sale.staff.name}</td>
            <td>${sale.paymentMethod}</td>
            <td>${sale.amount.toLocaleString()}원</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 계정 테이블 렌더링
function renderAccountsTable() {
    // 로컬스토리지에서 사용자 목록 가져오기
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    const tbody = document.querySelector('#accounts-table tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${user.role === 'admin' ? '관리자' : '직원'}</td>
            <td>${user.email}</td>
            <td>${user.name}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.memo || '-'}</td>
            <td>
                ${user.role !== 'admin' || currentUser.role === 'admin' ? `
                    <button class="btn btn-sm btn-secondary edit-account" data-id="${user.email}" aria-label="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-account" data-id="${user.email}" aria-label="삭제">
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
}

// 계정 삭제
function deleteAccount(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const updatedUsers = users.filter(user => user.email !== email);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    // 계정 목록 다시 렌더링
    renderAccountsTable();
}

// 더미 데이터 로드 함수들
function loadAppointments() {
    // 로컬 스토리지에서 불러오기
    appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    
    // 더미 데이터가 없으면 생성
    if (appointments.length === 0) {
        const today = formatDate(new Date());
        
        appointments = [
            {
                id: '1',
                date: today,
                startTime: '10:00',
                endTime: '10:30',
                guardian: {
                    name: '김철수',
                    phone: '010-1234-5678',
                    memo: '',
                    alimtalkConsent: true
                },
                pets: [
                    {
                        name: '몽이',
                        breed: '말티즈',
                        weight: 3.5,
                        age: 5,
                        memo: '얌전한 아이'
                    }
                ],
                service: '목욕',
                staff: { id: '1', name: '이미용' },
                status: 'reserved',
                memo: '',
                alimtalk: 'default',
                agreements: {
                    default: true,
                    senior: false
                },
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                date: today,
                startTime: '13:00',
                endTime: '15:00',
                guardian: {
                    name: '박영희',
                    phone: '010-9876-5432',
                    memo: '조금 예민하심',
                    alimtalkConsent: true
                },
                pets: [
                    {
                        name: '초코',
                        breed: '푸들',
                        weight: 4.2,
                        age: 3,
                        memo: '입질이 있음'
                    }
                ],
                service: '전체미용',
                staff: { id: '2', name: '박미용' },
                status: 'reserved',
                memo: '발톱 정리 필요',
                alimtalk: 'deposit',
                agreements: {
                    default: true,
                    senior: false
                },
                createdAt: new Date().toISOString()
            }
        ];
        
        localStorage.setItem('appointments', JSON.stringify(appointments));
    }
}

function loadCustomers() {
    // 로컬 스토리지에서 불러오기
    customers = JSON.parse(localStorage.getItem('customers') || '[]');
    
    // 더미 데이터가 없으면 생성
    if (customers.length === 0) {
        customers = [
            {
                id: '1',
                name: '김철수',
                phone: '010-1234-5678',
                pets: [
                    {
                        name: '몽이',
                        breed: '말티즈',
                        weight: 3.5,
                        age: 5,
                        memo: '얌전한 아이',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                visits: 5,
                lastVisit: '2023-07-10',
                memo: '',
                alimtalkConsent: true,
                status: {
                    completed: 4,
                    canceled: 1,
                    noShow: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: '2',
                name: '박영희',
                phone: '010-9876-5432',
                pets: [
                    {
                        name: '초코',
                        breed: '푸들',
                        weight: 4.2,
                        age: 3,
                        memo: '입질이 있음',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                visits: 3,
                lastVisit: '2023-07-12',
                memo: '조금 예민하심',
                alimtalkConsent: true,
                status: {
                    completed: 3,
                    canceled: 0,
                    noShow: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: '3',
                name: '이지민',
                phone: '010-5555-7777',
                pets: [
                    {
                        name: '콩이',
                        breed: '비숑',
                        weight: 3.8,
                        age: 10,
                        memo: '노령견',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    {
                        name: '팥이',
                        breed: '포메라니안',
                        weight: 2.5,
                        age: 2,
                        memo: '활발함',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                visits: 8,
                lastVisit: '2023-07-05',
                memo: '',
                alimtalkConsent: true,
                status: {
                    completed: 7,
                    canceled: 0,
                    noShow: 1
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        localStorage.setItem('customers', JSON.stringify(customers));
    }
}

function loadStaffMembers() {
    // 로컬 스토리지에서 불러오기
    staffMembers = JSON.parse(localStorage.getItem('staffMembers') || '[]');
    
    // 로컬 스토리지의 users에서 직원 정보 불러오기
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.length > 0) {
        staffMembers = users.map(user => ({
            id: user.id || user.email,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            role: user.role || 'staff'
        }));
        
        localStorage.setItem('staffMembers', JSON.stringify(staffMembers));
    } 
    // 더미 데이터가 없으면 생성
    else if (staffMembers.length === 0) {
        staffMembers = [
            {
                id: '1',
                name: '이미용',
                email: 'lee@petgroom.com',
                phone: '010-1111-2222',
                role: 'staff'
            },
            {
                id: '2',
                name: '박미용',
                email: 'park@petgroom.com',
                phone: '010-3333-4444',
                role: 'staff'
            },
            {
                id: '3',
                name: '김관리',
                email: 'admin',
                phone: '010-0000-0000',
                role: 'admin'
            }
        ];
        
        localStorage.setItem('staffMembers', JSON.stringify(staffMembers));
    }
    
    // 매출 페이지 담당자 선택 드롭다운에 데이터 추가
    const staffSelect = document.getElementById('staff-select');
    if (staffSelect) {
        // 기존 옵션 제거 (첫 번째 '전체' 옵션 제외)
        while (staffSelect.options.length > 1) {
            staffSelect.remove(1);
        }
        
        staffMembers.forEach(staff => {
            const option = document.createElement('option');
            option.value = staff.id;
            option.textContent = staff.name;
            staffSelect.appendChild(option);
        });
    }
}

function loadSales() {
    // 로컬 스토리지에서 불러오기
    sales = JSON.parse(localStorage.getItem('sales') || '[]');
    
    // 더미 데이터가 없으면 생성
    if (sales.length === 0) {
        const today = formatDate(new Date());
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = formatDate(lastMonth);
        
        sales = [
            {
                id: '1',
                date: today,
                customer: {
                    id: '1',
                    name: '김철수'
                },
                pets: [
                    { name: '몽이' }
                ],
                service: '목욕',
                amount: 30000,
                paymentMethod: '현금',
                staff: { id: '1', name: '이미용' },
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                date: today,
                customer: {
                    id: '2',
                    name: '박영희'
                },
                pets: [
                    { name: '초코' }
                ],
                service: '전체미용',
                amount: 55000,
                paymentMethod: '카드',
                staff: { id: '2', name: '박미용' },
                createdAt: new Date().toISOString()
            },
            {
                id: '3',
                date: lastMonthStr,
                customer: {
                    id: '3',
                    name: '이지민'
                },
                pets: [
                    { name: '콩이' }
                ],
                service: '부분+목욕',
                amount: 45000,
                paymentMethod: '계좌이체',
                staff: { id: '1', name: '이미용' },
                createdAt: new Date(lastMonth).toISOString()
            },
            {
                id: '4',
                date: lastMonthStr,
                customer: {
                    id: '3',
                    name: '이지민'
                },
                pets: [
                    { name: '팥이' }
                ],
                service: '전체가위컷',
                amount: 70000,
                paymentMethod: '카드',
                staff: { id: '2', name: '박미용' },
                createdAt: new Date(lastMonth).toISOString()
            }
        ];
        
        localStorage.setItem('sales', JSON.stringify(sales));
    }
}
