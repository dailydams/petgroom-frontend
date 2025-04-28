// API 엔드포인트 설정
const API_URL = 'https://petgroom-api.<YOUR_CLOUDFLARE_ACCOUNT>.workers.dev';

// 토큰 가져오기
const getToken = () => {
    return sessionStorage.getItem('token');
};

// 인증 헤더 설정
const getHeaders = () => {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
};

// API 요청 함수
const apiRequest = async (endpoint, method = 'GET', data = null) => {
    try {
        const options = {
            method,
            headers: getHeaders()
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        
        // API 에러 처리
        if (!response.ok) {
            throw new Error(result.error || '오류가 발생했습니다');
        }
        
        return result;
    } catch (error) {
        console.error('API 요청 오류:', error);
        throw error;
    }
};

// ====== 인증 관련 API ======

// 초기 관리자 계정 설정
const initAdmin = async () => {
    return apiRequest('/api/init-admin', 'POST');
};

// 로그인
const login = async (email, password) => {
    return apiRequest('/api/auth/login', 'POST', { email, password });
};

// 회원가입
const register = async (userData) => {
    return apiRequest('/api/auth/register', 'POST', userData);
};

// ====== 사용자/직원 관련 API ======

// 모든 직원 목록 조회
const getStaff = async () => {
    return apiRequest('/api/staff');
};

// 계정 추가/수정
const saveUser = async (userData) => {
    return apiRequest('/api/users', 'POST', userData);
};

// 계정 삭제
const deleteUser = async (id) => {
    return apiRequest(`/api/users/${id}`, 'DELETE');
};

// ====== 고객 관련 API ======

// 고객 목록 조회
const getCustomers = async () => {
    return apiRequest('/api/customers');
};

// 고객 상세 조회
const getCustomer = async (id) => {
    return apiRequest(`/api/customers/${id}`);
};

// 전화번호로 고객 조회
const getCustomerByPhone = async (phone) => {
    return apiRequest(`/api/customers/phone/${phone}`);
};

// 고객 추가/수정
const saveCustomer = async (customerData) => {
    return apiRequest('/api/customers', 'POST', customerData);
};

// ====== 예약 관련 API ======

// 예약 목록 조회
const getAppointments = async () => {
    return apiRequest('/api/appointments');
};

// 날짜별 예약 조회
const getAppointmentsByDate = async (date) => {
    return apiRequest(`/api/appointments/date/${date}`);
};

// 예약 추가/수정
const saveAppointment = async (appointmentData) => {
    return apiRequest('/api/appointments', 'POST', appointmentData);
};

// 예약 상태 변경
const updateAppointmentStatus = async (id, status) => {
    return apiRequest(`/api/appointments/${id}/status`, 'PATCH', { status });
};

// ====== 매출 관련 API ======

// 매출 목록 조회
const getSales = async () => {
    return apiRequest('/api/sales');
};

// 기간별 매출 조회
const getSalesByPeriod = async (startDate, endDate, staffId = 'all') => {
    return apiRequest(`/api/sales/period/${startDate}/${endDate}?staffId=${staffId}`);
};

// 매출 등록
const saveSale = async (saleData) => {
    return apiRequest('/api/sales', 'POST', saleData);
};

// 모듈 내보내기
export const API = {
    initAdmin,
    login,
    register,
    getStaff,
    saveUser,
    deleteUser,
    getCustomers,
    getCustomer,
    getCustomerByPhone,
    saveCustomer,
    getAppointments,
    getAppointmentsByDate,
    saveAppointment,
    updateAppointmentStatus,
    getSales,
    getSalesByPeriod,
    saveSale
};
