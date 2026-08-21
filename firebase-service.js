// firebase-service.js - SINCRONIZAÇÃO TOTALMENTE AUTOMÁTICA E MULTI-DISPOSITIVO

// ============================================
// SERVIÇO DE AUTENTICAÇÃO
// ============================================

const AuthService = {
    _loginInProgress: false,
    _lastLoginAttempt: 0,
    
    async cadastrar(email, senha, nome, usuario, empresaId = null) {
        try {
            if (!firebase || !firebase.auth) {
                return this._cadastrarFallback(email, senha, nome, usuario, empresaId);
            }

            try {
                const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
                if (methods && methods.length > 0) {
                    return { success: false, message: 'Este e-mail já está cadastrado.' };
                }
            } catch (verifyError) {}

            const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
            const user = userCredential.user;
            
            let empresaFinal = empresaId || 'empresa_unica';
            
            let empresa = EmpresaManager.getEmpresa(empresaFinal);
            if (!empresa) {
                empresa = EmpresaManager.criarEmpresa('Dedetize+ - Sistema de Gestão', empresaFinal);
            }
            
            EmpresaManager.adicionarAdmin(empresaFinal, user.uid, email, nome);
            
            try {
                await db.collection('usuarios').doc(user.uid).set({
                    id: user.uid,
                    nome: nome,
                    usuario: usuario || nome,
                    email: email,
                    empresaId: empresaFinal,
                    perfil: 'admin',
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimoAcesso: new Date().toISOString(),
                    ativo: true
                });
            } catch (firestoreError) {}

            try {
                await user.updateProfile({ displayName: nome });
            } catch (profileError) {}

            const userData = { 
                uid: user.uid, 
                email: email, 
                nome: nome, 
                usuario: usuario || nome 
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            await FirestoreService.inicializarDadosEmpresa(empresaFinal);
            await FirestoreService.sincronizarDadosEmpresa(empresaFinal);
            
            FirestoreService.iniciarObservadores(() => {
                if (typeof window.renderAll === 'function') {
                    window.renderAll();
                }
            });
            
            return { 
                success: true, 
                message: '✅ Cadastro realizado com sucesso!', 
                user: user, 
                empresaId: empresaFinal 
            };
        } catch (error) {
            return this._cadastrarFallback(email, senha, nome, usuario, empresaId);
        }
    },

    _cadastrarFallback(email, senha, nome, usuario, empresaId) {
        try {
            const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
            if (users.some(u => u.email === email)) {
                return { success: false, message: 'Este e-mail já está cadastrado.' };
            }
            
            const empresaFinal = empresaId || 'empresa_unica';
            
            if (typeof PlanService !== 'undefined') {
                const verificacao = PlanService.verificarCadastroAdmin(empresaFinal);
                if (!verificacao.permitido) {
                    if (typeof window !== 'undefined' && typeof window.abrirModal === 'function') {
                        const modalHtml = PlanService.gerarModalUpgrade(empresaFinal);
                        window.abrirModal('🔒 Limite de Administradores Atingido', modalHtml);
                    }
                    return { 
                        success: false, 
                        message: '❌ Limite de administradores atingido. Entre em contato com nosso comercial para fazer upgrade de plano.',
                        bloquear: true,
                        mostrarModal: true
                    };
                }
            }
            
            const uid = 'user_' + Date.now();
            const newUser = {
                uid: uid,
                nome: nome,
                usuario: usuario || nome,
                email: email,
                senha: senha,
                empresaId: empresaFinal,
                perfil: 'admin',
                criadoEm: new Date().toISOString(),
                ultimoAcesso: new Date().toISOString(),
                ativo: true
            };
            
            users.push(newUser);
            localStorage.setItem('dedetiza_users', JSON.stringify(users));
            EmpresaManager.adicionarAdmin(empresaFinal, uid, email, nome);
            
            const userData = { 
                uid: uid, 
                email: email, 
                nome: nome, 
                usuario: usuario || nome 
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            if (typeof PlanService !== 'undefined') {
                const resumo = PlanService.getResumoPlano(empresaFinal);
                if (resumo.estaProximo && !resumo.estaLimite) {
                    setTimeout(() => {
                        alert(`ℹ️ Você está utilizando ${resumo.porcentagemUso}% do limite de administradores.\nRestam ${resumo.limiteAdmins - resumo.adminsAtuais} vagas.\nConsidere fazer upgrade de plano para continuar crescendo!`);
                    }, 500);
                }
            }
            
            return { 
                success: true, 
                message: '✅ Cadastro realizado com sucesso! (modo offline)', 
                user: newUser, 
                empresaId: empresaFinal 
            };
        } catch (e) {
            return { success: false, message: 'Erro ao cadastrar: ' + e.message };
        }
    },
    
    async login(email, senha, empresaId = null) {
        const now = Date.now();
        if (this._loginInProgress && now - this._lastLoginAttempt < 5000) {
            return { success: false, message: 'Aguardando conclusão do login anterior...' };
        }
        
        this._loginInProgress = true;
        this._lastLoginAttempt = now;
        
        try {
            if (!firebase || !firebase.auth) {
                const result = this._loginFallback(email, senha, empresaId);
                this._loginInProgress = false;
                return result;
            }

            const userCredential = await auth.signInWithEmailAndPassword(email, senha);
            const user = userCredential.user;
            
            let empresaFinal = empresaId || 'empresa_unica';
            
            try {
                const doc = await db.collection('usuarios').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data.empresaId) {
                        empresaFinal = data.empresaId;
                    }
                }
            } catch (error) {}

            let nomeUsuario = user.displayName || email.split('@')[0];
            let usuarioLogin = email.split('@')[0];
            let perfilUsuario = 'usuario';
            
            try {
                const doc = await db.collection('usuarios').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    empresaFinal = data.empresaId || empresaFinal;
                    nomeUsuario = data.nome || data.usuario || nomeUsuario;
                    usuarioLogin = data.usuario || data.nome || usuarioLogin;
                    perfilUsuario = data.perfil || 'usuario';
                }
            } catch (error) {}

            if (perfilUsuario !== 'admin' && perfilUsuario !== 'superadmin') {
                try {
                    if (firebase && firebase.auth) {
                        await auth.signOut();
                    }
                } catch (e) {}
                this._loginInProgress = false;
                return { 
                    success: false, 
                    message: '🔒 Acesso negado! Apenas administradores têm permissão.' 
                };
            }
            
            let empresa = EmpresaManager.getEmpresa(empresaFinal);
            if (!empresa) {
                empresa = EmpresaManager.criarEmpresa('Dedetize+ - Sistema de Gestão', empresaFinal);
            }
            
            const isAdmin = EmpresaManager.isAdmin(empresaFinal, user.uid);
            if (!isAdmin) {
                EmpresaManager.adicionarAdmin(empresaFinal, user.uid, email, nomeUsuario);
            }
            
            const userData = {
                uid: user.uid,
                email: email,
                nome: nomeUsuario,
                usuario: usuarioLogin,
                perfil: perfilUsuario
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            if (typeof DB !== 'undefined') {
                DB._clearAllCaches();
            }
            
            await FirestoreService.sincronizarDadosEmpresa(empresaFinal, true);
            
            FirestoreService.iniciarObservadores(() => {
                if (typeof window.renderAll === 'function') {
                    window.renderAll();
                }
            });
            
            this._loginInProgress = false;
            return { 
                success: true, 
                message: 'Login realizado com sucesso!', 
                user: user, 
                empresaId: empresaFinal, 
                perfil: perfilUsuario 
            };
        } catch (error) {
            this._loginInProgress = false;
            return this._loginFallback(email, senha, empresaId);
        }
    },

    _loginFallback(email, senha, empresaId) {
        try {
            const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
            const user = users.find(u => u.email === email && u.senha === senha);
            
            if (!user) {
                const userByEmail = users.find(u => u.email === email);
                if (userByEmail) {
                    return { success: false, message: 'Senha incorreta.' };
                }
                return { success: false, message: 'Usuário não encontrado.' };
            }
            
            if (user.perfil !== 'admin' && user.perfil !== 'superadmin') {
                return { success: false, message: '🔒 Acesso negado! Apenas administradores têm permissão.' };
            }
            
            const empresaFinal = empresaId || user.empresaId || 'empresa_unica';
            
            const userData = { 
                uid: user.uid, 
                email: user.email, 
                nome: user.nome, 
                usuario: user.usuario || user.nome,
                perfil: user.perfil || 'admin'
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            return { 
                success: true, 
                message: 'Login realizado com sucesso! (modo offline)', 
                user: user, 
                empresaId: empresaFinal 
            };
        } catch (e) {
            return { success: false, message: 'Erro ao fazer login: ' + e.message };
        }
    },
    
    async logout(empresaId = null) {
        try {
            FirestoreService.pararObservadores();

            const usuarioId = EmpresaManager.getUsuarioAtual();
            const empresa = empresaId || EmpresaManager.getEmpresaAtual();
            
            if (usuarioId) {
                EmpresaManager.removerSessao(empresa, usuarioId);
            }
            
            localStorage.removeItem('dedetiza_session_atual');
            localStorage.removeItem('dedetiza_session');
            
            if (firebase && firebase.auth) {
                await auth.signOut();
            }
            window.location.href = 'login.html';
            
            return { success: true, message: 'Logout realizado!' };
        } catch (error) {
            window.location.href = 'login.html';
            return { success: true, message: 'Logout realizado!' };
        }
    },
    
    isLoggedIn(empresaId = null) {
        const empresa = empresaId || EmpresaManager.getEmpresaAtual();
        const usuarioId = EmpresaManager.getUsuarioAtual();
        if (usuarioId) {
            const sessao = EmpresaManager.getSessao(empresa, usuarioId);
            if (sessao && sessao.uid) {
                return true;
            }
        }
        
        if (firebase && firebase.auth && auth.currentUser) {
            return true;
        }
        return false;
    },
    
    getCurrentUser(empresaId = null) {
        const empresa = empresaId || EmpresaManager.getEmpresaAtual();
        const usuarioId = EmpresaManager.getUsuarioAtual();
        if (usuarioId) {
            const sessao = EmpresaManager.getSessao(empresa, usuarioId);
            if (sessao) {
                return sessao;
            }
        }
        
        if (firebase && firebase.auth && auth.currentUser) {
            return auth.currentUser;
        }
        return null;
    },
    
    async getCurrentUserData(empresaId = null) {
        const empresa = empresaId || EmpresaManager.getEmpresaAtual();
        const usuarioId = EmpresaManager.getUsuarioAtual();
        
        if (firebase && firebase.auth && auth.currentUser) {
            const user = auth.currentUser;
            try {
                const doc = await db.collection('usuarios').doc(user.uid).get();
                if (doc.exists) {
                    return { id: doc.id, ...doc.data() };
                }
            } catch (error) {}
        }
        
        if (usuarioId) {
            const sessao = EmpresaManager.getSessao(empresa, usuarioId);
            if (sessao) {
                return sessao;
            }
        }
        return null;
    },
    
    getEmpresaAtual() {
        return EmpresaManager.getEmpresaAtual();
    },
    
    getEmpresaInfo(empresaId = null) {
        const id = empresaId || this.getEmpresaAtual();
        return EmpresaManager.getEmpresa(id);
    },
    
    listarEmpresas() {
        return EmpresaManager.listarEmpresas();
    },
    
    gerarLinkAcesso(empresaId) {
        return EmpresaManager.gerarLinkAcesso(empresaId);
    },
    
    getEmpresasDoUsuario(usuarioId = null) {
        if (!usuarioId) {
            const user = this.getCurrentUser();
            if (user) {
                usuarioId = user.uid;
            }
        }
        if (usuarioId) {
            return EmpresaManager.getEmpresasDoUsuario(usuarioId);
        }
        return [];
    },
    
    trocarEmpresa(empresaId) {
        EmpresaManager.setEmpresaAtual(empresaId);
        return true;
    },
    
    async recuperarSenha(email) {
        try {
            if (firebase && firebase.auth) {
                await auth.sendPasswordResetEmail(email);
                return { success: true, message: 'Instruções de recuperação enviadas para seu e-mail.' };
            }
            return { success: false, message: 'Recuperação de senha disponível apenas online.' };
        } catch (error) {
            return { success: false, message: this._getErrorMessage(error.code) || 'Erro ao recuperar senha.' };
        }
    },
    
    _getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
            'auth/invalid-email': 'E-mail inválido.',
            'auth/operation-not-allowed': 'Operação não permitida.',
            'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
            'auth/user-disabled': 'Esta conta foi desativada.',
            'auth/user-not-found': 'Usuário não encontrado.',
            'auth/wrong-password': 'Senha incorreta.',
            'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
            'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
            'auth/invalid-credential': 'Credenciais inválidas.'
        };
        return messages[code] || 'Ocorreu um erro. Tente novamente.'
    }
};

