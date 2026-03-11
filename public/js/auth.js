async function handleLogin() {
    const email = document.getElementById('email').value;

    if (!email) return alert("Por favor ingresa tu email");

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'index.html';
    } else {
        alert('Usuario no válido');
    }
}