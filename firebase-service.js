// firebase-service.js - Serviços Firebase para o sistema
// CORRIGIDO - Sincronização com preservação de dados locais

// ============================================
// VERIFICA SE O FIREBASE FOI CARREGADO
// ============================================
if (typeof firebase === 'undefined') {
    console.warn('⚠️ Firebase não disponível, usando fallback localStorage');
}

// ============================================
// CONTROLE DE LOOP DE AUTENTICAÇÃO
// ============================================
const AuthGuard = {
    _redirecting: false,
    _lastRedirect: 0,
    _redirectTimeout: null,
    
    isRedirecting() {
        return this._redirecting;
    },
    
    startRedirect() {
        const now = Date.now();
        if (now - this._lastRedirect < 5000) {
            console.warn('⛔ Redirecionamento bloqueado - muito rápido');
            return false;
        }
        this._redirecting = true;
        this._lastRedirect = now;
        
        if (this._redirectTimeout) {
            clearTimeout(this._redirectTimeout);
        }
        
        this._redirectTimeout = setTimeout(() => {
            this._redirecting = false;
        }, 3000);
        
        return true;
    },
    
    reset() {
        this._redirecting = false;
        if (this._redirectTimeout) {
            clearTimeout(this._redirectTimeout);
            this._redirectTimeout = null;
        }
    }
};