// ============================================
// EMPRESA MANAGER
// ============================================

const EmpresaManager = {
    _empresaAtual: null,
    _empresas: {},
    _initialized: false,
    
    _getSessionKey() {
        return 'dedetiza_sessoes';
    },
    
    _carregarSessoes() {
        try {
            const data = localStorage.getItem(this._getSessionKey());
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },
    
    _salvarSessoes(sessoes) {
        try {
            localStorage.setItem(this._getSessionKey(), JSON.stringify(sessoes));
        } catch (e) {}
    },
    
    getSessao(empresaId, usuarioId) {
        const sessoes = this._carregarSessoes();
        const key = empresaId + '_' + usuarioId;
        return sessoes[key] || null;
    },
    
    salvarSessao(empresaId, userData) {
        const sessoes = this._carregarSessoes();
        const key = empresaId + '_' + userData.uid;
        sessoes[key] = {
            ...userData,
            empresa: empresaId,
            ultimoAcesso: new Date().toISOString()
        };
        this._salvarSessoes(sessoes);
        this._empresaAtual = empresaId;
        localStorage.setItem('dedetiza_session_atual', JSON.stringify({
            uid: userData.uid,
            empresa: empresaId,
            key: key,
            nome: userData.nome || userData.usuario || userData.email,
            usuario: userData.usuario || userData.nome || userData.email
        }));
        localStorage.setItem('dedetiza_session', JSON.stringify({
            uid: userData.uid,
            email: userData.email,
            nome: userData.nome || userData.usuario || userData.email,
            usuario: userData.usuario || userData.nome || userData.email,
            empresa: empresaId
        }));
    },
    
    removerSessao(empresaId, usuarioId) {
        const sessoes = this._carregarSessoes();
        const key = empresaId + '_' + usuarioId;
        delete sessoes[key];
        this._salvarSessoes(sessoes);
        
        const atual = localStorage.getItem('dedetiza_session_atual');
        if (atual) {
            try {
                const data = JSON.parse(atual);
                if (data.uid === usuarioId && data.empresa === empresaId) {
                    localStorage.removeItem('dedetiza_session_atual');
                }
            } catch (e) {}
        }
    },
    
    getEmpresaAtual() {
        if (this._empresaAtual) {
            return this._empresaAtual;
        }
        
        try {
            const ultima = localStorage.getItem('dedetiza_ultima_empresa');
            if (ultima) {
                this._empresaAtual = ultima;
                return ultima;
            }
        } catch (e) {}
        
        const empresa = this._obterEmpresaExistente();
        if (empresa) {
            this._empresaAtual = empresa.id;
            return empresa.id;
        }
        
        const novaEmpresa = this._criarEmpresaUnica();
        this._empresaAtual = novaEmpresa.id;
        return novaEmpresa.id;
    },
    
    _obterEmpresaExistente() {
        this._carregarEmpresas();
        const empresas = Object.values(this._empresas);
        
        if (empresas.length > 0) {
            return empresas[0];
        }
        
        return null;
    },
    
    async getEmpresaAtualAsync() {
        const localEmpresa = this._obterEmpresaExistente();
        if (localEmpresa) {
            this._empresaAtual = localEmpresa.id;
            return localEmpresa.id;
        }
        
        try {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                const snapshot = await db.collection('usuarios').limit(5).get();
                if (!snapshot.empty) {
                    let empresaId = null;
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.empresaId) {
                            empresaId = data.empresaId;
                        }
                    });
                    if (empresaId) {
                        const empresa = this.getEmpresa(empresaId);
                        if (empresa) {
                            this._empresaAtual = empresaId;
                            return empresaId;
                        }
                    }
                }
            }
        } catch (e) {}
        
        const novaEmpresa = this._criarEmpresaUnica();
        this._empresaAtual = novaEmpresa.id;
        return novaEmpresa.id;
    },
    
    _criarEmpresaUnica() {
        const id = 'empresa_unica';
        this._empresas[id] = {
            id: id,
            nome: 'Dedetize+ - Sistema de Gestão',
            dominio: id,
            criadoEm: new Date().toISOString(),
            ativo: true,
            plano: 'basico',
            admins: [],
            config: {
                empresa: {
                    nome: 'Dedetize+ - Sistema de Gestão',
                    cnpj: '',
                    telefone: '',
                    endereco: '',
                    email: '',
                    logo: null
                },
                relatorio: {
                    titulo: 'Relatório Técnico',
                    subtitulo: 'Controle de Pragas',
                    cor: '#0b2a3b',
                    rodape: 'Este relatório é de propriedade da empresa.',
                    garantia: 'Garantia do serviço: 90 dias a partir da data do primeiro serviço\nOBS: Reentrada no local só será permitida após 06 horas da aplicação líquida, mediante o ambiente arejado, e todo objeto encontrado no chão que não puder ser descartado deverá ser higienizado antes do uso.'
                }
            }
        };
        this._salvarEmpresas();
        return this._empresas[id];
    },
    
    getUsuarioAtual() {
        try {
            const atual = localStorage.getItem('dedetiza_session_atual');
            if (atual) {
                const data = JSON.parse(atual);
                return data.uid;
            }
        } catch (e) {}
        return null;
    },
    
    getUsuarioNome() {
        try {
            const atual = localStorage.getItem('dedetiza_session_atual');
            if (atual) {
                const data = JSON.parse(atual);
                return data.nome || data.usuario || data.email || 'Admin';
            }
        } catch (e) {}
        
        try {
            const session = localStorage.getItem('dedetiza_session');
            if (session) {
                const data = JSON.parse(session);
                return data.nome || data.usuario || data.email || 'Admin';
            }
        } catch (e) {}
        
        return 'Admin';
    },
    
    setEmpresaAtual(empresaId) {
        this._empresaAtual = empresaId;
        try {
            localStorage.setItem('dedetiza_ultima_empresa', empresaId);
        } catch (e) {}
    },
    
    getEmpresa(empresaId) {
        this._carregarEmpresas();
        return this._empresas[empresaId] || null;
    },
    
    _carregarEmpresas() {
        try {
            const data = localStorage.getItem('dedetiza_empresas');
            if (data) {
                this._empresas = JSON.parse(data);
            }
        } catch (e) {
            this._empresas = {};
        }
        return this._empresas;
    },
    
    _salvarEmpresas() {
        try {
            localStorage.setItem('dedetiza_empresas', JSON.stringify(this._empresas));
        } catch (e) {}
    },
    
    criarEmpresa(nome, dominio = null) {
        const id = dominio || 'empresa_unica';
        this._empresas[id] = {
            id: id,
            nome: nome || 'Dedetize+ - Sistema de Gestão',
            dominio: id,
            criadoEm: new Date().toISOString(),
            ativo: true,
            plano: 'basico',
            admins: [],
            config: {
                empresa: {
                    nome: nome || 'Dedetize+ - Sistema de Gestão',
                    cnpj: '',
                    telefone: '',
                    endereco: '',
                    email: '',
                    logo: null
                },
                relatorio: {
                    titulo: 'Relatório Técnico',
                    subtitulo: 'Controle de Pragas',
                    cor: '#0b2a3b',
                    rodape: 'Este relatório é de propriedade da empresa.',
                    garantia: 'Garantia do serviço: 90 dias a partir da data do primeiro serviço\nOBS: Reentrada no local só será permitida após 06 horas da aplicação líquida, mediante o ambiente arejado, e todo objeto encontrado no chão que não puder ser descartado deverá ser higienizado antes do uso.'
                }
            }
        };
        this._salvarEmpresas();
        return this._empresas[id];
    },
    
    listarEmpresas() {
        this._carregarEmpresas();
        return Object.values(this._empresas).filter(e => e.ativo !== false);
    },
    
    adicionarAdmin(empresaId, usuarioId, email, nome) {
        this._carregarEmpresas();
        
        if (!this._empresas[empresaId]) {
            this._empresas[empresaId] = {
                id: empresaId,
                nome: 'Dedetize+ - Sistema de Gestão',
                dominio: empresaId,
                criadoEm: new Date().toISOString(),
                ativo: true,
                plano: 'basico',
                admins: [],
                config: {
                    empresa: {
                        nome: 'Dedetize+ - Sistema de Gestão',
                        cnpj: '',
                        telefone: '',
                        endereco: '',
                        email: '',
                        logo: null
                    },
                    relatorio: {
                        titulo: 'Relatório Técnico',
                        subtitulo: 'Controle de Pragas',
                        cor: '#0b2a3b',
                        rodape: 'Este relatório é de propriedade da empresa.',
                        garantia: 'Garantia do serviço: 90 dias a partir da data do primeiro serviço\nOBS: Reentrada no local só será permitida após 06 horas da aplicação líquida, mediante o ambiente arejado, e todo objeto encontrado no chão que não puder ser descartado deverá ser higienizado antes do uso.'
                    }
                }
            };
            this._salvarEmpresas();
        }
        
        const empresa = this._empresas[empresaId];
        const exists = empresa.admins.some(a => a.usuarioId === usuarioId);
        if (!exists) {
            empresa.admins.push({
                usuarioId: usuarioId,
                email: email,
                nome: nome,
                adicionadoEm: new Date().toISOString()
            });
            this._salvarEmpresas();
            return true;
        }
        return false;
    },
    
    isAdmin(empresaId, usuarioId) {
        this._carregarEmpresas();
        const empresa = this._empresas[empresaId];
        if (!empresa) return false;
        return empresa.admins.some(a => a.usuarioId === usuarioId);
    },
    
    gerarLinkAcesso(empresaId) {
        try {
            return window.location.origin + window.location.pathname + '?empresa=' + empresaId;
        } catch (e) {
            return '?empresa=' + empresaId;
        }
    },
    
    getStorageKey(collection) {
        const empresa = this.getEmpresaAtual();
        return 'dedetiza_' + empresa + '_' + collection;
    },
    
    getEmpresasDoUsuario(usuarioId) {
        this._carregarEmpresas();
        const result = [];
        Object.values(this._empresas).forEach(empresa => {
            if (empresa.admins.some(a => a.usuarioId === usuarioId)) {
                result.push(empresa);
            }
        });
        return result;
    },
    
    getUsuariosLogados(empresaId) {
        const sessoes = this._carregarSessoes();
        const result = [];
        Object.keys(sessoes).forEach(key => {
            if (key.startsWith(empresaId + '_')) {
                const sessao = sessoes[key];
                if (sessao && sessao.uid) {
                    result.push({
                        uid: sessao.uid,
                        nome: sessao.nome || sessao.usuario || sessao.email,
                        email: sessao.email,
                        ultimoAcesso: sessao.ultimoAcesso
                    });
                }
            }
        });
        return result;
    }
};

