// === 設定區 ===
const API_URL = "https://script.google.com/macros/s/AKfycbz-cl0Vw32rdbINKgdCQqpHoNIuNRsTgUMPQ3yHYGgPQvnjtgpU7jhA2gyvQuNksZuxDg/exec";
const RESTAURANT = "海大餐廳";

// 設定餐廳名稱
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.restaurant-name').forEach(el => el.innerText = RESTAURANT);
});

// 封裝 POST 請求 (避免 CORS preflight)
async function postData(data) {
    const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data) // 不設定 Content-Type，讓瀏覽器用 text/plain 送出
    });
    return res.json();
}
