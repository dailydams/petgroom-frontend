// 로딩 인디케이터 컴포넌트
export const LoadingIndicator = {
  show(message = '로딩 중...') {
    // 이미 있는 로딩 인디케이터 제거
    this.hide();
    
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-container">
        <div class="paw-print-container">
          <div class="paw-print">
            <div class="pad large"></div>
            <div class="pad small-1"></div>
            <div class="pad small-2"></div>
            <div class="pad small-3"></div>
            <div class="pad small-4"></div>
          </div>
        </div>
        <div class="loading-text">${message}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 1초 후에도 완료되지 않으면 표시 (깜빡임 방지)
    setTimeout(() => {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '1';
      }
    }, 300);
  },
  
  hide() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }
};

// 토스트 메시지 컴포넌트
export const ToastNotification = {
  show(message, type = 'info', duration = 3000) {
    // 타입: info, success, warning, error
    
    // 이미 있는 토스트 제거
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      toast.classList.remove('show');
    });
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    switch (type) {
      case 'success':
        icon = 'check-circle';
        break;
      case 'warning':
        icon = 'exclamation-triangle';
        break;
      case 'error':
        icon = 'exclamation-circle';
        break;
      default:
        icon = 'info-circle';
    }
    
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
      </div>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(toast);
    
    // 닫기 버튼 이벤트
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.hide(toast);
    });
    
    // 토스트 표시
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // 자동 닫기
    setTimeout(() => {
      this.hide(toast);
    }, duration);
    
    return toast;
  },
  
  hide(toast) {
    if (toast) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }
};