// ============================================
// FIRESTORE SERVICE - CORRIGIDO
// ============================================

const FirestoreService = {
    collections: [
        'clientes', 'servicos', 'ordens', 'agenda', 'equipe',
        'pontosIscas', 'relatorios', 'modelos', 'estoque',
        'movimentacoes', 'orcamentos', 'configuracoes', 'certificados'
    ],
    
    _unsubscribers: {},
    _currentEmpresa: null,
    _syncInProgress: false,
    _isInitialized: false,
    _lastSyncTime: {},
    
    _getStorageKey(collection) {
        const empresa = EmpresaManager.getEmpresaAtual();
        return 'dedetiza_' + empresa + '_' + collection;
    },
    
    _getLocalData(collection) {
        try {
            const key = this._getStorageKey(collection);
            const data = localStorage.getItem(key);
            if (!data) return [];
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    },
    
    _setLocalData(collection, data) {
        try {
            const key = this._getStorageKey(collection);
            const safeData = Array.isArray(data) ? data : [];
            localStorage.setItem(key, JSON.stringify(safeData));
        } catch (e) {}
    },
    
    _clearLocalCache(collection) {
        try {
            const key = this._getStorageKey(collection) + '_cache';
            localStorage.removeItem(key);
        } catch (e) {}
    },
    
    _isFirestoreAvailable() {
        return typeof firebase !== 'undefined' && firebase.firestore && db;
    },
    
    _addEmpresaFilter(data) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        return { ...data, empresaId: empresaId };
    },
    
    _mergeData(localData, firestoreData) {
        const safeLocal = Array.isArray(localData) ? localData : [];
        const safeFirestore = Array.isArray(firestoreData) ? firestoreData : [];
        
        const merged = {};
        
        safeFirestore.forEach(item => {
            const id = String(item.id || item._docId || '');
            if (id) {
                merged[id] = { ...item, _source: 'firestore' };
            }
        });
        
        safeLocal.forEach(item => {
            const id = String(item.id || item._docId || '');
            if (id && !merged[id]) {
                merged[id] = { ...item, _source: 'local' };
            }
        });
        
        return Object.values(merged);
    },
    
    _deepMerge: function(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this._deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    },
    
    async getAll(collection, forceRefresh = false) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        
        if (this._isFirestoreAvailable()) {
            try {
                const snapshot = await db.collection(collection)
                    .where('empresaId', '==', empresaId)
                    .get();
                
                const items = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    items.push({ 
                        id: data.id || doc.id, 
                        _docId: doc.id,
                        ...data 
                    });
                });
                
                if (items.length > 0 || forceRefresh) {
                    const localData = this._getLocalData(collection);
                    const mergedData = this._mergeData(localData, items);
                    this._setLocalData(collection, mergedData);
                    this._clearLocalCache(collection);
                    return mergedData;
                }
            } catch (error) {}
        }
        
        const localData = this._getLocalData(collection);
        return localData;
    },
    
    async getById(collection, id) {
        const items = await this.getAll(collection);
        return items.find(item => String(item.id) === String(id)) || null;
    },
    
    async add(collection, data) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        const id = data.id || 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        const docData = {
            ...data,
            id: id,
            empresaId: empresaId,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };
        
        const items = this._getLocalData(collection);
        const existing = items.find(item => String(item.id) === String(id));
        if (existing) {
            return this.update(collection, id, data);
        }
        
        if (this._isFirestoreAvailable()) {
            try {
                const docRef = db.collection(collection).doc(id);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    return this.update(collection, id, data);
                }
            } catch (error) {}
        }
        
        items.push(docData);
        this._setLocalData(collection, items);
        this._clearLocalCache(collection);
        
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(id).set(docData);
            } catch (error) {
                setTimeout(async () => {
                    try {
                        await db.collection(collection).doc(id).set(docData);
                    } catch (retryError) {}
                }, 1000);
            }
        }
        
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'add', item: docData } 
        }));
        
        return docData;
    },
    
    async update(collection, id, data) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        const idStr = String(id);
        
        let docAtual = null;
        try {
            docAtual = await this.getById(collection, idStr);
        } catch (e) {}
        
        let docData = {};
        if (docAtual) {
            docData = { ...docAtual };
        }
        
        const mergedData = this._deepMerge(docData, data);
        mergedData.atualizadoEm = new Date().toISOString();
        
        const items = this._getLocalData(collection);
        const index = items.findIndex(item => String(item.id) === idStr);
        if (index !== -1) {
            items[index] = { ...items[index], ...mergedData };
            this._setLocalData(collection, items);
            this._clearLocalCache(collection);
        } else {
            const newItem = {
                ...mergedData,
                id: idStr,
                empresaId: empresaId,
                criadoEm: new Date().toISOString()
            };
            items.push(newItem);
            this._setLocalData(collection, items);
            this._clearLocalCache(collection);
        }
        
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(idStr).set(mergedData, { merge: true });
            } catch (error) {
                setTimeout(async () => {
                    try {
                        await db.collection(collection).doc(idStr).set(mergedData, { merge: true });
                    } catch (retryError) {}
                }, 1000);
            }
        }
        
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'update', item: items.find(item => String(item.id) === idStr) } 
        }));
        
        return items.find(item => String(item.id) === idStr) || null;
    },
    
    async delete(collection, id) {
        const idStr = String(id);
        
        const items = this._getLocalData(collection).filter(item => String(item.id) !== idStr);
        this._setLocalData(collection, items);
        this._clearLocalCache(collection);
        
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(idStr).delete();
            } catch (error) {
                setTimeout(async () => {
                    try {
                        await db.collection(collection).doc(idStr).delete();
                    } catch (retryError) {}
                }, 1000);
            }
        }
        
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'delete', id: idStr } 
        }));
        
        return items;
    },
    
    observeCollection: function(collection, onUpdate, onError) {
        if (!this._isFirestoreAvailable()) {
            return () => {};
        }

        const empresaId = EmpresaManager.getEmpresaAtual();
        const query = db.collection(collection)
            .where('empresaId', '==', empresaId);

        const unsubscribe = query.onSnapshot((snapshot) => {
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            const localData = this._getLocalData(collection);
            const mergedData = this._mergeData(localData, items);
            this._setLocalData(collection, mergedData);
            this._clearLocalCache(collection);

            if (typeof onUpdate === 'function') {
                onUpdate(mergedData);
            }
        }, (error) => {
            if (typeof onError === 'function') {
                onError(error);
            }
        });

        return unsubscribe;
    },

    iniciarObservadores: function(renderCallback) {
        this.pararObservadores();
        
        const empresaAtual = EmpresaManager.getEmpresaAtual();
        this._currentEmpresa = empresaAtual;
        this._unsubscribers = {};

        this.collections.forEach(collection => {
            if (this._unsubscribers[collection]) {
                return;
            }
            
            this._unsubscribers[collection] = this.observeCollection(collection, (items) => {
                if (typeof renderCallback === 'function') {
                    renderCallback();
                }
            });
        });

        this._isInitialized = true;
    },

    pararObservadores: function() {
        if (Object.keys(this._unsubscribers).length > 0) {
            Object.values(this._unsubscribers).forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (e) {}
                }
            });
            this._unsubscribers = {};
            this._currentEmpresa = null;
        }
        this._isInitialized = false;
    },
    
    async sincronizarDadosEmpresa(empresaId, force = false) {
        if (!this._isFirestoreAvailable()) {
            return 0;
        }
        
        const empresaAnterior = EmpresaManager.getEmpresaAtual();
        EmpresaManager.setEmpresaAtual(empresaId);
        
        let totalItens = 0;
        
        for (const collection of this.collections) {
            try {
                const snapshot = await db.collection(collection)
                    .where('empresaId', '==', empresaId)
                    .get();
                
                const items = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    items.push({ id: data.id || doc.id, ...data });
                });
                
                const localData = this._getLocalData(collection);
                
                if (items.length > 0) {
                    const mergedData = this._mergeData(localData, items);
                    this._setLocalData(collection, mergedData);
                    totalItens += mergedData.length;
                } else if (localData.length > 0 && force) {
                    for (const item of localData) {
                        try {
                            await db.collection(collection).doc(String(item.id)).set({
                                ...item,
                                empresaId: empresaId
                            });
                        } catch (syncError) {}
                    }
                    totalItens += localData.length;
                } else {
                    totalItens += localData.length;
                }
                this._clearLocalCache(collection);
            } catch (error) {
                const localData = this._getLocalData(collection);
                totalItens += localData.length;
            }
        }
        
        EmpresaManager.setEmpresaAtual(empresaAnterior);
        return totalItens;
    },
    
    async sincronizarColecao(collection) {
        if (!this._isFirestoreAvailable()) {
            return null;
        }
        
        const empresaId = EmpresaManager.getEmpresaAtual();
        try {
            const localData = this._getLocalData(collection);
            
            const snapshot = await db.collection(collection)
                .where('empresaId', '==', empresaId)
                .get();
            
            const items = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                items.push({ id: data.id || doc.id, ...data });
            });
            
            if (items.length > 0) {
                const mergedData = this._mergeData(localData, items);
                this._setLocalData(collection, mergedData);
                this._clearLocalCache(collection);
                return mergedData;
            } else if (localData.length > 0) {
                for (const item of localData) {
                    try {
                        await db.collection(collection).doc(String(item.id)).set({
                            ...item,
                            empresaId: empresaId
                        });
                    } catch (syncError) {}
                }
                return localData;
            } else {
                return localData;
            }
        } catch (error) {
            return this._getLocalData(collection);
        }
    },
    
    async inicializarDadosEmpresa(empresaId) {
        if (!this._isFirestoreAvailable()) {
            return;
        }
        
        const empresaAnterior = EmpresaManager.getEmpresaAtual();
        EmpresaManager.setEmpresaAtual(empresaId);
        
        try {
            const modelos = await this.getAll('modelos', true);
            if (modelos.length === 0) {
                const defaultModelos = [
                    {
                        id: 'modelo_desratizacao',
                        nome: 'Modelo Padrão - Desratização',
                        categoria: 'desratizacao',
                        campos: [
                            { label: 'Data da Inspeção', tipo: 'texto', valor: '' },
                            { label: 'Local da Inspeção', tipo: 'texto', valor: '' },
                            { label: 'Pontos de Monitoramento', tipo: 'texto', valor: '' },
                            { label: 'Atividade Identificada', tipo: 'texto', valor: '' },
                            { label: 'Ações Realizadas', tipo: 'texto', valor: '' }
                        ],
                        cor: '#e67e22'
                    },
                    {
                        id: 'modelo_desinsetizacao',
                        nome: 'Modelo Avançado - Desinsetização',
                        categoria: 'desinsetizacao',
                        campos: [
                            { label: 'Data da Aplicação', tipo: 'texto', valor: '' },
                            { label: 'Área Tratada', tipo: 'texto', valor: '' },
                            { label: 'Produto Utilizado', tipo: 'texto', valor: '' },
                            { label: 'Concentração', tipo: 'texto', valor: '' },
                            { label: 'Prazo de Reentrada', tipo: 'texto', valor: '' },
                            { label: 'Eficácia Observada', tipo: 'texto', valor: '' }
                        ],
                        cor: '#1d7a6b'
                    },
                    {
                        id: 'modelo_descupinizacao',
                        nome: 'Modelo Técnico - Descupinização',
                        categoria: 'descupinizacao',
                        campos: [
                            { label: 'Data da Vistoria', tipo: 'texto', valor: '' },
                            { label: 'Estrutura Inspecionada', tipo: 'texto', valor: '' },
                            { label: 'Nível de Infestação', tipo: 'texto', valor: '' },
                            { label: 'Tratamento Aplicado', tipo: 'texto', valor: '' },
                            { label: 'Garantia', tipo: 'texto', valor: '' }
                        ],
                        cor: '#8e44ad'
                    },
                    {
                        id: 'modelo_nao_conformidade',
                        nome: 'Modelo - Não Conformidade',
                        categoria: 'nao-conformidade',
                        campos: [
                            { label: 'Data da Ocorrência', tipo: 'texto', valor: '' },
                            { label: 'Local da Não Conformidade', tipo: 'texto', valor: '' },
                            { label: 'Descrição do Problema', tipo: 'texto', valor: '' },
                            { label: 'Causa Raiz', tipo: 'texto', valor: '' },
                            { label: 'Ação Corretiva', tipo: 'texto', valor: '' },
                            { label: 'Prazo para Correção', tipo: 'texto', valor: '' }
                        ],
                        cor: '#c0392b'
                    }
                ];
                
                for (const modelo of defaultModelos) {
                    await this.add('modelos', modelo);
                }
            }
            
            await this.getAll('certificados', true);
            
        } catch (error) {}
        
        EmpresaManager.setEmpresaAtual(empresaAnterior);
    },

    initializeDefaultData: function() {
        const empresaId = EmpresaManager.getEmpresaAtual();
        return this.inicializarDadosEmpresa(empresaId);
    }
};

