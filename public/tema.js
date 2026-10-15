// Áp chủ đề sáng hoặc tối người dùng đã chọn ngay khi tải trang, trước khi vẽ, để không bị nháy sang màu khác.
// Không chọn gì thì để trình duyệt theo cài đặt của máy. Nút đổi nằm ở public/trang/tema.js.
(function () {
  try {
    var t = localStorage.getItem('sp.tema');
    if (t !== 'light' && t !== 'dark') return;
    document.documentElement.dataset.theme = t;
    var mau = t === 'dark' ? '#020a14' : '#fbfbfd';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', mau); m.removeAttribute('media'); });
  } catch (e) { /* trình duyệt chặn bộ nhớ: theo máy */ }
})();
