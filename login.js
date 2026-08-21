// login.js - Sistema de Login Simplificado (Empresa Única)

document.addEventListener('DOMContentLoaded', function() {
    

    // ============================================
    // FUNÇÕES DE NAVEGAÇÃO
    // ============================================
    window.mostrarLogin = function() {
        document.querySelectorAll('.form-container').forEach(function(el) {
            el.classList.remove('active');
        });
        document.getElementById('loginForm').classList.add('active');
        document.getElementById('loginError').classList.remove('show');
    };

    window.mostrarCadastro = function() {
        document.querySelectorAll('.form-container').forEach(function(el) {
            el.classList.remove('active');
        });
        document.getElementById('cadastroForm').classList.add('active');
        document.getElementById('cadastroError').classList.remove('show');
        document.getElementById('cadastroSuccess').classList.remove('show');
    };

    window.mostrarRecuperar = function() {
        document.querySelectorAll('.form-container').forEach(function(el) {
            el.classList.remove('active');
        });
        document.getElementById('recuperarForm').classList.add('active');
        document.getElementById('recuperarError').classList.remove('show');
        document.getElementById('recuperarSuccess').classList.remove('show');
    };

    window.togglePassword = function(inputId, iconElement) {
        var input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            iconElement.classList.remove('fa-eye');
            iconElement.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            iconElement.classList.remove('fa-eye-slash');
            iconElement.classList.add('fa-eye');
        }
    };

    // ============================================
    // FUNÇÃO DE LOGIN
    // ============================================
    window.fazerLogin = async function() {
        var email = document.getElementById('loginUser').value.trim();
        var senha = document.getElementById('loginPassword').value;
        var errorEl = document.getElementById('loginError');
        var btnLogin = document.querySelector('.btn-login');
        
        if (typeof AuthService === 'undefined') {
            errorEl.textContent = 'Sistema não carregado. Recarregue a página.';
            errorEl.classList.add('show');
            return;
        }

        if (!email || !senha) {
            errorEl.textContent = 'Preencha todos os campos.';
            errorEl.classList.add('show');
            return;
        }

        errorEl.classList.remove('show');
        
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            var result = await AuthService.login(email, senha);

            if (result.success) {
                // Redireciona para o dashboard
                window.location.href = 'index.html';
            } else {
                errorEl.textContent = result.message;
                errorEl.classList.add('show');
                
                var passwordInput = document.getElementById('loginPassword');
                passwordInput.style.borderColor = '#b13e3a';
                setTimeout(function() {
                    passwordInput.style.borderColor = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Erro no login:', error);
            errorEl.textContent = 'Erro ao fazer login. Tente novamente.';
            errorEl.classList.add('show');
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    };

    // ============================================
    // FUNÇÃO DE CADASTRO
    // ============================================
    window.fazerCadastro = async function() {
        var nome = document.getElementById('cadastroNome').value.trim();
        var usuario = document.getElementById('cadastroUser').value.trim();
        var email = document.getElementById('cadastroEmail').value.trim();
        var senha = document.getElementById('cadastroPassword').value;
        var confirm = document.getElementById('cadastroConfirm').value;
        var termos = document.getElementById('cadastroTermos').checked;

        var errorEl = document.getElementById('cadastroError');
        var successEl = document.getElementById('cadastroSuccess');
        var btnCadastro = document.querySelector('.btn-cadastro');

        errorEl.classList.remove('show');
        successEl.classList.remove('show');

        if (typeof AuthService === 'undefined') {
            errorEl.textContent = 'Sistema não carregado. Recarregue a página.';
            errorEl.classList.add('show');
            return;
        }

        if (!nome || !usuario || !email || !senha || !confirm) {
            errorEl.textContent = 'Preencha todos os campos.';
            errorEl.classList.add('show');
            return;
        }

        if (senha !== confirm) {
            errorEl.textContent = 'As senhas não coincidem.';
            errorEl.classList.add('show');
            return;
        }

        if (senha.length < 6) {
            errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
            errorEl.classList.add('show');
            return;
        }

        if (!termos) {
            errorEl.textContent = 'Você deve aceitar os termos de uso.';
            errorEl.classList.add('show');
            return;
        }

        btnCadastro.disabled = true;
        btnCadastro.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

        try {
            var result = await AuthService.cadastrar(email, senha, nome, usuario);

            if (result.success) {
                successEl.textContent = '✅ ' + result.message + ' Redirecionando...';
                successEl.classList.add('show');
                
                document.getElementById('cadastroNome').value = '';
                document.getElementById('cadastroUser').value = '';
                document.getElementById('cadastroEmail').value = '';
                document.getElementById('cadastroPassword').value = '';
                document.getElementById('cadastroConfirm').value = '';
                document.getElementById('cadastroTermos').checked = false;

                setTimeout(function() {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                errorEl.textContent = result.message;
                errorEl.classList.add('show');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            errorEl.textContent = 'Erro ao cadastrar. Tente novamente.';
            errorEl.classList.add('show');
        } finally {
            btnCadastro.disabled = false;
            btnCadastro.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
        }
    };

    // ============================================
    // RECUPERAR SENHA
    // ============================================
    window.recuperarSenha = async function() {
        var email = document.getElementById('recuperarEmail').value.trim();
        var errorEl = document.getElementById('recuperarError');
        var successEl = document.getElementById('recuperarSuccess');
        var btnRecuperar = document.querySelector('.btn-recuperar');

        errorEl.classList.remove('show');
        successEl.classList.remove('show');

        if (typeof AuthService === 'undefined') {
            errorEl.textContent = 'Sistema não carregado. Recarregue a página.';
            errorEl.classList.add('show');
            return;
        }

        if (!email) {
            errorEl.textContent = 'Informe seu e-mail.';
            errorEl.classList.add('show');
            return;
        }

        btnRecuperar.disabled = true;
        btnRecuperar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            var result = await AuthService.recuperarSenha(email);

            if (result.success) {
                successEl.textContent = result.message;
                successEl.classList.add('show');
                document.getElementById('recuperarEmail').value = '';

                setTimeout(function() {
                    window.mostrarLogin();
                }, 3000);
            } else {
                errorEl.textContent = result.message;
                errorEl.classList.add('show');
            }
        } catch (error) {
            console.error('Erro na recuperação:', error);
            errorEl.textContent = 'Erro ao recuperar senha. Tente novamente.';
            errorEl.classList.add('show');
        } finally {
            btnRecuperar.disabled = false;
            btnRecuperar.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Instruções';
        }
    };

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    // Verifica se já está logado
    if (typeof AuthService !== 'undefined' && AuthService.isLoggedIn()) {
        window.location.href = 'index.html';
    }

    // Event listeners para Enter
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (document.getElementById('loginForm').classList.contains('active')) {
                e.preventDefault();
                window.fazerLogin();
            } else if (document.getElementById('cadastroForm').classList.contains('active')) {
                e.preventDefault();
                window.fazerCadastro();
            } else if (document.getElementById('recuperarForm').classList.contains('active')) {
                e.preventDefault();
                window.recuperarSenha();
            }
        }
    });

});