// ============================================
// SERVIÇO DE PLANOS E LIMITES
// ============================================

const PlanService = {
    PLANOS: {
        'basico': {
            nome: 'Básico',
            limiteAdmins: 3,
            maxEmpresas: 1,
            precoMensal: 69.90,
            cor: '#3498db',
            descricao: 'Perfeito para pequenas operações.',
            features: [
                '✅ Até 3 usuários',
                '✅ OS e Clientes',
                '✅ Agenda inteligente',
                '✅ Mapas de Iscas',
                '✅ Estoque completo',
                '✅ Financeiro',
                '✅ Assinatura digital',
                '✅ Suporte técnico'
            ]
        },
        'profissional': {
            nome: 'Profissional',
            limiteAdmins: 10,
            maxEmpresas: 2,
            precoMensal: 149.90,
            cor: '#8e44ad',
            descricao: 'Ideal para empresas em crescimento.',
            features: [
                '✅ Até 10 usuários',
                '✅ OS e Clientes',
                '✅ Agenda inteligente',
                '✅ Mapas de Iscas',
                '✅ Estoque completo',
                '✅ Financeiro',
                '✅ Assinatura digital',
                '✅ Suporte técnico'
            ],
            isRecommended: true
        },
        'premium': {
            nome: 'Premium',
            limiteAdmins: 999,
            maxEmpresas: 5,
            precoMensal: 199.90,
            cor: '#e67e22',
            descricao: 'Para grandes operações e franquias.',
            features: [
                '✅ Usuários ilimitados',
                '✅ OS e Clientes',
                '✅ Agenda inteligente',
                '✅ Mapas de Iscas',
                '✅ Estoque completo',
                '✅ Financeiro',
                '✅ Assinatura digital',
                '✅ Suporte técnico'
            ],
            isPopular: true
        }
    },

    PLANO_PADRAO: 'basico',
    LIMITE_AVISO: 0.8,
    
    getPlanoEmpresa: function(empresaId) {
        const empresa = EmpresaManager.getEmpresa(empresaId);
        if (!empresa) return this.PLANOS[this.PLANO_PADRAO];
        const planoNome = empresa.plano || this.PLANO_PADRAO;
        return this.PLANOS[planoNome] || this.PLANOS[this.PLANO_PADRAO];
    },

    getPlanoNome: function(empresaId) {
        const empresa = EmpresaManager.getEmpresa(empresaId);
        return empresa.plano || this.PLANO_PADRAO;
    },

    setPlanoEmpresa: function(empresaId, planoNome) {
        if (!this.PLANOS[planoNome]) {
            return false;
        }
        const empresa = EmpresaManager.getEmpresa(empresaId);
        if (!empresa) return false;
        empresa.plano = planoNome;
        this._salvarEmpresa(empresaId, empresa);
        return true;
    },

    contarAdmins: function(empresaId) {
        const empresa = EmpresaManager.getEmpresa(empresaId);
        if (!empresa) return 0;
        return empresa.admins ? empresa.admins.length : 0;
    },

    podeAdicionarAdmin: function(empresaId) {
        const plano = this.getPlanoEmpresa(empresaId);
        const adminsAtuais = this.contarAdmins(empresaId);
        return adminsAtuais < plano.limiteAdmins;
    },

    getPorcentagemUso: function(empresaId) {
        const plano = this.getPlanoEmpresa(empresaId);
        const adminsAtuais = this.contarAdmins(empresaId);
        if (plano.limiteAdmins === 0) return 100;
        return (adminsAtuais / plano.limiteAdmins) * 100;
    },

    isProximoLimite: function(empresaId) {
        const porcentagem = this.getPorcentagemUso(empresaId);
        return porcentagem >= this.LIMITE_AVISO * 100;
    },

    isLimiteAtingido: function(empresaId) {
        return !this.podeAdicionarAdmin(empresaId);
    },

    _salvarEmpresa: function(empresaId, empresa) {
        try {
            const empresas = JSON.parse(localStorage.getItem('dedetiza_empresas') || '{}');
            empresas[empresaId] = empresa;
            localStorage.setItem('dedetiza_empresas', JSON.stringify(empresas));
            
            if (EmpresaManager._empresas) {
                EmpresaManager._empresas[empresaId] = empresa;
            }
            
            if (typeof FirestoreService !== 'undefined' && FirestoreService._isFirestoreAvailable()) {
                try {
                    db.collection('empresas').doc(empresaId).set(empresa, { merge: true });
                } catch (e) {}
            }
        } catch (e) {}
    },

    gerarOpcoesPlano: function(empresaId) {
        const planoAtual = this.getPlanoNome(empresaId);
        return Object.entries(this.PLANOS).map(([key, plano]) => {
            const selected = key === planoAtual ? 'selected' : '';
            const precoDisplay = typeof plano.precoMensal === 'number' ? 
                `R$ ${plano.precoMensal.toFixed(2)}/mês` : 
                plano.precoMensal;
            return `<option value="${key}" ${selected}>
                ${plano.nome} - ${plano.limiteAdmins} admins - ${precoDisplay}
            </option>`;
        }).join('');
    },

    getResumoPlano: function(empresaId) {
        const plano = this.getPlanoEmpresa(empresaId);
        const admins = this.contarAdmins(empresaId);
        const limite = plano.limiteAdmins;
        const porcentagem = this.getPorcentagemUso(empresaId);
        
        return {
            planoNome: plano.nome,
            adminsAtuais: admins,
            limiteAdmins: limite,
            porcentagemUso: Math.round(porcentagem),
            podeAdicionar: this.podeAdicionarAdmin(empresaId),
            estaProximo: this.isProximoLimite(empresaId),
            estaLimite: this.isLimiteAtingido(empresaId),
            precoMensal: plano.precoMensal,
            cor: plano.cor || '#1d7a6b',
            descricao: plano.descricao || '',
            features: plano.features,
            isRecommended: plano.isRecommended || false,
            isPopular: plano.isPopular || false
        };
    },

    getMensagemAlerta: function(empresaId) {
        const resumo = this.getResumoPlano(empresaId);
        
        if (resumo.estaLimite) {
            return {
                tipo: 'danger',
                titulo: '⚠️ Limite de Administradores Atingido!',
                mensagem: `Sua empresa atingiu o limite de ${resumo.limiteAdmins} administradores do plano ${resumo.planoNome}. Para adicionar mais administradores, faça upgrade para um plano superior.`,
                acao: 'Ver Planos'
            };
        } else if (resumo.estaProximo) {
            return {
                tipo: 'warning',
                titulo: '🔔 Limite de Administradores Próximo!',
                mensagem: `Você está utilizando ${resumo.porcentagemUso}% do limite de ${resumo.limiteAdmins} administradores do plano ${resumo.planoNome}. Restam ${resumo.limiteAdmins - resumo.adminsAtuais} vagas. Quando atingir o limite, será necessário fazer upgrade de plano.`,
                acao: 'Ver Planos'
            };
        }
        return null;
    },

    verificarCadastroAdmin: function(empresaId) {
        const resumo = this.getResumoPlano(empresaId);
        
        if (resumo.estaLimite) {
            return {
                permitido: false,
                mensagem: `❌ Limite de administradores atingido!\nPlano atual: ${resumo.planoNome} (${resumo.limiteAdmins} admins)\nFaça upgrade para um plano superior.`,
                tipo: 'erro',
                mostrarModal: true
            };
        }
        
        if (resumo.estaProximo) {
            return {
                permitido: true,
                mensagem: `ℹ️ Você está utilizando ${resumo.porcentagemUso}% do limite de administradores.\nRestam ${resumo.limiteAdmins - resumo.adminsAtuais} vagas.\nConsidere fazer upgrade de plano para continuar crescendo!`,
                tipo: 'aviso',
                mostrarModal: false
            };
        }
        
        return {
            permitido: true,
            mensagem: null,
            tipo: 'ok',
            mostrarModal: false
        };
    },

    gerarModalUpgrade: function(empresaId) {
        const resumo = this.getResumoPlano(empresaId);
        
        const planosHtml = Object.entries(this.PLANOS).map(([key, plano]) => {
            const isCurrent = key === resumo.planoNome;
            const isRecommended = plano.isRecommended || false;
            const isPopular = plano.isPopular || false;
            const precoDisplay = typeof plano.precoMensal === 'number' ? 
                `R$ ${plano.precoMensal.toFixed(2)} /mês` : 
                plano.precoMensal;
            
            const featuresList = plano.features.map(f => `<li style="list-style:none;padding:4px 0;font-size:0.85rem;color:#4d687a;">${f}</li>`).join('');
            
            let badgeHtml = '';
            if (isPopular) {
                badgeHtml = '<span style="display:inline-block;background:#e67e22;color:white;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;margin-bottom:8px;">Mais Popular</span>';
            }
            if (isRecommended && !isPopular) {
                badgeHtml = '<span style="display:inline-block;background:#8e44ad;color:white;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;margin-bottom:8px;">⭐ Recomendado</span>';
            }
            if (isCurrent) {
                badgeHtml = '<span style="display:inline-block;background:#1d7a6b;color:white;padding:2px 12px;border-radius:20px;font-size:0.7rem;font-weight:600;margin-bottom:8px;">✅ Atual</span>';
            }
            
            const borderClass = isPopular ? 'border: 2px solid #e67e22;' : 
                               isRecommended ? 'border: 2px solid #8e44ad;' : 
                               isCurrent ? 'border: 2px solid #1d7a6b;' : 
                               'border: 1px solid #e8eff5;';
            
            const bgClass = isPopular ? 'background: #fef9f0;' : 'background: white;';
            
            return `
                <div style="${bgClass} border-radius:16px;padding:24px;${borderClass} box-shadow:0 2px 12px rgba(0,0,0,0.06);flex:1;min-width:220px;max-width:300px;text-align:center;">
                    ${badgeHtml}
                    <h3 style="color:#0b2a3b;font-size:1.1rem;margin:0 0 4px 0;">${plano.nome}</h3>
                    <div style="font-size:1.8rem;font-weight:700;color:#0b2a3b;margin:4px 0;">${precoDisplay}</div>
                    <div style="font-size:0.8rem;color:#4d687a;margin-bottom:12px;">${plano.descricao || ''}</div>
                    <ul style="padding-left:0;margin:8px 0;text-align:left;">
                        ${featuresList}
                    </ul>
                    ${isCurrent ? 
                        `<button style="background:#e8eff5;color:#4d687a;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:default;width:100%;">Plano Atual</button>` :
                        `<button onclick="solicitarUpgrade('${key}')" style="background:#0b2a3b;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;transition:0.2s;">
                            ${isPopular ? '⭐ Escolher' : 'Contratar'}
                        </button>`
                    }
                </div>
            `;
        }).join('');

        return `
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-size:2.5rem;">🚀</div>
                <h2 style="color:#0b2a3b;margin:8px 0;">Escolha o Plano Ideal</h2>
                <p style="color:#4d687a;">
                    ${resumo.estaLimite ? 
                        `Sua empresa atingiu o limite de ${resumo.limiteAdmins} administradores do plano ${resumo.planoNome}.` :
                        `Você está utilizando ${resumo.porcentagemUso}% do limite de ${resumo.limiteAdmins} administradores.`
                    }
                </p>
                ${resumo.estaLimite ? 
                    `<p style="color:#b13e3a;font-weight:600;">🔴 Faça upgrade para continuar adicionando administradores.</p>` :
                    resumo.estaProximo ?
                    `<p style="color:#e67e22;font-weight:600;">🟡 Restam ${resumo.limiteAdmins - resumo.adminsAtuais} vagas.</p>` :
                    ''
                }
            </div>

            <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin:16px 0;">
                ${planosHtml}
            </div>

            <div style="background:#f0f7fc;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #1d7a6b;">
                <div style="font-weight:600;color:#0b2a3b;">📞 Entre em contato com nosso comercial</div>
                <div style="color:#4d687a;font-size:0.9rem;">
                    <div>📧 Email: <strong>softpowersolucoesdigitais@gmail.com</strong></div>
                    <div>📱 WhatsApp: <strong>(83) 98101-1900</strong></div>
                </div>
                <div style="margin-top:8px;font-size:0.85rem;color:#4d687a;">
                    Ou clique em um dos planos acima para solicitar a contratação.
                </div>
            </div>

            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
                <button onclick="fecharModal()" style="background:#e8eff5;color:#1f3a4b;border:none;padding:10px 24px;border-radius:40px;font-weight:600;cursor:pointer;">
                    ${resumo.estaLimite ? 'Fechar' : 'Continuar'}
                </button>
                <button onclick="abrirContatoComercial()" style="background:#1d7a6b;color:white;border:none;padding:10px 24px;border-radius:40px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
                    <i class="fas fa-envelope"></i> Falar com Comercial
                </button>
            </div>
        `;
    }
};

