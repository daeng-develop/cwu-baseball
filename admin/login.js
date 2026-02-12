/* admin/login.js */

function checkPassword() {
    const pwInput = document.getElementById('admin-pw');
    const password = pwInput.value;

    // 설정할 관리자 비밀번호
    const ADMIN_PASSWORD = "cwu1234"; 

    if (password === ADMIN_PASSWORD) {
        // 같은 폴더에 있는 menu.html로 이동
        location.href = "menu.html";
    } else {
        alert("비밀번호가 올바르지 않습니다.");
        pwInput.value = ""; // 입력창 초기화
        pwInput.focus();    // 다시 입력하기 편하게 포커스
    }
}

// (선택) 비밀번호 입력창에서 엔터키 쳐도 로그인 되게 하기
document.getElementById('admin-pw').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});