// 확인 대화상자 컴포넌트
export const ConfirmDialog = {
  show(options = {}) {
    return new Promise((resolve) => {
      const {
        title = '확인',
        message = '계속 진행하시겠습니까?',
        confirmText = '확인',
        cancelText = '취소',
        type = 'info' // info, warning, danger
      } = options;
      
      // 이미 있는 대화상자 제거
      const existingDialog = document.getElementById('confirm-dialog');
      if (existingDialog) {
        existingDialog.parentNode.removeChild(existingDialog);
      }
      
      // 대화상자 생성
      const dialog = document.createElement('div');
      dialog.id = 'confirm-dialog';
      dialog.className = 'modal confirm-dialog';
      
      let icon = '';
      switch (type) {
        case 'warning':
          icon = 'exclamation-triangle';
          break;
        case 'danger':
          icon = 'exclamation-circle';
          break;
        default:
          icon = 'question-circle';
      }
      
      dialog.innerHTML = `
        <div class="modal-content ${type}">
          <div class="modal-header">
            <h2>${title}</h2>
            <button class="close" aria-label="닫기">&times;</button>
          </div>
          <div class="modal-body">
            <div class="confirm-icon">
              <i class="fas fa-${icon}"></i>
            </div>
            <div class="confirm-message">${message}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-btn">${cancelText}</button>
            <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirm-btn">${confirmText}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      dialog.style.display = 'block';
      
      // 버튼 이벤트
      const cancelBtn = dialog.querySelector('#cancel-btn');
      const confirmBtn = dialog.querySelector('#confirm-btn');
      const closeBtn = dialog.querySelector('.close');
      
      const close = (result) => {
        dialog.style.display = 'none';
        setTimeout(() => {
          if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
          }
        }, 300);
        resolve(result);
      };
      
      cancelBtn.addEventListener('click', () => close(false));
      confirmBtn.addEventListener('click', () => close(true));
      closeBtn.addEventListener('click', () => close(false));
      
      // ESC 키로 닫기
      document.addEventListener('keydown', function handleEsc(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleEsc);
          close(false);
        }
      });
      
      // 외부 클릭으로 닫기
      dialog.addEventListener('click', function handleOverlayClick(e) {
        if (e.target === dialog) {
          dialog.removeEventListener('click', handleOverlayClick);
          close(false);
        }
      });
      
      // 확인 버튼에 포커스
      confirmBtn.focus();
    });
  }
};

// 페이지네이션 컴포넌트
export const Pagination = {
  render(container, options = {}) {
    const {
      currentPage = 1,
      totalPages = 1,
      onPageChange = () => {}
    } = options;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    // 페이지네이션 생성
    const pagination = document.createElement('div');
    pagination.className = 'pagination';
    
    // 이전 페이지 버튼
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button';
    prevButton.disabled = currentPage === 1;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    });
    
    // 다음 페이지 버튼
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button';
    nextButton.disabled = currentPage === totalPages;
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.addEventListener('click', () => {
      if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    });
    
    // 페이지 번호 버튼
    const pageNumbers = document.createElement('div');
    pageNumbers.className = 'pagination-numbers';
    
    // 표시할 페이지 번호 범위 결정
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    // 첫 페이지 버튼
    if (startPage > 1) {
      const firstPageBtn = document.createElement('button');
      firstPageBtn.className = 'pagination-number';
      firstPageBtn.textContent = '1';
      firstPageBtn.addEventListener('click', () => onPageChange(1));
      pageNumbers.appendChild(firstPageBtn);
      
      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pageNumbers.appendChild(ellipsis);
      }
    }
    
    // 페이지 번호 버튼 생성
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = 'pagination-number';
      if (i === currentPage) pageBtn.classList.add('active');
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => onPageChange(i));
      pageNumbers.appendChild(pageBtn);
    }
    
    // 마지막 페이지 버튼
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        pageNumbers.appendChild(ellipsis);
      }

        const lastPageBtn = document.createElement('button');
      lastPageBtn.className = 'pagination-number';
      lastPageBtn.textContent = totalPages;
      lastPageBtn.addEventListener('click', () => onPageChange(totalPages));
      pageNumbers.appendChild(lastPageBtn);
    }
    
    // 페이지네이션 조합
    pagination.appendChild(prevButton);
    pagination.appendChild(pageNumbers);
    pagination.appendChild(nextButton);
    
    // 컨테이너에 추가
    container.innerHTML = '';
    container.appendChild(pagination);
  }
};

// 오프라인 상태 감지 컴포넌트
export const NetworkStatus = {
  init() {
    // 오프라인 상태 배너
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
    
    // 네트워크 상태 이벤트
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // 초기 상태 확인
    if (!navigator.onLine) {
      this.handleOffline();
    }
  },
  
  handleOnline() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.classList.remove('show');
    }
    
    // 온라인 상태 알림
    ToastNotification.show('인터넷 연결이 복구되었습니다.', 'success');
  },
  
  handleOffline() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.classList.add('show');
    }
    
    // 오프라인 상태 알림
    ToastNotification.show('인터넷 연결이 끊겼습니다. 연결 상태를 확인해주세요.', 'error');
  }
};

// 검색 필터 컴포넌트
export const SearchFilter = {
  render(container, options = {}) {
    const {
      filters = [],
      onSearch = () => {},
      onReset = () => {}
    } = options;
    
    // 필터 컨테이너 생성
    const filterContainer = document.createElement('div');
    filterContainer.className = 'search-filter-container';
    
    // 필터 그룹 생성
    const filterForm = document.createElement('form');
    filterForm.className = 'filter-form';
    
    // 필터 항목 생성
    filters.forEach(filter => {
      const filterItem = document.createElement('div');
      filterItem.className = 'filter-item';
      
      // 필터 라벨
      if (filter.label) {
        const label = document.createElement('label');
        label.setAttribute('for', filter.id);
        label.textContent = filter.label;
        filterItem.appendChild(label);
      }
      
      // 필터 입력 요소 생성
      let input;
      
      switch (filter.type) {
        case 'select':
          input = document.createElement('select');
          input.className = 'form-control';
          
          // 옵션 추가
          if (filter.options && Array.isArray(filter.options)) {
            filter.options.forEach(option => {
              const optionElement = document.createElement('option');
              optionElement.value = option.value;
              optionElement.textContent = option.label;
              
              if (filter.value && filter.value === option.value) {
                optionElement.selected = true;
              }
              
              input.appendChild(optionElement);
            });
          }
          break;
          
        case 'date':
          input = document.createElement('input');
          input.type = 'date';
          input.className = 'form-control';
          if (filter.value) input.value = filter.value;
          break;
          
        case 'checkbox':
          input = document.createElement('input');
          input.type = 'checkbox';
          if (filter.checked) input.checked = true;
          break;
          
        default:
          // 기본은 text 입력
          input = document.createElement('input');
          input.type = filter.type || 'text';
          input.className = 'form-control';
          if (filter.placeholder) input.placeholder = filter.placeholder;
          if (filter.value) input.value = filter.value;
      }
      
      // ID 및 이벤트 설정
      input.id = filter.id;
      input.name = filter.id;
      
      // 이벤트 핸들러
      if (filter.onChange) {
        input.addEventListener('change', filter.onChange);
      }
      
      filterItem.appendChild(input);
      filterForm.appendChild(filterItem);
    });
    
    // 버튼 그룹 생성
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'filter-buttons';
    
    // 검색 버튼
    const searchButton = document.createElement('button');
    searchButton.type = 'submit';
    searchButton.className = 'btn btn-primary';
    searchButton.innerHTML = '<i class="fas fa-search"></i> 검색';
    buttonGroup.appendChild(searchButton);
    
    // 초기화 버튼
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'btn btn-secondary';
    resetButton.innerHTML = '<i class="fas fa-undo"></i> 초기화';
    resetButton.addEventListener('click', (e) => {
      e.preventDefault();
      filterForm.reset();
      onReset();
    });
    buttonGroup.appendChild(resetButton);
    
    filterForm.appendChild(buttonGroup);
    
    // 폼 제출 이벤트
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // 폼 데이터 수집
      const formData = new FormData(filterForm);
      const filterData = {};
      
      for (const [key, value] of formData.entries()) {
        filterData[key] = value;
      }
      
      // 체크박스 값 처리 (체크되지 않은 체크박스는 formData에 포함되지 않음)
      filters.forEach(filter => {
        if (filter.type === 'checkbox' && !formData.has(filter.id)) {
          filterData[filter.id] = false;
        }
      });
      
      onSearch(filterData);
    });
    
    filterContainer.appendChild(filterForm);
    
    // 컨테이너에 추가
    container.innerHTML = '';
    container.appendChild(filterContainer);
  }
};

// 캘린더 컴포넌트
export const Calendar = {
  render(container, options = {}) {
    const {
      date = new Date(),
      view = 'month',  // month, week, day
      events = [],
      onDateClick = () => {},
      onEventClick = () => {}
    } = options;
    
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-component';
    
    // 캘린더 헤더
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header';
    
    // 이전 달/주/일 버튼
    const prevButton = document.createElement('button');
    prevButton.className = 'btn calendar-nav-btn';
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.addEventListener('click', () => {
      let newDate = new Date(date);
      
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      
      options.onNavigate && options.onNavigate(newDate, view);
    });
    
    // 현재 날짜 표시
    const dateDisplay = document.createElement('h3');
    dateDisplay.className = 'current-date';
    
    if (view === 'month') {
      dateDisplay.textContent = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    } else if (view === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      dateDisplay.textContent = `${weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else {
      dateDisplay.textContent = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }
    
    // 다음 달/주/일 버튼
    const nextButton = document.createElement('button');
    nextButton.className = 'btn calendar-nav-btn';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.addEventListener('click', () => {
      let newDate = new Date(date);
      
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      
      options.onNavigate && options.onNavigate(newDate, view);
    });
    
    // 오늘 버튼
    const todayButton = document.createElement('button');
    todayButton.className = 'btn calendar-today-btn';
    todayButton.innerHTML = '<i class="fas fa-calendar-day"></i> 오늘';
    todayButton.addEventListener('click', () => {
      options.onNavigate && options.onNavigate(new Date(), view);
    });
    
    // 헤더에 요소 추가
    calendarHeader.appendChild(prevButton);
    calendarHeader.appendChild(dateDisplay);
    calendarHeader.appendChild(nextButton);
    calendarHeader.appendChild(todayButton);
    
    // 뷰 선택기
    if (options.enableViewChange) {
      const viewSelector = document.createElement('div');
      viewSelector.className = 'view-selector';
      
      ['day', 'week', 'month'].forEach(v => {
        const viewBtn = document.createElement('button');
        viewBtn.className = `view-btn ${v === view ? 'active' : ''}`;
        viewBtn.dataset.view = v;
        viewBtn.textContent = v === 'day' ? '일간' : v === 'week' ? '주간' : '월간';
        
        viewBtn.addEventListener('click', () => {
          options.onViewChange && options.onViewChange(v);
        });
        
        viewSelector.appendChild(viewBtn);
      });
      
      calendarHeader.appendChild(viewSelector);
    }
    
    calendarContainer.appendChild(calendarHeader);
    
    // 캘린더 바디 (뷰에 따라 다르게 렌더링)
    const calendarBody = document.createElement('div');
    calendarBody.className = 'calendar-body';
    
    if (view === 'month') {
      this.renderMonthView(calendarBody, date, events, onDateClick, onEventClick);
    } else if (view === 'week') {
      this.renderWeekView(calendarBody, date, events, onDateClick, onEventClick);
    } else {
      this.renderDayView(calendarBody, date, events, onEventClick);
    }
    
    calendarContainer.appendChild(calendarBody);
    
    // 컨테이너에 추가
    container.innerHTML = '';
    container.appendChild(calendarContainer);
  },
  
  renderDayView(container, date, events, onEventClick) {
    // 일간 뷰 구현
    container.className = 'calendar-day-view';
    
    // 시간 슬롯 생성 (9시~19시)
    for (let hour = 9; hour < 19; hour++) {
      // 정시
      const timeSlot = document.createElement('div');
      timeSlot.className = 'time-slot';
      
      const timeLabel = document.createElement('div');
      timeLabel.className = 'time-label';
      timeLabel.textContent = `${hour}:00`;
      
      const slotContent = document.createElement('div');
      slotContent.className = 'slot-content';
      slotContent.dataset.time = `${hour}:00`;
      
      // 해당 시간의 이벤트 필터링 및 추가
      const slotEvents = events.filter(event => {
        const eventHour = parseInt(event.startTime.split(':')[0]);
        const eventMinute = parseInt(event.startTime.split(':')[1]);
        return eventHour === hour && eventMinute < 30;
      });
      
      slotEvents.forEach(event => {
        const eventElement = this.createEventElement(event, onEventClick);
        slotContent.appendChild(eventElement);
      });
      
      timeSlot.appendChild(timeLabel);
      timeSlot.appendChild(slotContent);
      container.appendChild(timeSlot);
      
      // 30분
      const timeSlot30 = document.createElement('div');
      timeSlot30.className = 'time-slot';
      
      const timeLabel30 = document.createElement('div');
      timeLabel30.className = 'time-label';
      timeLabel30.textContent = `${hour}:30`;
      
      const slotContent30 = document.createElement('div');
      slotContent30.className = 'slot-content';
      slotContent30.dataset.time = `${hour}:30`;
      
      // 해당 시간의 이벤트 필터링 및 추가
      const slotEvents30 = events.filter(event => {
        const eventHour = parseInt(event.startTime.split(':')[0]);
        const eventMinute = parseInt(event.startTime.split(':')[1]);
        return eventHour === hour && eventMinute >= 30;
      });
      
      slotEvents30.forEach(event => {
        const eventElement = this.createEventElement(event, onEventClick);
        slotContent30.appendChild(eventElement);
      });
      
      timeSlot30.appendChild(timeLabel30);
      timeSlot30.appendChild(slotContent30);
      container.appendChild(timeSlot30);
    }
  },
  
  renderWeekView(container, date, events, onDateClick, onEventClick) {
    // 주간 뷰 구현
    container.className = 'calendar-week-view';
    
    // 주의 시작일(일요일)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    
    // 요일 헤더
    const weekHeader = document.createElement('div');
    weekHeader.className = 'week-header';
    
    // 날짜 배열
    const days = [];
    
    // 7일 표시
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      days.push(dayDate);
      
      const dayHeader = document.createElement('div');
      dayHeader.className = 'week-day-header';
      
      // 오늘 날짜인지 확인
      const today = new Date();
      if (
        dayDate.getDate() === today.getDate() && 
        dayDate.getMonth() === today.getMonth() && 
        dayDate.getFullYear() === today.getFullYear()
      ) {
        dayHeader.classList.add('today');
      }
      
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dayDate.getDay()];
      dayHeader.innerHTML = `<div>${dayOfWeek}</div><div class="day-number">${dayDate.getDate()}</div>`;
      
      // 날짜 클릭 이벤트
      dayHeader.addEventListener('click', () => {
        onDateClick(dayDate);
      });
      
      weekHeader.appendChild(dayHeader);
    }
    
    container.appendChild(weekHeader);
    
    // 주간 일정 컨테이너
    const weekBody = document.createElement('div');
    weekBody.className = 'week-body';
    
    // 각 요일별 일정
    days.forEach(dayDate => {
      const dayCol = document.createElement('div');
      dayCol.className = 'week-day-column';
      
      // 오늘 날짜인지 확인
      const today = new Date();
      if (
        dayDate.getDate() === today.getDate() && 
        dayDate.getMonth() === today.getMonth() && 
        dayDate.getFullYear() === today.getFullYear()
      ) {
        dayCol.classList.add('today');
      }
      
      // 해당 날짜의 이벤트 필터링
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return (
          eventDate.getDate() === dayDate.getDate() &&
          eventDate.getMonth() === dayDate.getMonth() &&
          eventDate.getFullYear() === dayDate.getFullYear()
        );
      });
      
      // 이벤트 정렬 (시작 시간순)
      dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      // 이벤트 추가
      dayEvents.forEach(event => {
        const eventElement = this.createEventElement(event, onEventClick);
        dayCol.appendChild(eventElement);
      });
      
      weekBody.appendChild(dayCol);
    });
    
    container.appendChild(weekBody);
  },
  
  renderMonthView(container, date, events, onDateClick, onEventClick) {
    // 월간 뷰 구현
    container.className = 'calendar-month-view';
    
    // 요일 헤더
    const weekdayHeader = document.createElement('div');
    weekdayHeader.className = 'weekday-header';
    
    ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'weekday';
      dayHeader.textContent = day;
      weekdayHeader.appendChild(dayHeader);
    });
    
    container.appendChild(weekdayHeader);
    
    // 월 그리드
    const monthGrid = document.createElement('div');
    monthGrid.className = 'month-grid';
    
    // 현재 월의 첫날
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    
    // 이전 월의 마지막 날
    const lastDayPrevMonth = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    
    // 현재 월의 마지막 날
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    // 첫 주 시작일의 요일 (0: 일요일, 6: 토요일)
    const firstDayOfWeek = firstDay.getDay();
    
    // 날짜 셀 생성 (이전 월 마지막 날짜)
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDay = lastDayPrevMonth - firstDayOfWeek + i + 1;
      
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      
      const dayNumber = document.createElement('div');
      dayNumber.className = 'day-number';
      dayNumber.textContent = prevMonthDay;
      
      cell.appendChild(dayNumber);
      monthGrid.appendChild(cell);
    }
    
    // 현재 월 날짜 셀 생성
    for (let i = 1; i <= lastDay; i++) {
      const currentDate = new Date(date.getFullYear(), date.getMonth(), i);
      
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      
      // 오늘 날짜 강조
      const today = new Date();
      if (
        i === today.getDate() && 
        date.getMonth() === today.getMonth() && 
        date.getFullYear() === today.getFullYear()
      ) {
        cell.classList.add('today');
      }
      
      const dayNumber = document.createElement('div');
      dayNumber.className = 'day-number';
      dayNumber.textContent = i;
      
      // 날짜 클릭 이벤트
      cell.addEventListener('click', () => {
        onDateClick(currentDate);
      });
      
      // 이벤트 컨테이너
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';
      
      // 해당 날짜의 이벤트 필터링
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return (
          eventDate.getDate() === i &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      });
      
      // 최대 3개까지만 표시하고 나머지는 +N으로 표시
      const maxDisplay = 3;
      const displayCount = Math.min(dayEvents.length, maxDisplay);
      
      for (let j = 0; j < displayCount; j++) {
        const eventElement = document.createElement('div');
        eventElement.className = `event-item status-${dayEvents[j].status || 'reserved'}`;
        eventElement.textContent = `${dayEvents[j].startTime} ${dayEvents[j].customer?.name || ''}`;
        
        eventElement.addEventListener('click', (e) => {
          e.stopPropagation();
          onEventClick(dayEvents[j]);
        });
        
        eventsContainer.appendChild(eventElement);
      }
      
      // 추가 이벤트가 있는 경우
      if (dayEvents.length > maxDisplay) {
        const moreElement = document.createElement('div');
        moreElement.className = 'more-events';
        moreElement.textContent = `+${dayEvents.length - maxDisplay}`;
        eventsContainer.appendChild(moreElement);
      }
      
      cell.appendChild(dayNumber);
      cell.appendChild(eventsContainer);
      monthGrid.appendChild(cell);
    }
    
    // 다음 월 시작일 (필요한 경우)
    const totalCells = Math.ceil((firstDayOfWeek + lastDay) / 7) * 7;
    const nextMonthDays = totalCells - (firstDayOfWeek + lastDay);
    
    for (let i = 1; i <= nextMonthDays; i++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      
      const dayNumber = document.createElement('div');
      dayNumber.className = 'day-number';
      dayNumber.textContent = i;
      
      cell.appendChild(dayNumber);
      monthGrid.appendChild(cell);
    }
    
    container.appendChild(monthGrid);
  },
  
  createEventElement(event, onEventClick) {
    const eventElement = document.createElement('div');
    eventElement.className = `event-item status-${event.status || 'reserved'}`;
    eventElement.dataset.id = event.id;
    
    const timeText = document.createElement('div');
    timeText.className = 'event-time';
    timeText.textContent = `${event.startTime} ~ ${event.endTime}`;
    
    const titleText = document.createElement('div');
    titleText.className = 'event-title';
    titleText.textContent = event.customer?.name || '';
    
    const detailText = document.createElement('div');
    detailText.className = 'event-detail';
    detailText.textContent = `${event.pets?.map(p => p.name).join(', ')} - ${event.service}`;
    
    eventElement.appendChild(timeText);
    eventElement.appendChild(titleText);
    eventElement.appendChild(detailText);
    
    eventElement.addEventListener('click', () => {
      onEventClick(event);
    });
    
    return eventElement;
  }
}; 
