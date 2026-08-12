// firebase-service.js - SINCRONIZAÇÃO TOTALMENTE AUTOMÁTICA E MULTI-DISPOSITIVO

// ============================================
// SERVIÇO DE AUTENTICAÇÃO
// ============================================

const AuthService = {
    _loginInProgress: false,
    _lastLoginAttempt: 0,
    
    async cadastrar(email, senha, nome, usuario, empresaId = null) {
        console.log('📝 Cadastrando novo admin:', email);
        
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
                console.log('✅ Admin salvo no Firestore com empresaId:', empresaFinal);
            } catch (firestoreError) {
                console.warn('Erro ao salvar no Firestore:', firestoreError);
            }
            
            try {
                await user.updateProfile({ displayName: nome });
            } catch (profileError) {
                console.warn('Erro ao atualizar perfil:', profileError);
            }
            
            const userData = { 
                uid: user.uid, 
                email: email, 
                nome: nome, 
                usuario: usuario || nome 
            };
            EmpresaManager.salvarSessao(empresaFinal, userData);
            
            // INICIALIZA OS DADOS DA EMPRESA NO FIRESTORE
            await FirestoreService.inicializarDadosEmpresa(empresaFinal);
            
            // 🔥 FORÇA SINCRONIZAÇÃO COMPLETA
            await FirestoreService.sincronizarDadosEmpresa(empresaFinal);
            
            // INICIA OBSERVADORES EM TEMPO REAL
            FirestoreService.iniciarObservadores(() => {
                console.log('🔄 Dados atualizados em tempo real');
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
            console.error('Erro no cadastro:', error);
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
            } catch (error) {
                console.warn('Erro ao buscar empresa do usuário:', error);
            }
            
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
            
            // 🔥 FORÇA LIMPEZA DE CACHE LOCAL
            if (typeof DB !== 'undefined') {
                DB._clearAllCaches();
            }
            
            // 🔥 SINCRONIZA AUTOMATICAMENTE AO LOGAR (FORÇA BUSCA DO FIRESTORE)
            await FirestoreService.sincronizarDadosEmpresa(empresaFinal, true);
            
            // 🔥 INICIA OBSERVADORES EM TEMPO REAL
            FirestoreService.iniciarObservadores(() => {
                console.log('🔄 Dados atualizados em tempo real');
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
        } catch (e) {
            console.warn('Erro ao buscar empresa do Firestore:', e);
        }
        
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
        console.log('✅ Empresa única criada:', id);
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
        } catch (e) {
            console.warn('Erro ao salvar empresas:', e);
        }
    },
    
    criarEmpresa(nome, dominio = null) {
        const id = dominio || 'empresa_unica';
        this._empresas[id] = {
            id: id,
            nome: nome || 'Dedetize+ - Sistema de Gestão',
            dominio: id,
            criadoEm: new Date().toISOString(),
            ativo: true,
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
        console.log('✅ Empresa criada:', id);
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
            console.log('✅ Admin adicionado à empresa:', empresaId, '-', nome);
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
// FIRESTORE SERVICE - CORRIGIDO COM PRIORIDADE FIRESTORE
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
            console.warn('Erro ao buscar dados locais de ' + collection + ':', e);
            return [];
        }
    },
    
    _setLocalData(collection, data) {
        try {
            const key = this._getStorageKey(collection);
            const safeData = Array.isArray(data) ? data : [];
            localStorage.setItem(key, JSON.stringify(safeData));
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
    
    _mergeData(localData, firestoreData) {
        const safeLocal = Array.isArray(localData) ? localData : [];
        const safeFirestore = Array.isArray(firestoreData) ? firestoreData : [];
        
        const merged = {};
        
        // 🔥 PRIORIDADE: Dados do Firestore sobrescrevem dados locais
        safeFirestore.forEach(item => {
            const id = String(item.id || item._docId || '');
            if (id) {
                merged[id] = { ...item, _source: 'firestore' };
            }
        });
        
        // Adiciona dados locais que não existem no Firestore
        safeLocal.forEach(item => {
            const id = String(item.id || item._docId || '');
            if (id && !merged[id]) {
                merged[id] = { ...item, _source: 'local' };
            }
        });
        
        return Object.values(merged);
    },
    
    // 🔥 CORREÇÃO PRINCIPAL: getAll agora PRIORIZA FIRESTORE
    async getAll(collection, forceRefresh = false) {
        const empresaId = EmpresaManager.getEmpresaAtual();
        
        // 🔥 SEMPRE TENTA BUSCAR DO FIRESTORE PRIMEIRO
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
                
                // Se encontrou dados no Firestore, mescla com os locais
                if (items.length > 0 || forceRefresh) {
                    const localData = this._getLocalData(collection);
                    const mergedData = this._mergeData(localData, items);
                    this._setLocalData(collection, mergedData);
                    this._clearLocalCache(collection);
                    console.log(`✅ ${collection}: ${mergedData.length} itens carregados do Firestore`);
                    return mergedData;
                }
            } catch (error) {
                console.warn(`Erro ao buscar ${collection} do Firestore:`, error);
            }
        }
        
        // FALLBACK: dados locais
        const localData = this._getLocalData(collection);
        console.log(`📁 ${collection}: ${localData.length} itens carregados localmente (fallback)`);
        return localData;
    },
    
    async getById(collection, id) {
        const items = await this.getAll(collection);
        return items.find(item => String(item.id) === String(id)) || null;
    },
    
    // 🔥 CORREÇÃO: add agora sincroniza com Firestore e retorna o item salvo
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
        
        // Salva localmente
        const items = this._getLocalData(collection);
        const existing = items.find(item => String(item.id) === String(id));
        if (existing) {
            console.warn(`⚠️ Item ${id} já existe em ${collection}, atualizando...`);
            return this.update(collection, id, data);
        }
        
        items.push(docData);
        this._setLocalData(collection, items);
        this._clearLocalCache(collection);
        
        // 🔥 ENVIA PARA O FIRESTORE (SINCRONIZAÇÃO AUTOMÁTICA)
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(id).set(docData);
                console.log(`✅ Adicionado ${collection}/${id} no Firestore`);
            } catch (error) {
                console.warn(`Erro ao adicionar ${collection} no Firestore:`, error);
                // Tenta novamente após 1 segundo
                setTimeout(async () => {
                    try {
                        await db.collection(collection).doc(id).set(docData);
                        console.log(`✅ Adicionado ${collection}/${id} no Firestore (retry)`);
                    } catch (retryError) {
                        console.warn(`Erro ao adicionar ${collection} no Firestore (retry):`, retryError);
                    }
                }, 1000);
            }
        }
        
        // 🔥 DISPARA EVENTO PARA ATUALIZAR INTERFACE
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'add', item: docData } 
        }));
        
        return docData;
    },
    
    // 🔥 CORREÇÃO: update agora sincroniza com Firestore e retorna o item atualizado
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
        
        // 🔥 ATUALIZA NO FIRESTORE (SINCRONIZAÇÃO AUTOMÁTICA)
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(idStr).update(docData);
                console.log(`✅ Atualizado ${collection}/${idStr} no Firestore`);
            } catch (error) {
                // Se falhou, tenta criar o documento
                try {
                    const fullData = items.find(item => String(item.id) === idStr);
                    if (fullData) {
                        await db.collection(collection).doc(idStr).set(fullData);
                        console.log(`✅ Criado ${collection}/${idStr} no Firestore (update fallback)`);
                    }
                } catch (setError) {
                    console.warn(`Erro ao atualizar ${collection} no Firestore:`, setError);
                    setTimeout(async () => {
                        try {
                            const fullData = items.find(item => String(item.id) === idStr);
                            if (fullData) {
                                await db.collection(collection).doc(idStr).set(fullData);
                                console.log(`✅ Atualizado ${collection}/${idStr} no Firestore (retry)`);
                            }
                        } catch (retryError) {
                            console.warn(`Erro ao atualizar ${collection} no Firestore (retry):`, retryError);
                        }
                    }, 1000);
                }
            }
        }
        
        // 🔥 DISPARA EVENTO PARA ATUALIZAR INTERFACE
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'update', item: items.find(item => String(item.id) === idStr) } 
        }));
        
        return items.find(item => String(item.id) === idStr) || null;
    },
    
    async delete(collection, id) {
        const idStr = String(id);
        
        // Remove localmente
        const items = this._getLocalData(collection).filter(item => String(item.id) !== idStr);
        this._setLocalData(collection, items);
        this._clearLocalCache(collection);
        
        // 🔥 REMOVE DO FIRESTORE (SINCRONIZAÇÃO AUTOMÁTICA)
        if (this._isFirestoreAvailable()) {
            try {
                await db.collection(collection).doc(idStr).delete();
                console.log(`✅ Deletado ${collection}/${idStr} no Firestore`);
            } catch (error) {
                console.warn(`Erro ao deletar ${collection} no Firestore:`, error);
                setTimeout(async () => {
                    try {
                        await db.collection(collection).doc(idStr).delete();
                        console.log(`✅ Deletado ${collection}/${idStr} no Firestore (retry)`);
                    } catch (retryError) {
                        console.warn(`Erro ao deletar ${collection} no Firestore (retry):`, retryError);
                    }
                }, 1000);
            }
        }
        
        // 🔥 DISPARA EVENTO PARA ATUALIZAR INTERFACE
        document.dispatchEvent(new CustomEvent('dadosAtualizados', { 
            detail: { collection, action: 'delete', id: idStr } 
        }));
        
        return items;
    },
    
    // 🔥 CORREÇÃO: observeCollection agora prioriza Firestore
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

            // 🔥 SEMPRE ATUALIZA COM OS DADOS DO FIRESTORE (SOBRESCREVE)
            const localData = this._getLocalData(collection);
            const mergedData = this._mergeData(localData, items);
            this._setLocalData(collection, mergedData);
            this._clearLocalCache(collection);

            console.log(`🔄 Coleção '${collection}' atualizada em tempo real: ${mergedData.length} itens`);

            if (typeof onUpdate === 'function') {
                onUpdate(mergedData);
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

        this.collections.forEach(collection => {
            if (this._unsubscribers[collection]) {
                console.log(`ℹ️ Observador já existe para ${collection}`);
                return;
            }
            
            this._unsubscribers[collection] = this.observeCollection(collection, (items) => {
                if (typeof renderCallback === 'function') {
                    renderCallback();
                }
            });
        });

        console.log(`✅ Observadores em tempo real iniciados para a empresa: ${empresaAtual}`);
        this._isInitialized = true;
    },

    pararObservadores: function() {
        if (Object.keys(this._unsubscribers).length > 0) {
            Object.values(this._unsubscribers).forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (e) {
                        console.warn('Erro ao parar observador:', e);
                    }
                }
            });
            this._unsubscribers = {};
            this._currentEmpresa = null;
            console.log('⏹️ Observadores em tempo real parados.');
        }
        this._isInitialized = false;
    },
    
    // 🔥 CORREÇÃO: sincronizarDadosEmpresa agora FORÇA a sincronização
    async sincronizarDadosEmpresa(empresaId, force = false) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para sincronização');
            return 0;
        }
        
        const empresaAnterior = EmpresaManager.getEmpresaAtual();
        EmpresaManager.setEmpresaAtual(empresaId);
        
        let totalItens = 0;
        
        for (const collection of this.collections) {
            try {
                // 🔥 SEMPRE BUSCA DO FIRESTORE
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
                    // 🔥 PRIORIDADE: Dados do Firestore sobrescrevem locais
                    const mergedData = this._mergeData(localData, items);
                    this._setLocalData(collection, mergedData);
                    totalItens += mergedData.length;
                    console.log(`✅ Sincronizado ${collection}: ${mergedData.length} itens (Firestore prioritário)`);
                } else if (localData.length > 0 && force) {
                    // Se não há dados no Firestore e é força, sincroniza os locais
                    for (const item of localData) {
                        try {
                            await db.collection(collection).doc(String(item.id)).set({
                                ...item,
                                empresaId: empresaId
                            });
                            console.log(`⬆️ Sincronizado item local para Firestore: ${collection}/${item.id}`);
                        } catch (syncError) {
                            console.warn(`Erro ao sincronizar item ${item.id}:`, syncError);
                        }
                    }
                    totalItens += localData.length;
                } else {
                    // Mantém os dados locais
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
            
            // 🔥 PRIORIDADE: Firestore sobrescreve local
            if (items.length > 0) {
                const mergedData = this._mergeData(localData, items);
                this._setLocalData(collection, mergedData);
                this._clearLocalCache(collection);
                console.log(`✅ Sincronizado ${collection}: ${mergedData.length} itens`);
                return mergedData;
            } else if (localData.length > 0) {
                // Envia dados locais para o Firestore
                for (const item of localData) {
                    try {
                        await db.collection(collection).doc(String(item.id)).set({
                            ...item,
                            empresaId: empresaId
                        });
                    } catch (syncError) {
                        console.warn(`Erro ao sincronizar ${item.id}:`, syncError);
                    }
                }
                return localData;
            } else {
                return localData;
            }
        } catch (error) {
            console.warn(`Erro ao sincronizar ${collection}:`, error);
            return this._getLocalData(collection);
        }
    },
    
    async inicializarDadosEmpresa(empresaId) {
        if (!this._isFirestoreAvailable()) {
            console.warn('Firestore não disponível para inicialização');
            return;
        }
        
        const empresaAnterior = EmpresaManager.getEmpresaAtual();
        EmpresaManager.setEmpresaAtual(empresaId);
        
        try {
            // Verifica se já existem modelos
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
            
            // 🔥 VERIFICA SE HÁ CERTIFICADOS E SINCRONIZA
            const certificados = await this.getAll('certificados', true);
            console.log(`📋 ${certificados.length} certificados sincronizados`);
            
        } catch (error) {
            console.warn('Erro ao inicializar dados padrão:', error);
        }
        
        EmpresaManager.setEmpresaAtual(empresaAnterior);
    }
};

