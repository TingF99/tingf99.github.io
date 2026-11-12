// === 請確認這裡是你剛剛部署的 API 網址 ===
const API_URL = "https://script.google.com/macros/s/AKfycbz-cl0Vw32rdbINKgdCQqpHoNIuNRsTgUMPQ3yHYGgPQvnjtgpU7jhA2gyvQuNksZuxDg/exec";
const RESTAURANT = "海大餐廳";

// 自動替換網頁中的餐廳名稱
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.restaurant-name').forEach(el => el.innerText = RESTAURANT);
});

// 封裝 POST 請求，用 text/plain 送出避免 CORS 問題
async function postData(data) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (err) {
        return { error: "網路連線錯誤，請稍後再試" };
    }
}