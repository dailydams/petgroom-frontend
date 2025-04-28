// API 설정
const API_CONFIG = {
  BASE_URL: 'https://petgroom-api.forzamin12.workers.dev',
  TIMEOUT: 30000, // 30초
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000, // 1초
};

// 토큰 관리
const TokenService = {
  getToken() {
    return sessionStorage.getItem('token');
  },
  
  saveToken(token, expiresIn) {
    sessionStorage.setItem('token', token);
    
    // 만료 시간 저장 (현재 시간 + expiresIn초)
    const expiresAt = new Date().getTime() + (expiresIn * 1000);
    sessionStorage.setItem('tokenExpires', expiresAt);
  },
  
  removeToken() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('tokenExpires');
  },
  
  isTokenExpired() {
    const expiresAt = sessionStorage.getItem('tokenExpires');
    if (!expiresAt) return true;
    
    return new Date().getTime() > parseInt(expiresAt);
  }
};

// 네트워크 상태 확인
function isOnline() {
  return navigator.onLine;
}

// 인증 헤더 설정
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
  
  const token = TokenService.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// API 요청 함수 (재시도 로직 포함)
async function apiRequest(endpoint, method = 'GET', data = null, retries = API_CONFIG.RETRY_COUNT) {
  try {
    if (!isOnline()) {
      throw new Error('인터넷 연결이 오프라인 상태입니다. 연결 상태를 확인해주세요.');
    }
    
    // 요청 옵션 설정
    const options = {
      method,
      headers: getHeaders(),
      timeout: API_CONFIG.TIMEOUT
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    // AbortController로 타임아웃 처리
    const controller = new AbortController();
    options.signal = controller.signal;
    
    // 타임아웃 설정
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, options);
      clearTimeout(timeoutId);
      
      const result = await response.json();
      
      // API 에러 처리
      if (!response.ok) {
        throw new Error(result.error || '오류가 발생했습니다');
      }
      
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      
      // AbortController 에러일 경우 타임아웃 에러로 변환
      if (err.name === 'AbortError') {
        throw new Error('요청 시간이 초과되었습니다. 나중에 다시 시도해주세요.');
      }
      
      // 네트워크 에러인 경우 재시도
      if (err.message.includes('NetworkError') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
          return apiRequest(endpoint, method, data, retries - 1);
        }
      }
      
      throw err;
    }
  } catch (error) {
    console.error(`API 요청 오류 (${endpoint}):`, error);
    throw error;
  }
}

// ====== 인증 관련 API ======

// 초기 관리자 계정 설정
async function initAdmin() {
  return apiRequest('/api/init-admin', 'POST');
}

// 로그인
async function login(email, password) {
  const response = await apiRequest('/api/auth/login', 'POST', { email, password });
  
  // 토큰 저장
  if (response.token) {
    TokenService.saveToken(response.token, response.expiresIn);
  }
  
  return response;
}

// 토큰 갱신
async function refreshToken() {
  if (!TokenService.getToken()) {
    throw new Error('로그인이 필요합니다');
  }
  
  try {
    const response = await apiRequest('/api/auth/refresh', 'POST');
    
    if (response.token) {
      TokenService.saveToken(response.token, response.expiresIn);
    }
    
    return response;
  } catch (error) {
    // 토큰 갱신 실패 시 로그아웃 처리
    TokenService.removeToken();
    throw error;
  }
}

// 로그아웃
function logout() {
  TokenService.removeToken();
  sessionStorage.removeItem('currentUser');
  
  // 로그인 페이지로 리디렉션
  window.location.href = 'index.html';
}

// 사용자 정보 조회
async function getMe() {
  return apiRequest('/api/auth/me');
}

// 회원가입
async function register(userData) {
  return apiRequest('/api/auth/register', 'POST', userData);
}

// 비밀번호 변경
async function changePassword(currentPassword, newPassword) {
  return apiRequest('/api/auth/change-password', 'POST', {
    currentPassword, newPassword
  });
}

// ====== 사용자/직원 관련 API ======

// 모든 직원 목록 조회
async function getStaff() {
  return apiRequest('/api/staff');
}

// 계정 추가/수정
async function saveUser(userData) {
  return apiRequest('/api/users', 'POST', userData);
}

