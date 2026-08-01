// login.js - Sistema de Login Multi-Empresa (APENAS 1 ADMIN)
// CORRIGIDO - Reset de senha e funções de navegação

document.addEventListener('DOMContentLoaded', function() {
    
    console.log('🔍 Inicializando sistema de login...');
    console.log('📌 Firebase disponível:', typeof firebase !== 'undefined');
    console.log('📌 AuthService disponível:', typeof AuthService !== 'undefined');
    console.log('📌 EmpresaManager disponível:', typeof EmpresaManager !== 'undefined');

    // ===== VERIFICA SE O AUTH SERVICE FOI CARREGADO =====
    function verificarServicos() {
        if (typeof AuthService === 'undefined') {
            console.error('❌ AuthService não carregado!');
            
            var scripts = document.querySelectorAll('script');
            var firebaseServiceLoaded = false;
            scripts.forEach(function(script) {
                if (script.src && script.src.includes('firebase-service.js')) {
                    firebaseServiceLoaded = true;
                }
            });
            
            if (!firebaseServiceLoaded) {
                console.error('❌ firebase-service.js não encontrado no HTML!');
                document.getElementById('loginError').textContent = 'Erro ao carregar o sistema. Verifique sua conexão com a internet e tente novamente.';
                document.getElementById('loginError').classList.add('show');
                return false;
            }
            
            setTimeout(function() {
                if (typeof AuthService !== 'undefined') {
                    console.log('✅ AuthService carregado após retry!');
                    document.getElementById('loginError').classList.remove('show');
                    return true;
                } else {
                    console.error('❌ AuthService ainda não disponível após retry');
                    document.getElementById('loginError').textContent = 'Erro ao carregar o sistema. Recarregue a página ou verifique sua conexão.';
                    document.getElementById('loginError').classList.add('show');
                    return false;
                }
            }, 1000);
            
            return false;
        }
        
        console.log('✅ AuthService carregado com sucesso!');
        return true;
    }

    // ===== ESPERA O AUTH SERVICE SER CARREGADO =====
    function aguardarAuthService() {
        return new Promise(function(resolve) {
            if (typeof AuthService !== 'undefined') {
                resolve(true);
                return;
            }
            
            var tentativas = 0;
            var maxTentativas = 20;
            
            var interval = setInterval(function() {
                tentativas++;
                if (typeof AuthService !== 'undefined') {
                    clearInterval(interval);
                    resolve(true);
                } else if (tentativas >= maxTentativas) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });
    }

    // ===== MOSTRA EMPRESA NA TELA DE LOGIN =====
    function mostrarEmpresaAtual() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const empresa = urlParams.get('empresa') || urlParams.get('e');
            
            if (empresa) {
                const empresaInfo = EmpresaManager ? EmpresaManager.getEmpresa(empresa) : null;
                const el = document.getElementById('empresaAtual');
                if (el) {
                    if (empresaInfo) {
                        el.textContent = '🏢 ' + empresaInfo.nome;
                        el.style.display = 'block';
                    } else {
                        el.textContent = '🏢 Nova empresa - Crie sua conta';
                        el.style.display = 'block';
                        el.style.color = '#1d7a6b';
                    }
                }
            }
        } catch (e) {
            console.warn('Erro ao mostrar empresa:', e);
        }
    }

    // ===== VERIFICA SE JÁ EXISTE UM ADMIN =====
    async function verificarAdminExistente() {
        try {
            if (typeof AuthService === 'undefined') return;
            
            // Reseta cache e verifica
            AuthService.resetAdminCache();
            const hasAdmin = await AuthService._hasAdmin();
            
            const cadastroForm = document.getElementById('cadastroForm');
            const cadastroLink = document.querySelector('.login-footer a[onclick*="mostrarCadastro"]');
            const cadastroBtn = document.querySelector('.btn-cadastro');
            const cadastroInputs = document.querySelectorAll('#cadastroForm input');
            const formDesc = document.querySelector('#cadastroForm .form-desc');
            
            if (hasAdmin) {
                console.log('✅ Admin existente. Cadastro bloqueado.');
                
                // Desabilita o cadastro
                if (cadastroBtn) {
                    cadastroBtn.disabled = true;
                    cadastroBtn.innerHTML = '<i class="fas fa-lock"></i> Cadastro Bloqueado';
                    cadastroBtn.style.opacity = '0.6';
                    cadastroBtn.style.cursor = 'not-allowed';
                }
                
                cadastroInputs.forEach(input => {
                    input.disabled = true;
                    input.style.opacity = '0.6';
                    input.style.cursor = 'not-allowed';
                });
                
                if (formDesc) {
                    formDesc.innerHTML = '🔒 <strong>Cadastro bloqueado.</strong> Já existe um administrador cadastrado.';
                    formDesc.style.color = '#b13e3a';
                    formDesc.style.padding = '12px 16px';
                    formDesc.style.background = '#fde2e0';
                    formDesc.style.borderRadius = '8px';
                    formDesc.style.borderLeft = '4px solid #b13e3a';
                }
                
                const termosCheckbox = document.getElementById('cadastroTermos');
                if (termosCheckbox) {
                    termosCheckbox.disabled = true;
                }
                
                if (cadastroLink) {
                    cadastroLink.style.pointerEvents = 'none';
                    cadastroLink.style.opacity = '0.5';
                }
            } else {
                console.log('ℹ️ Nenhum admin encontrado. Cadastro liberado!');
                
                // Habilita o cadastro
                if (cadastroBtn) {
                    cadastroBtn.disabled = false;
                    cadastroBtn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
                    cadastroBtn.style.opacity = '1';
                    cadastroBtn.style.cursor = 'pointer';
                }
                
                cadastroInputs.forEach(input => {
                    input.disabled = false;
                    input.style.opacity = '1';
                    input.style.cursor = '';
                });
                
                if (formDesc) {
                    formDesc.innerHTML = 'Crie sua conta de administrador para acessar o sistema.';
                    formDesc.style.color = '';
                    formDesc.style.padding = '';
                    formDesc.style.background = '';
                    formDesc.style.borderLeft = '';
                }
                
                const termosCheckbox = document.getElementById('cadastroTermos');
                if (termosCheckbox) {
                    termosCheckbox.disabled = false;
                }
                
                if (cadastroLink) {
                    cadastroLink.style.pointerEvents = 'auto';
                    cadastroLink.style.opacity = '1';
                }
            }
        } catch (e) {
            console.warn('Erro ao verificar admin:', e);
            // Em caso de erro, libera o cadastro para não bloquear o usuário
            liberarCadastro();
        }
    }

    function liberarCadastro() {
        const cadastroBtn = document.querySelector('.btn-cadastro');
        const cadastroInputs = document.querySelectorAll('#cadastroForm input');
        const formDesc = document.querySelector('#cadastroForm .form-desc');
        const cadastroLink = document.querySelector('.login-footer a[onclick*="mostrarCadastro"]');
        const termosCheckbox = document.getElementById('cadastroTermos');
        
        if (cadastroBtn) {
            cadastroBtn.disabled = false;
            cadastroBtn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
            cadastroBtn.style.opacity = '1';
            cadastroBtn.style.cursor = 'pointer';
        }
        
        cadastroInputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '1';
            input.style.cursor = '';
        });
        
        if (formDesc) {
            formDesc.innerHTML = 'Crie sua conta de administrador para acessar o sistema.';
            formDesc.style.color = '';
            formDesc.style.padding = '';
            formDesc.style.background = '';
            formDesc.style.borderLeft = '';
        }
        
        if (termosCheckbox) {
            termosCheckbox.disabled = false;
        }
        
        if (cadastroLink) {
            cadastroLink.style.pointerEvents = 'auto';
            cadastroLink.style.opacity = '1';
        }
    }

    // ===== FUNÇÕES DE NAVEGAÇÃO =====
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
        
        // Verifica novamente o status do admin ao abrir o cadastro
        verificarAdminExistente();
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

    // ===== FORÇAR PRIMEIRO CADASTRO (BYPASS) =====
    window.forcarPrimeiroCadastro = function() {
        console.log('🔄 Forçando primeiro cadastro...');
        // Reseta o cache e verifica novamente
        if (typeof AuthService !== 'undefined') {
            AuthService.resetAdminCache();
            // Limpa qualquer admin falso do localStorage
            try {
                const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
                const admins = users.filter(u => u.perfil === 'admin' || u.perfil === 'superadmin');
                if (admins.length === 0) {
                    console.log('✅ Nenhum admin real encontrado. Cadastro liberado!');
                    liberarCadastro();
                    mostrarCadastro();
                } else {
                    console.log('⚠️ Admin encontrado no localStorage. Verificando se é válido...');
                    // Verifica se o admin é válido
                    verificarAdminExistente();
                }
            } catch (e) {
                console.warn('Erro ao limpar cache:', e);
                liberarCadastro();
                mostrarCadastro();
            }
        } else {
            liberarCadastro();
            mostrarCadastro();
        }
    };

    // ===== FUNÇÃO DE LOGIN =====
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
            var urlParams = new URLSearchParams(window.location.search);
            var empresaParam = urlParams.get('empresa') || urlParams.get('e');
            
            var result = await AuthService.login(email, senha, empresaParam);

            if (result.success) {
                var empresaId = result.empresaId || AuthService.getEmpresaAtual();
                
                if (result.user) {
                    var userData = {
                        uid: result.user.uid || 'user_' + Date.now(),
                        email: email,
                        nome: result.user.displayName || (result.userData && result.userData.nome) || email.split('@')[0],
                        usuario: (result.userData && result.userData.usuario) || email.split('@')[0],
                        perfil: result.perfil || 'admin'
                    };
                    
                    if (typeof EmpresaManager !== 'undefined') {
                        var sessao = EmpresaManager.getSessao(empresaId, userData.uid);
                        if (sessao) {
                            userData.nome = sessao.nome || userData.nome;
                            userData.usuario = sessao.usuario || userData.usuario;
                        }
                    }
                    
                    if (typeof EmpresaManager !== 'undefined') {
                        EmpresaManager.salvarSessao(empresaId, userData);
                    }
                    localStorage.setItem('dedetiza_session', JSON.stringify({
                        ...userData,
                        empresa: empresaId
                    }));
                }
                
                if (typeof FirestoreService !== 'undefined') {
                    FirestoreService.iniciarObservadores(() => {
                        console.log('🔄 Dados atualizados em tempo real!');
                        if (typeof window.renderAll === 'function') {
                            window.renderAll();
                        }
                    });
                }
                
                var url = new URL('index.html', window.location.origin);
                url.searchParams.set('empresa', empresaId);
                window.location.href = url.toString();
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

    // ===== FUNÇÃO DE CADASTRO =====
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

        // Verifica se já existe admin
        try {
            AuthService.resetAdminCache();
            const hasAdmin = await AuthService._hasAdmin();
            if (hasAdmin) {
                errorEl.textContent = '❌ Já existe um administrador cadastrado no sistema.';
                errorEl.classList.add('show');
                verificarAdminExistente();
                return;
            }
        } catch (e) {
            console.warn('Erro ao verificar admin:', e);
            // Se erro, continua para não bloquear
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
            var urlParams = new URLSearchParams(window.location.search);
            var empresaParam = urlParams.get('empresa') || urlParams.get('e') || null;
            
            var result = await AuthService.cadastrar(email, senha, nome, usuario, empresaParam);

            if (result.success) {
                successEl.textContent = '✅ ' + result.message + ' Redirecionando...';
                successEl.classList.add('show');
                
                document.getElementById('cadastroNome').value = '';
                document.getElementById('cadastroUser').value = '';
                document.getElementById('cadastroEmail').value = '';
                document.getElementById('cadastroPassword').value = '';
                document.getElementById('cadastroConfirm').value = '';
                document.getElementById('cadastroTermos').checked = false;

                var empresaId = result.empresaId || AuthService.getEmpresaAtual();

                if (result.user) {
                    var userData = {
                        uid: result.user.uid || 'user_' + Date.now(),
                        email: email,
                        nome: nome,
                        usuario: usuario,
                        perfil: 'admin'
                    };
                    if (typeof EmpresaManager !== 'undefined') {
                        EmpresaManager.salvarSessao(empresaId, userData);
                    }
                    localStorage.setItem('dedetiza_session', JSON.stringify({
                        ...userData,
                        empresa: empresaId
                    }));
                }

                setTimeout(function() {
                    var url = new URL('index.html', window.location.origin);
                    url.searchParams.set('empresa', empresaId);
                    window.location.href = url.toString();
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

    // ===== RECUPERAR SENHA - CORRIGIDO =====
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

    // ===== INICIALIZAR EVENT LISTENERS =====
    function iniciarEventListeners() {
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

        // Botão de login
        var loginBtn = document.querySelector('.btn-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Verifica se está na tela de login ou recuperação
                if (document.getElementById('loginForm').classList.contains('active')) {
                    window.fazerLogin();
                } else if (document.getElementById('recuperarForm').classList.contains('active')) {
                    window.recuperarSenha();
                }
            });
        }

        console.log('🔐 Sistema de Login Multi-Empresa carregado!');
        console.log('📌 Empresa na URL:', new URLSearchParams(window.location.search).get('empresa') || 'nenhuma');
        console.log('📌 Modo: Apenas 1 Admin permitido');
        console.log('📌 Para forçar primeiro cadastro, use: forcarPrimeiroCadastro()');
    }

    // ===== INICIALIZAÇÃO =====
    aguardarAuthService().then(function(carregado) {
        if (!carregado) {
            console.error('❌ AuthService não carregou após aguardar!');
            document.getElementById('loginError').textContent = 'Erro ao carregar o sistema. Verifique sua conexão com a internet e recarregue a página.';
            document.getElementById('loginError').classList.add('show');
            return;
        }
        
        console.log('✅ Sistema inicializado com sucesso!');
        mostrarEmpresaAtual();
        iniciarEventListeners();
        
        // Verifica se já existe admin
        setTimeout(function() {
            verificarAdminExistente();
        }, 500);
    });

    // Fallback
    if (typeof AuthService === 'undefined') {
        console.log('🔄 Tentando carregar AuthService novamente...');
        var checkInterval = setInterval(function() {
            if (typeof AuthService !== 'undefined') {
                clearInterval(checkInterval);
                console.log('✅ AuthService carregado!');
                mostrarEmpresaAtual();
                iniciarEventListeners();
                verificarAdminExistente();
            }
        }, 500);
        
        setTimeout(function() {
            clearInterval(checkInterval);
            if (typeof AuthService === 'undefined') {
                console.error('❌ AuthService não carregou após timeout!');
                document.getElementById('loginError').textContent = 'Erro ao carregar o sistema. Verifique sua conexão com a internet e recarregue a página.';
                document.getElementById('loginError').classList.add('show');
            }
        }, 10000);
    }
});

// ===== FUNÇÕES DE RESET E FORÇA =====
window.resetarCadastro = function() {
    try {
        // Remove todos os usuários do localStorage
        localStorage.removeItem('dedetiza_users');
        localStorage.removeItem('dedetiza_sessoes');
        localStorage.removeItem('dedetiza_session_atual');
        localStorage.removeItem('dedetiza_session');
        localStorage.removeItem('dedetiza_ultima_empresa');
        
        // Reseta o cache do AuthService
        if (typeof AuthService !== 'undefined' && AuthService._adminCache !== undefined) {
            AuthService._adminCache = null;
            AuthService._adminCacheTime = 0;
        }
        
        console.log('✅ Cache resetado com sucesso!');
        alert('✅ Cache resetado! Recarregue a página e tente cadastrar novamente.');
        location.reload();
    } catch (e) {
        console.error('Erro ao resetar:', e);
        alert('Erro ao resetar. Tente limpar manualmente o localStorage (F12 > Application > Local Storage > Clear).');
    }
};

window.forcarPrimeiroCadastro = function() {
    console.log('🔄 Forçando primeiro cadastro...');
    
    // Remove apenas os usuários
    try {
        localStorage.removeItem('dedetiza_users');
        if (typeof AuthService !== 'undefined' && AuthService._adminCache !== undefined) {
            AuthService._adminCache = null;
            AuthService._adminCacheTime = 0;
        }
        console.log('✅ Cache de usuários resetado!');
    } catch (e) {
        console.warn('Erro ao resetar cache:', e);
    }
    
    // Tenta liberar o cadastro
    try {
        const cadastroBtn = document.querySelector('.btn-cadastro');
        const cadastroInputs = document.querySelectorAll('#cadastroForm input');
        const formDesc = document.querySelector('#cadastroForm .form-desc');
        const cadastroLink = document.querySelector('.login-footer a[onclick*="mostrarCadastro"]');
        const termosCheckbox = document.getElementById('cadastroTermos');
        
        if (cadastroBtn) {
            cadastroBtn.disabled = false;
            cadastroBtn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta';
            cadastroBtn.style.opacity = '1';
            cadastroBtn.style.cursor = 'pointer';
        }
        
        cadastroInputs.forEach(input => {
            input.disabled = false;
            input.style.opacity = '1';
            input.style.cursor = '';
        });
        
        if (formDesc) {
            formDesc.innerHTML = 'Crie sua conta de administrador para acessar o sistema.';
            formDesc.style.color = '';
            formDesc.style.padding = '';
            formDesc.style.background = '';
            formDesc.style.borderLeft = '';
        }
        
        if (termosCheckbox) {
            termosCheckbox.disabled = false;
        }
        
        if (cadastroLink) {
            cadastroLink.style.pointerEvents = 'auto';
            cadastroLink.style.opacity = '1';
        }
        
        // Mostra a tela de cadastro
        mostrarCadastro();
        
        alert('✅ Cadastro liberado! Preencha os dados para criar o primeiro administrador.');
    } catch (e) {
        console.error('Erro ao liberar cadastro:', e);
        alert('Erro ao liberar cadastro. Tente recarregar a página e usar o botão "Resetar cadastro".');
    }
};