// ============================================
// FUNÇÕES DE UPGRADE (GLOBAIS)
// ============================================

if (typeof window !== 'undefined') {
    window.PlanService = PlanService;

    window.solicitarUpgrade = function(planoNome) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        const planos = PlanService.PLANOS;
        const plano = planos[planoNome];
        
        if (!plano) return;
        
        const mensagem = `Olá! Gostaria de solicitar a contratação do plano "${plano.nome}".
        
    Dados da empresa:
    - Empresa: ${EmpresaManager.getEmpresa(empresaId)?.nome || 'N/A'}
    - Plano atual: ${PlanService.getPlanoNome(empresaId)}
    - Administradores atuais: ${PlanService.contarAdmins(empresaId)}
    - Limite desejado: ${plano.limiteAdmins} administradores
    - Valor: ${typeof plano.precoMensal === 'number' ? 'R$ ' + plano.precoMensal.toFixed(2) + '/mês' : plano.precoMensal}
    
    Aguardo retorno para prosseguirmos com a contratação.
    Obrigado!`;
        
        if (typeof window.abrirModal === 'function') {
            window.abrirModal('Solicitar Contratação - ' + plano.nome, `
                <div style="text-align:center;padding:16px 0;">
                    <div style="font-size:3rem;">📋</div>
                    <h3 style="color:#0b2a3b;margin:8px 0;">Plano ${plano.nome}</h3>
                    <p style="color:#4d687a;font-size:0.9rem;">
                        ${plano.limiteAdmins} administradores • ${typeof plano.precoMensal === 'number' ? 'R$ ' + plano.precoMensal.toFixed(2) + '/mês' : plano.precoMensal}
                    </p>
                </div>

                <div style="background:#f8fbfd;border-radius:8px;padding:12px 16px;margin:12px 0;">
                    <div style="font-weight:600;color:#0b2a3b;margin-bottom:8px;">Sua solicitação:</div>
                    <div style="font-size:0.85rem;color:#4d687a;white-space:pre-wrap;background:white;padding:12px;border-radius:6px;border:1px solid #e8eff5;max-height:150px;overflow-y:auto;">
                        ${mensagem}
                    </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">
                    <button onclick="enviarEmailComercial()" style="background:#0b2a3b;color:white;border:none;padding:12px;border-radius:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">
                        <i class="fas fa-envelope"></i> Enviar por E-mail
                    </button>
                    <button onclick="abrirWhatsAppComercial()" style="background:#25D366;color:white;border:none;padding:12px;border-radius:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">
                        <i class="fab fa-whatsapp"></i> Enviar via WhatsApp
                    </button>
                    <button onclick="copiarMensagemComercial()" style="background:#e8eff5;color:#1f3a4b;border:none;padding:12px;border-radius:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">
                        <i class="fas fa-copy"></i> Copiar Mensagem
                    </button>
                </div>

                <div style="background:#f0f7fc;padding:12px;border-radius:8px;border-left:4px solid #1d7a6b;font-size:0.85rem;color:#4d687a;">
                    <strong>📌 Importante:</strong> Nossa equipe comercial entrará em contato em até 24 horas úteis para dar continuidade ao processo de contratação.
                </div>

                <div class="modal-footer" style="margin-top:16px;">
                    <button class="btn-secondary" onclick="fecharModal()">Fechar</button>
                </div>
            `);
        }
        
        window._upgradeMensagem = mensagem;
        window._upgradePlano = planoNome;
    };

    window.enviarEmailComercial = function() {
        const mensagem = window._upgradeMensagem || '';
        const assunto = 'Solicitação de Contratação de Plano - Dedetize+';
        const email = 'softpowersoluucoesdigitais@gmail.com';
        
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
        
        setTimeout(() => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal();
            }
        }, 500);
    };

    window.abrirWhatsAppComercial = function() {
        const mensagem = window._upgradeMensagem || '';
        const numero = '5583981011900';
        
        window.open(`https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensagem)}`, '_blank');
        
        setTimeout(() => {
            if (typeof window.fecharModal === 'function') {
                window.fecharModal();
            }
        }, 500);
    };

    window.copiarMensagemComercial = function() {
        const mensagem = window._upgradeMensagem || '';
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(mensagem).then(() => {
                alert('✅ Mensagem copiada para a área de transferência!');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = mensagem;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('✅ Mensagem copiada para a área de transferência!');
            });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = mensagem;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('✅ Mensagem copiada para a área de transferência!');
        }
    };

    window.abrirContatoComercial = function() {
        if (typeof window.fecharModal === 'function') {
            window.fecharModal();
        }
        window.solicitarUpgrade(PlanService.PLANOS['profissional'].nome);
    };

    const originalCadastrar = AuthService.cadastrar;
    AuthService.cadastrar = async function(email, senha, nome, usuario, empresaId = null) {
        const empresaFinal = empresaId || 'empresa_unica';
        
        const verificacao = PlanService.verificarCadastroAdmin(empresaFinal);
        
        if (!verificacao.permitido) {
            const modalHtml = PlanService.gerarModalUpgrade(empresaFinal);
            if (typeof window.abrirModal === 'function') {
                window.abrirModal('🔒 Limite de Administradores Atingido', modalHtml);
            }
            return { 
                success: false, 
                message: verificacao.mensagem,
                bloquear: true,
                mostrarModal: true
            };
        }
        
        if (verificacao.tipo === 'aviso' && verificacao.mensagem) {
            setTimeout(() => {
                alert(verificacao.mensagem);
            }, 100);
        }
        
        return originalCadastrar.call(this, email, senha, nome, usuario, empresaId);
    };
}

// ============================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            
            if (FirestoreService._isFirestoreAvailable()) {
                await FirestoreService.sincronizarDadosEmpresa(empresaId, true);
                
                if (!FirestoreService._isInitialized) {
                    FirestoreService.iniciarObservadores(() => {
                        if (typeof window.renderAll === 'function') {
                            window.renderAll();
                        }
                    });
                }
            }
        } catch (error) {}
    }, 1000);
});

// ============================================
// EXPORTAÇÃO
// ============================================

window.AuthService = AuthService;
window.FirestoreService = FirestoreService;
window.EmpresaManager = EmpresaManager;
window.PlanService = PlanService;