// 계정 삭제
async function deleteUser(id) {
  return apiRequest(`/api/users/${id}`, 'DELETE');
}

// ====== 고객 관련 API ======

// 고객 목록 조회
async function getCustomers(page = 1, limit = 20, search = '') {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', limit);
  if (search) params.append('search', search);
  
  return apiRequest(`/api/customers?${params.toString()}`);
}

// 고객 상세 조회
async function getCustomer(id) {
  return apiRequest(`/api/customers/${id}`);
}

// 전화번호로 고객 조회
async function getCustomerByPhone(phone) {
  return apiRequest(`/api/customers/phone/${phone}`);
}

// 고객 추가/수정
async function saveCustomer(customerData) {
  return apiRequest('/api/customers', 'POST', customerData);
}

// 고객 삭제
async function deleteCustomer(id) {
  return apiRequest(`/api/customers/${id}`, 'DELETE');
}

// ====== 예약 관련 API ======

// 예약 목록 조회
async function getAppointments(filters = {}) {
  const params = new URLSearchParams();
  
  // 필터 옵션 추가
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.staffId) params.append('staffId', filters.staffId);
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  
  return apiRequest(`/api/appointments?${params.toString()}`);
}

// 날짜별 예약 조회
async function getAppointmentsByDate(date, staffId = null) {
  const params = new URLSearchParams();
  if (staffId) params.append('staffId', staffId);
  
  return apiRequest(`/api/appointments/date/${date}?${params.toString()}`);
}

// 예약 추가/수정
async function saveAppointment(appointmentData) {
  return apiRequest('/api/appointments', 'POST', appointmentData);
}

// 예약 상태 변경
async function updateAppointmentStatus(id, status) {
  return apiRequest(`/api/appointments/${id}/status`, 'PATCH', { status });
}

// 예약 삭제
async function deleteAppointment(id) {
  return apiRequest(`/api/appointments/${id}`, 'DELETE');
}

// ====== 매출 관련 API ======

// 매출 목록 조회
async function getSales(filters = {}) {
  const params = new URLSearchParams();
  
  // 필터 옵션 추가
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.staffId) params.append('staffId', filters.staffId);
  
  return apiRequest(`/api/sales?${params.toString()}`);
}

// 매출 통계 조회
async function getSalesStats(period = 'month', staffId = 'all') {
  const params = new URLSearchParams();
  params.append('period', period);
  if (staffId) params.append('staffId', staffId);
  
  return apiRequest(`/api/sales/stats?${params.toString()}`);
}

// 기간별 매출 조회
async function getSalesByPeriod(startDate, endDate, staffId = 'all') {
  const params = new URLSearchParams();
  if (staffId !== 'all') params.append('staffId', staffId);
  
  return apiRequest(`/api/sales/period/${startDate}/${endDate}?${params.toString()}`);
}

// 매출 등록
async function saveSale(saleData) {
  return apiRequest('/api/sales', 'POST', saleData);
}

// 매출 삭제
async function deleteSale(id) {
  return apiRequest(`/api/sales/${id}`, 'DELETE');
}

// 모듈 내보내기
export const API = {
  // 인증 관련
  initAdmin,
  login,
  logout,
  refreshToken,
  getMe,
  register,
  changePassword,
  
  // 사용자/직원 관련
  getStaff,
  saveUser,
  deleteUser,
  
  // 고객 관련
  getCustomers,
  getCustomer,
  getCustomerByPhone,
  saveCustomer,
  deleteCustomer,
  
  // 예약 관련
  getAppointments,
  getAppointmentsByDate,
  saveAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  
  // 매출 관련
  getSales,
  getSalesStats,
  getSalesByPeriod,
  saveSale,
  deleteSale,
  
  // 유틸리티
  isOnline,
  isTokenExpired: TokenService.isTokenExpired
};

// 네트워크 연결 상태 감지
window.addEventListener('online', () => {
  console.log('온라인 상태로 전환되었습니다.');
  // 온라인 상태로 돌아왔을 때 로직을 여기 추가
});

window.addEventListener('offline', () => {
  console.log('오프라인 상태로 전환되었습니다.');
  // 오프라인 상태일 때 사용자에게 알림
  // 예: toastMessage('인터넷 연결이 끊겼습니다. 연결 상태를 확인해주세요.');
});
