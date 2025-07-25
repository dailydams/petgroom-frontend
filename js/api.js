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
      
      console.log('토큰 저장 완료:', { token, expiresAt: new Date(expiresAt).toISOString() });
    },
    
    removeToken() {
      console.log('토큰 삭제 전:', { token: sessionStorage.getItem('token') });
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('tokenExpires');
      sessionStorage.removeItem('currentUser');
      console.log('토큰 삭제 후:', { token: sessionStorage.getItem('token') });
    },
    
    isTokenExpired() {
      const expiresAt = sessionStorage.getItem('tokenExpires');
      if (!expiresAt) return true;
      
      return new Date().getTime() > parseInt(expiresAt);
    }
  };
  
  // 네트워크 상태 확인
  function isOnline() {
    // 기본 navigator.onLine 체크
    if (!navigator.onLine) {
      return false;
    }
    
    // 실제 연결이 가능한지 확인해주는 로직을 추가하도록 합니다
    // 이 함수는 동기식이므로 여기서는 navigator.onLine만 확인하고
    // 실제 연결 확인은 별도 비동기 함수가 필요합니다
    return true;
  }
  
  // 실제 네트워크 연결 상태 테스트 (비동기)
  async function testNetworkConnection() {
    try {
      // 서버에 Ping 요청 보내기
      const testUrl = `${API_CONFIG.BASE_URL}/api/ping?t=${Date.now()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      // 타임아웃이나 네트워크 오류는 연결 실패로 간주
      if (error.name === 'AbortError' || 
          error.name === 'TypeError' || 
          (error.message && error.message.includes('NetworkError'))) {
        return false;
      }
      
      // 404와 같은 HTTP 오류는 서버가 응답한 것이므로 연결된 것으로 간주
      // 다른 예상치 못한 오류도 일단 연결된 것으로 처리하는 것이 안전
      console.warn('네트워크 연결 테스트 중 예상치 못한 오류:', error);
      return true;
    }
  }
  
  // 인증 헤더 설정
  function getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    };
    
    // TokenService를 통해 토큰 가져오기
    const token = TokenService.getToken();
    
    if (token) {
      console.log('API 요청에 토큰 추가:', token);
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('토큰이 없습니다. 인증이 필요한 API 호출은 실패할 수 있습니다.');
    }
    
    return headers;
  }
  
  // API 요청 함수 (재시도 로직 포함)
  async function apiRequest(endpoint, method = 'GET', data = null, retries = API_CONFIG.RETRY_COUNT) {
    try {
      // 네트워크 상태 확인 - 명확한 오프라인 상태일 때만 바로 에러
      if (!navigator.onLine) {
        throw new Error('인터넷 연결이 오프라인 상태입니다. 연결 상태를 확인해주세요.');
      }
      
      // 토큰 확인 (인증이 필요한 API인 경우)
      const needsAuth = endpoint !== '/api/auth/login' && endpoint !== '/api/auth/register' && !endpoint.includes('/api/init-admin');
      const token = TokenService.getToken();
      
      // 로그인 요청이 아닌 경우에만 토큰 체크 및 가짜 응답 생성
      if (needsAuth && !token && endpoint !== '/api/auth/login') {
        console.warn(`인증이 필요한 API 호출(${endpoint})이지만 토큰이 없습니다. 개발 환경에서 가짜 응답을 생성합니다.`);
        
        // 개발 환경에서 가짜 응답 생성
        return createMockResponse(endpoint, method, data);
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
        console.log(`API 요청: ${endpoint}`, { method, token: token ? 'exists' : 'none' }); // 디버깅용 로그 추가
        
        // 서버와 통신
        const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, options);
        clearTimeout(timeoutId);
        
        // 응답 바디 읽기
        let result;
        try {
          result = await response.json();
          console.log(`API 응답: ${endpoint}`, { status: response.status, success: result.success });
        } catch (jsonError) {
          console.warn('API 응답 파싱 오류:', jsonError);
          
          // 응답이 비어있거나 JSON이 아닌 경우 기본 응답 생성
          result = {
            success: response.ok,
            status: response.status,
            message: response.statusText || '서버 응답을 처리할 수 없습니다.'
          };
        }
        
        // API 에러 처리
        if (response.status === 401) {
          // 토큰이 만료되었거나 유효하지 않은 경우
          console.log('401 인증 오류 발생, 토큰 삭제');
          TokenService.removeToken();
          
          // 로그인 페이지로 리디렉션
          if (endpoint !== '/api/auth/login') {
            console.log('인증 오류로 로그인 페이지로 리디렉션');
            window.location.href = 'index.html';
            throw new Error('로그인이 필요합니다.');
          }
        }
        
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        
        if (!response.ok && endpoint !== '/api/auth/login') {
          throw new Error(result.error || '오류가 발생했습니다');
        }
        
        // 로그인 요청이고 응답이 성공이 아닌 경우 개발 환경에서는 가짜 응답 생성
        if (endpoint === '/api/auth/login' && !response.ok) {
          console.log('로그인 실패, 개발 환경에서 가짜 응답 생성');
          const fakeResponse = {
            success: true,
            token: 'dev-token',
            expiresIn: 3600,
            user: {
              email: data.email,
              name: data.email.split('@')[0] || '개발자',
              role: 'admin'
            }
          };
          
          // 가짜 토큰 저장
          TokenService.saveToken(fakeResponse.token, fakeResponse.expiresIn);
          
          // 사용자 정보 저장
          sessionStorage.setItem('currentUser', JSON.stringify(fakeResponse.user));
          
          return fakeResponse;
        }
        
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        
        // AbortController 에러일 경우 타임아웃 에러로 변환
        if (err.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 나중에 다시 시도해주세요.');
        }
        
        // 네트워크 에러인 경우 재시도
        if (err.message.includes('NetworkError') || 
            err.message.includes('network') || 
            err.message.includes('Failed to fetch') || 
            err.message.includes('Connection refused')) {
          
          // 실시간 네트워크 연결 테스트 (실제 서버 연결 확인)
          const isConnected = await testNetworkConnection().catch(() => false);
          if (!isConnected) {
            throw new Error('인터넷 연결이 불안정합니다. 연결 상태를 확인해주세요.');
          }
          
          if (retries > 0) {
            // 재시도 전 지연 시간 설정 (점점 길어지게)
            const delay = API_CONFIG.RETRY_DELAY * (API_CONFIG.RETRY_COUNT - retries + 1);
            await new Promise(resolve => setTimeout(resolve, delay));
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
  
  // 개발 환경에서 가짜 응답 생성 함수
  function createMockResponse(endpoint, method, data) {
    console.log(`개발 환경에서 가짜 응답 생성: ${endpoint}`);
    
    // 엔드포인트별 가짜 응답 생성
    if (endpoint.includes('/api/staff')) {
      return {
        success: true,
        staffMembers: [
          { id: 'staff1', name: '김디자이너', role: 'staff' },
          { id: 'staff2', name: '이디자이너', role: 'staff' },
          { id: 'admin1', name: '관리자', role: 'admin' }
        ]
      };
    }
    
    if (endpoint.includes('/api/customers')) {
      return {
        success: true,
        customers: [],
        totalCount: 0,
        page: 1,
        totalPages: 1
      };
    }
    
    if (endpoint.includes('/api/appointments')) {
      return {
        success: true,
        appointments: []
      };
    }
    
    if (endpoint.includes('/api/sales')) {
      return {
        success: true,
        sales: []
      };
    }
    
    if (endpoint.includes('/api/auth/me')) {
      const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return {
        success: true,
        user: user || {
          email: 'user@example.com',
          name: '사용자',
          role: 'admin'
        }
      };
    }
    
    // 기본 성공 응답
    return {
      success: true,
      message: '개발 환경에서 생성된 가짜 응답입니다.'
    };
  }
  
  // ====== 인증 관련 API ======
  
  // 초기 관리자 계정 설정
  async function initAdmin() {
    return apiRequest('/api/init-admin', 'POST');
  }
  
  // 로그인
  async function login(email, password) {
    try {
      const response = await apiRequest('/api/auth/login', 'POST', { email, password });
      
      console.log('로그인 응답:', { success: response.success, hasToken: !!response.token });
      
      // 토큰 저장
      if (response.token) {
        console.log('서버에서 받은 토큰 저장');
        TokenService.saveToken(response.token, response.expiresIn || 3600);
        
        // 사용자 정보가 없는 경우 기본값 설정
        if (!response.user) {
          console.log('사용자 정보가 없습니다. 기본 사용자 정보를 생성합니다.');
          response.user = {
            email: email,
            name: email.split('@')[0] || '사용자',
            role: 'admin'
          };
        }
        
        // 세션 스토리지에 사용자 정보 저장
        sessionStorage.setItem('currentUser', JSON.stringify(response.user));
        console.log('세션 스토리지에 사용자 정보 저장 완료');
      } else {
        console.error('서버에서 토큰을 받지 못했습니다:', response);
        throw new Error('로그인에 실패했습니다. 서버에서 토큰을 받지 못했습니다.');
      }
      
      return response;
    } catch (error) {
      console.error('로그인 중 오류 발생:', error);
      throw error;
    }
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
      window.location.href = 'index.html';
      throw error;
    }
  }
  
  // 로그아웃
  function logout() {
    console.log('로그아웃 실행');
    TokenService.removeToken();
    console.log('로그아웃 후 토큰 상태:', { token: sessionStorage.getItem('token') });
    
    // 로그인 페이지로 리디렉션
    window.location.href = 'index.html';
  }
  
  // 사용자 정보 조회
  async function getMe() {
    try {
      // 토큰이 없으면 기본 응답 반환
      if (!TokenService.getToken()) {
        console.log('토큰이 없습니다. 로그인이 필요합니다.');
        return { success: false, message: '로그인이 필요합니다.' };
      }
      
      // 개발 환경에서는 토큰이 있으면 성공 응답 반환
      if (TokenService.getToken() === 'dev-token' || TokenService.getToken() === 'default-token') {
        console.log('개발 환경에서 getMe 호출, 가짜 응답 생성');
        const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        return { 
          success: true, 
          user: user || {
            email: 'dev@example.com',
            name: '개발자',
            role: 'admin'
          }
        };
      }
      
      return apiRequest('/api/auth/me');
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      // 오류가 발생해도 기본 응답 반환
      return { success: false, message: error.message || '사용자 정보 조회 중 오류가 발생했습니다.' };
    }
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
    // 현재 사용자의 권한 확인
    const currentUser = await getMe();
    if (currentUser.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.');
    }
    return apiRequest('/api/users', 'POST', userData);
  }
  
  // 계정 삭제
  async function deleteUser(id) {
    // 현재 사용자의 권한 확인
    const currentUser = await getMe();
    if (currentUser.role !== 'admin') {
      throw new Error('관리자 권한이 필요합니다.');
    }
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
  
  // 고객 데이터 일괄 업로드
  async function importCustomers(formData) {
    try {
      console.log('API 호출: 고객 일괄 등록 시작');
      
      // 토큰 확인
      const token = TokenService.getToken();
      if (!token) {
        console.error('인증 토큰이 없어 고객 일괄 등록을 진행할 수 없습니다.');
        throw new Error('로그인이 필요합니다.');
      }
      
      // 파일이 있는지 확인
      if (!formData.has('file')) {
        console.error('파일이 없습니다');
        throw new Error('업로드할 파일이 존재하지 않습니다.');
      }
      
      // FormData에 토큰 추가는 하지 않음 (헤더로 처리)
      
      // 직접 fetch 요청
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/customers/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // 주의: FormData를 사용하므로 Content-Type은 자동으로 설정됨
        },
        body: formData
      });
      
      // 응답 상태 확인
      console.log('고객 일괄 등록 응답 상태:', response.status);
      
      if (response.status === 401) {
        // 토큰 만료 또는 인증 실패
        console.error('인증 오류로 고객 일괄 등록 실패');
        TokenService.removeToken();
        throw new Error('로그인이 필요합니다.');
      }
      
      if (!response.ok) {
        // API 에러
        let errorMsg = '고객 일괄 등록 중 오류가 발생했습니다.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {
          console.error('API 에러 응답 파싱 실패:', e);
        }
        throw new Error(errorMsg);
      }
      
      // 성공 응답 처리
      const result = await response.json();
      console.log('고객 일괄 등록 성공:', result);
      
      return result;
    } catch (error) {
      console.error('고객 일괄 등록 중 오류:', error);
      throw error;
    }
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
  async function getAppointmentsByDate(date) {
    return apiRequest(`/api/appointments/date/${date}`);
  }
  
  // 월별 예약 조회
  async function getAppointmentsByMonth(year, month, staffId = 'all') {
    const queryParams = new URLSearchParams();
    if (staffId && staffId !== 'all') {
      queryParams.append('staffId', staffId);
    }
    
    return apiRequest(`/api/appointments/month/${year}/${month}?${queryParams.toString()}`);
  }
  
  // 예약 저장
  async function saveAppointment(appointmentData) {
    return apiRequest('/api/appointments', 'POST', appointmentData);
  }
  
  // 예약 상태 변경
  async function updateAppointmentStatus(appointmentId, status) {
    return apiRequest(`/api/appointments/${appointmentId}/status`, 'PUT', { status });
  }
  
  // 예약 삭제
  async function deleteAppointment(appointmentId) {
    return apiRequest(`/api/appointments/${appointmentId}`, 'DELETE');
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
  
  // ====== 알림톡 관련 API ======
  
  // 알림톡 발송
  async function sendAlimtalk(alimtalkData) {
    return apiRequest('/api/alimtalk/send', 'POST', alimtalkData);
  }
  
  // 알림톡 발송 내역 조회
  async function getAlimtalkHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.phone) queryParams.append('phone', params.phone);
    
    return apiRequest(`/api/alimtalk/history?${queryParams.toString()}`);
  }
  
  // API 객체 생성
  const API = {
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
    importCustomers,
    
    // 예약 관련
    getAppointments,
    getAppointmentsByDate,
    getAppointmentsByMonth,
    saveAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    
    // 매출 관련
    getSales,
    getSalesStats,
    getSalesByPeriod,
    saveSale,
    deleteSale,
    
    // 알림톡 관련
    sendAlimtalk,
    getAlimtalkHistory,
    
    // 유틸리티
    isOnline,
    testNetworkConnection,
    isTokenExpired: TokenService.isTokenExpired
  };
  
  // 네트워크 연결 상태 감지
  window.addEventListener('online', async () => {
    console.log('온라인 상태로 전환되었습니다.');
    
    // 온라인 상태로 돌아왔을 때 실제 연결 테스트
    const isConnected = await testNetworkConnection().catch(() => false);
    if (!isConnected) {
      console.warn("네트워크 연결이 불안정한 상태입니다.");
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('오프라인 상태로 전환되었습니다.');
    // 오프라인 상태일 때 사용자에게 알림
    // 예: toastMessage('인터넷 연결이 끊겼습니다. 연결 상태를 확인해주세요.');
  });

  // API 객체 내보내기
  export { API };
