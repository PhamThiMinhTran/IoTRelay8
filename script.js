// =================================================================
// 1. THÔNG TIN CẤU HÌNH THINGSPEAK
// =================================================================
const CHANNEL_ID = "3180953"; // <--- THAY THẾ Ở ĐÂY
const WRITE_API_KEY = "V1R6J60AFCFRWLND"; // <--- THAY THẾ Ở ĐÂY (Dùng để gửi lệnh)
const READ_API_KEY = "WBW2X4WGVVMKUQ0F"; // <--- THAY THẾ Ở ĐÂY (Dùng để đọc trạng thái)
const THINGSPEAK_URL = "https://api.thingspeak.com";

const statusMessage = document.getElementById('status-message');

// =================================================================
// 2. HÀM GỬI LỆNH ĐIỀU KHIỂN (WRITE API)
// =================================================================

/**
 * Gửi lệnh (0 hoặc 1) đến Field tương ứng
 * @param {number} fieldIndex - Chỉ mục Field (1 đến 8)
 * @param {number} state - Trạng thái mong muốn (1: ON, 0: OFF)
 */
function sendCommand(fieldIndex, state) {
    statusMessage.textContent = `Đang gửi lệnh cho Relay ${fieldIndex}...`;
    
    // Tạo chuỗi truy vấn (query string) cho field tương ứng
    const fieldParam = `field${fieldIndex}=${state}`;
    const url = `${THINGSPEAK_URL}/update?api_key=${WRITE_API_KEY}&${fieldParam}`;

    fetch(url, { method: 'GET' }) // ThingSpeak dùng GET để update
        .then(response => {
            if (response.ok) {
                // Thành công: Cập nhật giao diện ngay lập tức 
                // (Giả định ThingSpeak đã nhận lệnh)
                updateButtonState(fieldIndex, state);
                statusMessage.textContent = `Relay ${fieldIndex} đã gửi lệnh thành công!`;
            } else {
                statusMessage.textContent = `Lỗi gửi lệnh: ${response.status} - Thử lại.`;
            }
        })
        .catch(error => {
            statusMessage.textContent = `Lỗi kết nối mạng: ${error.message}`;
            console.error('Fetch error:', error);
        });
}

// =================================================================
// 3. HÀM ĐỌC TRẠNG THÁI HIỆN TẠI CỦA TẤT CẢ 8 FIELDS (READ API)
// =================================================================

function fetchCurrentStates() {
    statusMessage.textContent = "Đang tải trạng thái hiện tại...";
    
    // 1. Tạo URL đọc dữ liệu VÀ gửi READ_API_KEY dưới dạng tham số truy vấn
    // /channels/CHANNEL_ID/feeds/last.json?api_key=READ_API_KEY
    const url = `${THINGSPEAK_URL}/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;

    // 2. Chỉ cần gọi fetch() với method GET, không cần headers nữa
    fetch(url, {
        method: 'GET'
    })
    .then(response => {
        // Kiểm tra lỗi 404/400 (Nếu Channel ID/API Key sai)
        if (!response.ok) {
            // Lỗi ở đây sẽ bắt lỗi -1 hoặc 400/403
            statusMessage.textContent = `Lỗi: Không thể kết nối. Mã HTTP: ${response.status}. Kiểm tra API Key/ID.`;
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json(); // Phải trả về JSON để xử lý tiếp
    })
    .then(data => {
        if (!data || !data.field1) {
            statusMessage.textContent = "Lỗi: Không tìm thấy dữ liệu Feed. Đảm bảo ESP32 đã gửi dữ liệu.";
            return;
        }

        // ... (Giữ nguyên phần vòng lặp for để cập nhật 8 nút)
        for (let i = 1; i <= 4; i++) {
            const fieldKey = `field${i}`;
            const state = parseInt(data[fieldKey]); 
            
            if (state === 0 || state === 1) {
                updateButtonState(i, state);
            }
        }
        statusMessage.textContent = `Đã cập nhật trạng thái lúc: ${new Date().toLocaleTimeString()}`;
    })
    .catch(error => {
        // Bắt lỗi khi không nhận được JSON hoặc lỗi kết nối mạng
        console.error('Fetch error:', error);
        if (statusMessage.textContent.indexOf('Mã HTTP') === -1) {
             statusMessage.textContent = `Lỗi đọc trạng thái: Failed to fetch (Đã thử lại)`;
        }
       
    });
}

// =================================================================
// 4. HÀM XỬ LÝ GIAO DIỆN VÀ SỰ KIỆN NÚT
// =================================================================

// Cập nhật trạng thái nút trên giao diện
function updateButtonState(relayId, newState) {
    const button = document.getElementById(`btn-relay-${relayId}`);
    const indicator = button.querySelector('.status-indicator');

    if (newState === 1) {
        button.classList.remove('OFF');
        button.classList.add('ON');
        indicator.textContent = 'BẬT';
        button.dataset.state = '1';
    } else {
        button.classList.remove('ON');
        button.classList.add('OFF');
        indicator.textContent = 'TẮT';
        button.dataset.state = '0';
    }
}

// Xử lý khi người dùng nhấn nút
function handleRelayClick(event) {
    const button = event.currentTarget;
    const relayId = parseInt(button.dataset.relayId);
    const currentState = button.dataset.state; // '0' hoặc '1'
    
    // Tính toán trạng thái mới
    const newState = (currentState === '1') ? 0 : 1; // 1 -> 0, 0 -> 1

    // Gửi lệnh lên ThingSpeak
    sendCommand(relayId, newState);
}

// Gắn sự kiện click cho tất cả các nút
document.addEventListener('DOMContentLoaded', () => {
    const relayButtons = document.querySelectorAll('.relay-btn');
    relayButtons.forEach(button => {
        // Khởi tạo trạng thái mặc định (để tránh lỗi trong handleRelayClick)
        button.dataset.state = 0; 
        button.addEventListener('click', handleRelayClick);
    });

    // Lần đầu tải trang, gọi hàm để đọc trạng thái hiện tại
    fetchCurrentStates();
    
    // Thiết lập tự động cập nhật trạng thái sau mỗi 10 giây (hoặc bằng THINGSPEAK_INTERVAL của ESP32)
    setInterval(fetchCurrentStates, 10000); 
});