// ============================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================

// Inicializa observadores automaticamente após o carregamento da página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando sincronização automática...');
    
    // Aguarda um pouco para garantir que tudo está carregado
    setTimeout(async () => {
        try {
            const empresaId = EmpresaManager.getEmpresaAtual();
            
            // Sincroniza dados automaticamente
            if (FirestoreService._isFirestoreAvailable()) {
                // 🔥 FORÇA SINCRONIZAÇÃO COMPLETA (FORCE = TRUE)
                await FirestoreService.sincronizarDadosEmpresa(empresaId, true);
                
                // Inicia observadores se ainda não iniciados
                if (!FirestoreService._isInitialized) {
                    FirestoreService.iniciarObservadores(() => {
                        console.log('🔄 Dados atualizados em tempo real');
                        if (typeof window.renderAll === 'function') {
                            window.renderAll();
                        }
                    });
                }
                
                console.log('✅ Sincronização automática iniciada com sucesso!');
            } else {
                console.warn('⚠️ Firestore não disponível, usando dados locais');
            }
        } catch (error) {
            console.warn('Erro na inicialização automática:', error);
        }
    }, 1000);
});

// ============================================
// EXPORTAÇÃO
// ============================================

window.AuthService = AuthService;
window.FirestoreService = FirestoreService;
window.EmpresaManager = EmpresaManager;

console.log('✅ Firebase Services - SINCRONIZAÇÃO AUTOMÁTICA MULTI-DISPOSITIVO carregados!');
console.log('📌 Todos os registros são sincronizados em tempo real entre dispositivos');
console.log('📌 PRIORIDADE: Dados do Firestore sobrescrevem dados locais');
console.log('📌 Nenhuma ação manual necessária!');