// ============================================
// SISTEMA MULTI-EMPRESA COM SESSÕES SEPARADAS
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
        } catch (e) {
            console.warn('Erro ao salvar sessões:', e);
        }
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
            const urlParams = new URLSearchParams(window.location.search);
            const empresa = urlParams.get('empresa') || urlParams.get('e');
            if (empresa) {
                this._empresaAtual = empresa;
                return empresa;
            }
        } catch (e) {}
        
        try {
            const ultima = localStorage.getItem('dedetiza_ultima_empresa');
            if (ultima) {
                this._empresaAtual = ultima;
                return ultima;
            }
        } catch (e) {}
        
        return 'default';
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
        } catch (e) {
            console.warn('Erro ao salvar empresas:', e);
        }
    },
    
    criarEmpresa(nome, dominio = null) {
        this._carregarEmpresas();
        const id = 'emp_' + Date.now();
        this._empresas[id] = {
            id: id,
            nome: nome,
            dominio: dominio || id,
            criadoEm: new Date().toISOString(),
            ativo: true,
            admins: [],
            config: {
                empresa: {
                    nome: nome,
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
            return false;
        }
        const exists = this._empresas[empresaId].admins.some(a => a.usuarioId === usuarioId);
        if (!exists) {
            this._empresas[empresaId].admins.push({
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
// SERVIÇO DE AUTENTICAÇÃO - APENAS 1 ADMIN
// ============================================

const AuthService = {
    _loginInProgress: false,
    _lastLoginAttempt: 0,
    _adminCache: null,
    _adminCacheTime: 0,
    _adminCacheTTL: 60000,
    
    _adminExists() {
        try {
            const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
            const admins = users.filter(u => u.perfil === 'admin' || u.perfil === 'superadmin');
            return admins.length > 0;
        } catch (e) {
            return false;
        }
    },
    
    async _hasAdmin() {
        const now = Date.now();
        if (this._adminCache !== null && (now - this._adminCacheTime) < this._adminCacheTTL) {
            console.log('🔍 Admin existe (cache):', this._adminCache);
            return this._adminCache;
        }
        
        if (!firebase || !firebase.firestore) {
            const localHas = this._adminExists();
            this._adminCache = localHas;
            this._adminCacheTime = now;
            return localHas;
        }
        
        try {
            console.log('🔍 Verificando admin no Firestore...');
            const snapshot = await db.collection('usuarios')
                .where('perfil', 'in', ['admin', 'superadmin'])
                .limit(2)
                .get();
            
            const exists = !snapshot.empty;
            console.log('🔍 Admin no Firestore:', exists);
            
            this._adminCache = exists;
            this._adminCacheTime = now;
            
            if (exists) {
                try {
                    const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const existing = users.find(u => u.uid === data.id || u.uid === doc.id);
                        if (!existing) {
                            users.push({
                                uid: data.id || doc.id,
                                nome: data.nome || 'Admin',
                                usuario: data.usuario || data.nome || 'admin',
                                email: data.email,
                                perfil: data.perfil || 'admin',
                                empresaId: data.empresaId || 'default',
                                criadoEm: data.criadoEm || new Date().toISOString()
                            });
                        }
                    });
                    localStorage.setItem('dedetiza_users', JSON.stringify(users));
                } catch (e) {}
            }
            
            return exists;
        } catch (e) {
            console.warn('Erro ao verificar admin no Firestore:', e);
            const localHas = this._adminExists();
            this._adminCache = localHas;
            this._adminCacheTime = now;
            return localHas;
        }
    },
    
    resetAdminCache() {
        this._adminCache = null;
        this._adminCacheTime = 0;
        console.log('🔄 Cache de admin resetado');
    },
    
    async cadastrar(email, senha, nome, usuario, empresaId = null) {
        const hasAdmin = await this._hasAdmin();
        if (hasAdmin) {
            console.warn('⛔ Admin já existe');
            return { 
                success: false, 
                message: '❌ Já existe um administrador cadastrado no sistema.' 
            };
        }
        
        console.log('✅ Nenhum admin encontrado. Cadastro liberado!');
        
        try {
            if (!firebase || !firebase.auth) {
                return this._cadastrarFallback(email, senha, nome, usuario, empresaId);
            }

            try {
                const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
                if (methods && methods.length > 0) {
                    return { success: false, message: 'Este e-mail já está cadastrado.' };
                }
            } catch (verifyError) {
                console.warn('Erro ao verificar e-mail:', verifyError);
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
            const user = userCredential.user;
            
            let empresaFinal = empresaId;
            if (!empresaFinal) {
                const novaEmpresa = EmpresaManager.criarEmpresa(nome + ' - ' + email.split('@')[0]);
                empresaFinal = novaEmpresa.id;
                EmpresaManager.setEmpresaAtual(empresaFinal);
            }
            
            EmpresaManager.adicionarAdmin(empresaFinal, user.uid, email, nome);
            
            try {
                await db.collection('usuarios').doc(user.uid).set({
                    id: user.uid,
                    nome: nome,
                    usuario: usuario,
                    email: email,
                    empresaId: empresaFinal,
                    perfil: 'admin',
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimoAcesso: new Date().toISOString(),
                    ativo: true,
                    primeiroAdmin: true
                });
                console.log('✅ Admin salvo no Firestore');
            } catch (firestoreError) {
                console.warn('Erro ao salvar no Firestore:', firestoreError);
            }
            
            try {
                await user.updateProfile({ displayName: nome });
            } catch (profileError) {
                console.warn('Erro ao atualizar perfil:', profileError);
            }
            
            try {
                const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
                users.push({
                    uid: user.uid,
                    nome: nome,
                    usuario: usuario || nome,
                    email: email,
                    perfil: 'admin',
                    empresaId: empresaFinal,
                    criadoEm: new Date().toISOString(),
                    senha: senha
                });
                localStorage.setItem('dedetiza_users', JSON.stringify(users));
                this.resetAdminCache();
            } catch (e) {}
            
            const userData = { 
                uid: user.uid, 
                email: email, 
                nome: nome, 
                usuario: usuario || nome 
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            await FirestoreService.inicializarDadosEmpresa(empresaFinal);
            
            return { success: true, message: '✅ Cadastro realizado com sucesso! Você é o primeiro administrador.', user: user, empresaId: empresaFinal };
        } catch (error) {
            console.error('Erro no cadastro:', error);
            return this._cadastrarFallback(email, senha, nome, usuario, empresaId);
        }
    },

    _cadastrarFallback(email, senha, nome, usuario, empresaId) {
        if (this._adminExists()) {
            return { success: false, message: '❌ Já existe um administrador cadastrado no sistema.' };
        }
        
        try {
            const users = JSON.parse(localStorage.getItem('dedetiza_users') || '[]');
            if (users.some(u => u.email === email)) {
                return { success: false, message: 'Este e-mail já está cadastrado.' };
            }
            
            let empresaFinal = empresaId;
            if (!empresaFinal) {
                const novaEmpresa = EmpresaManager.criarEmpresa(nome + ' - ' + email.split('@')[0]);
                empresaFinal = novaEmpresa.id;
                EmpresaManager.setEmpresaAtual(empresaFinal);
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
                ativo: true,
                primeiroAdmin: true
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
            
            return { success: true, message: '✅ Cadastro realizado com sucesso! (modo offline)', user: newUser, empresaId: empresaFinal };
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
            
            let empresaFinal = empresaId || EmpresaManager.getEmpresaAtual();
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
            } catch (error) {
                console.warn('Erro ao buscar dados do usuário:', error);
            }
            
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
            
            if (!empresaFinal || empresaFinal === 'default') {
                const empresas = EmpresaManager.getEmpresasDoUsuario(user.uid);
                if (empresas.length > 0) {
                    empresaFinal = empresas[0].id;
                } else {
                    const novaEmpresa = EmpresaManager.criarEmpresa(nomeUsuario + ' - Empresa');
                    empresaFinal = novaEmpresa.id;
                    EmpresaManager.adicionarAdmin(empresaFinal, user.uid, email, nomeUsuario);
                }
            }
            
            const userData = {
                uid: user.uid,
                email: email,
                nome: nomeUsuario,
                usuario: usuarioLogin,
                perfil: perfilUsuario
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            if (Object.keys(FirestoreService._unsubscribers).length === 0) {
                FirestoreService.iniciarObservadores(() => {
                    console.log('🔄 Dados atualizados em tempo real via observador');
                    if (typeof window.renderAll === 'function') {
                        window.renderAll();
                    }
                });
            }
            
            await FirestoreService.sincronizarDadosEmpresa(empresaFinal);
            
            this._loginInProgress = false;
            return { success: true, message: 'Login realizado com sucesso!', user: user, empresaId: empresaFinal, perfil: perfilUsuario };
        } catch (error) {
            console.error('Erro no login:', error);
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
            
            const empresaFinal = empresaId || user.empresaId || EmpresaManager.getEmpresaAtual() || 'default';
            
            const userData = { 
                uid: user.uid, 
                email: user.email, 
                nome: user.nome, 
                usuario: user.usuario || user.nome,
                perfil: user.perfil || 'admin'
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            return { success: true, message: 'Login realizado com sucesso! (modo offline)', user: user, empresaId: empresaFinal };
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
            
            const sessoes = EmpresaManager._carregarSessoes();
            if (Object.keys(sessoes).length === 0) {
                localStorage.removeItem('dedetiza_ultima_empresa');
                if (firebase && firebase.auth) {
                    await auth.signOut();
                }
                window.location.href = 'login.html';
            } else {
                if (firebase && firebase.auth) {
                    await auth.signOut();
                }
                window.location.href = 'login.html';
            }
            
            return { success: true, message: 'Logout realizado!' };
        } catch (error) {
            console.error('Erro no logout:', error);
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
            } catch (error) {
                console.warn('Erro ao buscar dados do usuário:', error);
            }
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
            console.error('Erro na recuperação:', error);
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
        return messages[code] || 'Ocorreu um erro. Tente novamente.';
    }
};

// ============================================
// SERVIÇO DE BANCO DE DADOS - CORRIGIDO
// ============================================

const FirestoreService = {
    collections: {
        clientes: 'clientes',
        servicos: 'servicos',
        ordens: 'ordens',
        agenda: 'agenda',
        equipe: 'equipe',
        pontosIscas: 'pontosIscas',
        relatorios: 'relatorios',
        modelos: 'modelos',
        estoque: 'estoque',
        movimentacoes: 'movimentacoes',
        orcamentos: 'orcamentos',
        config: 'configuracoes'
    },
    
    _unsubscribers: {},
    _currentEmpresa: null,
    _syncInProgress: false,
    _isInitialSync: true,
    
    _getStorageKey(collection) {
        const empresa = EmpresaManager.getEmpresaAtual();
        return 'dedetiza_' + empresa + '_' + collection;
    },
    
    _getLocalData(collection) {
        try {
            const key = this._getStorageKey(collection);
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },
    
    _setLocalData(collection, data) {
        try {
            const key = this._getStorageKey(collection);
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Erro ao salvar local:', e);
        }
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
    
    observeCollection: function(collection, onUpdate, onError) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para observação.');
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
            
            // Só atualiza se os dados do Firestore forem diferentes dos locais
            // E NUNCA sobrescreve dados locais com array vazio
            if (items.length > 0 && JSON.stringify(localData) !== JSON.stringify(items)) {
                // Mescla dados preservando os locais
                const mergedData = this._mergeData(localData, items);
                this._setLocalData(collection, mergedData);
                this._clearLocalCache(collection);

                if (typeof onUpdate === 'function') {
                    onUpdate(mergedData);
                }

                console.log(`🔄 Coleção '${collection}' atualizada em tempo real: ${mergedData.length} itens (${localData.length} local + ${items.length} firestore)`);
            } else if (items.length === 0 && localData.length > 0) {
                // Firestore vazio, mantém dados locais
                console.log(`ℹ️ Firestore vazio para '${collection}', mantendo ${localData.length} itens locais`);
            }
        }, (error) => {
            console.error(`❌ Erro no observador de '${collection}':`, error);
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
        
        const collections = ['clientes', 'servicos', 'ordens', 'agenda', 'equipe',
                            'pontosIscas', 'relatorios', 'modelos', 'estoque',
                            'movimentacoes', 'orcamentos', 'configuracoes'];

        collections.forEach(collection => {
            this._unsubscribers[collection] = this.observeCollection(collection, (items) => {
                if (typeof renderCallback === 'function') {
                    renderCallback();
                }
            });
        });

        console.log(`✅ Observadores em tempo real iniciados para a empresa: ${empresaAtual}`);
    },

    pararObservadores: function() {
        if (Object.keys(this._unsubscribers).length > 0) {
            Object.values(this._unsubscribers).forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            this._unsubscribers = {};
            this._currentEmpresa = null;
            console.log('⏹️ Observadores em tempo real parados.');
        }
    },

    _handleReconnect: function() {
        console.log('🔄 Reconectando ao Firestore...');
        this.iniciarObservadores(() => {
            if (typeof window.renderAll === 'function') {
                window.renderAll();
            }
        });
    },

    // ===== MERGE DATA - PRESERVA DADOS LOCAIS =====
    _mergeData: function(localData, firestoreData) {
        const merged = {};
        
        // Primeiro adiciona TODOS os dados locais (prioridade máxima)
        localData.forEach(item => {
            const id = String(item.id);
            if (!merged[id]) {
                merged[id] = { ...item, _source: 'local' };
            }
        });
        
        // Depois sobrescreve apenas os itens que existem no Firestore
        firestoreData.forEach(item => {
            const id = String(item.id);
            merged[id] = { ...item, _source: 'firestore' };
        });
        
        return Object.values(merged);
    },

    // ===== getAll CORRIGIDO - PRIORIZA DADOS LOCAIS =====
    async getAll(collection, forceRefresh = false) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        
        // 1. SEMPRE pega do localStorage primeiro (fonte da verdade local)
        const localData = this._getLocalData(collection);
        
        // 2. Se não forçar refresh, retorna os dados locais imediatamente
        if (!forceRefresh && localData && localData.length > 0) {
            return localData;
        }
        
        // 3. Se o Firestore não estiver disponível, retorna o que temos
        if (!this._isFirestoreAvailable()) {
            return localData;
        }
        
        // 4. Tenta buscar do Firestore (apenas se forçar ou não tiver dados locais)
        try {
            if (this._syncInProgress && !forceRefresh) {
                console.log(`⏳ Sincronização de ${collection} em andamento, retornando dados locais`);
                return localData;
            }
            
            this._syncInProgress = true;
            
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
            
            // 5. Mescla dados: PRESERVA os dados locais
            if (items.length > 0) {
                const mergedData = this._mergeData(localData, items);
                this._setLocalData(collection, mergedData);
                this._clearLocalCache(collection);
                console.log(`✅ Sincronizado ${collection}: ${mergedData.length} itens (${localData.length} local + ${items.length} firestore)`);
                this._syncInProgress = false;
                return mergedData;
            } else {
                // Firestore vazio, mantém dados locais
                console.log(`ℹ️ Firestore vazio para ${collection}, mantendo ${localData.length} itens locais`);
                this._syncInProgress = false;
                return localData;
            }
            
        } catch (error) {
            this._syncInProgress = false;
            console.warn(`Erro ao buscar ${collection} do Firestore:`, error);
            return localData;
        }
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
        
        // Salva localmente primeiro (otimista)
        const items = this._getLocalData(collection);
        const existing = items.find(item => String(item.id) === String(id));
        if (existing) {
            console.warn(`⚠️ Item ${id} já existe em ${collection}, atualizando...`);
            return this.update(collection, id, data);
        }
        
        items.push(docData);
        this._setLocalData(collection, items);
        this._clearLocalCache(collection);
        
        // Sincroniza com Firestore em background (não bloqueia)
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(id).set(docData);
                console.log(`✅ Adicionado ${collection}/${id} no Firestore`);
            } catch (error) {
                console.warn(`Erro ao adicionar ${collection} no Firestore:`, error);
            }
        }
        
        return docData;
    },
    
    async update(collection, id, data) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        const idStr = String(id);
        
        const docData = {
            ...data,
            atualizadoEm: new Date().toISOString()
        };
        
        // Atualiza localmente
        const items = this._getLocalData(collection);
        const index = items.findIndex(item => String(item.id) === idStr);
        if (index !== -1) {
            items[index] = { ...items[index], ...docData };
            this._setLocalData(collection, items);
            this._clearLocalCache(collection);
        } else {
            const newItem = {
                ...docData,
                id: idStr,
                empresaId: empresaId,
                criadoEm: new Date().toISOString()
            };
            items.push(newItem);
            this._setLocalData(collection, items);
            this._clearLocalCache(collection);
        }
        
        // Sincroniza com Firestore em background
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(idStr).update(docData);
                console.log(`✅ Atualizado ${collection}/${idStr} no Firestore`);
            } catch (error) {
                try {
                    const fullData = items.find(item => String(item.id) === idStr);
                    if (fullData) {
                        await db.collection(collection).doc(idStr).set(fullData);
                        console.log(`✅ Criado ${collection}/${idStr} no Firestore (update fallback)`);
                    }
                } catch (setError) {
                    console.warn(`Erro ao atualizar ${collection} no Firestore:`, setError);
                }
            }
        }
        
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
                console.log(`✅ Deletado ${collection}/${idStr} no Firestore`);
            } catch (error) {
                console.warn(`Erro ao deletar ${collection} no Firestore:`, error);
            }
        }
        
        return items;
    },
    
    async sincronizarDadosEmpresa(empresaId) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para sincronização');
            return 0;
        }
        
        const empresaAnterior = EmpresaManager.getEmpresaAtual();
        EmpresaManager.setEmpresaAtual(empresaId);
        
        const collections = ['clientes', 'servicos', 'ordens', 'agenda', 'equipe', 
                            'pontosIscas', 'relatorios', 'modelos', 'estoque', 
                            'movimentacoes', 'orcamentos', 'configuracoes'];
        let totalItens = 0;
        
        for (const collection of collections) {
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
                    totalItens += mergedData.length;
                    console.log(`✅ Sincronizado ${collection}: ${mergedData.length} itens (${localData.length} local + ${items.length} firestore)`);
                } else {
                    console.log(`ℹ️ Firestore vazio para ${collection}, mantendo ${localData.length} itens locais`);
                    totalItens += localData.length;
                }
                this._clearLocalCache(collection);
            } catch (error) {
                console.warn(`Erro ao sincronizar ${collection}:`, error);
                const localData = this._getLocalData(collection);
                totalItens += localData.length;
            }
        }
        
        EmpresaManager.setEmpresaAtual(empresaAnterior);
        console.log(`✅ Sincronização completa: ${totalItens} itens sincronizados`);
        return totalItens;
    },
    
    async inicializarDadosEmpresa(empresaId) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para inicialização');
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
                console.log('✅ Modelos padrão criados!');
            }
        } catch (error) {
            console.warn('Erro ao inicializar dados padrão:', error);
        }
        
        EmpresaManager.setEmpresaAtual(empresaAnterior);
    },
    
    async sincronizarColecao(collection) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para sincronização');
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
                console.log(`✅ Sincronizado ${collection}: ${mergedData.length} itens`);
                return mergedData;
            } else {
                console.log(`ℹ️ Firestore vazio para ${collection}, mantendo ${localData.length} itens locais`);
                return localData;
            }
        } catch (error) {
            console.warn(`Erro ao sincronizar ${collection}:`, error);
            return this._getLocalData(collection);
        }
    }
};

// Inicializa listener de reconexão
if (typeof firebase !== 'undefined' && firebase.firestore) {
    firebase.firestore().enableNetwork().then(() => {
        console.log('✅ Firestore network habilitada');
    }).catch(() => {
        console.warn('⚠️ Firestore network já habilitada');
    });
}

// ============================================
// EXPORTAÇÃO
// ============================================

window.AuthService = AuthService;
window.FirestoreService = FirestoreService;
window.EmpresaManager = EmpresaManager;
window.AuthGuard = AuthGuard;

console.log('✅ Firebase Services Multi-Empresa carregados!');
console.log('📌 Empresa Atual:', EmpresaManager.getEmpresaAtual());
console.log('📌 Modo: Apenas 1 Admin permitido');
console.log('📌 Dados locais SEMPRE preservados durante sincronização');